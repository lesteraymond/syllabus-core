const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { providerConfig, requestGroq, pairsOf, align, verifiedAlignment, batchSizeOf, concurrencyOf } = require('./gemini');
const { askJson } = require('./modelClient');
const groq = require('./groqClient');

// The direct Groq API provider (groqClient.js). Scripted transport only: no request leaves the machine.
const KEY = 'gsk_test-only-groq-0123456789';
const env = { SYLLABUS_CHECK_AI_PROVIDER: 'groq', GROQ_API_KEY: KEY };
const judgement = pair => ({ id: pair.id, label: 'NOT_ALIGNED', explanation: 'Does not fit.', sourceQuote: pair.source.slice(0, 6), targetQuote: pair.target.slice(0, 6), sourceBloom: 'Apply', targetBloom: 'Apply', draft: 'A rewrite.' });
const reply = (content) => ({ ok: true, json: async () => ({ model: 'openai/gpt-oss-120b', choices: [{ finish_reason: 'stop', message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }) });
const onePair = () => { const { content, masters } = sample(); return pairsOf(content, masters).slice(0, 1); };

test('configured with its own key and a documented model; small steady requests for the per-minute limit', () => {
  assert.deepEqual(providerConfig(env), { provider: 'groq', model: 'openai/gpt-oss-120b', configured: true, approved: false });
  assert.equal(providerConfig({ ...env, GROQ_MODEL: 'openai/gpt-oss-20b' }).configured, true);
  for (const model of ['llama-3.3-70b-versatile', 'gpt-oss-120b']) assert.equal(providerConfig({ ...env, GROQ_MODEL: model }).configured, false, model);
  assert.equal(providerConfig({ SYLLABUS_CHECK_AI_PROVIDER: 'groq' }).configured, false);
  assert.equal(batchSizeOf('openai/gpt-oss-120b', env), 4);
  assert.equal(concurrencyOf(env), 1);
  assert.equal(concurrencyOf({ SYLLABUS_CHECK_AI_PROVIDER: 'openrouter' }), 3, 'other providers are unchanged');
});

test('a request: the documented endpoint, JSON-object mode with "json" in the prompt, low reasoning, an answer ceiling under the 8K-per-minute limit', async () => {
  const pairs = onePair();
  const transport = async (url, request) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(request.headers.Authorization, `Bearer ${KEY}`);
    const body = JSON.parse(request.body);
    assert.equal(body.model, 'openai/gpt-oss-120b');
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.equal(body.reasoning_effort, 'low');
    assert.equal(body.temperature, 0);
    assert.equal(body.max_completion_tokens, 4096);
    assert.match(body.messages[0].content, /json object matching this JSON schema/);
    return reply(JSON.stringify({ judgements: pairs.map(judgement) }));
  };
  assert.equal((await requestGroq(pairs, { env, transport }))[0].label, 'NOT_ALIGNED');
  assert.notEqual(groq.configKeyOf(env), groq.configKeyOf({ ...env, GROQ_REASONING_EFFORT: 'high' }), 'a different reasoning effort is a different question');
});

test('a blank or cut-off answer is incomplete; a rate limit and any error name the status and never the key', async () => {
  const pairs = onePair();
  await assert.rejects(requestGroq(pairs, { env, transport: async () => reply('  ') }), e => e.unverified === true);
  await assert.rejects(requestGroq(pairs, { env, transport: async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '{"judgements":[' } }] }) }) }), e => e.unverified === true);
  await assert.rejects(requestGroq(pairs, { env, transport: async () => ({ ok: false, status: 429, json: async () => ({ error: { message: `Rate limit reached for ${KEY}: tokens per minute` } }) }) }),
    e => /Groq HTTP 429: Rate limit reached for \[redacted\]/.test(e.message) && !e.message.includes(KEY));
});

