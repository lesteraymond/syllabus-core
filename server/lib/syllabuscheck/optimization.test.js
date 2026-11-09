'use strict';
// Cost optimisation of the Comprehensive Hybrid AI Checker (costPlan.js). The flags only change how the SAME relationships are packed, sized, ordered and
// reused, so every test asserts both sides: what got cheaper (or did not) AND that the academic coverage and the official score are untouched.
// A scripted transport answers every request in-process: no provider request is made, nothing is billed. Synthetic fixtures only.
const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const L = require(path.join(__dirname, '../../../scripts/live-claude/lib.cjs')), F = require(path.join(__dirname, '../../../scripts/live-claude/fixtures.cjs'));
const gemini = require('./gemini'), svc = require('../compliance/service'), repo = require('./repository'), costPlan = require('./costPlan');
const { budgetReport } = require('./budgetReport');
const { createMemoryDb } = require('./vpaa-conformance/memdb');

const link = async (url) => ({ url, status: 'ok', httpStatus: 200 });
const SAFE = { SYLLABUS_CHECK_COURSE_CONTEXT: 'scoped', SYLLABUS_CHECK_OUTPUT_PLAN: 'on', SYLLABUS_CHECK_CACHE_WARMUP: 'on' };
const gaps = (pair) => {
  if (pair.id === 'row0-ilo0-activity') return { label: 'PARTIALLY_ALIGNED', explanation: "Scripted: the activity does not yet practise the week's content.", recommendation: 'REWRITE_TEXT', correctionField: 'learning_activity' };
  if (pair.id === 'row0-contentassessment') return { label: 'NOT_ALIGNED', explanation: "Scripted: the assessment task does not measure the week's content." };
  return undefined;
};

// A scripted provider that keeps every request it is sent (the real bodies the application builds) and models nothing else.
function provider({ drop = null, status = 0 } = {}) {
  const inner = L.harness.scriptedTransport(gaps), requests = [];
  const transport = async (url, init) => {
    const body = JSON.parse(String(init.body)), user = JSON.parse(body.messages[0].content);
    requests.push({ body, user, bytes: Buffer.byteLength(String(init.body), 'utf8'), ids: (user.document_data || []).map((p) => p.id), types: (user.document_data || []).map((p) => p.type) });
    if (status) return new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'scripted outage' } }), { status, headers: { 'content-type': 'application/json' } });
    const response = await inner(url, init);
    if (!drop) return response;
    const payload = await response.json(), parsed = JSON.parse(payload.content[0].text);
    parsed.judgements = parsed.judgements.filter((j) => j.id !== drop);
    payload.content[0].text = JSON.stringify(parsed);
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { transport, requests };
}

