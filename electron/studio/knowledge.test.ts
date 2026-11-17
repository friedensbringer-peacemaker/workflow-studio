import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PROVIDER_TEST_DOCUMENT, DEFAULT_STUDIO_SETTINGS, StudioDocumentSchema } from '../../common/studio';
import { interviewQuestions, applyInterview, skillMarkdown, validateSkillMarkdown } from '../../common/workflow-knowledge';
import { requestProviderRaw, analysisData } from './providers';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { prepareVision } from './vision';
import { storeMaterial } from './materials';
import { renderImageEdit } from './images';
import { exportGuidePackage } from './guide-export';
import AdmZip from 'adm-zip';

test('interview preserves drafts, applies reviewed facts only and does not duplicate unchanged answers', () => {
 const doc=structuredClone(PROVIDER_TEST_DOCUMENT);doc.steps[0].why='';doc.steps[0].exceptions='';doc.intent='';
 const qs=interviewQuestions(doc);assert.equal(qs.length,3);
 qs[0].answer='A checked objective';qs[0].reviewed=true;qs[1].answer='Verified prerequisite';qs[1].reviewed=true;qs[2].answer='Unreviewed assumption';
 const applied=StudioDocumentSchema.parse(applyInterview(doc,qs));
 assert.equal(applied.intent,'A checked objective');assert.equal(applied.steps[0].why,'Verified prerequisite');assert.equal(applied.steps[0].exceptions,'');
 assert.equal(applied.interview?.[2].answer,'Unreviewed assumption');
 assert.equal(applyInterview(applied,qs).steps[0].why,'Verified prerequisite');
});
test('vision and guide use edited pixels; OCR failure cannot send raw pixels',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'workflow-vision-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const session=path.join(root,'session');await mkdir(path.join(session,'frames'),{recursive:true});
 const source=await sharp({create:{width:100,height:100,channels:3,background:'#fff'}}).png().toBuffer();await writeFile(path.join(session,'frames','original.png'),source);
 const edited=await storeMaterial(session,'edited.png',await renderImageEdit(source,{marks:[{kind:'mask',x:.2,y:.2,x2:.8,y2:.8}]}));
 const doc=structuredClone(PROVIDER_TEST_DOCUMENT);doc.steps[0].frame='original.png';doc.steps[0].image=edited;
 const model={isAdvancedEnabled:()=>true,isAdvancedReady:()=>true,getOcr:()=>({recognize:async()=>{throw new Error('synthetic OCR failure');}})} as any;
 await assert.rejects(prepareVision(session,doc,[],model),/Bildschutz fehlgeschlagen/);
 model.getOcr=()=>({recognize:async()=>[]});
 const result=await prepareVision(session,doc,[],model);const pixels=await sharp(Buffer.from(result[0].data,'base64')).removeAlpha().raw().toBuffer();assert.ok(pixels[(50*100+50)*3]<10);
 const destination=path.join(root,'guide.zip');await exportGuidePackage(session,destination,doc,{materials:false,transcript:false});
 const zip=new AdmZip(destination);assert.ok(!zip.getEntry('frames/original.png'));assert.deepEqual(zip.readFile(`frames/edited_${edited.file}`),await renderImageEdit(source,{marks:[{kind:'mask',x:.2,y:.2,x2:.8,y2:.8}]}));
 model.isAdvancedReady=()=>false;await assert.rejects(prepareVision(session,doc,[],model),/noch nicht bereit/);
});
test('skill has portable frontmatter and excludes draft answers, transcript and local file references',()=>{
 const doc=structuredClone(PROVIDER_TEST_DOCUMENT);doc.transcript='PRIVATE-RAW';doc.steps[0].frame='private-path.jpg';
 doc.interview=[{id:'draft',target:'intent',question:'?',answer:'UNREVIEWED',reviewed:false}];
 const text=skillMarkdown(doc);assert.match(text,/^---\nname: "[a-z0-9-]+"\ndescription:/);assert.match(text,/not a tested automation script/);
 assert.doesNotMatch(text,/PRIVATE-RAW|UNREVIEWED|private-path/);
 assert.doesNotMatch(analysisData(doc),/private-path|UNREVIEWED/);
 assert.equal(validateSkillMarkdown(text),text);
 assert.throws(()=>validateSkillMarkdown('---\nempty: true\n---\nname: fake\ndescription: misplaced'));
 assert.throws(()=>validateSkillMarkdown('---\nname: "invalid name"\ndescription: example\n---\ntext'));
});
test('image adapters require capability and send bounded JPEG content in each provider wire format',async()=>{
 const seen:any[]=[];
 const server=createServer((req,res)=>{let text='';req.on('data',c=>text+=c);req.on('end',()=>{seen.push(JSON.parse(text));res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/api/chat'?{message:{content:'fixture'}}:req.url==='/messages'?{content:[{type:'text',text:'fixture'}]}:{choices:[{message:{content:'fixture'}}]}));});});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const baseUrl=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;const images=[{stepId:'test-1',mime:'image/jpeg' as const,data:Buffer.from('synthetic jpeg').toString('base64')}];
 try{
  for(const kind of ['ollama','compatible','claude'] as const){const profile={...DEFAULT_STUDIO_SETTINGS.profiles.find(p=>p.kind===kind)!,baseUrl,model:'fixture',vision:true};assert.equal(await requestProviderRaw(profile,'fake-key','synthetic',AbortSignal.timeout(5000),images,false),'fixture');}
  assert.deepEqual(seen[0].messages[0].images,[images[0].data]);assert.equal(seen[0].format,undefined);
  assert.equal(seen[1].messages[0].content[1].image_url.url,`data:image/jpeg;base64,${images[0].data}`);
  assert.equal(seen[2].messages[0].content[1].source.data,images[0].data);
  await assert.rejects(requestProviderRaw({...DEFAULT_STUDIO_SETTINGS.profiles[0],model:'fixture'},'','',AbortSignal.timeout(100),images),/bildfähig|Bilder|Bild/);
  assert.equal(seen.length,3);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});

test('skill templates localize all generated guidance and keep source facts unchanged',()=>{
 const doc=structuredClone(PROVIDER_TEST_DOCUMENT);
 const de=skillMarkdown(doc,'de'),en=skillMarkdown(doc,'en');
 assert.match(de,/Verwende diesen Skill/);assert.match(de,/Ergebnis prüfen/);assert.match(de,/\*\*Warum:/);
 assert.doesNotMatch(de,/Use this skill|## Review|not a tested automation/);
 assert.match(en,/Use this skill/);assert.match(en,/\*\*Why:/);assert.doesNotMatch(en,/\*\*Warum:/);
 assert.ok(en.includes(doc.steps[0].detail));assert.ok(de.includes(doc.steps[0].detail));
 assert.equal((de.match(/^# /gm)||[]).length,1);assert.equal(validateSkillMarkdown(de),de);
});
