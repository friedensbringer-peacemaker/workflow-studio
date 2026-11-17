import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { processSession } from './pipeline';
import { SessionBundleSchema } from '../common/bundle';
import { documentFromBundle } from '../common/studio';

test('screenshots-only synthetic session becomes an editable illustrated step without video.json', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'skill-recorder-input-fixture-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, 'frames'));
  const events = [
    { type: 'input.click', payload: { clickId: 'fixture', x: 400, y: 300, normalizedX: .4, normalizedY: .6 } },
    { type: 'input.screenshot', payload: { clickId: 'fixture', file: 'click_fixture.jpg', width: 1000, height: 500 } },
  ].map((event, i) => ({ ...event, source: 'synthetic', seq: i + 1, t: (i + 1) * 100, epoch: 1000 + (i + 1) * 100 }));
  await writeFile(path.join(dir, 'session.json'), JSON.stringify({ id: 'synthetic-click-session', startedAt: 1000, stoppedAt: 2000, platform: 'win32', appVersion: 'test' }));
  await writeFile(path.join(dir, 'events.jsonl'), events.map(e => JSON.stringify(e)).join('\n') + '\n');
  // Synthetic image bytes are never decoded or sent to a provider by this pipeline.
  await writeFile(path.join(dir, 'frames', 'click_fixture.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  await processSession(dir);
  const bundle = SessionBundleSchema.parse(JSON.parse(await readFile(path.join(dir, 'bundle.json'), 'utf8')));
  const document = documentFromBundle(bundle);
  assert.equal(document.steps.length, 1);
  assert.equal(document.steps[0].frame, 'click_fixture.jpg');
  assert.deepEqual(document.steps[0].pointer, { x: .4, y: .6 });
  assert.equal(bundle.stats.frameCount, 1);
  assert.match(await readFile(path.join(dir, 'description.md'), 'utf8'), /Mouse primary click/);
});
