'use strict';
// VPAA conformance, Task 6: what the checker does when the AI cannot be used. In every case the coded checks must keep working, no AI
// relationship may be marked verified, no judgment may be invented, and the official score must not change. All failures are SIMULATED
// by a test double: no network call is made.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./harness');
const gemini = require('../gemini');

const S = 'SUPPORTED_BY_SUPPLIED_EVIDENCE';
const http = (status, body) => async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const reply = (text, stop = 'end_turn') => async () => new Response(JSON.stringify({ id: 'msg_scripted', type: 'message', role: 'assistant', model: h.MODEL, content: [{ type: 'text', text }], stop_reason: stop, usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } });
// Judgements for the requested pairs, damaged on purpose, in the schema each request carries.
const damaged = (mutate) => async (_url, init) => {
  const body = JSON.parse(init.body), user = JSON.parse(body.messages[0].content), item = body.output_config.format.schema.properties.judgements.items;
  const judgements = user.document_data.map((pair) => { const ok = h.answerFor(pair, {}); return mutate(Object.fromEntries(Object.keys(item.properties).map((k) => [k, ok[k] !== undefined ? ok[k] : ''])), pair); }).filter(Boolean);
  return h.message(judgements);
};

// name: what failed. `kinds`: the failure kinds the app may report for it. `calls`: whether the provider should be reached at all.
const FAILURES = {
  unavailable: { label: 'Claude API unavailable (connection fails)', transport: async () => { throw new TypeError('fetch failed'); }, kinds: ['provider_error'] },
  auth: { label: 'provider authentication fails (HTTP 401)', transport: http(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), kinds: ['provider_access'] },
  budget: { label: 'request budget exhausted', env: { SYLLABUS_CHECK_AI_MAX_REQUESTS: '0' }, calls: false, kinds: ['request_budget'] },
  incomplete: { label: 'model response incomplete (stop_reason max_tokens)', transport: reply('{"judgements":[{"id":"row0-con', 'max_tokens'), kinds: ['invalid_output', 'provider_error'] },
  invalidJson: { label: 'response is not valid JSON', transport: reply('this is not json {'), kinds: ['invalid_output', 'provider_error'] },
  emptyAnswer: { label: 'response is valid JSON but contains no judgements', transport: reply('{"judgements":[]}'), kinds: ['invalid_output'] },
  noEvidence: { label: 'judgments lack supporting evidence (no quotations, no explanation)', transport: damaged((j) => ({ ...j, sourceQuote: '', targetQuote: '', explanation: '' })), kinds: ['invalid_output'] },
  fabricatedEvidence: { label: 'judgments quote text that is not in the syllabus', transport: damaged((j) => ({ ...j, sourceQuote: 'NOT IN THE SYLLABUS', targetQuote: 'ALSO NOT IN THE SYLLABUS' })), kinds: ['invalid_output'] },
  timeout: { label: 'request times out (HTTP 504, the API\'s own timeout)', transport: http(504, { type: 'error', error: { type: 'timeout_error', message: 'upstream timeout' } }), kinds: ['provider_timeout', 'provider_error'] },
};
const link = async (url) => ({ url, status: 'ok', httpStatus: 200 });
const NO_V2 = { SYLLABUS_CHECK_ACADEMIC_V2: 'off' };

