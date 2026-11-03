// Stage C3: the weekly chain - course content -> learning activities (Content-activity), course content -> assessment tasks (Content-assessment),
// learning activities -> assessment tasks (Activity-assessment). Advisory, behind SYLLABUS_CHECK_STAGE_C3, off by default. Offline: a scripted model
// answers every request, so these tests check how each of the six weekly relationships is asked, recorded and reported - not how well a real model
// judges them. The six: content <-> ILO (ILO-content), ILO <-> CLO (ILO-CLO), content <-> activities (C3), ILO <-> activities (ILO-activity),
// content <-> tasks (C3), activities <-> tasks (C3). The existing ILO <-> tasks check (ILO-assessment) is kept as it is.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { sample } = require('./fixtures');
const { run } = require('./engine');
const { PROMPT, resetProviderBlock, isAdvisory, isNoRewrite, promptVersionOf } = require('./gemini');
const { promptFor } = require('./variants');
const { stageFlags, stageLabel, trimToTypes, C3 } = require('./stages');
const fit = require('./lessonfit');
const { POLICY } = require('./policy');
const { tierOfType } = require('./acceptance');
const { buildVerdict } = require('./verdict');
const standard = require('../compliance/standard-v4.json');

const AI = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' };
const C3ON = { ...AI, SYLLABUS_CHECK_STAGE_C3: 'on' };
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
test.afterEach(() => resetProviderBlock());

// A scripted model: decide(pair) returns { label, explanation, draft, fields } or nothing (ALIGNED); quotes are copied from the pair's own texts.
// fail(batch) makes that request fail with HTTP 500, as a provider outage would.
function model(decide, { fail } = {}) {
  const asked = [], systems = [];
  const transport = async (url, req) => {
    const body = JSON.parse(req.body), batch = JSON.parse(body.contents[0].parts[0].text).document_data;
    if (fail && fail(batch)) return { ok: false, status: 500, json: async () => ({}) };
    systems.push(body.systemInstruction.parts[0].text); asked.push(...batch);
    const answer = pair => {
      const v = decide(pair) || { label: 'ALIGNED' };
      const draft = v.label === 'ALIGNED' ? '' : v.draft ?? (isNoRewrite(pair.type) ? '' : `${pair.target} (revised)`);
      return { id: pair.id, label: v.label, explanation: v.explanation || 'Judged.', sourceQuote: pair.source.slice(0, 14), targetQuote: pair.target.slice(0, 14), sourceBloom: 'N/A', targetBloom: 'N/A', draft, ...(v.fields || {}) };
    };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
  return { transport, asked, systems };
}
async function exec(content, masters, decide, env = C3ON, { fail, reuse } = {}) {
  const m = model(decide, { fail });
  const result = await run(content, masters, { useAi: true, env, transport: m.transport, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }), ...(reuse ? { reuse } : {}) });
  return { result, asked: m.asked, systems: m.systems };
}
// Week 3 (plan row 2) is the lesson under test.
const ILO = 'Develop and test Java programs that use if-else and switch statements to make decisions.';
const JAVA = { contents: 'Java conditional statements: if, if-else, nested if and switch', activities: '- Guided Java coding exercise on if-else and switch statements, then pair programming.', tasks: '- Programming task: write and test an if-else program that grades exam scores.' };
function lesson(fields = {}) {
  const { content, masters } = sample();
  Object.assign(content.plan[2], JAVA, fields);
  content.plan[2].ilos[0].text = ILO;
  return { content, masters };
}
const ID = { 'ILO-content': 'row2-ilo0-content', 'ILO-CLO': 'row2-ilo0-clo:c3', 'Content-activity': 'row2-contentactivity', 'ILO-activity': 'row2-ilo0-activity', 'Content-assessment': 'row2-contentassessment', 'Activity-assessment': 'row2-activityassessment', 'ILO-assessment': 'row2-ilo0-assessment' };
const RULE = { 'ILO-content': 'ALN-01', 'ILO-CLO': 'ALN-02', 'Content-activity': 'ALN-11', 'ILO-activity': 'ALN-05', 'Content-assessment': 'ALN-12', 'Activity-assessment': 'ALN-13', 'ILO-assessment': 'ALN-07' };
const SIX = ['ILO-content', 'ILO-CLO', 'Content-activity', 'ILO-activity', 'Content-assessment', 'Activity-assessment'];
const SCORED = new Set(['ILO-CLO', 'ILO-activity', 'ILO-assessment']);
const LESSONS = 15; // the fixture plan: 18 weeks, three of them examinations
const judged = (result, id) => result.hybrid.alignment.judgements.find(j => j.id === id);
const allFindings = (result, content) => buildVerdict(result, content, { all: true }).all;
const findingsOf = (all, id) => all.filter(f => f.relationshipId === id);
const shown = (result, id) => result.hybrid.verdict.findings.find(f => f.relationshipId === id);
const alignmentDeductions = result => result.hybrid.deductions.filter(d => d.kind === 'alignment').map(d => [d.id, d.points]);
const isChain = type => C3.types.includes(type);