// One syllabus whose stored runs give a later check the reuse it relies on.
function bench(caseId = 'a') {
  const fx = F.load(caseId), masters = structuredClone(fx.masters);
  masters.synthetic = false; masters.fingerprint = 'opt-1';
  const content = structuredClone(fx.content), db = createMemoryDb({ syllabus: { content: JSON.stringify(content) } });
  return {
    content, masters, db,
    week: (n) => content.plan.find((r) => String(r.week) === String(n)),
    async check({ mode = 'v2only', flags = {}, cap = 1000, store = true, syllabusId = 100, mastersOverride = null, drop = null, status = 0, env: envExtra = {} } = {}) {
      const original = repo.mastersFor; repo.mastersFor = async () => mastersOverride || masters;
      try {
        const env = L.anthropicEnv({ key: L.STAND_IN_KEY, cap, maxRequests: 500, mode, extra: { ...flags, ...envExtra } });
        const budget = gemini.createRequestBudget(env), p = provider({ drop, status });
        const result = await svc.checkHybrid(db, content, { syllabusId, env, transport: p.transport, requestBudget: budget, linkChecker: link });
        if (store) await svc.storeRun(db, { syllabusId, versionId: null, content, result, createdBy: 26, ai: true });
        return { result, requests: p.requests, budget: budget.summary(), asked: p.requests.flatMap((r) => r.ids), askedTypes: p.requests.flatMap((r) => r.types) };
      } finally { repo.mastersFor = original; }
    },
  };
}
const v2Of = (result) => result.hybrid.academicV2.academic.relationships;
const official = (result) => [result.overall, result.status, result.passed];
// Every relationship that was checked, with its verdict (a not-checked one has none): the academic coverage of a check.
const verdicts = (result) => {
  const out = {};
  for (const j of result.hybrid.alignment?.judgements || []) if (!j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE') out['L:' + j.id] = j.label;
  for (const r of v2Of(result)) if (r.status !== 'NOT_CHECKED') out['V:' + r.id] = r.academicJudgment;
  return out;
};
const histogram = (list) => list.reduce((m, x) => ({ ...m, [x]: (m[x] || 0) + 1 }), {});

// ---------- the planner and the controls themselves ----------

test('costPlan: with nothing configured the batches are the fixed-size slices the checker always used', () => {
  const items = Array.from({ length: 29 }, (_, i) => ({ id: 'p' + i, type: 'ILO-CLO', path: `plan[${i % 7}].ilos[0].text` }));
  for (const size of [1, 4, 12, 24]) {
    const slices = []; for (let i = 0; i < items.length; i += size) slices.push(items.slice(i, i + size));
    assert.deepEqual(costPlan.planBatches(items, size, 'default'), slices);
    assert.deepEqual(costPlan.planBatches(items, size), slices);
  }
  assert.deepEqual(costPlan.planBatches(items, 12, 'not-a-mode'), costPlan.planBatches(items, 12, 'default'), 'an unknown grouping is the default, never an error');
  for (const bad of [undefined, '', 'off', 'WEEK9']) assert.equal(costPlan.groupingOf({ SYLLABUS_CHECK_V2_GROUPING: bad }), 'default');
  assert.equal(costPlan.scopedContextOn({}), false); assert.equal(costPlan.outputPlanOn({}), false); assert.equal(costPlan.warmupOn({}), false);
});

test('costPlan: every grouping sends every relationship exactly once, keeps a week together where it fits, and stays within its bound', () => {
  const items = [];
  for (let week = 0; week < 15; week += 1) for (let k = 0; k < 7 + (week % 3); k += 1) items.push({ id: `w${week}-${k}`, type: 'ILO-CLO', path: `plan[${week}].ilos[0].text` });
  for (let k = 0; k < 9; k += 1) items.push({ id: `c${k}`, type: 'CLO-PO', path: `clos[${k}].statement` });
  for (const grouping of costPlan.GROUPINGS) {
    const batches = costPlan.planBatches(items, 12, grouping), flat = batches.flat();
    assert.equal(flat.length, items.length, grouping + ': nothing dropped');
    assert.equal(new Set(flat.map((x) => x.id)).size, items.length, grouping + ': nothing duplicated');
    const bound = grouping === 'default' ? 12 : grouping === 'adaptive' ? 18 : 24;
    assert.ok(batches.every((b) => b.length >= 1 && b.length <= bound), grouping + ': within its bound');
    if (grouping !== 'default') for (const batch of batches) { const w = new Set(batch.map(costPlan.weekOf).filter((x) => x !== null)); assert.ok(w.size <= (grouping === 'week1' ? 1 : grouping === 'week2' ? 2 : grouping === 'week3' ? 3 : 4), grouping + ': weeks per request'); }
  }
  assert.equal(costPlan.countBatches(items, 12, 'week1') >= costPlan.countBatches(items, 12, 'week2'), true, 'a wider group never needs more requests');
  assert.equal(costPlan.countBatches(items, 12, 'week2') >= costPlan.countBatches(items, 12, 'week3'), true);
});

test('costPlan: the planned output ceiling can only lower the configured one, never below 1024, and a retry of fewer relationships gets at least as much each', () => {
  for (const ceiling of [1024, 4096, 16000]) for (const n of [1, 4, 12, 24]) for (const recommendation of [false, true]) for (const thinking of [false, true]) {
    const planned = costPlan.plannedMaxTokens({ pairCount: n, recommendation, thinking, ceiling });
    assert.ok(planned <= ceiling && planned >= 1024, `ceiling ${ceiling}, ${n} pairs: ${planned}`);
  }
  const perPair = (n) => (costPlan.plannedMaxTokens({ pairCount: n, recommendation: true, thinking: false, ceiling: 1e9 }) / n);
  assert.ok(perPair(1) >= perPair(4) && perPair(4) >= perPair(12), 'halving a truncated batch gives each relationship more room, not less');
  // 4x the measured per-relationship answer, so an ordinary answer fits with room to spare
  assert.ok(costPlan.OUTPUT_PER_PAIR.legacy >= 4 * 309 && costPlan.OUTPUT_PER_PAIR.recommendation >= 3 * 758);
});

test('costPlan: the cache warm-up gate sends the first request of a prefix alone and lets the others follow, also when the first fails', async () => {
  const owner = {}, gate = costPlan.gateFor(owner), order = [];
  const send = (name, ms, fail = false) => async () => { order.push('start ' + name); await new Promise((r) => setTimeout(r, ms)); order.push('end ' + name); if (fail) throw Error(name + ' failed'); return name; };
  const results = await Promise.allSettled([costPlan.throughGate(gate, 'p1', send('a', 30, true)), costPlan.throughGate(gate, 'p1', send('b', 5)), costPlan.throughGate(gate, 'p1', send('c', 5)), costPlan.throughGate(gate, 'p2', send('d', 5))]);
  assert.equal(order.indexOf('start b') > order.indexOf('end a'), true, 'a waits for the first request of its prefix');
  assert.equal(order.indexOf('start c') > order.indexOf('end a'), true);
  assert.equal(order.indexOf('start d') < order.indexOf('end a'), true, 'a different prefix is not held');
  assert.deepEqual(results.map((r) => r.status), ['rejected', 'fulfilled', 'fulfilled', 'fulfilled'], 'the first failure does not fail or block the others');
  assert.deepEqual(costPlan.warmupStats(owner), { prefixes: 2, waited: 2 });
  assert.equal(await costPlan.throughGate(null, 'x', async () => 'direct'), 'direct', 'no gate: sent at once');
});

// ---------- the real checker, scripted provider ----------

test('defaults: with no flag set the requests are the ones the checker always sent (count, ceiling, no new fields) and the budget reports provider usage apart from the reservation', async () => {
  const b = bench(), run = await b.check({ mode: 'comprehensive' });
  assert.equal(run.requests.length, 51, 'the comprehensive check of the synthetic course A sent 51 requests before this work and still does');
  assert.ok(run.requests.every((r) => r.body.max_tokens === 16000), 'max_tokens is the configured ceiling');
  assert.deepEqual([...new Set(run.requests.flatMap((r) => Object.keys(r.body)))].sort(), ['max_tokens', 'messages', 'model', 'output_config', 'system', 'thinking']);
  assert.ok(run.requests.every((r) => r.body.system[0].cache_control && r.body.system.length === 1), 'the system prompt is the one cached block');
  const s = run.budget;
  assert.equal(s.providerReported.requests, 51); assert.equal(s.providerReported.inputTokens, 5100); // the scripted double reports 100 in / 100 out per answer
  assert.ok(s.reservedCostUsd > 0 && s.providerReported.calculatedUsd < s.reservedCostUsd, 'a reservation is an upper bound, apart from reported usage');
  const report = budgetReport(s, { plannedRequired: 11, v2Status: 'completed' });
  assert.equal(report.accounting.reservedCostUsd, s.reservedCostUsd); assert.equal(report.accounting.providerReported.requests, 51);
  assert.equal(budgetReport({ ...s, providerReported: undefined }, {}).accounting, undefined, 'without provider-reported usage nothing is claimed');
});

test('A: a first full check with the safe flags asks for the same academic coverage and the same official score', async () => {
  const base = await bench().check({ mode: 'comprehensive' }), opt = await bench().check({ mode: 'comprehensive', flags: SAFE });
  assert.deepEqual(official(opt.result), official(base.result));
  assert.deepEqual(verdicts(opt.result), verdicts(base.result), 'every relationship is checked, with the same verdict');
  assert.equal(v2Of(opt.result).filter((r) => r.status === 'NOT_CHECKED').length, v2Of(base.result).filter((r) => r.status === 'NOT_CHECKED').length);
  assert.equal(new Set(opt.asked).size, new Set(base.asked).size, 'the same relationships are sent');
  assert.ok(opt.requests.length <= base.requests.length + 2, 'scoped context can add a small request at a type boundary, nothing more');
  assert.ok(opt.requests.some((r) => r.body.max_tokens < 16000) || opt.requests.every((r) => r.body.max_tokens <= 16000), 'the output ceiling is never above the configured one');
  assert.ok(opt.requests.every((r) => r.body.max_tokens <= 16000));
  assert.ok(opt.budget.reservedCostUsd < base.budget.reservedCostUsd, 'the planned ceiling lowers the reservation');
});

test('B: an unchanged re-check sends nothing, with or without the flags', async () => {
  for (const flags of [{}, SAFE]) {
    const b = bench(); await b.check({ flags });
    const again = await b.check({ flags, store: false });
    assert.equal(again.requests.length, 0); assert.equal(again.budget.reservedCostUsd, 0);
    assert.equal(v2Of(again.result).filter((r) => r.reused).length > 100, true, 'the stored verdicts are reused, not lost');
  }
});

test('C: a one-week revision asks again only what depends on that week', async () => {
  const b = bench(); const first = await b.check({ flags: SAFE });
  b.week(5).activities = 'Laboratory: implement a Payable interface in several Employee classes and a Report interface for a second hierarchy';
  const next = await b.check({ flags: SAFE, store: false });
  assert.ok(next.asked.length <= 12 && next.asked.length >= 1, 'relationships asked: ' + next.asked.length);
  assert.ok(next.requests.length <= 6);
  const types = Object.keys(histogram(next.askedTypes));
  const dependent = new Set(['ILO-activity', 'Module-value', 'Activity-fit', 'Assessment-fit', 'Value-map', 'Content-activity', 'Activity-assessment', 'ILO-assessment']);
  assert.ok(types.every((t) => dependent.has(t)), 'only types that read learning activities: ' + types.join(', '));
  const full = bench(); full.week(5).activities = b.week(5).activities;
  assert.deepEqual(official(next.result), official((await full.check({ flags: SAFE })).result), 'the score is the one a full check of the edited syllabus gives');
  assert.equal(first.requests.length > next.requests.length * 3, true);
});

test('D: a CLO revision asks again its own relationships and the ILOs mapped to it, not the week-only ones', async () => {
  const b = bench(); await b.check({ flags: SAFE });
  b.content.clos[1].statement = 'Apply inheritance, polymorphism, interfaces and abstract classes to design and write Java programs that solve well-defined problems.';
  const next = await b.check({ flags: SAFE, store: false });
  const types = histogram(next.askedTypes);
  assert.ok(types['ILO-CLO'] > 1, 'the ILOs tagged to the CLO are asked again (a necessary cross-week dependency)');
  assert.ok(!types['ILO-activity'] && !types['Activity-fit'] && !types['Module-value'], 'week-only relationships are not');
  assert.ok(next.asked.length < 60);
});

test('E: a changed institutional reference (PO wording) asks again only the relationships that read it', async () => {
  const b = bench(); await b.check({ flags: SAFE });
  const changed = structuredClone(b.masters); changed.pos[0].text += ' (revised)'; changed.fingerprint = 'opt-2'; b.content.outcomes.pos[0].text = changed.pos[0].text;
  const next = await b.check({ flags: SAFE, store: false, mastersOverride: changed });
  const types = Object.keys(histogram(next.askedTypes));
  assert.ok(next.asked.length >= 1 && next.asked.length <= 12, 'asked: ' + next.asked.length);
  assert.ok(types.every((t) => /^CLO-(PO|anyPO)$/.test(t)), 'only the PO relationships: ' + types.join(', '));
});

test('F: the exact-result cache misses when the question changes (prompt version, model settings, other syllabus) and hits when only cost controls change', async () => {
  const b = bench(); await b.check({});
  assert.equal((await b.check({ store: false })).requests.length, 0, 'same question: hit');
  for (const [name, flags] of [['output plan', { SYLLABUS_CHECK_OUTPUT_PLAN: 'on' }], ['cache warm-up', { SYLLABUS_CHECK_CACHE_WARMUP: 'on' }], ['week grouping', { SYLLABUS_CHECK_V2_GROUPING: 'week2' }]]) {
    assert.equal((await b.check({ flags, store: false })).requests.length, 0, name + ' changes how a question is sent, not what it asks: still a hit');
  }
  const scoped = await b.check({ flags: { SYLLABUS_CHECK_COURSE_CONTEXT: 'scoped' }, store: false });
  assert.ok(scoped.requests.length > 0, 'a different course context is a different prompt version: the description-reading and legacy relationships are asked again');
  const effort = await b.check({ store: false, env: { ANTHROPIC_EFFORT: 'low' } });
  assert.ok(effort.asked.length >= 100, 'another effort is another question: miss (' + effort.asked.length + ')');
  const other = await b.check({ store: false, syllabusId: 101 });
  assert.ok(other.asked.length >= 100, 'a verdict is reused only inside its own syllabus: another syllabus misses (' + other.asked.length + ')');
});

test('G: an incomplete grouped response is NOT_CHECKED for that relationship alone; nothing is invented', async () => {
  const victim = 'row2-ilo0-activity';
  for (const grouping of ['default', 'week3']) {
    const run = await bench().check({ flags: { SYLLABUS_CHECK_V2_GROUPING: grouping }, drop: victim });
    const rel = v2Of(run.result).find((r) => r.id === victim);
    assert.ok(rel, grouping + ': the relationship is in the report');
    assert.equal(rel.status, 'NOT_CHECKED', grouping + ': never turned into a verdict');
    assert.equal(rel.academicJudgment, null);
    const others = v2Of(run.result).filter((r) => r.id !== victim && r.attempted);
    assert.ok(others.length > 100 && others.every((r) => r.status !== 'NOT_CHECKED'), grouping + ': the rest of the group keeps its verified verdicts');
    assert.ok(run.requests.filter((r) => r.ids.includes(victim)).length >= 2, 'the missing one was asked again alone before it was given up');
  }
});

test('H: with the provider unavailable every relationship is NOT_CHECKED with the flags on, and the official score is the baseline one', async () => {
  const base = await bench().check({ mode: 'comprehensive', status: 503 }), opt = await bench().check({ mode: 'comprehensive', flags: SAFE, status: 503 });
  for (const run of [base, opt]) {
    assert.deepEqual(Object.values(verdicts(run.result)).filter((l) => l === 'ALIGNED' || l === 'PARTIALLY_ALIGNED' || l === 'NOT_ALIGNED'), [], 'no verdict is invented');
    assert.ok(v2Of(run.result).every((r) => r.status === 'NOT_CHECKED'));
  }
  assert.deepEqual(official(opt.result), official(base.result));
  assert.ok(opt.requests.length <= base.requests.length + 1, 'the outage is not retried harder: ' + opt.requests.length + ' vs ' + base.requests.length);
});

test('I: a tight budget is never exceeded, the required Policy V2 work is protected, and the planned ceiling never makes the check do less of it', async () => {
  for (const cap of [4.4, 6]) {
    const base = await bench().check({ cap }), opt = await bench().check({ cap, flags: SAFE });
    for (const run of [base, opt]) {
      assert.ok(run.budget.reservedCostUsd <= cap, `reserved ${run.budget.reservedCostUsd} within the $${cap} cap`);
      assert.ok(run.budget.byPriority.v2.requests >= run.budget.plannedRequiredRequests, 'every planned required request was sent');
      assert.deepEqual(official(run.result), official(base.result));
    }
    // every relationship the baseline verified through the required work is still verified, with the same verdict
    const optVerdicts = verdicts(opt.result), baseVerdicts = verdicts(base.result);
    assert.ok(Object.keys(baseVerdicts).filter((k) => k in optVerdicts).every((k) => optVerdicts[k] === baseVerdicts[k]), 'verdicts that exist in both are the same');
    // the required work is the same set in both; what may differ is the optional supporting work the budget reached
    const requiredIds = (run) => new Set(v2Of(run.result).filter((r) => r.status !== 'NOT_CHECKED').map((r) => r.relationshipType).filter((t) => /^(CLO-classification|Course-CLO|CLO-PO|CLO-EGA|ILO-CLO)$/.test(t)));
    assert.deepEqual([...requiredIds(opt)].sort(), [...requiredIds(base)].sort());
  }
});

test('J: scoring parity across the flags and the groupings, on two synthetic courses', async () => {
  for (const caseId of ['a', 'b']) {
    const base = await bench(caseId).check({ mode: 'comprehensive' });
    for (const flags of [{ SYLLABUS_CHECK_COURSE_CONTEXT: 'scoped' }, { SYLLABUS_CHECK_OUTPUT_PLAN: 'on' }, { SYLLABUS_CHECK_CACHE_WARMUP: 'on' }, SAFE, { ...SAFE, SYLLABUS_CHECK_V2_GROUPING: 'week2' }, { SYLLABUS_CHECK_V2_GROUPING: 'adaptive' }]) {
      const run = await bench(caseId).check({ mode: 'comprehensive', flags });
      assert.deepEqual(official(run.result), official(base.result), caseId + ' ' + JSON.stringify(flags));
      assert.equal(run.result.passThreshold, 79); assert.equal(run.result.ruleChecks.length, base.result.ruleChecks.length);
      assert.deepEqual(verdicts(run.result), verdicts(base.result), 'the same verdict for every relationship');
      assert.deepEqual(run.result.areas, base.result.areas, 'the six scored areas');
    }
  }
});

test('scoped context: a description-free request leaves the description out, a request that reads it keeps it, and they are never mixed', async () => {
  const b = bench(); const run = await b.check({ flags: { SYLLABUS_CHECK_COURSE_CONTEXT: 'scoped' } });
  assert.ok(run.requests.length > 0);
  // (A Policy V2 request carries no course description at all, so there is nothing to scope there.)
  const legacy = run.requests.filter((r) => !r.body.system[0].text.includes('Recommendation contract lcup-v2-recommendation'));
  assert.ok(legacy.length > 0 && legacy.length < run.requests.length);
  for (const r of legacy) {
    const needs = r.types.some((t) => costPlan.needsDescription(t)), free = r.types.some((t) => !costPlan.needsDescription(t));
    assert.equal(needs && free, false, 'not mixed: ' + [...new Set(r.types)].join(','));
    if (!needs) assert.equal(r.user.course.description, '');
  }
  // the legacy request that reads the description still carries it
  assert.ok(legacy.some((r) => r.types.some(costPlan.needsDescription) && r.user.course.description.length > 0));
  // editing only the description asks again only what reads it
  b.content.description = [{ id: 'd1', t: b.content.description[0].t + ' Students also learn basic software documentation.' }];
  const next = await b.check({ flags: { SYLLABUS_CHECK_COURSE_CONTEXT: 'scoped' }, store: false });
  assert.ok(Object.keys(histogram(next.askedTypes)).every((t) => costPlan.needsDescription(t)), 'asked: ' + JSON.stringify(histogram(next.askedTypes)));
  const baseline = bench(); await baseline.check({}); baseline.content.description = b.content.description;
  assert.ok((await baseline.check({ store: false })).asked.length > next.asked.length, 'without the flag a description edit asks for far more');
});

test('output plan: a request that is cut off at the planned ceiling is asked again in halves, never reported as a verdict', async () => {
  // a ceiling of 1024 (the floor) cannot hold the scripted answer of a large batch: the answers are cut off and the checker must recover or report NOT_CHECKED
  const inner = L.harness.scriptedTransport(gaps), seen = [];
  const transport = async (url, init) => {
    const body = JSON.parse(String(init.body)), n = (JSON.parse(body.messages[0].content).document_data || []).length;
    seen.push({ n, max: body.max_tokens });
    if (n > 3) return new Response(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: '{"judgements":[' }], stop_reason: 'max_tokens', usage: { input_tokens: 10, output_tokens: body.max_tokens } }), { status: 200, headers: { 'content-type': 'application/json' } });
    return inner(url, init);
  };
  const b = bench(), original = repo.mastersFor; repo.mastersFor = async () => b.masters;
  try {
    const env = L.anthropicEnv({ key: L.STAND_IN_KEY, cap: 1000, maxRequests: 500, mode: 'v2only', extra: { SYLLABUS_CHECK_OUTPUT_PLAN: 'on' } });
    const result = await svc.checkHybrid(b.db, b.content, { syllabusId: 100, env, transport, requestBudget: gemini.createRequestBudget(env), linkChecker: link });
    assert.ok(seen.some((s) => s.n > 3) && seen.some((s) => s.n <= 3), 'big requests were cut off, then asked again smaller');
    assert.ok(seen.every((s) => s.max <= 16000));
    for (const r of v2Of(result)) if (r.status !== 'NOT_CHECKED') assert.ok(['ALIGNED', 'PARTIALLY_ALIGNED', 'NOT_ALIGNED'].includes(r.academicJudgment) || r.academicJudgment === null);
  } finally { repo.mastersFor = original; }
});