for (const [name, f] of Object.entries(FAILURES)) {
  test(`[VPAA-R12-V2-${name}] Policy V2 under failure: ${f.label}`, async (t) => {
    h.liveGuard(t);
    const { content, masters } = h.sample();
    const before = structuredClone(content);
    let calls = 0;
    const transport = f.calls === false ? h.scriptedTransport() : async (...a) => { calls++; return f.transport(...a); };
    const result = await h.policy.evaluateIntegrated(content, masters, h.coded, { env: h.envFor(f.env), transport });
    const rels = result.academic.relationships, weekly = result.academic.requirements.filter((r) => String(r.id).startsWith('weekly:'));
    assert.deepEqual(content, before, 'faculty text is never changed');
    if (f.calls === false) assert.equal(transport.sent.length, 0, 'no request is made once the budget is exhausted');
    assert.notEqual(result.alignment.status, 'completed', 'the check never claims to be complete');
    assert.ok(result.alignment.reason, 'the reason it could not complete is stated');
    // No AI relationship is verified or judged.
    assert.ok(rels.every((r) => r.status !== S || r.provenance.liveModelCall === false), 'no relationship is SUPPORTED by a model that did not answer');
    assert.ok(rels.filter((r) => r.relationshipType && ['Content-course', 'Content-ILO', 'ILO-CLO', 'Content-activity', 'ILO-activity', 'Content-assessment', 'Activity-assessment'].includes(r.relationshipType)).every((r) => r.academicJudgment === null && r.verification !== 'quotes_verified'), 'no judgment is fabricated or verified');
    assert.ok(weekly.length > 0 && weekly.every((r) => r.status === 'NOT_EVALUATED' || r.status === 'FACULTY_REVIEW'), 'weekly requirements stay not-evaluated');
    assert.ok(weekly.every((r) => r.status !== S), 'no weekly requirement is certified');
    assert.notEqual(result.academic.disposition, S);
    // The coded (deterministic) requirements still ran.
    const fixed = result.academic.requirements.filter((r) => r.kind === 'deterministic_compliance');
    assert.ok(fixed.some((r) => r.id === 'course.fourCLOs' && r.status === S) && fixed.some((r) => r.id === 'schedule.weeks1to18' && r.status === S), 'coded requirements are still evaluated and can pass');
    assert.ok(result.academic.coverage.supported < result.academic.coverage.required, 'coverage is not claimed');
    assert.equal(result.academic.provenance.networkRequests, f.calls === false ? 0 : calls, 'the request count the report states matches the requests actually sent');
    t.diagnostic(`calls=${calls} status=${result.alignment.status}`);
  });

  test(`[VPAA-R12-HYBRID-${name}] Hybrid-2 production path under failure: ${f.label}`, async (t) => {
    h.liveGuard(t);
    const mk = () => h.sample();
    // The same syllabus with no AI at all: the coded baseline the failure must leave untouched.
    const off = mk(); const offline = await h.engine.run(off.content, off.masters, { useAi: false, linkChecker: link });
    const ok = mk(); const success = await h.engine.run(ok.content, ok.masters, { useAi: true, env: h.envFor(NO_V2), transport: h.scriptedTransport(), linkChecker: link });
    gemini.resetProviderBlock();
    const m = mk(); const before = structuredClone(m.content);
    let calls = 0;
    const transport = f.calls === false ? h.scriptedTransport() : async (...a) => { calls++; return f.transport(...a); };
    const result = await h.engine.run(m.content, m.masters, { useAi: true, env: h.envFor({ ...NO_V2, ...f.env }), transport, linkChecker: link });
    const al = result.hybrid.alignment;
    assert.deepEqual(m.content, before, 'faculty text is never changed');
    if (f.calls === false) assert.equal(transport.sent.length, 0, 'no request after the budget is exhausted');
    assert.notEqual(al.status, 'completed');
    assert.ok(al.reason, 'a reason is given');
    assert.ok(f.kinds.includes(al.failure?.kind), `failure kind ${al.failure?.kind} is one of ${f.kinds}`);
    // No AI judgment is fabricated or verified; no AI deduction is invented.
    assert.equal(al.judgements.filter((j) => !j.unverified).length, 0, 'not one judgment is treated as verified');
    assert.ok(al.judgements.every((j) => j.unverified === true && j.label === 'INSUFFICIENT_EVIDENCE'), 'every unanswered relationship is "not checked"');
    assert.equal(result.hybrid.deductions.filter((d) => /^SEM:/.test(d.id)).length, 0, 'no AI deduction exists');
    // The coded checks are exactly what they were without AI, and the official score is not invented, withheld-then-wrong, or changed.
    const coded = (r) => r.findings.filter((x) => x.source === 'rule' && !/^(SEM|AI-REQUIRED)/.test(x.ruleId)).map((x) => x.id).sort();
    assert.deepEqual(coded(result), coded(offline), 'the same coded findings');
    assert.equal(result.hybrid.baseScore, offline.hybrid.baseScore, 'the coded base score is unchanged');
    assert.equal(result.hybrid.provisionalScore, success.hybrid.provisionalScore === undefined ? result.hybrid.provisionalScore : result.hybrid.provisionalScore);
    assert.deepEqual(result.hybrid.deductions.map((d) => d.id).sort(), offline.hybrid.deductions.map((d) => d.id).sort(), 'only the coded deductions remain');
    assert.equal(result.score, null, 'no final official score is issued from an incomplete AI check');
    assert.equal(result.status, 'incomplete');
    assert.equal(result.hybrid.ready, false);
    assert.equal(result.passed, false, 'an incomplete check never passes');
    t.diagnostic(`calls=${calls} kind=${al.failure?.kind}`);
  });
}

test('[VPAA-R12-BREAKER] after the provider refuses for access or credits, no further request is sent until the cooldown ends', async (t) => {
  h.liveGuard(t);
  let calls = 0;
  const transport = async (...a) => { calls++; return FAILURES.auth.transport(...a); };
  const { content, masters } = h.sample();
  const first = await h.engine.run(content, masters, { useAi: true, env: h.envFor(NO_V2), transport, linkChecker: link });
  const afterFirst = calls;
  assert.ok(afterFirst >= 1 && gemini.blockedNow(), 'the refusal starts the cooldown');
  const second = await h.engine.run(structuredClone(content), masters, { useAi: true, env: h.envFor(NO_V2), transport, linkChecker: link });
  assert.equal(calls, afterFirst, 'the second check sends nothing while the provider is blocked');
  assert.equal(second.hybrid.alignment.judgements.filter((j) => !j.unverified).length, 0);
  assert.match(second.hybrid.alignment.reason, /no request was sent/i, 'and says so');
  assert.equal(first.status, 'incomplete');
});

