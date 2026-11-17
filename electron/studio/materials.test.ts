import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { storeMaterial, resolveMaterial } from './materials';
import { MAX_MATERIAL_BYTES, materialType, MaterialSchema } from '../../common/step-material';
import { applySuggestion, documentMarkdown, StudioDocumentSchema, type StudioDocument } from '../../common/studio';
import { analysisPrompt } from './providers';

test('local attachment storage preserves copied bytes and rejects traversal, tampering and unknown files', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'studio-material-fixture-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const data = Buffer.from('Synthetic supplemental document.');
  const material = await storeMaterial(dir, 'C:\\example\\instructions.txt', data);
  assert.equal(material.name, 'instructions.txt'); assert.equal(material.kind, 'document');
  const resolved = await resolveMaterial(dir, material.id);
  assert.deepEqual(await readFile(resolved.target), data);
  await assert.rejects(resolveMaterial(dir, '../../secret'), /Material-ID/);
  await assert.rejects(storeMaterial(dir, 'run.exe', data), /Dateiformat/);
  await assert.rejects(storeMaterial(dir, 'empty.txt', Buffer.alloc(0)), /leer/);
  assert.equal(MaterialSchema.safeParse({ ...material, file: '../../secret.txt' }).success, false);
  assert.equal(MaterialSchema.safeParse({ ...material, size: MAX_MATERIAL_BYTES + 1 }).success, false);
  await writeFile(resolved.target, 'changed');
  await assert.rejects(resolveMaterial(dir, material.id), /verändert/);
});

test('material metadata cannot change the file type or escape its session', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'studio-material-metadata-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const material = await storeMaterial(dir, 'note.txt', Buffer.from('Synthetic'));
  await writeFile(path.join(dir, 'materials', `${material.id}.json`), JSON.stringify({ ...material, kind: 'image', mime: 'image/png' }));
  await assert.rejects(resolveMaterial(dir, material.id), /Materialformat/);
  assert.equal(materialType('SCREENSHOT.PNG').kind, 'image');
  assert.equal(materialType('voice.webm').kind, 'audio');
});

test('supplements survive AI replacement, never introduce attachments and omit files from prompts', () => {
  const material = MaterialSchema.parse({ id: '418a6693-2e51-4b24-8cd4-2bbc810f6ccb', file: '418a6693-2e51-4b24-8cd4-2bbc810f6ccb.pdf', name: 'private-reference.pdf', kind: 'document', mime: 'application/pdf', size: 12, createdAt: 1 });
  const document: StudioDocument = { version: 1, sessionId: 'synthetic', title: 'Fixture', intent: '', transcript: '', updatedAt: 0,
    steps: [{ id: 's1', title: 'Step', detail: '', why: '', exceptions: '', app: '', source: 'manual', supplement: 'Forgotten explanation', materials: [material] }] };
  const changed = applySuggestion(document, { title: 'AI', intent: '', provider: 'fixture', steps: [{ ...document.steps[0], supplement: 'invented', materials: [] }] });
  assert.equal(changed.steps[0].supplement, 'Forgotten explanation');
  assert.deepEqual(changed.steps[0].materials, [material]);
  const omitted = applySuggestion(document, { title: 'AI', intent: '', provider: 'fixture', steps: [{ ...document.steps[0], id: 'new', materials: [material] }] });
  assert.equal(omitted.steps[0].materials, undefined);
  assert.equal(omitted.steps[1].id, 's1');
  assert.match(analysisPrompt(document), /Forgotten explanation/);
  assert.doesNotMatch(analysisPrompt(document), /private-reference|418a6693|\.pdf/);
  assert.match(documentMarkdown(document), /Forgotten explanation/);
  assert.match(documentMarkdown(document), /private-reference.pdf/);
  const old = { ...document, steps: document.steps.map(({ materials, supplement, ...step }) => step) };
  assert.equal(StudioDocumentSchema.safeParse(old).success, true);
});
