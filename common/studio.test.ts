import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySuggestion, documentMarkdown, StudioSettingsSchema, DEFAULT_STUDIO_SETTINGS, completeStudioSettings, PROVIDER_TEST_DOCUMENT, type StudioDocument } from './studio';

const document: StudioDocument = { version: 1, sessionId: 'fixture', title: 'Anfrage', intent: 'Prüfen', updatedAt: 123,
  transcript: '', steps: [{ id: 's1', title: 'Öffnen', detail: 'Anfrage öffnen', why: '', exceptions: '', app: 'Inbox', source: 'capture', frame: '001.jpg' }] };
test('AI suggestions cannot introduce image paths and retain the editor revision', () => {
  const next = applySuggestion(document, { title: 'Prüfung', intent: 'Anfrage prüfen', provider: 'fixture', steps: [
    { ...document.steps[0], frame: '../../secret.png' },
    { ...document.steps[0], id: 'new', frame: 'invented.png' },
  ] });
  assert.equal(next.steps[0].frame, '001.jpg'); assert.equal(next.steps[1].frame, undefined);
  assert.equal(next.updatedAt, 123); assert.equal(document.title, 'Anfrage');
});
test('markdown includes editable reasons and exceptions without touching source evidence', () => {
  const text = documentMarkdown({ ...document, steps: [{ ...document.steps[0], why: 'Dubletten vermeiden', exceptions: 'Unbekannter Kunde' }] });
  assert.match(text, /Dubletten vermeiden/); assert.match(text, /Unbekannter Kunde/);
  assert.doesNotMatch(text, /001.jpg/);
});
test('provider settings reject duplicate profiles and unknown selected providers', () => {
  assert.equal(StudioSettingsSchema.safeParse(DEFAULT_STUDIO_SETTINGS).success, true);
  assert.equal(StudioSettingsSchema.safeParse({ ...DEFAULT_STUDIO_SETTINGS, selected: 'missing' }).success, false);
  assert.equal(StudioSettingsSchema.safeParse({ selected: 'ollama', profiles: [DEFAULT_STUDIO_SETTINGS.profiles[0], DEFAULT_STUDIO_SETTINGS.profiles[0]] }).success, false);
});

test('new provider presets preserve existing user configuration and migration is idempotent', () => {
  const old = { selected: 'codex', profiles: DEFAULT_STUDIO_SETTINGS.profiles.filter(p => !['zai', 'lmstudio', 'vllm'].includes(p.id)).map(p =>
    p.id === 'compatible' ? { ...p, baseUrl: 'https://example.com/custom', model: 'my-model', hasKey: true } : { ...p }) };
  const next = completeStudioSettings(old);
  assert.equal(next.selected, 'codex'); assert.ok(next.profiles.some(p => p.id === 'zai'));
  assert.equal(next.profiles.find(p => p.id === 'vllm')?.baseUrl, 'http://localhost:8000/v1');
  assert.deepEqual(next.profiles.find(p => p.id === 'compatible'), old.profiles.find(p => p.id === 'compatible'));
  assert.deepEqual(completeStudioSettings(next), next);
  const full = { selected: 'p0', profiles: Array.from({ length: 20 }, (_, i) => ({ ...DEFAULT_STUDIO_SETTINGS.profiles[0], id: `p${i}` })) };
  assert.equal(completeStudioSettings(full).profiles.length, 20);
});

test('provider test document is fixed synthetic data without image references', () => {
  assert.ok(PROVIDER_TEST_DOCUMENT.sessionId.startsWith('synthetic-'));
  assert.match(PROVIDER_TEST_DOCUMENT.transcript, /Künstliche Testdaten/);
  assert.ok(PROVIDER_TEST_DOCUMENT.steps.every(step => !step.frame));
});