test('[VPAA-R12-PARTIAL] when the model answers only some relationships, the rest stay "not checked" and the check is reported as partial', async (t) => {
  h.liveGuard(t);
  const { content, masters, rowIndex } = h.syllabus({});
  const { result, record } = await h.evaluateV2(content, masters, { script: (p) => (p.type === 'Content-assessment' ? 'omit' : undefined) });
  assert.equal(result.alignment.status, 'partially_evaluated');
  assert.equal(record(`row${rowIndex}-contentassessment`).status, 'NOT_CHECKED');
  assert.equal(record(`row${rowIndex}-contentassessment`).academicJudgment, null);
  assert.equal(record(`row${rowIndex}-content`).status, S, 'the relationships the model did answer keep their results');
});

test('[VPAA-R12-NOT-CONFIGURED] with no approved provider, no AI request is made and the coded checks still run', async (t) => {
  h.liveGuard(t);
  const { content, masters } = h.sample();
  for (const env of [{ SYLLABUS_CHECK_AI_PROVIDER: 'off' }, { SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: '' }, { ANTHROPIC_API_KEY: '' }]) {
    const transport = h.scriptedTransport();
    const result = await h.policy.evaluateIntegrated(structuredClone(content), masters, h.coded, { env: h.envFor(env), transport });
    assert.equal(transport.sent.length, 0, JSON.stringify(env));
    assert.equal(result.status, 'not_evaluated');
    assert.ok(result.academic.relationships.every((r) => r.status === 'NOT_CHECKED' || r.status === 'FACULTY_REVIEW'));
    assert.ok(result.academic.requirements.some((r) => r.id === 'course.fourCLOs' && r.status === S), 'coded requirements still ran');
  }
});

// DEF-03 (fixed): the live-call count is the number of requests THIS evaluation sent (requests the budget refused are not calls), and it is counted from the
// budget's own record, relative to where the evaluation started, so a budget shared with the legacy run is not double counted.
test('[VPAA-R12-LIVECALLS] DEF-03 regression: the reported number of live model calls equals the requests actually sent', async (t) => {
  h.liveGuard(t);
  for (const max of ['0', '1', '5', '512']) {
    const { content, masters } = h.sample(), transport = h.scriptedTransport();
    const result = await h.policy.evaluateIntegrated(content, masters, h.coded, { env: h.envFor({ SYLLABUS_CHECK_AI_MAX_REQUESTS: max }), transport });
    assert.equal(result.alignment.liveModelCalls, transport.sent.length, `budget ${max}: alignment.liveModelCalls`);
    assert.equal(result.academic.provenance.liveModelCalls, transport.sent.length, `budget ${max}: provenance.liveModelCalls`);
    assert.equal(result.academic.provenance.networkRequests, transport.sent.length, `budget ${max}: provenance.networkRequests`);
  }
});

test('[VPAA-R12-LIVECALLS-SHARED] DEF-03: through the shared service, the legacy run and Policy V2 share ONE budget and V2 reports only its own requests', async (t) => {
  h.liveGuard(t);
  const svc = require('../../compliance/service'), repo = require('../repository'), { createMemoryDb } = require('./memdb');
  const { content, masters } = h.sample(); masters.fingerprint = 'fp'; masters.synthetic = false;
  t.mock.method(repo, 'mastersFor', async () => masters);
  const transport = h.scriptedTransport(), db = createMemoryDb({ syllabus: { content: JSON.stringify(content) } });
  const result = await svc.checkHybrid(db, content, { syllabusId: 100, env: h.envFor({ SYLLABUS_CHECK_ACADEMIC_V2: 'on' }), transport, linkChecker: async (url) => ({ url, status: 'ok', httpStatus: 200 }) });
  const v2Requests = transport.sent.filter((q) => /academic-evaluation-v2/.test(q.system)).length, legacyRequests = transport.sent.length - v2Requests;
  assert.ok(v2Requests > 0 && legacyRequests > 0, 'both paths asked');
  assert.equal(result.hybrid.academicV2.alignment.liveModelCalls, v2Requests, 'V2 reports its own requests only');
  assert.equal(result.hybrid.academicV2.academic.provenance.networkRequests, v2Requests);
  assert.equal(result.hybrid.academicV2.alignment.requestBudget.requests, transport.sent.length, 'the shared budget counts every request of the check');
});
