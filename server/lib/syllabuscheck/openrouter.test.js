const test = require('node:test');
const assert = require('node:assert/strict');
const { requestOpenRouter, align, pairsOf, providerConfig, verifiedGemini } = require('./gemini');
const { sample } = require('./fixtures');
const env = { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-only-router-key', OPENROUTER_MODEL: 'google/gemini-2.5-flash' };
const judgement = pair => ({ id: pair.id, label: 'NOT_ALIGNED', explanation: 'Recall of flowers does not demonstrate engineering problem solving.', sourceQuote: pair.source.slice(0, 10), targetQuote: pair.target.slice(0, 10), sourceBloom: 'Create', targetBloom: 'Remember', draft: 'Construct a mathematical solution and demonstrate it with worked test cases.' });

test('Nemotron free route uses JSON mode, server validation and zero-price routing without paid fallback', async () => {
  const { verifiedAlignment, NEMOTRON_FREE } = require('./gemini');
  const freeEnv = { ...env, OPENROUTER_MODEL: NEMOTRON_FREE };
  assert.equal(providerConfig(freeEnv).configured, true);
  const { content, masters } = sample();
  const pairs = pairsOf(content, masters).slice(0, 1);
  const transport = async (url, request) => {
    const body = JSON.parse(request.body);
    assert.equal(body.model, NEMOTRON_FREE);
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.deepEqual(body.provider.max_price, { prompt: 0, completion: 0 });
    assert.equal(body.provider.allow_fallbacks, false);
    assert.equal(body.provider.require_parameters, undefined);
    assert.match(body.messages[0].content, /"additionalProperties":false/);
    return { ok: true, json: async () => ({ model: NEMOTRON_FREE.replace(':free', ''), choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: pairs.map(judgement) }) } }] }) };
  };
  assert.equal((await requestOpenRouter(pairs, { env: freeEnv, transport }))[0].label, 'NOT_ALIGNED');
  assert.equal(verifiedAlignment({ status: 'completed', provider: 'openrouter', model: NEMOTRON_FREE }), true);
  assert.equal(verifiedAlignment({ status: 'not_evaluated', provider: 'openrouter', model: NEMOTRON_FREE }), false);
  assert.equal(verifiedAlignment({ status: 'completed', provider: 'openrouter', model: 'unknown/model' }), false);
});

test('Nemotron JSON mode cannot accept invented evidence, missing fields or extra schema fields', async () => {
  const { NEMOTRON_FREE } = require('./gemini');
  const { content, masters } = sample();
  const pairs = pairsOf(content, masters).slice(0, 1);
  const valid = judgement(pairs[0]);
  const missing = { ...valid }; delete missing.draft;
  for (const response of [{ ...valid, sourceQuote: 'invented text' }, { ...valid, invented: true }, missing]) {
    await assert.rejects(requestOpenRouter(pairs, { env: { ...env, OPENROUTER_MODEL: NEMOTRON_FREE }, transport: async () => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: [response] }) } }] }) }) }));
  }
});

const freeEnv = () => ({ ...env, OPENROUTER_MODEL: require('./gemini').NEMOTRON_FREE });
const answer = pairs => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: pairs.map(judgement) }) } }] }) });
const requested = request => JSON.parse(JSON.parse(request.body).messages[1].content).document_data;

test('Nemotron full checks use small batches; a batch that cannot be verified is asked again pair by pair and the check can still complete', async () => {
  const { content, masters } = sample();
  let calls = 0, singles = 0;
  const result = await align(content, masters, { env: freeEnv(), transport: async (url, request) => {
    const pairs = requested(request);
    assert.ok(pairs.length <= require('./gemini').batchSizeOf(require('./gemini').NEMOTRON_FREE, {}), 'a call never carries more than the configured batch size');
    calls++;
    if (calls === 2) return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: [] }) } }] }) }; // omitted answers
    if (pairs.length === 1 && calls > 2) singles++;
    return answer(pairs);
  } });
  assert.ok(singles >= 1, 'the failed batch was re-asked one relationship at a time');
  assert.equal(result.judgements.length, pairsOf(content, masters).length, 'no relationship was lost');
  assert.ok(result.judgements.every(j => j.label !== 'INSUFFICIENT_EVIDENCE'));
});

