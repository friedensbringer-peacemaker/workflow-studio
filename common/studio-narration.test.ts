import test from 'node:test';
import assert from 'node:assert/strict';
import {attachNarration} from './studio-narration';
import {PROVIDER_TEST_DOCUMENT,applySuggestion,documentMarkdown} from './studio';
import {mergeSteps,splitStep} from './step-organization';
import {guideHtml} from './guide-export';
const epoch=1800000000000;
const doc={...PROVIDER_TEST_DOCUMENT,steps:[{...PROVIDER_TEST_DOCUMENT.steps[0],id:'a',startMs:epoch,endMs:epoch+5000},{...PROVIDER_TEST_DOCUMENT.steps[0],id:'b',startMs:epoch+5000,endMs:epoch+10000}]};
const source={startedAt:epoch,segments:[{atMs:1000,endMs:3000,text:'Vor dem Angebot prüfen.'},{atMs:4500,endMs:7000,text:'Bei Zweifeln nachfragen.'}]};
test('recording-relative narration joins epoch-timed screenshots by greatest overlap',()=>{
 const result=attachNarration(doc,source);
 assert.equal(result.steps[0].narration?.[0].text,source.segments[0].text);
 assert.equal(result.steps[1].narration?.[0].text,source.segments[1].text);
 assert.equal(result.steps[0].why,doc.steps[0].why);
 assert.match(documentMarkdown(result),/Erklärungen aus der Aufnahme/);assert.match(guideHtml(result),/Bei Zweifeln nachfragen/);
});
test('reloading preserves edited or deliberately assigned narration and imports only later segments',()=>{
 const result=attachNarration(doc,source);result.steps[0].narration![0].text='Fachlich korrigiert';result.steps[1].narration=[];
 assert.equal(attachNarration(doc,{...source,segments:[...source.segments,source.segments[0]]}).steps[0].narration?.length,1);
 assert.equal(attachNarration(result,source),result);
 const next=attachNarration({...result,steps:[result.steps[1],result.steps[0]]},{...source,segments:[...source.segments,{atMs:8000,endMs:9000,text:'Weitere Erklärung'}]});
 assert.equal(next.steps[0].narration?.[0].text,'Weitere Erklärung');assert.equal(next.steps[1].narration?.[0].text,'Fachlich korrigiert');
});
test('merging, splitting and AI suggestions retain narrated evidence without duplication',()=>{
 const result=attachNarration(doc,source);const merged=mergeSteps(result,0);assert.equal(merged.steps[0].narration?.length,2);
 const split=splitStep(merged,0,'new',5);assert.equal(split.steps[0].narration?.length,2);assert.equal(split.steps[1].narration?.length,0);
 const suggested=applySuggestion(result,{title:'T',intent:'I',steps:[doc.steps[0]],provider:'fixture'});assert.equal(suggested.steps.length,2);assert.equal(suggested.steps[0].narration?.length,1);
});
test('missing time metadata is not guessed; voice-only sessions remain editable',()=>{
 assert.equal(attachNarration(PROVIDER_TEST_DOCUMENT,source),PROVIDER_TEST_DOCUMENT);
 const voice=attachNarration({...PROVIDER_TEST_DOCUMENT,steps:[]},source);assert.equal(voice.steps.length,1);assert.equal(voice.steps[0].narration?.length,2);
});
