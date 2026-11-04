'use strict';
// Stage C3, offline: each link of the weekly chain - course content -> learning activities (ALN-11), course content -> assessment tasks (ALN-12), learning
// activities -> assessment tasks (ALN-13) - gets its own verified judgement, explanation, evidence and verdict, whatever the other two say. A passing
// activities -> tasks link never hides a failing content link; an answer whose quotes are not in the link's own two texts is never a verdict (NOT_CHECKED);
// and the one-sentence recommendation is reviewed against those two texts (answerReview.js reviewDraft, recommendationReview.js chainDraftNotes). Every
// lesson of the C3 evaluation dataset is run through the engine, answered by a scripted model with the dataset's expected labels; nothing is sent.
const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { run } = require('./engine');
const { resetProviderBlock } = require('./gemini');
const { buildVerdict } = require('./verdict');
const { reviewDraft, reviewExplanation } = require('./answerReview');
const dataset = require('./eval/stage-c3-dataset.json');

const C3ON = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only', SYLLABUS_CHECK_STAGE_C3: 'on' };
const linkChecker = async url => ({ url, status: 'ok', httpStatus: 200 });
// The three links of the lesson under test (plan row 2 of the fixture), their verdict rules and their suffixes in the dataset.
const LINK = {
  'Content-activity': { id: 'row2-contentactivity', rule: 'ALN-11', suffix: 'ca', source: 'contents', target: 'activities' },
  'Content-assessment': { id: 'row2-contentassessment', rule: 'ALN-12', suffix: 'ct', source: 'contents', target: 'tasks' },
  'Activity-assessment': { id: 'row2-activityassessment', rule: 'ALN-13', suffix: 'at', source: 'activities', target: 'tasks' },
};
const TYPES = Object.keys(LINK), TYPE_OF = Object.fromEntries(TYPES.map(type => [LINK[type].id, type]));
const STATUS = { ALIGNED: 'PASS', PARTIALLY_ALIGNED: 'NEEDS_REVIEW', NOT_ALIGNED: 'FAIL' };
const FAILING = ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'];
const ILO = 'Explain topic number 3 clearly'; // the fixture's ILO of row 2: part of other relationships, never of these links
test.afterEach(() => resetProviderBlock());

// A scripted model (the Gemini wire format). answer(pair, attempt) returns what differs from a verified ALIGNED answer quoting the pair's own two texts,
// or null to leave the pair out of the reply; `attempt` counts the times that pair was asked, from 1.
function model(answer = () => ({})) {
  const times = new Map();
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    const judgements = batch.flatMap(pair => {
      const attempt = (times.get(pair.id) || 0) + 1;
      times.set(pair.id, attempt);
      const v = answer(pair, attempt);
      return v === null ? [] : [{ id: pair.id, label: 'ALIGNED', explanation: 'Judged on the two texts.', sourceQuote: pair.source.slice(0, 16), targetQuote: pair.target.slice(0, 16), sourceBloom: 'N/A', targetBloom: 'N/A', draft: '', ...v }];
    });
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements }) }] } }] }) };
  };
  return { transport, times };
}
// One check of the fixture with row 2 replaced by a lesson's three texts.
async function check(texts, answer) {
  const { content, masters } = sample();
  Object.assign(content.plan[2], { contents: texts.contents, activities: texts.activities, tasks: texts.tasks });
  const m = model(answer);
  const result = await run(content, masters, { useAi: true, env: C3ON, transport: m.transport, linkChecker });
  const all = buildVerdict(result, content, { all: true }).all;
  return { result, content, times: m.times, judged: type => result.hybrid.alignment.judgements.find(j => j.id === LINK[type].id), findings: type => all.filter(f => f.relationshipId === LINK[type].id),
    open: result.hybrid.verdict.findings.filter(f => TYPE_OF[f.relationshipId]).map(f => [f.ruleId, f.status]).sort() };
}
const fieldOf = text => String(text).replace(/^Week [^:]*:\s*/, '');
const explanationOf = (lesson, type) => `${type} in ${lesson}: judged on these two texts alone.`;
const draftOf = type => (type === 'Content-activity' ? 'Revise the activities so that students work on the topics this course content names.' : type === 'Content-assessment' ? 'Revise the tasks so that they assess the topics this course content names.' : 'Revise the tasks so that they assess the work the activities practise.');
// The dataset's expected label of a link (its first accepted label), or ALIGNED for a link the dataset leaves unlabelled.
const labelOf = (lesson, type) => dataset.items.find(item => item.id === `c3-${lesson}-${LINK[type].suffix}`)?.accept[0] || 'ALIGNED';
// Answers every link of row 2 with `labels`, its own explanation and quotes from its own two fields, and a one-sentence recommendation when it fails.
const answering = (lesson, labels) => pair => {
  const type = TYPE_OF[pair.id];
  if (!type) return {};
  const label = labels[type];
  return { label, explanation: explanationOf(lesson, type), sourceQuote: fieldOf(pair.source).slice(0, 24), targetQuote: pair.target.slice(0, 24), draft: FAILING.includes(label) ? draftOf(type) : '' };
};
const labelsOf = lesson => Object.fromEntries(TYPES.map(type => [type, labelOf(lesson, type)]));
// A scored relationship's deduction is recorded as `SEM:<relationship id>` (engine.js); the chain's links must never have one.
const C3_DEDUCTIONS = new Set(Object.values(LINK).map(l => `SEM:${l.id}`));
const noC3Deduction = result => !result.hybrid.deductions.some(d => C3_DEDUCTIONS.has(d.id));

