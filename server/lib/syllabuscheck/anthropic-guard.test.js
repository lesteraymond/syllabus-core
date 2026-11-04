'use strict';
// The provider guard's Anthropic mode (eval/providerGuard.js, Stage S6), offline: every fetch here is a fake or the Anthropic replay
// (eval/anthropicReplay.js), and the global fetch is blocked. The worst case is reserved before a request is sent and settled at its tokens and the
// pinned prices; the request, dollar, output-token and spend-register caps stop a run before anything more is sent; the ledger carries over and never
// mixes providers or models; a spend limit stops at once; rate limits, server errors and timeouts count; the key reaches no file or log; and a refusal
// passes through the official SDK unchanged.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createGuard, closeLedger, openSpendRegister, claudePrices, claudePriceTable, claudeWorstCaseOf, claudeChargeOf, describeClaudePrices, describeClaudeUsage, ANTHROPIC_MESSAGES, OPENROUTER_CHAT, CLAUDE_ALLOWANCE, GEO_FACTOR, CACHE_READ_FLOOR } = require('./eval/providerGuard');
const gemini = require('./gemini');
const { sample } = require('./fixtures');
const { createOracle, runWithOracle, DEFAULT_ENV } = require('./eval/phase3/oracle');
const { variant, loadManifest } = require('./eval/phase3/fixtures');
const { createAnthropicReplay, THINKING_TOKENS } = require('./eval/anthropicReplay');
const { estimateUsd } = require('./anthropicClient');

const MODEL = 'claude-sonnet-5-5', KEY = 'sk-ant-api03-test-only-0123456789abcdef';
const CLAUDE_ENV = { SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: KEY, ANTHROPIC_MODEL: MODEL };
const blocked = globalThis.fetch;
test.before(() => { globalThis.fetch = () => { throw Error('the network is blocked in the guard tests'); }; });
test.after(() => { globalThis.fetch = blocked; gemini.resetProviderBlock(); });
test.afterEach(() => gemini.resetProviderBlock());

const SCHEMA = { type: 'object', properties: { judgements: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false } } }, required: ['judgements'], additionalProperties: false };
// A Messages request as anthropicClient.js makes it, small enough that its worst case is easy to state.
const request = (ids = ['p1'], { maxTokens = 1000, model = MODEL, ttl, stream } = {}) => ({ method: 'POST', headers: { 'x-api-key': KEY }, body: JSON.stringify({ model, max_tokens: maxTokens, thinking: { type: 'adaptive' },
  system: [{ type: 'text', text: 'test', cache_control: { type: 'ephemeral', ...(ttl ? { ttl } : {}) } }], messages: [{ role: 'user', content: JSON.stringify({ course: null, document_data: ids.map(id => ({ id })) }) }],
  output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } }, ...(stream ? { stream } : {}) }) });
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test_1', ...headers } });
const USAGE = { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, inference_geo: 'global', output_tokens_details: { thinking_tokens: 120 } };
const answer = (text = '{"judgements":[]}', usage = USAGE, extra = {}) => json(200, { id: 'msg_test', type: 'message', role: 'assistant', model: MODEL,
  content: [{ type: 'thinking', thinking: 'SECRET THINKING TEXT', signature: 'sig' }, { type: 'text', text }], stop_reason: 'end_turn', stop_sequence: null, ...(usage ? { usage } : {}), ...extra });
const failure = (status, type, message, details, headers) => json(status, { type: 'error', error: { type, message, ...(details ? { details } : {}) }, request_id: 'req_failed' }, headers);
function fakeFetch(reply = () => answer()) {
  const calls = [];
  return { calls, send: async (url, init) => { calls.push({ url, init }); return reply(calls.length, url, init); } };
}
const guardOf = (send, options = {}) => createGuard({ provider: 'anthropic', model: MODEL, fetch: send, maxRequests: 10, maxCost: 1, secrets: [KEY], ...options });
const PRICES = claudePrices(MODEL), worstOf = body => claudeWorstCaseOf(body, PRICES).dollars;
const close = (got, want, label) => assert.ok(Math.abs(got - want) < 1e-8, `${label}: ${got} is not ${want}`); // charges are kept to 1e-8 dollars
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'anthropic-guard-'));
const timeoutError = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });

