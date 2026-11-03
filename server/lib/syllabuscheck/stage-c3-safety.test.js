'use strict';
// Stage C3 is advice only. Offline, through Claude: the direct Anthropic provider, approved here for a fake transport. The global fetch is blocked for
// this whole file and no key is real. Whatever the C3 links say, or fail to say:
//   - the official result (score, pass at 79, readiness, deductions, blocking findings, every coded check) is the one a C3-off check gives;
//   - the submission gate decides as it does without C3, under the advisory and the required gate;
//   - the links are labelled as advice: the report's policy lists them, the problem list marks them "advice only", and the verdict never rates
//     them above MINOR and asks for a review, never a rewrite;
//   - while Claude cannot answer (not approved, down, or failing on the C3 requests only) every link is NOT_CHECKED, never a pass or a fail;
//   - nothing is invented: no rewrite target, suggestion, tag or mapping comes from C3, the syllabus is not changed, and an empty field is
//     neither sent nor judged.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const realFetch = globalThis.fetch;
let blocked = 0;
globalThis.fetch = async () => { blocked += 1; throw new TypeError('fetch failed (network blocked in stage-c3-safety.test.js)'); };
test.after(() => { globalThis.fetch = realFetch; });
const { resetProviderBlock } = require('./gemini');
const { run } = require('./engine');
const { sample } = require('./fixtures');
const { buildVerdict } = require('./verdict');
const { C3 } = require('./stages');
const { chainRows } = require('./lessonfit');
const repo = require('./repository');
const svc = require('../compliance/service');
const { contentHash } = require('../compliance/hash');
const clientModule = file => import(pathToFileURL(path.join(__dirname, '..', '..', '..', 'src', ...file.split('/'))).href);

const MODEL = 'claude-sonnet-5-5';
const CLAUDE = { SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'sk-ant-test-only-c3-safety-not-a-real-key', ANTHROPIC_MODEL: MODEL, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: MODEL };
const C3ON = { ...CLAUDE, SYLLABUS_CHECK_STAGE_C3: 'on' };
const RULES = ['ALN-11', 'ALN-12', 'ALN-13'];
const isChain = id => /-(contentactivity|contentassessment|activityassessment)$/.test(String(id || ''));
const linkChecker = async url => ({ url, status: 'ok', httpStatus: 200 });
const DRAFT = 'Revise the tasks so that they assess the topics this course content names.';
test.beforeEach(() => resetProviderBlock());
test.after(() => resetProviderBlock());

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_offline' } });
const reply = (text, stop = 'end_turn') => json({ id: 'msg_offline', type: 'message', role: 'assistant', model: MODEL, content: [{ type: 'text', text }], stop_reason: stop, stop_sequence: null, usage: { input_tokens: 1000, output_tokens: 200 } });
const hang = signal => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason || new Error('aborted')), { once: true }));
// Claude through the SDK's fetch. answer(pair) gives what differs from a verified ALIGNED answer quoting the pair's own texts (null leaves the pair out
// of the reply); fault(chain) may replace the whole reply to a request, `chain` saying whether that request asks about C3 links. A fault is an
// Anthropic error body ({ status, type, message?, details? }), a dropped connection ({ drop }), no answer before the deadline ({ hang }), or a reply
// with this text and stop reason ({ text, stop? }).
function claude({ answer = () => ({}), fault = () => null } = {}) {
  const calls = [];
  const transport = async (url, init) => {
    const batch = JSON.parse(JSON.parse(init.body).messages[0].content).document_data, chain = batch.some(p => isChain(p.id));
    calls.push({ chain, ids: batch.map(p => p.id) });
    const f = fault(chain);
    if (f && f.drop) throw new TypeError('fetch failed (a dropped connection, offline)');
    if (f && f.hang) return hang(init.signal);
    if (f && f.status) return json({ type: 'error', error: { type: f.type, message: f.message || `HTTP ${f.status}`, ...(f.details ? { details: f.details } : {}) }, request_id: 'req_offline' }, f.status);
    if (f && 'text' in f) return reply(f.text, f.stop);
    const judgements = batch.flatMap(p => {
      const v = answer(p);
      return v === null ? [] : [{ id: p.id, label: 'ALIGNED', explanation: 'Judged on the two texts.', sourceQuote: p.source.slice(0, 16), targetQuote: p.target.slice(0, 16), sourceBloom: 'N/A', targetBloom: 'N/A', draft: '', ...v }];
    });
    return reply(JSON.stringify({ judgements }));
  };
  return { calls, transport };
}
// The sample syllabus against masters that are not marked synthetic, so a completed check is ready and has a score (as in anthropic-lock.test.js).
const real = () => { const { content, masters } = sample(); delete masters.synthetic; return { content, masters }; };
async function check(env, { answer, fault, edit, timeoutMs } = {}) {
  resetProviderBlock();
  const { content, masters } = real();
  if (edit) edit(content);
  const before = structuredClone(content), model = claude({ answer, fault });
  const report = await run(content, masters, { useAi: true, env, transport: model.transport, linkChecker, sleep: async () => {}, ...(timeoutMs ? { anthropicTimeoutMs: timeoutMs } : {}) });
  return { report, content, before, calls: model.calls, verdict: buildVerdict(report, content, { all: true }).all };
}
// What a check decides officially: the score and its band, pass at 79, readiness, the deductions, the blocking findings, every coded check, whether
// the AI check completed, and the official scoring record.
const official = r => ({ score: r.score, baseScore: r.baseScore, passed: r.passed, status: r.status, overall: r.overall, band: r.band, ready: r.hybrid.ready, provisionalScore: r.hybrid.provisionalScore,
  deductions: r.hybrid.deductions, failed: r.conformance.failed.map(f => f.id), blocking: r.findings.filter(f => f.severity === 'blocking').map(f => f.id), codedChecks: r.hybrid.codedChecks.map(c => [c.id, c.status]),
  alignment: r.hybrid.alignment.status, scoring: r.hybrid.scoring.official });
