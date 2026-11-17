import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,readFile,rm,readdir,realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { wikiRequest,publishWiki } from './wiki';
import { WikiTargetSchema,wikiMarkdown } from '../../common/wiki';
import { PROVIDER_TEST_DOCUMENT } from '../../common/studio';
import { reviewSnapshot } from '../../common/process-review';

const id='12345678-1234-1234-1234-123456789abc';
test('Wiki adapters generate bounded requests for explicit destinations without raw transcript',async()=>{
  const text=wikiMarkdown({...PROVIDER_TEST_DOCUMENT,transcript:'PRIVATE RAW TRANSCRIPT'});
  assert.doesNotMatch(text,/PRIVATE RAW TRANSCRIPT/);
  const review = {report:{clarity:'a',optimization:'b',automation:'c',infrastructure:'d',methodology:'e',questions:[]},method:{id:'lean' as const,script:'Prüfen'},provider:'fixture',createdAt:1,snapshot:reviewSnapshot(PROVIDER_TEST_DOCUMENT)};
  const reviewed = {...PROVIDER_TEST_DOCUMENT,processReview:review};
  assert.doesNotMatch(wikiMarkdown(reviewed,true),/seit der Bewertung geändert/);
  assert.match(wikiMarkdown({...reviewed,title:'Geändert'},true),/seit der Bewertung geändert/);
  const outline=WikiTargetSchema.parse({kind:'outline',baseUrl:'https://wiki.example.com',parentId:id});
  const req=wikiRequest(outline,'Title',text);assert.equal(req.url,'https://wiki.example.com/api/documents.create');assert.equal(req.body.publish,true);assert.ok(!req.body.text!.startsWith('# '));
  assert.throws(()=>wikiRequest({...outline,baseUrl:'https://user:secret@example.com'},'x','x'));
  assert.throws(()=>wikiRequest({...outline,baseUrl:'http://example.com'},'x','x'));
  assert.throws(()=>wikiRequest(outline,'x','x'.repeat(450001)));
  const notion=WikiTargetSchema.parse({kind:'notion',parentId:id});assert.equal(wikiRequest(notion,'Title',text).headers['Notion-Version'],'2026-03-11');
  let calls=0;
  const fetcher=(async(url:any,init:any)=>{calls++;assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer fixture');return new Response(JSON.stringify({data:{id,url:'/doc/new'}}),{status:200});}) as typeof fetch;
  assert.equal(await publishWiki(outline,'Title',text,'fixture',fetcher),'https://wiki.example.com/doc/new');assert.equal(calls,1);
  await assert.rejects(publishWiki(outline,'Title',text,'fixture',(async()=>{throw Error('private transport detail');}) as typeof fetch),/Vor einem erneuten Versuch/);
});
test('Markdown wiki creates independent files without overwriting prior content',async t=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'workflow-wiki-'));t.after(()=>rm(folder,{recursive:true,force:true}));
  const target=WikiTargetSchema.parse({kind:'markdown',folder});
  const first=await publishWiki(target,'../Prozess','First','');const second=await publishWiki(target,'../Prozess','Second','');
  assert.equal(path.dirname(first),await realpath(folder));assert.notEqual(first,second);assert.equal(await readFile(first,'utf8'),'First');assert.equal((await readdir(folder)).length,2);
});