// ---------------- the switch and the prompt ----------------
test('C3 stays off by default; the all-off prompt is unchanged and the revised Stage A prompt is separately versioned', () => {
  assert.deepEqual(stageFlags({}), { a: false, b: false, b3: false, b4: false, c1: false, c2: false, d1: false, d2: false });
  assert.equal('c3' in stageFlags({ SYLLABUS_CHECK_STAGE_C3: 'off' }), false);
  assert.equal(stageFlags({ SYLLABUS_CHECK_STAGE_C3: 'ON' }).c3, true);
  const off = promptFor(PROMPT, 'current', stageFlags({}));
  const earlier = { a: true, b: true, b3: true, b4: true, c1: true, c2: true, d1: true, d2: true };
  assert.equal(sha(off), '81d11a069d91ee47c7171bd941f05867d73e6423eebf1ea9d8fa6c06f49d7262', 'alignment-10');
  assert.equal(sha(promptFor(PROMPT, 'current', earlier)), 'c54e5ec9ea5761ba20c915bfab81202f9380663a1676155003b682635321965d', 'all earlier stages on with the Stage A scope update');
  assert.equal(sha(promptFor(PROMPT, 'current', { c1: true, c2: true })), '25b329069909868e9fd62299b30d1898349c21edc733cbda3d603f4d32a0d573', 'C1 + C2 (hash taken before C3 was added)');
  for (const [flags, label] of [[{}, '10'], [{ c1: true, c2: true }, '12c1c2-r8'], [{ d1: true }, '12d1-r7'], [{ a: true, b3: true }, '12a3-r7-a8'], [earlier, '12ab34c1c2d1d2-r8-a8'], [{ c3: true }, '12c3-r8'], [{ ...earlier, c3: true }, '12ab34c1c2c3d1d2-r8-a8']]) assert.equal(stageLabel(flags), label);
  assert.equal(promptVersionOf('gemini-3.8-flash', AI), 'alignment-10');
  assert.equal(promptVersionOf('gemini-3.8-flash', C3ON), 'alignment-12c3-r8', 'a new label: no answer made under other wording is reused');
  const on = promptFor(PROMPT, 'current', { c3: true });
  for (const segment of [C3.directions, C3.tests]) { assert.ok(on.includes(segment)); assert.ok(!off.includes(segment)); assert.ok(!promptFor(PROMPT, 'current', earlier).includes(segment)); }
  for (const type of C3.types) assert.ok(!off.includes(type), type);
  assert.ok(!trimToTypes(on, new Set(['ILO-CLO'])).includes('Content-activity'), 'a trimmed request without C3 pairs carries none of its wording');
  const trimmed = trimToTypes(on, new Set(['Activity-assessment']));
  assert.ok(trimmed.includes('- Activity-assessment (advice only)') && trimmed.includes('(all three)') && !trimmed.includes('- Content-activity (advice only)'));
});
test('the C3 wording judges each link on its own two texts, keeps the ILO out of it, and allows only a one-sentence recommendation that invents nothing', () => {
  assert.match(C3.tests, /never raise or lower these labels because of an ILO/);
  assert.match(C3.tests, /never ask here for the tasks to assess an ILO/);
  assert.match(C3.tests, /ONE sentence/); assert.match(C3.tests, /never rewrites the text/);
  assert.match(C3.tests, /never adds a topic, resource, tool, participant, product or requirement that neither text states/);
  assert.match(C3.tests, /"Week 4-5"\) is one lesson/); assert.match(C3.tests, /Week 1 course orientation/);
  assert.match(C3.directions, /no targetPath: they are advice only/);
});

