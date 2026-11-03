// Stage E: the whole checking pipeline with every advisory stage on. Course Identity -> CLO -> PO/EGA -> weekly content -> ILO -> activity ->
// assessment -> values, then references. Every model here is a fake: no test reaches a provider.
// What is under test is not any one stage but their coordination: no positive academic verdict from filled fields, no downstream rewrite from an upstream
// error, no change to the official score, one question per relationship, and honest NOT_CHECKED when nothing was judged.
const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { run } = require('./engine');
const gemini = require('./gemini');
const { resetProviderBlock, aspectKeysFor, isNoRewrite } = gemini;
const { stageFlags } = require('./stages');
const { buildVerdict } = require('./verdict');
const { loadReal, COURSES } = require('./eval/realSyllabi');

test.afterEach(() => resetProviderBlock());
const STAGES = ['A', 'B', 'B3', 'B4', 'C1', 'C2', 'D1', 'D2'];
const envOf = on => ({ SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only', SYLLABUS_CHECK_VALUES_FILE: 'no-such-file.json', ...Object.fromEntries(STAGES.filter(k => on.includes(k)).map(k => ['SYLLABUS_CHECK_STAGE_' + k, 'on'])) });
const ALL = envOf(STAGES), NONE = envOf([]);
const base = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) };
// Stage E.4: a staged check sends STAGED_BATCH (4) relationships per request, in up to 7 passes (the main questions, B3 any-CLO, C1, C2, D1 value
// use, D1 value map, D2). A clean run asks each relationship once and fills every batch but the last of each pass, so it needs at most
// ceil(asked / 4) + 7 requests; 64 is an absolute ceiling (the largest measured all-stages check is 54 requests, the real BSIT syllabus:
// scripts/measure-request-volume.cjs). Batches of 12 needed at most 19, under the earlier cap of 30.
const requestCeiling = log => Math.min(Math.ceil(log.asked.length / gemini.STAGED_BATCH) + 7, 64);

