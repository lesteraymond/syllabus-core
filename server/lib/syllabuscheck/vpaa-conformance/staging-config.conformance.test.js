'use strict';
// Task 4: every claim POLICY-V2-ACTIVATION.md makes about the staging configuration, verified against the code with the document's OWN configuration block
// (staging.js parses it). Scripted provider only; no network, no real key, no real secret.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const h = require('./harness');
const { createMemoryDb } = require('./memdb');
const { documentedStagingEnv, DOC } = require('./staging');
const svc = require('../../compliance/service');
const repo = require('../repository');
const gemini = require('../gemini');
const anthropic = require('../anthropicClient');
const v2Activation = require('../academicV2Activation');

const ROOT = path.resolve(__dirname, '../../../..');
const STAGING = documentedStagingEnv();
const LINK = async (url) => ({ url, status: 'ok', httpStatus: 200 });
const world = (t) => { const w = h.sample(); w.masters.synthetic = false; w.masters.fingerprint = 'staging-fp'; t.mock.method(repo, 'mastersFor', async () => w.masters); return { ...w, db: createMemoryDb({ syllabus: { content: JSON.stringify(w.content) } }) }; };
const res = (status, headers = {}) => async () => new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'scripted' } }), { status, headers: { 'content-type': 'application/json', ...headers } });
// A full check through the shared service under the documented environment (plus overrides), with a scripted provider.
async function stagingCheck(t, over = {}, { script, transport } = {}) {
  gemini.resetProviderBlock();
  const { content, db } = world(t), tr = transport || h.scriptedTransport(script);
  const result = await svc.checkHybrid(db, structuredClone(content), { syllabusId: 100, env: { ...STAGING, ...over }, transport: tr, linkChecker: LINK });
  return { result, tr, db, content };
}
// V2 alone, for counting attempts exactly.
async function v2Only(over, transport) {
  gemini.resetProviderBlock();
  const { content, masters } = h.sample();
  return { out: await h.policy.evaluateIntegrated(content, masters, h.coded, { env: { ...STAGING, ...over }, transport }), content };
}

