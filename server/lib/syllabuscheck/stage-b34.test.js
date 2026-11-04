// Round 2, Stage B3 (ILO -> CLO mapping) and B4 (whole-course CLO coverage). Each behind its own flag; both advisory.
const ENV = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only', SYLLABUS_CHECK_STAGE_B3: 'on', SYLLABUS_CHECK_STAGE_B4: 'on' };
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { sample } = require('./fixtures');
const { run } = require('./engine');
const { pairsOf, PROMPT, isAdvisory, isNoRewrite, validate } = require('./gemini');
const { promptFor } = require('./variants');
const { stageFlags } = require('./stages');
const { iloCandidates, anyCloPairs, iloMappingAdviceOf, MAX_ANY_CLO } = require('./mapping');
const { coveragePairs, coverageTable } = require('./coverage');
const { scoreEval } = require('./eval/metrics');
const b3 = require('./eval/stage-b3-dataset.json'), b4 = require('./eval/stage-b4-dataset.json');

const base = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }), env: ENV };
// A fake model. `decide(pair)` -> { label, draft?, explanation? }. Every request is recorded so the number of questions asked can be counted.
function model(decide) {
  const asked = [];
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    asked.push(...batch.map(p => p.type + ':' + p.id));
    const answer = pair => { const v = decide(pair) || { label: 'ALIGNED' }; return { id: pair.id, label: v.label, explanation: v.explanation || 'Judged.', sourceQuote: v.quote ?? pair.source.slice(0, 14), targetQuote: pair.target.slice(0, 14), sourceBloom: 'Apply', targetBloom: 'Apply', draft: v.label === 'ALIGNED' ? '' : v.draft ?? pair.target }; };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
  return { transport, asked };
}
const exec = (content, masters, decide, env = ENV) => { const m = model(decide); return run(content, masters, { ...base, env, transport: m.transport }).then(result => ({ result, asked: m.asked })); };
// Plan row 2 (week 3) is tagged to CLO 3 in the fixture; its ILO is sound for the week's content but builds CLO 1.
function wrongClo() {
  const { content, masters } = sample();
  content.plan[2].contents = 'Java conditional statements: if, if-else, nested if and switch';
  content.plan[2].ilos[0].text = 'Develop and test Java programs that use if-else and switch statements to make decisions.';
  content.plan[2].ilos[0].tags = ['clo:c3'];
  const statements = ['Write, test and debug Java programs that use conditional statements and loops.', 'Express a problem as an algorithm before coding.', 'Apply good coding practices in an integrated development environment.', 'Show honesty and responsibility in programming work.'];
  content.clos.forEach((clo, k) => { clo.statement = statements[k]; });
  return { content, masters };
}
const ILO = 'row2-ilo0-clo:c3', ANY = 'row2-ilo0-anyclo';
const decideWrong = (extra = {}) => pair => {
  if (pair.id === ILO) return { label: 'NOT_ALIGNED', draft: pair.target, explanation: 'The CLO tag does not fit; the ILO is sound.' };
  if (pair.id === ANY) return { label: 'ALIGNED', explanation: 'CLO 1: the ILO builds writing and testing programs.', quote: 'Write, test and debug', ...extra };
  return { label: 'ALIGNED' };
};