// The fields a faithful answer carries for each relationship type and label; a scenario overrides the label of chosen ids.
const GOOD = {
  'Activity-fit': { teaching: 'sound', learnerSupport: 'adequate' }, 'Assessment-fit': { measures: 'yes', evidence: 'observable', level: 'matches' },
  'Value-use': { valueUse: 'integrated', carriedBy: 'activity', valueFit: 'fits' }, 'Ref-relevance': { relevance: 'relevant', basis: 'title_and_venue' },
};
const BAD = {
  'Activity-fit': { teaching: 'weak', learnerSupport: 'limited' }, 'Assessment-fit': { measures: 'no', evidence: 'vague', level: 'too_low' },
  'Value-use': { valueUse: 'name_only', carriedBy: 'none', valueFit: 'partly' }, 'Ref-relevance': { relevance: 'unrelated', basis: 'title_only' },
};
// rules: [[regex over "Type:id", label, fieldsOverride?]] first match wins; the default answer is ALIGNED with good fields.
function model(rules = [], env = ALL, log = {}) {
  const asked = (log.asked = []);
  const keys = aspectKeysFor(stageFlags(env));
  const transport = async (url, req) => {
    log.requests = (log.requests || 0) + 1;
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    asked.push(...batch.map(p => p.type + ':' + p.id));
    const answer = pair => {
      const rule = rules.find(([re]) => re.test(pair.type + ':' + pair.id));
      const label = rule ? rule[1] : 'ALIGNED';
      const fields = rule && rule[2] ? rule[2] : label === 'ALIGNED' ? GOOD[pair.type] : BAD[pair.type];
      const out = { id: pair.id, label, explanation: 'Judged by the test model.', sourceQuote: pair.source.slice(0, 14), targetQuote: pair.target.slice(0, 14), sourceBloom: 'N/A', targetBloom: 'N/A',
        draft: label === 'ALIGNED' || isNoRewrite(pair.type) ? '' : 'MODEL-DRAFT for ' + pair.id, ...Object.fromEntries(keys.map(k => [k, 'not_assessed'])), ...(fields || {}) };
      return out;
    };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
  return transport;
}
async function check(content, masters, rules, env = ALL, extra = {}) {
  const log = {};
  const result = await run(structuredClone(content), masters, { ...base, env, transport: model(rules, env, log), ...extra });
  return { result, verdict: result.hybrid.verdict, log };
}
const find = (verdict, ruleId, pathPart) => verdict.findings.filter(f => f.ruleId === ruleId && (!pathPart || String(f.path || '').includes(pathPart)));
const hasDraft = verdict => verdict.findings.some(f => /MODEL-DRAFT/.test(f.recommendation || ''));

// ---------------- the baseline: a sound syllabus ----------------
test('a syllabus every question accepts is not blocked, and the advisory stages leave the official result exactly as it was', async () => {
  const { content, masters } = sample();
  const on = await check(content, masters, [], ALL), off = await check(content, masters, [], NONE);
  assert.equal(on.result.score, off.result.score); assert.equal(on.result.passed, off.result.passed);
  assert.deepEqual(on.result.deductions, off.result.deductions);
  assert.equal(on.verdict.mode, 'ai'); assert.ok(on.log.requests <= requestCeiling(on.log), 'requests: ' + on.log.requests);
  assert.ok(!off.log.asked.some(a => /^(Value-use|Ref-relevance|Activity-fit|Assessment-fit|Course-CLO|Content-course):/.test(a)), 'nothing new is asked while the stages are off');
});
test('one question per relationship: no pair is asked twice in a run when nothing fails', async () => {
  const { content, masters } = sample();
  const { log } = await check(content, masters, [], ALL);
  const seen = new Map();
  for (const key of log.asked) seen.set(key, (seen.get(key) || 0) + 1);
  const twice = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
  assert.deepEqual(twice, [], 'asked more than once: ' + twice.join(', '));
});

// ---------------- Phase 4: no false academic approval ----------------
test('AI unavailable: a complete syllabus is never COMPLIANT, the semantic rules are NOT_CHECKED, and the deterministic reference findings still exist', async () => {
  const { content, masters } = sample();
  const r = await run(structuredClone(content), masters, { ...base, useAi: false, env: ALL });
  const v = r.hybrid.verdict;
  assert.equal(v.mode, 'offline'); assert.notEqual(v.overall, 'COMPLIANT'); assert.equal(v.alignment, 'NOT_CHECKED');
  assert.ok(v.completeness.percent !== null, 'completeness is reported, as completeness only');
  assert.ok(v.findings.filter(f => f.method === 'ai_semantic').every(f => f.status === 'NOT_CHECKED' || f.status === 'NOT_APPLICABLE'), 'no AI rule is passed');
  assert.ok(v.counts.NOT_CHECKED > 0);
});
test('weekly topics that do not belong to the course: the content is the field to fix, and nothing downstream of it is asked or rewritten', async () => {
  const { content, masters } = sample();
  const { verdict, log } = await check(content, masters, [[/^Content-course:row2-content$/, 'NOT_ALIGNED']]);
  assert.notEqual(verdict.overall, 'COMPLIANT');
  const f = find(verdict, 'PLAN-03', 'plan[2]').concat(find(verdict, 'PLAN-04', 'plan[2]')).concat(verdict.findings.filter(x => x.legacyRuleId === 'Content-course'));
  assert.ok(f.length && f.every(x => x.status !== 'PASS'));
  assert.ok(verdict.findings.some(x => x.legacyRuleId === 'Content-course' && x.responsible === 'course_content'));
  assert.ok(!log.asked.some(a => /^(Activity-fit|Assessment-fit|Value-use):row2-/.test(a)), 'no speculative question about a lesson whose content is wrong');
});
test('four CLOs that do not match the course are reported as the CLO problem, and the Program Outcome text is left alone', async () => {
  const { content, masters } = sample();
  const { verdict } = await check(content, masters, [[/^Course-CLO:/, 'NOT_ALIGNED'], [/^CLO-set:/, 'NOT_ALIGNED']]);
  assert.notEqual(verdict.overall, 'COMPLIANT');
  assert.ok(verdict.findings.some(x => (x.legacyRuleId === 'Course-CLO' || x.legacyRuleId === 'CLO-set') && x.status !== 'PASS' && x.responsible === 'clo'));
  assert.ok(!verdict.findings.some(x => /MODEL-DRAFT/.test(x.recommendation || '') && /^pos|outcomes\.pos/.test(x.path || '')), 'a CLO error never rewrites a PO');
});
test('CLOs mapped to unrelated Program Outcomes fail CLO-06 and are never "fixed" by editing the outcome', async () => {
  const { content, masters } = sample();
  const { verdict } = await check(content, masters, [[/^CLO-PO:clo0-po1$/, 'NOT_ALIGNED']]);
  assert.ok(find(verdict, 'CLO-06').some(f => f.status === 'FAIL' || f.status === 'NEEDS_REVIEW'));
  assert.notEqual(verdict.overall, 'COMPLIANT');
});
test('correct content with an unrelated ILO: the ILO is responsible, and the lesson\'s activity, assessment and values are not asked', async () => {
  const { content, masters } = sample();
  const { verdict, log } = await check(content, masters, [[/^Content-ILO:row3-ilo0-contentilo$/, 'NOT_ALIGNED']]);
  const f = verdict.findings.find(x => x.legacyRuleId === 'Content-ILO' && /plan\[3\]/.test(x.path));
  assert.ok(f && f.status !== 'PASS'); assert.equal(f.responsible, 'ilo');
  assert.ok(!log.asked.some(a => /^(Activity-fit|Assessment-fit|Value-use):row3-/.test(a)));
});
test('a correct ILO with the wrong CLO tag is a tag problem: the ILO text is not rewritten', async () => {
  const { content, masters } = sample();
  const { verdict } = await check(content, masters, [[/^ILO-CLO:row3-ilo0-clo/, 'NOT_ALIGNED']]);
  const f = verdict.findings.filter(x => x.legacyRuleId === 'ILO-CLO' && /plan\[3\]/.test(x.path));
  assert.ok(f.length && f.every(x => x.status !== 'PASS'));
  assert.ok(find(verdict, 'ALN-03', 'plan[3]').every(x => x.status === 'PASS') || !find(verdict, 'ALN-03', 'plan[3]').length, 'the ILO-content relationship stays accepted');
});
test('a correct ILO with an unrelated activity: the activity is the field to change, and the assessment and values rewrites wait', async () => {
  const { content, masters } = sample();
  const { verdict, log } = await check(content, masters, [[/^ILO-activity:row3-ilo0-activity$/, 'NOT_ALIGNED']]);
  const f = verdict.findings.find(x => x.legacyRuleId === 'ILO-activity' && /plan\[3\]/.test(x.path));
  assert.ok(f && f.status === 'FAIL'); assert.equal(f.responsible, 'activity');
  assert.ok(!log.asked.some(a => /^(Activity-fit|Value-use):row3-/.test(a)), 'the deeper activity and value questions are not asked about a failed activity');
  for (const x of verdict.findings.filter(x => /^(ILO-assessment|Assessment-fit|Module-value)$/.test(x.legacyRuleId) && /plan\[3\]/.test(x.path))) assert.ok(!/MODEL-DRAFT/.test(x.recommendation || ''), 'no rewrite of ' + x.legacyRuleId);
});
test('an appropriate activity with an invalid assessment: only the assessment is responsible, and the values statement waits', async () => {
  const { content, masters } = sample();
  const { verdict, log } = await check(content, masters, [[/^ILO-assessment:row3-ilo0-assessment$/, 'NOT_ALIGNED']]);
  const f = verdict.findings.find(x => x.legacyRuleId === 'ILO-assessment' && /plan\[3\]/.test(x.path));
  assert.ok(f && f.status === 'FAIL'); assert.equal(f.responsible, 'assessment');
  assert.ok(!log.asked.some(a => /^Value-use:row3-/.test(a)));
  assert.ok(verdict.findings.filter(x => x.legacyRuleId === 'ILO-activity' && /plan\[3\]/.test(x.path)).every(x => x.status === 'PASS' || !x.recommendation), 'the sound activity is not rewritten');
});
test('an assessment that measures a different cognitive level is NEEDS_REVIEW with the level named, not a pass', async () => {
  const { content, masters } = sample();
  const { verdict } = await check(content, masters, [[/^Assessment-fit:row3-assessfit$/, 'PARTIALLY_ALIGNED', { measures: 'partly', evidence: 'observable', level: 'too_low' }]]);
  const f = find(verdict, 'ALN-09', 'plan[3]');
  assert.ok(f.length && f.every(x => x.status === 'NEEDS_REVIEW'));
  assert.notEqual(verdict.overall, 'COMPLIANT');
});
test('values that are only listed are not integration: the value statement is flagged and the faculty text is not replaced', async () => {
  const { content, masters } = sample();
  content.plan[3].values = 'Humility';
  const { verdict, result } = await check(content, masters, [[/^Value-use:row3-valueuse$/, 'PARTIALLY_ALIGNED', { valueUse: 'name_only', carriedBy: 'none', valueFit: 'partly' }]]);
  const f = find(verdict, 'VAL-03', 'plan[3]');
  assert.ok(f.length && f.every(x => x.status !== 'PASS'));
  assert.equal(result.hybrid.stageD.d1.definitions, 'not_supplied');
});
test('references that are well formatted but unrelated: format passes, relevance fails, and the two are never merged', async () => {
  const { content, masters } = sample();
  content.refs = { books: { na: false, items: [{ id: 1, t: 'Reyes, L. (2018). Principles of marketing management. Example Press.' }] }, program: { na: true, items: [] }, online: { na: true, items: [] }, electronics: { na: true, items: [] } };
  const { verdict } = await check(content, masters, [[/^Ref-relevance:/, 'NOT_ALIGNED']]);
  assert.ok(!find(verdict, 'REF-02', 'refs.books').length, 'the format finding is a PASS, so it is only counted');
  const rel = find(verdict, 'REF-05', 'refs.books');
  assert.ok(rel.length === 1 && rel[0].status === 'FAIL' && rel[0].responsible === 'references');
  assert.ok(!/Mechanical correction|Use:/.test(rel[0].recommendation || ''), 'relevance never rewrites a reference');
  assert.ok(find(verdict, 'REF-04', 'refs').some(f => f.status === 'NOT_CHECKED' && f.authenticity === 'not_verified'), 'authenticity is not claimed');
});
test('missing or repeated weekly topics are structural failures (deterministic) and do not need the model', async () => {
  const { content, masters } = sample();
  content.plan[4].week = content.plan[3].week;
  content.plan[5].contents = '';
  const r = await run(structuredClone(content), masters, { ...base, useAi: false, env: ALL });
  assert.ok(r.hybrid.verdict.findings.some(f => /^(PLAN-01|STR-0\d)$/.test(f.ruleId) && f.status === 'FAIL'));
  assert.notEqual(r.hybrid.verdict.overall, 'COMPLIANT');
});
test('a Week 1 orientation lesson and legitimate examination weeks are not failures, and exam rows are never asked', async () => {
  const { content, masters } = sample();
  const examRows = content.plan.map((row, i) => [row, i]).filter(([row]) => row.kind === 'exam').map(([, i]) => i);
  assert.ok(examRows.length > 0);
  content.plan[0].contents = 'Orientation: course objectives, requirements, grading system and class policies';
  content.plan[0].ilos[0].text = 'Describe the course objectives, requirements and grading system.';
  const { verdict, log } = await check(content, masters, [[/^ILO-CLO:row0-/, 'NOT_ALIGNED']]);
  for (const i of examRows) assert.ok(!log.asked.some(a => new RegExp(`:row${i}-`).test(a)), 'exam row ' + i + ' is not asked');
  assert.ok(!verdict.findings.some(f => f.legacyRuleId === 'ILO-CLO' && /plan\[0\]/.test(f.path) && f.status === 'FAIL'), 'an orientation ILO is information, not a failure');
});
test('contradictory or incomplete structured answers are NEEDS_REVIEW, never a pass', async () => {
  const { content, masters } = sample();
  const contradiction = await check(content, masters, [[/^Value-use:row3-valueuse$/, 'ALIGNED', { valueUse: 'name_only', carriedBy: 'none', valueFit: 'clashes' }], [/^Activity-fit:row3-activityfit$/, 'ALIGNED', { teaching: 'weak', learnerSupport: 'limited' }]]);
  for (const f of contradiction.verdict.findings.filter(x => /plan\[3\]/.test(x.path) && /^(Value-use|Activity-fit)$/.test(x.legacyRuleId))) assert.equal(f.status, 'NEEDS_REVIEW');
  const incomplete = await check(content, masters, [[/^Activity-fit:row3-activityfit$/, 'ALIGNED', {}]].map(([re, l]) => [re, l, { teaching: 'not_assessed', learnerSupport: 'not_assessed' }]));
  assert.ok(!find(incomplete.verdict, 'ALN-06', 'plan[3]').some(f => f.status === 'PASS'), 'a field that was not answered never becomes a pass');
});

// ---------------- Phase 7: flags, persistence, scores ----------------
test('every one of the 256 flag combinations runs, leaves the official result unchanged, and asks only what its flags allow', async () => {
  const { content, masters } = sample();
  const reference = await run(structuredClone(content), masters, { ...base, env: NONE, transport: model([], NONE) });
  const owner = { 'Course-CLO': 'a', 'CLO-set': 'a', 'Content-course': 'b', 'Content-ILO': 'b', 'Plan-sequence': 'b', 'ILO-anyCLO': 'b4', 'CLO-coverage': 'b4', 'Activity-fit': 'c1', 'Assessment-fit': 'c2', 'Value-use': 'd1', 'Ref-relevance': 'd2' };
  const problems = [];
  for (let mask = 0; mask < 256; mask++) {
    resetProviderBlock();
    const on = STAGES.filter((_, i) => mask & (1 << i)), env = envOf(on), log = {};
    try {
      const r = await run(structuredClone(content), masters, { ...base, env, transport: model([], env, log) });
      if (r.score !== reference.score || r.passed !== reference.passed) problems.push(`${on} changed the official result`);
      if (!r.hybrid.verdict) problems.push(`${on}: no verdict`);
      if (r.hybrid.verdict && r.hybrid.verdict.overall === 'COMPLIANT' && r.hybrid.verdict.scope !== 'full') problems.push(`${on}: COMPLIANT on partial scope`);
      for (const key of log.asked) {
        const type = key.split(':')[0], need = owner[type];
        if (need && !on.map(x => x.toLowerCase()).includes(need) && !(need === 'a' && on.includes('A'))) problems.push(`${on}: asked ${type} without ${need}`);
      }
    } catch (error) { problems.push(`${on}: threw ${error.message}`); }
  }
  assert.deepEqual(problems.slice(0, 10), [], `${problems.length} problem(s)`);
});
test('saved reports: the verdict survives storage unchanged, and a report saved before Stages C and D still builds a verdict without them', async () => {
  const { content, masters } = sample();
  const { result } = await check(content, masters, [[/^Content-course:row2-content$/, 'NOT_ALIGNED']]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.hybrid.verdict)), result.hybrid.verdict);
  const legacy = JSON.parse(JSON.stringify(result));
  for (const key of ['stageD', 'stageC', 'references', 'valuesProfile', 'valuesDefinitions', 'stages', 'coverage', 'coverageSummary', 'mappingAdvice', 'verdict']) delete legacy.hybrid[key];
  legacy.hybrid.alignment.judgements = legacy.hybrid.alignment.judgements.filter(j => !/^(Activity-fit|Assessment-fit|Value-use|Ref-relevance)$/.test(j.type)).map(({ aspects, ...rest }) => rest);
  const rebuilt = buildVerdict(legacy, content);
  assert.ok(rebuilt && Array.isArray(rebuilt.findings));
  assert.ok(!rebuilt.findings.some(f => /^(VAL-03|VAL-04|REF-02|REF-03|REF-05)$/.test(f.ruleId) && f.status !== 'NOT_CHECKED'), 'no Stage D result is invented for an old report; they stay NOT_CHECKED');
  assert.deepEqual(buildVerdict({}, {}).findings.every(f => f.status !== 'PASS'), true, 'an empty report passes nothing');
});
test('the report stays small enough to store: all stages on, an 18-week syllabus', async () => {
  const { content, masters } = sample();
  const { result } = await check(content, masters, []);
  const bytes = Buffer.byteLength(JSON.stringify(result.hybrid));
  assert.ok(bytes < 1_500_000, 'report_json is ' + bytes + ' bytes');
});

