// Stage E.1: title normalisation (shadow), safe partial validation when the course code is wrong, and the classification of supporting values.
// Every model here is a fake: no test reaches a provider.
const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { run } = require('./engine');
const gemini = require('./gemini');
const { resetProviderBlock, aspectKeysFor, isNoRewrite } = gemini;
const { stageFlags } = require('./stages');
const { buildVerdict } = require('./verdict');
const { titleRelation, normalizeTitle } = require('./titles');
const vc = require('./valueClassification');
const { loadReal, COURSES } = require('./eval/realSyllabi');

test.afterEach(() => resetProviderBlock());
const KEY = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only', SYLLABUS_CHECK_VALUES_FILE: 'no-such-file.json' };
const D1 = { ...KEY, SYLLABUS_CHECK_STAGE_D1: 'on' };
const FULL = { ...KEY, ...Object.fromEntries(['A', 'B', 'B3', 'B4', 'C1', 'C2', 'D1', 'D2'].map(k => ['SYLLABUS_CHECK_STAGE_' + k, 'on'])) };
const base = { linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) };
const GOOD = { 'Activity-fit': { teaching: 'sound', learnerSupport: 'adequate' }, 'Assessment-fit': { measures: 'yes', evidence: 'observable', level: 'matches' }, 'Value-use': { valueUse: 'integrated', carriedBy: 'activity', valueFit: 'fits' }, 'Ref-relevance': { relevance: 'relevant', basis: 'title_and_venue' }, 'Value-map': { coreValue: 'Community-orientedness', integration: 'demonstrated' } };
const BAD = { 'Value-map': { coreValue: 'insufficient', integration: 'stated_only' }, 'Value-use': { valueUse: 'name_only', carriedBy: 'none', valueFit: 'partly' } };
function model(rules = [], env = FULL, log = {}) {
  const keys = aspectKeysFor(stageFlags(env)); log.asked = []; log.requests = 0;
  return async (url, req) => {
    log.requests += 1;
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    log.asked.push(...batch.map(p => p.type + ':' + p.id));
    const answer = pair => {
      const rule = rules.find(([re]) => re.test(pair.type + ':' + pair.id)), label = rule ? rule[1] : 'ALIGNED';
      const fields = rule && rule[2] !== undefined ? rule[2] : label === 'ALIGNED' ? GOOD[pair.type] : BAD[pair.type];
      return { id: pair.id, label, explanation: 'Judged by the test model.', sourceQuote: pair.source.slice(0, 14), targetQuote: pair.target.slice(0, 14), sourceBloom: 'N/A', targetBloom: 'N/A', draft: label === 'ALIGNED' || isNoRewrite(pair.type) ? '' : 'MODEL-DRAFT', ...Object.fromEntries(keys.map(k => [k, 'not_assessed'])), ...(fields || {}) };
    };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
}
async function check(content, masters, { rules = [], env = FULL, ai = true } = {}) {
  const log = {};
  const result = await run(structuredClone(content), masters, { ...base, useAi: ai, env, transport: model(rules, env, log) });
  return { result, verdict: result.hybrid.verdict, log };
}
const find = (verdict, ruleId, pathPart) => verdict.findings.filter(f => f.ruleId === ruleId && (!pathPart || String(f.path || '').includes(pathPart)));

// ---------------- 1. title normalisation ----------------
test('titles that differ only in capitalisation, spacing or Unicode form match; different titles never do', () => {
  const same = [['Systems Engineering', 'SYSTEMS ENGINEERING'], ['computer programming 1', 'Computer Programming 1'], ['Computer  Programming\t1 ', 'Computer Programming 1'], ['Computer Programming 1', 'Computer Programming 1'], ['Computer Programming​ 1', 'Computer Programming 1'], ['Ｃomputer Programming 1', 'Computer Programming 1']];
  for (const [a, b] of same) assert.ok(titleRelation(a, b).match, `${a} / ${b}`);
  assert.equal(titleRelation('Systems Engineering', 'SYSTEMS ENGINEERING').relation, 'case_or_space');
  assert.equal(titleRelation('Systems Engineering', 'Systems Engineering').relation, 'exact');
  for (const [a, b] of [['Computer Programming 1', 'Computer Programming 2'], ['Systems Engineering', 'Software Engineering'], ['Computer Programming', 'Computer Programming 1'], ['Fundamentals of Mixed Signals', 'Fundamentals of Mixed Signals and Sensors'], ['Data Structures', 'Data-Structures']]) assert.equal(titleRelation(a, b).match, false, `${a} / ${b}`);
  assert.equal(titleRelation('Computer Programming 1', 'COMPUTER PROGRAMMING 1 (FUNDAMENTALS OF PROGRAMMING)').relation, 'subtitle', 'a missing subtitle is reported but not matched');
  assert.equal(titleRelation('', 'X').relation, 'missing'); assert.equal(titleRelation('X', null).match, false);
  assert.equal(normalizeTitle('  A  B  '), 'a b');
});
test('title policy: shadow (the default) keeps the official decision, reports the alternative and its impact; normalized is opt-in; exact reports nothing', async () => {
  const { content, masters } = sample();
  masters.curricula[0].courses[0].title = content.meta.title.toUpperCase();
  const run0 = env => run(structuredClone(content), masters, { ...base, useAi: false, env });
  const shadow = await run0({}), exact = await run0({ SYLLABUS_CHECK_TITLE_POLICY: 'exact' }), normalized = await run0({ SYLLABUS_CHECK_TITLE_POLICY: 'normalized' });
  const status = r => r.hybrid.codedChecks.find(c => c.ruleId === 'CUR-FIELD' && c.path === 'meta.title').status;
  assert.equal(status(shadow), 'FAIL', 'shadow mode: the official decision is unchanged'); assert.equal(status(exact), 'FAIL'); assert.equal(status(normalized), 'PASS');
  const s = shadow.hybrid.shadowCurriculum;
  assert.equal(s.mode, 'shadow'); assert.equal(s.title.relation, 'case_or_space'); assert.equal(s.title.officialStatus, 'FAIL'); assert.equal(s.title.shadowStatus, 'PASS');
  assert.equal(s.title.suggestion.text, content.meta.title.toUpperCase(), 'the approved canonical title is what is suggested');
  assert.equal(s.impact.blockingFindings.official - s.impact.blockingFindings.shadow, 1);
  assert.match(s.impact.numericScore, /points total is unchanged/);
  assert.equal(exact.hybrid.shadowCurriculum, null);
  assert.equal(shadow.score, exact.score); assert.equal(shadow.score, normalized.score, 'the numeric score does not depend on the title policy');
  assert.deepEqual(shadow.hybrid.deductions, normalized.hybrid.deductions);
  assert.equal(shadow.passed, exact.passed);
  assert.equal(content.meta.title, sample().content.meta.title, 'the entered title is never rewritten');
});
test('title policy: the normalisation never accepts a different course, and never touches code, units, prerequisite or curriculum year', async () => {
  const { content, masters } = sample();
  const env = { SYLLABUS_CHECK_TITLE_POLICY: 'normalized' };
  masters.curricula[0].courses[0].title = 'Something Else Entirely';
  const other = await run(structuredClone(content), masters, { ...base, useAi: false, env });
  assert.equal(other.hybrid.codedChecks.find(c => c.path === 'meta.title').status, 'FAIL');
  const fresh = sample(); fresh.masters.curricula[0].courses[0].prereq = 'ZZ 999'; fresh.masters.curricula[0].courses[0].lecture = 9;
  const r = await run(structuredClone(fresh.content), fresh.masters, { ...base, useAi: false, env });
  for (const path of ['meta.prereq', 'meta.lecture']) assert.equal(r.hybrid.codedChecks.find(c => c.path === path).status, 'FAIL', path);
});
test('the advisory verdict follows the title policy in force: a capitalisation-only title fails with the official check in shadow mode, and is only an informational note once the normalised policy is active; a real mismatch always fails', async () => {
  const { content, masters } = sample();
  masters.curricula[0].courses[0].title = content.meta.title.toUpperCase();
  // shadow (the default): the official exact comparison still blocks, so the advisory verdict must not say "pass" (Stage E.2 correction)
  const r = await run(structuredClone(content), masters, { ...base, useAi: false, env: {} });
  const f = find(r.hybrid.verdict, 'CUR-04', 'meta.title');
  assert.equal(f.length, 1); assert.equal(f[0].status, 'FAIL'); assert.match(f[0].explanation, /only in capitalisation or spacing[^]*still required to submit/);
  assert.match(f[0].recommendation, new RegExp(content.meta.title.toUpperCase()), 'the approved spelling, as the official panel asks');
  assert.deepEqual(r.hybrid.verdict.informational, []);
  // normalized (after an approved activation): the official check accepts it; the approved spelling is only information
  const active = await run(structuredClone(content), masters, { ...base, useAi: false, env: { SYLLABUS_CHECK_TITLE_POLICY: 'normalized' } });
  assert.deepEqual(find(active.hybrid.verdict, 'CUR-04', 'meta.title'), [], 'a PASS is counted, not listed');
  assert.deepEqual(active.hybrid.verdict.informational.map(i => [i.kind, i.entered, i.approved]), [['formatting', content.meta.title, content.meta.title.toUpperCase()]]);
  masters.curricula[0].courses[0].title = 'Something Else Entirely';
  const bad = await run(structuredClone(content), masters, { ...base, useAi: false, env: {} });
  assert.equal(find(bad.hybrid.verdict, 'CUR-04', 'meta.title')[0].status, 'FAIL'); assert.deepEqual(bad.hybrid.verdict.informational, []);
});

// ---------------- 2. safe partial validation ----------------
const wrongCode = () => { const x = sample(); x.content.meta.code = 'IT 999'; x.content.clos.pop(); x.content.plan[4].contents = 'TBD'; return x; };
test('a wrong course code: curriculum stays failed and the official result is unchanged, while every independent check still reports', async () => {
  const { content, masters } = wrongCode();
  const { result, verdict, log } = await check(content, masters, { env: FULL });
  assert.equal(result.hybrid.critical, true); assert.equal(result.score, 0); assert.equal(result.passed, false);
  assert.equal(log.requests, 0, 'no AI request by default: the official behaviour is unchanged');
  assert.equal(result.hybrid.identity.status, 'code_not_found');
  assert.equal(verdict.curriculum, 'FAIL'); assert.equal(verdict.states.curriculum, 'FAIL'); assert.equal(verdict.states.identity.status, 'code_not_found');
  assert.ok(find(verdict, 'CLO-01').some(f => f.status === 'FAIL'), 'the CLO count check still runs');
  assert.ok(verdict.findings.some(f => f.ruleId === 'STR-05' && /plan\[4\]/.test(f.path)), 'placeholder detection still runs');
  assert.notEqual(verdict.overall, 'COMPLIANT'); assert.equal(verdict.alignment, 'NOT_CHECKED');
});
test('a missing course code and a code that belongs to another curriculum are never matched; no reference is made from the entered text', async () => {
  const missing = sample(); missing.content.meta.code = '';
  const m = await run(structuredClone(missing.content), missing.masters, { ...base, useAi: false, env: {} });
  assert.equal(m.hybrid.identity.status, 'code_missing'); assert.equal(m.hybrid.critical, true);
  const elsewhere = sample(); elsewhere.content.meta.code = 'IE 402';
  elsewhere.masters.otherCurricula = [{ program: 'BSIE', curriculumYear: '2022-2023', courses: [{ code: 'IE-402', title: 'SYSTEMS ENGINEERING' }, { code: 'IE 402', title: 'SYSTEMS ENGINEERING' }] }];
  const before = JSON.stringify(elsewhere.masters.curricula);
  const e = await run(structuredClone(elsewhere.content), elsewhere.masters, { ...base, useAi: false, env: {} });
  assert.equal(e.hybrid.identity.status, 'code_not_found', 'a course of another program is not this program\'s course');
  assert.equal(e.hybrid.identity.elsewhere[0].program, 'BSIE', 'the author is told where it exists');
  assert.equal(e.hybrid.verdict.curriculum, 'FAIL'); assert.equal(e.score, 0);
  assert.equal(JSON.stringify(elsewhere.masters.curricula), before, 'the approved curriculum is not extended');
  const none = sample(); none.masters.curricula = [];
  const n = await run(structuredClone(none.content), none.masters, { ...base, useAi: false, env: {} });
  assert.equal(n.hybrid.identity.status, 'curriculum_unavailable'); assert.notEqual(n.hybrid.verdict.curriculum, 'PASS');
});
test('provisional feedback (opt-in): the AI runs after a wrong code, is labelled provisional, never charges the official score and never produces COMPLIANT', async () => {
  const { content, masters } = wrongCode();
  const env = { ...FULL, SYLLABUS_CHECK_PROVISIONAL_AI: 'on' };
  const { result, verdict, log } = await check(content, masters, { env, rules: [[/^Content-course:row2-content$/, 'NOT_ALIGNED'], [/^ILO-activity:row3-/, 'NOT_ALIGNED']] });
  assert.ok(log.requests > 0, 'the AI ran');
  assert.equal(result.score, 0); assert.equal(result.passed, false); assert.equal(result.hybrid.deductions.filter(d => d.kind === 'alignment').length, 0, 'no alignment points are charged to the official result');
  assert.ok(result.hybrid.provisional.deductions.length > 0, 'they are kept apart for review');
  assert.ok(verdict.findings.filter(f => f.method === 'ai_semantic' && f.status !== 'NOT_CHECKED').every(f => f.identityBasis === 'provisional' && f.verification === 'provisional_identity'));
  assert.equal(verdict.overall, 'NOT_COMPLIANT');
  const clean = await check(content, masters, { env, rules: [] });
  assert.notEqual(clean.verdict.overall, 'COMPLIANT', 'even when every question is accepted');
  const off = await check(content, masters, { env: { ...FULL, SYLLABUS_CHECK_PROVISIONAL_AI: 'off' } });
  assert.equal(off.log.requests, 0);
});
test('with the course identity verified nothing is labelled provisional', async () => {
  const { content, masters } = sample();
  const { verdict, result } = await check(content, masters, { env: FULL });
  assert.equal(result.hybrid.identity.status, 'verified');
  assert.ok(verdict.findings.every(f => !f.identityBasis));
});

// ---------------- 3. values classification ----------------
const LEX = vc.loadLexicon({});
test('the three kinds of expression are told apart without any fixed mapping to a core value', () => {
  const c = vc.classifyText('• Respect\n• Honesty\n• Critical Thinking\n• Courage\n• Wibble', LEX);
  const by = Object.fromEntries(c.expressions.map(e => [e.text, e.category]));
  assert.deepEqual(by, { Respect: 'supporting_value', Honesty: 'supporting_value', 'Critical Thinking': 'competency', Courage: 'core_value', Wibble: 'unclassified' });
  assert.ok(c.expressions.every(e => e.category === 'core_value' || e.canonicalCoreValue === null), 'a supporting value or competency is never given a core value by vocabulary alone');
  assert.equal(vc.classifyText('Respect\nHonesty', LEX).status, 'supporting_only'); assert.equal(vc.classifyText('Critical Thinking', LEX).status, 'competency_only');
  assert.equal(vc.classifyText('', LEX).status, 'empty'); assert.equal(vc.classifyText('Community orientedness', LEX).status, 'core_named');
});
function lessonWith(valuesText, activities) {
  const { content, masters } = sample();
  const row = content.plan[2];
  row.contents = 'Java conditional statements: if, if-else, nested if and switch'; row.ilos[0].text = 'Develop and test Java programs that use if-else and switch statements.';
  row.activities = activities || '- Pair programming: partners listen to each other\'s reading of the code before commenting.'; row.tasks = '- Programming task: write and test an if-else program.'; row.values = valuesText;
  return { content, masters };
}
test('a supporting value that the lesson evidence supports is classified as a core value, with the evidence; the faculty text is untouched', async () => {
  const { content, masters } = lessonWith('Respect');
  const { result, verdict, log } = await check(content, masters, { env: D1 });
  assert.ok(log.asked.includes('Value-map:row2-valuemap'));
  const c = result.hybrid.valuesClassification.find(x => x.path === 'plan[2].values');
  assert.equal(c.classificationStatus, 'core_supported'); assert.equal(c.canonicalCoreValue, 'Community-orientedness'); assert.deepEqual(c.supportingValue, ['Respect']);
  assert.ok(c.integrationEvidence && c.integrationEvidence.source === 'Value-map');
  assert.equal(result.hybrid.alignment.judgements.find(j => j.id === 'row2-valuemap').draft, '', 'no rewrite is offered');
  assert.deepEqual(find(verdict, 'VAL-05', 'plan[2]'), [], 'accepted evidence is a counted PASS');
  assert.equal(content.plan[2].values, 'Respect');
});
test('a supporting value without evidence is NEEDS_REVIEW (never FAIL, never a core value); the official VAL-01 result and points are unchanged', async () => {
  const { content, masters } = lessonWith('Respect', '- Lecture and demonstration.');
  const on = await check(content, masters, { env: D1, rules: [[/^Value-map:/, 'NOT_ALIGNED']] });
  const off = await check(content, masters, { env: KEY });
  const v5 = find(on.verdict, 'VAL-05', 'plan[2]');
  assert.equal(v5.length, 1); assert.equal(v5[0].status, 'NEEDS_REVIEW'); assert.equal(v5[0].classification.canonicalCoreValue, null);
  const v1 = find(on.verdict, 'VAL-01', 'plan[2]');
  assert.equal(v1[0].status, 'NEEDS_REVIEW', 'the advisory verdict does not call a supporting value invalid');
  assert.equal(on.result.hybrid.codedChecks.find(c => c.ruleId === 'VALUE' && c.path === 'plan[2].values').status, 'FAIL', 'the official check is unchanged');
  assert.deepEqual(on.result.hybrid.deductions.filter(d => d.kind === 'value'), off.result.hybrid.deductions.filter(d => d.kind === 'value'));
  assert.equal(on.result.score, off.result.score);
});
test('a competency such as Critical Thinking is not mapped to a core value and is not asked; an empty column stays a FAIL', async () => {
  const { content, masters } = lessonWith('• Critical Thinking\n• Analytical Skills');
  const { result, verdict, log } = await check(content, masters, { env: D1 });
  assert.ok(!log.asked.includes('Value-map:row2-valuemap'));
  assert.equal(result.hybrid.valuesClassification.find(x => x.path === 'plan[2].values').classificationStatus, 'competency_only');
  assert.match(find(verdict, 'VAL-05', 'plan[2]')[0].explanation, /not Marian-Augustinian core values/);
  const empty = lessonWith('');
  const e = await check(empty.content, empty.masters, { env: D1 });
  assert.equal(find(e.verdict, 'VAL-01', 'plan[2]')[0].status, 'FAIL');
});
test('contradictory, incomplete or unavailable model answers never classify a value', async () => {
  const { content, masters } = lessonWith('Respect');
  const contradictory = await check(content, masters, { env: D1, rules: [[/^Value-map:/, 'ALIGNED', { coreValue: 'none', integration: 'stated_only' }]] });
  assert.notEqual(contradictory.result.hybrid.valuesClassification.find(x => x.path === 'plan[2].values').classificationStatus, 'core_supported');
  assert.ok(find(contradictory.verdict, 'VAL-05', 'plan[2]').every(f => f.status === 'NEEDS_REVIEW'));
  const missing = await check(content, masters, { env: D1, rules: [[/^Value-map:/, 'ALIGNED', { coreValue: 'not_assessed', integration: 'not_assessed' }]] });
  assert.notEqual(missing.result.hybrid.valuesClassification.find(x => x.path === 'plan[2].values').classificationStatus, 'core_supported');
  const invalid = await check(content, masters, { env: D1, rules: [[/^Value-map:/, 'ALIGNED', { coreValue: 'Wisdom', integration: 'demonstrated' }]] });
  assert.notEqual(invalid.result.hybrid.valuesClassification.find(x => x.path === 'plan[2].values').classificationStatus, 'core_supported', 'a value outside the six is not accepted');
  const offline = await check(content, masters, { env: D1, ai: false });
  assert.equal(offline.result.hybrid.valuesClassification.find(x => x.path === 'plan[2].values').classificationStatus, 'needs_review');
  assert.equal(find(offline.verdict, 'VAL-05', 'plan[2]')[0].verification, 'not_checked');
});
test('legacy values: with D1 off nothing is classified, the report has no new values field, and the faculty text is never rewritten', async () => {
  const { content, masters } = lessonWith('• Respect\n• Obedience');
  const { result } = await check(content, masters, { env: KEY });
  assert.equal(result.hybrid.valuesClassification, null);
  assert.equal(result.hybrid.alignment.judgements.some(j => j.type === 'Value-map'), false);
  const full = await check(content, masters, { env: FULL });
  assert.equal(JSON.stringify(full.result.hybrid.verdict).includes('Respect') && content.plan[2].values === '• Respect\n• Obedience', true);
});

// ---------------- 4. separate states ----------------
test('structure, curriculum, alignment, values and references are separate answers; none stands in for another', async () => {
  const { content, masters } = lessonWith('Respect', '- Lecture and demonstration.');
  content.refs = { books: { na: false, items: [{ id: 1, t: 'Rivera, M. A., & Santos, J. B. (2021). Fundamentals of Java programming (2nd ed.). Example University Press.' }] }, program: { na: true, items: [] }, online: { na: true, items: [] }, electronics: { na: true, items: [] } };
  masters.curricula[0].courses[0].title = 'A Different Official Title';
  const { verdict } = await check(content, masters, { env: FULL, rules: [[/^Value-map:/, 'NOT_ALIGNED']] });
  const s = verdict.states;
  assert.equal(verdict.completeness.percent !== null, true);
  assert.equal(s.curriculum, 'FAIL', 'curriculum failed');
  assert.equal(s.values, 'NEEDS_REVIEW', 'values need review although structure and references are separate');
  assert.equal(s.references.format, 'NOT_CHECKED' === s.references.format ? 'NOT_CHECKED' : 'PASS', 'format is its own answer');
  assert.equal(s.references.authenticity, 'NOT_CHECKED', 'a correct format is not verification');
  assert.equal(s.references.format, 'PASS');
  assert.notEqual(verdict.overall, 'COMPLIANT');
  assert.ok(['PASS', 'FAIL', 'NEEDS_REVIEW', 'NOT_CHECKED'].includes(s.structure));
});
test('reports saved before this round have no states, identity or classification: the verdict still builds', async () => {
  const { content, masters } = sample();
  const { result } = await check(content, masters, { env: KEY });
  const legacy = JSON.parse(JSON.stringify(result));
  for (const key of ['identity', 'shadowCurriculum', 'provisional', 'valuesClassification', 'stageD', 'verdict']) delete legacy.hybrid[key];
  const v = buildVerdict(legacy, content);
  assert.equal(v.states.identity, null); assert.ok(Array.isArray(v.informational));
  assert.equal(buildVerdict({}, {}).states.values, 'NOT_CHECKED');
});

// ---------------- 5. official scoring compatibility, real syllabi ----------------
for (const key of Object.keys(COURSES)) {
  test(`${COURSES[key].label}: the new options leave the official result identical`, async t => {
    const real = await loadReal(key);
    if (!real) return t.skip('reference-data PDF not present');
    const results = [];
    for (const env of [{ SYLLABUS_CHECK_TITLE_POLICY: 'exact' }, {}, { SYLLABUS_CHECK_STAGE_D1: 'on' }]) results.push(await run(structuredClone(real.content), real.masters, { ...base, useAi: false, env }));
    const key0 = r => JSON.stringify([r.score, r.passed, r.overall, r.hybrid.deductions, r.conformance.failed.map(f => f.id)]);
    assert.equal(key0(results[0]), key0(results[1])); assert.equal(key0(results[1]), key0(results[2]));
    const s = results[1].hybrid.shadowCurriculum;
    assert.ok(s && s.title, 'the shadow decision is reported');
    // the real values columns: supporting values and competencies are recognised, none is turned into a core value without evidence
    const cls = results[2].hybrid.valuesClassification;
    assert.ok(cls.length > 0 && cls.every(c => c.classificationStatus !== 'core_supported'), 'offline: nothing is promoted to a core value');
    assert.ok(cls.some(c => c.classificationStatus === 'needs_review' || c.classificationStatus === 'competency_only' || c.classificationStatus === 'core_named'));
  });
}
