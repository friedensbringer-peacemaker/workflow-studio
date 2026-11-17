import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import { portableExecutable, ScreenToGifTool } from './screentogif-tool';
import { SCREEN_TO_GIF, ScreenToGifRequestSchema, screenToGifArgs } from '../../common/screentogif';
import { prepareScreenToGifJob, screenToGifJob, listScreenToGifJobs, validateScreenToGifResult } from './screentogif-project';
import { storeMaterial, resolveMaterial } from './materials';
import { exportGuidePackage } from './guide-export';
import type { StudioDocument } from '../../common/studio';

const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
test('optional tool extracts only the digest-bound single executable and rejects extra/traversal entries',()=>{
 const exe=Buffer.alloc(4096);exe.write('MZ');const archive=new AdmZip();archive.addFile('ScreenToGif.exe',exe);const zip=archive.toBuffer();
 const pin={bytes:zip.length,sha256:digest(zip),exeBytes:exe.length,exeSha256:digest(exe)};
 assert.deepEqual(portableExecutable(zip,pin),exe);
 const changed=Buffer.from(zip);changed[40]^=1;assert.throws(()=>portableExecutable(changed,pin),/Prüfsumme/);
 const extra=new AdmZip();extra.addFile('ScreenToGif.exe',exe);extra.addFile('other.exe',exe);const unsafe=extra.toBuffer();
 assert.throws(()=>portableExecutable(unsafe,{...pin,bytes:unsafe.length,sha256:digest(unsafe)}),/Archiv/);
 assert.throws(()=>portableExecutable(zip,{...pin,exeSha256:'0'.repeat(64)}),/Prüfsumme/);
 assert.equal(SCREEN_TO_GIF.version,'2.43.2');
});
test('tool arguments use a separate editor instance, preserve file paths and never auto-start recording',()=>{
 const input='C:\\synthetic space\\input & file.stg';
 assert.deepEqual(screenToGifArgs('de','steps',input),['-new','-lang','de','-open','editor',input]);
 assert.ok(!screenToGifArgs('en','recorder').includes('-capture'));
 assert.throws(()=>ScreenToGifRequestSchema.parse({mode:'steps',stepId:'x',first:0,last:60,language:'de'}));
});
test('project round trip preserves edited images, exact frame delays and input originals without exposing unrelated files',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'workflow-stg-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(path.join(root,'frames'));const original=await sharp({create:{width:60,height:40,channels:3,background:'#fff'}}).png().toBuffer();
 const edited=await sharp({create:{width:60,height:40,channels:3,background:'#000'}}).png().toBuffer();
 await writeFile(path.join(root,'frames','original.png'),original);await writeFile(path.join(root,'credentials.json'),'PRIVATE');
 const image=await storeMaterial(root,'edited.png',edited);
 const document:StudioDocument={version:1,sessionId:'synthetic',title:'Fixture',intent:'',transcript:'PRIVATE TRANSCRIPT',updatedAt:0,steps:[{id:'one',title:'One',detail:'',why:'',exceptions:'',app:'',source:'capture',frame:'original.png',image},{id:'two',title:'Two',detail:'',why:'',exceptions:'',app:'',source:'capture',frame:'original.png'}]};
 const request=ScreenToGifRequestSchema.parse({mode:'steps',stepId:'one',first:0,last:1,delay:650,pointer:false,language:'de'});
 const job=await prepareScreenToGifJob(root,document,request);const zip=new AdmZip(job.input!);
 assert.deepEqual(zip.getEntries().map(e=>e.entryName).sort(),['0000.png','0001.png','Project.json']);
 const project=JSON.parse(zip.readAsText('Project.json'));assert.equal(project.Frames.length,2);assert.equal(project.Frames[0].Delay,650);assert.equal(project.Frames[0].Path,'0000.png');
 const raw=await sharp(zip.readFile('0000.png')!).removeAlpha().raw().toBuffer();assert.equal(raw[(360*1280+640)*3],0);
 assert.deepEqual(await readFile(path.join(root,'frames','original.png')),original);
 await writeFile(path.join(job.output,'result.png'),edited);await writeFile(path.join(job.output,'ignore.exe'),'MZ');
 const found=await screenToGifJob(root,job.id);assert.deepEqual(found.files?.map(f=>f.name),['result.png']);
 assert.equal((await listScreenToGifJobs(root,'one'))[0].id,job.id);assert.equal((await listScreenToGifJobs(root,'two')).length,0);
 assert.deepEqual(await validateScreenToGifResult(path.join(job.output,'result.png')),edited);
 await writeFile(path.join(job.output,'fake.gif'),'not an image');await assert.rejects(validateScreenToGifResult(path.join(job.output,'fake.gif')));
 await assert.rejects(prepareScreenToGifJob(root,document,{...request,mode:'video',originalVideoConfirmed:false}),/bestätigen/);
});
test('video attachments survive canonical lookup and offline guide export without changing voice WebM',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'workflow-stg-video-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const mp4=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom'),Buffer.alloc(24)]);
 const video=await storeMaterial(root,'result.mp4',mp4,true);assert.equal((await resolveMaterial(root,video.id)).material.kind,'video');
 const voice=await storeMaterial(root,'voice.webm',Buffer.from('synthetic voice'));assert.equal((await resolveMaterial(root,voice.id)).material.kind,'audio');
 const webm=await storeMaterial(root,'result.webm',Buffer.from([0x1a,0x45,0xdf,0xa3,0,0,0,0]),true);assert.equal((await resolveMaterial(root,webm.id)).material.mime,'video/webm');
 const document:StudioDocument={version:1,sessionId:'synthetic',title:'Video',intent:'',updatedAt:0,transcript:'',steps:[{id:'one',title:'One',detail:'',why:'',exceptions:'',app:'',source:'manual',materials:[video]}]};
 const destination=path.join(root,'..',path.basename(root)+'.zip');t.after(()=>rm(destination,{force:true}));await exportGuidePackage(root,destination,document,{materials:true,transcript:false});
 const zip=new AdmZip(destination);assert.match(zip.readAsText('index.html'),/<video controls preload="none"/);assert.deepEqual(zip.readFile(`materials/${video.file}`),mp4);
});
test('manual executable selection rejects scripts and a failed optional download does not replace an existing selection',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'workflow-stg-tool-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const tool=new ScreenToGifTool(path.join(root,'tool'));const exe=Buffer.alloc(4096);exe.write('MZ');const file=path.join(root,'ScreenToGif.exe');await writeFile(file,exe);
 await tool.select(file);assert.equal((await tool.status()).installed,true);await assert.rejects(tool.select(path.join(root,'bad.cmd')),/exe/i);
 if(process.platform==='win32'&&process.arch==='x64'){
  const before=globalThis.fetch;globalThis.fetch=async()=>{const r=new Response(Buffer.from('corrupted archive'));Object.defineProperty(r,'url',{value:SCREEN_TO_GIF.url});return r;};
  try{await assert.rejects(tool.install(),/Prüfsumme/);assert.equal((await tool.executable()).path,file);}finally{globalThis.fetch=before;}
 }
});