test('the pinned prices: Sonnet 5.5 at $2 input and $10 output, its cache read published at $0.10 and charged by the guard at 0.1x input, cache writes at 1.25x and 2x', () => {
  assert.deepEqual([PRICES.asOf, PRICES.geoFactor, GEO_FACTOR, CACHE_READ_FLOOR], ['2026-10-27', 1.1, 1.1, 0.1]);
  // Per million tokens, as Anthropic's pricing page published them on 2026-10-27 (the cache read 0.05x the input price), and the guard's cache read.
  for (const [key, want] of [['input', 2], ['output', 10], ['listedCacheRead', 0.1], ['cacheRead', 0.2], ['cacheWrite5m', 2.5], ['cacheWrite1h', 4]]) close(PRICES[key] * 1e6, want, key);
  assert.equal(PRICES.longPrompt, undefined, 'no higher tier for Sonnet 5.5');
  // What an evaluation prints: the published prices first, then where the guard's count differs. A model whose published cache read is already 0.1x
  // input (Claude Haiku 5.5) has no margin to name.
  const printed = describeClaudePrices(claudePriceTable(PRICES));
  assert.match(printed, /^Published prices \(Anthropic's pricing page, pinned in anthropicClient\.js as of 2026-10-27, per million tokens\): input \$2, output \$10 \(thinking is output\), cache read \$0\.1, cache write \$2\.5 \(5 min\) \/ \$4 \(1 h\); x1\.1 only when an answer reports inference_geo "us"\. /);
  assert.match(printed, /The guard counts the same tokens against its caps with a cache read at \$0\.2 \(no less than 0\.1x input, a margin above the published price\), x1\.1 unless an answer reports inference_geo "global", and reserves each request's worst case before it is sent: its own accounting, never Anthropic's invoice\.$/);
  assert.match(describeClaudePrices(claudePriceTable(claudePrices('claude-haiku-5-5'))), /cache read \$0\.01,.*The guard counts the same tokens against its caps, x1\.1 unless/);
  const haiku = claudePrices('claude-haiku-5-5');
  assert.equal(haiku.longPrompt.over, 100000);
  close(haiku.longPrompt.input * 1e6, 0.5, 'Haiku 5.5 input above 100,000 tokens'); close(haiku.longPrompt.output * 1e6, 2.5, 'Haiku 5.5 output above 100,000 tokens');
  assert.equal(claudePrices('claude-unknown-9'), null);
});

test('the worst case is every byte of the body, the schema once more and 2,048 tokens at the cache-write price, plus max_tokens at the output price, times 1.1', () => {
  const body = request().body, bound = Buffer.byteLength(body) + Buffer.byteLength(JSON.stringify(SCHEMA)) + CLAUDE_ALLOWANCE;
  const worst = claudeWorstCaseOf(body, PRICES);
  assert.deepEqual([worst.inputTokens, worst.outputTokens], [bound, 1000]);
  close(worst.dollars, (bound * 2.5e-6 + 1000 * 1e-5) * 1.1, '5-minute cache');
  const hour = request(['p1'], { ttl: '1h' }).body;
  close(claudeWorstCaseOf(hour, PRICES).dollars, ((Buffer.byteLength(hour) + Buffer.byteLength(JSON.stringify(SCHEMA)) + CLAUDE_ALLOWANCE) * 4e-6 + 1000 * 1e-5) * 1.1, '1-hour cache');
  // A bound above Haiku 5.5's 100,000 tokens takes its higher tier.
  const haiku = claudePrices('claude-haiku-5-5'), big = JSON.stringify({ ...JSON.parse(request().body), model: 'claude-haiku-5-5', messages: [{ role: 'user', content: 'x'.repeat(100001) }] });
  const bigWorst = claudeWorstCaseOf(big, haiku);
  close(bigWorst.dollars, (bigWorst.inputTokens * 0.5e-6 * 1.25 + 1000 * 2.5e-6) * 1.1, 'the higher tier');
  // The production request: 16,000 max_tokens, so about $0.18 of output before the input.
  assert.ok(claudeWorstCaseOf(request(['p1'], { maxTokens: 16000 }).body, PRICES).dollars > 16000 * 1e-5 * 1.1);
});

test('the worst case is reserved before a request is sent, held while it is in flight, and settled at its tokens at the pinned prices', async () => {
  const w = worstOf(request().body), pending = [];
  const { send, calls } = fakeFetch(() => new Promise(resolve => pending.push(resolve)));
  const guard = guardOf(send, { maxCost: 2.5 * w });
  const first = guard.fetch(ANTHROPIC_MESSAGES, request()), second = guard.fetch(ANTHROPIC_MESSAGES, request());
  await new Promise(resolve => setImmediate(resolve));
  close(guard.state.reserved, 2 * w, 'two reservations in flight');
  assert.equal(guard.state.reservedOutput, 2000);
  await assert.rejects(guard.fetch(ANTHROPIC_MESSAGES, request()), error => error.refused && /cost cap: \$0 already charged/.test(error.message), 'a third would pass the cap with the two in flight');
  assert.equal(calls.length, 2);
  // Settled: 1,000 input, 200 written to the 5-minute cache, 300 read from it, 500 output (120 thinking), served in the "global" geography.
  pending[0](answer('{"judgements":[]}', { ...USAGE, cache_creation_input_tokens: 200, cache_read_input_tokens: 300, cache_creation: { ephemeral_5m_input_tokens: 200, ephemeral_1h_input_tokens: 0 } }));
  pending[1](answer('{"judgements":[]}', null));
  await Promise.all([first, second]);
  close(guard.state.reserved, 0, 'nothing reserved once both are settled');
  const [settled, unknown] = guard.httpLog;
  close(settled.charged, 1000 * 2e-6 + 200 * 2.5e-6 + 300 * 2e-7 + 500 * 1e-5, 'reconciled at the guard\'s prices: the cache read at $0.20');
  close(settled.usage.estimatedCost, 1000 * 2e-6 + 200 * 2.5e-6 + 300 * 1e-7 + 500 * 1e-5, 'the estimate at the published prices: the cache read at $0.10');
  close(settled.usage.costAtListPrices, settled.usage.estimatedCost, '"global": the published price has no data-residency factor');
  close(settled.conservativeCharge, (1500 * 2.5e-6 + 500 * 1e-5) * 1.1, 'the conservative rule: every prompt token at the cache-write price, times 1.1');
  assert.deepEqual([settled.accounting, settled.usage.promptTokens, settled.usage.cachedTokens, settled.usage.thinkingTokens, settled.usage.reportedCost], ['reconciled', 1500, 300, 120, null]);
  assert.deepEqual([unknown.accounting, unknown.charged, unknown.usage], ['worst_case', unknown.worst, undefined], 'an answer without usage is charged its worst case, and has no estimate');
  assert.equal(guard.ledger.outputTokens, 500 + 1000, 'output tokens: those reported, or max_tokens when unknown');
  // The geography: the guard charges 1.1x for anything but a reported "global"; the published price is 1.1x only for a reported "us". 1-hour cache
  // writes cost 2x the input price either way.
  for (const [usage, want, estimate, label] of [
    [{ ...USAGE, inference_geo: 'us' }, (1000 * 2e-6 + 500 * 1e-5) * 1.1, (1000 * 2e-6 + 500 * 1e-5) * 1.1, 'inference_geo us'],
    [{ ...USAGE, inference_geo: undefined }, (1000 * 2e-6 + 500 * 1e-5) * 1.1, 1000 * 2e-6 + 500 * 1e-5, 'no geography reported'],
    [{ ...USAGE, cache_creation_input_tokens: 200, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 200 } }, 1000 * 2e-6 + 200 * 4e-6 + 500 * 1e-5, 1000 * 2e-6 + 200 * 4e-6 + 500 * 1e-5, '1-hour cache write'],
  ]) {
    const g = guardOf(fakeFetch(() => answer('{}', usage)).send);
    await g.fetch(ANTHROPIC_MESSAGES, request());
    close(g.httpLog[0].charged, want, label);
    close(g.httpLog[0].usage.estimatedCost, estimate, `${label}: the estimate`);
  }
  // accounting 'conservative' charges the conservative rule.
  const conservative = guardOf(fakeFetch().send, { accounting: 'conservative' });
  await conservative.fetch(ANTHROPIC_MESSAGES, request());
  assert.deepEqual([conservative.httpLog[0].accounting, conservative.httpLog[0].charged], ['conservative', conservative.httpLog[0].conservativeCharge]);
});

test('the run stops at its request, dollar and output-token caps before anything more is sent', async () => {
  const w = worstOf(request().body);
  const noUsage = fakeFetch(() => answer('{}', null)), capped = guardOf(noUsage.send, { maxCost: 2.5 * w });
  await capped.fetch(ANTHROPIC_MESSAGES, request());
  await capped.fetch(ANTHROPIC_MESSAGES, request());
  await assert.rejects(capped.fetch(ANTHROPIC_MESSAGES, request()), error => error.refused && /cost cap/.test(error.message));
  assert.equal(noUsage.calls.length, 2);
  assert.ok(capped.ledger.charged <= 2.5 * w);
  // max_tokens 1,000 against a cap of 2,500 output tokens, each answer using 400: four fit, the fifth would not.
  const tokens = fakeFetch(() => answer('{}', { ...USAGE, output_tokens: 400 })), outputCapped = guardOf(tokens.send, { maxOutputTokens: 2500 });
  for (let i = 0; i < 4; i++) await outputCapped.fetch(ANTHROPIC_MESSAGES, request());
  await assert.rejects(outputCapped.fetch(ANTHROPIC_MESSAGES, request()), error => error.refused && /output-token cap: 1600 output tokens already charged \+ max_tokens 1000 of the next request > 2500/.test(error.message));
  assert.equal(tokens.calls.length, 4);
  assert.equal(outputCapped.summary().anthropic.outputTokensCharged, 1600);
  // The request cap counts every request, retries included.
  const counted = fakeFetch(), few = guardOf(counted.send, { maxRequests: 2 });
  await few.fetch(ANTHROPIC_MESSAGES, request());
  await few.fetch(ANTHROPIC_MESSAGES, request());
  await assert.rejects(few.fetch(ANTHROPIC_MESSAGES, request()), error => error.refused && /request cap reached \(2 provider requests\)/.test(error.message));
  assert.equal(counted.calls.length, 2);
});

test('a spend limit or an exhausted credit balance stops the run at once, is charged nothing and is not counted as transient', async () => {
  for (const [status, type, text, details] of [
    [400, 'invalid_request_error', 'You have reached your specified API usage limits. You will regain access on 2026-11-01 at 00:00 UTC.'],
    [400, 'invalid_request_error', 'You have reached your specified workspace API usage limits. You will regain access on 2026-11-01 at 00:00 UTC.'],
    [400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'],
    [429, 'rate_limit_error', 'This request would exceed the monthly spend limit of your usage tier.', { error_code: 'enforced_spend_limit_reached' }],
  ]) {
    const { send, calls } = fakeFetch(() => failure(status, type, text, details));
    const guard = guardOf(send);
    assert.equal((await guard.fetch(ANTHROPIC_MESSAGES, request())).status, status, 'the answer reaches the adapter, which reports provider_budget');
    assert.match(guard.stopped(), /a spend limit or an exhausted credit balance/, text);
    assert.deepEqual([guard.ledger.charged, guard.httpLog[0].accounting, guard.state.transient, guard.httpLog[0].errorType], [0, 'refused', 0, type], text);
    await assert.rejects(guard.fetch(ANTHROPIC_MESSAGES, request()), error => error.refused);
    assert.equal(calls.length, 1, `${text}: nothing more is sent`);
  }
  // The other refusals stop too, and are charged nothing: the key or access (401, 402, 403) and the request itself (400, 404, 413).
  for (const [status, pattern] of [[401, /HTTP 401 \(credits, key or access\)/], [402, /HTTP 402/], [403, /HTTP 403/], [400, /HTTP 400: the provider refused the request format/], [404, /HTTP 404: the provider refused/], [413, /HTTP 413: the provider refused/]]) {
    const { send, calls } = fakeFetch(() => failure(status, 'invalid_request_error', 'Schema is too complex for compilation'));
    const guard = guardOf(send);
    await guard.fetch(ANTHROPIC_MESSAGES, request());
    assert.match(guard.stopped(), pattern);
    assert.deepEqual([guard.ledger.charged, guard.state.transient], [0, 0], `HTTP ${status}`);
    await assert.rejects(guard.fetch(ANTHROPIC_MESSAGES, request()), error => error.refused);
    assert.equal(calls.length, 1);
  }
});

test('rate limits, server errors, timeouts and dropped connections count toward maxTransient; all but a rate limit are charged their worst case', async () => {
  const w = worstOf(request().body);
  const replies = [failure(429, 'rate_limit_error', 'rate limited', null, { 'retry-after': '2' }), failure(529, 'overloaded_error', 'Overloaded'), failure(500, 'api_error', 'Internal server error')];
  const busy = fakeFetch(n => replies[n - 1]), guard = guardOf(busy.send, { maxTransient: 3, maxCost: 5 });
  for (let i = 0; i < 3; i++) await guard.fetch(ANTHROPIC_MESSAGES, request());
  assert.match(guard.stopped(), /3 rate limit\(s\), timeout\(s\), network or server error\(s\) \(the last: HTTP 500\)/);
  assert.deepEqual(guard.httpLog.map(e => [e.status, e.accounting]), [[429, 'refused'], [529, 'worst_case'], [500, 'worst_case']]);
  close(guard.ledger.charged, 2 * w, 'a server error may have been billed');
  assert.deepEqual(guard.httpLog[0].headers, { 'request-id': 'req_test_1', 'retry-after': '2' }, 'the request id and the wait asked for are kept');
  // A timeout (the adapter's deadline: TimeoutError, or AbortError through the SDK), a 504 and a dropped connection.
  for (const [label, reply, error] of [['TimeoutError', () => { throw timeoutError(); }, 'timeout'], ['AbortError', () => { throw Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }); }, 'timeout'], ['dropped', () => { throw new TypeError('fetch failed'); }, 'network: fetch failed']]) {
    const g = guardOf(fakeFetch(reply).send, { maxTransient: 2 });
    await assert.rejects(g.fetch(ANTHROPIC_MESSAGES, request()), thrown => thrown.name === (label === 'dropped' ? 'TypeError' : label) && !thrown.refused);
    assert.deepEqual([g.httpLog[0].error, g.httpLog[0].accounting, g.state.transient, g.ledger.outputTokens], [error, 'worst_case', 1, 1000], label);
    close(g.ledger.charged, w, `${label}: charged its worst case`);
  }
  const gateway = guardOf(fakeFetch(() => failure(504, 'timeout_error', 'Request timed out')).send);
  await gateway.fetch(ANTHROPIC_MESSAGES, request());
  assert.deepEqual([gateway.httpLog[0].accounting, gateway.state.transient], ['worst_case', 1], 'HTTP 504: the API\'s own timeout may have been billed');
  // An answer cut off while it is read: a timeout like one that never came, charged its worst case, and thrown with its name.
  const cutOff = () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"id":"msg_test","content":[')); controller.error(timeoutError()); } }), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_cut' } });
  const read = guardOf(fakeFetch(cutOff).send);
  await assert.rejects(read.fetch(ANTHROPIC_MESSAGES, request()), thrown => thrown.name === 'TimeoutError');
  assert.deepEqual([read.httpLog[0].status, read.httpLog[0].error, read.httpLog[0].accounting, read.httpLog[0].requestId, read.state.transient], [200, 'timeout', 'worst_case', 'req_cut', 1]);
});