test('every lesson of the C3 dataset: each link has its own verified judgement, explanation, evidence and verdict, as answered', async () => {
  let lessons = 0, failing = 0;
  for (const [name, lesson] of Object.entries(dataset.lessons)) {
    const labels = labelsOf(name), c = await check(lesson, answering(name, labels));
    for (const type of TYPES) {
      const j = c.judged(type), [f, ...more] = c.findings(type), at = `${name} ${type}`;
      assert.deepEqual([j.type, j.label, !!j.unverified, j.explanation, j.evidenceMatching], [type, labels[type], false, explanationOf(name, type), { source: 'exact', target: 'exact' }], at);
      assert.equal(more.length, 0, `${at}: one finding per link`);
      assert.deepEqual([f.ruleId, f.status, f.explanation, f.verification], [LINK[type].rule, STATUS[labels[type]], explanationOf(name, type), 'quotes_verified'], at);
      // The evidence shown is from the link's own two fields: the reference from its source field, the evidence from its target field.
      assert.ok(lesson[LINK[type].source].includes(f.reference) && lesson[LINK[type].target].includes(f.evidence), `${at}: evidence from its own texts`);
      assert.equal(f.recommendationType, FAILING.includes(labels[type]) ? 'REVIEW_REQUIRED' : 'NO_CHANGE', at);
      if (FAILING.includes(labels[type])) { failing += 1; assert.equal(f.severity, 'MINOR', `${at}: advisory`); }
    }
    assert.ok(noC3Deduction(c.result), `${name}: no link of the chain costs a point`);
    lessons += 1;
  }
  assert.deepEqual([lessons, failing], [30, 44]);
});

test('masking: a passing activities -> tasks link sits next to failing content links, and each is reported as itself', async () => {
  for (const name of ['prog1-arrays-masked', 'syseng-reliability-masked', 'sensors-adc-masked']) {
    const c = await check(dataset.lessons[name], answering(name, labelsOf(name)));
    assert.deepEqual(c.open, [['ALN-11', 'FAIL'], ['ALN-12', 'FAIL']], `${name}: both content links are shown as failing`);
    assert.equal(c.findings('Activity-assessment')[0].status, 'PASS', `${name}: the aligned link is a pass, and only its own`);
  }
  // The other way round: tasks that assess the content, after activities that never practised what they ask.
  for (const name of ['prog1-methods', 'sensors-dac-partial']) {
    const c = await check(dataset.lessons[name], answering(name, labelsOf(name)));
    assert.deepEqual(c.open, [['ALN-11', 'NEEDS_REVIEW'], ['ALN-13', 'NEEDS_REVIEW']], name);
    assert.equal(c.findings('Content-assessment')[0].status, 'PASS', name);
  }
});

