import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, stat, open } from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { SCREEN_TO_GIF_LICENSE } from '../../common/screentogif-license';
import { SCREEN_TO_GIF, type ScreenToGifStatus } from '../../common/screentogif';

type Selection = { path: string; managed: boolean };
let download: AbortController | null = null;
let downloaded = 0;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Deliberately supports only the reviewed single-file portable ZIP, not arbitrary ZIP extraction. */
export function portableExecutable(zip: Buffer, pin: {bytes:number;sha256:string;exeBytes:number;exeSha256:string}=SCREEN_TO_GIF): Buffer {
  if (zip.length !== pin.bytes || hash(zip) !== pin.sha256) throw new Error('ScreenToGif: ZIP-Prüfsumme stimmt nicht.');
  let end = zip.length - 22;
  while (end >= Math.max(0,zip.length-65557) && zip.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0 || zip.readUInt32LE(end) !== 0x06054b50 || zip.readUInt16LE(end+4) || zip.readUInt16LE(end+6) || zip.readUInt16LE(end+8)!==1 || zip.readUInt16LE(end+10)!==1 || end+22+zip.readUInt16LE(end+20)!==zip.length) throw new Error('ScreenToGif: unerwarteter Archivaufbau.');
  const central = zip.readUInt32LE(end+16);
  if (central+46>end || zip.readUInt32LE(central)!==0x02014b50) throw new Error('ScreenToGif: ungültiges Archiv.');
  const flags=zip.readUInt16LE(central+8), method=zip.readUInt16LE(central+10);
  const compressed=zip.readUInt32LE(central+20), size=zip.readUInt32LE(central+24), nameLength=zip.readUInt16LE(central+28), local=zip.readUInt32LE(central+42);
  if ((flags&1) || ![0,8].includes(method) || size!==pin.exeBytes || zip.subarray(central+46,central+46+nameLength).toString()!=='ScreenToGif.exe' || local+30>central || zip.readUInt32LE(local)!==0x04034b50) throw new Error('ScreenToGif: unerwarteter Archivinhalt.');
  const start=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28);
  if (start+compressed>central) throw new Error('ScreenToGif: beschädigte Archivgröße.');
  const payload=zip.subarray(start,start+compressed);
  const exe=method===8?inflateRawSync(payload,{maxOutputLength:pin.exeBytes}):payload;
  if(exe.length!==pin.exeBytes || hash(exe)!==pin.exeSha256 || exe.toString('ascii',0,2)!=='MZ') throw new Error('ScreenToGif: EXE-Prüfsumme stimmt nicht.');
  return exe;
}

