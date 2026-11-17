import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UI_TRANSLATIONS, translateUi } from './ui-language';

test('translation matrix has both languages and matching interpolation fields', () => {
  assert.ok(Object.keys(UI_TRANSLATIONS).length > 200);
  const fields = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [key, row] of Object.entries(UI_TRANSLATIONS)) {
    assert.ok(row.de.trim(), `German text missing: ${key}`);
    assert.ok(row.en.trim(), `English text missing: ${key}`);
    assert.deepEqual(fields(row.de), fields(row.en), `Placeholder mismatch: ${key}`);
  }
});
test('translation preserves document/user text and interpolates values literally', () => {
  assert.equal(translateUi('Eigener fachlicher Prozess', 'en'), 'Eigener fachlicher Prozess');
  assert.equal(translateUi('Speichern', 'en'), 'Save');
  assert.equal(translateUi('Narrate', 'de'), 'Erklären');
  assert.equal(translateUi('Analyse mit {provider}', 'en', { provider: '$& Codex' }), 'Analysis with $& Codex');
});
