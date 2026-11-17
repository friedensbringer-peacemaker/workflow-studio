import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DeletionProtection, removesContent, withoutMaterial } from './deletion-protection';
import { storeMaterial, resolveMaterial, retireMaterial } from './materials';
import { PROVIDER_TEST_DOCUMENT } from '../../common/studio';

test('deletion password is hashed, persists, and protects change/removal; corruption fails closed',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'studio-delete-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const file=path.join(root,'protection.json'),guard=new DeletionProtection(file);
 assert.equal((await guard.status()).enabled,false);await guard.verify();
 await assert.rejects(guard.configure('','short'),/8 bis/);
 await guard.configure('','synthetic-pass-123');
 assert.equal((await guard.status()).enabled,true);
 assert.doesNotMatch(await readFile(file,'utf8'),/synthetic-pass/);
 const reopened=new DeletionProtection(file);
 await assert.rejects(reopened.verify(),/erforderlich/);
 await assert.rejects(reopened.verify('wrong'),/falsch/);
 await assert.rejects(reopened.configure('wrong',''),/falsch/);
 await reopened.verify('synthetic-pass-123');
 await reopened.configure('synthetic-pass-123','replacement-pass');
 await assert.rejects(reopened.verify('synthetic-pass-123'),/falsch/);
 await reopened.configure('replacement-pass','');assert.equal((await guard.status()).enabled,false);
 await writeFile(file,'broken');await assert.rejects(guard.status(),/gesperrt/);await assert.rejects(guard.verify(),/gesperrt/);
});
test('password attempts are throttled without disclosing the password',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'studio-delete-rate-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const guard=new DeletionProtection(path.join(root,'password.json'));await guard.configure('','synthetic-valid');
 for(let i=0;i<5;i++)await assert.rejects(guard.verify('incorrect'),/falsch/);
 await assert.rejects(guard.verify('synthetic-valid'),/Minute/);
});
test('material removal clears every use; file retirement rolls back on save failure',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'studio-delete-material-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const material=await storeMaterial(root,'example.txt',Buffer.from('Synthetic attachment'));
 const doc=structuredClone(PROVIDER_TEST_DOCUMENT);doc.steps[0].materials=[material];doc.steps[0].image=material;
 doc.interview=[{id:'q',question:'?',answer:'',reviewed:false,target:'intent',materials:[material]}];
 const after=withoutMaterial(doc,material.id);assert.equal(after.steps[0].materials?.length,0);assert.equal(after.steps[0].image,undefined);assert.equal(after.interview?.[0].materials?.length,0);
 assert.equal(removesContent(doc,after),true);assert.equal(removesContent(doc,{...doc,title:'changed'}),false);
 assert.equal(removesContent(doc,{...doc,steps:[]}),true);
 await assert.rejects(retireMaterial(root,material.id,async()=>{throw new Error('save failed');}),/save failed/);
 assert.equal((await resolveMaterial(root,material.id)).material.name,'example.txt');
 await retireMaterial(root,material.id,async()=>after);
 await assert.rejects(resolveMaterial(root,material.id));
 assert.ok((await readdir(path.join(root,'.deleted-materials'))).length>0);
 await assert.rejects(retireMaterial(root,'../../other',async()=>{}),/Material-ID/);
});