// ---------------- the three programs, real faculty text ----------------
for (const key of Object.keys(COURSES)) {
  test(`${COURSES[key].label}: the real syllabus runs through every stage, the curriculum record is found, and nothing is passed that was not judged`, async t => {
    const real = await loadReal(key);
    if (!real) return t.skip('reference-data PDF not present');
    assert.ok(real.record, 'the course is in the transcribed curriculum');
    const log = {};
    const result = await run(structuredClone(real.content), real.masters, { ...base, env: ALL, transport: model([], ALL, log) });
    const v = result.hybrid.verdict;
    assert.equal(v.mode, 'ai');
    assert.ok(find(v, 'CUR-03').every(f => f.status === 'PASS') || !find(v, 'CUR-03').length, 'the code is in the approved curriculum');
    assert.notEqual(v.overall, 'COMPLIANT', 'the real syllabi have structural and value-wording findings, so a positive verdict would be wrong');
    assert.ok(log.requests <= requestCeiling(log), 'requests: ' + log.requests);
    // real value columns often list generic words, not the six core values: no Value-use question for a lesson that names none
    for (const [i, row] of real.content.plan.entries()) if (!/Compassion|Courage|Community|Humility|Interiority|Missionary/i.test(row.values)) assert.ok(!log.asked.includes(`Value-use:row${i}-valueuse`), `row ${i} names no core value`);
    // curriculum evidence missing is never success
    const noRecord = structuredClone(real.masters); noRecord.curricula = [];
    const without = await run(structuredClone(real.content), noRecord, { ...base, useAi: false, env: ALL });
    assert.ok(!find(without.hybrid.verdict, 'CUR-03').some(f => f.status === 'PASS'), 'no approved curriculum is not a pass');
  });
}