const c3Findings = c => c.verdict.filter(f => RULES.includes(f.ruleId));
const chainOf = c => c.report.hybrid.alignment.judgements.filter(j => C3.types.includes(j.type));
const LINKS = 3 * chainRows(sample().content).length; // three links for each instructional lesson of the fixture
let healthy;
const withoutC3 = async () => (healthy = healthy || await check(CLAUDE));

test('whatever the C3 links say, the official result is the one a C3-off check gives', async () => {
  const off = await withoutC3();
  assert.deepEqual([off.report.score, off.report.passed, off.report.hybrid.ready, LINKS], [100, true, true, 45]);
  const outcomes = {
    'every link aligned': () => ({}),
    'every link partly aligned': p => (isChain(p.id) ? { label: 'PARTIALLY_ALIGNED', draft: DRAFT } : {}),
    'every link not aligned': p => (isChain(p.id) ? { label: 'NOT_ALIGNED', draft: DRAFT } : {}),
    'recommendations held back for review': p => (isChain(p.id) ? { label: 'NOT_ALIGNED', draft: 'Make the tasks assess the ILO through a complete application.' } : {}),
    'quotes found in no text': p => (isChain(p.id) ? { label: 'NOT_ALIGNED', sourceQuote: 'words that are in no text', targetQuote: 'nor are these' } : {}),
    'no answer for any link': p => (isChain(p.id) ? null : {}),
  };
  for (const [name, answer] of Object.entries(outcomes)) {
    const on = await check(C3ON, { answer });
    assert.equal(on.report.hybrid.alignment.stageC.c3.relationships, LINKS, name);
    assert.deepEqual(official(on.report), official(off.report), name);
    assert.ok(!on.report.hybrid.deductions.some(d => isChain(d.id)), `${name}: no deduction`);
    assert.ok(on.report.findings.filter(f => isChain(f.id)).every(f => f.severity === 'minor'), `${name}: never blocking or major`);
  }
  // Nor is a failing result rescued: with every scored ILO -> activity link failing, C3 links that all pass leave the failing score as it is.
  const failing = p => (/-ilo\d+-activity$/.test(p.id) ? { label: 'NOT_ALIGNED' } : {});
  const bad = await check(CLAUDE, { answer: failing }), badOn = await check(C3ON, { answer: failing });
  assert.deepEqual([bad.report.passed, bad.report.score < 79], [false, true]);
  assert.deepEqual(official(badOn.report), official(bad.report));
});

