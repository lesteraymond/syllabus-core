'use strict';
// The direct Anthropic provider (anthropicClient.js, through gemini.js and modelClient.js), offline. Every request goes to a fake transport, and the
// global fetch is replaced for this whole file, so a request that slipped through could not reach the network. No key here is a real key.
const test = require('node:test');
const assert = require('node:assert/strict');
const realFetch = globalThis.fetch;
let blocked = 0;
globalThis.fetch = async () => { blocked += 1; throw new TypeError('fetch failed (network blocked in anthropic.test.js)'); };
test.after(() => { globalThis.fetch = realFetch; });
const gemini = require('./gemini');
const { requestAnthropic, requestOpenRouter, align, pairsOf, courseOf, providerConfig, verifiedAlignment, classifyFailure, resetProviderBlock, blockedNow } = gemini;
const { anthropicMessage, anthropicSettings, estimateUsd, usageOf, MODELS, EFFORTS, PRICES_AS_OF, US_ONLY_FACTOR } = require('./anthropicClient');
const { askJson } = require('./modelClient');
const { run } = require('./engine');
const { sample } = require('./fixtures');

const KEY = 'sk-ant-test-only-not-a-real-key';
const MODEL = 'claude-sonnet-4-6';
// A server where the operator has approved this model for official checking (without the approval nothing is sent: anthropic-lock.test.js).
const env = { SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: KEY, ANTHROPIC_MODEL: MODEL, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: MODEL };
const routerEnv = { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-only-router-key', OPENROUTER_MODEL: 'minimax/minimax-m3.1-flash' };
const judgement = pair => ({ id: pair.id, label: 'NOT_ALIGNED', explanation: 'Recall of flowers does not demonstrate engineering problem solving.', sourceQuote: pair.source.slice(0, 10), targetQuote: pair.target.slice(0, 10), sourceBloom: 'Create', targetBloom: 'Remember', draft: 'Construct a mathematical solution and demonstrate it with worked test cases.' });
// One answer of the Messages API: 1,000 input, 200 output and 3,000 cache-write tokens (US$0.01725 at the Claude Sonnet 4.6 list price).
const USAGE = { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 3000, cache_read_input_tokens: 0 };
const PER_CALL_USD = 0.01725;
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_offline', ...headers } });
const message = (text, extra = {}) => json({ id: 'msg_offline', type: 'message', role: 'assistant', model: MODEL, content: [{ type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null, usage: USAGE, ...extra });
const apiError = (status, type, text, headers) => json({ type: 'error', error: { type, message: text }, request_id: 'req_offline' }, status, headers);
// A fake fetch for the SDK that records each request; answer(request, n) gives the response to the n-th one.
function fake(answer) {
  const calls = [];
  const transport = async (url, init) => {
    const request = { url: String(url), method: init.method, headers: new Headers(init.headers), body: JSON.parse(init.body), signal: init.signal };
    calls.push(request);
    return answer(request, calls.length);
  };
  return { calls, transport };
}
const asked = request => JSON.parse(request.body.messages[0].content).document_data;
const answering = (judge = judgement) => fake(request => message(JSON.stringify({ judgements: asked(request).map(judge) })));
const hanging = request => new Promise((resolve, reject) => request.signal.addEventListener('abort', () => reject(request.signal.reason || new Error('aborted')), { once: true }));
// The OpenRouter side of a comparison: the transport gemini.js already uses (an object with ok and json()).
function router(answerText) {
  const calls = [];
  const transport = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body });
    const text = answerText(body);
    return { ok: true, json: async () => ({ model: routerEnv.OPENROUTER_MODEL, choices: [{ finish_reason: 'stop', message: { content: text } }] }) };
  };
  return { calls, transport };
}
const routerAnswering = () => router(body => JSON.stringify({ judgements: JSON.parse(body.messages[1].content).document_data.map(judgement) }));
const sleeper = () => { const waits = []; return { waits, sleep: async ms => { waits.push(ms); } }; };
const failureOf = promise => promise.then(() => null, error => error);
const one = () => { const { content, masters } = sample(); return { pairs: pairsOf(content, masters).slice(0, 1), course: courseOf(content) }; };
test.beforeEach(() => resetProviderBlock());