test('only a POST to the Messages API for the guarded model, with max_tokens and without streaming, is sent', async () => {
  for (const [url, init, why] of [
    [OPENROUTER_CHAT, request(), /unexpected address/], ['https://api.anthropic.com/v1/models', request(), /unexpected address/], [`${ANTHROPIC_MESSAGES}?beta=true`, request(), /unexpected address/],
    ['https://api.anthropic.com/v1/messages/batches', request(), /unexpected address/], ['https://api.anthropic.com/v1/messages/count_tokens', request(), /unexpected address/],
    ['http://api.anthropic.com/v1/messages', request(), /unexpected address/], [ANTHROPIC_MESSAGES, { ...request(), method: 'GET' }, /unexpected address was refused \(GET/],
    [ANTHROPIC_MESSAGES, request(['p1'], { model: 'claude-opus-5-5' }), /another model \(claude-opus-5-5\)/], [ANTHROPIC_MESSAGES, request(['p1'], { stream: true }), /streaming request/],
    [ANTHROPIC_MESSAGES, { method: 'POST', body: JSON.stringify({ model: MODEL, messages: [] }) }, /no max_tokens/], [ANTHROPIC_MESSAGES, { method: 'POST', body: 'not json' }, /not JSON/],
  ]) {
    const { send, calls } = fakeFetch(), guard = guardOf(send);
    await assert.rejects(guard.fetch(url, init), error => error.refused && why.test(error.message), String(why));
    assert.deepEqual([calls.length, guard.ledger.requests], [0, 0], String(why));
  }
  // The OpenRouter mode refuses Anthropic's address as before.
  const router = createGuard({ fetch: fakeFetch().send, maxRequests: 2, maxCost: 1 });
  router.setPrices({ prompt: 3e-7, completion: 1.2e-6, reasoning: 0, request: 0, cacheWrite: 0 });
  await assert.rejects(router.fetch(ANTHROPIC_MESSAGES, request()), error => error.refused && /unexpected address/.test(error.message));
});

test('a token count above its bound, or an answer served at a service tier or in a geography without a pinned price, stops the run', async () => {
  const bound = claudeWorstCaseOf(request().body, PRICES).inputTokens;
  for (const [usage, why] of [
    [{ ...USAGE, input_tokens: bound + 1 }, /used more tokens than its bound/], [{ ...USAGE, output_tokens: 1001 }, /used more tokens than its bound/],
    [{ ...USAGE, service_tier: 'priority' }, /service tier priority/], [{ ...USAGE, inference_geo: 'eu' }, /inference geography eu/],
  ]) {
    const guard = guardOf(fakeFetch(() => answer('{}', usage)).send);
    await guard.fetch(ANTHROPIC_MESSAGES, request());
    assert.match(guard.stopped(), why);
  }
  const standard = guardOf(fakeFetch(() => answer('{}', { ...USAGE, service_tier: 'standard', inference_geo: 'us' })).send);
  await standard.fetch(ANTHROPIC_MESSAGES, request());
  assert.equal(standard.stopped(), null);
});

test('the ledger carries the requests, dollars and output tokens into the next invocation, and never mixes providers or models', async () => {
  const dir = tempDir(), file = path.join(dir, 'claude.json');
  try {
    const first = guardOf(fakeFetch().send, { ledgerFile: file });
    await first.fetch(ANTHROPIC_MESSAGES, request(['a', 'b']));
    await first.fetch(ANTHROPIC_MESSAGES, request(['c']));
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual([saved.provider, saved.model, saved.pricesAsOf, saved.requests, saved.outputTokens], ['anthropic', MODEL, '2026-10-27', 2, 1000]);
    assert.deepEqual(saved.entries.map(e => [e.ids, e.requestId, e.stopReason, e.accounting, e.tokens.output, e.tokens.thinking, e.tokens.inferenceGeo]), [[['a', 'b'], 'req_test_1', 'end_turn', 'reconciled', 500, 120, 'global'], [['c'], 'req_test_1', 'end_turn', 'reconciled', 500, 120, 'global']]);
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(!text.includes('SECRET THINKING TEXT') && !text.includes('"content"'), 'the ledger keeps neither the thinking nor the answer');
    const next = guardOf(fakeFetch().send, { ledgerFile: file, maxRequests: 3 });
    assert.deepEqual([next.ledger.requests, next.ledger.outputTokens], [2, 1000]);
    close(next.ledger.charged, saved.charged, 'the dollars carry over');
    await next.fetch(ANTHROPIC_MESSAGES, request());
    await assert.rejects(next.fetch(ANTHROPIC_MESSAGES, request()), error => error.refused && /request cap reached \(3/.test(error.message));
    // Another provider or model never continues it.
    assert.throws(() => createGuard({ fetch: fakeFetch().send, maxRequests: 9, maxCost: 1, ledgerFile: file }), /holds anthropic\/claude-sonnet-5-5 requests, not openrouter ones/);
    assert.throws(() => guardOf(fakeFetch().send, { ledgerFile: file, model: 'claude-opus-5-5' }), /holds anthropic\/claude-sonnet-5-5 requests, not anthropic\/claude-opus-5-5 ones/);
    const router = path.join(dir, 'router.json');
    fs.writeFileSync(router, JSON.stringify({ requests: 3, charged: 0.01, entries: [{ n: 1, kind: 'model' }] }));
    assert.throws(() => guardOf(fakeFetch().send, { ledgerFile: router }), /holds openrouter requests, not anthropic\/claude-sonnet-5-5 ones/);
    // A later ledger follows a closed one only of its own provider and model, and keeps its final counts.
    closeLedger(file, { reason: 'offline test' });
    const linked = guardOf(fakeFetch().send, { ledgerFile: path.join(dir, 'linked.json'), previousLedger: file });
    assert.deepEqual([linked.ledger.previous.provider, linked.ledger.previous.model, linked.ledger.previous.requests, linked.ledger.previous.outputTokens], ['anthropic', MODEL, 3, 1500]);
    assert.throws(() => createGuard({ fetch: fakeFetch().send, maxRequests: 9, maxCost: 1, ledgerFile: path.join(dir, 'router-next.json'), previousLedger: file }), /a ledger follows only one of its own provider and model/);
    closeLedger(router, { reason: 'offline test' });
    assert.throws(() => guardOf(fakeFetch().send, { ledgerFile: path.join(dir, 'claude-next.json'), previousLedger: router }), /holds openrouter requests, not anthropic/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the spend register caps what every Claude ledger charged together, and its lock keeps a second evaluation out', async () => {
  const dir = tempDir(), file = path.join(dir, 'spend-register.json'), w = worstOf(request().body);
  try {
    const register = openSpendRegister(file, { cap: 2.5 * w });
    assert.ok(fs.existsSync(`${file}.lock`));
    assert.throws(() => openSpendRegister(file, { cap: 2.5 * w }), /is held by another evaluation .*delete .*spend-register\.json\.lock/);
    const first = guardOf(fakeFetch(() => answer('{}', null)).send, { ledgerFile: path.join(dir, 'p1.json'), register, maxCost: 5 });
    await first.fetch(ANTHROPIC_MESSAGES, request());
    let saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    close(saved.ledgers['p1.json'].charged, w, 'the register keeps what the ledger charged');
    assert.deepEqual([saved.cap, saved.ledgers['p1.json'].requests, saved.ledgers['p1.json'].model], [2.5 * w, 1, MODEL]);
    first.release();
    assert.ok(!fs.existsSync(`${file}.lock`), 'release frees the lock');
    // A second evaluation, with its own ledger: the first one's dollars count against the total.
    const again = openSpendRegister(file, { cap: 10 });
    assert.equal(again.cap, 2.5 * w, 'the register\'s cap is set once: a higher cap does not raise it');
    const second = guardOf(fakeFetch(() => answer('{}', null)).send, { ledgerFile: path.join(dir, 'p2.json'), register: again, maxCost: 5 });
    await second.fetch(ANTHROPIC_MESSAGES, request());
    await assert.rejects(second.fetch(ANTHROPIC_MESSAGES, request()), error => error.refused && /total cap: .* already charged by every Claude ledger of the spend register/.test(error.message));
    assert.equal(second.summary().anthropic.limits.register.cap, 2.5 * w);
    close(second.summary().anthropic.limits.register.chargedByEveryLedger, 2 * w, 'both ledgers');
    second.release();
    saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    close(saved.total, 2 * w, 'the total of every ledger');
    // A lower cap applies to that evaluation only; a file that is not a register is refused and its lock freed.
    const lower = openSpendRegister(file, { cap: w });
    assert.deepEqual([lower.cap, lower.registeredCap], [w, 2.5 * w]);
    lower.release();
    fs.writeFileSync(path.join(dir, 'other.json'), JSON.stringify({ ledgers: [] }));
    assert.throws(() => openSpendRegister(path.join(dir, 'other.json'), { cap: 1 }), /is not a spend register/);
    assert.ok(!fs.existsSync(path.join(dir, 'other.json.lock')));
    assert.throws(() => openSpendRegister(file, { cap: 0 }), /positive number of dollars/);
    // The register needs a ledger to record under, and belongs to the Anthropic mode.
    const held = openSpendRegister(file, { cap: 1 });
    assert.throws(() => guardOf(fakeFetch().send, { register: held }), /needs a ledger file/);
    assert.throws(() => createGuard({ fetch: fakeFetch().send, maxRequests: 1, maxCost: 1, ledgerFile: path.join(dir, 'r.json'), register: held }), /belong to the Anthropic mode/);
    held.release();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the API key never reaches a thrown error, the request log, the ledger, the register, the summary or the console', async () => {
  const dir = tempDir(), logged = [];
  try {
    const register = openSpendRegister(path.join(dir, 'register.json'), { cap: 5 });
    const replies = [
      () => failure(529, 'overloaded_error', `overloaded while serving ${KEY}`, null, { 'request-id': `req_${KEY}` }),
      () => { throw new Error(`connect ECONNREFUSED while sending ${KEY}`); },
    ];
    const guard = guardOf(fakeFetch(n => replies[n - 1]()).send, { maxTransient: 2, ledgerFile: path.join(dir, 'ledger.json'), register, log: line => logged.push(line) });
    await guard.fetch(ANTHROPIC_MESSAGES, request());
    await assert.rejects(guard.fetch(ANTHROPIC_MESSAGES, request()), error => !error.message.includes(KEY) && error.message.includes('[redacted]'));
    const everything = [JSON.stringify(guard.httpLog), JSON.stringify(guard.summary()), fs.readFileSync(path.join(dir, 'ledger.json'), 'utf8'), fs.readFileSync(path.join(dir, 'register.json'), 'utf8'), logged.join('\n'), guard.stopped()].join('\n');
    assert.ok(everything.length > 200 && !everything.includes(KEY));
    assert.ok(!/x-api-key|Authorization/i.test(JSON.stringify(guard.httpLog)), 'request headers are never kept');
    guard.release();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the Anthropic mode takes no OpenRouter price, key check or prices set by hand, and the OpenRouter mode takes none of its options', async () => {
  const guard = guardOf(fakeFetch().send);
  await assert.rejects(guard.readPrices(MODEL, KEY), /pinned in anthropicClient\.js/);
  await assert.rejects(guard.checkKey(KEY), /no key check/);
  assert.throws(() => guard.setPrices({ prompt: 0 }), /pinned in anthropicClient\.js/);
  assert.throws(() => createGuard({ provider: 'anthropic', model: 'claude-unknown-9', fetch: fakeFetch().send, maxRequests: 1, maxCost: 1 }), /pinned prices/);
  assert.throws(() => createGuard({ provider: 'gemini', fetch: fakeFetch().send, maxRequests: 1, maxCost: 1 }), /provider must be openrouter or anthropic/);
  for (const option of [{ model: MODEL }, { maxOutputTokens: 1000 }]) assert.throws(() => createGuard({ fetch: fakeFetch().send, maxRequests: 1, maxCost: 1, ...option }), /belong to the Anthropic mode/);
  assert.throws(() => guardOf(fakeFetch().send, { maxOutputTokens: 0 }), /maxOutputTokens must be a positive integer/);
  // An OpenRouter ledger keeps its format: no provider, model or output tokens.
  const dir = tempDir(), file = path.join(dir, 'router.json');
  try {
    const router = createGuard({ fetch: fakeFetch(() => json(200, { id: 'gen', model: 'minimax/minimax-m3.1-flash', choices: [{ finish_reason: 'stop', message: { content: '{}' } }], usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.00001 } })).send, maxRequests: 2, maxCost: 1, ledgerFile: file });
    router.setPrices({ prompt: 3e-7, completion: 1.2e-6, reasoning: 0, request: 0, cacheWrite: 0 });
    await router.fetch(OPENROUTER_CHAT, { method: 'POST', body: JSON.stringify({ model: 'minimax/minimax-m3.1-flash', max_tokens: 100, messages: [{ role: 'system', content: 's' }, { role: 'user', content: '{}' }] }) });
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(Object.keys(saved), ['requests', 'charged', 'conservative', 'accounting', 'transient', 'invalid', 'unproductive', 'entries']);
    assert.deepEqual(Object.keys(saved.entries[0]), ['n', 'kind', 'at', 'status', 'worst', 'charged', 'accounting', 'conservativeCharge']);
    assert.equal('anthropic' in router.summary(), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the check hook reads an Anthropic answer: the user message, the text without any thinking, and how the answer ended', async () => {
  const seen = [];
  const guard = guardOf(fakeFetch(n => (n === 1 ? answer('{"judgements":[{"id":"a"}]}') : answer('{"judgements":[]}', USAGE, { stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'cyber' } }))).send, {
    maxUnproductive: 2,
    check: (sent, entry) => { seen.push([JSON.parse(sent.messages[0].content).document_data.map(p => p.id), entry.content, entry.stopReason]); return entry.stopReason === 'end_turn' ? null : { invalid: `incomplete_output: stop_reason ${entry.stopReason}`, verified: [] }; } });
  await guard.fetch(ANTHROPIC_MESSAGES, request(['a']));
  await guard.fetch(ANTHROPIC_MESSAGES, request(['b']));
  assert.deepEqual(seen, [[['a'], '{"judgements":[{"id":"a"}]}', 'end_turn'], [['b'], '{"judgements":[]}', 'refusal']]);
  assert.deepEqual(guard.httpLog.map(e => [e.verifiedIds, e.stopCategory]), [[['a'], undefined], [[], 'cyber']]);
  assert.equal(guard.state.unproductive, 1);
  assert.ok(!JSON.stringify(guard.httpLog).includes('SECRET THINKING TEXT'), 'no thinking is kept');
  const summary = guard.summary().anthropic;
  assert.deepEqual([summary.stopReasons, summary.refusalCategories, summary.thinkingTokens, summary.thinkingReports, summary.inferenceGeo], [{ end_turn: 1, refusal: 1 }, { cyber: 1 }, 240, { nonzero: 2, zero: 0, unavailable: 0 }, { global: 2 }]);
  assert.deepEqual([summary.prices.perMillionTokens.cacheRead, summary.prices.perMillionTokens.listedCacheRead], [0.2, 0.1]);
});

test('through the Anthropic adapter: the SDK sends every request of a whole check through the guard, which records each one and keeps no thinking', async () => {
  const manifest = loadManifest(), syllabus = variant('bsit', 'aligned', manifest), spec = manifest.variants['bsit-aligned'];
  const replay = createAnthropicReplay(createOracle({ variantSpec: spec }), { thinking: true });
  const guard = guardOf(replay.transport, { maxRequests: 200, maxCost: 30 });
  const { result } = await runWithOracle(structuredClone(syllabus), { transport: guard.fetch }, { env: { ...DEFAULT_ENV, ...CLAUDE_ENV }, evaluationOnly: true });
  assert.deepEqual([result.hybrid.alignment.status, result.score, result.passed, result.hybrid.alignment.evaluationOnly], ['completed', 100, true, true]);
  assert.equal(guard.httpLog.length, replay.calls.length);
  assert.ok(guard.httpLog.every((e, i) => e.status === 200 && e.requestId === `req_replay_${i + 1}` && e.stopReason === 'end_turn' && e.accounting === 'reconciled' && e.usage.thinkingTokens === THINKING_TOKENS));
  assert.deepEqual(guard.httpLog.map(e => e.ids), replay.calls.map(call => call.pairIds), 'the relationships of each request, from its user message');
  assert.ok(!JSON.stringify(guard.httpLog).includes('Replayed thinking block'), 'the thinking text is never kept');
  const n = replay.calls.length, summary = guard.summary().anthropic;
  assert.deepEqual([summary.thinkingTokens, summary.thinkingReports, summary.thinkingBlocks, summary.modelsReturned], [THINKING_TOKENS * n, { nonzero: n, zero: 0, unavailable: 0 }, n, { [MODEL]: n }]);
  assert.ok(guard.ledger.charged > 0 && guard.ledger.charged < guard.httpLog.reduce((sum, e) => sum + e.worst, 0));
  // Request by request, the guard's estimate at the published prices is the adapter's own (the replay reports no geography), and the whole is below
  // what the guard charged. The adapter's alignment usage counts the alignment's requests; the check's other questions are counted apart.
  for (const e of guard.httpLog) close(e.usage.estimatedCost, estimateUsd(MODEL, { inputTokens: e.usage.inputTokens, outputTokens: e.usage.completionTokens, cacheCreationInputTokens: e.usage.cacheCreationInputTokens, cacheReadInputTokens: e.usage.cacheReadInputTokens }), `request ${e.n}`);
  const adapter = result.hybrid.alignment.usage;
  assert.ok(adapter.requests > 0 && adapter.requests <= n);
  assert.deepEqual([adapter.thinkingTokens, adapter.thinkingReports], [THINKING_TOKENS * adapter.requests, { nonzero: adapter.requests, zero: 0, unavailable: 0 }]);
  assert.ok(summary.estimatedCost <= summary.chargedThisRun, `${summary.estimatedCost} > ${summary.chargedThisRun}`);
  assert.ok(Math.abs(summary.chargedThisRun - guard.ledger.charged) <= n * 1e-8, 'what this run charged is what the ledger holds');
});

test('the estimate at the published prices never exceeds what the guard charges, which never exceeds the worst case reserved: the caps are not loosened', () => {
  // Every combination of geography, cache reads and the cache-write duration, settled from the usage the answer reports.
  const body = request().body, worst = claudeWorstCaseOf(body, PRICES);
  let compared = 0;
  for (const geo of ['global', 'us', undefined]) {
    for (const read of [0, 300, 900]) {
      for (const hour of [false, true]) {
        const usage = { ...USAGE, inference_geo: geo, cache_creation_input_tokens: 200, cache_read_input_tokens: read, cache_creation: { ephemeral_5m_input_tokens: hour ? 0 : 200, ephemeral_1h_input_tokens: hour ? 200 : 0 } };
        const c = claudeChargeOf(usage, worst, PRICES, body), label = `${geo} read ${read} ${hour ? '1h' : '5m'}`;
        assert.ok(c.estimated <= c.charged + 1e-15, `${label}: ${c.estimated} > ${c.charged}`);
        assert.ok(c.charged <= worst.dollars && c.conservative <= worst.dollars, label);
        // The charge is what it was before the estimate was kept apart: the cache read at $0.20, and 1.1x unless "global".
        const writes = hour ? 200 * 4e-6 : 200 * 2.5e-6, base = 1000 * 2e-6 + writes + 500 * 1e-5;
        close(c.charged, (base + read * 2e-7) * (geo === 'global' ? 1 : 1.1), `${label}: the charge`);
        close(c.estimated, (base + read * 1e-7) * (geo === 'us' ? 1.1 : 1), `${label}: the estimate`);
        compared += 1;
      }
    }
  }
  assert.equal(compared, 18);
  // The worst case reserved before sending still takes the highest input-side price, the cache write: the published cache read lowers nothing.
  assert.equal(worst.inputRate, PRICES.cacheWrite5m);
  close(worst.dollars, (worst.inputTokens * 2.5e-6 + 1000 * 1e-5) * 1.1, 'the worst case');
});

test('the model that answered is kept exactly as Anthropic named it, in the entry, the ledger, the summary and the adapter\'s refusal; any other model stops the run', async () => {
  const dir = tempDir();
  try {
    // A dated snapshot of the guarded model is the same model: kept as named, and the run goes on.
    const dated = `${MODEL}-20261015`, file = path.join(dir, 'dated.json');
    const same = guardOf(fakeFetch(() => answer('{}', USAGE, { model: dated })).send, { ledgerFile: file });
    await same.fetch(ANTHROPIC_MESSAGES, request());
    await same.fetch(ANTHROPIC_MESSAGES, request());
    assert.equal(same.stopped(), null);
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual([saved.model, saved.modelsReturned, saved.entries.map(e => e.modelReturned)], [MODEL, { [dated]: 2 }, [dated, dated]]);
    assert.deepEqual(same.summary().anthropic.modelsReturned, { [dated]: 2 });
    // Another model, or a lookalike of the guarded one: recorded as named, and nothing more is sent.
    for (const other of ['claude-opus-5-5', `${MODEL}-preview`, `${MODEL}-2026101`, 'claude-sonnet-5']) {
      const sent = fakeFetch(() => answer('{}', USAGE, { model: other })), ledgerFile = path.join(dir, `${other}.json`), guard = guardOf(sent.send, { ledgerFile });
      await guard.fetch(ANTHROPIC_MESSAGES, request());
      assert.equal(guard.stopped(), `request 1 was answered by ${other}, not ${MODEL}: the pinned prices and this evaluation are for ${MODEL} only`);
      await assert.rejects(guard.fetch(ANTHROPIC_MESSAGES, request()), error => error.refused);
      assert.equal(sent.calls.length, 1, other);
      const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
      assert.deepEqual([ledger.modelsReturned, ledger.entries[0].modelReturned, ledger.entries[0].accounting], [{ [other]: 1 }, other, 'reconciled'], 'it was billed, so it is charged');
    }
    // Through the adapter and the SDK: the adapter refuses the answer and names the model; the guard has recorded it and stopped.
    const { content, masters } = sample(), pairs = gemini.pairsOf(content, masters).slice(0, 2);
    const replay = createAnthropicReplay(createOracle({}), { model: 'claude-opus-5-5' }), guard = guardOf(replay.transport);
    await assert.rejects(gemini.requestAnthropic(pairs, { env: CLAUDE_ENV, transport: guard.fetch }), error => error.message === 'Anthropic returned a different model; alignment not evaluated' && error.modelReturned === 'claude-opus-5-5');
    assert.deepEqual([replay.calls.length, guard.httpLog[0].modelReturned, guard.summary().anthropic.modelsReturned], [1, 'claude-opus-5-5', { 'claude-opus-5-5': 1 }]);
    assert.match(guard.stopped(), /answered by claude-opus-5-5, not claude-sonnet-5-5/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('thinking tokens: a reported count is kept, zero included; a missing one is null and counted as unavailable, never as zero; output billing is unchanged', async () => {
  const dir = tempDir(), file = path.join(dir, 'thinking.json');
  try {
    // 120 thinking tokens reported; an explicit 0 (and no thinking block); no count at all; an empty details object; then a timeout (no usage at all).
    const textOnly = { content: [{ type: 'text', text: '{}' }] };
    const replies = [() => answer('{}', USAGE), () => answer('{}', { ...USAGE, output_tokens_details: { thinking_tokens: 0 } }, textOnly), () => answer('{}', { ...USAGE, output_tokens_details: undefined }), () => answer('{}', { ...USAGE, output_tokens_details: {} }), () => { throw timeoutError(); }];
    const guard = guardOf(fakeFetch(n => replies[n - 1]()).send, { ledgerFile: file, maxTransient: 2 });
    for (let i = 0; i < 4; i++) await guard.fetch(ANTHROPIC_MESSAGES, request());
    await assert.rejects(guard.fetch(ANTHROPIC_MESSAGES, request()), error => error.name === 'TimeoutError');
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(saved.entries.map(e => [e.tokens ? e.tokens.thinking : 'no usage', e.thinkingBlocks, e.tokens ? e.tokens.output : null]), [[120, 1, 500], [0, 0, 500], [null, 1, 500], [null, 1, 500], ['no usage', null, null]]);
    // The output tokens are billed alike whatever the answer says of its thinking.
    assert.equal(new Set(saved.entries.slice(0, 4).map(e => e.charged)).size, 1);
    assert.equal(guard.ledger.outputTokens, 4 * 500 + 1000, 'the timeout is charged its max_tokens');
    const a = guard.summary().anthropic;
    assert.deepEqual([a.thinkingTokens, a.thinkingReports, a.thinkingBlocks, a.outputTokens, a.notEstimated], [120, { nonzero: 1, zero: 1, unavailable: 3 }, 3, 2000, 1]);
    assert.ok(a.estimatedCost < a.chargedThisRun, 'the timeout\'s worst case is charged and has no estimate');
    assert.ok(Number.isFinite(a.latencyMs.p90) && a.latencyMs.p90 <= a.latencyMs.max);
    assert.match(describeClaudeUsage(a), /output 2000 \(thinking 120 as reported: 1 request\(s\) reported thinking tokens, 1 reported zero, 3 reported no count, which is not taken for zero; thinking blocks 3\); models that answered \{"claude-sonnet-5-5":4\}\. Estimated at the published prices \$[\d.]+ \(leaving out the 1 request\(s\) whose usage is unknown\); charged by the guard against its caps \$[\d.]+\. Anthropic's invoice is what counts\./);
    assert.ok(!fs.readFileSync(file, 'utf8').includes('SECRET THINKING TEXT'), 'no thinking text is kept');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a refusal by the guard passes through the SDK unchanged: never retried, never a timeout or a failed connection', async () => {
  const { content, masters } = sample(), pairs = gemini.pairsOf(content, masters).slice(0, 2);
  // An overload stops the guard (maxTransient 1), whose reason names timeouts; the adapter waits once and its retry is refused by the guard.
  const { send, calls } = fakeFetch(() => failure(529, 'overloaded_error', 'Overloaded'));
  const guard = guardOf(send, { maxTransient: 1 }), waits = [];
  await assert.rejects(gemini.requestAnthropic(pairs, { env: CLAUDE_ENV, transport: guard.fetch, sleep: async ms => { waits.push(ms); } }),
    error => error.refused === true && error.name !== 'TimeoutError' && /^not sent: 1 rate limit\(s\), timeout\(s\)/.test(error.message) && error.usage?.attempts === 1);
  assert.deepEqual([calls.length, waits], [1, [1000]]);
  // A guard that has already stopped: nothing is sent, nothing is waited for, and no usage is reported.
  const none = fakeFetch(), stopped = guardOf(none.send);
  stopped.stop('an operator stop');
  await assert.rejects(gemini.requestAnthropic(pairs, { env: CLAUDE_ENV, transport: stopped.fetch, sleep: async () => { throw Error('no wait expected'); } }), error => error.refused === true && error.usage === undefined && /an operator stop/.test(error.message));
  assert.equal(none.calls.length, 0);
});
