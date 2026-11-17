import { randomUUID } from 'node:crypto';
import { writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { WikiTargetSchema, type WikiTarget } from '../../common/wiki';

export function wikiRequest(input: WikiTarget, title: string, markdown: string) {
  const target=WikiTargetSchema.parse(input);
  if(!/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(target.parentId)) throw new Error('Gültige Seiten- oder Sammlungs-ID eintragen.');
  const bodyText=markdown.replace(/^# [^\n]*\n+/, '');
  if(Buffer.byteLength(markdown,'utf8')>450000) throw new Error('Wiki-Text ist zu groß. Prozess kürzen oder als Markdown exportieren.');
  if(target.kind==='notion') return {url:'https://api.notion.com/v1/pages',headers:{'Notion-Version':'2026-03-11'},body:{parent:{page_id:target.parentId},properties:{title:{type:'title',title:[{type:'text',text:{content:title.slice(0,500)||'Prozess'}}]}},markdown:bodyText,markdown_version:'v2',notifications:{mode:'silent'}}};
  if(target.kind!=='outline') throw new Error('Unbekanntes Wiki-Ziel.');
  const url=new URL(target.baseUrl);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/') throw new Error('Outline-Server als HTTPS-Adresse ohne Pfad oder Zugangsdaten eintragen.');
  return {url:new URL('/api/documents.create',url).href,headers:{} as Record<string,string>,body:{collectionId:target.parentId,title:title.slice(0,500)||'Prozess',text:bodyText,publish:true}};
}
export async function publishWiki(target: WikiTarget, title:string, markdown:string, key:string, fetcher:typeof fetch=fetch):Promise<string> {
  if(target.kind==='markdown') {
    const folder=await realpath(target.folder);
    const name=(title.replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,60)||'Prozess')+'-'+randomUUID().slice(0,8)+'.md';
    const file=path.join(folder,name); await writeFile(file,markdown,{encoding:'utf8',flag:'wx'}); return file;
  }
  const request=wikiRequest(target,title,markdown);
  if(!key) throw new Error('API-Schlüssel für dieses Wiki hinterlegen.');
  let response:Response;
  try { response=await fetcher(request.url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{...request.headers,'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(request.body)}); }
  catch { throw new Error('Wiki-Antwort ausgeblieben. Vor einem erneuten Versuch im Ziel prüfen, ob die Seite bereits angelegt wurde.'); }
  if(!response.ok) throw new Error('Wiki meldet HTTP '+response.status+'. Zugang, Berechtigungen und Ziel prüfen. Vor erneutem Schreiben auf eine bereits angelegte Seite prüfen.');
  const raw=await response.text();if(raw.length>2_000_000) throw new Error('Wiki-Antwort unerwartet groß. Seite im Ziel prüfen.');
  let json:any;try{json=JSON.parse(raw);}catch{throw new Error('Wiki-Antwort unlesbar. Seite im Ziel prüfen.');}
  const value=target.kind==='outline'?json.data:json;
  if(!value?.id) throw new Error('Keine Seitenbestätigung erhalten. Seite im Ziel prüfen.');
  if(typeof value.url==='string') {
    const url=new URL(value.url,target.kind==='outline'?target.baseUrl:'https://www.notion.so');
    const allowed=target.kind==='outline'?url.origin===new URL(target.baseUrl).origin:['www.notion.so','notion.so'].includes(url.hostname);
    if(url.protocol==='https:'&&allowed&&!url.username&&!url.password) return url.href;
  }
  return 'Seite angelegt: '+String(value.id).slice(0,100);
}
