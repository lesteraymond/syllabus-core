'use strict';
// How a whole check through Claude meets every kind of failure, offline: the engine runs a Phase 3 fixture (bsit-aligned, every stage on, one batch at a
// time) through the Anthropic replay (eval/anthropicReplay.js) with a fault on one request. Each failure is classified as specified, retried only where
// that is safe (never a spend limit, a refusal of the request or a timeout), and an incomplete AI check never gives an official score, readiness or a
// PASS from an unverified answer. The waits between retries are recorded instead of slept, and runWithOracle blocks the network.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createOracle, runWithOracle, DEFAULT_ENV } = require('./eval/phase3/oracle');
const { variant, loadManifest } = require('./eval/phase3/fixtures');
const { scoreRun } = require('./eval/phase3/score');
const { createAnthropicReplay } = require('./eval/anthropicReplay');
const { blockedNow, resetProviderBlock } = require('./gemini');
const { run } = require('./engine');

const manifest = loadManifest();
const syllabus = variant('bsit', 'aligned', manifest), spec = manifest.variants['bsit-aligned'];
const CLAUDE = { ...DEFAULT_ENV, SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-test-only-not-a-real-key', ANTHROPIC_MODEL: 'claude-sonnet-5-5' };
const linkChecker = async url => ({ url, status: 'ok', httpStatus: 200 });
// One evaluation check of the fixture; fault(n, ids) as in anthropicReplay.js.
async function check(fault, { timeoutMs } = {}) {
  const waits = [], used = [];
  const replay = createAnthropicReplay(createOracle({ variantSpec: spec }), { thinking: true, fault });
  const { result } = await runWithOracle(structuredClone(syllabus), replay, { env: CLAUDE, evaluationOnly: true, sleep: async ms => { waits.push(ms); }, onUsage: u => used.push(u), ...(timeoutMs ? { anthropicTimeoutMs: timeoutMs } : {}) });
  return { result, replay, waits, used, alignment: result.hybrid.alignment, criteria: scoreRun(result, syllabus, spec, { requests: replay.calls.length }).criteria };
}
const on = (n, spec) => index => (index === n ? spec : null);
const from = (n, spec) => index => (index >= n ? spec : null);
// An incomplete AI check: no official score, not ready, the blocking AI-REQUIRED finding, and no unverified relationship reported as a PASS.
function withheld({ result, criteria }, label) {
  assert.equal(result.hybrid.alignment.status, 'not_evaluated', label);
  assert.deepEqual([result.score, result.passed, result.hybrid.ready], [null, false, false], label);
  assert.ok(result.findings.some(f => f.ruleId === 'AI-REQUIRED' && f.severity === 'blocking'), label);
  assert.equal(criteria.E4_zeroUnverifiedPass, true, label);
}
function completed({ result, criteria }, label) {
  assert.equal(result.hybrid.alignment.status, 'completed', label);
  assert.deepEqual([result.score, result.passed, result.hybrid.ready], [100, true, true], label);
  assert.equal(criteria.E4_zeroUnverifiedPass, true, label);
}
test.beforeEach(() => resetProviderBlock());
test.after(() => resetProviderBlock());

test('the fixture through Claude without a fault: 48 requests, completed, score 100', async () => {
  const clean = await check(null);
  completed(clean, 'no fault');
  assert.equal(clean.replay.calls.length, 48);
  assert.deepEqual(clean.waits, []);
  assert.equal(clean.used.length, 48);
  assert.ok(clean.used.every(u => u.attempts === 1 && u.stopReason === 'end_turn' && u.requestId));
});

test('a spend limit or an exhausted credit balance stops the check at once as provider_budget, is never retried, and holds the next check', async () => {
  const shapes = [
    [400, 'invalid_request_error', 'You have reached your specified API usage limits. You will regain access on 2026-11-01 at 00:00 UTC.'],
    [400, 'invalid_request_error', 'You have reached your specified workspace API usage limits. You will regain access on 2026-11-01 at 00:00 UTC.'],
    [400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'],
    [429, 'rate_limit_error', 'This request would exceed the monthly spend limit of your usage tier.', { error_code: 'enforced_spend_limit_reached' }],
  ];
  for (const [status, type, message, details] of shapes) {
    const outcome = await check(on(2, { status, type, message, details }));
    withheld(outcome, message);
    assert.deepEqual(outcome.alignment.failure, { kind: 'provider_budget', httpStatus: status, retryable: false }, message);
    assert.deepEqual([outcome.replay.calls.length, outcome.waits], [2, []], `${message}: no retry, no later batch`);
    assert.ok(blockedNow(), message);
    resetProviderBlock();
  }
  // The next check during the cooldown sends nothing at all (run directly: runWithOracle would reset the cooldown).
  const first = await check(on(1, { status: 400, type: 'invalid_request_error', message: shapes[0][2] }));
  assert.equal(first.alignment.failure.kind, 'provider_budget');
  const next = createAnthropicReplay(createOracle({ variantSpec: spec }));
  const held = await run(structuredClone(syllabus).content, syllabus.masters, { env: CLAUDE, evaluationOnly: true, transport: next.transport, linkChecker });
  assert.equal(next.calls.length, 0);
  assert.match(held.hybrid.alignment.reason, /refused a request a moment ago \(HTTP 400/);
  assert.deepEqual([held.score, held.hybrid.ready], [null, false]);
});

test('a refusal of the request (400, 401, 402, 403, 404, 413) is never retried: access refusals stop the check and hold the next one, the rest stop it', async () => {
  for (const [status, kind, holds] of [[400, 'provider_rejected', false], [401, 'provider_access', true], [402, 'provider_access', true], [403, 'provider_access', true], [404, 'provider_rejected', false], [413, 'provider_rejected', false]]) {
    const outcome = await check(on(2, { status, message: `offline HTTP ${status}` }));
    withheld(outcome, `HTTP ${status}`);
    assert.deepEqual([outcome.alignment.failure.kind, outcome.alignment.failure.retryable, outcome.replay.calls.length, outcome.waits], [kind, false, 2, []], `HTTP ${status}`);
    assert.equal(!!blockedNow(), holds, `HTTP ${status} holds the next check: ${holds}`);
    resetProviderBlock();
  }
});

test('a rate limit (429) is retried after the wait it names and the check completes; one that persists ends the check as provider_quota', async () => {
  const once = await check(on(2, { status: 429, message: 'rate limited', headers: { 'retry-after': '2' } }));
  completed(once, '429 once');
  assert.deepEqual([once.replay.calls.length, once.waits], [49, [2000]]);
  assert.equal(once.used.find(u => u.attempts === 2)?.requestId, 'req_replay_3', 'the request that was retried records both attempts and the id of the answer');
  const persisting = await check(from(2, { status: 429, message: 'rate limited' }));
  withheld(persisting, '429 every time');
  assert.deepEqual([persisting.alignment.failure.kind, persisting.replay.calls.length, persisting.waits], ['provider_quota', 4, [1000, 2000]]);
});

test('a server error, an overload or a dropped connection is retried within the deadline; one that persists leaves only that batch unchecked', async () => {
  for (const fault of [{ status: 500 }, { status: 502 }, { status: 503 }, { status: 529, type: 'overloaded_error' }, { drop: true }]) {
    const label = fault.status ? `HTTP ${fault.status} once` : 'dropped once';
    const once = await check(on(2, fault));
    completed(once, label);
    assert.deepEqual([once.replay.calls.length, once.waits], [49, [1000]], label);
  }
  // Every attempt of the batch holding clo0-course fails: three attempts, then that batch is not checked, and the batches after it still run.
  const persisting = await check((n, ids) => (ids.includes('clo0-course') ? { status: 529, type: 'overloaded_error', message: 'Overloaded' } : null));
  withheld(persisting, '529 every time for one batch');
  assert.equal(persisting.alignment.failure.kind, 'provider_error');
  const failed = persisting.replay.calls.filter(call => call.fault === 529);
  assert.equal(failed.length, 3, 'one request: the first attempt and two retries');
  assert.deepEqual(persisting.waits, [1000, 2000]);
  const unchecked = persisting.alignment.judgements.filter(j => j.failureKind === 'provider_error');
  assert.deepEqual(unchecked.map(j => j.id).sort(), [...failed[0].pairIds].sort());
  assert.ok(unchecked.every(j => j.unverified && j.label === 'INSUFFICIENT_EVIDENCE'));
  assert.ok(persisting.replay.calls.length > failed.length + 1, 'later batches were still asked');
});

test('a timeout, the adapter\'s own or the API\'s (504), is never retried: only that batch is unchecked and its tokens are marked unknown', async () => {
  for (const [label, fault, timeoutMs] of [['HTTP 504', { status: 504, message: 'Request timed out' }], ['no answer before the deadline', { hang: true }, 1500]]) {
    const outcome = await check(on(2, fault), { timeoutMs });
    withheld(outcome, label);
    assert.deepEqual([outcome.alignment.failure.kind, outcome.alignment.failure.retryable], ['provider_timeout', true], label);
    assert.equal(outcome.replay.calls.filter(call => call.fault).length, 1, `${label}: sent once`);
    assert.deepEqual(outcome.waits, [], label);
    const unchecked = outcome.alignment.judgements.filter(j => j.failureKind === 'provider_timeout');
    assert.deepEqual(unchecked.map(j => j.id).sort(), [...outcome.replay.calls[1].pairIds].sort(), label);
    assert.equal(outcome.alignment.usage.timedOut, 1, label);
    assert.deepEqual(outcome.used.filter(u => u.timedOut).map(u => [u.attempts, u.outputTokens]), [[1, 0]], label);
    assert.ok(outcome.replay.calls.length > 2, `${label}: later batches were still asked`);
  }
});

test('a refusal or a max_tokens stop is incomplete output: the relationships are asked again, the stop is counted, and one that keeps refusing is never a PASS', async () => {
  for (const [label, fault] of [['refusal', { stop: 'refusal', category: 'cyber' }], ['refusal without a category', { stop: 'refusal' }], ['max_tokens', { stop: 'max_tokens' }]]) {
    const outcome = await check(on(2, fault));
    completed(outcome, label);
    assert.equal(outcome.alignment.usage.stopReasons[fault.stop], 1, label);
    const stopped = outcome.used.find(u => u.stopReason === fault.stop);
    assert.equal(stopped.requestId, 'req_replay_2', label);
    if (fault.stop === 'refusal') assert.equal(stopped.stopCategory, fault.category ?? null, label);
    else assert.equal('stopCategory' in stopped, false, label);
    assert.ok(outcome.replay.calls.length > 48, `${label}: asked again`);
  }
  // Every answer about clo0-po7 is refused: it ends unverified, never a PASS, and the check withholds its score.
  const always = await check((n, ids) => (ids.includes('clo0-po7') ? { stop: 'refusal', category: null } : null));
  withheld(always, 'refused every time');
  const judgement = always.alignment.judgements.find(j => j.id === 'clo0-po7');
  assert.deepEqual([judgement.unverified, judgement.label], [true, 'INSUFFICIENT_EVIDENCE']);
  assert.ok(always.alignment.usage.stopReasons.refusal >= 2);
  assert.equal(always.result.hybrid.verdict.findings.some(f => f.relationshipId === 'clo0-po7' && f.status === 'PASS'), false);
});
