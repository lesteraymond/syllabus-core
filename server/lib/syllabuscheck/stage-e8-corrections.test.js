'use strict';
// All responses are saved or scripted. These tests exercise safeguards and contract behavior, not model or faculty accuracy.
const test = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('./engine');
const { sample } = require('./fixtures');
const gemini = require('./gemini');
const fit = require('./lessonfit');
const review = require('./answerReview');
const { resourceNotes } = require('./recommendationReview');
const { stageFlags } = require('./stages');
const { aiGate } = require('./policy');
const { answerOf, summarizeReviews } = require('./eval/answerReviews');
const dataset = require('./eval/stage-c-dataset.json');
const saved = require('../../../docs/ai-eval-stage-e8-c-canary-resume.json');
const C = { SYLLABUS_CHECK_STAGE_C1: 'on', SYLLABUS_CHECK_STAGE_C2: 'on' };
const sourceOf = ilo => `Week 3 course content: Java conditionals\nILOs:\n- ${ilo}\nContact units stated by the syllabus: lecture 2, laboratory 1`;
const conceptual = { id: 'conceptual', type: 'Activity-fit', source: sourceOf('Explain the difference between if-else and switch statements.'), target: 'Lecture-discussion with worked examples.' };
const pairOf = item => ({ ...item, path: 'eval', targetPath: 'eval' });
function replay(id) {
  const item = dataset.items.find(i => i.id === id), j = saved.answers[0][id];
  const raw = { id, label: j.label, explanation: j.explanation, sourceQuote: j.sourceQuote, targetQuote: j.targetQuote, sourceBloom: 'N/A', targetBloom: 'N/A', draft: j.draft || '', ...j.aspects.values };
  return gemini.salvage({ judgements: [raw] }, dataset.items.filter(i => i.course === item.course).map(pairOf), gemini.contractOf(C, dataset.courses[item.course]))[0];
}
const codes = notes => notes.map(n => n.code);

test('E.8 conceptual ILO and valid lecture remain accepted by the response contract; a teacher demonstration is not learner practical performance', () => {
  assert.equal(fit.competencyOf(conceptual.source).conceptualOnly, true);
  for (const draft of ['Lecture-discussion with guided explanation and worked examples.', 'The teacher demonstrates how to write a Java program while explaining each conditional.']) {
    assert.deepEqual(review.reviewDraft({ draft }, conceptual), [], draft);
  }
  const raw = { id: conceptual.id, label: 'ALIGNED', explanation: 'Worked examples support the conceptual explanation.', sourceQuote: 'Explain the difference', targetQuote: 'Lecture-discussion', sourceBloom: 'Understand', targetBloom: 'Understand', draft: '', teaching: 'sound', learnerSupport: 'adequate' };
  const checked = gemini.validate({ judgements: [raw] }, [conceptual], gemini.contractOf(C))[0];
  assert.equal(checked.label, 'ALIGNED'); assert.equal(checked.draftReview, undefined);
});

test('E.8 cognitive hints distinguish knowledge, understanding, application, analysis, evaluation and creation without assuming a laboratory', () => {
  for (const [ilo, category] of [
    ['Define the key terms.', 'knowledge'], ['Explain the concept.', 'understanding'], ['Calculate a result from the given formula.', 'application'],
    ['Analyze a requirements document.', 'analysis'], ['Evaluate competing designs against a rubric.', 'evaluation'], ['Design a requirements model on paper.', 'creation'],
  ]) {
    const hint = fit.competencyOf(sourceOf(ilo));
    assert.deepEqual(hint.categories, [category], ilo); assert.equal(hint.practical, false, ilo);
  }
  assert.equal(fit.competencyOf(sourceOf('Explain how to build and test a circuit.')).conceptualOnly, true);
  assert.equal(fit.competencyOf(sourceOf('Explain and build a circuit.')).conceptualOnly, false);
  assert.equal(fit.competencyOf(sourceOf('Explain how to measure gain; then build and test an amplifier.')).conceptualOnly, false);
  assert.equal(fit.competencyOf(sourceOf('Design and test an inverting amplifier with a specified gain.')).practical, true);
});

