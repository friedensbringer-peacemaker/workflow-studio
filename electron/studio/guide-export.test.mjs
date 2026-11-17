import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import AdmZip from 'adm-zip';
import { exportGuidePackage } from './guide-export.ts';
import { storeMaterial } from './materials.ts';

test('offline guide exports only referenced assets, escapes HTML and hashes every package file', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'workflow-guide-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const session = path.join(root, 'session'); await mkdir(path.join(session, 'frames'), { recursive: true });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nm1sAAAAASUVORK5CYII=', 'base64');
  await writeFile(path.join(session, 'frames', 'fixture.png'), png);
  await writeFile(path.join(session, 'frames', 'unreferenced.png'), png);
  await writeFile(path.join(session, 'studio-settings.json'), 'DO NOT EXPORT CREDENTIAL FILES');
  await writeFile(path.join(session, 'video.webm'), 'DO NOT EXPORT RAW VIDEO');
  const material = await storeMaterial(session, 'reference.pdf', Buffer.from('Synthetic reference document'));
  await storeMaterial(session, 'unassigned.txt', Buffer.from('DO NOT EXPORT UNASSIGNED'));
  const document = { version: 1, sessionId: 'synthetic', title: '<script>alert(1)</script>', intent: 'Synthetic guide', updatedAt: 0, transcript: 'PRIVATE ORIGINAL TRANSCRIPT', steps: [
    { id: 'step-1', title: 'Open <example>', detail: '<img src=x onerror=alert(1)>', why: 'Synthetic reason', exceptions: '', app: 'Fixture', source: 'capture', frame: 'fixture.png', pointer: { x: .2, y: .4 }, supplement: 'A later explanation', materials: [material] },
  ] };
  const destination = path.join(root, 'guide.zip');
  await exportGuidePackage(session, destination, document, { materials: true, transcript: false });
  const zip = new AdmZip(destination); const names = zip.getEntries().map(entry => entry.entryName);
  assert.deepEqual(names.sort(), ['README.txt', 'checksums.sha256', 'frames/fixture.png', 'index.html', `materials/${material.file}`, 'process.json', 'process.md'].sort());
  const html = zip.readAsText('index.html');
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.match(html, /A later explanation/); assert.match(html, /frames\/fixture.png/);
  assert.doesNotMatch(html, /PRIVATE ORIGINAL TRANSCRIPT|DO NOT EXPORT/);
  assert.deepEqual(zip.readFile('frames/fixture.png'), png);
  for (const line of zip.readAsText('checksums.sha256').trim().split('\n')) {
    const [hash, name] = line.split('  ');
    assert.equal(createHash('sha256').update(zip.readFile(name)).digest('hex'), hash);
  }
  assert.equal(JSON.parse(zip.readAsText('process.json')).transcript, '');
  await exportGuidePackage(session, path.join(root, 'text-only.zip'), document, { materials: false, transcript: true });
  const reduced = new AdmZip(path.join(root, 'text-only.zip'));
  assert.ok(reduced.getEntries().every(e => !e.entryName.startsWith('materials/')));
  assert.match(reduced.readAsText('index.html'), /PRIVATE ORIGINAL TRANSCRIPT/);
  assert.doesNotMatch(reduced.readAsText('index.html'), /reference.pdf/);
  assert.equal(document.transcript, 'PRIVATE ORIGINAL TRANSCRIPT');
});

test('invalid frame references cannot overwrite an existing export or write into the session', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'workflow-guide-invalid-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const session = path.join(root, 'session'); await mkdir(session);
  const document = { version: 1, sessionId: 'synthetic', title: 'Fixture', intent: '', transcript: '', updatedAt: 0, steps: [{ id: 's1', title: 'Fixture', detail: '', why: '', exceptions: '', app: '', source: 'capture', frame: '../secret.png' }] };
  const destination = path.join(root, 'existing.zip'); await writeFile(destination, 'KEEP EXISTING FILE');
  await assert.rejects(exportGuidePackage(session, destination, document, { materials: true, transcript: false }), /Bildpfad/);
  assert.equal(await readFile(destination, 'utf8'), 'KEEP EXISTING FILE');
  await assert.rejects(exportGuidePackage(session, path.join(session, 'inside.zip'), document, { materials: true, transcript: false }), /außerhalb/);
});
