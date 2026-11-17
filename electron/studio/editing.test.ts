import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { renderImageEdit } from './images';
import { mergeSteps, splitStep, normalizeEvidence } from '../../common/step-organization';
import type { StudioDocument } from '../../common/studio';
test('black redaction is baked into pixels before cropping and original bytes remain unchanged',async()=>{
 const source=await sharp({create:{width:100,height:100,channels:3,background:'#fff'}}).png().toBuffer();
 const result=await renderImageEdit(source,{crop:{x:.2,y:.2,width:.6,height:.6},marks:[{kind:'mask',x:.3,y:.3,x2:.6,y2:.6}]});
 const pixels=await sharp(result).removeAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(pixels.info.width,60);assert.equal(pixels.info.height,60);
 assert.deepEqual([...pixels.data.subarray((20*60+20)*3,(20*60+20)*3+3)],[0,0,0]);
 const original=await sharp(source).removeAlpha().raw().toBuffer();assert.equal(original[(50*100+50)*3],255);
});
test('merge and split retain source evidence and untrusted frame paths cannot be introduced',()=>{
 const document:StudioDocument={version:1,sessionId:'synthetic',title:'Fixture',intent:'',transcript:'',updatedAt:0,steps:[
 {id:'a',title:'One',detail:'First paragraph',why:'Reason',exceptions:'',app:'',source:'capture',frame:'a.jpg'},
 {id:'b',title:'Two',detail:'Second paragraph',why:'',exceptions:'Exception',app:'',source:'capture',frame:'b.jpg'}]};
 const merged=mergeSteps(document,0);assert.equal(merged.steps.length,1);assert.equal(merged.steps[0].evidence?.length,2);
 const saved=normalizeEvidence(merged,document);const split=splitStep(saved,0,'new',15);
 const alternate=structuredClone(saved);alternate.steps[0].frame='b.jpg';
 const savedAlternate=normalizeEvidence(alternate,saved);savedAlternate.steps[0].frame='a.jpg';
 assert.equal(normalizeEvidence(savedAlternate,alternate).steps[0].frame,'a.jpg');
 assert.equal(normalizeEvidence(split,saved).steps[1].frame,'a.jpg');
 split.steps[1].frame='../../secret.png';assert.equal(normalizeEvidence(split,saved).steps[1].frame,'a.jpg');
 split.steps[1].evidence=[{id:'invented',frame:'secret.jpg'}];assert.throws(()=>normalizeEvidence(split,saved),/Unbekannte/);
 assert.equal(document.steps.length,2);
});