test('E.8 practical ILO retains a valid stated laboratory activity, while a lecture alone is still judged weak by the scripted model contract', () => {
  const good = pairOf(dataset.items.find(i => i.id === 'af-prog1-good'));
  assert.deepEqual(review.reviewDraft({ draft: 'In the laboratory, students write and run Java programs in pairs.' }, good), []);
  const practical = pairOf(dataset.items.find(i => i.id === 'af-sensors-passive'));
  const raw = { id: practical.id, label: 'NOT_ALIGNED', explanation: 'Lecture alone does not practise the required circuit design and testing.', sourceQuote: 'Design and test', targetQuote: 'Lecture on operational amplifiers.', sourceBloom: 'Create', targetBloom: 'Understand', draft: 'If laboratory equipment is available, students design and test the circuit; otherwise faculty must confirm an equivalent testing setting.', teaching: 'weak', learnerSupport: 'limited' };
  const j = gemini.validate({ judgements: [raw] }, [practical], gemini.contractOf(C))[0];
  assert.equal(j.label, 'NOT_ALIGNED'); assert.equal(j.aspects.values.teaching, 'weak');
  assert.equal(j.draftReview, undefined); assert.ok(j.draftWarnings.includes('conditional_resource'));
});

test('E.8 course laboratory credits do not ground a particular activity or resource availability', () => {
  const line = fit.unitsLine({ lecture: 2, lab: 1 });
  assert.match(line, /Course-wide/); assert.match(line, /not lesson requirements/);
  assert.ok(codes(review.reviewDraft({ draft: 'Laboratory practice: students write and test a Java program.' }, conceptual)).includes('unnecessary_practical'));
  assert.ok(codes(resourceNotes('Students use the laboratory.', conceptual)).includes('assumes_resource'));
  const onlyIlo = { ...conceptual, source: sourceOf('Operate an oscilloscope and interpret the output.'), target: 'Lecture.' };
  assert.ok(codes(resourceNotes('Students use an oscilloscope.', onlyIlo)).includes('assumes_resource'), 'ILO demand is not proof of equipment access');
});

test('E.8 assessment at the intended level remains supported and too-low/too-high tasks retain their original judgments', () => {
  for (const id of ['as-prog1-good', 'as-prog1-recall-quiz', 'as-prog1-too-high']) {
    const checked = replay(id);
    assert.equal(checked.label, saved.answers[0][id].label);
    assert.equal(checked.aspects.values.level, saved.answers[0][id].aspects.values.level);
  }
  const assessment = { ...conceptual, type: 'Assessment-fit', target: 'Design and implement a complete application with a database and a user interface.' };
  assert.ok(codes(review.reviewDraft({ draft: 'Build a complete application with a database and user interface.' }, assessment)).includes('expands_competency'), 'an excessive old target cannot justify its own replacement');
});

test('E.8 unverified and explicitly unavailable resources are withheld; a specific conditional option is advisory only', () => {
  for (const draft of ['Use an oscilloscope to measure the result.', 'Use MATLAB for the calculation.', 'Perform the task in a computer room.', 'Use a starter file.']) {
    assert.ok(codes(review.reviewDraft({ draft }, conceptual)).includes('assumes_resource'), draft);
  }
  const unavailable = { ...conceptual, source: conceptual.source + '\nResources: MATLAB is unavailable.' };
  assert.ok(codes(resourceNotes('If MATLAB is available, use MATLAB.', unavailable)).includes('assumes_resource'), 'conditional wording cannot override explicit unavailability');
  const conditional = resourceNotes('If MATLAB is available, use MATLAB; otherwise use the stated worked examples.', conceptual);
  assert.ok(conditional.every(n => n.advisory)); assert.ok(codes(conditional).includes('conditional_resource'));
  const separate = resourceNotes('If MATLAB is available, use MATLAB, then use an oscilloscope.', conceptual);
  assert.ok(separate.some(n => n.code === 'assumes_resource' && n.evidence === 'oscilloscope'), 'one conditional tool cannot establish another');
  assert.ok(codes(resourceNotes('If no oscilloscope is available, use an oscilloscope.', conceptual)).includes('assumes_resource'), 'a negative availability condition cannot authorize the resource');
  assert.deepEqual(resourceNotes('Explain the procedure without laboratory equipment.', conceptual), []);
  const stated = { ...conceptual, source: conceptual.source + '\nResources: An oscilloscope is available for this lesson.' };
  assert.deepEqual(resourceNotes('Use the oscilloscope.', stated), []);
  assert.ok(resourceNotes('Use an oscilloscope if available.', conceptual).every(n => n.advisory));
  for (const evidence of ['An oscilloscope is not required.', 'We do not have oscilloscopes.']) {
    const unproven = { ...conceptual, source: conceptual.source + '\nEquipment: ' + evidence };
    assert.ok(codes(resourceNotes('Use an oscilloscope.', unproven)).includes('assumes_resource'), evidence);
  }
});

