import { createWriteStream } from 'node:fs';
import { readFile, realpath, rename, rm, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { ZipArchive } from 'archiver';
import { StudioDocumentSchema, documentMarkdown, type StudioDocument } from '../../common/studio';
import { GuideExportOptionsSchema, guideHtml, type GuideExportOptions } from '../../common/guide-export';
import { resolveMaterial } from './materials';

import { DEFAULT_BRANDING, type Branding } from '../../common/branding';

const MAX_PACKAGE_BYTES = 250 * 1024 * 1024;
export async function exportGuidePackage(dir: string, destination: string, input: StudioDocument, options: GuideExportOptions, branding: Branding = DEFAULT_BRANDING): Promise<void> {
  const document = structuredClone(StudioDocumentSchema.parse(input)); const selected = GuideExportOptionsSchema.parse(options);
  const root = await realpath(dir); const outputFolder = await realpath(path.dirname(destination));
  const output = path.join(outputFolder, path.basename(destination));
  const relative = path.relative(root, output);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) throw new Error('Export außerhalb des Sitzungsordners speichern.');
  if (path.extname(output).toLowerCase() !== '.zip') throw new Error('Als ZIP-Datei speichern.');
  const assets = new Map<string, Buffer>(); let total = 0;
  const add = (name: string, bytes: Buffer) => {
    if (assets.has(name)) return;
    total += bytes.length; if (total > MAX_PACKAGE_BYTES) throw new Error('Anleitung ist größer als 250 MB. Zusatzdateien abwählen oder Umfang reduzieren.');
    assets.set(name, bytes);
  };
  if (!selected.transcript) document.transcript = '';
  for (const step of document.steps) {
    if (step.image) {
      const { material, target } = await resolveMaterial(root, step.image.id);
      if (material.kind !== 'image') throw new Error('Ungültiges Schrittbild.');
      const name = `edited_${material.file}`;
      add(`frames/${name}`, await readFile(target));
      step.frame = name; step.pointer = step.imagePointer; step.image = undefined; step.imagePointer = undefined;
      step.evidence = undefined;
    } else if (step.frame) {
      if (step.frame !== path.basename(step.frame) || !/^[a-z0-9_.-]+\.(jpe?g|png|webp)$/i.test(step.frame)) throw new Error('Ungültiger Bildpfad.');
      const frames = await realpath(path.join(root, 'frames'));
      if (!path.relative(root, frames) || path.relative(root, frames).startsWith('..') || path.isAbsolute(path.relative(root, frames))) throw new Error('Ungültiger Bildpfad.');
      const target = await realpath(path.join(frames, step.frame));
      if (path.dirname(target) !== frames || (await stat(target)).size > 5_000_000) throw new Error('Bild fehlt oder ist zu groß.');
      add(`frames/${step.frame}`, await readFile(target));
    }
    if (!selected.materials) { step.materials = []; continue; }
    if (step.materials) {
      const materials = [];
      for (const item of step.materials) {
        const { material, target } = await resolveMaterial(root, item.id);
        if (!assets.has(`materials/${material.file}`)) add(`materials/${material.file}`, await readFile(target));
        materials.push(material);
      }
      step.materials = materials;
    }
  }
  document.interview = undefined; // Draft answers and unreviewed interview attachments are local working data.
  add('index.html', Buffer.from(guideHtml(document, branding), 'utf8'));
  add('process.json', Buffer.from(JSON.stringify(document, null, 2), 'utf8'));
  add('process.md', Buffer.from(documentMarkdown(document), 'utf8'));
  add('README.txt', Buffer.from('ZIP vollständig entpacken und index.html öffnen. Keine Installation und kein Internet erforderlich.\nframes/ enthält nur zugeordnete Bildschirmbilder. materials/ enthält die ausgewählten zugeordneten Zusatzdateien.\nprocess.json enthält den exportierten Bearbeitungsstand, process.md die Textfassung.\nKeine Videos, Rohereignisse, Anmeldedaten oder unzugeordneten Dateien werden automatisch übernommen.\nDie Inhalte werden beim Export nicht automatisch geschwärzt. Vor Weitergabe prüfen.\nchecksums.sha256 enthält die SHA-256-Prüfsummen der Paketdateien.\n', 'utf8'));
  const hashes = [...assets].map(([name, bytes]) => `${createHash('sha256').update(bytes).digest('hex')}  ${name}`).join('\n') + '\n';
  add('checksums.sha256', Buffer.from(hashes, 'utf8'));
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    await new Promise<void>((resolve, reject) => {
      const stream = createWriteStream(temporary, { flags: 'wx' });
      const archive = new ZipArchive({ zlib: { level: 6 } });
      let failure: Error | null = null;
      const fail = (error: Error) => { if (failure) return; failure = error; archive.abort(); stream.destroy(); };
      stream.on('error', fail); archive.on('error', fail); archive.on('warning', fail);
      stream.on('close', () => { if (failure) reject(failure); else if (stream.writableFinished) resolve(); else reject(new Error('ZIP-Datei konnte nicht vollständig geschrieben werden.')); });
      archive.pipe(stream);
      for (const [name, bytes] of assets) archive.append(bytes, { name });
      void archive.finalize().catch(fail);
    });
    await rename(temporary, output);
  } catch (error) { await rm(temporary, { force: true }); throw error; }
}