test('one link\'s answer never changes another link\'s judgement or verdict: each label of each link, the other two held fixed', async () => {
  const name = 'prog1-methods', lesson = dataset.lessons[name], base = labelsOf(name);
  const snapshot = c => Object.fromEntries(TYPES.map(type => { const j = c.judged(type), f = c.findings(type)[0]; return [type, [j.label, j.explanation, j.sourceQuote, j.targetQuote, f.status, f.explanation, f.reference, f.evidence]]; }));
  const reference = snapshot(await check(lesson, answering(name, base)));
  for (const type of TYPES) {
    for (const label of ['ALIGNED', 'PARTIALLY_ALIGNED', 'NOT_ALIGNED']) {
      const c = await check(lesson, answering(name, { ...base, [type]: label })), now = snapshot(c);
      assert.equal(now[type][4], STATUS[label], `${type} ${label}: its own verdict`);
      for (const other of TYPES.filter(t => t !== type)) assert.deepEqual(now[other], reference[other], `${type} answered ${label}: ${other} unchanged`);
      // The one dependency is the documented order of recommendations: tasks are not advised on while the activities are off (draftWithheld).
      if (type === 'Content-activity' && label === 'NOT_ALIGNED') assert.equal(c.findings('Activity-assessment')[0].withheld, 'activity_invalid');
    }
  }
});

test('a link the model never answers is NOT_CHECKED alone: the other two keep their verified verdicts, and the AI check still completes', async () => {
  const name = 'prog1-methods', lesson = dataset.lessons[name], labels = labelsOf(name);
  for (const type of TYPES) {
    const answer = answering(name, labels), c = await check(lesson, pair => (pair.id === LINK[type].id ? null : answer(pair)));
    const j = c.judged(type);
    assert.deepEqual([j.label, j.unverified, j.draft], ['INSUFFICIENT_EVIDENCE', true, ''], type);
    assert.ok(c.times.get(LINK[type].id) >= 2, `${type}: asked again before giving up`);
    assert.deepEqual([c.findings(type)[0].status, c.findings(type)[0].verification, c.findings(type)[0].recommendation], ['NOT_CHECKED', 'not_checked', null], type);
    for (const other of TYPES.filter(t => t !== type)) assert.deepEqual([c.judged(other).label, !!c.judged(other).unverified, c.findings(other)[0].status], [labels[other], false, STATUS[labels[other]]], `${type} missing: ${other}`);
    assert.equal(c.result.hybrid.alignment.status, 'completed', 'the advisory links never decide whether the AI check completed');
    assert.ok(!c.result.findings.some(f => f.ruleId === 'AI-REQUIRED'));
  }
});

test('evidence accuracy: a quote that is not in the link\'s own two texts - invented, swapped, from a sibling link or from the ILO - is refused, retried and never a verdict', async () => {
  const name = 'prog1-methods', lesson = dataset.lessons[name], labels = labelsOf(name);
  // The text of the lesson that this link does not judge: for a content link the other target field, for activities -> tasks the course content.
  const siblingText = { 'Content-activity': lesson.tasks, 'Content-assessment': lesson.activities, 'Activity-assessment': lesson.contents };
  const wrong = {
    invented: () => ({ sourceQuote: 'words that appear in no text', targetQuote: 'nor do these' }),
    swapped: pair => ({ sourceQuote: pair.target.slice(0, 20), targetQuote: fieldOf(pair.source).slice(0, 20) }),
    sibling: pair => (TYPE_OF[pair.id] === 'Activity-assessment' ? { sourceQuote: siblingText[TYPE_OF[pair.id]].slice(0, 30) } : { targetQuote: siblingText[TYPE_OF[pair.id]].slice(0, 30) }),
    ilo: () => ({ sourceQuote: ILO }),
  };
  const codes = { invented: ['quote_not_found'], swapped: ['quotes_swapped'], sibling: ['quote_from_other_pair', 'quote_not_found'], ilo: ['quote_from_other_pair', 'quote_not_found'] };
  for (const type of TYPES) {
    for (const [kind, bad] of Object.entries(wrong)) {
      const answer = answering(name, labels), c = await check(lesson, pair => (pair.id === LINK[type].id ? { ...answer(pair), label: 'NOT_ALIGNED', ...bad(pair) } : answer(pair)));
      const j = c.judged(type), at = `${type} ${kind}`;
      assert.deepEqual([j.label, j.unverified], ['INSUFFICIENT_EVIDENCE', true], at);
      assert.ok(j.refusals.length >= 1 && j.refusals.every(r => r.codes.length && r.codes.every(code => codes[kind].includes(code))), `${at}: ${JSON.stringify(j.refusals.map(r => r.codes))}`);
      assert.deepEqual([c.findings(type)[0].status, c.findings(type)[0].recommendation], ['NOT_CHECKED', null], `${at}: never a FAIL from evidence that was not verified`);
      for (const other of TYPES.filter(t => t !== type)) assert.equal(c.judged(other).unverified, undefined, `${at}: ${other} verified`);
    }
    // Quotes corrected on the second request: verified, with the label as answered.
    const answer = answering(name, labels), c = await check(lesson, (pair, attempt) => (pair.id === LINK[type].id && attempt === 1 ? { ...answer(pair), ...wrong.invented() } : answer(pair)));
    assert.deepEqual([c.judged(type).label, c.judged(type).unverified, c.judged(type).evidenceMatching, c.times.get(LINK[type].id)], [labels[type], undefined, { source: 'exact', target: 'exact' }, 2], `${type} corrected`);
  }
});

