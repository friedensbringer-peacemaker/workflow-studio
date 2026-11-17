import { randomBytes, scrypt, timingSafeEqual, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { StudioDocument } from '../../common/studio';
const derive = promisify(scrypt);
type Credential = { version: 1; salt: string; hash: string };

/** Local application safeguard. Never store, return or log the password itself. */
export class DeletionProtection {
  private failures = 0;
  private blockedUntil = 0;
  constructor(private file: string) {}
  private async read(): Promise<Credential | null> {
    try {
      const value = JSON.parse(await readFile(this.file, 'utf8'));
      if (value.version !== 1 || !/^[a-f0-9]{64}$/.test(value.salt) || !/^[a-f0-9]{128}$/.test(value.hash)) throw new Error();
      return value;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new Error('Löschschutz ist nicht lesbar. Löschen bleibt gesperrt.');
    }
  }
  async status() { return { enabled: !!await this.read() }; }
  async verify(password: unknown = '') {
    const current = await this.read();
    if (!current) return;
    if (Date.now() < this.blockedUntil) throw new Error('Zu viele Fehlversuche. Bitte in einer Minute erneut versuchen.');
    if (typeof password !== 'string' || !password || password.length > 256) throw new Error('Löschkennwort erforderlich.');
    const result = await derive(password, Buffer.from(current.salt, 'hex'), 64) as Buffer;
    if (!timingSafeEqual(result, Buffer.from(current.hash, 'hex'))) {
      if (++this.failures >= 5) { this.blockedUntil = Date.now() + 60000; this.failures = 0; }
      throw new Error('Löschkennwort ist falsch.');
    }
    this.failures = 0;
  }
  async configure(current: unknown, next: unknown) {
    await this.verify(current);
    if (typeof next !== 'string' || (next.length && (next.length < 8 || next.length > 256))) throw new Error('Das neue Kennwort braucht 8 bis 256 Zeichen.');
    if (!next) { await unlink(this.file).catch(e => { if (e.code !== 'ENOENT') throw e; }); return { enabled: false }; }
    const salt = randomBytes(32);
    const hash = await derive(next, salt, 64) as Buffer;
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify({version:1,salt:salt.toString('hex'),hash:hash.toString('hex')}), {mode:0o600});
    await rename(temporary, this.file);
    return {enabled:true};
  }
}

function references(document: StudioDocument) {
  return new Set([
    ...document.steps.map(s => `step:${s.id}`),
    ...document.steps.flatMap(s => [...(s.materials ?? []), ...(s.image ? [s.image] : [])].map(m => `material:${s.id}:${m.id}`)),
    ...(document.interview ?? []).flatMap(q => (q.materials ?? []).map(m => `interview:${q.id}:${m.id}`)),
  ]);
}
export function removesContent(before: StudioDocument, after: StudioDocument) {
  const remaining = references(after);
  return [...references(before)].some(key => !remaining.has(key));
}

export function withoutMaterial(document: StudioDocument, id: string): StudioDocument {
  return {...document, steps:document.steps.map(s => ({...s, materials:s.materials?.filter(m=>m.id!==id),
    ...(s.image?.id===id ? {image:undefined,imagePointer:undefined} : {})})),
    interview:document.interview?.map(q=>({...q,materials:q.materials?.filter(m=>m.id!==id)}))};
}
