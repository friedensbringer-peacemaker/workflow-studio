import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { BrandingSchema, DEFAULT_BRANDING, foreground } from '../../common/branding';
import { readBranding, writeBranding, normalizeLogo, renderBrandIcon } from './branding';
import { processSvg, processDrawio, processMermaid } from '../../common/process-diagram';
import { ReviewMethodSchema, parseReview, reviewSnapshot, reviewInstruction } from '../../common/process-review';
import { PROVIDER_TEST_DOCUMENT, StudioDocumentSchema } from '../../common/studio';
import { guideHtml } from '../../common/guide-export';

test('branding persists independently, copies a bounded logo, and rejects active content',async t=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'workflow-brand-'));t.after(()=>rm(folder,{recursive:true,force:true}));
  assert.deepEqual(await readBranding(folder),DEFAULT_BRANDING);
  const input=await sharp({create:{width:1200,height:600,channels:4,background:'#336699'}}).png().toBuffer();
  const logo=await normalizeLogo(input);
  const saved=await writeBranding(folder,{companyName:'Beispiel & Partner',primary:'#004499',secondary:'#223344',logo});
  assert.deepEqual(await readBranding(folder),saved);
  const meta=await sharp(Buffer.from(saved.logo.split(',')[1],'base64')).metadata(); assert.equal(meta.width,640); assert.equal(meta.height,320);
  assert.equal(foreground('#004499'),'#FFFFFF');assert.equal(foreground('#FFDD04'),'#000000');
  await assert.rejects(normalizeLogo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')));
  await assert.rejects(normalizeLogo(new Uint8Array(2_000_001)));
  await assert.rejects(writeBranding(folder,{...saved,primary:'red; background:url(https://example.com)'}));
  assert.deepEqual(await readBranding(folder),saved);
  assert.throws(()=>BrandingSchema.parse({...saved,logo:'https://example.com/logo.png'}));
  await writeBranding(folder,{...DEFAULT_BRANDING,companyName:''}); assert.equal((await readBranding(folder)).logo,'');
  assert.doesNotMatch(await readFile(path.join(folder,'branding.json'),'utf8'),/Beispiel/);
});
test('runtime icons follow the accent, retain legible contrast, and preserve a custom logo', async () => {
  const glyph = await readFile(path.resolve('electron/assets/icons/record.svg'), 'utf8');
  const pixels = async (brand: typeof DEFAULT_BRANDING) => {
    const { data, info } = await sharp(await renderBrandIcon(brand, glyph)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 256); assert.equal(info.height, 256);
    return (x: number, y: number) => [...data.subarray((y * 256 + x) * 4, (y * 256 + x) * 4 + 4)];
  };
  const light = await pixels({ ...DEFAULT_BRANDING, primary: '#D8F4B5' });
  assert.deepEqual(light(128, 16), [216, 244, 181, 255]);
  assert.deepEqual(light(128, 32), [0, 0, 0, 255]);
  assert.equal(light(0, 0)[3], 0);
  const dark = await pixels({ ...DEFAULT_BRANDING, primary: '#004499' });
  assert.deepEqual(dark(128, 16), [0, 68, 153, 255]);
  assert.deepEqual(dark(128, 32), [255, 255, 255, 255]);
  const logo = await normalizeLogo(await sharp({ create: { width: 80, height: 40, channels: 4, background: '#CC3344' } }).png().toBuffer());
  const custom = await pixels({ ...DEFAULT_BRANDING, primary: '#004499', logo });
  assert.deepEqual(custom(128, 16), [0, 68, 153, 255]);
  assert.deepEqual(custom(128, 128), [204, 51, 68, 255]);
  assert.deepEqual(custom(128, 40), [0, 68, 153, 255]);
});
test('all diagrams preserve sequence and exceptions as notes and escape embedded markup',()=>{
  const doc=structuredClone(PROVIDER_TEST_DOCUMENT);doc.title='<script>Title</script>';doc.steps[0].detail='A < B & "text"';doc.steps[0].exceptions='If unknown, ask; do not guess';
  const svg=processSvg(doc);assert.match(svg,/&lt;script&gt;/);assert.doesNotMatch(svg,/<script>/);assert.match(svg,/If unknown/);
  const drawio=processDrawio(doc);assert.match(drawio,/<mxfile/);assert.match(drawio,/source="s0" target="n0"/);assert.doesNotMatch(drawio,/rhombus|<script>/);
  assert.match(processMermaid(doc),/s0 -.- n0/);assert.match(processMermaid(doc),/start --> s0/);
  assert.match(processSvg({...doc,steps:[]}),/Ende/);
  const html=guideHtml(doc,{...DEFAULT_BRANDING,companyName:'ACME <x>',primary:'#123456',secondary:'#654321'});
  assert.match(html,/ACME &lt;x&gt;/);assert.match(html,/#123456/);assert.equal(DEFAULT_BRANDING.companyName,'');
});
test('method scripts and model results are bounded; reviews do not alter the process',()=>{
  const method=ReviewMethodSchema.parse({id:'lean',script:'Check transitions'});
  assert.match(reviewInstruction(method),/keine Fakten/);assert.throws(()=>ReviewMethodSchema.parse({id:'custom',script:''}));
  assert.throws(()=>parseReview('{}'));assert.throws(()=>parseReview('x'.repeat(65001)));
  const report={clarity:'Clear',optimization:'Review',automation:'Assist',infrastructure:'Internal',methodology:'Lean',questions:['Who approves?']};
  assert.deepEqual(parseReview('```json\n'+JSON.stringify(report)+'\n```'),report);
  const marker=reviewSnapshot(PROVIDER_TEST_DOCUMENT);assert.doesNotMatch(marker,/Anfrage|Angaben/);
  const doc=StudioDocumentSchema.parse({...PROVIDER_TEST_DOCUMENT,processReview:{report,method,provider:'Fixture',createdAt:0,snapshot:marker}});
  assert.equal(reviewSnapshot(doc),marker);assert.notEqual(reviewSnapshot({...doc,intent:'Changed'}),marker);assert.deepEqual(doc.steps,PROVIDER_TEST_DOCUMENT.steps);
});