test('Anthropic is used only when chosen by name, with an sk-ant- key and a claude-* model; the other providers are chosen as before', () => {
  assert.deepEqual(providerConfig(env), { provider: 'anthropic', model: MODEL, configured: true, approved: true });
  assert.deepEqual(providerConfig({ ...env, SYLLABUS_CHECK_AI_PROVIDER: undefined, COMPLIANCE_AI_PROVIDER: 'Anthropic' }), { provider: 'anthropic', model: MODEL, configured: true, approved: true });
  // A key alone never selects it, and it never displaces a provider found by its key.
  assert.deepEqual(providerConfig({ ANTHROPIC_API_KEY: KEY, ANTHROPIC_MODEL: MODEL }), { provider: '', model: 'gemini-3.8-flash', configured: false });
  assert.equal(providerConfig({ ANTHROPIC_API_KEY: KEY, ANTHROPIC_MODEL: MODEL, OPENROUTER_API_KEY: 'k' }).provider, 'openrouter');
  assert.equal(providerConfig({ ANTHROPIC_API_KEY: KEY, ANTHROPIC_MODEL: MODEL, GEMINI_API_KEY: 'k' }).provider, 'gemini');
  // Not configured: no key, a key in another service's format or with a space, no model, a model that is not a claude-* id, or a claude-* id whose
  // request parameters were not verified (here approved all the same, to show that approval does not change that).
  for (const bad of [{ ANTHROPIC_API_KEY: '' }, { ANTHROPIC_API_KEY: undefined }, { ANTHROPIC_API_KEY: 'sk-or-v1-test-only' }, { ANTHROPIC_API_KEY: 'sk-ant-has space' }, { ANTHROPIC_API_KEY: 'abcdefghijklmnopqrstuvwxyz01234' },
    { ANTHROPIC_MODEL: '' }, { ANTHROPIC_MODEL: undefined }, { ANTHROPIC_MODEL: 'anthropic/claude-sonnet-4.6' }, { ANTHROPIC_MODEL: 'gpt-5' }, { ANTHROPIC_MODEL: 'Claude-Sonnet-4-6' }, { ANTHROPIC_MODEL: 'claude-sonnet-4-6 ' },
    ...['claude-future-9', 'claude-haiku-4-5', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-6-20260217', 'claude-opus-4-8', 'claude-fable-5', 'claude-mythos-5-1'].map(model => ({ ANTHROPIC_MODEL: model, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: model }))]) {
    assert.equal(providerConfig({ ...env, ...bad }).configured, false, JSON.stringify(bad));
  }
});

test('an Anthropic provider that is not fully configured sends nothing: the check is not evaluated, as with no provider', async () => {
  const { content, masters } = sample();
  for (const partial of [{ ANTHROPIC_API_KEY: '' }, { ANTHROPIC_MODEL: '' }, { ANTHROPIC_API_KEY: 'sk-or-v1-test-only' }]) {
    const { calls, transport } = answering();
    const result = await align(content, masters, { env: { ...env, ...partial }, transport });
    assert.deepEqual(result, { status: 'not_evaluated', reason: 'Anthropic requires ANTHROPIC_API_KEY and a supported claude-* ANTHROPIC_MODEL, with thinking and effort settings that model accepts.', judgements: [], failure: { kind: 'not_configured', retryable: false } });
    await assert.rejects(askJson({ system: 's', payload: {}, schema: () => ({}) }, { env: { ...env, ...partial }, transport }), error => error.status === 503);
    assert.equal(calls.length, 0);
  }
});

test('the request carries the OpenRouter system prompt, user message and strict schema to the fixed API URL, its thinking and effort stated and no sampling parameters', async () => {
  const { content, masters } = sample();
  const pairs = pairsOf(content, masters).slice(24, 27), course = courseOf(content);
  const staged = { SYLLABUS_CHECK_STAGE_A: 'on', SYLLABUS_CHECK_STAGE_C1: 'on', SYLLABUS_CHECK_STAGE_C2: 'on', SYLLABUS_CHECK_STAGE_D1: 'on', SYLLABUS_CHECK_STAGE_D2: 'on', SYLLABUS_CHECK_VALUES_FILE: 'no-such-file.json' };
  for (const stages of [{}, staged]) {
    const routed = routerAnswering(), sent = answering();
    // With a stage on, these answers lack the stage fields and are refused: only the requests are compared here.
    await requestOpenRouter(pairs, { env: { ...routerEnv, ...stages }, transport: routed.transport, course }).catch(() => {});
    await requestAnthropic(pairs, { env: { ...env, ...stages }, transport: sent.transport, course }).catch(() => {});
    const [request] = sent.calls, [twin] = routed.calls;
    assert.equal(request.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(request.method, 'POST');
    assert.equal(request.headers.get('authorization'), `Bearer ${KEY}`); // SDK 1.x sends the API key as a bearer token
    assert.equal(request.headers.get('x-api-key'), null);
    assert.equal(request.headers.get('anthropic-version'), '2026-10-21');
    assert.equal(request.body.model, MODEL);
    assert.equal(request.body.max_tokens, 16000);
    for (const absent of ['temperature', 'top_p', 'top_k', 'stream', 'tools', 'tool_choice', 'fallbacks', 'metadata', 'stop_sequences']) assert.equal(absent in request.body, false, absent);
    assert.deepEqual(Object.keys(request.body).sort(), ['max_tokens', 'messages', 'model', 'output_config', 'system', 'thinking']);
    assert.equal(request.headers.get('anthropic-beta'), null);
    // Claude Sonnet 4.6 thinks only when asked: adaptive thinking at its default effort, both stated.
    assert.deepEqual(request.body.thinking, { type: 'adaptive' });
    assert.deepEqual(request.body.system, [{ type: 'text', text: twin.body.messages[0].content, cache_control: { type: 'ephemeral' } }]);
    assert.deepEqual(request.body.messages, [{ role: 'user', content: twin.body.messages[1].content }]);
    assert.deepEqual(request.body.output_config, { effort: 'high', format: { type: 'json_schema', schema: twin.body.response_format.json_schema.schema } });
    assert.equal(sent.calls.length, 1);
  }
});

test('ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN, a process-wide key, ANTHROPIC_LOG, tracing settings and ANTHROPIC_CUSTOM_HEADERS change nothing: the server setting key goes to the fixed URL with no extra header, and nothing is logged', async () => {
  const names = ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_LOG', 'ANTHROPIC_CUSTOM_HEADERS', 'ANTHROPIC_OPEN_TELEMETRY', 'ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE', 'ANTHROPIC_PROFILE'];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const methods = ['log', 'info', 'warn', 'error', 'debug'], original = Object.fromEntries(methods.map(m => [m, console[m]])), logged = [];
  Object.assign(process.env, { ANTHROPIC_BASE_URL: 'https://redirect.invalid', ANTHROPIC_AUTH_TOKEN: 'test-only-token', ANTHROPIC_API_KEY: 'sk-ant-process-env-test-only', ANTHROPIC_LOG: 'debug',
    ANTHROPIC_CUSTOM_HEADERS: 'anthropic-beta: test-only-beta\nX-Test-Extra: 1\n  x-test-spaced :  2', ANTHROPIC_OPEN_TELEMETRY: 'true', ANTHROPIC_OPEN_TELEMETRY_TRACES_CONTENT_MODE: 'content', ANTHROPIC_PROFILE: 'test-only-profile' });
  for (const m of methods) console[m] = (...args) => logged.push(args);
  try {
    const { pairs, course } = one();
    const ok = answering();
    await requestAnthropic(pairs, { env, transport: ok.transport, course });
    const refused = fake(() => apiError(401, 'authentication_error', 'invalid x-api-key'));
    await requestAnthropic(pairs, { env, transport: refused.transport, course }).catch(() => {});
    assert.equal(ok.calls.length + refused.calls.length, 2);
    for (const request of [...ok.calls, ...refused.calls]) {
      assert.equal(request.url, 'https://api.anthropic.com/v1/messages');
      assert.equal(request.headers.get('authorization'), `Bearer ${KEY}`);
      assert.equal(request.headers.get('x-api-key'), null);
      for (const extra of ['anthropic-beta', 'x-test-extra', 'x-test-spaced', 'traceparent', 'baggage']) assert.equal(request.headers.get(extra), null, extra);
    }
    // A custom header that names one the request needs is removed too, so a key from the environment can never stand in for the server setting:
    // the request goes without it (and would be refused, unbilled), never with the other key.
    process.env.ANTHROPIC_CUSTOM_HEADERS = 'Authorization: Bearer sk-ant-other-test-only';
    const swapped = answering();
    await requestAnthropic(pairs, { env, transport: swapped.transport, course });
    assert.equal(swapped.calls[0].headers.get('authorization'), null);
    assert.equal(JSON.stringify([...swapped.calls[0].headers]).includes('sk-ant-other'), false);
  } finally {
    for (const m of methods) console[m] = original[m];
    for (const name of names) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; }
  }
  assert.deepEqual(logged, []);
});

test('the operator settings are bounded, and effort, the prompt cache and the answer cap follow them', async () => {
  assert.deepEqual(anthropicSettings({}), { timeoutMs: 180000, maxRetries: 2, maxTokens: 16000, effort: null, thinking: 'adaptive', cache: true });
  assert.deepEqual(anthropicSettings({ ANTHROPIC_TIMEOUT_SEC: '60', ANTHROPIC_MAX_RETRIES: '0', ANTHROPIC_MAX_TOKENS: '4096', ANTHROPIC_EFFORT: 'High', ANTHROPIC_THINKING: ' Off ', ANTHROPIC_PROMPT_CACHE: 'OFF' }), { timeoutMs: 60000, maxRetries: 0, maxTokens: 4096, effort: 'high', thinking: 'off', cache: false });
  assert.deepEqual(anthropicSettings({ ANTHROPIC_TIMEOUT_SEC: '5', ANTHROPIC_MAX_RETRIES: '9', ANTHROPIC_MAX_TOKENS: '999999', ANTHROPIC_EFFORT: 'extreme', ANTHROPIC_THINKING: 'enabled' }), { timeoutMs: 180000, maxRetries: 2, maxTokens: 16000, effort: null, thinking: 'adaptive', cache: true });
  const { pairs, course } = one();
  const sent = answering();
  await requestAnthropic(pairs, { env: { ...env, ANTHROPIC_EFFORT: 'low', ANTHROPIC_PROMPT_CACHE: 'off', ANTHROPIC_MAX_TOKENS: '4096' }, transport: sent.transport, course });
  assert.equal(sent.calls[0].body.output_config.effort, 'low');
  assert.equal('cache_control' in sent.calls[0].body.system[0], false);
  assert.equal(sent.calls[0].body.max_tokens, 4096);
});

test('an Anthropic answer is verified exactly like an OpenRouter one: the same judgements, and the same refusals for invented evidence, extra or missing fields and broken JSON', async () => {
  const { content, masters } = sample();
  const pairs = pairsOf(content, masters).slice(24, 26), course = courseOf(content);
  const both = async text => {
    const outcome = promise => promise.then(judgements => ({ judgements }), error => ({ unverified: error.unverified, code: error.code, rejected: error.rejected, salvaged: error.salvaged }));
    return [await outcome(requestAnthropic(pairs, { env, transport: fake(() => message(text)).transport, course })), await outcome(requestOpenRouter(pairs, { env: routerEnv, transport: router(() => text).transport, course }))];
  };
  const [viaAnthropic, viaRouter] = await both(JSON.stringify({ judgements: pairs.map(judgement) }));
  assert.equal(viaAnthropic.judgements.length, 2);
  assert.deepEqual(viaAnthropic, viaRouter);
  const missing = { ...judgement(pairs[0]) }; delete missing.draft;
  for (const text of [JSON.stringify({ judgements: [{ ...judgement(pairs[0]), sourceQuote: 'invented text' }, judgement(pairs[1])] }), JSON.stringify({ judgements: [{ ...judgement(pairs[0]), invented: true }, judgement(pairs[1])] }),
    JSON.stringify({ judgements: [missing, judgement(pairs[1])] }), JSON.stringify({ judgements: [{ ...judgement(pairs[0]), label: 'aligned' }, judgement(pairs[1])] }), JSON.stringify({ judgements: [] }), '{"judgements": [']) {
    const [a, o] = await both(text);
    assert.equal(a.unverified, true, text);
    assert.deepEqual(a, o, text);
  }
});

test('a cut-off, refused or text-less answer is incomplete output that may be asked again, and what it used is still counted', async () => {
  const { pairs, course } = one();
  const valid = JSON.stringify({ judgements: pairs.map(judgement) });
  const thinking = { type: 'thinking', thinking: '', signature: 'offline' };
  for (const [extra, stop] of [[{ stop_reason: 'max_tokens' }, 'max_tokens'], [{ stop_reason: 'refusal' }, 'refusal'], [{ stop_reason: 'model_context_window_exceeded' }, 'model_context_window_exceeded'], [{ content: [thinking] }, 'end_turn'], [{ content: [] }, 'end_turn']]) {
    const used = [], { transport, calls } = fake(() => message(valid, extra));
    const error = await failureOf(requestAnthropic(pairs, { env, transport, course, onUsage: u => used.push(u) }));
    assert.equal(error.message, `Anthropic returned incomplete alignment output (stop_reason ${stop})`);
    assert.equal(error.unverified, true);
    assert.equal(error.code, 'incomplete_output');
    assert.equal(classifyFailure(error).kind, 'invalid_output');
    assert.equal(calls.length, 1);
    assert.equal(used.length, 1);
    assert.equal(used[0].outputTokens, 200);
  }
  // Thinking before the answer is skipped: only the text blocks are the answer.
  const { transport } = fake(() => message(valid, { content: [thinking, { type: 'text', text: valid }] }));
  assert.equal((await requestAnthropic(pairs, { env, transport, course }))[0].label, 'NOT_ALIGNED');
});

test('an answer from another model is refused, while a dated snapshot of the configured model is accepted', async () => {
  const { pairs, course } = one();
  const valid = JSON.stringify({ judgements: pairs.map(judgement) });
  for (const model of ['claude-opus-5-5', 'claude-sonnet-4-6-preview', 'claude-sonnet-4-5']) {
    const error = await failureOf(requestAnthropic(pairs, { env, transport: fake(() => message(valid, { model })).transport, course }));
    assert.equal(error.message, 'Anthropic returned a different model; alignment not evaluated');
    assert.equal(error.unverified, undefined);
    assert.equal(error.modelReturned, model, 'the refusal names the model that answered, exactly');
  }
  assert.equal((await requestAnthropic(pairs, { env, transport: fake(() => message(valid, { model: 'claude-sonnet-4-6-20260217' })).transport, course })).length, 1);
});

test('a refusal of the request itself is never sent again, is classified as before, and never carries the key', async () => {
  const { pairs, course } = one();
  for (const [status, type, kind] of [[400, 'invalid_request_error', 'provider_rejected'], [401, 'authentication_error', 'provider_access'], [402, 'billing_error', 'provider_access'], [403, 'permission_error', 'provider_access'], [404, 'not_found_error', 'provider_rejected'], [413, 'request_too_large', 'provider_rejected']]) {
    const { transport, calls } = fake(() => apiError(status, type, `offline ${type} for ${KEY} and sk-ant-another-test-key`));
    const { waits, sleep } = sleeper();
    const error = await failureOf(requestAnthropic(pairs, { env, transport, course, sleep }));
    assert.equal(calls.length, 1, `HTTP ${status} is not sent again`);
    assert.deepEqual(waits, []);
    assert.equal(error.message, `Anthropic HTTP ${status}: offline ${type} for [redacted] and [redacted]; alignment not evaluated`);
    assert.equal(error.status, status);
    assert.equal(error.requestId, 'req_offline');
    assert.equal(classifyFailure(error).kind, kind);
    assert.equal(JSON.stringify({ message: error.message, ...error }).includes('sk-ant-'), false);
  }
});

test('rate limits, overloads, server errors and dropped connections are retried a bounded number of times, after the wait the API asks for', async () => {
  const { pairs, course } = one();
  const valid = JSON.stringify({ judgements: pairs.map(judgement) });
  const attempt = async (answer, extraEnv = {}) => {
    const { transport, calls } = fake(answer), { waits, sleep } = sleeper(), used = [];
    const outcome = await requestAnthropic(pairs, { env: { ...env, ...extraEnv }, transport, course, sleep, onUsage: u => used.push(u) }).then(judgements => ({ judgements }), error => ({ error }));
    return { ...outcome, calls: calls.length, waits, used };
  };
  // A rate limit that names its wait (retry-after, in seconds), then an answer.
  let r = await attempt((request, n) => (n === 1 ? apiError(429, 'rate_limit_error', 'slow down', { 'retry-after': '3' }) : message(valid)));
  assert.deepEqual([r.judgements.length, r.calls, r.waits, r.used.map(u => u.attempts)], [1, 2, [3000], [2]]);
  // retry-after-ms is preferred when both are present.
  r = await attempt((request, n) => (n === 1 ? apiError(429, 'rate_limit_error', 'slow down', { 'retry-after-ms': '1500', 'retry-after': '2' }) : message(valid)));
  assert.deepEqual([r.calls, r.waits], [2, [1500]]);
  // An overload every time: 1 + ANTHROPIC_MAX_RETRIES (default 2) attempts with exponential waits, then a provider error, as an OpenRouter 5xx is.
  r = await attempt(() => apiError(529, 'overloaded_error', 'Overloaded'));
  assert.deepEqual([r.calls, r.waits, classifyFailure(r.error).kind, r.error.usage.attempts], [3, [1000, 2000], 'provider_error', 3]);
  assert.equal(r.error.message, 'Anthropic HTTP 529: Overloaded; alignment not evaluated');
  // A rate limit every time ends as a quota failure; 500, 502 and 503 are retried like 529 (504, the API's own timeout, is not: see below).
  r = await attempt(() => apiError(429, 'rate_limit_error', 'rate limited'));
  assert.deepEqual([r.calls, classifyFailure(r.error).kind], [3, 'provider_quota']);
  for (const status of [500, 502, 503]) {
    r = await attempt((request, n) => (n === 1 ? apiError(status, 'api_error', 'Internal server error') : message(valid)));
    assert.deepEqual([r.calls, r.judgements?.length], [2, 1], `HTTP ${status}`);
  }
  // A wait longer than 30 s is not waited for, and ANTHROPIC_MAX_RETRIES=0 sends once.
  r = await attempt(() => apiError(429, 'rate_limit_error', 'rate limited', { 'retry-after': '120' }));
  assert.deepEqual([r.calls, r.waits, classifyFailure(r.error).kind], [1, [], 'provider_quota']);
  r = await attempt(() => apiError(529, 'overloaded_error', 'Overloaded'), { ANTHROPIC_MAX_RETRIES: '0' });
  assert.deepEqual([r.calls, r.waits], [1, []]);
  r = await attempt(() => apiError(529, 'overloaded_error', 'Overloaded'), { ANTHROPIC_MAX_RETRIES: '3' });
  assert.deepEqual([r.calls, r.waits], [4, [1000, 2000, 4000]]);
  // A dropped connection is retried; one that keeps dropping is a provider error without a status.
  r = await attempt((request, n) => { if (n === 1) throw new TypeError('fetch failed'); return message(valid); });
  assert.deepEqual([r.judgements.length, r.calls, r.waits], [1, 2, [1000]]);
  r = await attempt(() => { throw new TypeError('fetch failed'); });
  assert.deepEqual([r.calls, r.error.message, classifyFailure(r.error).kind], [3, 'Anthropic connection failed; alignment not evaluated', 'provider_error']);
  // No retry when the deadline would leave less than 10 s for it.
  r = await attempt(() => apiError(529, 'overloaded_error', 'Overloaded'), { ANTHROPIC_TIMEOUT_SEC: '10' });
  assert.deepEqual([r.calls, r.waits], [1, []]);
});

test('a request that runs past its deadline is a timeout: never sent again, classified as before, its tokens marked unknown', async () => {
  const { pairs, course } = one();
  // No answer at all, and an answer whose body never finishes: the deadline covers reading the answer too.
  const stalled = () => new Response(new ReadableStream({ start() {} }), { status: 200, headers: { 'content-type': 'application/json' } });
  for (const answer of [hanging, stalled]) {
    const { transport, calls } = fake(answer), { waits, sleep } = sleeper(), used = [];
    const started = Date.now();
    const error = await failureOf(requestAnthropic(pairs, { env, transport, course, sleep, anthropicTimeoutMs: 50, onUsage: u => used.push(u) }));
    assert.ok(Date.now() - started < 5000);
    assert.equal(error.name, 'TimeoutError');
    assert.match(error.message, /^Anthropic request timed out after \d+ s; alignment not evaluated$/);
    assert.equal(classifyFailure(error).kind, 'provider_timeout');
    assert.deepEqual([calls.length, waits], [1, []]);
    assert.deepEqual(used, [{ attempts: 1, inputTokens: 0, outputTokens: 0, thinkingTokens: null, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, estimatedUsd: 0, priceAsOf: PRICES_AS_OF, timedOut: true }]);
  }
  // HTTP 504 is the API's own timeout: the same timeout, never sent again, its tokens unknown, and its request id kept.
  const { transport, calls } = fake(() => apiError(504, 'timeout_error', 'Request timed out'));
  const { waits, sleep } = sleeper(), used = [];
  const error = await failureOf(requestAnthropic(pairs, { env, transport, course, sleep, onUsage: u => used.push(u) }));
  assert.deepEqual([calls.length, waits, error.name, error.status, classifyFailure(error).kind], [1, [], 'TimeoutError', 504, 'provider_timeout']);
  assert.equal(error.message, 'Anthropic HTTP 504: Request timed out; alignment not evaluated');
  assert.deepEqual(used, [{ attempts: 1, inputTokens: 0, outputTokens: 0, thinkingTokens: null, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, estimatedUsd: 0, priceAsOf: PRICES_AS_OF, requestId: 'req_offline', timedOut: true }]);
});

test('a full check through Anthropic completes like one through OpenRouter, passes the verified-provider check and adds up what it used', async () => {
  const { content, masters } = sample();
  const sent = answering(), routed = routerAnswering();
  const result = await align(content, masters, { env, transport: sent.transport });
  const twin = await align(content, masters, { env: routerEnv, transport: routed.transport });
  assert.equal(result.status, 'completed');
  assert.deepEqual([result.provider, result.model, result.reason], ['anthropic', MODEL, '']);
  assert.equal(verifiedAlignment(result, env), true);
  assert.deepEqual(result.judgements.map(j => [j.id, j.label, j.draft]), twin.judgements.map(j => [j.id, j.label, j.draft]));
  assert.deepEqual([result.promptVersion, result.coverage, sent.calls.length], [twin.promptVersion, twin.coverage, routed.calls.length]);
  const n = sent.calls.length;
  assert.equal(n, 9, '100 relationships in batches of 12');
  const { estimatedUsd, ...counts } = result.usage;
  // These answers report no thinking count: unavailable, never counted as zero thinking.
  assert.deepEqual(counts, { requests: n, attempts: n, timedOut: 0, inputTokens: 1000 * n, outputTokens: 200 * n, thinkingTokens: 0, cacheCreationInputTokens: 3000 * n, cacheReadInputTokens: 0, thinkingReports: { nonzero: 0, zero: 0, unavailable: n }, stopReasons: { end_turn: n }, enumCaseOnly: 0, priceAsOf: PRICES_AS_OF });
  assert.ok(Math.abs(estimatedUsd - PER_CALL_USD * n) < 1e-9);
  assert.equal('usage' in twin, false, 'only an Anthropic check reports usage');
  // Reuse keys carry the provider and model: a re-check under Anthropic never reuses an OpenRouter verdict.
  assert.notEqual(result.judgements[30].key, twin.judgements[30].key);
  // A claude-* model that was not verified sends nothing, even when it is the approved one.
  const unverified = answering();
  const other = await align(content, masters, { env: { ...env, ANTHROPIC_MODEL: 'claude-future-9', SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-future-9' }, transport: unverified.transport });
  assert.deepEqual([other.status, other.failure.kind, unverified.calls.length], ['not_evaluated', 'not_configured', 0]);
});

test('an access refusal stops the check and holds further Anthropic requests for the cooldown, as for OpenRouter; the key never reaches the result', async () => {
  const { content, masters } = sample();
  const { transport, calls } = fake(() => apiError(401, 'authentication_error', `invalid x-api-key ${KEY}`));
  const first = await align(content, masters, { env, transport });
  assert.equal(first.status, 'not_evaluated');
  assert.equal(first.failure.kind, 'provider_access');
  assert.match(first.reason, /^Anthropic HTTP 401: invalid x-api-key \[redacted\]; alignment not evaluated \(batch \d+\/9; 0\/100 relationships verified\)\.$/);
  assert.ok(blockedNow());
  const sent = calls.length;
  assert.ok(sent >= 1 && sent <= 3, 'only the calls already in flight were sent');
  const second = await align(content, masters, { env, transport });
  assert.equal(calls.length, sent, 'nothing is sent during the cooldown');
  assert.match(second.reason, /refused a request a moment ago \(HTTP 401/);
  assert.equal(JSON.stringify([first, second]).includes(KEY), false);
});

test('one batch that times out leaves only its relationships unchecked; the rest of the check still runs, as for OpenRouter', async () => {
  const { content, masters } = sample();
  let hung = false;
  const { transport, calls } = fake(request => {
    if (!hung && asked(request).some(pair => pair.type === 'ILO-CLO')) { hung = true; return hanging(request); }
    return message(JSON.stringify({ judgements: asked(request).map(judgement) }));
  });
  const result = await align(content, masters, { env, transport, anthropicTimeoutMs: 50 });
  const timedOut = calls.find(request => asked(request).some(pair => pair.type === 'ILO-CLO'));
  const unchecked = result.judgements.filter(j => j.failureKind === 'provider_timeout');
  assert.deepEqual(unchecked.map(j => j.id).sort(), asked(timedOut).map(pair => pair.id).sort());
  assert.ok(unchecked.every(j => j.unverified && j.label === 'INSUFFICIENT_EVIDENCE'));
  assert.equal(result.judgements.length, 100);
  assert.equal(result.judgements.filter(j => !j.unverified).length, 100 - unchecked.length);
  // The relationships that count are the outcome ones: an advisory relationship (ILO-content among them) never holds a check open.
  const counted = unchecked.filter(j => !gemini.isAdvisory(j.type)).length;
  assert.ok(counted > 0);
  assert.equal(result.status, 'not_evaluated');
  assert.deepEqual(result.failure, { kind: 'provider_timeout', retryable: true, count: counted });
  assert.deepEqual([result.usage.requests, result.usage.timedOut, calls.length], [9, 1, 9]);
});

test('the official result is the same whichever provider gave the verdicts, and an unconfigured Anthropic provider falls back exactly like no provider', async () => {
  const { content, masters } = sample();
  const options = { linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) };
  const official = report => [report.score, report.baseScore, report.passed, report.status, report.overall, report.band, report.hybrid.ready, report.hybrid.provisionalScore, report.hybrid.deductions, report.conformance.failed.map(f => f.id)];
  const viaAnthropic = await run(structuredClone(content), masters, { ...options, useAi: true, env, transport: answering().transport });
  const viaRouter = await run(structuredClone(content), masters, { ...options, useAi: true, env: routerEnv, transport: routerAnswering().transport });
  assert.equal(viaAnthropic.hybrid.alignment.status, 'completed');
  assert.deepEqual(official(viaAnthropic), official(viaRouter));
  const none = await run(structuredClone(content), masters, { ...options, useAi: true, env: {} });
  const unconfigured = await run(structuredClone(content), masters, { ...options, useAi: true, env: { ...env, ANTHROPIC_API_KEY: '' }, transport: () => { throw Error('must not be called'); } });
  assert.deepEqual(official(unconfigured), official(none));
  assert.equal(unconfigured.hybrid.alignment.failure.kind, 'not_configured');
  assert.equal(unconfigured.hybrid.ready, false);
  assert.ok(unconfigured.conformance.failed.some(f => f.ruleId === 'AI-REQUIRED'));
});

test('an AI rewrite through Anthropic sends the system text, payload and schema it is given and returns the parsed answer', async () => {
  const schema = native => ({ type: native ? 'OBJECT' : 'object', properties: { text: { type: native ? 'STRING' : 'string' } }, required: ['text'], ...(native ? {} : { additionalProperties: false }) });
  const question = { system: 'Rewrite the field.', payload: { field: 'ilo', current: 'Know programs.' }, schema, name: 'syllabus_rewrite' };
  const { transport, calls } = fake(() => message(JSON.stringify({ text: 'Design and test a small program.' })));
  const used = [];
  assert.deepEqual(await askJson(question, { env, transport, onUsage: u => used.push(u) }), { text: 'Design and test a small program.' });
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  assert.deepEqual(calls[0].body.system, [{ type: 'text', text: 'Rewrite the field.', cache_control: { type: 'ephemeral' } }]);
  assert.deepEqual(calls[0].body.messages, [{ role: 'user', content: JSON.stringify(question.payload) }]);
  assert.deepEqual(calls[0].body.output_config, { effort: 'high', format: { type: 'json_schema', schema: schema(false) } });
  assert.deepEqual(calls[0].body.thinking, { type: 'adaptive' });
  assert.equal(used.length, 1);
  // Broken JSON and a cut-off answer may be asked again (unverified); an HTTP refusal may not, and it names no alignment.
  await assert.rejects(askJson(question, { env, transport: fake(() => message('{"text": ')).transport }), error => error.unverified === true);
  await assert.rejects(askJson(question, { env, transport: fake(() => message('{}', { stop_reason: 'max_tokens' })).transport }), error => error.unverified === true && error.message === 'Anthropic returned incomplete output (stop_reason max_tokens)');
  await assert.rejects(askJson(question, { env, transport: fake(() => apiError(401, 'authentication_error', 'invalid x-api-key')).transport }), error => !error.unverified && error.message === 'Anthropic HTTP 401: invalid x-api-key');
});

test('a completed Anthropic check counts as verified for the submission gate only with the approved claude-* model; the other providers are judged as before', () => {
  assert.equal(verifiedAlignment({ status: 'completed', provider: 'anthropic', model: MODEL }, env), true);
  assert.equal(verifiedAlignment({ status: 'completed', provider: 'anthropic', model: 'claude-haiku-4-5-20251001' }, env), false, 'another model than the approved one');
  assert.equal(verifiedAlignment({ status: 'completed', provider: 'anthropic', model: 'claude-haiku-4-5-20251001' }, { SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-haiku-4-5-20251001' }), true);
  assert.equal(verifiedAlignment({ status: 'not_evaluated', provider: 'anthropic', model: MODEL }, env), false);
  assert.equal(verifiedAlignment({ status: 'completed', provider: 'anthropic', model: 'gpt-5' }, { SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'gpt-5' }), false);
  assert.equal(verifiedAlignment({ status: 'completed', provider: 'anthropic' }, env), false);
  assert.equal(verifiedAlignment({ status: 'completed', provider: 'openrouter', model: MODEL }, env), false);
  assert.equal(verifiedAlignment({ status: 'completed', provider: 'openrouter', model: routerEnv.OPENROUTER_MODEL }), true);
  assert.equal(verifiedAlignment({ status: 'completed', provider: 'gemini' }), true);
  assert.equal(verifiedAlignment({ status: 'completed', provider: 'other', model: MODEL }, env), false);
});

test('the usage estimate uses the dated list prices; a dated id is priced like its alias and an unlisted model gets no estimate', () => {
  const zero = { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0 };
  const million = { ...zero, inputTokens: 1e6, outputTokens: 1e6 };
  assert.equal(PRICES_AS_OF, '2026-10-27');
  assert.equal(estimateUsd('claude-sonnet-4-6', million), 18);
  assert.equal(estimateUsd('claude-sonnet-4-6', { ...zero, cacheCreationInputTokens: 1e6 }), 3.75);
  assert.equal(estimateUsd('claude-sonnet-4-6', { ...zero, cacheReadInputTokens: 1e6 }), 0.3);
  assert.equal(estimateUsd('claude-opus-5-5', million), 24);
  assert.equal(estimateUsd('claude-fable-5-1', { ...zero, cacheReadInputTokens: 1e6 }), 0.25);
  assert.equal(estimateUsd('claude-haiku-4-5-20251001', million), 6);
  assert.equal(estimateUsd(MODEL, { ...zero, inputTokens: 1000, outputTokens: 200, cacheCreationInputTokens: 3000 }), PER_CALL_USD);
  // The candidate, Claude Sonnet 5.5: $2 / $10, a cache write at 1.25x the input price, a cache read at $0.10; thinking is output and costs nothing more.
  assert.equal(estimateUsd('claude-sonnet-5-5', million), 12);
  assert.equal(estimateUsd('claude-sonnet-5-5', { ...zero, cacheCreationInputTokens: 1e6 }), 2.5);
  assert.equal(estimateUsd('claude-sonnet-5-5', { ...zero, cacheReadInputTokens: 1e6 }), 0.1);
  assert.equal(estimateUsd('claude-sonnet-5-5', { ...zero, outputTokens: 1e6, thinkingTokens: 6e5 }), 10);
  // Claude Haiku 5.5: $0.10 / $0.50 up to a 100,000-token prompt (cache included), $0.50 / $2.50 above it.
  assert.equal(estimateUsd('claude-haiku-5-5', { ...zero, inputTokens: 1e5, outputTokens: 1e6 }), 0.51);
  assert.equal(estimateUsd('claude-haiku-5-5', { ...zero, inputTokens: 1e5, cacheReadInputTokens: 1, outputTokens: 1e6 }), 2.55000005);
  for (const model of ['claude-future-9', 'claude-haiku-5-5-x', '', undefined, 'toString', '__proto__']) assert.equal(estimateUsd(model, million), null, String(model));
});

test('without a transport the SDK uses the global fetch, which this file blocks: the check fails as a provider error and nothing leaves the machine', async () => {
  const { content, masters } = sample();
  const before = blocked;
  const result = await align(content, masters, { env: { ...env, ANTHROPIC_MAX_RETRIES: '0' } });
  assert.ok(blocked > before);
  assert.equal(result.status, 'not_evaluated');
  assert.equal(result.failure.kind, 'provider_error');
  assert.equal(result.judgements.filter(j => !j.unverified).length, 0);
});

test('each verified model gets its thinking mode and effort stated; a combination the API would refuse sends nothing and leaves the provider not configured', async () => {
  const { pairs, course } = one();
  const valid = JSON.stringify({ judgements: pairs.map(judgement) });
  // From Anthropic's model pages (2026-10-27): how each model turns thinking off (null: it cannot) and its default effort.
  const expected = {
    'claude-sonnet-5-5': { off: 'between_tools', effort: 'high' }, 'claude-haiku-5-5': { off: 'disabled', effort: 'medium' }, 'claude-opus-5-5': { off: null, effort: 'medium' },
    'claude-fable-5-1': { off: null, effort: 'high' }, 'claude-opus-5': { off: 'disabled', effort: 'high' }, 'claude-sonnet-5': { off: 'disabled', effort: 'high' }, 'claude-sonnet-4-6': { off: 'disabled', effort: 'high' },
  };
  assert.deepEqual(Object.keys(MODELS).sort(), Object.keys(expected).sort());
  for (const [model, want] of Object.entries(expected)) {
    for (const thinking of ['', 'adaptive', 'off']) {
      for (const effort of ['', ...EFFORTS]) {
        const settings = { ...env, ANTHROPIC_MODEL: model, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: model, ANTHROPIC_THINKING: thinking, ANTHROPIC_EFFORT: effort };
        const label = `${model} thinking=${thinking || 'default'} effort=${effort || 'default'}`;
        const effective = effort || want.effort, off = thinking === 'off';
        const refused = (model === 'claude-sonnet-4-6' && effective === 'xhigh') || (off && (!want.off || effective === 'xhigh' || effective === 'max'));
        const sent = fake(() => message(valid, { model }));
        const error = await requestAnthropic(pairs, { env: settings, transport: sent.transport, course }).then(() => null, e => e);
        assert.equal(providerConfig(settings).configured, !refused, label);
        if (refused) {
          assert.deepEqual([sent.calls.length, error.kind, classifyFailure(error).retryable], [0, 'not_configured', false], label);
          continue;
        }
        assert.equal(error, null, label);
        assert.deepEqual(sent.calls[0].body.thinking, { type: off ? want.off : 'adaptive' }, label);
        assert.equal(sent.calls[0].body.output_config.effort, effective, label);
      }
    }
  }
});

test('the evaluation candidate, claude-sonnet-5-5, is asked with adaptive thinking at effort high, a strict JSON schema and max_tokens 16000, all stated', async () => {
  const { pairs, course } = one();
  const candidate = { ...env, ANTHROPIC_MODEL: 'claude-sonnet-5-5', SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-sonnet-5-5' };
  const sent = fake(() => message(JSON.stringify({ judgements: pairs.map(judgement) }), { model: 'claude-sonnet-5-5' }));
  assert.equal((await requestAnthropic(pairs, { env: candidate, transport: sent.transport, course })).length, 1);
  const { body } = sent.calls[0];
  assert.deepEqual({ model: body.model, max_tokens: body.max_tokens, thinking: body.thinking, effort: body.output_config.effort, format: body.output_config.format.type, cache: body.system[0].cache_control },
    { model: 'claude-sonnet-5-5', max_tokens: 16000, thinking: { type: 'adaptive' }, effort: 'high', format: 'json_schema', cache: { type: 'ephemeral' } });
  assert.equal(body.output_config.format.schema.additionalProperties, false);
  // Stating the default changes nothing: ANTHROPIC_EFFORT=high and ANTHROPIC_THINKING=adaptive send the same request.
  const stated = fake(() => message(JSON.stringify({ judgements: pairs.map(judgement) }), { model: 'claude-sonnet-5-5' }));
  await requestAnthropic(pairs, { env: { ...candidate, ANTHROPIC_EFFORT: 'high', ANTHROPIC_THINKING: 'adaptive' }, transport: stated.transport, course });
  assert.deepEqual(stated.calls[0].body, body);
});

test('what each request used and how it ended is recorded: thinking tokens, the stop reason with a refusal\'s category, and the request id; the thinking text is never kept', async () => {
  const { pairs, course } = one();
  const valid = JSON.stringify({ judgements: pairs.map(judgement) });
  const thinkingBlock = { type: 'thinking', thinking: 'private reasoning that is never kept', signature: 'offline' };
  const usage = { ...USAGE, output_tokens: 1200, output_tokens_details: { thinking_tokens: 1000 } };
  const used = [], sent = fake(() => message(valid, { content: [thinkingBlock, { type: 'text', text: valid }], usage }));
  const judgements = await requestAnthropic(pairs, { env, transport: sent.transport, course, onUsage: u => used.push(u) });
  // US$ at the Claude Sonnet 4.6 list price: 1,000 input, 3,000 cache-write and 1,200 output tokens (1,000 of them thinking).
  assert.deepEqual(used, [{ attempts: 1, inputTokens: 1000, outputTokens: 1200, thinkingTokens: 1000, cacheCreationInputTokens: 3000, cacheReadInputTokens: 0, estimatedUsd: 0.03225, priceAsOf: PRICES_AS_OF, requestId: 'req_offline', stopReason: 'end_turn' }]);
  assert.equal(JSON.stringify(judgements).includes('private reasoning'), false);
  const answer = await anthropicMessage({ model: MODEL, system: 's', user: 'u', schema: { type: 'object', properties: {}, required: [], additionalProperties: false } }, { env, transport: sent.transport });
  assert.deepEqual([answer.text, answer.stopReason, answer.stopCategory, answer.requestId, typeof answer.latencyMs], [valid, 'end_turn', null, 'req_offline', 'number']);
  assert.equal(JSON.stringify(answer).includes('private reasoning'), false);
  // A refusal is incomplete output, retried like any other (no new retry rule), and keeps its category: a named one or null.
  for (const category of ['cyber', null]) {
    const refusedUse = [], refusal = fake(() => message(valid, { stop_reason: 'refusal', stop_details: { type: 'refusal', category, explanation: null } }));
    const error = await failureOf(requestAnthropic(pairs, { env, transport: refusal.transport, course, onUsage: u => refusedUse.push(u) }));
    assert.deepEqual([error.code, error.unverified, error.stopReason, error.stopCategory, error.requestId, refusal.calls.length], ['incomplete_output', true, 'refusal', category, 'req_offline', 1]);
    assert.deepEqual([refusedUse[0].stopReason, refusedUse[0].stopCategory, refusedUse[0].outputTokens], ['refusal', category, 200]);
  }
  // A max_tokens stop records its stop reason, and no category.
  const cutUse = [], cut = fake(() => message(valid, { stop_reason: 'max_tokens' }));
  const cutError = await failureOf(requestAnthropic(pairs, { env, transport: cut.transport, course, onUsage: u => cutUse.push(u) }));
  assert.deepEqual([cutError.stopReason, cutError.stopCategory, cutUse[0].stopReason, 'stopCategory' in cutUse[0]], ['max_tokens', null, 'max_tokens', false]);
});

test('thinking tokens: a reported count is kept, zero included; a missing count is null and counted as unavailable, never as zero; the billed output is the same', async () => {
  const { pairs, course } = one();
  const valid = JSON.stringify({ judgements: pairs.map(judgement) });
  const { total, add } = gemini.usageTotal(), used = [];
  // Nonzero, an explicit zero, no count at all, and an empty details object: the output tokens (what is billed) are 1,200 each time.
  for (const details of [{ thinking_tokens: 1000 }, { thinking_tokens: 0 }, undefined, {}]) {
    const usage = { ...USAGE, output_tokens: 1200, ...(details ? { output_tokens_details: details } : {}) };
    await requestAnthropic(pairs, { env, transport: fake(() => message(valid, { usage })).transport, course, onUsage: u => { used.push(u); add(u); } });
  }
  assert.deepEqual(used.map(u => [u.outputTokens, u.thinkingTokens]), [[1200, 1000], [1200, 0], [1200, null], [1200, null]]);
  assert.ok(used.every(u => u.estimatedUsd === used[0].estimatedUsd), 'the thinking count changes nothing in what is billed');
  assert.deepEqual([total.thinkingTokens, total.thinkingReports, total.outputTokens], [1000, { nonzero: 1, zero: 1, unavailable: 2 }, 4800]);
  // A request that brought no answer (a timeout): its thinking is unknown as well.
  const { transport } = fake(hanging);
  await failureOf(requestAnthropic(pairs, { env, transport, course, anthropicTimeoutMs: 50, onUsage: add }));
  assert.deepEqual([total.requests, total.thinkingReports], [5, { nonzero: 1, zero: 1, unavailable: 3 }]);
});

test('the usage estimate follows the published prices: a 1-hour cache write at 2x the input price, and 1.1x every token only when the answer reports inference_geo "us"', async () => {
  // Claude Sonnet 5.5, per million tokens: $2 input, $2.50 (5-minute write), $4 (1-hour write), $0.10 (cache read), $10 output.
  const usage = { input_tokens: 1e6, output_tokens: 1e6, cache_creation_input_tokens: 2e6, cache_read_input_tokens: 1e6, cache_creation: { ephemeral_5m_input_tokens: 1e6, ephemeral_1h_input_tokens: 1e6 } };
  assert.equal(usageOf('claude-sonnet-5-5', usage, 1).estimatedUsd, 18.6);
  assert.equal(usageOf('claude-sonnet-5-5', { ...usage, inference_geo: 'global' }, 1).estimatedUsd, 18.6);
  assert.equal(usageOf('claude-sonnet-5-5', { ...usage, inference_geo: 'us' }, 1).estimatedUsd, 20.46);
  // Without the split every cache write is a 5-minute one, as the checker's own requests ask.
  const { cache_creation, ...unsplit } = usage;
  assert.equal(usageOf('claude-sonnet-5-5', unsplit, 1).estimatedUsd, 17.1);
  assert.equal(estimateUsd('claude-sonnet-5-5', { inputTokens: 1e6, outputTokens: 1e6, cacheCreationInputTokens: 2e6, cacheReadInputTokens: 1e6 }), 17.1);
  assert.equal(US_ONLY_FACTOR, 1.1);
  // Through a request: an answer served in the US costs 10% more than the same answer served globally.
  const { pairs, course } = one(), valid = JSON.stringify({ judgements: pairs.map(judgement) }), seen = [];
  for (const geo of ['global', 'us']) await requestAnthropic(pairs, { env, transport: fake(() => message(valid, { usage: { ...USAGE, inference_geo: geo } })).transport, course, onUsage: u => seen.push(u.estimatedUsd) });
  assert.deepEqual(seen, [PER_CALL_USD, Math.round(PER_CALL_USD * 1.1 * 1e8) / 1e8]);
});

test('a spend limit or an exhausted credit balance is provider_budget: never asked again, it stops the check and holds further requests like an access refusal', async () => {
  const { pairs, course } = one();
  const budget = (status, type, text, details) => json({ type: 'error', error: { type, message: text, ...(details ? { details } : {}) }, request_id: 'req_offline' }, status);
  const refusals = [
    [400, 'invalid_request_error', 'You have reached your specified API usage limits. You will regain access on 2026-11-01 at 00:00 UTC.'],
    [400, 'invalid_request_error', 'You have reached your specified workspace API usage limits. You will regain access on 2026-11-01 at 00:00 UTC.'],
    [400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'],
    [429, 'rate_limit_error', 'This request would exceed the monthly spend limit of your usage tier.', { error_code: 'enforced_spend_limit_reached' }],
  ];
  for (const [status, type, text, details] of refusals) {
    const { transport, calls } = fake(() => budget(status, type, text, details)), { waits, sleep } = sleeper();
    const error = await failureOf(requestAnthropic(pairs, { env, transport, course, sleep }));
    assert.deepEqual([calls.length, waits, error.kind, error.status], [1, [], 'provider_budget', status], text);
    assert.deepEqual(classifyFailure(error), { kind: 'provider_budget', httpStatus: status, retryable: false });
    assert.equal(gemini.errorClassOf(classifyFailure(error).kind), 'access');
  }
  // Other refusals keep their kinds: an ordinary 400 is rejected, an ordinary 429 is a rate limit that is retried.
  const plain = fake(() => budget(400, 'invalid_request_error', 'messages: field required'));
  assert.equal(classifyFailure(await failureOf(requestAnthropic(pairs, { env, transport: plain.transport, course }))).kind, 'provider_rejected');
  const limited = fake((request, n) => (n === 1 ? budget(429, 'rate_limit_error', 'Number of request tokens has exceeded your per-minute rate limit') : message(JSON.stringify({ judgements: pairs.map(judgement) }))));
  assert.equal((await requestAnthropic(pairs, { env, transport: limited.transport, course, sleep: sleeper().sleep })).length, 1);
  assert.equal(limited.calls.length, 2);
  // A whole check: the first refusal stops it, and the next check sends nothing during the cooldown.
  const { content, masters } = sample();
  const { transport, calls } = fake(() => budget(...refusals[2]));
  const first = await align(content, masters, { env, transport });
  assert.deepEqual([first.status, first.failure.kind, first.failure.retryable], ['not_evaluated', 'provider_budget', false]);
  assert.ok(blockedNow());
  const sent = calls.length;
  assert.ok(sent >= 1 && sent <= 3, 'only the calls already in flight were sent');
  const second = await align(content, masters, { env, transport });
  assert.equal(calls.length, sent, 'nothing is sent during the cooldown');
  assert.match(second.reason, /refused a request a moment ago \(HTTP 400/);
});

test('the reuse fingerprint carries the thinking mode and the effort: a verdict is reused only under the same configuration, and the reported model stays the plain id', async () => {
  const { content, masters } = sample();
  const keysOf = async settings => { const result = await align(content, masters, { env: settings, transport: answering().transport }); return { result, keys: result.judgements.map(j => j.key) }; };
  const base = await keysOf(env);
  const same = await keysOf({ ...env, ANTHROPIC_EFFORT: 'high', ANTHROPIC_THINKING: 'adaptive' }); // the defaults stated: the same configuration
  const lower = await keysOf({ ...env, ANTHROPIC_EFFORT: 'low' });
  const off = await keysOf({ ...env, ANTHROPIC_THINKING: 'off' });
  assert.deepEqual(same.keys, base.keys);
  for (const other of [lower, off]) assert.ok(other.keys.every((key, i) => key !== base.keys[i]));
  assert.notDeepEqual(lower.keys, off.keys);
  assert.deepEqual([lower.result.model, off.result.model], [MODEL, MODEL]);
  const reuse = new Map(base.result.judgements.map(j => [j.key, j]));
  const again = answering(), changed = answering();
  const reused = await align(content, masters, { env, transport: again.transport, reuse });
  const notReused = await align(content, masters, { env: { ...env, ANTHROPIC_EFFORT: 'low' }, transport: changed.transport, reuse });
  assert.deepEqual([reused.reuse.reused, again.calls.length], [100, 0]);
  assert.deepEqual([notReused.reuse.reused, changed.calls.length], [0, 9]);
});
