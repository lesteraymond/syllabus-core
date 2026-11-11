const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { providerConfig, requestDeepSeek, pairsOf, align, verifiedAlignment, timeoutOf } = require('./gemini');
const { askJson } = require('./modelClient');
const deepseek = require('./deepseekClient');

// The direct DeepSeek API provider (deepseekClient.js). Scripted transport only: no request leaves the machine.
const KEY = 'sk-test-only-deepseek-0123456789';
const env = { SYLLABUS_CHECK_AI_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: KEY };
const judgement = pair => ({ id: pair.id, label: 'NOT_ALIGNED', explanation: 'Does not fit.', sourceQuote: pair.source.slice(0, 6), targetQuote: pair.target.slice(0, 6), sourceBloom: 'Apply', targetBloom: 'Apply', draft: 'A rewrite.' });
const reply = (content, extra = {}) => ({ ok: true, json: async () => ({ model: 'deepseek-v4-pro', choices: [{ finish_reason: 'stop', message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 }, ...extra }) });
const onePair = () => { const { content, masters } = sample(); return pairsOf(content, masters).slice(0, 1); };

test('configured with its own key and a documented model; any other model or no key is not', () => {
  assert.deepEqual(providerConfig(env), { provider: 'deepseek', model: 'deepseek-v4-pro', configured: true, approved: false });
  assert.equal(providerConfig({ ...env, DEEPSEEK_MODEL: 'deepseek-flash' }).configured, true);
  for (const model of ['deepseek-chat', 'deepseek-reasoner', 'deepseek/deepseek-v4-pro']) assert.equal(providerConfig({ ...env, DEEPSEEK_MODEL: model }).configured, false, model);
  assert.equal(providerConfig({ SYLLABUS_CHECK_AI_PROVIDER: 'deepseek' }).configured, false);
  assert.equal(timeoutOf('deepseek-v4-pro'), 240000);
});

test('a request: the documented endpoint, JSON-object mode with "json" in the prompt, thinking off, temperature 0; the answer is verified like any provider', async () => {
  const pairs = onePair();
  const transport = async (url, request) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(request.headers.Authorization, `Bearer ${KEY}`);
    const body = JSON.parse(request.body);
    assert.equal(body.model, 'deepseek-v4-pro');
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.deepEqual(body.thinking, { type: 'disabled' });
    assert.equal(body.reasoning_effort, undefined);
    assert.equal(body.temperature, 0);
    assert.equal(body.max_tokens, deepseek.MAX_TOKENS);
    assert.match(body.messages[0].content, /json object matching this JSON schema/);
    assert.equal(JSON.parse(body.messages[1].content).document_data[0].id, pairs[0].id);
    return reply(JSON.stringify({ judgements: pairs.map(judgement) }));
  };
  const [j] = await requestDeepSeek(pairs, { env, transport });
  assert.equal(j.label, 'NOT_ALIGNED');
});

test('DEEPSEEK_THINKING=on asks for thinking at low effort, and is a different question for the reuse key', async () => {
  const pairs = onePair();
  const transport = async (url, request) => {
    const body = JSON.parse(request.body);
    assert.deepEqual(body.thinking, { type: 'enabled' });
    assert.equal(body.reasoning_effort, 'low');
    return reply(JSON.stringify({ judgements: pairs.map(judgement) }));
  };
  await requestDeepSeek(pairs, { env: { ...env, DEEPSEEK_THINKING: 'on' }, transport });
  assert.notEqual(deepseek.configKeyOf(env), deepseek.configKeyOf({ ...env, DEEPSEEK_THINKING: 'on' }));
});

test('a blank or cut-off answer is incomplete (never a verdict); an HTTP error names the status and never the key', async () => {
  const pairs = onePair();
  await assert.rejects(requestDeepSeek(pairs, { env, transport: async () => reply('   ') }), e => e.unverified === true && /incomplete/.test(e.message));
  await assert.rejects(requestDeepSeek(pairs, { env, transport: async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '{"judgements":[' } }] }) }) }), e => e.unverified === true);
  await assert.rejects(requestDeepSeek(pairs, { env, transport: async () => ({ ok: false, status: 402, json: async () => ({ error: { message: `Insufficient Balance for ${KEY}` } }) }) }),
    e => /DeepSeek HTTP 402: Insufficient Balance for \[redacted\]; alignment not evaluated/.test(e.message) && !e.message.includes(KEY));
});

test('a whole check runs on DeepSeek; it counts as a verified check only for the model an operator approved', async () => {
  const { content, masters } = sample();
  const transport = async (url, request) => {
    const batch = JSON.parse(JSON.parse(request.body).messages[1].content).document_data;
    return reply(JSON.stringify({ judgements: batch.map(p => ({ ...judgement(p), label: 'ALIGNED', explanation: 'Fits.', draft: '' })) }));
  };
  const result = await align(content, masters, { env, transport });
  assert.equal(result.status, 'completed');
  assert.equal(result.provider, 'deepseek');
  assert.equal(result.model, 'deepseek-v4-pro');
  assert.equal(verifiedAlignment(result, env), false, 'experimental: not approved');
  assert.equal(verifiedAlignment(result, { ...env, SYLLABUS_CHECK_DEEPSEEK_APPROVED_MODEL: 'deepseek-v4-pro' }), true);
  assert.equal(verifiedAlignment(result, { ...env, SYLLABUS_CHECK_DEEPSEEK_APPROVED_MODEL: 'deepseek-flash' }), false);
});

test('askJson (the one-rewrite-for-all-relationships call) works on DeepSeek too', async () => {
  const transport = async (url, request) => {
    const body = JSON.parse(request.body);
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.match(body.messages[0].content, /^Rewrite[\s\S]*json object/);
    return reply(JSON.stringify({ text: 'One revised outcome.' }));
  };
  const schema = native => ({ type: 'object', properties: { text: { type: 'string' } }, required: ['text'], ...(native ? {} : { additionalProperties: false }) });
  assert.deepEqual(await askJson({ system: 'Rewrite the field.', payload: { field: 'x' }, schema }, { env, transport }), { text: 'One revised outcome.' });
});