// ---------------- the verdict list is cut honestly ----------------
test('when the list of findings is cut, failures are kept before NOT_CHECKED rows and the cut is reported', async () => {
  const verdictModule = require('./verdict');
  const { content, masters } = sample('misaligned');
  content.plan.forEach(row => { row.values = ''; });
  const r = await run(structuredClone(content), masters, { ...base, useAi: false, env: ALL });
  const full = r.hybrid.verdict;
  const open = full.counts.FAIL + full.counts.NEEDS_REVIEW;
  assert.ok(open >= 6, 'the fixture has enough open findings: ' + open);
  const cut = verdictModule.buildVerdict(r, content, { maxShown: 5 });
  assert.equal(cut.findings.length, 5);
  assert.equal(cut.omitted, full.findings.length - 5);
  assert.ok(cut.findings.every(f => f.status === 'FAIL' || f.status === 'NEEDS_REVIEW'), 'NOT_CHECKED rows do not push failures out');
  assert.equal(full.omitted, 0);
});

// ---------------- curriculum evidence ----------------
test('BSIT-Cyber Security shares the BSIT Program Outcomes and institutional EGAs while keeping its own approved curriculum', () => {
  const { programs } = require('../../db/local-curriculum-data.cjs');
  const cyber = programs.find(p => p.code === 'BSIT-CYBERSECURITY'), bsit = programs.find(p => p.code === 'BSIT');
  assert.ok(cyber && bsit && cyber.curriculumYear !== bsit.curriculumYear, 'its curriculum is separate and has its own year');
  const codes = new Set(bsit.terms.flatMap(t => t.rows.map(r => r.code))), own = cyber.terms.flatMap(t => t.rows).filter(r => /^CS-/.test(r.code));
  assert.ok(own.length > 0 && own.every(r => !codes.has(r.code)), 'its own courses are not folded into BSIT');
  const { sources } = require('../../db/local-outcome-data.cjs');
  assert.ok(!sources['BSIT-CYBERSECURITY'], 'there is no separate transcription of outcomes: they are shared, not copied, through program_outcome_sources');
});