// ---------------- the pairs ----------------
test('C3 builds three links per instructional lesson from that lesson\'s own texts: no ILO text, no rewrite target, no examination week, no new ILO -> task link', () => {
  const { content } = lesson();
  assert.deepEqual(fit.chainRows(content).map(r => r.i), [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16], 'examination rows are left out');
  const pairs = fit.chainPairs(content, [2]);
  assert.deepEqual(pairs.map(p => [p.id, p.type, p.path, p.targetPath]), [[ID['Content-activity'], 'Content-activity', 'plan[2].activities', null], [ID['Content-assessment'], 'Content-assessment', 'plan[2].tasks', null], [ID['Activity-assessment'], 'Activity-assessment', 'plan[2].tasks', null]]);
  assert.equal(pairs[0].source, `Week 3 course content: ${JAVA.contents}`); assert.equal(pairs[0].target, JAVA.activities);
  assert.equal(pairs[1].source, pairs[0].source); assert.equal(pairs[1].target, JAVA.tasks);
  assert.equal(pairs[2].source, `Week 3 learning activities: ${JAVA.activities}`); assert.equal(pairs[2].target, JAVA.tasks);
  for (const p of pairs) assert.ok(!`${p.source}\n${p.target}`.includes(ILO), 'the ILO is judged in other relationships, never in these');
  content.plan[3].week = '4-5';
  assert.match(fit.chainPairs(content, [3])[0].source, /^Week 4-5 course content: /);
  content.plan[2].contents = '   ';
  const blank = fit.chainPairs(content, [2]);
  assert.deepEqual(blank.map(p => p.source === ''), [true, true, false], 'a missing content stays empty, so it is recognised as missing');
  Object.assign(content.plan[4], { contents: '', activities: '', tasks: '' });
  assert.ok(!fit.chainRows(content).some(r => r.i === 4), 'a lesson with none of the three texts has no chain to judge');
  for (const type of C3.types) { assert.equal(isAdvisory(type), true, type); assert.equal(isNoRewrite(type), true, type); assert.equal(tierOfType(type), 'optional', type); assert.ok(!/ILO/.test(type)); }
});

// ---------------- the six relationships, one at a time ----------------
for (const type of SIX) {
  test(`only ${type} fails: it is reported on its own (${RULE[type]}), the other five pass, and only a scored relationship costs points`, async () => {
    const { content, masters } = lesson();
    const { result } = await exec(content, masters, pair => (pair.id === ID[type] ? { label: 'NOT_ALIGNED', explanation: `${type}: the two texts do not match.`, draft: isNoRewrite(pair.type) ? 'Change the target so that it follows the source.' : undefined } : null));
    const all = allFindings(result, content);
    assert.equal(judged(result, ID[type]).label, 'NOT_ALIGNED');
    assert.ok(findingsOf(all, ID[type]).some(f => f.ruleId === RULE[type] && f.status === 'FAIL'), `${type} is a FAIL under ${RULE[type]}`);
    for (const other of SIX.filter(t => t !== type)) {
      assert.equal(judged(result, ID[other]).label, 'ALIGNED', other);
      assert.ok(findingsOf(all, ID[other]).length && findingsOf(all, ID[other]).every(f => f.status === 'PASS'), other);
    }
    assert.deepEqual(alignmentDeductions(result), SCORED.has(type) ? [['SEM:' + ID[type], POLICY.alignment]] : []);
    assert.ok(result.findings.some(f => f.id === 'SEM:' + ID[type] && f.severity === (SCORED.has(type) ? 'major' : 'minor')));
  });
}
test('the existing ILO -> assessment check is kept as it is: still scored, still one per ILO, and C3 adds no second ILO -> task relationship', async () => {
  const decide = pair => (pair.id === ID['ILO-assessment'] ? { label: 'NOT_ALIGNED' } : null);
  const on = await exec(lesson().content, lesson().masters, decide);
  const off = await exec(lesson().content, lesson().masters, decide, AI);
  for (const r of [on, off]) assert.deepEqual(alignmentDeductions(r.result), [['SEM:' + ID['ILO-assessment'], POLICY.alignment]]);
  const iloToTask = asked => asked.filter(p => p.target === JAVA.tasks && p.source.includes(ILO)).map(p => p.type);
  assert.deepEqual(iloToTask(on.asked), ['ILO-assessment']); assert.deepEqual(iloToTask(off.asked), ['ILO-assessment']);
  assert.equal(judged(on.result, ID['Content-assessment']).label, 'ALIGNED'); assert.equal(judged(on.result, ID['Activity-assessment']).label, 'ALIGNED');
  assert.equal(shown(on.result, ID['ILO-assessment']).ruleId, 'ALN-07');
});
test('all six fail at once: every one is reported, the C3 links are asked although the scored links failed, and the official result is the one C3-off gives', async () => {
  const failing = new Set(SIX.map(t => ID[t]));
  const decide = pair => (failing.has(pair.id) ? { label: 'NOT_ALIGNED', draft: isNoRewrite(pair.type) ? 'One sentence of advice.' : undefined } : null);
  const { content, masters } = lesson();
  const on = await exec(structuredClone(content), masters, decide);
  const off = await exec(structuredClone(content), masters, decide, AI);
  const all = allFindings(on.result, content);
  for (const type of SIX) assert.ok(findingsOf(all, ID[type]).some(f => f.ruleId === RULE[type] && f.status === 'FAIL'), type);
  assert.deepEqual(on.result.hybrid.deductions, off.result.hybrid.deductions);
  assert.equal(on.result.hybrid.provisionalScore, off.result.hybrid.provisionalScore); assert.equal(on.result.score, off.result.score); assert.equal(on.result.passed, off.result.passed);
  assert.deepEqual(on.result.conformance, off.result.conformance);
  assert.deepEqual(on.result.hybrid.suggestions, off.result.hybrid.suggestions, 'C3 offers no rewrite: the drafts to accept are the ones the other checks give');
  assert.equal(on.result.hybrid.stageC.c3.relationships, 3 * LESSONS);
});