test('[VPAA-STG-DOC-CONFIG] the documented staging configuration is complete, uses no real secret, and the read-only preflight accepts it', () => {
  assert.deepEqual(Object.keys(STAGING).sort(), ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'CORS_ALLOWED_ORIGINS', 'JWT_SECRET', 'NODE_ENV', 'SESSION_SECRET', 'SYLLABUS_CHECK_AI_GATE', 'SYLLABUS_CHECK_AI_MAX_COST_USD', 'SYLLABUS_CHECK_AI_MAX_REQUESTS', 'SYLLABUS_CHECK_AI_PROVIDER', 'SYLLABUS_CHECK_ACADEMIC_V2', 'SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL', 'SESSION_COOKIE_SAMESITE', 'TRUST_PROXY'].sort());
  assert.deepEqual([STAGING.NODE_ENV, STAGING.SYLLABUS_CHECK_ACADEMIC_V2, STAGING.SYLLABUS_CHECK_AI_PROVIDER, STAGING.ANTHROPIC_MODEL, STAGING.SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL, STAGING.SYLLABUS_CHECK_AI_GATE, STAGING.SYLLABUS_CHECK_AI_MAX_REQUESTS, STAGING.SYLLABUS_CHECK_AI_MAX_COST_USD], ['staging', 'on', 'anthropic', 'claude-sonnet-5-5', 'claude-sonnet-5-5', 'advisory', '120', '10']);
  for (const k of ['ANTHROPIC_API_KEY', 'SESSION_SECRET', 'JWT_SECRET']) assert.match(STAGING[k], /stand-in/, `${k} is a stand-in, not a real credential`);
  // the document invents no domain: its host settings are placeholders, replaced here by the reserved .invalid name
  assert.match(STAGING.CORS_ALLOWED_ORIGINS, /.invalid$/, 'the staging origin is a placeholder in the document, never an invented domain');
  assert.deepEqual([STAGING.TRUST_PROXY, STAGING.SESSION_COOKIE_SAMESITE], ['1', 'lax']);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vpaa-stg-'));
  try {
    const file = path.join(dir, 'staging.env');
    fs.writeFileSync(file, Object.entries(STAGING).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/vpaa-v2-preflight.cjs'), '--env-file', file], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout); assert.match(r.stdout, /READY for an authorized Policy V2 staging test/); assert.ok(!/\[warn\]/.test(r.stdout), 'no warning: the documented caps are the recommended ones');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('[VPAA-STG-MODEL] Claude Sonnet 5.5: verified model, adaptive thinking at high effort, documented defaults, and the approved-model gate', () => {
  const cfg = gemini.providerConfig(STAGING);
  assert.deepEqual([cfg.provider, cfg.model, cfg.configured, cfg.approved], ['anthropic', 'claude-sonnet-5-5', true, true]);
  assert.ok(Object.hasOwn(anthropic.MODELS, 'claude-sonnet-5-5'), 'the model is one of the verified ones');
  const settings = anthropic.anthropicSettings(STAGING), req = anthropic.requestConfigOf('claude-sonnet-5-5', settings);
  assert.deepEqual(req, { thinking: { type: 'adaptive' }, effort: 'high' }, 'adaptive thinking, high effort');
  assert.deepEqual({ maxTokens: settings.maxTokens, timeoutMs: settings.timeoutMs, maxRetries: settings.maxRetries, cache: settings.cache }, { maxTokens: 16000, timeoutMs: 180000, maxRetries: 2, cache: true }, 'documented defaults: 16,000 output tokens, 180 s per request, 2 retries, prompt cache on');
  assert.deepEqual(anthropic.priceOf('claude-sonnet-5-5', { inputTokens: 1e6, outputTokens: 1e6, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 }).slice(0, 2), [2, 10], 'priced at $2 in / $10 out per million tokens');
  // the approval gate: no request unless the approved model equals the configured one; a key alone never turns anything on
  assert.equal(gemini.providerConfig({ ...STAGING, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-sonnet-5' }).configured, false);
  assert.equal(gemini.providerConfig({ ...STAGING, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: '' }).configured, false);
  assert.equal(gemini.providerConfig({ ...STAGING, ANTHROPIC_MODEL: 'claude-unknown-9', SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-unknown-9' }).configured, false, 'an unverified model is never configured');
  assert.equal(gemini.providerConfig({ ...STAGING, ANTHROPIC_API_KEY: 'not-an-anthropic-key' }).configured, false, 'a key in another format is never sent to Anthropic');
  assert.equal(v2Activation.enabled({ ...STAGING, SYLLABUS_CHECK_ACADEMIC_V2: 'true' }), false, 'only the exact value "on" activates Policy V2');
});

test('[VPAA-STG-LIMITS] request, token and cost limits: the defaults, the documented values, and what each does when it is reached', async (t) => {
  const budget = gemini.createRequestBudget(STAGING).summary();
  assert.deepEqual([budget.maxRequests, budget.maxTokens, budget.maxCostUsd], [120, 8000000, 10], 'documented request cap and cost guard; the token budget keeps its default');
  const defaults = gemini.createRequestBudget({}).summary();
  assert.deepEqual([defaults.maxRequests, defaults.maxTokens, defaults.maxCostUsd], [512, 8000000, undefined], 'without the documented settings: 512 requests, 8,000,000 reserved tokens, no cost guard');
  // 1. the documented configuration completes a full check, inside every limit
  const full = await stagingCheck(t);
  const b = full.result.hybrid.academicV2.alignment.requestBudget;
  assert.equal(full.result.hybrid.semanticCoverage.complete, true);
  assert.ok(b.requests <= 120 && b.reservedCostUsd <= 10 && b.reservedTokens <= 8000000 && !b.exhausted, `within limits: ${b.requests} requests, $${b.reservedCostUsd} reserved, ${b.reservedTokens} tokens`);
  // 2. each limit, when reached, stops further requests, is reported, and never overspends
  for (const [name, over, reason] of [['request cap', { SYLLABUS_CHECK_AI_MAX_REQUESTS: '10' }, 'request_limit'], ['token budget', { SYLLABUS_CHECK_AI_MAX_TOKENS: '60000' }, 'token_budget'], ['cost guard', { SYLLABUS_CHECK_AI_MAX_COST_USD: '1.50' }, 'cost_budget']]) {
    const r = await stagingCheck(t, over);
    assert.equal(r.result.hybrid.academicV2.alignment.requestBudget.stopReason, reason, name);
    assert.ok(r.tr.sent.length < full.tr.sent.length, `${name}: fewer requests than a full check (${r.tr.sent.length} < ${full.tr.sent.length})`);
    assert.equal(r.result.hybrid.semanticCoverage.complete, false, `${name}: reported incomplete`);
    assert.ok(r.result.hybrid.alignment.judgements.every((j) => j.unverified || r.tr.pairs().some((p) => p.id === j.id)), `${name}: no judgment exists for a relationship that was not sent`);
  }
  // 3. the cost guard is a reservation: a too-small value is a trap, which is why the document says 10 and explains it
  const trap = await stagingCheck(t, { SYLLABUS_CHECK_AI_MAX_COST_USD: '1.50' });
  assert.ok(trap.result.hybrid.academicV2.alignment.requestBudget.reservedCostUsd <= 1.5 + 1e-9, 'it reserves up to the cap and refuses the next request');
  assert.ok(full.result.hybrid.academicV2.alignment.requestBudget.reservedCostUsd > 1.5, 'a full check needs a reservation far above 1.50');
});

test('[VPAA-STG-RETRY] retry behavior, measured: which failures are retried, how many requests a failing provider costs, and that every attempt counts against the request cap', async () => {
  // Requests sent when EVERY request fails with `status`, one batch at a time (concurrency 1). The numbers are measured, and POLICY-V2-ACTIVATION.md states them.
  const sent = async (status, over = {}) => {
    let n = 0;
    const transport = async (...a) => { n += 1; return res(status, { 'retry-after-ms': '0' })(...a); };
    const { out } = await v2Only({ SYLLABUS_CHECK_AI_CONCURRENCY: '1', ...over }, transport);
    assert.equal(out.alignment.requestBudget.requests, n, `HTTP ${status}: every attempt is counted against the cap`);
    assert.equal(out.alignment.status, 'not_evaluated'); assert.equal(out.alignment.liveModelCalls, n);
    return n;
  };
  assert.equal(await sent(429), 3, '429: retried twice, then the whole check stops (1 + 2 attempts)');
  for (const status of [500, 502, 503, 529]) assert.equal(await sent(status), 9, `${status}: each request retried twice; the check stops after three consecutive failing batches (3 × 3)`);
  for (const status of [400, 401, 402, 403, 404]) assert.equal(await sent(status), 1, `${status}: one attempt, never retried, and the check stops at once`);
  assert.equal(await sent(504), 3, '504 (the API\'s own timeout): the same question is never sent again, but three batches are tried before the check stops');
  assert.equal(await sent(503, { ANTHROPIC_MAX_RETRIES: '0' }), 3, 'ANTHROPIC_MAX_RETRIES=0: no retry (3 batches, 1 attempt each)');
  assert.equal(await sent(503, { ANTHROPIC_MAX_RETRIES: '3' }), 12, 'ANTHROPIC_MAX_RETRIES=3, the maximum: 3 batches × 4 attempts');
  assert.equal(await sent(503, { ANTHROPIC_MAX_RETRIES: '9' }), 9, 'a value outside 0 to 3 is IGNORED and the default of 2 applies (it is not clamped to 3)');
  assert.equal(await sent(503, { SYLLABUS_CHECK_AI_MAX_REQUESTS: '2' }), 2, 'the request cap also bounds retries: the third attempt is refused locally, not sent');
  // Concurrency multiplies the burst: three batches in flight by default, up to six.
  const burst = async (concurrency) => { let n = 0; const transport = async (...a) => { n += 1; return res(503, { 'retry-after-ms': '0' })(...a); }; await v2Only(concurrency ? { SYLLABUS_CHECK_AI_CONCURRENCY: String(concurrency) } : {}, transport); return n; };
  assert.deepEqual([await burst(1), await burst(), await burst(6)], [9, 15, 24], 'a failing provider costs 9 requests at concurrency 1, 15 at the default 3, 24 at 6 (each batch tried 3 times)');
});

test('[VPAA-STG-PROVIDER-FAILURE] a provider refusal reports an incomplete check, starts a cooldown, and the next check sends nothing', async (t) => {
  const first = await stagingCheck(t, {}, { transport: async () => res(401)() });
  assert.equal(first.result.hybrid.semanticCoverage.complete, false); assert.equal(first.result.hybrid.semanticCoverage.reason, 'v2_not_evaluated');
  assert.equal(first.result.status, 'incomplete'); assert.equal(first.result.score, null);
  const block = gemini.blockedNow(); assert.ok(block, 'the cooldown started');
  const remaining = block.until - Date.now();
  assert.ok(remaining > 290000 && remaining <= 300000, `the default cooldown is 300 s (${Math.round(remaining / 1000)} s left)`);
  const tr = h.scriptedTransport();
  const { content, db } = world(t);
  const second = await svc.checkHybrid(db, content, { syllabusId: 100, env: { ...STAGING }, transport: tr, linkChecker: LINK });
  assert.equal(tr.sent.length, 0, 'no request is sent while the provider is blocked');
  assert.match(second.hybrid.alignment.reason, /no request was sent/i);
  gemini.resetProviderBlock();
});

test('[VPAA-STG-ROLLBACK] switching Policy V2 off (and restarting) restores the legacy behavior, and reports saved while it was on stay readable', async (t) => {
  const { content, db } = world(t);
  gemini.resetProviderBlock();
  const on = await svc.checkHybrid(db, structuredClone(content), { syllabusId: 100, env: { ...STAGING }, transport: h.scriptedTransport(), linkChecker: LINK });
  const runId = await svc.storeRun(db, { syllabusId: 100, versionId: null, content, result: on, ai: true });
  const { SYLLABUS_CHECK_ACADEMIC_V2, ...rolledBack } = STAGING;
  gemini.resetProviderBlock();
  const off = await svc.checkHybrid(db, structuredClone(content), { syllabusId: 100, env: rolledBack, transport: h.scriptedTransport(), linkChecker: LINK });
  assert.equal(off.hybrid.academicV2, undefined, 'no Policy V2 section once the flag is gone');
  assert.equal(off.hybrid.semanticCoverage.policyV2.enabled, false);
  assert.deepEqual([off.score, off.status, off.passed, off.hybrid.baseScore], [on.score, on.status, on.passed, on.hybrid.baseScore], 'the official result is the same either way');
  const saved = await svc.loadDetail(db, db.state.runs.find((r) => r.run_id === runId), svc.hashOf(content));
  assert.ok(saved.hybrid.academicV2 && saved.hybrid.semanticCoverage.complete, 'the report saved while V2 was on is still read back whole, flag or no flag');
  assert.equal(JSON.parse(db.state.reports.get(runId).report_json).hybrid.academicV2.mode, 'live-application');
});

test('[VPAA-STG-DOC-NUMBERS] the request counts the document states for the synthetic sample are the measured ones', async (t) => {
  const { tr } = await stagingCheck(t);
  const v2 = tr.sent.filter((q) => /academic-evaluation-v2/.test(q.system)).length, legacy = tr.sent.length - v2;
  const doc = fs.readFileSync(DOC, 'utf8');
  const m = /a check sent (\d+) requests: (\d+) from the legacy path[^]*?and (\d+) from Policy V2/.exec(doc);
  assert.ok(m, 'the document states the measured counts in the expected sentence');
  assert.deepEqual(m.slice(1).map(Number), [tr.sent.length, legacy, v2], `measured under the documented environment: ${tr.sent.length} = ${legacy} legacy + ${v2} V2`);
});
