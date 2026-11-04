// Run: npm test (from the project root)
const test = require('node:test');
const assert = require('node:assert');
const { createGeminiClient } = require('./geminiClient');
const { LlmProvider } = require('./providers');
const standard = require('./standard-v4.json');

const reply = (status, body) => async () => ({ ok: status < 300, status, json: async () => body });
const GOOD = { candidates: [{ content: { parts: [{ text: '[]' }] } }] };

test('it needs a key, sends the prompt with the key in a header (never the URL), and returns the text', async () => {
  assert.throws(() => createGeminiClient({}), /GEMINI_API_KEY/);
  let seen;
  const client = createGeminiClient({ apiKey: 'secret-key', model: 'm1', fetchImpl: async (url, init) => { seen = { url, init }; return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '[{"title":"t"}]' }] } }] }) }; } });
  assert.strictEqual(await client.complete('hello'), '[{"title":"t"}]');
  assert.ok(seen.url.endsWith('/m1:generateContent') && !seen.url.includes('secret-key'));
  assert.strictEqual(seen.init.headers['x-goog-api-key'], 'secret-key');
  assert.strictEqual(JSON.parse(seen.init.body).contents[0].parts[0].text, 'hello');
});

test('failures become provider errors that never contain the key', async () => {
  const fail = (impl) => createGeminiClient({ apiKey: 'secret-key', fetchImpl: impl }).complete('x').then(() => assert.fail('should throw'), (e) => e);
  const http = await fail(reply(429, { error: { message: 'quota' } }));
  assert.strictEqual(http.code, 'http_429');
  const empty = await fail(reply(200, { candidates: [] }));
  assert.strictEqual(empty.code, 'empty');
  const net = await fail(async () => { throw new Error('connect ECONNREFUSED with secret-key'); });
  assert.strictEqual(net.code, 'network');
  [http, empty, net].forEach((e) => assert.ok(!e.message.includes('secret-key')));
});

test('as the LLM provider\'s client it returns recommendations that cite findings', async () => {
  const items = [{ title: 'Fix the vision', text: 'Use the LCUP vision.', basedOn: ['T-28:outcomes.vision'] }];
  const client = createGeminiClient({ apiKey: 'k', fetchImpl: reply(200, { candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify(items) + '\n```' }] } }] }) });
  const out = await new LlmProvider({ client, model: client.model }).recommend([{ id: 'T-28:outcomes.vision', ruleId: 'T-28' }], {}, standard);
  assert.deepStrictEqual(out, items);
});

test('a 503 "high demand" is tried once more; other errors are not', async () => {
  let calls = 0;
  const flaky = createGeminiClient({ apiKey: 'k', retryDelayMs: 1, fetchImpl: async () => { calls += 1; return calls === 1 ? { ok: false, status: 503, json: async () => ({}) } : { ok: true, status: 200, json: async () => GOOD }; } });
  assert.strictEqual(await flaky.complete('x'), '[]');
  assert.strictEqual(calls, 2);
  let again = 0;
  const down = createGeminiClient({ apiKey: 'k', retryDelayMs: 1, fetchImpl: async () => { again += 1; return { ok: false, status: 503, json: async () => ({}) }; } });
  await assert.rejects(down.complete('x'), (e) => e.code === 'http_503');
  assert.strictEqual(again, 2, 'one retry, no more');
  let bad = 0;
  const denied = createGeminiClient({ apiKey: 'k', retryDelayMs: 1, fetchImpl: async () => { bad += 1; return { ok: false, status: 403, json: async () => ({}) }; } });
  await assert.rejects(denied.complete('x'), (e) => e.code === 'http_403');
  assert.strictEqual(bad, 1);
});