test('the explanation is reviewed as its own: wording borrowed from a sibling link, or a judgement resting on the ILO, is shown for review and changes no label', async () => {
  const name = 'prog1-methods', lesson = dataset.lessons[name], labels = labelsOf(name), answer = answering(name, labels);
  const explanations = {
    // the tasks' wording, which this content -> activities link does not judge
    'Content-activity': 'The activities never ask students to compute the area of a square from one side.',
    'Content-assessment': 'The exercise needs parameters and a return value, so the ILO is only partly assessed.',
    'Activity-assessment': 'The task asks for parameters the activities never practised; the ILO is judged in another relationship.',
  };
  const c = await check(lesson, pair => (TYPE_OF[pair.id] ? { ...answer(pair), explanation: explanations[TYPE_OF[pair.id]] } : answer(pair)));
  assert.deepEqual(TYPES.map(type => c.judged(type).explanationReview || []), [['explanation_from_other_pair'], ['cites_outcome'], []]);
  assert.deepEqual(TYPES.map(type => [c.judged(type).label, c.findings(type)[0].status]), TYPES.map(type => [labels[type], STATUS[labels[type]]]), 'labels and verdicts as answered');
  // A pass with a review note stays a pass; it is listed among the findings to look at.
  assert.deepEqual(c.open, [['ALN-11', 'NEEDS_REVIEW'], ['ALN-12', 'PASS'], ['ALN-13', 'NEEDS_REVIEW']]);
  assert.equal(c.findings('Content-assessment')[0].reviewEvidence.explanation[0].evidence, 'ILO');
});

// ---- the recommendation: one sentence of advice on one link, read against that link's two texts ----
const pairOf = id => { const item = dataset.items.find(i => i.id === id); return { id: item.id, type: item.type, source: item.source, target: item.target, path: 'eval', targetPath: null }; };
const notes = (id, draft, label = 'PARTIALLY_ALIGNED') => { const item = dataset.items.find(i => i.id === id); return reviewDraft({ id, label, draft, explanation: 'x' }, pairOf(id), dataset.courses[item.course], { pairs: [pairOf(id)] }).map(n => `${n.code}${n.advisory ? ' (advisory)' : ''}`); };

test('a recommendation that names one change using what the two texts state passes the review, for every link and course', () => {
  const good = {
    'c3-prog1-methods-ca': 'Add practice in which students write methods with parameters and return values, and overload one of them.',
    'c3-prog1-strings-bare-ct': 'State what the quiz asks students to do with the String methods, such as substring, indexOf and equals.',
    'c3-prog1-methods-at': 'Limit the exercise to writing and calling methods without parameters, the work the students practised.',
    'c3-syseng-requirements-trap-ca': 'Replace the reading of the course requirements with an exercise in which students write system requirements from stakeholder needs and trace them.',
    'c3-syseng-tradeoff-recall-ct': 'Extend the quiz so that students also weight evaluation criteria and run a sensitivity analysis on a decision matrix.',
    'c3-syseng-management-bare-at': 'State what the seatwork asks of the work breakdown structure the teams drafted.',
    'c3-sensors-adc-masked-ca': 'Replace the timer laboratory with one on sampling, quantization and the successive-approximation converter.',
    'c3-sensors-actuators-bare-ct': 'State which actuators and driver circuits the laboratory exercise assesses and what the students produce.',
    'c3-sensors-dac-partial-at': 'Limit the problem set to the 4-bit R-2R ladder converter the students built.',
    // equipment the activities name is not an added resource
    'c3-sensors-amplifier-trap-at': 'Ask the report to use the gain the students set on the audio amplifier, or replace it with a task on that amplifier.',
  };
  for (const [id, draft] of Object.entries(good)) assert.deepEqual(notes(id, draft, dataset.items.find(i => i.id === id).accept[0]), [], id);
});

