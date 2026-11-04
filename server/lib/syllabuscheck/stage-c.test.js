// Stage C: C1 learning activities (Activity-fit) and C2 assessment tasks (Assessment-fit). Advisory, behind SYLLABUS_CHECK_STAGE_C1 / _C2, off by default.
const ALL = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only', SYLLABUS_CHECK_STAGE_A: 'on', SYLLABUS_CHECK_STAGE_B: 'on', SYLLABUS_CHECK_STAGE_B3: 'on', SYLLABUS_CHECK_STAGE_B4: 'on', SYLLABUS_CHECK_STAGE_C1: 'on', SYLLABUS_CHECK_STAGE_C2: 'on' };
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { sample } = require('./fixtures');
const { run } = require('./engine');
const gemini = require('./gemini');
const { align, pairsOf, PROMPT, resetProviderBlock, isAdvisory } = gemini;
const { promptFor } = require('./variants');
const { stageFlags } = require('./stages');
const fit = require('./lessonfit');
const { scoreEval } = require('./eval/metrics');
const stageC = require('./eval/stage-c-dataset.json');

test.afterEach(() => resetProviderBlock());
const base = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }), env: ALL };
function model(decide) {
  const asked = [];
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    asked.push(...batch.map(p => p.type + ':' + p.id));
    const answer = pair => { const v = decide(pair) || { label: 'ALIGNED' }; return { id: pair.id, label: v.label, explanation: v.explanation || 'Judged.', sourceQuote: pair.source.slice(0, 14), targetQuote: pair.target.slice(0, 14), sourceBloom: 'Apply', targetBloom: 'Apply', draft: v.label === 'ALIGNED' ? '' : v.draft ?? pair.target, ...(v.aspects || {}) }; };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
  return { transport, asked };
}
const exec = (content, masters, decide, env = ALL, extra = {}) => { const m = model(decide); return run(content, masters, { ...base, env, ...extra, transport: m.transport }).then(result => ({ result, asked: m.asked })); };
const ok = { label: 'ALIGNED' };
// Week 3 (plan row 2) is the lesson under test: Java conditionals, an ILO that develops and tests, a guided coding activity and (by default) a programming task.
function lesson({ activities = '- Guided Java coding exercise: demonstration, then pair programming.', tasks = '- Programming task: write and test an if-else program.' } = {}) {
  const { content, masters } = sample();
  content.meta.lecture = '2'; content.meta.lab = '1';
  const row = content.plan[2];
  row.contents = 'Java conditional statements: if, if-else, nested if and switch';
  row.ilos[0].text = 'Develop and test Java programs that use if-else and switch statements to make decisions.';
  row.activities = activities; row.tasks = tasks;
  return { content, masters };
}
const AF = 'row2-activityfit', AS = 'row2-assessfit', SA = 'row2-ilo0-activity', SS = 'row2-ilo0-assessment';
const count = (asked, type) => asked.filter(a => a.startsWith(type + ':')).length;

