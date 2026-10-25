// Run: npm test (from the project root)
const test = require('node:test');
const assert = require('node:assert');
const { createGroqClient } = require('./groqClient');

const GOOD = { choices: [{ message: { content: '[{"title":"t"}]' } }] };
const reply = (status, body) => async () => ({ ok: status < 300, status, json: async () => body });
const MODEL = 'vendor/test-model';

test('it needs a key and a model from .env (no default), and sends the key only in a header', async () => {
  assert.throws(() => createGroqClient({ model: MODEL }), /GROQ_API_KEY/);
  assert.throws(() => createGroqClient({ apiKey: 'k' }), /GROQ_MODEL/);
  let seen;
  const client = createGroqClient({ apiKey: 'secret-key', model: MODEL, fetchImpl: async (url, init) => { seen = { url, init }; return { ok: true, status: 200, json: async () => GOOD }; } });
  assert.strictEqual(await client.complete('hello'), '[{"title":"t"}]');
  assert.match(seen.url, /^https:\/\/api\.groq\.com\//);
  assert.ok(!seen.url.includes('secret-key'));
  assert.strictEqual(seen.init.headers.Authorization, 'Bearer secret-key');
  const sent = JSON.parse(seen.init.body);
  assert.strictEqual(sent.model, MODEL);
  assert.strictEqual(sent.messages[0].content, 'hello');
  assert.ok(sent.max_tokens <= 2048);
});

test('failures become provider errors that never contain the key', async () => {
  const fail = (impl) => createGroqClient({ apiKey: 'secret-key', model: MODEL, retryDelayMs: 1, fetchImpl: impl }).complete('x').then(() => assert.fail('should throw'), (e) => e);
  const errors = [await fail(reply(401, { error: { message: 'bad key' } })), await fail(reply(200, { choices: [] })), await fail(async () => { throw new Error('boom secret-key'); })];
  assert.deepStrictEqual(errors.map((e) => e.code), ['http_401', 'empty', 'network']);
  errors.forEach((e) => assert.ok(!e.message.includes('secret-key')));
});

test('a 429 (rate limit) or 503 is tried once more; other errors are not', async () => {
  for (const status of [429, 503]) {
    let calls = 0;
    const c = createGroqClient({ apiKey: 'k', model: MODEL, retryDelayMs: 1, fetchImpl: async () => { calls += 1; return calls === 1 ? { ok: false, status, json: async () => ({}) } : { ok: true, status: 200, json: async () => GOOD }; } });
    assert.strictEqual(await c.complete('x'), '[{"title":"t"}]');
    assert.strictEqual(calls, 2);
  }
  let again = 0;
  const down = createGroqClient({ apiKey: 'k', model: MODEL, retryDelayMs: 1, fetchImpl: async () => { again += 1; return { ok: false, status: 500, json: async () => ({}) }; } });
  await assert.rejects(down.complete('x'), (e) => e.code === 'http_500');
  assert.strictEqual(again, 1);
});
