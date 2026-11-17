// Deliberately exports source only: no installed runtime, profile, recordings or cache.
import { execFileSync } from 'node:child_process';
import { createWriteStream, lstatSync } from 'node:fs';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { ZipArchive } from 'archiver';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output=path.join(root,'.local','source',`studio-source-${Date.now()}-${randomUUID().slice(0,8)}.zip`);
await mkdir(path.dirname(output),{recursive:true});
const names=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,maxBuffer:16_000_000}).toString().split('\0').filter(Boolean);
const allowed=/^(?:(?:common|electron|src|scripts|evals|third_party|build|public|docs|\.github)\/|(?:[^/]+\.(?:json|md|html|ts|mjs|cjs|cmd|ps1|sh)|LICENSE|\.gitignore|\.npmrc)$)/;
const files=[];
for(const name of [...new Set(names)].sort()){
 if(!allowed.test(name)||name.split('/').some(p=>['node_modules','.local','.cache','results','recordings','artifacts'].includes(p)))continue;
 const full=path.join(root,name);if(lstatSync(full).isSymbolicLink())throw new Error(`Source symlink refused: ${name}`);
 const resolved=await realpath(full);if(path.relative(root,resolved).startsWith('..'))throw new Error('Source outside repository.');
 const bytes=await readFile(full);files.push({name,bytes,sha256:createHash('sha256').update(bytes).digest('hex')});
}
for(const required of ['package.json','package-lock.json','INSTALL.md','RELEASING.md','install.ps1','install.sh','scripts/compliance.mjs'])if(!files.some(f=>f.name===required))throw new Error(`Missing source: ${required}`);
await new Promise((resolve,reject)=>{const stream=createWriteStream(output,{flags:'wx'});const zip=new ZipArchive({zlib:{level:6}});stream.on('error',reject);zip.on('error',reject);stream.on('close',resolve);zip.pipe(stream);for(const f of files)zip.append(f.bytes,{name:f.name});void zip.finalize().catch(reject);});
const sha256=createHash('sha256').update(await readFile(output)).digest('hex');
const manifest={source:output,sha256,baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),includesLocalChanges:true,files:files.map(({bytes,...f})=>f)};
await writeFile(output+'.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify({source:output,sha256,files:files.length}));
