import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { DEFAULT_STUDIO_SETTINGS } from '../../common/studio';
import { analysisPrompt, parseSuggestion, providerUrl, requestProvider, checkProvider, discoverLocalProviders } from './providers';

test('local discovery only requests fixed loopback model lists without prompts or credentials and tolerates absent servers', async t => {
  const seen: { url: string; init?: RequestInit }[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL, init?: RequestInit) => {
    const url = String(input); seen.push({ url, init });
    if (url.includes(':1234/')) throw new TypeError('server not running');
    return new Response(JSON.stringify(url.includes(':11434/') ? { models: [{ name: 'existing-ollama-model' }] } : { data: [{ id: 'served-vllm-model' }] }), { headers: { 'Content-Type': 'application/json' } });
  });
  const result = await discoverLocalProviders(AbortSignal.timeout(4000));
  assert.deepEqual(seen.map(s => s.url).sort(), ['http://localhost:11434/api/tags', 'http://localhost:1234/v1/models', 'http://localhost:8000/v1/models'].sort());
  assert.ok(seen.every(s => !s.init?.body && !s.init?.method && s.init?.redirect === 'error' && Object.keys(s.init?.headers ?? {}).length === 0));
  assert.deepEqual(result.find(r => r.profileId === 'ollama')?.models, ['existing-ollama-model']);
  assert.deepEqual(result.find(r => r.profileId === 'vllm')?.models, ['served-vllm-model']);
  assert.equal(result.find(r => r.profileId === 'lmstudio')?.reachable, false);
});

test('local discovery does not accept an authenticated, redirected or malformed service as a usable model list', async t => {
  t.mock.method(globalThis, 'fetch', async (input: string | URL) => {
    const url = String(input);
    if (url.includes(':11434/')) return new Response('PRIVATE BODY', { status: 401 });
    if (url.includes(':1234/')) throw new TypeError('redirect blocked');
    return new Response(JSON.stringify({ unexpected: 'PRIVATE BODY' }));
  });
  const result = await discoverLocalProviders(AbortSignal.timeout(4000));
  assert.ok(result.every(r => !r.reachable && r.models.length === 0));
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE BODY/);
});

test('provider endpoints retain base path and disallow credential URLs, remote HTTP and query strings', () => {
  const profile = DEFAULT_STUDIO_SETTINGS.profiles[1];
  assert.equal(providerUrl(profile, 'chat/completions').href, 'http://localhost:1234/v1/chat/completions');
  for (const baseUrl of ['http://example.com/v1', 'https://key@example.com/v1', 'file:///tmp/', 'https://example.com/v1?token=private']) {
    assert.throws(() => providerUrl({ ...profile, baseUrl }, 'models'));
  }
});
test('malformed model JSON is rejected and screenshots never enter new adapter prompts', () => {
  assert.throws(() => parseSuggestion('not json', 'fixture'));
  const text = analysisPrompt({ version: 1, sessionId: 'test', title: 'Test', intent: '', updatedAt: 0, transcript: '',
    steps: [{ id: 'a', title: 'A', detail: '', why: '', exceptions: '', app: '', source: 'capture', frame: 'private-screen.jpg' }] });
  assert.doesNotMatch(text, /private-screen.jpg/);
  assert.throws(() => parseSuggestion('{"title":"Empty","intent":"","steps":[]}', 'fixture'));
});

test('Z.ai preset uses its real base path and refuses a missing key before sending', async () => {
  const profile = DEFAULT_STUDIO_SETTINGS.profiles.find(p => p.id === 'zai')!;
  assert.equal(providerUrl(profile, 'chat/completions').href, 'https://api.z.ai/api/paas/v4/chat/completions');
  await assert.rejects(requestProvider({ ...profile, model: 'fixture' }, '', 'synthetic', AbortSignal.timeout(1000)), /API-Schlüssel/);
});

test('connection checks list local/Claude models and never expose failed response bodies', async () => {
  const seen: { url: string; headers: any }[] = [];
  const server = createServer((req, res) => {
    seen.push({ url: req.url!, headers: req.headers }); res.setHeader('Content-Type', 'application/json');
    if (req.url === '/denied/models') { res.writeHead(401); res.end('private-error-body'); return; }
    if (req.url === '/missing/models') { res.writeHead(404); res.end('private-error-body'); return; }
    res.end(JSON.stringify(req.url === '/api/tags' ? { models: [{ name: 'local-model' }] } : { data: [{ id: 'api-model' }] }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const root = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    for (const kind of ['ollama', 'compatible', 'claude'] as const) {
      const base = DEFAULT_STUDIO_SETTINGS.profiles.find(p => p.kind === kind)!;
      const result = await checkProvider({ ...base, baseUrl: root + (kind === 'ollama' ? '' : '/v1') }, 'fixture-key', AbortSignal.timeout(2000));
      assert.equal(result.models.length, 1);
    }
    assert.equal(seen[2].headers['x-api-key'], 'fixture-key');
    const profile = { ...DEFAULT_STUDIO_SETTINGS.profiles[1], baseUrl: root + '/denied' };
    await assert.rejects(checkProvider(profile, '', AbortSignal.timeout(2000)), error => /401/.test(String(error)) && !String(error).includes('private-error-body'));
    const unsupported = await checkProvider({ ...profile, baseUrl: root + '/missing' }, '', AbortSignal.timeout(2000));
    assert.match(unsupported.message, /Zugang noch nicht bestätigt/);
    await assert.rejects(checkProvider({ ...profile, baseUrl: root }, '', AbortSignal.abort()), /abgebrochen/);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('Ollama, compatible and Claude adapters send correct wire formats against a local fixture server', async () => {
  const seen: { url: string; body: any; headers: any }[] = [];
  const payload = JSON.stringify({ title: 'Test', intent: 'Test prüfen', steps: [{ id: 'a', title: 'Öffnen', detail: 'Geöffnet' }] });
  const server = createServer((req, res) => {
    let data = ''; req.on('data', c => data += c.toString()); req.on('end', () => {
      seen.push({ url: req.url!, body: JSON.parse(data), headers: req.headers });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(req.url === '/api/chat' ? { message: { content: payload } }
        : req.url === '/v1/messages' ? { content: [{ type: 'text', text: payload }] } : { choices: [{ message: { content: payload } }] }));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const root = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    for (const kind of ['ollama', 'compatible', 'claude'] as const) {
      const base = DEFAULT_STUDIO_SETTINGS.profiles.find(p => p.kind === kind)!;
      const result = await requestProvider({ ...base, model: 'fixture-model', baseUrl: root + (kind === 'ollama' ? '' : '/v1') }, 'fixture-key', 'synthetic context', AbortSignal.timeout(5000));
      assert.equal(result.steps[0].title, 'Öffnen');
    }
    assert.equal(seen[0].body.stream, false); assert.equal(seen[0].body.format, 'json');
    assert.equal(seen[1].url, '/v1/chat/completions'); assert.equal(seen[1].headers.authorization, 'Bearer fixture-key');
    assert.equal(seen[2].headers['anthropic-version'], '2023-06-01'); assert.equal(seen[2].headers['x-api-key'], 'fixture-key');
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
});