test('a per-minute rate limit is waited out and the same request sent again; a per-day limit or a long wait is not', async () => {
  const pairs = onePair(), sleeps = [];
  const sleep = async ms => { sleeps.push(ms); };
  let calls = 0;
  const limited = (message, headers) => ({ ok: false, status: 429, headers: { get: name => headers?.[name] ?? null }, json: async () => ({ error: { message } }) });
  const transport = async () => (++calls <= 2 ? limited('Rate limit reached on tokens per minute (TPM): Limit 8000, Used 7092, Requested 3410. Please try again in 18.764999999s.') : reply(JSON.stringify({ judgements: pairs.map(judgement) })));
  const answer = await groq.groqChat({ model: 'openai/gpt-oss-120b', system: 's', user: 'u' }, { env, transport, sleep });
  assert.equal(calls, 3); assert.deepEqual(sleeps, [19765, 19765]);
  assert.ok(answer.text);
  // Retry-After header, minutes and seconds
  sleeps.length = 0; calls = 0;
  await groq.groqChat({ model: 'openai/gpt-oss-120b', system: 's', user: 'u' }, { env, sleep, transport: async () => (++calls === 1 ? limited('x', { 'retry-after': '7' }) : reply('{}')) });
  assert.deepEqual(sleeps, [8000]);
  // a per-day limit, or a wait of more than 90 s, fails with the reason
  for (const message of ['Rate limit reached on tokens per day (TPD): Limit 200000. Please try again in 5m10s.', 'Rate limit reached on tokens per minute. Please try again in 2m5s.']) {
    calls = 0; sleeps.length = 0;
    await assert.rejects(groq.groqChat({ model: 'openai/gpt-oss-120b', system: 's', user: 'u' }, { env, sleep, transport: async () => { calls++; return limited(message); } }), e => /Groq HTTP 429/.test(e.message));
    assert.equal(calls, 1); assert.deepEqual(sleeps, []);
  }
  // it gives up after 8 waits
  calls = 0;
  await assert.rejects(groq.groqChat({ model: 'openai/gpt-oss-120b', system: 's', user: 'u' }, { env, sleep, transport: async () => { calls++; return limited('tokens per minute. try again in 1s.'); } }), e => /429/.test(e.message));
  assert.equal(calls, 9);
});

test('a whole check runs on Groq in batches of four, one request at a time; verified only for the approved model', async () => {
  const { content, masters } = sample();
  let inFlight = 0, peak = 0, biggest = 0;
  const transport = async (url, request) => {
    inFlight++; peak = Math.max(peak, inFlight);
    const batch = JSON.parse(JSON.parse(request.body).messages[1].content).document_data;
    biggest = Math.max(biggest, batch.length);
    await new Promise(r => setTimeout(r, 2));
    inFlight--;
    return reply(JSON.stringify({ judgements: batch.map(p => ({ ...judgement(p), label: 'ALIGNED', explanation: 'Fits.', draft: '' })) }));
  };
  const result = await align(content, masters, { env, transport });
  assert.equal(result.status, 'completed');
  assert.deepEqual([result.provider, result.model], ['groq', 'openai/gpt-oss-120b']);
  assert.equal(biggest, 4); assert.equal(peak, 1);
  assert.equal(verifiedAlignment(result, env), false, 'experimental: not approved');
  assert.equal(verifiedAlignment(result, { ...env, SYLLABUS_CHECK_GROQ_APPROVED_MODEL: 'openai/gpt-oss-120b' }), true);
});

test('askJson (the one-rewrite-for-all-relationships call) works on Groq too', async () => {
  const transport = async (url, request) => {
    const body = JSON.parse(request.body);
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.match(body.messages[0].content, /json object/);
    return reply(JSON.stringify({ text: 'One revised outcome.' }));
  };
  const schema = native => ({ type: 'object', properties: { text: { type: 'string' } }, required: ['text'], ...(native ? {} : { additionalProperties: false }) });
  assert.deepEqual(await askJson({ system: 'Rewrite the field.', payload: { field: 'x' }, schema }, { env, transport }), { text: 'One revised outcome.' });
});