test('E.8 external participants need lesson evidence; a case about stakeholders does not establish real interviews', () => {
  const pair = { id: 'requirements', type: 'Assessment-fit', source: 'Week 4 course content: stakeholder needs\nILOs:\n- Write verifiable requirements.\nLearning activities: teams draft requirements from a case.', target: 'Essay on history.' };
  assert.ok(codes(review.reviewDraft({ draft: 'Interview external stakeholders and write the requirements.' }, pair)).includes('adds_participant'));
  assert.ok(codes(review.reviewDraft({ draft: 'Invite an expert from another school.' }, pair)).includes('adds_participant'));
  assert.deepEqual(review.reviewDraft({ draft: 'Write requirements addressing the stakeholder needs in the given case.' }, pair), []);
  assert.deepEqual(review.reviewDraft({ draft: 'Do not invite external experts; use a written case.' }, pair), []);
  assert.ok(!codes(review.reviewDraft({ draft: 'Explain the client-server comparison in the written case.' }, pair)).includes('adds_participant'), 'technical client terminology is not an external person');
});

test('E.8 resource evidence and negation are specific to the requested tool and phrase', () => {
  const meter = { ...conceptual, source: conceptual.source + '\nResources: A multimeter is available; MATLAB is available.' };
  for (const draft of ['Use an oscilloscope.', 'Use LTspice.', 'Use MATLAB and LTspice.']) assert.ok(codes(resourceNotes(draft, meter)).includes('assumes_resource'), draft);
  const mixed = resourceNotes('Use a breadboard without a simulator.', conceptual);
  assert.deepEqual(mixed.map(n => n.evidence), ['breadboard']);
  const lab = { ...conceptual, target: 'Students work in the laboratory with no calculation errors.' };
  assert.deepEqual(resourceNotes('Use the laboratory.', lab), []);
  for (const evidence of ['No information about laboratory access.', 'Laboratory access is unknown.', 'MATLAB is not confirmed.', 'To be confirmed: MATLAB.']) {
    const unknown = { ...conceptual, source: conceptual.source + '\nResources: ' + evidence };
    const resource = /MATLAB/.test(evidence) ? 'MATLAB' : 'laboratory';
    assert.ok(codes(resourceNotes('Use the ' + resource + '.', unknown)).includes('assumes_resource'), evidence);
  }
});

test('E.8 ruling out unwanted project scope does not expand the competency', () => {
  for (const draft of ['Explain the comparison with no database implementation.', 'Explain the difference; avoid external interviews.', 'Explain the concept; do not add a database.']) {
    assert.ok(!codes(review.reviewDraft({ draft }, conceptual)).includes('expands_competency'), draft);
  }
});

test('E.8 shared terminology and a same-ILO assessment correction receive at most an advisory copying caution', () => {
  const j = replay('as-prog1-recall-quiz');
  assert.equal(j.draftReview, undefined); assert.deepEqual(j.draftWarnings, ['borrowed_wording']);
  assert.equal(j.reviewEvidence.draftWarnings[0].from, 'as-prog1-good');
  assert.equal(j.draft, saved.answers[0]['as-prog1-recall-quiz'].draft);
  assert.equal(j.label, 'NOT_ALIGNED');
});

test('E.8 actual unsupported sibling resources still withhold a contaminated draft', () => {
  const j = replay('af-prog1-irrelevant');
  assert.ok(j.draftReview.includes('copies_other_relationship')); assert.ok(j.draftReview.includes('assumes_resource'));
  assert.ok(j.reviewEvidence.draft.some(n => n.code === 'assumes_resource' && n.evidence === 'starter file'));
  const other = { id: 'other', type: 'Activity-fit', source: 'Week 9 course content: fieldwork\nILOs:\n- Report findings.', target: 'Invite guests from another school and use MATLAB in the laboratory.' };
  const contaminated = review.reviewDraft({ draft: other.target }, conceptual, null, { pairs: [conceptual, other] });
  assert.ok(codes(contaminated).includes('copies_other_relationship')); assert.ok(codes(contaminated).includes('adds_participant'));
});

test('E.8 offline replay catches both canary failures without modifying saved labels, aspects or source text', () => {
  const before = JSON.stringify(saved);
  const conceptualAnswer = replay('af-prog1-conceptual-lecture-ok'), resourceAnswer = replay('af-sensors-passive');
  assert.ok(conceptualAnswer.explanationReview.includes('practical_requirement'));
  assert.ok(conceptualAnswer.draftReview.includes('unnecessary_practical'));
  assert.ok(resourceAnswer.draftReview.includes('assumes_resource'));
  assert.equal(conceptualAnswer.label, 'PARTIALLY_ALIGNED'); assert.equal(resourceAnswer.label, 'NOT_ALIGNED');
  assert.equal(JSON.stringify(saved), before);
  assert.deepEqual(conceptualAnswer.aspects, saved.answers[0]['af-prog1-conceptual-lecture-ok'].aspects);
});

