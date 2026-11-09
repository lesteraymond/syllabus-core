'use strict';
// Budget planning for the comprehensive profile: optional supporting checks may not use up the per-check budget before the required academic evaluations
// (the seven VPAA relationships, the four CLO classifications and the legacy relationships that feed the official score) have been sent.
// The caps are never raised; what does not fit is reported NOT_CHECKED, never invented. Scripted transport: no provider request leaves the machine.
const test = require('node:test'), assert = require('node:assert/strict');
const h = require('./vpaa-conformance/harness'), svc = require('../compliance/service'), repo = require('./repository');
const { createMemoryDb } = require('./vpaa-conformance/memdb');
const { createRequestBudget } = require('./gemini');
const { budgetReport } = require('./budgetReport');
const profile = require('./checkingProfile');

const COMP = { [profile.FLAG]: profile.NAME };
const link = async (url) => ({ url, status: 'ok', httpStatus: 200 });

test('budget: with no planning hold every request is treated exactly as before (optional priority is ignored, exhaustion is sticky)', () => {
  const b = createRequestBudget({ SYLLABUS_CHECK_AI_MAX_REQUESTS: '2' });
  b.reserveRequest('{}', 100, { priority: 'optional' }); b.reserveRequest('{}', 100, { priority: 'optional' });
  assert.throws(() => b.reserveRequest('{}', 100, { priority: 'optional' }), (e) => e.kind === 'request_budget' && e.budgetReason === 'request_limit');
  assert.throws(() => b.reserveRequest('{}', 100), (e) => e.budgetReason === 'request_limit', 'sticky: later requests are refused too');
  assert.equal(b.summary().deferredOptional, undefined);
});

test('budget: a planning hold keeps room for the required requests; optional ones are deferred (not sticky) and required ones still go', () => {
  const b = createRequestBudget({ SYLLABUS_CHECK_AI_MAX_REQUESTS: '10' });
  b.holdFor(4);
  for (let i = 0; i < 6; i += 1) b.reserveRequest('{}', 100, { priority: 'optional' }); // 6 + 4 held = 10
  assert.throws(() => b.reserveRequest('{}', 100, { priority: 'optional' }), (e) => e.budgetReason === 'optional_deferred' && e.kind === 'request_budget');
  assert.equal(b.summary().exhausted, false, 'a deferred optional request is not an exhaustion');
  for (let i = 0; i < 4; i += 1) b.reserveRequest('{}', 100, { priority: 'v2' }); // the held room is there
  const s = b.summary();
  assert.equal(s.requests, 10); assert.equal(s.deferredOptional, 1); assert.equal(s.heldRequests, 0);
  assert.deepEqual([s.byPriority.optional.requests, s.byPriority.v2.requests], [6, 4]);
  assert.throws(() => b.reserveRequest('{}', 100, { priority: 'v2' }), (e) => e.budgetReason === 'request_limit', 'the ordinary limit still stops required work: nothing is raised');
});

test('budget: the cost cap is planned the same way, and the held room is sized from the required requests already seen', () => {
  const env = { SYLLABUS_CHECK_AI_MAX_COST_USD: '1', SYLLABUS_CHECK_AI_MAX_REQUESTS: '100' };
  const b = createRequestBudget(env);
  b.reserveRequest('{}', 1000, { estimatedCost: 0.2, priority: 'scored' });
  b.holdFor(2); // needs 2 x 0.2 x 1.25 = 0.5 held
  b.reserveRequest('{}', 1000, { estimatedCost: 0.2, priority: 'optional' }); // 0.4 + 0.5 <= 1
  assert.throws(() => b.reserveRequest('{}', 1000, { estimatedCost: 0.2, priority: 'optional' }), (e) => e.budgetReason === 'optional_deferred');
  b.reserveRequest('{}', 1000, { estimatedCost: 0.2, priority: 'v2' }); b.reserveRequest('{}', 1000, { estimatedCost: 0.2, priority: 'v2' });
  assert.equal(b.summary().reservedCostUsd, 0.8);
});

test('budgetReport: says whether the required evaluations fit, never raises a cap, and only advises', () => {
  const ok = budgetReport({ maxRequests: 120, maxTokens: 1, maxCostUsd: 10, requests: 5, reservedTokens: 1, reservedCostUsd: 3, exhausted: false, planned: true, deferredOptional: 3, byPriority: { scored: { requests: 2, reservedCostUsd: 1 }, v2: { requests: 3, reservedCostUsd: 2 }, optional: { requests: 0, reservedCostUsd: 0 } } }, { plannedRequired: 3, v2Status: 'completed' });
  assert.equal(ok.requiredIncomplete, false); assert.equal(ok.deferredOptional, 3); assert.equal(ok.advice, undefined);
  const short = budgetReport({ maxRequests: 120, maxTokens: 1, maxCostUsd: 2, requests: 8, reservedTokens: 1, reservedCostUsd: 1.9, exhausted: true, stopReason: 'cost_budget', planned: true, deferredOptional: 0, byPriority: { scored: { requests: 6, reservedCostUsd: 1.2 }, v2: { requests: 2, reservedCostUsd: 0.7 }, optional: { requests: 0, reservedCostUsd: 0 } } }, { plannedRequired: 11, v2Status: 'partially_evaluated' });
  assert.equal(short.requiredIncomplete, true);
  assert.ok(short.advice.estimatedRequiredCostUsd > short.advice.currentCapUsd, 'the advice states that the cap is below the estimated need');
  assert.deepEqual(short.advice.options, ['raise_cost_cap', 'run_fewer_optional_checks']);
  assert.equal(short.limits.maxCostUsd, 2, 'the configured cap is reported as it is');
});