test('the submission gate decides as it does without C3: failing, unverified or unchecked C3 links never block, under either gate', async t => {
  const reports = {
    'C3 off': (await withoutC3()).report,
    'C3 not aligned': (await check(C3ON, { answer: p => (isChain(p.id) ? { label: 'NOT_ALIGNED', draft: DRAFT } : {}) })).report,
    'C3 unanswered': (await check(C3ON, { answer: p => (isChain(p.id) ? null : {}) })).report,
    'C3 requests failed': (await check(C3ON, { fault: chain => (chain ? { status: 529, type: 'overloaded_error' } : null) })).report,
  };
  const { content, masters } = real();
  masters.fingerprint = 'current-master';
  const hash = contentHash(content, svc.standard.version);
  let current = null;
  t.mock.method(repo, 'mastersFor', async () => masters);
  t.mock.method(repo, 'readReport', async () => current);
  const db = { query: async (sql, params) => {
    if (sql.startsWith('SELECT 1')) return [[]];
    if (sql.startsWith('SELECT * FROM ai_check_runs')) return [params[1] === hash ? [{ run_id: 7 }] : []];
    throw Error('Unexpected SQL: ' + sql);
  } };
  const saved = { SYLLABUS_CHECK_AI_GATE: process.env.SYLLABUS_CHECK_AI_GATE, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: process.env.SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL };
  t.after(() => { for (const [name, value] of Object.entries(saved)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } });
  process.env.SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL = MODEL;
  for (const gate of ['advisory', 'required']) {
    process.env.SYLLABUS_CHECK_AI_GATE = gate;
    const decisions = {};
    for (const [name, report] of Object.entries(reports)) {
      svc.resetInstalledCache();
      // As the repository stores a run: with the masters' fingerprint, checked a moment ago.
      current = { ...report, fingerprint: masters.fingerprint, hybrid: { ...report.hybrid, checkedAt: new Date().toISOString() } };
      decisions[name] = await svc.requireHybrid(db, 100, content).then(r => (r ? `submit (score ${r.score})` : 'submit (no AI check required)'), e => `refused: ${(e.body && e.body.code) || e.message}`);
    }
    const expected = gate === 'advisory' ? 'submit (no AI check required)' : 'submit (score 100)';
    assert.deepEqual(decisions, Object.fromEntries(Object.keys(reports).map(name => [name, expected])), gate);
  }
});

test('C3 findings are labelled as advice: the report lists them as advisory, the problem list marks them "advice only", and the verdict never rates them above MINOR', async () => {
  const on = await check(C3ON, { answer: p => (isChain(p.id) ? { label: p.id.endsWith('-contentactivity') ? 'NOT_ALIGNED' : 'PARTIALLY_ALIGNED', draft: DRAFT } : {}) });
  const off = await withoutC3();
  assert.deepEqual(C3.types.filter(type => on.report.hybrid.policy.advisoryTypes.includes(type)), C3.types);
  assert.ok(!C3.types.some(type => off.report.hybrid.policy.advisoryTypes.includes(type)), 'listed only in a report where C3 ran');
  assert.deepEqual([on.report.hybrid.policy.version, on.report.hybrid.scoring.official.policy], ['syllabus-policy-2', 'syllabus-policy-2'], 'the official policy is unchanged');
  const { problemsOf } = await clientModule('lib/hybridView.js');
  const problems = problemsOf(on.report.hybrid, on.report).filter(p => C3.types.includes(p.type));
  assert.equal(problems.length, LINKS);
  assert.ok(problems.every(p => p.advisory === true && p.severity === 'medium' && !p.points), 'shown with the "advice only" pill (HybridProblem.jsx), never as a deduction');
  const findings = c3Findings(on);
  assert.equal(findings.length, LINKS);
  assert.deepEqual([...new Set(findings.map(f => f.severity))], ['MINOR']);
  assert.ok(findings.every(f => f.recommendationType === 'REVIEW_REQUIRED'), 'a review, never a rewrite');
  // Both panels say so in English and Filipino.
  const i18n = await clientModule('i18n/index.js');
  try {
    for (const [lang, advice, score] of [['en', /advisory|advice only/i, /does not change the official score/i], ['tl', /payo lamang/i, /hindi nito binabago ang opisyal na marka/i]]) {
      i18n.setLanguage(lang);
      assert.match(i18n.t('verdict.title'), advice, lang);
      assert.match(i18n.t('verdict.note'), score, lang);
      assert.match(i18n.t('hybrid.advisory'), advice, lang);
    }
  } finally { i18n.setLanguage('en'); }
});

