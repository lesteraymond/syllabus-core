'use strict';
// The direct Anthropic provider (anthropicClient.js; the old checker's tests through gemini.js and modelClient.js were removed with it), offline. Every request goes to a fake transport, and the
// global fetch is replaced for this whole file, so a request that slipped through could not reach the network. No key here is a real key.
const test = require('node:test');
const assert = require('node:assert/strict');
const realFetch = globalThis.fetch;
let blocked = 0;
globalThis.fetch = async () => { blocked += 1; throw new TypeError('fetch failed (network blocked in anthropic.test.js)'); };
test.after(() => { globalThis.fetch = realFetch; });
const { anthropicMessage, anthropicSettings, estimateUsd, usageOf, MODELS, EFFORTS, PRICES_AS_OF, US_ONLY_FACTOR } = require('./anthropicClient');
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
