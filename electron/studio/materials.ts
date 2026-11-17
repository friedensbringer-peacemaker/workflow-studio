import { randomUUID } from 'node:crypto';
import { mkdir, realpath, readFile, writeFile, stat, unlink, rename } from 'node:fs/promises';
import path from 'node:path';
import { MaterialSchema, MAX_MATERIAL_BYTES, materialType, type StepMaterial } from '../../common/step-material';

async function root(dir: string): Promise<string> {
  const base = await realpath(dir);
  await mkdir(path.join(base, 'materials'), { recursive: true });
  const target = await realpath(path.join(base, 'materials'));
  const relative = path.relative(base, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Zusatzmaterial liegt außerhalb der Sitzung.');
  return target;
}

export async function storeMaterial(dir: string, name: string, bytes: Uint8Array, video=false): Promise<StepMaterial> {
  const { ext, kind, mime } = materialType(name,video);
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength || bytes.byteLength > MAX_MATERIAL_BYTES) throw new Error('Datei leer oder größer als 25 MB.');
  const folder = await root(dir); const id = randomUUID();
  const material = MaterialSchema.parse({ id, file: `${id}.${ext}`, name: name.split(/[\\/]/).at(-1)!.slice(0, 200), kind, mime, size: bytes.byteLength, createdAt: Date.now() });
  await writeFile(path.join(folder, material.file), bytes, { flag: 'wx' });
  try { await writeFile(path.join(folder, `${id}.json`), JSON.stringify(material), { flag: 'wx' }); }
  catch (error) { await unlink(path.join(folder, material.file)); throw error; }
  return material;
}

export async function resolveMaterial(dir: string, id: string): Promise<{ material: StepMaterial; target: string }> {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Ungültige Material-ID.');
  const folder = await root(dir);
  const metadata = await realpath(path.join(folder, `${id}.json`));
  if (path.dirname(metadata) !== folder) throw new Error('Ungültiger Materialpfad.');
  const material = MaterialSchema.parse(JSON.parse(await readFile(metadata, 'utf8')));
  if (material.id !== id || !material.file.startsWith(`${id}.`)) throw new Error('Material-ID stimmt nicht überein.');
  const expected = materialType(material.file,material.kind==='video');
  if (expected.kind !== material.kind || expected.mime !== material.mime) throw new Error('Materialformat stimmt nicht überein.');
  const target = await realpath(path.join(folder, material.file));
  if (path.dirname(target) !== folder) throw new Error('Ungültiger Materialpfad.');
  const info = await stat(target);
  if (!info.isFile() || info.size !== material.size || info.size > MAX_MATERIAL_BYTES) throw new Error('Zusatzmaterial ist beschädigt oder wurde verändert.');
  return { material, target };
}

/** Remove from the live material store; retain an isolated local recovery copy.
 * Roll back both files if committing the edited document fails. */
export async function retireMaterial<T>(dir:string,id:string,commit:()=>Promise<T>):Promise<T> {
  const {material,target}=await resolveMaterial(dir,id);
  const base=await realpath(dir), archive=path.join(base,'.deleted-materials');
  await mkdir(archive,{recursive:true});
  if(await realpath(archive)!==archive)throw new Error('Ungültiger Wiederherstellungspfad.');
  const destination=path.join(archive,randomUUID());await mkdir(destination);
  const metadata=path.join(path.dirname(target),`${material.id}.json`);
  const moved=path.join(destination,material.file), movedMeta=path.join(destination,`${material.id}.json`);
  await rename(target,moved);
  try {await rename(metadata,movedMeta);} catch(e){await rename(moved,target);throw e;}
  try {return await commit();} catch(e){await rename(moved,target);await rename(movedMeta,metadata);throw e;}
}