test('a relationship that stays unverifiable becomes INSUFFICIENT_EVIDENCE for that pair alone and the check never completes', async () => {
  const { content, masters } = sample();
  const all = pairsOf(content, masters);
  const bad = all[1].id;
  const result = await align(content, masters, { env: freeEnv(), transport: async (url, request) => {
    const pairs = requested(request);
    if (pairs.some(p => p.id === bad)) return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: 'not json' } }] }) };
    return answer(pairs);
  } });
  assert.equal(result.status, 'not_evaluated');
  assert.equal(result.judgements.length, all.length, 'every other relationship kept its verified judgement');
  const unverified = result.judgements.filter(j => j.unverified);
  assert.deepEqual(unverified.map(j => j.id), [bad]);
  assert.equal(unverified[0].label, 'INSUFFICIENT_EVIDENCE');
  assert.equal(unverified[0].draft, '');
  assert.match(result.reason, /1 of \d+ relationships could not be verified/);
});

test('quota and HTTP failures are not retried pair by pair and stop new batches from starting', async () => {
  const { content, masters } = sample();
  let calls = 0;
  const result = await align(content, masters, { env: freeEnv(), transport: async () => { calls++; return { ok: false, status: 429 }; } });
  const { concurrencyOf } = require('./gemini');
  assert.ok(calls >= 1 && calls <= concurrencyOf({}), `only the calls already in flight were made (${calls}); no new batch started after the error`);
  assert.equal(result.status, 'not_evaluated');
  assert.match(result.reason, /HTTP 429/);
});
test('OpenRouter uses its own key, requested Gemini model and strict structured output', async () => {
  const { content, masters } = sample('misaligned');
  const pairs = pairsOf(content, masters).slice(0, 2);
  const result = await requestOpenRouter(pairs, { env, transport: async (url, request) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(request.headers.Authorization, 'Bearer test-only-router-key');
    assert.equal(request.headers['x-goog-api-key'], undefined);
    const body = JSON.parse(request.body);
    assert.equal(body.model, 'google/gemini-2.5-flash');
    assert.equal(body.max_tokens, 8192);
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.response_format.json_schema.schema.additionalProperties, false);
    assert.equal(body.provider.require_parameters, true);
    assert.deepEqual(JSON.parse(body.messages[1].content).document_data, pairs);
    return { ok: true, json: async () => ({ model: body.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: pairs.map(judgement) }) } }] }) };
  } });
  assert.equal(result[0].label, 'NOT_ALIGNED');
  assert.equal(result[0].targetPath, pairs[0].targetPath);
});
test('OpenRouter cannot bypass evidence validation, model restrictions or response completion', async () => {
  const { content, masters } = sample();
  const pairs = pairsOf(content, masters).slice(0, 1);
  const valid = { model: env.OPENROUTER_MODEL, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: pairs.map(judgement) }) } }] };
  for (const body of [
    { ...valid, model: 'some-other-model' },
    { ...valid, error: { code: 429 } },
    { ...valid, choices: [{ ...valid.choices[0], finish_reason: 'length' }] },
    { ...valid, choices: [{ message: { content: JSON.stringify({ judgements: [{ ...judgement(pairs[0]), targetQuote: 'invented quotation' }] }) } }] },
  ]) await assert.rejects(requestOpenRouter(pairs, { env, transport: async () => ({ ok: true, json: async () => body }) }));
});
test('missing OpenRouter credentials never fall back to the exhausted direct Gemini key', async () => {
  const { content, masters } = sample();
  const result = await align(content, masters, { env: { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', GEMINI_API_KEY: 'direct-key' }, transport: () => { throw Error('Must not call a transport'); } });
  assert.equal(result.status, 'not_evaluated');
  assert.match(result.reason, /OPENROUTER_API_KEY/);
  assert.equal(providerConfig({ OPENROUTER_API_KEY: 'router-key', GEMINI_API_KEY: 'direct-key' }).provider, 'openrouter');
  assert.equal(providerConfig({ ...env, OPENROUTER_MODEL: 'openai/another-model' }).configured, false);
  assert.equal(providerConfig({ ...env, SYLLABUS_CHECK_AI_PROVIDER: 'off' }).configured, false);
});
test('OpenRouter records transport/model metadata; quota failures remain not evaluated', async () => {
  const { content, masters } = sample();
  const result = await align(content, masters, { env, transport: async () => ({ ok: false, status: 402 }) });
  assert.equal(result.status, 'not_evaluated');
  assert.equal(result.provider, 'openrouter');
  assert.equal(result.model, 'google/gemini-2.5-flash');
  assert.match(result.reason, /OpenRouter HTTP 402/);
  assert.equal(verifiedGemini(result), false);
  assert.equal(verifiedGemini({ status: 'completed', provider: 'openrouter', model: 'google/gemini-2.5-flash' }), true);
  assert.equal(verifiedGemini({ status: 'completed', provider: 'openrouter', model: 'openai/another-model' }), false);
});
test('OpenRouter errors report credit details without exposing the API key', async () => {
  await assert.rejects(requestOpenRouter([], { env, transport: async () => ({ ok: false, status: 402, json: async () => ({ error: { message: `Insufficient credits for ${env.OPENROUTER_API_KEY}` } }) }) }), error => error.message.includes('Insufficient credits') && error.message.includes('[redacted]') && !error.message.includes(env.OPENROUTER_API_KEY));
});

test('Nemotron free uses JSON mode with zero-price routing and the schema in the prompt', async () => {
  const { NEMOTRON_FREE, verifiedAlignment, batchSizeOf } = require('./gemini');
  const nvEnv = { ...env, OPENROUTER_MODEL: NEMOTRON_FREE };
  assert.equal(providerConfig(nvEnv).configured, true);
  assert.equal(providerConfig({ ...env, OPENROUTER_MODEL: 'nvidia/other:free' }).configured, false);
  assert.equal(verifiedAlignment({ status: 'completed', provider: 'openrouter', model: NEMOTRON_FREE }), true);
  assert.equal(batchSizeOf(NEMOTRON_FREE, {}), 8);
  const { content, masters } = sample();
  const pairs = pairsOf(content, masters).slice(0, 1);
  const transport = async (url, request) => {
    const body = JSON.parse(request.body);
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.deepEqual(body.provider.max_price, { prompt: 0, completion: 0 });
    assert.equal(body.provider.allow_fallbacks, false);
    assert.match(body.messages[0].content, /"additionalProperties":false/);
    return { ok: true, json: async () => ({ model: NEMOTRON_FREE, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: pairs.map(judgement) }) } }] }) };
  };
  assert.equal((await requestOpenRouter(pairs, { env: nvEnv, transport }))[0].label, 'NOT_ALIGNED');
});

test('the paid MiniMax model is a supported checker model and uses strict JSON-schema output', async () => {
  const model = 'minimax/minimax-m3.1-flash';
  const paidEnv = { ...env, OPENROUTER_MODEL: model };
  assert.equal(providerConfig(paidEnv).configured, true);
  assert.equal(providerConfig({ ...env, OPENROUTER_MODEL: model + ':free' }).configured, false);
  const { content, masters } = sample();
  const pairs = pairsOf(content, masters).slice(0, 1);
  const transport = async (url, request) => {
    const body = JSON.parse(request.body);
    assert.equal(body.model, model);
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.provider.require_parameters, true);
    return { ok: true, json: async () => ({ model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: pairs.map(judgement) }) } }] }) };
  };
  assert.equal((await requestOpenRouter(pairs, { env: paidEnv, transport }))[0].label, 'NOT_ALIGNED');
});