export class ScreenToGifTool {
  private checked: {path:string;mtime:number;size:number;valid:boolean}|null=null;
  constructor(private readonly root: string) {}
  private settings() { return path.join(this.root,'selection.json'); }
  private async selection(): Promise<Selection> {
    try { const raw=JSON.parse(await readFile(this.settings(),'utf8')); return {path:typeof raw.path==='string'?raw.path:'',managed:raw.managed===true}; }
    catch(e) { if((e as NodeJS.ErrnoException).code==='ENOENT')return {path:'',managed:false};throw new Error('ScreenToGif-Konfiguration ist nicht lesbar.'); }
  }
  async executable(verify=true): Promise<Selection> {
    const selected=await this.selection();
    if(!selected.path || !path.isAbsolute(selected.path) || !/\.exe$/i.test(selected.path))throw new Error('ScreenToGif zuerst einrichten.');
    const info=await stat(selected.path);if(!info.isFile()||info.size<4096||info.size>250_000_000)throw new Error('Ungültige ScreenToGif-EXE.');
    const file=await open(selected.path,'r');try{const header=Buffer.alloc(2);await file.read(header,0,2,0);if(header.toString()!=='MZ')throw new Error('Eine native Windows-EXE auswählen.');}finally{await file.close();}
    if(selected.managed){
      const cached=this.checked?.path===selected.path&&this.checked.mtime===info.mtimeMs&&this.checked.size===info.size;
      const valid=info.size===SCREEN_TO_GIF.exeBytes&&(verify||!cached?hash(await readFile(selected.path))===SCREEN_TO_GIF.exeSha256:this.checked!.valid);
      this.checked={path:selected.path,mtime:info.mtimeMs,size:info.size,valid};
      if(!valid)throw new Error('ScreenToGif wurde verändert. EXE erneut auswählen oder neu einrichten.');
    }
    return selected;
  }
  async select(file: string, managed=false): Promise<void> {
    if(!path.isAbsolute(file)||!/\.exe$/i.test(file))throw new Error('Eine native ScreenToGif.exe auswählen.');
    await mkdir(this.root,{recursive:true});
    // Validate before publishing selection; the installer already checked the managed payload hash.
    const info=await stat(file);if(!info.isFile()||info.size<4096||info.size>250_000_000)throw new Error('Ungültige ScreenToGif-EXE.');
    const handle=await open(file,'r');try{const header=Buffer.alloc(2);await handle.read(header,0,2,0);if(header.toString()!=='MZ')throw new Error('Eine native Windows-EXE auswählen.');}finally{await handle.close();}
    const temporary=path.join(this.root,`selection-${randomUUID()}.tmp`);await writeFile(temporary,JSON.stringify({path:file,managed}),{flag:'wx'});
    await rename(temporary,this.settings());
  }
  async status(): Promise<ScreenToGifStatus> {
    const selected=await this.selection();let installed=false;
    try{await this.executable(false);installed=true;}catch{/* Full managed hash is rechecked before every launch, not by the lightweight progress poll. */}
    return {supported:process.platform==='win32'&&process.arch==='x64',installed,path:selected.path,managed:selected.managed,version:selected.managed?SCREEN_TO_GIF.version:'',downloading:!!download,downloaded,total:SCREEN_TO_GIF.bytes};
  }
  cancel() { download?.abort(); }
  async install(): Promise<ScreenToGifStatus> {
    if(process.platform!=='win32'||process.arch!=='x64')throw new Error('Der optionale Download unterstützt Windows x64.');
    if(download)throw new Error('ScreenToGif wird bereits heruntergeladen.');
    const controller=new AbortController();download=controller;downloaded=0;
    const timeout=setTimeout(()=>controller.abort(),180000);
    try{
      const response=await fetch(SCREEN_TO_GIF.url,{signal:controller.signal,redirect:'follow'});
      if(!response.ok||!response.body||new URL(response.url).protocol!=='https:')throw new Error('ScreenToGif-Download fehlgeschlagen.');
      const chunks:Buffer[]=[];const reader=response.body.getReader();
      try {while(true){const part=await reader.read();if(part.done)break;downloaded+=part.value.length;if(downloaded>SCREEN_TO_GIF.bytes){await reader.cancel();throw new Error('ScreenToGif-Download ist größer als erwartet.');}chunks.push(Buffer.from(part.value));}}finally{reader.releaseLock();}
      const exe=portableExecutable(Buffer.concat(chunks));controller.signal.throwIfAborted();
      const folder=path.join(this.root,`${SCREEN_TO_GIF.version}-${randomUUID()}`);await mkdir(folder,{recursive:true});
      const target=path.join(folder,'ScreenToGif.exe');await writeFile(target,exe,{flag:'wx'});
      await writeFile(path.join(folder,'ORIGIN.json'),JSON.stringify(SCREEN_TO_GIF,null,2),{flag:'wx'});
      // An empty portable settings dictionary keeps this managed copy separate from a user's installation.
      await writeFile(path.join(folder,'Settings.xaml'),'<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" />',{flag:'wx'});
      await writeFile(path.join(folder,'LICENSE-Ms-PL.txt'),SCREEN_TO_GIF_LICENSE,{flag:'wx'});
      await this.select(target,true);
    }finally{clearTimeout(timeout);download=null;}
    return this.status();
  }
}