// ---------------- the scenarios ----------------
test('complete but academically unrelated: every column is filled and the activities and tasks agree with each other, yet both content links fail', async () => {
  const { content, masters } = lesson({ activities: '- Group discussion on the causes of the Philippine Revolution.', tasks: '- Essay on the heroes of the Philippine Revolution.' });
  const topic = text => (/java|if-else|switch|conditional/i.test(text) ? 'java' : /revolution|heroes/i.test(text) ? 'history' : 'other');
  const judgedTypes = new Set(['ILO-content', 'ILO-activity', 'ILO-assessment', ...C3.types]);
  const decide = pair => (/^row2-/.test(pair.id) && judgedTypes.has(pair.type) && topic(pair.source) !== topic(pair.target) ? { label: 'NOT_ALIGNED', explanation: 'The two texts are about different subjects.', draft: isNoRewrite(pair.type) ? 'Make the target work on the topic the source names.' : undefined } : null);
  const { result } = await exec(content, masters, decide);
  assert.ok(!result.findings.some(f => ['T-15', 'T-16', 'A-01'].includes(f.ruleId) && /^plan\[2\]/.test(String(f.path))), 'nothing is missing: the completeness rules pass this lesson');
  const all = allFindings(result, content), status = id => findingsOf(all, id).map(f => f.status);
  assert.deepEqual(status(ID['Activity-assessment']), ['PASS'], 'the activities and the tasks agree with each other ...');
  assert.deepEqual(status(ID['Content-activity']), ['FAIL'], '... which hides neither the content -> activities failure');
  assert.deepEqual(status(ID['Content-assessment']), ['FAIL'], '... nor the content -> tasks failure');
  assert.equal(judged(result, ID['ILO-activity']).label, 'NOT_ALIGNED'); assert.equal(judged(result, ID['ILO-assessment']).label, 'NOT_ALIGNED');
  const f = shown(result, ID['Content-activity']);
  assert.equal(f.recommendationType, 'REVIEW_REQUIRED'); assert.equal(f.recommendation, 'Make the target work on the topic the source names.'); assert.equal(f.responsible, 'activity'); assert.equal(f.severity, 'MINOR');
  assert.equal(shown(result, ID['Content-assessment']).responsible, 'assessment');
  assert.ok(!result.hybrid.suggestions.some(s => (s.basedOn || []).some(b => /contentactivity|contentassessment|activityassessment/.test(b))), 'no rewrite is built from a C3 answer');
});
test('multiple ILOs: the ILO links are judged per ILO and the C3 links once per lesson; one ILO that fails is hidden neither by the other ILO nor by the lesson-level pass', async () => {
  const { content, masters } = lesson();
  content.plan[2].ilos.push({ id: 'i3b', text: 'Explain the history of programming languages from FORTRAN to Java.', tags: ['clo:c3'] });
  const { result, asked } = await exec(content, masters, pair => (pair.id === 'row2-ilo1-activity' ? { label: 'NOT_ALIGNED', explanation: 'The activities practise coding, not the history of programming languages.' } : null));
  assert.equal(asked.filter(p => p.id === ID['Content-activity']).length, 1, 'one content -> activities link for the lesson, not one per ILO');
  assert.deepEqual(['row2-ilo0-activity', 'row2-ilo1-activity'].map(id => judged(result, id).label), ['ALIGNED', 'NOT_ALIGNED']);
  assert.deepEqual(['row2-ilo0-content', 'row2-ilo1-content'].map(id => judged(result, id).label), ['ALIGNED', 'ALIGNED']);
  assert.equal(judged(result, ID['Content-activity']).label, 'ALIGNED');
  assert.deepEqual(alignmentDeductions(result), [['SEM:row2-ilo1-activity', POLICY.alignment]]);
  assert.equal(shown(result, 'row2-ilo1-activity').status, 'FAIL');
  for (const p of asked.filter(p => isChain(p.type))) assert.ok(!p.source.includes('FORTRAN') && !p.target.includes('FORTRAN'));
});
test('grouped weeks: "Week 4-5" is one lesson with one set of links; an explanation citing a week outside it is flagged for review, and the label is left as answered', async () => {
  const { content, masters } = lesson();
  content.plan[3].week = '4-5'; content.plan.splice(4, 1); // weeks 4 and 5 taught as one lesson
  const decide = pair => (pair.id === 'row3-contentactivity' ? { label: 'PARTIALLY_ALIGNED', explanation: 'Only part of the topic is practised in Week 5; the rest waits until Week 9.', draft: 'Add practice on the remaining part of the topic.' } : pair.id === 'row3-contentassessment' ? { label: 'PARTIALLY_ALIGNED', explanation: 'The quiz in Week 4 covers only part of the topic.', draft: 'Say which part of the topic the quiz covers.' } : null);
  const { result, asked } = await exec(content, masters, decide);
  const chain = asked.filter(p => /^row3-/.test(p.id) && isChain(p.type));
  assert.equal(chain.length, 3);
  for (const p of chain.filter(p => p.type !== 'Activity-assessment')) assert.match(p.source, /^Week 4-5 course content: /);
  assert.equal(result.hybrid.stageC.c3.relationships, 3 * (LESSONS - 1));
  const ca = judged(result, 'row3-contentactivity'), cs = judged(result, 'row3-contentassessment');
  assert.equal(ca.label, 'PARTIALLY_ALIGNED'); assert.deepEqual(ca.explanationReview, ['cites_other_week'], 'Week 9 is outside the lesson');
  assert.equal(cs.explanationReview, undefined, 'Week 4 is inside it');
  const f = shown(result, 'row3-contentactivity');
  assert.equal(f.week, '4-5'); assert.equal(f.status, 'NEEDS_REVIEW'); assert.deepEqual(f.explanationReview, ['cites_other_week']);
});
test('missing course content: the two content links are reported as not checkable (never sent, never passed, nothing invented) and the activities -> tasks link is still judged, even while fixed rules fail', async () => {
  const { content, masters } = lesson({ contents: '' });
  content.grading.rows[0].pct = 67; // grading total 107%: a blocking fixed rule, so the main check leaves out its empty relationships
  const { result, asked } = await exec(content, masters, pair => (pair.id === ID['Activity-assessment'] ? { label: 'PARTIALLY_ALIGNED', explanation: 'The task asks for a grading program; the activities practise if-else but not grading.', draft: 'Say how the task follows the guided exercise.' } : null));
  assert.equal(result.conformance.ok, false);
  assert.ok(!asked.some(p => [ID['Content-activity'], ID['Content-assessment']].includes(p.id)), 'nothing is sent for a link with no content');
  for (const id of [ID['Content-activity'], ID['Content-assessment']]) {
    const j = judged(result, id);
    assert.equal(j.label, 'INSUFFICIENT_EVIDENCE'); assert.equal(j.failureKind, 'insufficient_text'); assert.equal(j.missing, 'source'); assert.equal(j.draft, '');
    assert.equal(shown(result, id).status, 'NOT_CHECKED');
  }
  assert.equal(judged(result, ID['Activity-assessment']).label, 'PARTIALLY_ALIGNED');
  assert.equal(shown(result, ID['Activity-assessment']).status, 'NEEDS_REVIEW');
  assert.equal(result.hybrid.stageC.c3.noText, 2);
  assert.equal(judged(result, ID['ILO-content']), undefined, 'the main check leaves its empty relationship to the fixed rules, as before');
  assert.ok(result.findings.some(f => f.ruleId === 'T-16' && /^plan\[2\]/.test(String(f.path))), 'the fixed rule reports the empty column');
  assert.ok(!result.hybrid.suggestions.some(s => s.path === 'plan[2].contents'), 'no course content is written for the author');
  assert.notEqual(result.hybrid.verdict.overall, 'COMPLIANT');
});
test('ambiguous mappings: an ILO with two CLO tags needs only one, an untagged ILO is never given a tag, and an unclear chain link is "needs review" with a recommendation, never a rewrite', async () => {
  const { content, masters } = lesson({ activities: '- Practice exercises.' });
  content.plan[2].ilos[0].tags = ['clo:c3', 'clo:c1'];
  content.plan[3].ilos[0].tags = [];
  const advice = 'Say which of the listed conditional statements the exercises practise.';
  const decide = pair => (pair.id === 'row2-ilo0-clo:c1' ? { label: 'NOT_ALIGNED' } : pair.id === ID['Content-activity'] ? { label: 'PARTIALLY_ALIGNED', explanation: 'The activities name practice exercises but not which conditional statements they practise.', draft: advice } : null);
  for (const env of [C3ON, { ...C3ON, SYLLABUS_CHECK_STAGE_B3: 'on' }]) {
    const { result, asked } = await exec(structuredClone(content), masters, decide, env);
    assert.ok(result.findings.some(f => f.id === 'TAG:row2-ilo0-clo:c1' && f.severity === 'minor'), 'the other tag is advice only');
    assert.ok(!result.hybrid.deductions.some(d => d.id === 'SEM:row2-ilo0-clo:c1'));
    assert.ok(!asked.some(p => /^row3-ilo0-(clo|anyclo)/.test(p.id)), 'an untagged ILO is not matched to a CLO by the AI');
    assert.ok(!result.hybrid.suggestions.some(s => /\.tags$/.test(s.path)) && !(result.hybrid.mappingAdvice || []).some(a => a.path === 'plan[3].ilos[0].tags'), 'no tag is invented');
    assert.ok(result.findings.some(f => ['T-13', 'ILO-MAP'].includes(f.ruleId) && /^plan\[3\]/.test(String(f.path))), 'the fixed rule reports the missing tag');
    assert.equal(judged(result, 'row3-contentactivity').label, 'ALIGNED', 'the lesson chain is judged whatever its tags');
    const f = shown(result, ID['Content-activity']);
    assert.equal(f.ruleId, 'ALN-11'); assert.equal(f.status, 'NEEDS_REVIEW'); assert.equal(f.recommendationType, 'REVIEW_REQUIRED'); assert.equal(f.recommendation, advice);
    assert.ok(!result.hybrid.suggestions.some(s => (s.basedOn || []).includes('SEM:' + ID['Content-activity'])));
  }
});