// ---------------- B3 ----------------
test('B3 asks "does the ILO build any CLO?" only for ILOs whose tagged CLOs all failed, at most 12, and the question lists the approved CLOs', () => {
  const { content } = sample();
  const failed = id => ({ id, label: 'NOT_ALIGNED', unverified: false });
  assert.deepEqual(iloCandidates(content, []), []);
  const judgements = [failed(ILO), { id: 'row3-ilo0-clo:c4', label: 'ALIGNED' }, { id: 'row4-ilo0-clo:c1', label: 'PARTIALLY_ALIGNED', unverified: true }];
  assert.deepEqual(iloCandidates(content, judgements), [{ i: 2, j: 0 }]);
  const many = []; content.plan.forEach((row, i) => (row.ilos || []).forEach((ilo, j) => ilo.tags.forEach(tag => many.push(failed(`row${i}-ilo${j}-${tag}`)))));
  assert.ok(iloCandidates(content, many).length <= MAX_ANY_CLO);
  const [pair] = anyCloPairs(content, [{ i: 2, j: 0 }]);
  assert.equal(pair.type, 'ILO-anyCLO'); assert.equal(pair.id, ANY); assert.equal(pair.targetPath, null); assert.equal(pair.target, content.plan[2].ilos[0].text);
  content.clos.forEach((clo, k) => assert.ok(pair.source.includes(`CLO ${k + 1}: ${clo.statement}`)));
  assert.equal(isAdvisory('ILO-anyCLO'), true); assert.equal(isNoRewrite('ILO-anyCLO'), true);
});
test('a sound ILO tagged to the wrong CLO: the advice is to re-tag it, the ILO is not rewritten, and nothing about the score changes', async () => {
  const { content, masters } = wrongClo();
  const { result, asked } = await exec(structuredClone(content), masters, decideWrong());
  const off = (await exec(structuredClone(content), masters, decideWrong(), { ...ENV, SYLLABUS_CHECK_STAGE_B3: 'off' })).result;
  assert.deepEqual(asked.filter(a => a.startsWith('ILO-anyCLO')), ['ILO-anyCLO:' + ANY], 'exactly one extra question');
  const advice = result.hybrid.mappingAdvice.find(a => a.type === 'CLO');
  assert.deepEqual({ path: advice.path, current: advice.current, suggested: advice.suggested, id: advice.suggestedId }, { path: 'plan[2].ilos[0].tags', current: [3], suggested: 1, id: content.clos[0].id });
  assert.ok(!result.hybrid.suggestions.some(s => s.path === 'plan[2].ilos[0].text'), 'the valid ILO is not rewritten to fit the wrong CLO');
  assert.ok(!result.hybrid.unresolved.some(u => u.path === 'plan[2].ilos[0].text'));
  const f = result.hybrid.verdict.findings.find(x => x.legacyRuleId === 'mapping-advice' && x.ruleId === 'ALN-02');
  assert.equal(f.status, 'NEEDS_REVIEW'); assert.equal(f.responsible, 'clo_mapping'); assert.equal(f.week, '3'); assert.equal(f.clo, 1); assert.equal(f.requiresFacultyApproval, true); assert.equal(f.verification, 'quotes_verified');
  assert.match(f.recommendation, /tagging this ILO to CLO 1 \(".*"\) instead of CLO 3\. The ILO text itself does not need to change/);
  assert.equal(result.score, off.score); assert.equal(result.passed, off.passed); assert.deepEqual(result.hybrid.deductions, off.hybrid.deductions); assert.equal(result.conformance.ok, off.conformance.ok);
  assert.deepEqual(content.plan[2].ilos[0].tags, ['clo:c3'], 'the faculty mapping is untouched');
});
test('nothing is invented: a CLO number outside the list, a quote from another CLO, an already tagged CLO or a passing tag give no advice', async () => {
  for (const extra of [{ explanation: 'CLO 9: it builds that.' }, { quote: 'Develop a system requirements' }, { explanation: 'CLO 3: it builds that.', quote: 'Write, test and debug' }]) {
    const { content, masters } = wrongClo();
    const { result } = await exec(content, masters, decideWrong(extra));
    assert.deepEqual(result.hybrid.mappingAdvice.filter(a => a.type === 'CLO'), [], JSON.stringify(extra));
  }
  const { content, masters } = wrongClo();
  const { result, asked } = await exec(content, masters, pair => (pair.id === ILO ? { label: 'ALIGNED' } : { label: 'ALIGNED' }));
  assert.ok(!asked.some(a => a.startsWith('ILO-anyCLO')), 'no question when every tag passes');
  assert.deepEqual(result.hybrid.mappingAdvice, []);
});
test('precedence, so B1, B2 and B3 never contradict each other: off-course content, then an unrelated ILO, come before the CLO tag', async () => {
  const flagsB = { ...ENV, SYLLABUS_CHECK_STAGE_B: 'on' };
  // content off-course: no mapping advice, no ILO-CLO rewrite, the ILO waits (B2) and the content has its own draft (B1)
  let { content, masters } = wrongClo();
  // (the draft must not repeat the topic judged off-course: a draft that does is held for the author's decision, Stage E.4)
  let { result } = await exec(content, masters, pair => (pair.id === 'row2-content' ? { label: 'NOT_ALIGNED', draft: 'Java methods: defining and calling methods with parameters' } : decideWrong()(pair)), flagsB);
  assert.deepEqual(result.hybrid.mappingAdvice.filter(a => a.type === 'CLO'), []);
  assert.ok(!result.hybrid.suggestions.some(s => s.path === 'plan[2].ilos[0].text')); assert.ok(result.hybrid.suggestions.some(s => s.path === 'plan[2].contents'));
  // the ILO itself is unrelated to the content: B2 owns it; B3 gives no mapping advice and no second ILO draft
  ({ content, masters } = wrongClo());
  ({ result } = await exec(content, masters, pair => (pair.id === 'row2-ilo0-contentilo' ? { label: 'NOT_ALIGNED', draft: 'Develop and test Java decision programs.' } : pair.id === ILO ? { label: 'NOT_ALIGNED', draft: 'A rival rewrite for the CLO.' } : decideWrong()(pair)), flagsB));
  assert.deepEqual(result.hybrid.mappingAdvice.filter(a => a.type === 'CLO'), []);
  const drafts = result.hybrid.suggestions.filter(s => s.path === 'plan[2].ilos[0].text');
  assert.equal(drafts.length, 1); assert.equal(drafts[0].text, 'Develop and test Java decision programs.');
});
test('B3 works with Stage A and Stage B switched off', async () => {
  const { content, masters } = wrongClo();
  const env = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only', SYLLABUS_CHECK_STAGE_B3: 'on' };
  assert.deepEqual(stageFlags(env), { a: false, b: false, b3: true, b4: false, c1: false, c2: false, d1: false, d2: false });
  const { result } = await exec(content, masters, decideWrong(), env);
  assert.equal(result.hybrid.mappingAdvice.filter(a => a.type === 'CLO').length, 1); assert.equal(result.hybrid.alignment.promptVersion, 'alignment-123-r7');
});
test('the B3 prompt wording refuses tag-only alignment and keeps a sound ILO unchanged', () => {
  const text = promptFor(PROMPT, 'current', { a: false, b: false, b3: true, b4: false, c1: false, c2: false, d1: false, d2: false });
  assert.match(text, /never aligned merely because it carries a CLO's identifier/); assert.match(text, /set recommendation to RETAG_OUTCOME and leave the draft empty, so the ILO text stays exactly as written/);
  assert.match(text, /- ILO-anyCLO \(advice only\)/); assert.ok(!/CLO-coverage/.test(text));
});

// ---------------- B4 ----------------
function planWith(content, rows) { content.plan = rows; return content; }
const row = (week, contents, ilos = [], values = '', kind = 'lesson') => ({ id: 'r' + week, kind, week: String(week), contents, values, activities: 'Lecture', tasks: 'Quiz', ilos: ilos.map(([text, ...tags], n) => ({ id: `i${week}-${n}`, text, tags: tags.map(t => `clo:${t}`) })) });
const sampleClos = () => [['c1', 'Demonstrating', 'Write and test Java programs.'], ['c2', 'Enabling', 'Express a problem as an algorithm.'], ['c3', 'Enabling', 'Apply good coding practice.'], ['c4', 'Integration of Values', 'Show honesty and responsibility in programming work.']].map(([id, level, statement]) => ({ id, level, statement }));
const pairsFor = content => { const found = []; coveragePairs(content, (id, type, source, target) => found.push({ id, type, source, target })); return found; };
const coursePlan = () => [row(1, 'Course orientation: objectives and grading', [['Describe the course requirements.']]), row(2, 'Variables', [['Declare variables.', 'c1']]), row(3, 'Conditionals', [['Develop programs with if statements.', 'c1']]), row(4, 'Algorithms and flowcharts', [['Draw a flowchart.', 'c2']]), row(5, 'EXAMINATION', [], '', 'exam'), row('7-8', 'Debugging', [['Trace and fix errors.', 'c1', 'c3']]), row(9, 'Ethics in programming', [['Show honesty in a team task.', 'c4']], 'Humility: students credit sources and review code kindly.')];

test('B4 builds ONE question per CLO from the actual content and ILO text of its tagged weeks, with the other weeks in brief and the examinations apart', () => {
  const content = planWith({ clos: sampleClos() }, coursePlan());
  const pairs = pairsFor(content);
  assert.equal(pairs.length, 4); assert.ok(pairs.every(p => p.type === 'CLO-coverage'));
  const one = pairs[0];
  assert.equal(one.source, 'CLO 1 [course level tag: Demonstrating]: Write and test Java programs.');
  for (const part of ['Weeks tagged to this CLO:', '- Week 2: ILO: Declare variables. | Content: Variables', '- Week 7-8: ILO: Trace and fix errors. | Content: Debugging', 'Other weeks (not tagged to this CLO):', '- Week 4: Algorithms and flowcharts', 'Examination weeks: 5']) assert.ok(one.target.includes(part), part);
  assert.ok(!/Week 5: EXAM/.test(one.target.split('Other weeks')[1]), 'an examination row is not an "other week"');
  assert.ok(pairs[3].target.includes('Values: Humility: students credit sources'), 'the values CLO is given the values column');
  assert.ok(!pairs[0].target.includes('Values:'), 'only a values CLO is');
  assert.match(pairs[1].target, /Week 4: ILO: Draw a flowchart/);
  assert.deepEqual(pairsFor(planWith({ clos: sampleClos() }, coursePlan().slice(0, 2))), [], 'too few teaching weeks to ask');
  assert.equal(isAdvisory('CLO-coverage'), true); assert.equal(isNoRewrite('CLO-coverage'), true);
});
test('a long syllabus does not create a long question: the weeks listed are bounded and the number of questions is the number of CLOs', () => {
  const rows = Array.from({ length: 36 }, (_, i) => row(i + 1, 'Topic number ' + (i + 1) + ' '.repeat(3) + 'x'.repeat(2000), [['An ILO of week ' + (i + 1) + 'y'.repeat(2000), 'c1']]));
  const pairs = pairsFor(planWith({ clos: sampleClos() }, rows));
  assert.equal(pairs.length, 4); assert.ok(pairs.every(p => p.target.length < 6500), Math.max(...pairs.map(p => p.target.length)) + ' characters');
  assert.match(pairs[0].target, /more tagged weeks not shown/);
});
test('coverage evidence comes from checked relationships, never from the tag: supported, tagged-but-unsupported, unchecked, off-course and multiweek counted', () => {
  const content = planWith({ clos: sampleClos() }, coursePlan());
  const j = (id, label, extra = {}) => ({ id, label, unverified: false, ...extra });
  const table = coverageTable(content, [j('row1-ilo0-clo:c1', 'ALIGNED'), j('row2-ilo0-clo:c1', 'NOT_ALIGNED'), j('row5-ilo0-clo:c1', 'ALIGNED'), j('row5-ilo0-clo:c3', 'ALIGNED'), j('row5-content', 'NOT_ALIGNED')]);
  const one = table[0];
  assert.deepEqual(one.tagged.weeks, ['2', '3', '7-8']); assert.deepEqual(one.supported.weeks, ['2']); assert.deepEqual(one.unsupported.weeks, ['3']); assert.deepEqual(one.offCourse.weeks, ['7-8']); assert.equal(one.tagged.count, 4, '7-8 is two weeks');
  assert.deepEqual(coverageTable(content, [])[0].unverified.weeks, ['2', '3', '7-8']);
  assert.deepEqual(coverageTable(content, [])[0].supported.weeks, [], 'a tag alone supports nothing');
  assert.deepEqual(table[3].supported.weeks, [], 'no verdict for CLO 4 yet');
});
test('B4 end to end: one question per CLO, advisory, with the evidence and the responsible element; scores and gates do not move', async () => {
  const { content, masters } = sample();
  const decide = pair => (pair.id === 'coverage-clo1' ? { label: 'NOT_ALIGNED', explanation: 'No week really builds CLO 2; weeks 3 and 7 are tagged but teach other things.' } : pair.id === 'coverage-clo2' ? { label: 'PARTIALLY_ALIGNED', explanation: 'Week 4 builds it but nothing shows progression.' } : { label: 'ALIGNED' });
  const { result, asked } = await exec(structuredClone(content), masters, decide);
  const off = (await exec(structuredClone(content), masters, decide, { ...ENV, SYLLABUS_CHECK_STAGE_B4: 'off' })).result;
  assert.equal(asked.filter(a => a.startsWith('CLO-coverage')).length, 4, 'once per CLO, not per week');
  const f = result.hybrid.verdict.findings.filter(x => x.legacyRuleId === 'CLO-coverage');
  assert.equal(f.find(x => x.clo === 2).status, 'FAIL'); assert.equal(f.find(x => x.clo === 2).severity, 'MINOR'); assert.equal(f.find(x => x.clo === 3).status, 'NEEDS_REVIEW');
  const bad = f.find(x => x.clo === 2); assert.equal(bad.ruleId, 'PLAN-10'); assert.equal(bad.scope, 'course'); assert.equal(bad.responsible, 'course_plan'); assert.equal(bad.method, 'ai_semantic'); assert.ok(bad.reference.startsWith('CLO 2')); assert.ok(bad.verification === 'quotes_verified'); assert.match(bad.explanation, /weeks 3 and 7/);
  assert.ok(Array.isArray(result.hybrid.coverage) && result.hybrid.coverage.length === 4);
  assert.deepEqual(result.hybrid.deductions, off.hybrid.deductions); assert.equal(result.score, off.score); assert.equal(result.passed, off.passed); assert.equal(result.conformance.ok, off.conformance.ok);
  assert.ok(!result.hybrid.suggestions.some(s => /coverage/.test(s.id)), 'coverage never rewrites anything');
});
test('B4 reports tagged weeks that were judged not to build the CLO, and weeks that cannot count while their content is off-course', async () => {
  const { content, masters } = sample();
  const { result } = await exec(content, masters, pair => (pair.id === 'row0-ilo0-clo:c1' ? { label: 'NOT_ALIGNED' } : pair.id === 'row4-content' ? { label: 'NOT_ALIGNED' } : { label: 'ALIGNED' }), { ...ENV, SYLLABUS_CHECK_STAGE_B: 'on' });
  const evidence = result.hybrid.verdict.findings.filter(f => f.legacyRuleId === 'coverage-evidence');
  assert.ok(evidence.some(f => /judged not to build it/.test(f.explanation) && f.clo === 1 && f.method === 'deterministic'));
  assert.ok(evidence.some(f => /course content is not about the course/.test(f.explanation) && f.severity === 'INFO'));
});
test('with B3 and B4 off nothing changes: no extra question, no coverage field, the alignment-10 prompt (pinned hash) and its cache version', async () => {
  const { content, masters } = wrongClo();
  const flagsOff = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' };
  const { result, asked } = await exec(content, masters, decideWrong(), flagsOff);
  assert.ok(!asked.some(a => /^(ILO-anyCLO|CLO-coverage)/.test(a))); assert.equal(result.hybrid.coverage, null); assert.deepEqual(result.hybrid.mappingAdvice, []); assert.equal(result.hybrid.alignment.promptVersion, 'alignment-10');
  assert.equal(crypto.createHash('sha256').update(promptFor(PROMPT, 'current', stageFlags({}))).digest('hex'), '81d11a069d91ee47c7171bd941f05867d73e6423eebf1ea9d8fa6c06f49d7262');
  assert.equal(pairsOf(content, masters, [], { stageA: false, stageB: false, stageB4: false }).filter(p => p.type === 'CLO-coverage').length, 0);
});
test('without AI the new rules are NOT_CHECKED, never a pass, and the overall verdict is never COMPLIANT', async () => {
  const { content, masters } = sample();
  const result = await run(content, masters, { useAi: false, linkChecker: base.linkChecker, env: ENV });
  const v = result.hybrid.verdict;
  assert.equal(v.findings.find(f => f.ruleId === 'PLAN-10').status, 'NOT_CHECKED'); assert.equal(v.findings.find(f => f.ruleId === 'ALN-02').status, 'NOT_CHECKED'); assert.notEqual(v.overall, 'COMPLIANT');
});
test('an incomplete answer is rejected and a failed coverage question never holds the check open', async () => {
  const { content, masters } = sample();
  const pairs = pairsFor(planWith({ clos: sampleClos() }, coursePlan()));
  assert.throws(() => validate({ judgements: [] }, pairs), /omitted/);
  const { result } = await exec(content, masters, pair => (/^coverage-/.test(pair.id) ? { label: 'INSUFFICIENT_EVIDENCE' } : { label: 'ALIGNED' }));
  assert.equal(result.hybrid.alignment.status, 'completed');
  assert.equal(result.hybrid.verdict.findings.find(f => f.legacyRuleId === 'CLO-coverage').status, 'NOT_CHECKED');
});

// ---------------- datasets ----------------
test('the B3 and B4 datasets are synthetic and unreviewed, cover the three programs and every required case, and never accept ALIGNED for a trap', () => {
  for (const [name, ds] of [['B3', b3], ['B4', b4]]) {
    assert.match(ds.status, /NOT faculty-reviewed/, name); assert.equal(ds.reviewStatus, 'unreviewed'); assert.match(ds.provenance, /SYNTHETIC/);
    assert.deepEqual([...new Set(Object.values(ds.courses).map(c => c.program))].sort(), ['BSCPE', 'BSIE', 'BSIT']);
    for (const item of ds.items) { assert.equal(item.facultyVerdict, null); assert.equal(item.reviewStatus, 'unreviewed'); if (!['clear-positive', 'ambiguous', 'multiweek', 'values-clo', 'untagged-support', 'few-weeks'].includes(item.category)) assert.ok(!item.accept.includes('ALIGNED'), item.id); }
  }
  for (const category of ['clear-positive', 'wrong-clo', 'keyword-overlap', 'ambiguous', 'off-subject']) assert.ok(b3.items.some(i => i.category === category), category);
  for (const category of ['multiweek', 'values-clo', 'misleading-tags', 'gap', 'untagged-support', 'few-weeks']) assert.ok(b4.items.some(i => i.category === category), category);
  assert.ok(b4.items.every(i => i.target.includes('Examination weeks:')), 'examination rows are listed apart in every coverage question');
});
test('a keyword-matching judge approves the B3 traps and is caught; a judge that follows the labels is not', () => {
  const words = text => new Set(String(text).toLowerCase().match(/[a-z]{3,}/g) || []);
  const naive = new Map(b3.items.map(i => { const s = words(i.source); return [i.id, [...words(i.target)].some(w => s.has(w)) ? 'ALIGNED' : 'NOT_ALIGNED']; }));
  assert.ok(scoreEval(b3.items, [naive]).counts.falseNegative >= 3);
  const careful = scoreEval(b3.items, [new Map(b3.items.map(i => [i.id, i.accept[0]]))]); assert.equal(careful.counts.falseNegative, 0); assert.equal(careful.counts.falsePositive, 0);
});

test('an explanation that cites a week the plan does not have is not trusted: the finding becomes NEEDS_REVIEW and says so', async () => {
  const { content, masters } = sample();
  const { result } = await exec(content, masters, pair => (pair.id === 'coverage-clo2' ? { label: 'NOT_ALIGNED', explanation: 'No week builds CLO 3; only Week 31 (Coding standards) does.' } : { label: 'ALIGNED' }));
  const f = result.hybrid.verdict.findings.find(x => x.legacyRuleId === 'CLO-coverage' && x.clo === 3);
  assert.equal(f.status, 'NEEDS_REVIEW'); assert.equal(f.verification, 'cited_week_not_in_plan'); assert.match(f.explanation, /cites week\(s\) 31, which the plan does not contain/);
  const real = await exec(structuredClone(content), masters, pair => (pair.id === 'coverage-clo2' ? { label: 'NOT_ALIGNED', explanation: 'No week builds CLO 3; weeks 3 and 7 are tagged but teach other things.' } : { label: 'ALIGNED' }));
  assert.equal(real.result.hybrid.verdict.findings.find(x => x.legacyRuleId === 'CLO-coverage' && x.clo === 3).status, 'FAIL', 'weeks that exist are fine');
});

test('a second check of the same syllabus revision asks the new questions zero times: earlier verified answers are reused, and only a changed item is asked again', async () => {
  const { content, masters } = wrongClo();
  const first = await exec(structuredClone(content), masters, decideWrong());
  const reuse = new Map(first.result.hybrid.alignment.judgements.filter(j => j.key && !j.unverified).map(j => [j.key, j]));
  const second = model(decideWrong());
  await run(structuredClone(content), masters, { ...base, reuse, transport: second.transport });
  assert.deepEqual(second.asked.filter(a => /^(CLO-coverage|ILO-anyCLO)/.test(a)), [], 'unchanged: nothing is asked');
  const edited = structuredClone(content); edited.plan[2].ilos[0].text = 'Develop and test Java programs that use switch statements.';
  const third = model(decideWrong());
  await run(edited, masters, { ...base, reuse, transport: third.transport });
  assert.deepEqual(third.asked.filter(a => a.startsWith('CLO-coverage')), ['CLO-coverage:coverage-clo2'], 'only the CLO whose tagged ILO changed is asked again');
  const retopic = structuredClone(content); retopic.plan[4].contents = 'A different topic for week 5';
  const fourth = model(decideWrong());
  await run(retopic, masters, { ...base, reuse, transport: fourth.transport });
  assert.equal(fourth.asked.filter(a => a.startsWith('CLO-coverage')).length, 4, 'a week listed in every question changed: each question is asked once more, never once per week');
});

test('a Week 1 course-orientation ILO is not asked "which CLO does it build?": it describes the course, not a CLO competence', () => {
  const { content } = sample();
  content.plan[0].contents = 'Course orientation: objectives, requirements, grading and policies';
  content.plan[0].ilos[0].text = 'Describe the course objectives and requirements.'; // the ILO itself is about the course
  const failed = id => ({ id, label: 'NOT_ALIGNED', unverified: false });
  const judgements = content.plan[0].ilos[0].tags.map(tag => failed(`row0-ilo0-${tag}`)).concat(content.plan[1].ilos[0].tags.map(tag => failed(`row1-ilo0-${tag}`)));
  assert.deepEqual(iloCandidates(content, judgements), [{ i: 1, j: 0 }]);
});
