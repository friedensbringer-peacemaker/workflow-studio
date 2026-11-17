import { createWriteStream } from 'node:fs';
import { mkdir, realpath, readFile, writeFile, stat, readdir, copyFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { ZipArchive } from 'archiver';
import type { StudioDocument } from '../../common/studio';
import { ScreenToGifJobSchema, type ScreenToGifJob, type ScreenToGifRequest } from '../../common/screentogif';
import { MAX_MATERIAL_BYTES } from '../../common/step-material';
import { stepImage } from './images';
import { resolveMaterial } from './materials';

async function childDirectory(base:string,...parts:string[]) {
  const root=await realpath(base);const folder=path.join(root,...parts);await mkdir(folder,{recursive:true});
  const actual=await realpath(folder),relative=path.relative(root,actual);
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('ScreenToGif-Arbeitsordner liegt außerhalb der Sitzung.');
  return actual;
}
export async function writeStepProject(dir:string,document:StudioDocument,request:ScreenToGifRequest):Promise<number> {
  const frames:{Path:string;Name:string;Delay:number;Clicked:boolean}[]=[];
  const pngs:Buffer[]=[];let bytes=0;
  for(const step of document.steps.slice(request.first,request.last+1)){
    const input=await stepImage(dir,step);if(!input)continue;
    const image=sharp(input,{limitInputPixels:16_777_216});const metadata=await image.metadata();
    if(!['png','jpeg','webp','gif'].includes(metadata.format??''))throw new Error('Nur Rasterbilder als Schrittfolge verwenden.');
    let png=await image.rotate().resize(1280,720,{fit:'contain',background:'#ffffff'}).png().toBuffer();
    const pointer=step.image?step.imagePointer:step.pointer;
    if(request.pointer&&pointer){
      const width=metadata.autoOrient?.width??metadata.width!,height=metadata.autoOrient?.height??metadata.height!;
      const scale=Math.min(1280/width,720/height),x=(1280-width*scale)/2+pointer.x*width*scale,y=(720-height*scale)/2+pointer.y*height*scale;
      png=await sharp(png).composite([{input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><circle cx="${x}" cy="${y}" r="12" fill="#ffdd04" fill-opacity="0.7" stroke="#212121" stroke-width="2"/></svg>`)}]).png().toBuffer();
    }
    bytes+=png.length;if(bytes>128*1024*1024)throw new Error('Bildfolge ist zu groß. Weniger Schritte auswählen.');
    const name=`${String(frames.length).padStart(4,'0')}.png`;pngs.push(png);frames.push({Path:name,Name:name,Delay:request.delay,Clicked:false});
  }
  if(!frames.length)throw new Error('In diesem Bereich sind keine Schrittbilder vorhanden.');
  return new Promise<number>((resolve,reject)=>{
    const stream=createWriteStream(path.join(dir,'project.stg'),{flags:'wx'});const archive=new ZipArchive({zlib:{level:6}});
    let failure:Error|null=null;
    const fail=(e:Error)=>{if(failure)return;failure=e;archive.abort();stream.destroy();};
    stream.on('error',fail);archive.on('error',fail);archive.on('warning',fail);
    stream.on('close',()=>failure?reject(failure):stream.writableFinished?resolve(frames.length):reject(new Error('ScreenToGif-Projekt nicht vollständig geschrieben.')));
    archive.pipe(stream);
    archive.append(JSON.stringify({Relative:'workflow-studio',CreationDate:`/Date(${Date.now()})/`,Frames:frames,IsNew:true,CreatedBy:0,Width:1280,Height:720,Dpi:96,BitDepth:32}),{name:'Project.json'});
    pngs.forEach((png,i)=>archive.append(png,{name:frames[i].Name}));void archive.finalize().catch(fail);
  });
}

export async function prepareScreenToGifJob(session:string,document:StudioDocument,request:ScreenToGifRequest):Promise<ScreenToGifJob>{
  if(!document.steps.some(s=>s.id===request.stepId))throw new Error('Zielschritt nicht gefunden.');
  const jobs=await childDirectory(session,'screentogif-jobs');const id=randomUUID();const folder=await childDirectory(jobs,id);
  const input=await childDirectory(folder,'input'),output=await childDirectory(folder,'output');let file:string|undefined;
  if(request.mode==='steps'){
    // Read only canonical source references from the session; write the project to its isolated input directory.
    const frames:{step:typeof document.steps[number];bytes:Buffer}[]=[];
    // writeStepProject accepts separate source/output paths via the narrow adapter below.
    for(const step of document.steps.slice(request.first,request.last+1)){const bytes=await stepImage(session,step);if(bytes)frames.push({step,bytes});}
    if(!frames.length)throw new Error('In diesem Bereich sind keine Schrittbilder vorhanden.');
    // Temporary source copies use generated names; original filenames and sidecars are never passed to the editor.
    await mkdir(path.join(input,'frames'));
    const copied={...document,steps:frames.map(({step,bytes},i)=>({...step,frame:`${i}.png`,image:undefined,pointer:step.image?step.imagePointer:step.pointer}))};
    for(const [i,item]of frames.entries())await writeFile(path.join(input,'frames',`${i}.png`),item.bytes,{flag:'wx'});
    await writeStepProject(input,copied,{...request,first:0,last:copied.steps.length-1});file=path.join(input,'project.stg');
  }else if(request.mode==='video'){
    if(!request.originalVideoConfirmed)throw new Error('Die Übergabe des möglicherweise ungeschwärzten Originalvideos bestätigen.');
    const root=await realpath(session),source=await realpath(path.join(root,'video.webm'));
    if(path.dirname(source)!==root||(await stat(source)).size>250*1024*1024)throw new Error('Sitzungsvideo fehlt oder ist größer als 250 MB.');
    file=path.join(input,'source.webm');await copyFile(source,file);
  }else if(request.mode==='material'){
    const {material,target}=await resolveMaterial(session,request.materialId??'');
    if(material.kind!=='image'&&material.kind!=='video')throw new Error('Für ScreenToGif ein Bild oder Video auswählen.');
    file=path.join(input,`source${path.extname(material.file)}`);await copyFile(target,file);
  }
  const meta=ScreenToGifJobSchema.parse({id,stepId:request.stepId,createdAt:Date.now(),mode:request.mode});
  await writeFile(path.join(folder,'job.json'),JSON.stringify(meta),{flag:'wx'});
  return {...meta,input:file,output};
}

export async function screenToGifJob(session:string,id:string):Promise<ScreenToGifJob>{
  ScreenToGifJobSchema.shape.id.parse(id);
  const root=await realpath(session),folder=await realpath(path.join(root,'screentogif-jobs',id));
  if(path.relative(root,folder).startsWith('..')||path.isAbsolute(path.relative(root,folder)))throw new Error('Ungültiger ScreenToGif-Arbeitsordner.');
  const metaPath=await realpath(path.join(folder,'job.json'));if(path.dirname(metaPath)!==folder)throw new Error('Ungültiger Auftrag.');
  const meta=ScreenToGifJobSchema.parse(JSON.parse(await readFile(metaPath,'utf8')));if(meta.id!==id)throw new Error('Ungültiger Auftrag.');
  const output=await realpath(path.join(folder,'output'));if(path.dirname(output)!==folder)throw new Error('Ungültiger Ausgabeordner.');
  const files=[];
  for(const entry of (await readdir(output,{withFileTypes:true})).slice(0,100)){
    if(!entry.isFile()||! /\.(gif|png|jpe?g|webp|mp4|webm)$/i.test(entry.name))continue;
    const target=await realpath(path.join(output,entry.name));if(path.dirname(target)!==output)continue;
    const info=await stat(target);if(info.size>0&&info.size<=MAX_MATERIAL_BYTES)files.push({name:entry.name,bytes:info.size});
  }
  return {...meta,output,files};
}

export async function listScreenToGifJobs(session:string,stepId:string):Promise<ScreenToGifJob[]>{
  const root=await childDirectory(session,'screentogif-jobs');const jobs=[];
  for(const entry of (await readdir(root,{withFileTypes:true})).slice(-200)){
    if(!entry.isDirectory()||!ScreenToGifJobSchema.shape.id.safeParse(entry.name).success)continue;
    try{const job=await screenToGifJob(session,entry.name);if(job.stepId===stepId)jobs.push(job);}catch{/* Ignore incomplete failed jobs; never infer an executable or arbitrary source from them. */}
  }
  return jobs.sort((a,b)=>b.createdAt-a.createdAt).slice(0,20);
}

export async function validateScreenToGifResult(file:string):Promise<Buffer>{
  const before=await stat(file);if(!before.isFile()||before.size<8||before.size>MAX_MATERIAL_BYTES)throw new Error('Ergebnis fehlt oder ist größer als 25 MB.');
  const bytes=await readFile(file);const after=await stat(file);
  if(after.size!==before.size||after.mtimeMs!==before.mtimeMs)throw new Error('Die Datei wird noch geschrieben. Export abschließen und erneut übernehmen.');
  const ext=path.extname(file).toLowerCase();
  if(['.gif','.png','.jpg','.jpeg','.webp'].includes(ext)){
    const meta=await sharp(bytes,{limitInputPixels:64_000_000}).metadata();const formats:Record<string,string>={'.gif':'gif','.png':'png','.jpg':'jpeg','.jpeg':'jpeg','.webp':'webp'};
    if(meta.format!==formats[ext]||(meta.pages??1)>1000||(meta.width??0)*(meta.height??0)*(meta.pages??1)>128_000_000)throw new Error('Bildformat stimmt nicht mit der Dateiendung überein.');
  }else if(ext==='.mp4'){
    if(bytes.toString('ascii',4,8)!=='ftyp')throw new Error('Keine erkennbare MP4-Datei.');
  }else if(ext==='.webm'){
    if(bytes.readUInt32BE(0)!==0x1a45dfa3)throw new Error('Keine erkennbare WebM-Datei.');
  }else throw new Error('GIF, PNG, JPEG, WebP, MP4 oder WebM auswählen.');
  return bytes;
}