test('a recommendation that reaches beyond the link is held back (an outcome, a resource, people, a week, extra scope); a second sentence or a list is a caution', () => {
  const cases = [
    ['c3-prog1-methods-ca', 'Add practice so that the activities also meet the ILO on parameters and return values.', ['asks_for_outcome']],
    ['c3-prog1-methods-ct', 'Make the exercise assess the course learning outcomes for methods.', ['asks_for_outcome']],
    ['c3-sensors-adc-masked-ca', 'Replace the timer laboratory with one in which students sample a voltage with an oscilloscope.', ['assumes_resource']],
    ['c3-syseng-tradeoff-recall-at', 'Grade the decision matrices in MATLAB instead of a quiz.', ['assumes_resource']],
    ['c3-prog1-methods-ca', 'Invite the community to a coding session on parameters and return values.', ['adds_participant']],
    ['c3-prog1-methods-ca', 'Add practice on parameters and return values in Week 9.', ['adds_week']],
    ['c3-prog1-methods-ca', 'Have students build a complete application that uses methods with parameters.', ['adds_scope']],
    ['c3-prog1-methods-ca', 'Add practice on parameters. Then add practice on overloading.', ['not_one_sentence (advisory)']],
    ['c3-prog1-methods-ca', '- Students write methods with parameters, return values and overloading.', ['not_one_sentence (advisory)']],
  ];
  for (const [id, draft, codes] of cases) assert.deepEqual(notes(id, draft), codes, draft);
  // What the draft rules out, or sets aside, is not added; "e.g." is not a second sentence.
  assert.deepEqual(notes('c3-sensors-adc-masked-ca', 'Replace the timer laboratory with one on sampling and quantization, without an oscilloscope.'), []);
  assert.deepEqual(notes('c3-prog1-methods-ca', 'Without changing the ILO, add practice on parameters and return values.'), []);
  assert.deepEqual(notes('c3-sensors-adc-masked-ca', 'Replace the timer laboratory with one on sampling, e.g. reading a slowly varying voltage at two rates.'), []);
  // A pass shows no recommendation, so a stray draft beside it is not reviewed.
  assert.deepEqual(notes('c3-prog1-conditionals-ca', 'Invite the community to Week 9 to meet the ILO.', 'ALIGNED'), []);
  // The explanation review: an outcome named in passing is a note; set aside, it is not.
  const pair = pairOf('c3-prog1-methods-ca');
  assert.deepEqual(reviewExplanation({ label: 'PARTIALLY_ALIGNED', explanation: 'The activities never practise parameters, which the ILO asks for.' }, pair, [pair]).map(n => n.code), ['cites_outcome']);
  assert.deepEqual(reviewExplanation({ label: 'PARTIALLY_ALIGNED', explanation: 'The activities practise no parameters; the ILO is judged in another relationship.' }, pair, [pair]), []);
});

test('in the report: a held recommendation is withdrawn with its reason, a caution keeps it, and neither changes the label, the verdict or the score', async () => {
  const name = 'prog1-methods', lesson = dataset.lessons[name], labels = labelsOf(name), answer = answering(name, labels);
  const drafts = { 'Content-activity': 'Add practice so that the activities also meet the ILO on parameters and return values.', 'Activity-assessment': 'Limit the exercise to methods without parameters. Keep the rectangle example.' };
  const c = await check(lesson, pair => (drafts[TYPE_OF[pair.id]] ? { ...answer(pair), draft: drafts[TYPE_OF[pair.id]] } : answer(pair)));
  const ca = c.findings('Content-activity')[0], at = c.findings('Activity-assessment')[0];
  assert.deepEqual([ca.status, ca.recommendation, ca.withheld, ca.draftReview], ['NEEDS_REVIEW', null, 'draft_review', ['asks_for_outcome']]);
  assert.deepEqual([at.status, at.recommendation, at.withheld, at.draftWarnings], ['NEEDS_REVIEW', drafts['Activity-assessment'], null, ['not_one_sentence']]);
  const plain = await check(lesson, answer);
  assert.deepEqual([c.result.score, c.result.hybrid.provisionalScore, c.result.hybrid.deductions], [plain.result.score, plain.result.hybrid.provisionalScore, plain.result.hybrid.deductions]);
  assert.deepEqual(TYPES.map(type => c.judged(type).label), TYPES.map(type => labels[type]));
});