// ---------------- the provider ----------------
test('AI provider unavailable: nothing is asked or passed - C3 is reported not checked, and the official result is the one C3-off gives', async () => {
  const down = () => true;
  const on = await exec(lesson().content, lesson().masters, () => null, C3ON, { fail: down });
  const off = await exec(lesson().content, lesson().masters, () => null, AI, { fail: down });
  assert.equal(on.result.hybrid.alignment.status, 'not_evaluated');
  assert.deepEqual(on.result.hybrid.stageC.c3, { relationships: 3 * LESSONS, verified: 0, noText: 0, notChecked: 0, skipped: 'ai_unavailable' });
  for (const rule of ['ALN-11', 'ALN-12', 'ALN-13']) { const f = on.result.hybrid.verdict.findings.filter(x => x.ruleId === rule); assert.ok(f.length && f.every(x => x.status === 'NOT_CHECKED'), rule); }
  assert.notEqual(on.result.hybrid.verdict.overall, 'COMPLIANT');
  assert.deepEqual(on.result.hybrid.deductions, off.result.hybrid.deductions); assert.equal(on.result.score, off.result.score); assert.equal(on.result.passed, off.result.passed);
  assert.equal(on.result.conformance.ok, off.result.conformance.ok); assert.deepEqual(on.result.conformance.failed.map(f => f.ruleId), off.result.conformance.failed.map(f => f.ruleId));
});
test('AI provider unavailable for the C3 requests only: every link is listed as not checked (none dropped, none passed) and the completed official check is untouched', async () => {
  const c3Batch = batch => batch.some(p => isChain(p.type));
  const on = await exec(lesson().content, lesson().masters, () => null, C3ON, { fail: c3Batch });
  const off = await exec(lesson().content, lesson().masters, () => null, AI);
  assert.equal(on.result.hybrid.alignment.status, 'completed');
  const chain = on.result.hybrid.alignment.judgements.filter(j => isChain(j.type));
  assert.equal(chain.length, 3 * LESSONS);
  assert.ok(chain.every(j => j.unverified && j.label === 'INSUFFICIENT_EVIDENCE' && String(j.failureKind).startsWith('provider_')));
  assert.equal(on.result.hybrid.stageC.c3.notChecked, 3 * LESSONS); assert.equal(on.result.hybrid.stageC.c3.verified, 0);
  assert.ok(!on.result.findings.some(f => /contentactivity|contentassessment|activityassessment/.test(f.id)), 'a provider failure is not a problem in the syllabus');
  const v = on.result.hybrid.verdict;
  for (const rule of ['ALN-11', 'ALN-12', 'ALN-13']) { const f = v.findings.filter(x => x.ruleId === rule); assert.equal(f.length, LESSONS, rule); assert.ok(f.every(x => x.status === 'NOT_CHECKED'), rule); }
  assert.notEqual(v.overall, 'COMPLIANT'); assert.ok(v.unverified.some(u => u.ruleId === 'ALN-13'));
  assert.deepEqual(on.result.hybrid.deductions, off.result.hybrid.deductions); assert.equal(on.result.hybrid.provisionalScore, off.result.hybrid.provisionalScore); assert.equal(on.result.passed, off.result.passed);
});
test('no provider configured: with C3 on its three rules are NOT_CHECKED; with C3 off they do not appear at all', async () => {
  const opts = env => ({ useAi: false, env, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) });
  const on = await run(lesson().content, lesson().masters, opts({ SYLLABUS_CHECK_STAGE_C3: 'on' }));
  const off = await run(lesson().content, lesson().masters, opts({}));
  assert.equal(on.hybrid.stageC.c3.skipped, 'ai_unavailable');
  for (const rule of ['ALN-11', 'ALN-12', 'ALN-13']) {
    assert.deepEqual(on.hybrid.verdict.findings.filter(f => f.ruleId === rule).map(f => f.status), ['NOT_CHECKED'], rule);
    assert.ok(!off.hybrid.verdict.findings.some(f => f.ruleId === rule), rule);
  }
  assert.deepEqual(off.hybrid.stageC, { c1: null, c2: null });
});

