const test = require('node:test');
const assert = require('node:assert/strict');
// A refusal for credits or access starts a cooldown in the checker (gemini.js); each test here starts with a provider that is not blocked.
test.afterEach(() => require('./gemini').resetProviderBlock());
const { sample } = require('./fixtures');
const { align, pairsOf, NEMOTRON_FREE } = require('./gemini');

// A check that did not complete says WHY, apart from any academic verdict: a provider outage is not a finding about the syllabus.
const env = { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-only-router-key', OPENROUTER_MODEL: NEMOTRON_FREE };

test('no AI configured is reported as not_configured, with no verdicts invented', async () => {
  const { content, masters } = sample();
  const result = await align(content, masters, { env: { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter' } });
  assert.equal(result.status, 'not_evaluated');
  assert.equal(result.failure.kind, 'not_configured');
  assert.deepEqual(result.judgements, []);
});

for (const [status, kind, retryable] of [[429, 'provider_quota', true], [402, 'provider_access', false], [503, 'provider_error', true], [404, 'provider_rejected', false]]) {
  test(`HTTP ${status} is a ${kind} failure, not a verdict on the syllabus`, async () => {
    const { content, masters } = sample();
    const result = await align(content, masters, { env, transport: async () => ({ ok: false, status, json: async () => ({ error: { message: 'x' } }) }) });
    assert.equal(result.status, 'not_evaluated');
    assert.deepEqual([result.failure.kind, result.failure.httpStatus, result.failure.retryable], [kind, status, retryable]);
    assert.ok(result.judgements.every(j => j.label !== 'NOT_ALIGNED' && j.label !== 'PARTIALLY_ALIGNED'), 'no academic verdict comes from a provider failure');
  });
}

test('a timeout is a provider_timeout failure', async () => {
  const { content, masters } = sample();
  const result = await align(content, masters, { env, transport: async () => { throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }); } });
  assert.equal(result.failure.kind, 'provider_timeout');
});

test('answers that never verify are reported as invalid_output, with how many relationships were affected', async () => {
  const { content, masters } = sample();
  const result = await align(content, masters, { env, transport: async () => ({ ok: true, json: async () => ({ model: NEMOTRON_FREE, choices: [{ finish_reason: 'stop', message: { content: 'not json' } }] }) }) });
  assert.equal(result.status, 'not_evaluated');
  assert.equal(result.failure.kind, 'invalid_output');
  assert.ok(result.failure.count > 0);
  assert.ok(result.judgements.filter(j => j.unverified).every(j => j.failureKind === 'invalid_output' && j.label === 'INSUFFICIENT_EVIDENCE'));
});

test('text the AI genuinely cannot judge is insufficient_text, which a retry will not change', async () => {
  const { content, masters } = sample();
  const reply = pair => ({ id: pair.id, label: 'INSUFFICIENT_EVIDENCE', explanation: 'The text is empty.', sourceQuote: '', targetQuote: '', sourceBloom: 'N/A', targetBloom: 'N/A', draft: '' });
  const transport = async (url, request) => {
    const pairs = JSON.parse(JSON.parse(request.body).messages[1].content).document_data;
    return { ok: true, json: async () => ({ model: NEMOTRON_FREE, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: pairs.map(reply) }) } }] }) };
  };
  const result = await align(content, masters, { env, transport });
  assert.equal(result.failure.kind, 'insufficient_text');
  assert.equal(result.failure.retryable, false);
  assert.ok(pairsOf(content, masters).length > 0);
});