test('Claude not approved: nothing is sent, the official result is that of a server without AI, and every C3 rule is NOT_CHECKED, never a pass or a fail', async () => {
  const locked = { ...C3ON }, lockedOff = { ...CLAUDE };
  delete locked.SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL;
  delete lockedOff.SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL;
  const on = await check(locked), off = await check(lockedOff);
  assert.deepEqual([on.calls.length, off.calls.length], [0, 0]);
  assert.deepEqual(official(on.report), official(off.report));
  assert.deepEqual([on.report.score, on.report.passed], [null, false]);
  assert.equal(on.report.hybrid.alignment.stageC.c3.skipped, 'ai_unavailable');
  const findings = c3Findings(on);
  assert.deepEqual([...new Set(findings.map(f => f.ruleId))].sort(), RULES);
  assert.ok(findings.every(f => f.status === 'NOT_CHECKED' && f.recommendation === null));
});

test('Claude down for every request: the check stays incomplete exactly as without C3, C3 is not asked, and every C3 rule is NOT_CHECKED', async () => {
  for (const [label, fault] of [['overloaded (529)', { status: 529, type: 'overloaded_error' }], ['server error (500)', { status: 500, type: 'api_error' }], ['dropped connection', { drop: true }]]) {
    const on = await check(C3ON, { fault: () => fault }), off = await check(CLAUDE, { fault: () => fault });
    assert.deepEqual([on.report.score, on.report.passed, on.report.hybrid.ready], [null, false, false], label);
    assert.deepEqual(official(on.report), official(off.report), label);
    assert.ok(!on.calls.some(c => c.chain), `${label}: C3 is not asked after the provider failed`);
    const findings = c3Findings(on);
    assert.deepEqual([...new Set(findings.map(f => f.ruleId))].sort(), RULES, label);
    assert.ok(findings.every(f => f.status === 'NOT_CHECKED'), label);
  }
});