async function check(t, over, wrap) {
  h.liveGuard(t);
  const { content, masters } = h.sample(); masters.synthetic = false; masters.fingerprint = 'budget-planning';
  t.mock.method(repo, 'mastersFor', async () => masters);
  const db = createMemoryDb({ syllabus: { content: JSON.stringify(content) } });
  const transport = wrap ? wrap(h.scriptedTransport()) : h.scriptedTransport();
  const result = await svc.checkHybrid(db, content, { syllabusId: 100, env: h.envFor({ ...COMP, ...over }), transport, linkChecker: link });
  return { result, transport };
}
const row = (r, id) => r.hybrid.ruleCoverage.rules.find((x) => x.ruleId === id);

test('comprehensive profile at a cap that fits the required work but not everything: all seven VPAA links and four CLO classifications are evaluated, optional checks are deferred as NOT_CHECKED, the official score is unchanged', async (t) => {
  const free = await check(t, { SYLLABUS_CHECK_AI_MAX_COST_USD: '1000', SYLLABUS_CHECK_AI_MAX_REQUESTS: '500' });
  const fb = free.result.hybrid.budget;
  assert.equal(fb.deferredOptional, 0, 'with room for everything nothing is deferred');
  const required = fb.byPriority.scored.reservedCostUsd + fb.byPriority.v2.reservedCostUsd, everything = fb.used.reservedCostUsd;
  assert.ok(everything > required * 1.3, 'the fixture has enough optional work for the test to mean something');
  const cap = Math.round((required * 1.3) * 100) / 100; // fits scored + V2 with room, not the optional stages
  const tight = await check(t, { SYLLABUS_CHECK_AI_MAX_COST_USD: String(cap), SYLLABUS_CHECK_AI_MAX_REQUESTS: '500' });
  const r = tight.result;
  assert.equal(r.hybrid.academicV2.alignment.status, 'completed', 'Policy V2 was not starved');
  for (let i = 1; i <= 7; i += 1) assert.equal(row(r, `VPAA-0${i}`).verified, true, `VPAA-0${i}`);
  for (let i = 1; i <= 4; i += 1) { assert.equal(row(r, `CLO${i}:semantic`).verified, true); assert.equal(row(r, `CLO${i}:structure`).verified, true); }
  assert.ok(r.hybrid.budget.deferredOptional > 0, 'something optional was deferred');
  assert.equal(r.hybrid.budget.requiredIncomplete, false);
  assert.ok(r.hybrid.budget.used.reservedCostUsd <= cap + 1e-9, 'the configured cap was respected, not exceeded');
  // the official result is exactly what it is with all the room in the world
  const official = (x) => JSON.stringify([x.overall, x.passed, x.band, x.passThreshold, x.areas.map((a) => [a.key, a.score])]);
  assert.equal(official(r), official(free.result));
  assert.equal(r.passThreshold, 79);
  // deferred items are NOT_CHECKED with the budget reason; nothing deferred is a pass
  const deferred = r.hybrid.alignment.judgements.filter((j) => j.failureKind === 'budget_deferred');
  assert.ok(deferred.length > 0 && deferred.every((j) => j.unverified && j.label === 'INSUFFICIENT_EVIDENCE'));
  assert.ok(deferred.every((j) => /optional supporting check was not sent/.test(j.explanation)));
  const flagged = r.hybrid.ruleCoverage.rules.filter((x) => x.reasonCode === 'budget_deferred');
  assert.ok(flagged.length > 0 && flagged.every((x) => ['NOT_CHECKED', 'PARTIALLY_EVALUATED'].includes(x.status)));
  assert.equal(r.hybrid.ruleCoverage.budget.requiredIncomplete, false);
  assert.ok(r.hybrid.ruleCoverage.budget.deferredOptional > 0);
  // the legacy advisory check Policy V2 owns is not asked twice and has no stray placeholder
  assert.equal(r.hybrid.alignment.judgements.filter((j) => j.id === 'requirements-title-description').length, 0);
  assert.equal(r.hybrid.academicV2.academic.relationships.filter((j) => j.id === 'requirements-title-description').length, 1);
  // fewer requests than with unlimited room, and every one of them was a scripted one
  assert.ok(tight.transport.pairs().length <= free.transport.pairs().length);
  assert.ok(row(r, 'CUR-11').verified, 'Title ↔ Description is verified by Policy V2');
});

