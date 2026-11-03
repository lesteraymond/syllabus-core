// Stage E.2: the whole pipeline with EVERY advisory stage on, on representative 18-week syllabi for BSIT, BSIE and BSCpE
// (eval/programSyllabi.js: real curriculum identity and outcomes, synthetic plans). Each program is checked aligned and with deliberate errors in
// the weekly content, the CLO mapping, an ILO, an ILO tag, an activity, an assessment, the values and the references.
// For every case: (1) the official result (score, pass, ready, deductions, blocking findings, summary) is identical with all stages on and all off;
// (2) no two recommendations contradict each other (contradictionsOf below); (3) the advisory verdict is never positive for a defective syllabus.
// The model is a scripted fake: the scenario says which relationships it rejects. No test reaches a provider.
const test = require('node:test');
const assert = require('node:assert/strict');
const { run, coded } = require('./engine');
const gemini = require('./gemini');
const { resetProviderBlock, aspectKeysFor, isNoRewrite } = gemini;
const { stageFlags } = require('./stages');
const { buildVerdict } = require('./verdict');
const { titleDecisionChanged } = require('./titles');
const { NEEDS_IDENTITY } = require('./identity');
const { programSyllabus, PROGRAMS } = require('./eval/programSyllabi');

test.afterEach(() => resetProviderBlock());
const STAGES = ['A', 'B', 'B3', 'B4', 'C1', 'C2', 'D1', 'D2'];
const KEY = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only', SYLLABUS_CHECK_VALUES_FILE: 'no-such-file.json' };
const ALL = { ...KEY, ...Object.fromEntries(STAGES.map(k => ['SYLLABUS_CHECK_STAGE_' + k, 'on'])) }, NONE = { ...KEY };
const base = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) };
// Stage E.4: STAGED_BATCH (4) relationships per request in up to 7 passes, each relationship asked once: at most ceil(asked / 4) + 7 requests for a
// clean run, and never above 64 (see stage-e.test.js; the measured all-stages count of these syllabi is 48, scripts/measure-request-volume.cjs).
const requestCeiling = log => Math.min(Math.ceil(log.asked.length / gemini.STAGED_BATCH) + 7, 64);
const GOOD = { 'Activity-fit': { teaching: 'sound', learnerSupport: 'adequate' }, 'Assessment-fit': { measures: 'yes', evidence: 'observable', level: 'matches' }, 'Value-use': { valueUse: 'integrated', carriedBy: 'activity', valueFit: 'fits' }, 'Ref-relevance': { relevance: 'relevant', basis: 'title_and_venue' }, 'Value-map': { coreValue: 'Community-orientedness', integration: 'demonstrated' } };
const BAD = { 'Activity-fit': { teaching: 'weak', learnerSupport: 'limited' }, 'Assessment-fit': { measures: 'no', evidence: 'vague', level: 'too_low' }, 'Value-use': { valueUse: 'name_only', carriedBy: 'none', valueFit: 'partly' }, 'Ref-relevance': { relevance: 'unrelated', basis: 'title_only' }, 'Value-map': { coreValue: 'insufficient', integration: 'stated_only' } };
// rules: [regex over "Type:id", label, fields?, answer?]; the first match wins; everything else is ALIGNED. An empty side cannot be judged.
// answer(pair) may override the explanation and quotes, as a real model names the CLO or PO it found ("CLO 2 ...") and quotes it.
function oracle(rules, env, log) {
  const keys = aspectKeysFor(stageFlags(env)); log.asked = []; log.requests = 0;
  return async (url, req) => {
    log.requests += 1;
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    log.asked.push(...batch.map(p => p.type + ':' + p.id));
    const answer = pair => {
      const empty = !pair.source.trim() || !pair.target.trim();
      const rule = rules.find(([re]) => re.test(pair.type + ':' + pair.id));
      const label = empty ? 'INSUFFICIENT_EVIDENCE' : rule ? rule[1] : 'ALIGNED';
      const fields = rule && rule[2] ? rule[2] : label === 'ALIGNED' ? GOOD[pair.type] : BAD[pair.type];
      return { id: pair.id, label, explanation: 'Judged by the scripted test model.', sourceQuote: empty ? '' : pair.source.slice(0, 14), targetQuote: empty ? '' : pair.target.slice(0, 14), sourceBloom: 'N/A', targetBloom: 'N/A',
        draft: label === 'ALIGNED' || label === 'INSUFFICIENT_EVIDENCE' || isNoRewrite(pair.type) ? '' : 'MODEL-DRAFT for ' + pair.id, ...Object.fromEntries(keys.map(k => [k, 'not_assessed'])), ...(fields || {}), ...(rule && rule[3] ? rule[3](pair) : {}) };
    };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
}
async function check(s, { rules = [], env = ALL, mutate, extra = {} } = {}) {
  const content = structuredClone(s.content);
  if (mutate) mutate(content, s);
  const log = {};
  resetProviderBlock();
  const result = await run(structuredClone(content), s.masters, { ...base, env, transport: oracle(rules, env, log), ...extra });
  return { result, verdict: result.hybrid.verdict, log, content };
}
const official = r => JSON.stringify([r.score, r.passed, r.hybrid.ready, r.hybrid.deductions.map(d => [d.id, d.points]), r.conformance.failed.map(f => f.id).sort(), r.hybrid.summary.status]);
const at = (r, path) => (r.hybrid.suggestions || []).filter(s => s.path === path);

const { contradictionsOf } = require('./eval/contradictions'); // the shared definition of a contradiction

// ---- the scenarios (row indexes: 0 orientation, 5/11/17 examinations; the same layout in the three programs) ----
const OFF_PO = { bsit: [5], bsie: [8], bscpe: [8] };
const names = (prefix, n) => pair => { const line = pair.source.split(/\r?\n/).find(l => l.startsWith(`${prefix} ${n}:`)) || ''; return { explanation: `${prefix} ${n} fits this text.`, sourceQuote: line.slice(0, 40) }; };
const SCENARIOS = {
  aligned: {},
  'weekly content': { mutate: c => { c.plan[2].contents = 'Folk dance steps and costume design for the cultural festival'; }, rules: [[/^Content-course:row2-content$/, 'NOT_ALIGNED'], [/^(ILO-content|Content-ILO):row2-ilo0-/, 'NOT_ALIGNED']],
    expect: ({ result, verdict, log }) => {
      assert.ok(verdict.findings.some(f => f.legacyRuleId === 'Content-course' && /plan\[2\]/.test(f.path) && f.responsible === 'course_content'));
      assert.ok(at(result, 'plan[2].contents').length === 1, 'the content is the field to change');
      for (const field of ['activities', 'tasks', 'values', 'ilos[0].text']) assert.deepEqual(at(result, `plan[2].${field}`), [], `no ${field} rewrite`);
      assert.ok(!log.asked.some(a => /^(Activity-fit|Assessment-fit|Value-use|Value-map):row2-/.test(a)));
    } },
  'CLO mapping': { mutate: (c, s) => { c.clos[1].pos = OFF_PO[s.key]; }, rules: [[/^CLO-PO:clo1-po/, 'NOT_ALIGNED'], [/^CLO-anyPO:clo1-anypo$/, 'ALIGNED', null, pair => {
    const no = /Apply computing/.test(pair.source) ? 7 : 3; // BSIT PO 7 / engineering PO 3: an approved PO the CLO does fit
    const line = pair.source.split(/\r?\n/).find(l => l.trim().startsWith(`${no}. `)) || '';
    return { explanation: `PO ${no} fits this CLO.`, sourceQuote: line.trim().slice(0, 40) };
  }]],
    expect: ({ result, verdict }) => {
      assert.ok(verdict.findings.some(f => f.ruleId === 'CLO-06' && /clos\[1\]/.test(f.path) && f.status !== 'PASS'));
      assert.ok((result.hybrid.mappingAdvice || []).some(a => a.type !== 'CLO' && a.cloIndex === 1), 'the advice is to re-tag the CLO to an approved PO');
      assert.deepEqual(at(result, 'clos[1].statement').filter(s => (s.basedOn || []).every(b => /clo1-po/.test(b))), [], 'a sound CLO is not rewritten to fit a wrong tag');
    } },
  ILO: { mutate: c => { c.plan[7].ilos[0].text = 'Bake bread using the straight-dough method and evaluate its texture.'; }, rules: [[/^(Content-ILO|ILO-content|ILO-CLO|ILO-anyCLO|ILO-activity|ILO-assessment):row7-ilo0-/, 'NOT_ALIGNED']],
    expect: ({ result, verdict }) => {
      assert.ok(verdict.findings.some(f => f.legacyRuleId === 'Content-ILO' && /plan\[7\]/.test(f.path) && f.responsible === 'ilo'));
      assert.equal(at(result, 'plan[7].ilos[0].text').length, 1, 'the ILO is the field to change');
      for (const field of ['contents', 'activities', 'tasks', 'values']) assert.deepEqual(at(result, `plan[7].${field}`), [], `the ${field} of a lesson with a wrong ILO is not rewritten`);
    } },
  'ILO tag': { mutate: c => { c.plan[8].ilos[0].tags = ['clo:c4']; }, rules: [[/^ILO-CLO:row8-ilo0-clo/, 'NOT_ALIGNED'], [/^ILO-anyCLO:row8-ilo0-anyclo$/, 'ALIGNED', null, names('CLO', 2)]],
    expect: ({ result }) => {
      assert.ok((result.hybrid.mappingAdvice || []).some(a => a.type === 'CLO' && a.rowIndex === 8), 'the advice is to re-tag');
      assert.deepEqual(at(result, 'plan[8].ilos[0].text'), [], 'the sound ILO is not rewritten');
    } },
  activity: { mutate: c => { c.plan[9].activities = '- Watch a full-length movie and write a reaction paper about the actors.'; }, rules: [[/^ILO-activity:row9-/, 'NOT_ALIGNED']],
    expect: ({ result, verdict, log }) => {
      assert.ok(verdict.findings.some(f => f.legacyRuleId === 'ILO-activity' && /plan\[9\]/.test(f.path) && f.responsible === 'activity' && f.status === 'FAIL'));
      assert.equal(at(result, 'plan[9].activities').length, 1);
      for (const field of ['tasks', 'values']) assert.deepEqual(at(result, `plan[9].${field}`), [], `no ${field} rewrite`);
      assert.ok(!log.asked.some(a => /^(Activity-fit|Value-use|Value-map):row9-/.test(a)));
    } },
  assessment: { mutate: c => { c.plan[10].tasks = '- Multiple-choice quiz recalling the names of famous scientists.'; }, rules: [[/^ILO-assessment:row10-/, 'NOT_ALIGNED']],
    expect: ({ result, verdict, log }) => {
      assert.ok(verdict.findings.some(f => f.legacyRuleId === 'ILO-assessment' && /plan\[10\]/.test(f.path) && f.responsible === 'assessment'));
      assert.equal(at(result, 'plan[10].tasks').length, 1); assert.deepEqual(at(result, 'plan[10].values'), []);
      assert.ok(!log.asked.some(a => /^(Value-use|Value-map):row10-/.test(a)));
    } },
  'assessment level': { mutate: c => { c.plan[12].tasks = '- Quiz: define the main term of this lesson.'; }, rules: [[/^Assessment-fit:row12-assessfit$/, 'PARTIALLY_ALIGNED', { measures: 'partly', evidence: 'observable', level: 'too_low' }]],
    expect: ({ verdict }) => assert.ok(verdict.findings.some(f => f.ruleId === 'ALN-09' && /plan\[12\]/.test(f.path) && f.status === 'NEEDS_REVIEW')) },
  'values named only': { mutate: c => { c.plan[13].values = 'Compassion'; }, rules: [[/^Value-use:row13-valueuse$/, 'PARTIALLY_ALIGNED']],
    expect: ({ verdict }) => assert.ok(verdict.findings.some(f => f.ruleId === 'VAL-03' && /plan\[13\]/.test(f.path) && f.status !== 'PASS')) },
  'supporting values, no evidence': { mutate: c => { c.plan[14].values = '• Respect\n• Cooperation'; }, rules: [[/^Value-map:row14-valuemap$/, 'NOT_ALIGNED'], [/^Module-value:row14-value$/, 'NOT_ALIGNED']],
    expect: ({ result, verdict }) => {
      assert.deepEqual(at(result, 'plan[14].values'), [], 'no value is chosen for the author');
      assert.equal(result.hybrid.unresolved.find(u => u.path === 'plan[14].values').reason, 'value_needs_review');
      assert.ok(verdict.findings.some(f => f.ruleId === 'VAL-05' && f.path === 'plan[14].values' && f.status === 'NEEDS_REVIEW'));
      assert.ok(result.hybrid.deductions.some(d => d.id === 'VALUE:plan[14].values'), 'the official finding and point stay');
    } },
  'supporting value with evidence': { mutate: c => { c.plan[15].values = 'Cooperation'; }, rules: [[/^Value-map:row15-valuemap$/, 'ALIGNED'], [/^Module-value:row15-value$/, 'NOT_ALIGNED']],
    expect: ({ result }) => {
      const u = result.hybrid.unresolved.find(x => x.path === 'plan[15].values');
      assert.equal(u.reason, 'value_supported'); assert.equal(u.value, 'Community-orientedness');
      assert.deepEqual(at(result, 'plan[15].values'), [], 'the faculty text is kept; nothing is rewritten');
    } },
  'competency instead of a value': { mutate: c => { c.plan[16].values = 'Critical Thinking'; }, rules: [[/^Module-value:row16-value$/, 'NOT_ALIGNED']],
    expect: ({ result, verdict, log }) => {
      assert.ok(!log.asked.includes('Value-map:row16-valuemap'), 'a competency is not mapped to a core value');
      assert.equal(at(result, 'plan[16].values').length, 1, 'the grounded draft from the scored question is offered');
      assert.ok(verdict.findings.some(f => f.ruleId === 'VAL-05' && f.path === 'plan[16].values' && /draft written from this lesson/.test(f.recommendation)));
    } },
  'no value at all': { mutate: c => { c.plan[3].values = ''; },
    expect: ({ result, verdict }) => {
      assert.deepEqual(at(result, 'plan[3].values'), []); assert.equal(result.hybrid.unresolved.find(u => u.path === 'plan[3].values').reason, 'value_needs_review');
      const v = verdict.findings.find(f => f.ruleId === 'VAL-01' && f.path === 'plan[3].values');
      assert.equal(v.status, 'FAIL'); assert.match(v.recommendation, /does not choose one/);
    } },
  references: {
    mutate: c => {
      c.refs.books.items[1].t = 'Reyes, L. (2018). Principles of marketing management. Example Press.';
      c.refs.books.items[0].t += ' https://doi.org/10.5555/example.2022.001';
      c.refs.online.items[0].t = 'Example Learning Network. Control statements. Accessed 2 Aug. 2024.';
    },
    rules: [[/^Ref-relevance:ref-books-1$/, 'NOT_ALIGNED']], envExtra: { SYLLABUS_CHECK_REF_VERIFY: 'crossref' }, extra: { refFetch: async () => null },
    expect: ({ verdict }) => {
      assert.ok(verdict.findings.some(f => f.ruleId === 'REF-05' && f.path === 'refs.books.items[1]' && f.status === 'FAIL'), 'irrelevant source');
      assert.ok(verdict.findings.some(f => /^REF-0[23]$/.test(f.ruleId) && f.path === 'refs.online.items[0]' && f.status === 'FAIL'), 'malformed reference');
      const doi = verdict.findings.find(f => f.ruleId === 'REF-04' && f.path === 'refs.books.items[0]' && f.authenticity === 'not_found');
      assert.ok(doi && doi.status === 'NEEDS_REVIEW', 'a DOI missing from Crossref is reviewed, never rejected');
      assert.ok(!verdict.findings.some(f => f.path === 'refs.books.items[0]' && f.ruleId === 'REF-02' && f.status === 'FAIL'), 'a well-formed reference is not failed for its DOI');
    } },
};
SCENARIOS['title capitalisation (shadow policy)'] = {
  mutate: (c, s) => { c.meta.title = s.record.title.toLowerCase().replace(/\b[a-z]/g, ch => ch.toUpperCase()); },
  expect: ({ result, verdict }) => {
    const f = verdict.findings.find(x => x.ruleId === 'CUR-04' && x.path === 'meta.title');
    assert.equal(f.status, 'FAIL', 'mirrors the official decision in force'); assert.match(f.explanation, /still required to submit/);
    assert.deepEqual(verdict.informational, [], 'no "formatting only" note while the official check fails it');
    assert.equal(at(result, 'meta.title').length, 1, 'the official panel asks for the approved spelling');
    assert.equal(result.passed, false);
  },
};
SCENARIOS.combined = {
  mutate: (c, s) => { for (const name of ['weekly content', 'activity', 'supporting values, no evidence', 'references']) SCENARIOS[name].mutate(c, s); },
  rules: ['weekly content', 'activity', 'supporting values, no evidence', 'references'].flatMap(name => SCENARIOS[name].rules),
  envExtra: SCENARIOS.references.envExtra, extra: SCENARIOS.references.extra,
  expect: ctx => { for (const name of ['weekly content', 'activity', 'supporting values, no evidence', 'references']) SCENARIOS[name].expect(ctx); },
};

for (const key of PROGRAMS) {
  const s = programSyllabus(key);
  test(`${s.label}: the aligned 18-week syllabus passes officially with every stage on, and the advisory verdict is not negative`, async () => {
    const on = await check(s, { env: ALL }), off = await check(s, { env: NONE });
    assert.equal(on.result.passed, true); assert.equal(on.result.hybrid.ready, true); assert.equal(on.result.score, 100);
    assert.equal(official(on.result), official(off.result));
    assert.deepEqual(contradictionsOf(on.result, on.content), []);
    assert.equal(on.verdict.counts.FAIL, 0); assert.notEqual(on.verdict.overall, 'NOT_COMPLIANT');
    assert.equal(on.verdict.states.curriculum, 'PASS'); assert.equal(on.verdict.states.academicAlignment, 'PASS');
    assert.equal(on.verdict.states.references.authenticity, 'NOT_CHECKED', 'authenticity is not claimed without a lookup');
    assert.ok(on.log.requests <= requestCeiling(on.log), 'requests: ' + on.log.requests);
  });
  for (const [name, sc] of Object.entries(SCENARIOS)) {
    if (name === 'aligned') continue;
    test(`${s.label}: ${name} - the field responsible is named, no recommendation contradicts another, and the official result does not depend on the stages`, async () => {
      const env = { ...ALL, ...(sc.envExtra || {}) };
      const on = await check(s, { env, rules: sc.rules, mutate: sc.mutate, extra: sc.extra }), off = await check(s, { env: NONE, rules: sc.rules, mutate: sc.mutate });
      assert.equal(official(on.result), official(off.result), 'official result');
      assert.deepEqual(contradictionsOf(on.result, on.content), []);
      assert.notEqual(on.verdict.overall, 'COMPLIANT');
      sc.expect(on);
    });
  }
}

// ---------------- Decision 1: the normalised title, check and submission gate together ----------------
async function withPolicy(policy, fn) {
  const before = process.env.SYLLABUS_CHECK_TITLE_POLICY;
  if (policy === undefined) delete process.env.SYLLABUS_CHECK_TITLE_POLICY; else process.env.SYLLABUS_CHECK_TITLE_POLICY = policy;
  try { return await fn(); } finally { if (before === undefined) delete process.env.SYLLABUS_CHECK_TITLE_POLICY; else process.env.SYLLABUS_CHECK_TITLE_POLICY = before; }
}
const titleCase = text => String(text).toLowerCase().replace(/\b[a-z]/g, ch => ch.toUpperCase());
const gateBlocks = (content, masters) => coded(content, masters).findings.some(f => f.severity === 'blocking'); // what compliance/service.js requireHybrid checks
for (const key of PROGRAMS) {
  const s = programSyllabus(key);
  test(`${s.label}: normalised titles - a capitalisation-only title opens the gate only under the normalized policy, and the check and the submission gate always agree`, async () => {
    const mutate = c => { c.meta.title = titleCase(s.record.title); };
    for (const policy of [undefined, 'shadow', 'exact', 'normalized']) {
      await withPolicy(policy, async () => {
        const env = { ...ALL, ...(policy ? { SYLLABUS_CHECK_TITLE_POLICY: policy } : {}) };
        const { result, content } = await check(s, { env, mutate });
        const blocked = gateBlocks(content, s.masters);
        assert.equal(result.hybrid.ready, !blocked, `policy ${policy || 'default'}: the check and the gate agree`);
        assert.equal(result.passed, policy === 'normalized', `policy ${policy || 'default'}`);
        assert.equal(result.hybrid.titlePolicy.mode, policy || 'shadow');
        assert.equal(result.hybrid.provisionalScore, 100, 'the points total never depends on the title');
        assert.equal(result.score, result.hybrid.ready ? 100 : null, 'but a blocking title withholds the published score');
        if (policy === 'normalized') assert.equal(result.hybrid.shadowCurriculum.title.legacyStatus, 'FAIL', 'the old decision stays visible');
      });
    }
  });
  test(`${s.label}: normalised titles never accept a different title, a missing parenthetical, or changes to code, units, prerequisite or curriculum year`, async () => {
    await withPolicy('normalized', async () => {
      const env = { ...ALL, SYLLABUS_CHECK_TITLE_POLICY: 'normalized' };
      const cases = [c => { c.meta.title = 'Introduction To Something Else'; }, c => { c.meta.title = titleCase(s.record.title.replace(/\s*\(.*\)\s*$/, '')) + ' 2'; }, c => { c.meta.prereq = 'XX 101'; }, c => { c.meta.lecture = '9'; }, c => { c.meta.curriculumYear = '1999-2000'; }];
      if (/\(/.test(s.record.title)) cases.push(c => { c.meta.title = s.record.title.replace(/\s*\(.*\)\s*$/, ''); });
      for (const mutate of cases) {
        const { result, content } = await check(s, { env, mutate });
        assert.equal(result.passed, false); assert.ok(gateBlocks(content, s.masters), 'the submission gate blocks it too');
      }
    });
  });
}
test('a stored report becomes out of date only when the policy in force would decide its own title differently', () => {
  const report = status => ({ hybrid: { codedChecks: [{ ruleId: 'CUR-FIELD', path: 'meta.title', status, evidence: { actual: 'Systems Engineering', expected: 'SYSTEMS ENGINEERING' } }] } });
  assert.equal(titleDecisionChanged(report('FAIL'), { SYLLABUS_CHECK_TITLE_POLICY: 'normalized' }), true);
  assert.equal(titleDecisionChanged(report('FAIL'), { SYLLABUS_CHECK_TITLE_POLICY: 'shadow' }), false);
  assert.equal(titleDecisionChanged(report('PASS'), { SYLLABUS_CHECK_TITLE_POLICY: 'exact' }), true, 'a rollback makes the normalised report out of date');
  const different = { hybrid: { codedChecks: [{ ruleId: 'CUR-FIELD', path: 'meta.title', status: 'FAIL', evidence: { actual: 'Systems Thinking', expected: 'SYSTEMS ENGINEERING' } }] } };
  assert.equal(titleDecisionChanged(different, { SYLLABUS_CHECK_TITLE_POLICY: 'normalized' }), false);
  assert.equal(titleDecisionChanged({}, {}), false); assert.equal(titleDecisionChanged({ hybrid: {} }, {}), false);
});

// ---------------- Decision 3: no blind value recommendation ----------------
test('the old fallback is gone: no lesson is ever told to "Integrate Compassion" from keywords; the official result is identical to the legacy template', async () => {
  for (const key of PROGRAMS) {
    const s = programSyllabus(key);
    const mutate = c => { for (const i of [3, 7, 13]) c.plan[i].values = ''; };
    for (const env of [NONE, ALL]) {
      const now = await check(s, { env, mutate }), legacy = await check(s, { env: { ...env, SYLLABUS_CHECK_VALUE_SUGGESTION: 'legacy' }, mutate });
      assert.equal(official(now.result), official(legacy.result), `${key}: identical official result`);
      assert.ok(!now.result.hybrid.suggestions.some(x => /explain how the module's decisions affect other people/.test(x.text)), `${key}: no template`);
      assert.ok(legacy.result.hybrid.suggestions.some(x => /explain how the module's decisions affect other people/.test(x.text)), `${key}: the rollback switch restores it`);
      for (const i of [3, 7, 13]) assert.equal(now.result.hybrid.unresolved.find(u => u.path === `plan[${i}].values`).status, 'NEEDS_REVIEW');
    }
  }
});
test('the template used to displace an evidence-based draft for the same field; now the grounded draft is what the author sees', async () => {
  const s = programSyllabus('bsit');
  const mutate = c => { c.plan[13].values = 'Critical Thinking'; };
  const rules = [[/^Module-value:row13-value$/, 'NOT_ALIGNED']];
  const now = await check(s, { env: NONE, rules, mutate }), legacy = await check(s, { env: { ...NONE, SYLLABUS_CHECK_VALUE_SUGGESTION: 'legacy' }, rules, mutate });
  assert.equal(at(now.result, 'plan[13].values')[0].text, 'MODEL-DRAFT for row13-value');
  assert.match(at(legacy.result, 'plan[13].values')[0].text, /^(Compassion|Interiority|Community-orientedness): explain how/);
});

// ---------------- Decision 4: wrong course code ----------------
for (const key of PROGRAMS) {
  const s = programSyllabus(key);
  test(`${s.label}: a wrong course code - no AI request by default, every independent check still reports, and no curriculum-dependent claim is made`, async () => {
    const mutate = c => { c.meta.code = 'XX 999'; c.plan[4].contents = 'TBD'; c.clos.pop(); };
    const off = await check(s, { env: ALL, mutate });
    assert.equal(off.log.requests, 0); assert.equal(off.result.score, 0); assert.equal(off.result.passed, false);
    assert.equal(off.verdict.states.identity.status, 'code_not_found'); assert.equal(off.verdict.states.curriculum, 'FAIL');
    assert.ok(off.verdict.findings.some(f => f.ruleId === 'CLO-01' && f.status === 'FAIL'), 'the CLO count still reports');
    assert.ok(off.verdict.findings.some(f => f.ruleId === 'STR-05' && /plan\[4\]/.test(f.path)), 'placeholder detection still reports');
    const on = await check(s, { env: { ...ALL, SYLLABUS_CHECK_PROVISIONAL_AI: 'on' }, mutate });
    assert.ok(on.log.requests > 0);
    const all = buildVerdict(on.result, on.content, { all: true }).all;
    assert.ok(!all.some(f => NEEDS_IDENTITY.has(f.legacyRuleId) && f.status === 'PASS'), 'no claim that the CLOs or plan fit the course');
    const J = new Map(on.result.hybrid.alignment.judgements.map(j => [j.id, j]));
    assert.ok(!on.result.hybrid.suggestions.some(x => (x.basedOn || []).some(b => NEEDS_IDENTITY.has(J.get(String(b).replace(/^SEM:/, ''))?.type))), 'no course-specific rewrite');
    assert.equal(on.result.score, 0); assert.notEqual(on.verdict.overall, 'COMPLIANT');
  });
}

// ---------------- the contradiction check is not vacuous: it catches the two defects corrected in this round ----------------
test('without the new precedence rule, a correct week content would be rewritten to fit a wrong ILO, and the check reports it', async () => {
  const fit = require('./lessonfit');
  const original = fit.draftWithheld;
  const s = programSyllabus('bsit'), sc = SCENARIOS.ILO;
  try {
    fit.draftWithheld = (type, ...rest) => (type === 'ILO-content' ? null : original(type, ...rest)); // the behaviour before Stage E.2
    const before = await check(s, { env: ALL, rules: sc.rules, mutate: sc.mutate });
    assert.ok(contradictionsOf(before.result, before.content).some(x => /week 8 content that was verified/.test(x)), 'the old behaviour is a contradiction');
  } finally { fit.draftWithheld = original; }
  const after = await check(s, { env: ALL, rules: sc.rules, mutate: sc.mutate });
  assert.deepEqual(contradictionsOf(after.result, after.content), []);
});
test('the legacy value template contradicts the values question; the corrected behaviour does not', async () => {
  const s = programSyllabus('bsie'), sc = SCENARIOS['supporting values, no evidence'];
  const legacy = await check(s, { env: { ...ALL, SYLLABUS_CHECK_VALUE_SUGGESTION: 'legacy' }, rules: sc.rules, mutate: sc.mutate });
  assert.ok(contradictionsOf(legacy.result, legacy.content).some(x => /values question answered for week 15/.test(x)));
  const now = await check(s, { env: ALL, rules: sc.rules, mutate: sc.mutate });
  assert.deepEqual(contradictionsOf(now.result, now.content), []);
});

// ---------------- English / Tagalog: every fixed sentence these rounds show to faculty has a translation ----------------
test('the values, title and identity sentences the verdict shows, and the new "needs your decision" reasons, exist in English and Tagalog', async () => {
  const path = require('node:path'), { pathToFileURL } = require('node:url');
  const { hybridEn, hybridTl } = await import(pathToFileURL(path.join(__dirname, '..', '..', '..', 'src', 'i18n', 'hybrid.js')).href);
  // the same matching as tr() in src/i18n/index.js: the exact text, or a pattern in which a numeric placeholder ({week}, {count} ...) stands for digits
  // and any other placeholder for words; a pattern with fewer than 12 fixed characters is not used unless all its placeholders are numeric
  const NUMERIC = ['count', 'number', 'total', 'score', 'words', 'rows', 'row', 'week', 'ilo'];
  const escapeRe = text => text.replace(/[|\\{}()[\]^$+*?.-]/g, ch => '\\' + ch);
  const pattern = text => {
    const names = [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
    if (!names.length || (text.replace(/\{\w+\}/g, '').length < 12 && !names.every(n => NUMERIC.includes(n)))) return null;
    let i = 0;
    return new RegExp('^' + text.split(/\{\w+\}/).map(escapeRe).reduce((acc, part, k) => acc + (k ? (NUMERIC.includes(names[i++]) ? '([\\d.,\\s-]+)' : '(.*?)') : '') + part, '') + '$', 's');
  };
  const keyOf = text => Object.keys(hybridEn).find(k => hybridEn[k] === text || (pattern(hybridEn[k]) && pattern(hybridEn[k]).test(text)));
  const s = programSyllabus('bscpe'), texts = new Set(), reasons = new Set();
  for (const name of ['supporting values, no evidence', 'supporting value with evidence', 'competency instead of a value', 'no value at all']) {
    const sc = SCENARIOS[name], r = await check(s, { env: ALL, rules: sc.rules, mutate: sc.mutate });
    // the official finding messages of the coded checks predate these rounds (and are English only); only the new advisory sentences are checked here
    const officialMessages = new Set(r.result.findings.map(f => f.message));
    for (const f of r.verdict.findings) if (f.method === 'deterministic' && /^(VAL-0[15]|CUR-04)$/.test(f.ruleId)) for (const t of [f.explanation, f.recommendation]) if (t && !officialMessages.has(t)) texts.add(t);
    for (const u of r.result.hybrid.unresolved) reasons.add(u.reason);
  }
  const caseOnly = await check(s, { env: ALL, mutate: c => { c.meta.title = 'Fundamentals of Mixed Signals and Sensors'; } }); // capitalisation only, shadow policy
  for (const f of caseOnly.verdict.findings) if (f.ruleId === 'CUR-04' && f.explanation) texts.add(f.explanation);
  const provisional = await check(s, { env: { ...ALL, SYLLABUS_CHECK_PROVISIONAL_AI: 'on' }, mutate: c => { c.meta.code = 'XX 999'; } });
  for (const f of provisional.verdict.findings) if (/^Not counted:/.test(f.explanation || '')) texts.add(f.explanation);
  const missing = [...texts].filter(t => !/differs from the official curriculum/.test(t)).filter(t => { const k = keyOf(t); return !k || !hybridTl[k] || hybridTl[k] === hybridEn[k]; });
  assert.deepEqual(missing, [], 'no Tagalog for: ' + missing.join(' | '));
  for (const reason of reasons) assert.ok(hybridEn[`hybrid.unresolved.${reason}`] && hybridTl[`hybrid.unresolved.${reason}`], reason);
  assert.ok(texts.size >= 5, 'the sentences were collected: ' + texts.size);
});
test('every server sentence the Verdict Panel shows in the sampled runs has a Tagalog translation (scripts/audit-verdict-i18n.mjs)', () => {
  const { spawnSync } = require('node:child_process'), path = require('node:path');
  const out = spawnSync(process.execPath, [path.join(__dirname, '..', '..', '..', 'scripts', 'audit-verdict-i18n.mjs')], { encoding: 'utf8', cwd: path.join(__dirname, '..', '..', '..') });
  assert.equal(out.status, 0, out.stderr);
  const m = /\*\*(\d+) of (\d+)\*\*/.exec(out.stdout);
  assert.ok(m, 'the audit reported its count');
  assert.ok(Number(m[2]) >= 40, 'enough sentences were sampled: ' + m[2]);
  assert.equal(Number(m[1]), 0, 'untranslated:\n' + out.stdout.split('\n').filter(l => l.startsWith('- ')).join('\n'));
});