test('Claude failing on the C3 requests only: the completed official check is untouched, and every link is NOT_CHECKED, none dropped and none passed', async () => {
  const off = await withoutC3();
  const faults = [
    ['overloaded (529) on every attempt', { status: 529, type: 'overloaded_error' }],
    ['server error (500) on every attempt', { status: 500, type: 'api_error' }],
    ['dropped connection on every attempt', { drop: true }],
    ['request refused (400)', { status: 400, type: 'invalid_request_error' }],
    ['spend limit reached', { status: 429, type: 'rate_limit_error', message: 'This request would exceed the monthly spend limit of your usage tier.', details: { error_code: 'enforced_spend_limit_reached' } }],
    ['credit balance exhausted', { status: 400, type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.' }],
    ['no answer before the deadline', { hang: true }],
    ['refusal', { text: '', stop: 'refusal' }],
    ['cut off at max_tokens', { text: '{"judgements": [', stop: 'max_tokens' }],
    ['an answer that is not JSON', { text: 'The links look reasonable overall.' }],
  ];
  for (const [label, fault] of faults) {
    const on = await check(C3ON, { fault: chain => (chain ? fault : null), timeoutMs: fault.hang ? 100 : undefined });
    assert.deepEqual(official(on.report), official(off.report), label);
    const chain = chainOf(on), findings = c3Findings(on);
    assert.deepEqual([chain.length, findings.length], [LINKS, LINKS], `${label}: every link listed`);
    assert.ok(chain.every(j => j.label === 'INSUFFICIENT_EVIDENCE' && j.unverified), label);
    assert.ok(findings.every(f => f.status === 'NOT_CHECKED' && f.recommendation === null), label);
  }
});

const fromC3 = item => [item.relationshipId, item.id, ...(item.basedOn || [])].some(id => isChain(String(id || '').replace(/^SEM:/, '')));

test('C3 invents nothing: an answer that claims a rewrite target, a tag or a mapping is refused, not applied, and the syllabus is unchanged', async () => {
  const off = await withoutC3();
  for (const [label, claim] of [['a rewrite target', { targetPath: 'plan[3].tasks' }], ['CLO tags', { suggestedTags: ['CLO 2'] }], ['a mapping', { mapping: { ilo: 'CLO 2' } }]]) {
    const on = await check(C3ON, { answer: p => (isChain(p.id) ? { label: 'NOT_ALIGNED', draft: DRAFT, ...claim } : {}) });
    assert.deepEqual(on.content, on.before, `${label}: the syllabus is not changed`);
    const chain = chainOf(on);
    assert.equal(chain.length, LINKS, label);
    assert.ok(chain.every(j => j.label === 'INSUFFICIENT_EVIDENCE' && j.unverified && j.failureKind === 'invalid_output' && j.targetPath === null), `${label}: refused by the answer schema`);
    assert.ok(c3Findings(on).every(f => f.status === 'NOT_CHECKED' && f.recommendation === null), label);
    assert.deepEqual([on.report.hybrid.suggestions.filter(fromC3), (on.report.hybrid.mappingAdvice || []).filter(fromC3)], [[], []], label);
    assert.deepEqual(official(on.report), official(off.report), label);
  }
});

test('C3 invents nothing: its advice adds no rewrite, suggestion or mapping, and an empty field is neither sent nor judged while the other lessons are', async () => {
  const emptyActivities = content => { content.plan[2].activities = ''; };
  const on = await check(C3ON, { answer: p => (isChain(p.id) ? { label: 'NOT_ALIGNED', draft: DRAFT } : {}), edit: emptyActivities }), off = await check(CLAUDE, { edit: emptyActivities });
  assert.deepEqual(on.content, on.before, 'the syllabus is not changed');
  const chain = chainOf(on);
  assert.ok(chain.every(j => j.targetPath === null), 'no rewrite target');
  assert.deepEqual([on.report.hybrid.suggestions.filter(fromC3), (on.report.hybrid.mappingAdvice || []).filter(fromC3)], [[], []]);
  // Every rewrite offered with C3 on is one the C3-off check offers too: C3 can only hold a rewrite back (content first, then activities, then tasks).
  const offered = new Set(off.report.hybrid.suggestions.map(s => JSON.stringify(s)));
  assert.ok(on.report.hybrid.suggestions.every(s => offered.has(JSON.stringify(s))));
  assert.ok(c3Findings(on).filter(f => f.recommendation).every(f => f.recommendationType === 'REVIEW_REQUIRED'), 'advice for review, never a rewrite');
  // Lesson 2 has no learning activities: its content -> activities and activities -> tasks links are not sent, and are not checked.
  const sent = new Set(on.calls.flatMap(c => c.ids));
  for (const id of ['row2-contentactivity', 'row2-activityassessment']) {
    assert.equal(sent.has(id), false, id);
    const j = chain.find(x => x.id === id);
    assert.deepEqual([j.label, j.failureKind], ['INSUFFICIENT_EVIDENCE', 'insufficient_text'], id);
    assert.equal(on.verdict.find(f => f.relationshipId === id).status, 'NOT_CHECKED', id);
  }
  assert.ok(sent.has('row2-contentassessment'), 'the link whose two texts exist is still asked');
  // The empty field leaves the scored check incomplete. The C3 links of every other lesson are still asked and answered, and the official result is
  // the one the C3-off check gives.
  assert.equal(on.report.hybrid.alignment.status, 'not_evaluated');
  const c3 = on.report.hybrid.alignment.stageC.c3;
  assert.deepEqual([c3.skipped, c3.noText, c3.verified], [undefined, 2, LINKS - 2]);
  assert.deepEqual(official(on.report), official(off.report));
});

test('nothing in this file reached the network', () => {
  assert.equal(blocked, 0);
});