test('comprehensive profile at a cap too small even for the required work: the unchecked relationships are NOT_CHECKED, never invented, and the report asks for an operator decision', async (t) => {
  const free = await check(t, { SYLLABUS_CHECK_AI_MAX_COST_USD: '1000', SYLLABUS_CHECK_AI_MAX_REQUESTS: '500' });
  const fb = free.result.hybrid.budget;
  const cap = Math.round((fb.byPriority.scored.reservedCostUsd + fb.byPriority.v2.reservedCostUsd * 0.4) * 100) / 100; // scored fits, V2 does not fully
  const r = (await check(t, { SYLLABUS_CHECK_AI_MAX_COST_USD: String(cap), SYLLABUS_CHECK_AI_MAX_REQUESTS: '500' })).result;
  const v2 = r.hybrid.academicV2;
  assert.notEqual(v2.alignment.status, 'completed');
  assert.equal(r.hybrid.budget.requiredIncomplete, true);
  assert.ok(r.hybrid.budget.advice.estimatedRequiredCostUsd > cap);
  assert.equal(r.hybrid.budget.limits.maxCostUsd, cap, 'the cap is reported as configured; it was not raised');
  const unchecked = v2.academic.relationships.filter((x) => !(x.verification === 'quotes_verified' && x.academicJudgment !== null));
  assert.ok(unchecked.length > 0);
  assert.ok(unchecked.every((x) => x.academicJudgment === null || x.status === 'NOT_CHECKED' || x.status === 'NOT_EVALUATED' || x.verification !== 'quotes_verified'));
  assert.ok(Array.from({ length: 7 }, (_, i) => row(r, `VPAA-0${i + 1}`)).some((x) => x.status === 'NOT_CHECKED' || x.status === 'PARTIALLY_EVALUATED'));
  assert.equal(r.hybrid.ruleCoverage.budget.requiredIncomplete, true);
  assert.equal(r.passThreshold, 79);
});

test('with Policy V2 off nothing is planned: no hold, no deferral, and the budget summary is the one it always was', async (t) => {
  const r = (await check(t, { [profile.FLAG]: undefined, SYLLABUS_CHECK_ACADEMIC_V2: 'off', SYLLABUS_CHECK_AI_MAX_COST_USD: '1000', SYLLABUS_CHECK_AI_MAX_REQUESTS: '500' })).result;
  assert.equal(r.hybrid.budget, undefined);
  assert.equal(r.hybrid.academicV2, undefined);
});

test('a provider failure on optional (advisory-only) batches is reported NOT_CHECKED: the official result, the scored relationships and Policy V2 are unaffected', async (t) => {
  const roomy = { SYLLABUS_CHECK_AI_MAX_COST_USD: '1000', SYLLABUS_CHECK_AI_MAX_REQUESTS: '500' };
  const base = await check(t, roomy);
  // the provider answers every request except those made ONLY of optional (advisory-only) questions
  const OPTIONAL = new Set(['Activity-fit', 'Assessment-fit', 'Value-use', 'Ref-relevance', 'Week1-introduction', 'CLO-coverage', 'Plan-sequence', 'CLO-set', 'ILO-content', 'CLO-anyPO', 'CLO-anyEGA']);
  let failedRequests = 0;
  const outage = (transport) => async (url, init) => {
    const body = String(init && init.body || '');
    const types = [...new Set([...body.matchAll(/\\"type\\":\\"([A-Z][A-Za-z0-9-]+)\\"|"type":"([A-Z][A-Za-z0-9-]+)"/g)].map((m) => m[1] || m[2]))];
    if (types.length && types.every((x) => OPTIONAL.has(x))) { failedRequests += 1; return new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'scripted outage' } }), { status: 503, headers: { 'content-type': 'application/json' } }); }
    return transport(url, init);
  };
  const flaky = (await check(t, roomy, outage)).result;
  assert.ok(failedRequests >= 3, 'the outage really hit several optional batches (more than the 2 the old code tolerated): ' + failedRequests);
  const official = (x) => JSON.stringify([x.overall, x.passed, x.status, x.band, x.passThreshold, x.areas.map((a) => [a.key, a.score])]);
  assert.equal(official(flaky), official(base.result), 'the official result does not change when optional supporting checks fail');
  assert.equal(flaky.status, 'scored');
  assert.equal(flaky.hybrid.alignment.status, 'completed', 'the scored AI part still counts as complete');
  assert.equal(flaky.hybrid.academicV2.alignment.status, 'completed');
  for (let i = 1; i <= 7; i += 1) assert.equal(row(flaky, `VPAA-0${i}`).verified, true);
  const failed = flaky.hybrid.alignment.judgements.filter((j) => j.unverified && ['provider_error', 'provider_timeout', 'provider_quota'].includes(j.failureKind));
  assert.ok(failed.length > 0, 'the failed optional questions are present and unverified');
  assert.ok(failed.every((j) => j.label === 'INSUFFICIENT_EVIDENCE'), 'never reported as supported');
  assert.equal(flaky.passThreshold, 79);
});