// ---------- Task 3: grouped requests keep every relationship independent, and a bad answer for one never becomes a verdict ----------

const VPAA = ['Content-course', 'Content-ILO', 'ILO-CLO', 'Content-activity', 'ILO-activity', 'Content-assessment', 'Activity-assessment'];
const V2_MARK = 'Recommendation contract lcup-v2-recommendation';
// A scripted provider that damages the answer for requests carrying one relationship: every request that asks it (also when asked again alone).
function faultyProvider(kind, victim) {
  const inner = L.harness.scriptedTransport(gaps), requests = [];
  const transport = async (url, init) => {
    const body = JSON.parse(String(init.body)), user = JSON.parse(body.messages[0].content), ids = (user.document_data || []).map((p) => p.id);
    requests.push({ ids, types: (user.document_data || []).map((p) => p.type), body });
    const response = await inner(url, init);
    if (!ids.includes(victim)) return response;
    const payload = await response.json(), parsed = JSON.parse(payload.content[0].text), at = parsed.judgements.findIndex((j) => j.id === victim);
    if (kind === 'duplicate') parsed.judgements.push({ ...parsed.judgements[at] });
    if (kind === 'unknown') parsed.judgements.push({ ...parsed.judgements[at], id: 'ghost-relationship' });
    if (kind === 'label') parsed.judgements[at].label = 'MAYBE';
    if (kind === 'quote') parsed.judgements[at].sourceQuote = 'this sentence is not anywhere in the syllabus';
    if (kind === 'field') delete parsed.judgements[at].explanation;
    payload.content[0].text = kind === 'malformed' ? '{"judgements": [ {"id": ' : JSON.stringify(parsed);
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { transport, requests };
}
async function runWith(b, { flags = {}, provider: p, mode = 'v2only' }) {
  const original = repo.mastersFor; repo.mastersFor = async () => b.masters;
  try {
    const env = L.anthropicEnv({ key: L.STAND_IN_KEY, cap: 1000, maxRequests: 500, mode, extra: flags });
    return { result: await svc.checkHybrid(b.db, b.content, { syllabusId: 100, env, transport: p.transport, requestBudget: gemini.createRequestBudget(env), linkChecker: link }), requests: p.requests };
  } finally { repo.mastersFor = original; }
}

test('coverage: the seven VPAA relationships and the four CLO classifications are each evaluated on their own, under every flag and grouping', async () => {
  const baseline = await bench().check({});
  const count = (run, type) => v2Of(run.result).filter((r) => r.relationshipType === type).length;
  assert.equal(count(baseline, 'CLO-classification'), 4);
  for (const type of VPAA) assert.ok(count(baseline, type) >= 7, type + ' has one relationship per week/instance: ' + count(baseline, type));
  const settled = (run, type) => v2Of(run.result).filter((r) => r.relationshipType === type && r.status !== 'NOT_CHECKED').length;
  for (const flags of [SAFE, { SYLLABUS_CHECK_V2_GROUPING: 'week1' }, { SYLLABUS_CHECK_V2_GROUPING: 'week2' }, { SYLLABUS_CHECK_V2_GROUPING: 'week3' }, { SYLLABUS_CHECK_V2_GROUPING: 'adaptive' }, { ...SAFE, SYLLABUS_CHECK_OUTPUT_FIELDS: 'scoped', SYLLABUS_CHECK_V2_GROUPING: 'week2' }]) {
    const run = await bench().check({ flags }), rel = v2Of(run.result);
    assert.equal(new Set(rel.map((r) => r.id)).size, rel.length, 'every relationship instance appears exactly once ' + JSON.stringify(flags));
    assert.deepEqual(rel.map((r) => r.id).sort(), v2Of(baseline.result).map((r) => r.id).sort(), 'the same instances as the baseline');
    for (const type of [...VPAA, 'CLO-classification']) {
      assert.equal(count(run, type), count(baseline, type), type);
      assert.equal(settled(run, type), settled(baseline, type), type + ' is evaluated as often as in the baseline');
    }
    assert.deepEqual(verdicts(run.result), verdicts(baseline.result), 'each relationship got its own, identical verdict ' + JSON.stringify(flags));
  }
});

test('grouped answers: a duplicate, unknown, malformed or unsupported finding for one relationship is refused for that relationship alone; nothing is invented', async () => {
  const victim = 'row2-ilo0-activity';
  const clean = await bench().check({});
  for (const grouping of ['default', 'week3']) for (const kind of ['duplicate', 'unknown', 'malformed', 'label', 'quote', 'field']) {
    const b = bench(), p = faultyProvider(kind, victim);
    const { result, requests } = await runWith(b, { flags: { SYLLABUS_CHECK_V2_GROUPING: grouping }, provider: p });
    const rel = v2Of(result), where = `${grouping}/${kind}`;
    assert.deepEqual(rel.map((r) => r.id).sort(), v2Of(clean.result).map((r) => r.id).sort(), where + ': every expected relationship appears exactly once (none missing, none extra)');
    assert.ok(!rel.some((r) => r.id === 'ghost-relationship'), where + ': an unrequested id never enters the report');
    const damaged = rel.find((r) => r.id === victim);
    assert.equal(damaged.status, 'NOT_CHECKED', where + ': the damaged relationship is not checked');
    assert.equal(damaged.academicJudgment, null, where + ': and has no invented verdict');
    // Every other relationship keeps the verdict it has without the fault, or is NOT_CHECKED: never a different verdict. (An unknown id in a reply discards that reply;
    // the relationships that then are not re-asked stay NOT_CHECKED. Identical on the code before this work: a conservative, pre-existing behaviour, reported in OPTIMIZATION-REPORT.)
    const lost = [];
    for (const other of rel.filter((r) => r.id !== victim)) {
      const expected = v2Of(clean.result).find((r) => r.id === other.id).academicJudgment;
      if (other.status === 'NOT_CHECKED' && expected) lost.push(other.id); else assert.equal(other.academicJudgment, expected, where + ': ' + other.id + ' keeps its own verdict');
    }
    assert.ok(lost.length <= (kind === 'unknown' ? 2 : 0), where + ': relationships lost as collateral: ' + lost.join(','));
    assert.ok(requests.filter((r) => r.ids.includes(victim)).length >= 2, where + ': asked again alone before it was given up');
    // A required relationship that could not be checked leaves the whole check incomplete, with no score: the same with or without grouping, never a score built on a guess.
    assert.deepEqual(official(result), [null, 'incomplete', false], where);
  }
});

// ---------- F6: structured output fields ----------

test('output fields: a request asks only for the Stage C/D fields its relationship types use, and the answer is verified against the same list', async () => {
  const { ASPECT_KEYS } = gemini;
  const off = await bench().check({ mode: 'comprehensive' }), on = await bench().check({ mode: 'comprehensive', flags: { SYLLABUS_CHECK_OUTPUT_FIELDS: 'scoped' } });
  const keysOf = (r) => Object.keys(r.body.output_config.format.schema.properties.judgements.items.properties).filter((k) => ASPECT_KEYS.includes(k));
  const isV2 = (r) => r.body.system[0].text.includes(V2_MARK), legacy = (run) => run.requests.filter((r) => !isV2(r));
  assert.ok(legacy(off).length > 10 && legacy(off).every((r) => keysOf(r).length === 13), 'off: every legacy request carries all 13 fields (as it always did)');
  assert.ok(legacy(on).some((r) => keysOf(r).length === 0), 'on: requests with no lesson/value/reference type carry none');
  for (const r of legacy(on)) {
    const types = new Set(r.types), k = new Set(keysOf(r));
    const wantC = types.has('Activity-fit') || types.has('Assessment-fit'), wantD1 = types.has('Value-use') || types.has('Value-map'), wantD2 = types.has('Ref-relevance');
    for (const key of ['teaching', 'learnerSupport', 'measures', 'evidence', 'level']) assert.equal(k.has(key), wantC, key);
    for (const key of ['valueUse', 'carriedBy', 'valueFit', 'coreValue', 'integration']) assert.equal(k.has(key), wantD1, key);
    for (const key of ['relevance', 'basis']) assert.equal(k.has(key), wantD2, key);
    assert.equal(k.has('responsible'), wantC || wantD1);
  }
  assert.ok(on.requests.filter(isV2).every((r) => keysOf(r).length === 0), 'Policy V2 requests carry none either way');
  assert.deepEqual(official(on.result), official(off.result));
  assert.deepEqual(verdicts(on.result), verdicts(off.result));
  assert.deepEqual(on.result.hybrid.ruleCoverage.counts, off.result.hybrid.ruleCoverage.counts);
  assert.deepEqual(on.result.findings.map((f) => f.ruleId || f.id).sort(), off.result.findings.map((f) => f.ruleId || f.id).sort());
  const required = on.result.hybrid.alignment.judgements.filter((j) => ['Activity-fit', 'Assessment-fit', 'Value-use', 'Value-map', 'Ref-relevance'].includes(j.type) && !j.unverified);
  assert.ok(required.length > 0 && required.every((j) => j.aspects && j.aspects.missing.length === 0 && j.aspects.invalid.length === 0), 'lesson / value / reference answers still carry their required fields');
});

test('output fields: a field the request did not ask for is refused, the prompt version changes only where a field is left out, and Policy V2 reuse is untouched', async () => {
  const pairs = [{ id: 'p1', type: 'CLO-PO', source: 'Apply knowledge of computing', target: 'Explain the basic concepts', path: 'clos[0].statement', targetPath: 'clos[0].statement' }];
  const stages = { SYLLABUS_CHECK_STAGE_A: 'on', SYLLABUS_CHECK_STAGE_C1: 'on', SYLLABUS_CHECK_STAGE_C2: 'on', SYLLABUS_CHECK_STAGE_D1: 'on', SYLLABUS_CHECK_STAGE_D2: 'on' };
  const pruned = { ...gemini.contractOf(stages, null, null) };
  assert.equal(pruned.aspectKeys.length, 13);
  pruned.aspectKeys = costPlan.aspectKeysForPairs(pruned.aspectKeys, pairs);
  assert.deepEqual(pruned.aspectKeys, []);
  const answer = (extra) => JSON.stringify({ judgements: [{ id: 'p1', label: 'ALIGNED', explanation: 'x', sourceQuote: 'Apply knowledge', targetQuote: 'Explain the basic', sourceBloom: 'N/A', targetBloom: 'N/A', draft: '', recommendation: 'NO_CHANGE', ...extra }] });
  assert.doesNotThrow(() => gemini.verifyAnswer(answer({}), pairs, pruned));
  assert.throws(() => gemini.verifyAnswer(answer({ teaching: 'sound' }), pairs, pruned), 'a field that was not asked for is a malformed answer');
  const b = bench(); await b.check({ mode: 'comprehensive' });
  const next = await b.check({ mode: 'comprehensive', store: false, flags: { SYLLABUS_CHECK_OUTPUT_FIELDS: 'scoped' } });
  assert.ok(next.asked.length > 0, 'a different question for the legacy relationships: they are asked again once');
  assert.equal(next.requests.filter((r) => r.body.system[0].text.includes(V2_MARK)).length, 0, 'Policy V2 relationships are reused');
  const v2only = bench(); await v2only.check({});
  assert.equal((await v2only.check({ store: false, flags: { SYLLABUS_CHECK_OUTPUT_FIELDS: 'scoped' } })).requests.length, 0, 'with no Stage C/D field to leave out the flag changes nothing');
});