// ---------------- precedence, reuse and the official result ----------------
test('precedence: a C3 recommendation waits only for the text its link is judged against - off-course content first, then the activities', async () => {
  // Stage B finds the week's content off the course: the C3 advice of that lesson waits, and the content is named as the field to fix.
  let { content, masters } = lesson();
  let { result } = await exec(content, masters, pair => (pair.id === 'row2-content' ? { label: 'NOT_ALIGNED', draft: 'Java conditional statements' } : /^row2-/.test(pair.id) && isChain(pair.type) ? { label: 'NOT_ALIGNED', draft: 'Advice.' } : null), { ...C3ON, SYLLABUS_CHECK_STAGE_B: 'on' });
  for (const type of C3.types) { const f = shown(result, ID[type]); assert.equal(f.status, 'FAIL', type); assert.equal(f.withheld, 'upstream_invalid', type); assert.equal(f.responsible, 'course_content', type); assert.equal(f.recommendation, null, type); }
  // The activities miss the ILO (scored ILO-activity): the task advice built on those activities waits; the content -> task advice does not.
  ({ content, masters } = lesson());
  ({ result } = await exec(content, masters, pair => (pair.id === ID['ILO-activity'] ? { label: 'NOT_ALIGNED' } : [ID['Activity-assessment'], ID['Content-assessment']].includes(pair.id) ? { label: 'PARTIALLY_ALIGNED', draft: 'Advice.' } : null)));
  assert.equal(shown(result, ID['Activity-assessment']).withheld, 'activity_invalid'); assert.equal(shown(result, ID['Activity-assessment']).recommendation, null);
  assert.equal(shown(result, ID['Content-assessment']).withheld, null); assert.equal(shown(result, ID['Content-assessment']).recommendation, 'Advice.');
  // An off ILO does not hold back a C3 recommendation: these links do not involve the ILO.
  assert.equal(fit.draftWithheld('Content-activity', ID['Content-activity'], content, [{ id: 'row2-ilo0-contentilo', label: 'NOT_ALIGNED' }], { b: true, c3: true }), null);
});
test('precedence: activities that miss the content hold back the C2 rewrite of the task built on them (the task follows the activities); without C3 it is offered', async () => {
  const fields = { measures: 'partly', evidence: 'observable', level: 'matches', responsible: 'assessment', teaching: 'not_assessed', learnerSupport: 'not_assessed' };
  const taskDraft = '- Programming task: write and test an if-else program that grades exam scores, and explain which branch runs for each score.';
  const decide = pair => (pair.id === 'row2-assessfit' ? { label: 'PARTIALLY_ALIGNED', explanation: 'The task does not ask students to explain the branches.', draft: taskDraft, fields } : pair.id === ID['Content-activity'] ? { label: 'NOT_ALIGNED', explanation: 'The activities do not practise the listed statements.', draft: 'Practise the listed statements.' } : null);
  const BC2 = { ...AI, SYLLABUS_CHECK_STAGE_B: 'on', SYLLABUS_CHECK_STAGE_C2: 'on' };
  const without = await exec(lesson().content, lesson().masters, decide, BC2);
  const withC3 = await exec(lesson().content, lesson().masters, decide, { ...BC2, SYLLABUS_CHECK_STAGE_C3: 'on' });
  assert.equal(without.result.hybrid.suggestions.find(s => s.path === 'plan[2].tasks')?.text, taskDraft, 'without C3 the task rewrite is offered');
  assert.ok(!withC3.result.hybrid.suggestions.some(s => s.path === 'plan[2].tasks'), 'with C3 it waits for the activities');
  assert.equal(shown(withC3.result, 'row2-assessfit').withheld, 'activity_invalid');
  assert.deepEqual(withC3.result.hybrid.deductions, without.result.hybrid.deductions);
});
test('reuse: an unchanged lesson is not asked again on the next check, and its C3 answers stand', async () => {
  const decide = pair => (pair.id === ID['Content-activity'] ? { label: 'PARTIALLY_ALIGNED', draft: 'Advice.' } : null);
  const first = await exec(lesson().content, lesson().masters, decide);
  const reuse = new Map(first.result.hybrid.alignment.judgements.filter(j => j.key && !j.unverified).map(j => [j.key, j]));
  const second = await exec(lesson().content, lesson().masters, () => null, C3ON, { reuse });
  assert.equal(second.asked.filter(p => isChain(p.type)).length, 0);
  assert.equal(second.result.hybrid.stageC.c3.reused, 3 * LESSONS); assert.equal(second.result.hybrid.stageC.c3.requests, 0);
  assert.equal(judged(second.result, ID['Content-activity']).label, 'PARTIALLY_ALIGNED');
  const changed = lesson({ activities: '- Guided Java coding exercise on switch statements only.' });
  const third = await exec(changed.content, changed.masters, () => null, C3ON, { reuse });
  assert.deepEqual(third.asked.filter(p => isChain(p.type)).map(p => p.id).sort(), [ID['Activity-assessment'], ID['Content-activity']].sort(), 'only the links whose text changed are asked');
});
test('the official result is preserved: 47 rules, pass mark 79, POLICY and the six scored types unchanged; C3 is in the report policy only when it ran', async () => {
  assert.equal(standard.rules.length, 47); assert.equal(standard.passThreshold, 79);
  assert.deepEqual({ ...POLICY, advisoryTypes: undefined }, { version: 'syllabus-policy-2', link: 2, alignment: 3, partialAlignment: 1, value: 1, minWeek: 1, maxWeek: 18, maxRewriteAttempts: 2, advisoryTypes: undefined });
  for (const type of C3.types) assert.ok(!POLICY.advisoryTypes.includes(type), type);
  for (const scored of ['CLO-PO', 'CLO-EGA', 'ILO-CLO', 'ILO-activity', 'ILO-assessment', 'Module-value']) { assert.equal(isAdvisory(scored), false, scored); assert.equal(tierOfType(scored), 'material', scored); }
  const on = await exec(lesson().content, lesson().masters, () => null);
  const off = await exec(lesson().content, lesson().masters, () => null, AI);
  assert.ok(C3.types.every(type => on.result.hybrid.policy.advisoryTypes.includes(type)));
  assert.deepEqual(off.result.hybrid.policy, { ...POLICY });
  assert.deepEqual(off.result.hybrid.stageC, { c1: null, c2: null }); assert.equal('c3' in off.result.hybrid.stages, false);
  assert.ok(!off.asked.some(p => isChain(p.type)));
  assert.ok(!off.systems.some(text => text.includes(C3.tests)) && on.systems.some(text => text.includes(C3.tests)));
  assert.ok(!off.result.hybrid.verdict.findings.some(f => /^ALN-1[123]$/.test(f.ruleId)));
  assert.equal(on.result.hybrid.stageC.c3.verified, 3 * LESSONS);
  assert.deepEqual(on.result.hybrid.deductions, off.result.hybrid.deductions); assert.equal(on.result.hybrid.provisionalScore, off.result.hybrid.provisionalScore);
});
