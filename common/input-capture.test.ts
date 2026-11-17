import test from 'node:test';
import assert from 'node:assert/strict';
import { InputCaptureSettingsSchema, SAMPLED_KEYS, safeControlChords } from './input-capture';
import { buildBundle } from './bundle';
import { documentFromBundle, applySuggestion } from './studio';
import type { RecEvent } from './types';
import { CaptureRegionSchema, pointInRegion } from './capture-region';

test('crop bounds reject out-of-screen areas and remap pointer positions without capturing outside clicks', () => {
  const crop = CaptureRegionSchema.parse({ x: .25, y: .25, width: .5, height: .5 });
  assert.deepEqual(pointInRegion(.5, .5, crop), { x: .5, y: .5 });
  assert.equal(pointInRegion(.1, .5, crop), null);
  assert.equal(CaptureRegionSchema.safeParse({ x: .9, y: 0, width: .5, height: 1 }).success, false);
  assert.equal(CaptureRegionSchema.safeParse({ x: 0, y: 0, width: 0, height: 1 }).success, false);
});

test('input settings default to no keyboard or clipboard and bound screenshot delay', () => {
  const settings = InputCaptureSettingsSchema.parse({});
  assert.equal(settings.shortcuts, false); assert.equal(settings.clipboard, false);
  assert.equal(InputCaptureSettingsSchema.safeParse({ delayMs: -1 }).success, false);
  assert.equal(InputCaptureSettingsSchema.safeParse({ delayMs: 2001 }).success, false);
  assert.equal(InputCaptureSettingsSchema.safeParse({ mode: 'keylogger' }).success, false);
});

test('keyboard allowlist excludes ordinary text and emits only new control presses', () => {
  for (const code of [...Array.from({length: 36}, (_, i) => i + 48), ...Array.from({length: 33}, (_, i) => i + 186)]) {
    assert.ok(!SAMPLED_KEYS.includes(code));
  }
  assert.deepEqual(safeControlChords([17, 9, 65], [], 'unknown'), [['Ctrl', 'Tab']]);
  assert.deepEqual(safeControlChords([17, 9], [9], 'unknown'), []);
  assert.deepEqual(safeControlChords([13], [], true), []);
  assert.deepEqual(safeControlChords([17, 18, 13], [], false), []);
  assert.deepEqual(safeControlChords([65, 49], [], false), []);
});

const event = (seq: number, type: string, payload: Record<string, unknown>): RecEvent =>
  ({ seq, type, payload, source: 'synthetic', t: seq * 100, epoch: 1000 + seq * 100 });
test('delayed click images stay with their click even after the next step; mouse motion creates no steps', () => {
  const bundle = buildBundle({ meta: { id: 'synthetic-clicks', startedAt: 1000, stoppedAt: 2000, platform: 'win32', appVersion: 'test' }, events: [
    event(1, 'input.pointer', { x: 1, y: 2 }),
    event(2, 'input.click', { clickId: 'a', x: 200, y: 100, normalizedX: .25, normalizedY: .5 }),
    event(3, 'input.click', { clickId: 'b', x: 300, y: 200, normalizedX: .5, normalizedY: .75 }),
    event(4, 'input.screenshot', { clickId: 'a', file: 'click_a.jpg' }),
    event(5, 'input.screenshot', { clickId: 'b', file: '../../secret.jpg' }),
  ] });
  assert.equal(bundle.steps.length, 2); assert.equal(bundle.stats.frameCount, 1);
  assert.deepEqual(bundle.steps[0].frames, ['click_a.jpg']);
  assert.deepEqual(bundle.steps[1].frames, []);
  const document = documentFromBundle(bundle);
  assert.deepEqual(document.steps[0].pointer, { x: .25, y: .5 });
  const suggestion = applySuggestion(document, { title: 'Synthetic', intent: '', provider: 'test', steps: [
    { ...document.steps[0], pointer: { x: 0, y: 0 } },
    { ...document.steps[0], id: 'invented', pointer: { x: 1, y: 1 } },
  ] });
  assert.deepEqual(suggestion.steps[0].pointer, { x: .25, y: .5 });
  assert.equal(suggestion.steps[1].pointer, undefined);
});