// ---------------- reuse and eligibility ----------------
test('a lesson is asked the deeper question only when the scored answer is ALIGNED and its content and ILO are not known to be off; examination rows never', () => {
  const { content } = lesson();
  const J = (id, label, extra = {}) => ({ id, label, unverified: false, ...extra });
  const aligned = () => content.plan.flatMap((row, i) => (row.kind === 'exam' || !row.ilos.length ? [] : row.ilos.map((_, j) => [J(`row${i}-ilo${j}-activity`, 'ALIGNED'), J(`row${i}-ilo${j}-assessment`, 'ALIGNED')]).flat()));
  const all = fit.eligible(content, aligned(), 'activity');
  assert.ok(all.asked.includes(2)); assert.ok(!all.asked.some(i => content.plan[i].kind === 'exam'), 'examination weeks are never asked');
  assert.ok(fit.eligible(content, aligned().map(j => (j.id === SA ? J(SA, 'NOT_ALIGNED') : j)), 'activity').reused.includes(2), 'the scored answer is reused, not asked again');
  assert.ok(fit.eligible(content, aligned().filter(j => j.id !== SA), 'activity').reused.includes(2), 'unknown scored answer: not asked');
  assert.ok(fit.eligible(content, [...aligned(), J('row2-content', 'NOT_ALIGNED')], 'activity').upstream.includes(2), 'off-course content is what has to change first');
  assert.ok(fit.eligible(content, [...aligned(), J('row2-ilo0-contentilo', 'PARTIALLY_ALIGNED')], 'assessment').upstream.includes(2), 'so is an ILO that does not fit the content');
  content.plan[2].activities = '   ';
  assert.ok(fit.eligible(content, aligned(), 'activity').missing.includes(2));
});
test('the pair text carries the content, the ILOs and the contact units the syllabus states - and invents none', () => {
  const { content } = lesson();
  const [pair] = fit.activityPairs(content, [2]);
  assert.equal(pair.id, AF); assert.equal(pair.type, 'Activity-fit'); assert.equal(pair.path, 'plan[2].activities'); assert.equal(pair.targetPath, 'plan[2].activities'); assert.equal(pair.target, content.plan[2].activities);
  for (const part of ['Week 3 course content: Java conditional statements', 'ILOs:', '- Develop and test Java programs', 'Course-wide contact units (not lesson requirements or proof of resource availability): lecture 2, laboratory 1']) assert.ok(pair.source.includes(part), part);
  const [task] = fit.assessmentPairs(content, [2]);
  assert.equal(task.id, AS); assert.equal(task.path, 'plan[2].tasks'); assert.ok(task.source.includes('Learning activities: - Guided Java coding exercise'));
  const none = lesson().content; delete none.meta.lecture; delete none.meta.lab;
  assert.ok(!fit.activityPairs(none, [2])[0].source.includes('Course-wide contact units'), 'no units stated, none shown');
  for (const type of ['Activity-fit', 'Assessment-fit']) assert.equal(isAdvisory(type), true);
});