test('E.8 explanation feasibility claims are advisory and negated resource claims are not flagged', () => {
  assert.ok(codes(review.reviewExplanation({ explanation: 'The laboratory is available.' }, conceptual)).includes('resource_assumption'));
  assert.deepEqual(review.reviewExplanation({ explanation: 'We cannot confirm that the laboratory is available.' }, conceptual), []);
  assert.deepEqual(review.reviewExplanation({ explanation: 'A conceptual lecture does not require hands-on coding.' }, conceptual), [], 'a negated practical requirement is not a demand');
});

test('E.8 separate advisory warnings persist in evaluation output without becoming withheld-draft codes', () => {
  const j = replay('as-prog1-recall-quiz'), answer = answerOf(j), summary = summarizeReviews([new Map([[j.id, answer]])]);
  assert.equal(answer.draftReview, undefined); assert.deepEqual(answer.draftWarnings, ['borrowed_wording']);
  assert.deepEqual(summary.counts.draftWarnings, { borrowed_wording: 1 }); assert.deepEqual(summary.counts.draftReview, {});
});

async function engineWith(draft, upstream = true, useAi = true) {
  const { content, masters } = sample();
  content.plan[2].contents = 'Java conditionals'; content.plan[2].ilos[0].text = 'Explain the difference between if-else and switch statements.';
  content.plan[2].activities = 'Lecture-discussion with worked examples.'; content.plan[2].tasks = 'Explain each construct in a short answer.';
  const before = structuredClone(content);
  let calls = 0;
  const env = { ...C, ...(upstream ? { SYLLABUS_CHECK_STAGE_B: 'on' } : {}), SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' };
  const transport = async (_url, req) => {
    calls++;
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    const judgements = batch.map(p => ({ id: p.id, label: p.id === 'row2-activityfit' ? 'PARTIALLY_ALIGNED' : 'ALIGNED', explanation: 'Scripted academic judgment.', sourceQuote: p.source.slice(0, 16), targetQuote: p.target.slice(0, 16), sourceBloom: 'N/A', targetBloom: 'N/A', draft: p.id === 'row2-activityfit' ? draft : '', ...Object.fromEntries(gemini.aspectKeysFor(stageFlags(env)).map(k => [k, 'not_assessed'])), ...(p.type === 'Activity-fit' ? { teaching: p.id === 'row2-activityfit' ? 'weak' : 'sound', learnerSupport: 'adequate' } : p.type === 'Assessment-fit' ? { measures: 'yes', evidence: 'observable', level: 'matches' } : {}) }));
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements }) }] } }] }) };
  };
  const result = await run(content, masters, { env, useAi, transport, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) });
  assert.deepEqual(content, before);
  return { result, calls };
}
test('E.8 unsupported draft withholding leaves official score, deductions, passing mark, readiness and gates unchanged', async () => {
  const good = await engineWith('A guided explanation with further worked examples.'), bad = await engineWith('Laboratory practice: students write and test Java programs.');
  const official = r => ({ score: r.score, passed: r.passed, band: r.band, conformance: r.conformance, ready: r.hybrid.ready, deductions: r.hybrid.deductions, official: r.hybrid.scoring.official, policy: r.hybrid.policy, titlePolicy: r.hybrid.titlePolicy });
  assert.deepEqual(official(good.result), official(bad.result)); assert.equal(good.calls, bad.calls);
  assert.ok(good.result.hybrid.suggestions.some(s => s.path === 'plan[2].activities'));
  assert.ok(!bad.result.hybrid.suggestions.some(s => s.path === 'plan[2].activities'));
  assert.equal(bad.result.hybrid.unresolved.filter(u => u.path === 'plan[2].activities').length, 1);
  assert.equal(aiGate({}), 'advisory'); assert.equal(bad.result.hybrid.titlePolicy.comparison, 'exact');
});
test('E.8 missing upstream evidence keeps its finding and withholds the draft for upstream review', async () => {
  const { result } = await engineWith('A guided explanation with further worked examples.', false);
  const finding = result.hybrid.verdict.findings.find(f => f.relationshipId === 'row2-activityfit');
  assert.equal(finding.withheld, 'upstream_unverified'); assert.equal(finding.recommendation, null);
  assert.ok(!result.hybrid.suggestions.some(s => s.path === 'plan[2].activities'));
});
test('E.8 offline AI behavior never calls the scripted transport or invents an academic pass', async () => {
  const { result, calls } = await engineWith('Never requested.', true, false);
  assert.equal(calls, 0); assert.equal(result.hybrid.alignment.status, 'not_evaluated');
  assert.ok(!result.hybrid.suggestions.some(s => s.source === 'ai'));
  assert.ok(result.hybrid.verdict.findings.some(f => f.ruleId === 'ALN-05' && f.status === 'NOT_CHECKED'));
});