// ---------------- C1 ----------------
test('C1: the scored activity answer is reused; only an aligned lesson gets one deeper question; an unsuitable activity gets a minimal advisory fix and costs nothing', async () => {
  const { content, masters } = lesson();
  const draft = '- Guided Java coding exercise: demonstration, then pair programming; if a starter file is available, offer it to learners who want a scaffold.';
  const { result, asked } = await exec(structuredClone(content), masters, pair => (pair.id === AF ? { label: 'PARTIALLY_ALIGNED', draft, explanation: 'Listening only, no demonstration.', aspects: { teaching: 'weak', learnerSupport: 'limited', responsible: 'activity' } } : ok));
  const off = (await exec(structuredClone(content), masters, pair => (pair.id === AF ? { label: 'PARTIALLY_ALIGNED', draft } : ok), { ...ALL, SYLLABUS_CHECK_STAGE_C1: 'off', SYLLABUS_CHECK_STAGE_C2: 'off' })).result;
  assert.equal(count(asked, 'Activity-fit'), 15 - 0, 'one question per instructional week with text'); assert.equal(count(asked, 'ILO-activity'), 15, 'the scored question is asked once and not repeated');
  const f = result.hybrid.verdict.findings.find(x => x.legacyRuleId === 'Activity-fit' && x.path === 'plan[2].activities');
  assert.equal(f.status, 'NEEDS_REVIEW'); assert.equal(f.severity, 'MINOR'); assert.equal(f.responsible, 'activity'); assert.equal(f.week, '3'); assert.equal(f.recommendation, draft); assert.equal(f.requiresFacultyApproval, true);
  assert.equal(result.hybrid.suggestions.find(s => s.path === 'plan[2].activities').text, draft);
  assert.deepEqual(result.hybrid.deductions, off.hybrid.deductions); assert.equal(result.score, off.score); assert.equal(result.passed, off.passed); assert.equal(result.conformance.ok, off.conformance.ok);
  assert.ok(!result.hybrid.suggestions.some(s => ['plan[2].contents', 'plan[2].ilos[0].text'].includes(s.path)), 'valid content and ILO are not rewritten to justify an activity');
});
test('C1: sound teaching with limited learner support is its own finding (ALN-06), judged leniently and never an assumption about students', async () => {
  const { content, masters } = lesson({ activities: '- Individual timed coding test.' });
  const draft = '- Individual coding task, preceded by a short guided demonstration and teacher feedback.';
  const { result } = await exec(content, masters, pair => (pair.id === AF ? { label: 'PARTIALLY_ALIGNED', draft, explanation: 'Students write programs, but in one timed individual format with no demonstration or scaffold.', aspects: { teaching: 'sound', learnerSupport: 'limited', responsible: 'activity' } } : ok));
  const f = result.hybrid.verdict.findings.filter(x => x.legacyRuleId === 'Activity-fit' && x.path === 'plan[2].activities');
  assert.equal(f.find(x => x.ruleId === 'ALN-05'), undefined, 'the teaching is sound, so ALN-05 is a pass (not listed)');
  const support = f.find(x => x.ruleId === 'ALN-06');
  assert.equal(support.status, 'NEEDS_REVIEW'); assert.equal(support.verification, 'structured_field'); assert.equal(support.recommendation, draft);
  assert.doesNotMatch(PROMPT, /student has a disability|assume the student/i); assert.match(PROMPT, /Never infer a learner's personal characteristics/);
  const adequate = await exec(structuredClone(content), masters, pair => (pair.id === AF ? { label: 'ALIGNED', explanation: 'Sound.', aspects: { teaching: 'sound', learnerSupport: 'adequate', responsible: 'none' } } : ok));
  assert.ok(adequate.result.hybrid.verdict.counts.PASS > 0); assert.ok(!adequate.result.hybrid.verdict.findings.some(x => x.ruleId === 'ALN-06' && x.path === 'plan[2].activities'));
});
test('C1: when the scored ILO-activity answer already says the activity does not fit, nothing more is asked and the existing finding and draft stand', async () => {
  const { content, masters } = lesson({ activities: '- Group discussion on the history of computers.' });
  const draft = '- Guided Java coding exercise: demonstration, then pair programming.';
  const { result, asked } = await exec(content, masters, pair => (pair.id === SA ? { label: 'NOT_ALIGNED', draft } : ok));
  assert.ok(!asked.includes('Activity-fit:' + AF), 'no duplicate question');
  const f = result.hybrid.verdict.findings.find(x => x.legacyRuleId === 'ILO-activity' && x.path === 'plan[2].ilos[0].text');
  assert.equal(f.status, 'FAIL'); assert.equal(f.responsible, 'activity');
  assert.equal(result.hybrid.suggestions.find(s => s.path === 'plan[2].activities').text, draft, 'upstream is verified, so the draft is offered');
  assert.ok(result.hybrid.deductions.some(d => d.id === 'SEM:' + SA), 'the scored deduction is untouched');
});

// ---------------- precedence: content, ILO, CLO tag, activity, assessment ----------------
test('precedence: off-course content comes first - no Stage C question for the lesson, and no rewrite of its activity or assessment (scored drafts included)', async () => {
  const { content, masters } = lesson({ activities: '- Lecture on supply chains.', tasks: '- Essay.' });
  content.plan[2].contents = 'Principles of supply chain management';
  const { result, asked } = await exec(content, masters, pair => (pair.id === 'row2-content' ? { label: 'NOT_ALIGNED', draft: 'Java conditional statements' } : pair.id === SA || pair.id === SS ? { label: 'NOT_ALIGNED', draft: 'A rewrite built on the wrong topic.' } : ok));
  assert.ok(!asked.includes('Activity-fit:' + AF) && !asked.includes('Assessment-fit:' + AS));
  assert.ok(result.hybrid.suggestions.some(s => s.path === 'plan[2].contents'), 'the content is what is fixed');
  assert.ok(!result.hybrid.suggestions.some(s => ['plan[2].activities', 'plan[2].tasks'].includes(s.path)));
  const f = result.hybrid.verdict.findings.find(x => x.legacyRuleId === 'ILO-activity' && x.path === 'plan[2].ilos[0].text');
  assert.equal(f.responsible, 'course_content'); assert.equal(f.recommendation, null); assert.equal(f.withheld, 'upstream_invalid'); assert.match(f.withheldNote, /course content or ILO is itself off/);
});
test('precedence: an ILO that does not fit the week comes before its activity and assessment', async () => {
  const { content, masters } = lesson();
  const { result } = await exec(content, masters, pair => (pair.id === 'row2-ilo0-contentilo' ? { label: 'NOT_ALIGNED', draft: 'Develop and test Java decision programs.' } : pair.id === SS ? { label: 'NOT_ALIGNED', draft: 'A task for the wrong ILO.' } : ok));
  assert.ok(result.hybrid.suggestions.some(s => s.path === 'plan[2].ilos[0].text')); assert.ok(!result.hybrid.suggestions.some(s => s.path === 'plan[2].tasks'));
  assert.equal(result.hybrid.verdict.findings.find(x => x.legacyRuleId === 'ILO-assessment' && x.path === 'plan[2].ilos[0].text').responsible, 'ilo');
});
test('precedence: the learning activity comes before the assessment - an assessment is not rewritten while its activity does not fit', async () => {
  const { content, masters } = lesson({ activities: '- Group discussion on the history of computers.' });
  const { result } = await exec(content, masters, pair => (pair.id === SA ? { label: 'NOT_ALIGNED', draft: '- Guided Java coding exercise.' } : pair.id === SS ? { label: 'NOT_ALIGNED', draft: '- A task that matches the corrected activity.' } : ok));
  assert.ok(result.hybrid.suggestions.some(s => s.path === 'plan[2].activities')); assert.ok(!result.hybrid.suggestions.some(s => s.path === 'plan[2].tasks'));
  const f = result.hybrid.verdict.findings.find(x => x.legacyRuleId === 'ILO-assessment' && x.path === 'plan[2].ilos[0].text');
  assert.equal(f.withheld, 'activity_invalid'); assert.match(f.withheldNote, /learning activity is not aligned, so correct the activity first/); assert.equal(f.recommendation, null);
});
test('a lesson whose content and ILO have not been verified (Stage B off) gets its Stage C findings but no rewrite, and the report says why', async () => {
  const { content, masters } = lesson();
  const env = { ...ALL }; delete env.SYLLABUS_CHECK_STAGE_B;
  // (the answer assesses the teaching, as the strict schema has it do: a failure that rests on an unassessed field is only reviewed, Stage E.6)
  const { result, asked } = await exec(content, masters, pair => (pair.id === AF ? { label: 'NOT_ALIGNED', draft: '- A new activity.', aspects: { teaching: 'weak', learnerSupport: 'limited', responsible: 'activity' } } : pair.id === SS ? { label: 'NOT_ALIGNED', draft: '- A new task.' } : ok), env);
  assert.ok(asked.includes('Activity-fit:' + AF));
  assert.ok(!result.hybrid.suggestions.some(s => ['plan[2].activities', 'plan[2].tasks'].includes(s.path)));
  const f = result.hybrid.verdict.findings.find(x => x.legacyRuleId === 'Activity-fit' && x.path === 'plan[2].activities');
  assert.equal(f.status, 'FAIL'); assert.equal(f.recommendation, null); assert.equal(f.withheld, 'upstream_unverified'); assert.match(f.withheldNote, /have not been verified/);
});

// ---------------- C2 ----------------
test('C2 example: Java conditionals, a guided coding activity and an essay about the history of computers - NOT_ALIGNED, the assessment alone is replaced', async () => {
  const { content, masters } = lesson({ tasks: '- Write an essay about the history of computers.' });
  const draft = '- Programming task: implement and test conditional logic in a Java program; submit the code and the test results.';
  const { result, asked } = await exec(structuredClone(content), masters, pair => (pair.id === SS ? { label: 'NOT_ALIGNED', draft, explanation: 'An essay on computer history does not show that students can develop and test a program.' } : ok));
  assert.ok(!asked.includes('Assessment-fit:' + AS), 'the scored answer is reused');
  const f = result.hybrid.verdict.findings.find(x => x.legacyRuleId === 'ILO-assessment' && x.path === 'plan[2].ilos[0].text');
  assert.equal(f.ruleId, 'ALN-07'); assert.equal(f.status, 'FAIL'); assert.equal(f.responsible, 'assessment'); assert.equal(f.recommendation, draft);
  assert.deepEqual(result.hybrid.suggestions.filter(s => s.path.startsWith('plan[2]')).map(s => s.path), ['plan[2].tasks']);
  assert.equal(content.plan[2].activities, '- Guided Java coding exercise: demonstration, then pair programming.', 'the valid activity is preserved');
});
test('C2: the structured fields the model answers become rules; a missing field leaves the rule NOT_CHECKED, and a passing lesson is never invented', async () => {
  const { content, masters } = lesson({ tasks: '- Quiz' });
  const { result } = await exec(content, masters, pair => (pair.id === AS ? { label: 'PARTIALLY_ALIGNED', draft: '- Programming task with test cases.', explanation: 'The task names a format only and nothing is produced.', aspects: { measures: 'partly', evidence: 'vague', level: 'too_low', responsible: 'assessment' } } : ok));
  const get = id => result.hybrid.verdict.findings.find(x => x.ruleId === id && x.path === 'plan[2].tasks');
  assert.equal(get('ALN-07').status, 'NEEDS_REVIEW'); assert.equal(get('ALN-07').recommendation, '- Programming task with test cases.');
  assert.equal(get('ALN-08').status, 'NEEDS_REVIEW'); assert.equal(get('ALN-09').status, 'NEEDS_REVIEW'); assert.equal(get('ALN-08').verification, 'structured_field');
  // An answer that leaves the fields out says nothing about them: each derived rule is NOT_CHECKED for the lesson (Stage E.6: reported, never left
  // out and never passed), and the ALIGNED label, whose own field was not assessed either, is shown for review instead of counted as a pass.
  const quiet = await exec(structuredClone(content), masters, () => ok);
  const derived = quiet.result.hybrid.verdict.findings.filter(x => ['ALN-08', 'ALN-09'].includes(x.ruleId) && x.path === 'plan[2].tasks');
  assert.deepEqual(derived.map(x => [x.ruleId, x.status, x.verification]), [['ALN-08', 'NOT_CHECKED', 'aspect_not_assessed'], ['ALN-09', 'NOT_CHECKED', 'aspect_not_assessed']], 'no statement, no derived pass');
  assert.equal(quiet.result.hybrid.verdict.findings.find(x => x.legacyRuleId === 'Assessment-fit' && x.path === 'plan[2].tasks').status, 'NEEDS_REVIEW');
});
test('C2: a conceptual ILO needs no practical task, a legitimate lecture assessment passes, and accessibility never changes the competence', () => {
  assert.match(PROMPT, /A conceptual ILO can use an appropriate written or oral explanation without an implementation task/);
  assert.match(PROMPT, /Accessibility may change the response format but must not change the competence measured/);
  assert.match(PROMPT, /A genuine practical ILO still needs evidence of the stated performance/);
});

// ---------------- special cases ----------------
test('Week 1 orientation is evaluated as orientation, examination rows are never asked, and a multiweek range keeps its label', async () => {
  const { content, masters } = lesson();
  content.plan[0].contents = 'Course orientation: objectives, requirements, grading and policies';
  content.plan[0].ilos[0].text = 'Describe the course objectives, requirements and grading system.';
  content.plan[0].activities = '- Setting and sharing of expectations; review of policies.'; content.plan[0].tasks = '- Statement of expectations';
  content.plan[3].week = '4-5';
  // (the lesson answers assess their fields, as the strict schema has them do)
  const sound = pair => (pair.type === 'Activity-fit' ? { label: 'ALIGNED', aspects: { teaching: 'sound', learnerSupport: 'adequate', responsible: 'none' } } : pair.type === 'Assessment-fit' ? { label: 'ALIGNED', aspects: { measures: 'yes', evidence: 'observable', level: 'matches', responsible: 'none' } } : ok);
  const { result, asked } = await exec(content, masters, sound);
  assert.ok(asked.includes('Activity-fit:row0-activityfit') && asked.includes('Assessment-fit:row0-assessfit'));
  assert.ok(!content.plan.some((row, i) => row.kind === 'exam' && asked.some(a => a.includes(`row${i}-activityfit`) || a.includes(`row${i}-assessfit`))));
  assert.ok(pairsOf(content, masters).length > 0);
  assert.equal(fit.activityPairs(content, [3])[0].source.split('\n')[0], 'Week 4-5 course content: Topic 4');
  assert.ok(!result.hybrid.verdict.findings.some(f => ['Activity-fit', 'Assessment-fit'].includes(f.legacyRuleId) && f.week === '1'), 'a legitimate orientation lesson raises nothing');
});
test('request volume: at most one question per lesson and kind, none for failed or off-course lessons, none on a re-check of the same revision', async () => {
  const { content, masters } = lesson();
  const first = await exec(structuredClone(content), masters, () => ok);
  assert.equal(count(first.asked, 'Activity-fit'), 15); assert.equal(count(first.asked, 'Assessment-fit'), 15); assert.ok(count(first.asked, 'Activity-fit') + count(first.asked, 'Assessment-fit') <= fit.MAX_LESSON_PAIRS * 2);
  assert.deepEqual(first.result.hybrid.stageC.c1, { asked: 15, reusedScored: 0, heldBackUpstream: 0, noText: 0 });
  const reuse = new Map(first.result.hybrid.alignment.judgements.filter(j => j.key && !j.unverified).map(j => [j.key, j]));
  const second = model(() => ok);
  await run(structuredClone(content), masters, { ...base, reuse, transport: second.transport });
  assert.deepEqual(second.asked.filter(a => /^(Activity-fit|Assessment-fit)/.test(a)), [], 'unchanged revision: nothing is asked');
});

// ---------------- flags, offline, provider failures ----------------
test('Stage C is off by default and independent: off keeps the alignment-10 prompt and pairs; C1 and C2 can be switched on alone', async () => {
  const { content, masters } = lesson();
  const off = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' };
  const { result, asked } = await exec(structuredClone(content), masters, () => ok, off);
  assert.ok(!asked.some(a => /^(Activity-fit|Assessment-fit)/.test(a))); assert.equal(result.hybrid.alignment.promptVersion, 'alignment-10');
  assert.equal(crypto.createHash('sha256').update(promptFor(PROMPT, 'current', stageFlags({}))).digest('hex'), '81d11a069d91ee47c7171bd941f05867d73e6423eebf1ea9d8fa6c06f49d7262');
  const only1 = await exec(structuredClone(content), masters, () => ok, { ...off, SYLLABUS_CHECK_STAGE_C1: 'on' });
  assert.ok(count(only1.asked, 'Activity-fit') > 0 && count(only1.asked, 'Assessment-fit') === 0); assert.equal(only1.result.hybrid.alignment.promptVersion, 'alignment-12c1-r8');
  const only2 = await exec(structuredClone(content), masters, () => ok, { ...off, SYLLABUS_CHECK_STAGE_C2: 'on' });
  assert.ok(count(only2.asked, 'Assessment-fit') > 0 && count(only2.asked, 'Activity-fit') === 0); assert.equal(only2.result.hybrid.alignment.promptVersion, 'alignment-12c2-r8');
  assert.ok(!/Activity-fit \(advisory\)/.test(promptFor(PROMPT, 'current', { c2: true }))); assert.ok(!/Assessment-fit \(advisory\)/.test(promptFor(PROMPT, 'current', { c1: true })));
  const all = await exec(structuredClone(content), masters, () => ok);
  assert.equal(all.result.score, result.score); assert.equal(all.result.passed, result.passed); assert.equal(all.result.conformance.ok, result.conformance.ok); assert.deepEqual(all.result.hybrid.deductions, result.hybrid.deductions);
});
test('without AI the Stage C rules are NOT_CHECKED, never a pass, and the verdict is never COMPLIANT', async () => {
  const { content, masters } = lesson();
  const result = await run(content, masters, { useAi: false, linkChecker: base.linkChecker, env: ALL });
  for (const id of ['ALN-05', 'ALN-06', 'ALN-07', 'ALN-08', 'ALN-09']) assert.equal(result.hybrid.verdict.findings.find(f => f.ruleId === id).status, 'NOT_CHECKED', id);
  assert.notEqual(result.hybrid.verdict.overall, 'COMPLIANT');
});
test('HTTP 402 stops the Stage C passes: one refusal, no further paid request, and the lessons are reported as not checked', async () => {
  const { content, masters } = lesson();
  let calls = 0;
  const transport = async () => { calls += 1; return { ok: false, status: 402, json: async () => ({}) }; };
  const first = await run(structuredClone(content), masters, { ...base, transport });
  assert.equal(first.hybrid.alignment.failure.kind, 'provider_access'); const used = calls;
  await run(structuredClone(content), masters, { ...base, transport });
  assert.equal(calls, used, 'nothing is sent during the cooldown');
  assert.equal(first.hybrid.stageC.c1, null);
});
test('a failed or invalid Stage C answer never becomes a verdict and never holds the check open', async () => {
  const { content, masters } = lesson();
  const { result } = await exec(content, masters, pair => (/activityfit|assessfit/.test(pair.id) ? { label: 'INSUFFICIENT_EVIDENCE' } : ok));
  assert.equal(result.hybrid.alignment.status, 'completed');
  assert.equal(result.hybrid.verdict.findings.find(f => f.legacyRuleId === 'Activity-fit' && f.path === 'plan[2].activities').status, 'NOT_CHECKED');
});

// ---------------- the synthetic dataset ----------------
test('the Stage C dataset is synthetic and unreviewed, covers the three programs and the required cases, and never accepts ALIGNED for a trap', () => {
  assert.match(stageC.status, /NOT faculty-reviewed/); assert.equal(stageC.reviewStatus, 'unreviewed'); assert.match(stageC.provenance, /SYNTHETIC/);
  assert.deepEqual([...new Set(Object.values(stageC.courses).map(c => c.program))].sort(), ['BSCPE', 'BSIE', 'BSIT']);
  for (const type of ['Activity-fit', 'Assessment-fit']) assert.ok(stageC.items.some(i => i.type === type), type);
  for (const category of ['clear-positive', 'off-subject', 'wrong-method', 'limited-support', 'alternative-formats', 'week-one-orientation', 'wrong-cognitive-level', 'bare-name', 'legitimate-conceptual', 'accessible-alternative', 'multiweek', 'practical-vs-conceptual', 'vague-evidence']) assert.ok(stageC.items.some(i => i.category === category), category);
  for (const item of stageC.items) { assert.equal(item.facultyVerdict, null); assert.equal(item.reviewStatus, 'unreviewed'); if (!['clear-positive', 'week-one-orientation', 'alternative-formats', 'legitimate-conceptual', 'accessible-alternative', 'multiweek', 'practical-vs-conceptual'].includes(item.category)) assert.ok(!item.accept.includes('ALIGNED'), item.id); }
  assert.ok(stageC.items.some(i => i.id === 'as-prog1-essay' && i.accept.length === 1 && i.accept[0] === 'NOT_ALIGNED'), 'the specified example is in the dataset');
});
test('a keyword-matching judge approves the Stage C traps and is caught; a judge that follows the labels is not', () => {
  const words = text => new Set(String(text).toLowerCase().match(/[a-z]{4,}/g) || []);
  const naive = new Map(stageC.items.map(i => { const s = words(i.source); return [i.id, [...words(i.target)].some(w => s.has(w)) ? 'ALIGNED' : 'NOT_ALIGNED']; }));
  assert.ok(scoreEval(stageC.items, [naive]).counts.falseNegative >= 2);
  const careful = scoreEval(stageC.items, [new Map(stageC.items.map(i => [i.id, i.accept[0]]))]); assert.equal(careful.counts.falseNegative, 0); assert.equal(careful.counts.falsePositive, 0);
});
