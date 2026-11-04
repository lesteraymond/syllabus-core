'use strict';
// Offline academic reliability regressions. Saved E.7 answers are immutable fixtures, not faculty-approved ground truth.
const test = require('node:test');
const assert = require('node:assert/strict');
const review = require('./answerReview');
const gemini = require('./gemini');
const { run } = require('./engine');
const { sample } = require('./fixtures');
const { aiGate, POLICY } = require('./policy');
const d1 = require('./eval/stage-d1-dataset.json');
const d2 = require('./eval/stage-d2-dataset.json');
const savedD1 = require('../../../docs/ai-eval-stage-e7-d1.json').answers[0];
const savedD2 = require('../../../docs/ai-eval-stage-e7-d2-resume.json').answers[0];
const D1 = { SYLLABUS_CHECK_STAGE_D1: 'on' }, D2 = { SYLLABUS_CHECK_STAGE_D2: 'on' };
const pairOf = item => ({ ...item, path: 'plan[2].values', targetPath: gemini.isNoRewrite(item.type) ? null : 'plan[2].values' });
const rawOf = (id, saved, overrides = {}) => {
  const { label, explanation, sourceQuote, targetQuote, draft } = saved[id];
  return { id, label, explanation, sourceQuote, targetQuote, draft: draft || '', sourceBloom: 'N/A', targetBloom: 'N/A', ...saved[id].aspects.values, ...overrides };
};
const checked = (dataset, saved, id, overrides = {}, staged = true) => {
  const item = dataset.items.find(i => i.id === id), pairs = dataset.items.filter(i => i.course === item.course).map(pairOf);
  const raw = rawOf(id, saved, overrides), contract = staged ? gemini.contractOf(dataset === d1 ? D1 : D2, dataset.courses[item.course]) : false;
  if (!staged) for (const key of Object.keys(saved[id].aspects.values)) delete raw[key];
  // salvage validates individual answers while retaining the complete request as sibling context.
  return gemini.salvage({ judgements: [raw] }, pairs, contract)[0];
};

test('saved D1 regressions: borrowed reasoning, copied draft, outside participant and technical-only Compassion are reviewable without relabelling', () => {
  const expected = {
    'vm-prog1-respect-supported': { explanationReview: ['explanation_from_other_pair'] },
    'vu-prog1-name-only': { draftReview: ['copies_other_relationship'] },
    'vu-prog1-unrelated': { draftReview: ['adds_participant'] },
    'vu-sensors-silly': { draftReview: ['value_not_expressed'] },
  };
  for (const item of d1.items) {
    const j = checked(d1, savedD1, item.id);
    assert.ok(j, item.id);
    assert.equal(j.label, savedD1[item.id].label);
    assert.deepEqual(j.aspects, savedD1[item.id].aspects);
    assert.deepEqual(j.explanationReview || [], expected[item.id]?.explanationReview || [], item.id);
    assert.deepEqual(j.draftReview || [], expected[item.id]?.draftReview || [], item.id);
    assert.equal(j.draft, savedD1[item.id].draft);
    if (j.reviewEvidence) for (const notes of Object.values(j.reviewEvidence)) for (const n of notes) assert.ok(n.evidence);
  }
  const borrowed = checked(d1, savedD1, 'vm-prog1-respect-supported');
  assert.equal(borrowed.reviewEvidence.explanation[0].from, 'vm-prog1-honesty-supported');
});

test('an insufficient-evidence raw draft inventing a laboratory is reviewed and remains hidden', () => {
  const j = checked(d1, savedD1, 'vu-prog1-no-activity', { draft: 'Compassion: in the Week 3 laboratory, partners help each other write the program.' });
  assert.equal(j.label, 'INSUFFICIENT_EVIDENCE');
  assert.equal(j.draft, '');
  assert.ok(j.draftReview.includes('adds_activity'));
  assert.ok(j.reviewEvidence.draft.some(n => n.code === 'adds_activity' && n.evidence === 'laboratory'));
});

test('saved D2 venue warnings preserve every label and aspect, including the debatable instrument-maker website', () => {
  for (const item of d2.items) {
    const j = checked(d2, savedD2, item.id);
    assert.ok(j, item.id);
    assert.equal(j.label, savedD2[item.id].label);
    assert.deepEqual(j.aspects, savedD2[item.id].aspects);
    const expected = item.id === 'rr-sensors-relevant' ? ['venue_claim', 'basis_overstated'] : item.id === 'rr-sensors-web' ? ['basis_overstated'] : [];
    assert.deepEqual(j.explanationReview || [], expected, item.id);
    assert.equal(j.draft, '');
  }
});

test('review is off for the legacy contract and never changes the prompt, schema or pair cache keys', () => {
  const j = checked(d1, savedD1, 'vu-prog1-unrelated', {}, false);
  assert.ok(j);
  assert.equal(j.draftReview, undefined);
  assert.equal(j.explanationReview, undefined);
  assert.equal(j.reviewEvidence, undefined);
  assert.equal(gemini.promptVersionOf('m', D1), 'alignment-12d1-r7');
  assert.equal(gemini.promptVersionOf('m', D2), 'alignment-12d2-r7');
});

test('shared academic terms and wording already grounded in the current pair do not imply cross-relationship copying', () => {
  const pair = { id: 'self', type: 'Activity-fit', source: 'Week 3 course content: Java arrays\nLearning activities: teams discuss array bounds and trace indexed access.', target: 'Teams discuss array bounds and trace indexed access.' };
  const siblings = [pair, { id: 'other', source: pair.source, target: 'Teams discuss array bounds and trace indexed access.' }];
  assert.deepEqual(review.reviewExplanation({ explanation: 'Teams discuss array bounds and trace indexed access.' }, pair, siblings), []);
  assert.equal(review.borrowedWording('Students work together in class.', pair, [{ id: 'other', source: 'Students work together in class.' }]), null);
});

test('grounded, negated and ordinary classroom suggestions stay available; institutional value definitions do not ground a new activity', () => {
  const pair = pairOf(d1.items.find(i => i.id === 'vu-prog1-generic'));
  const aspects = { values: { valueUse: 'generic', valueFit: 'partly' } };
  const j = { label: 'PARTIALLY_ALIGNED', draft: 'Courage: partners ask for help with their program, without a prize or a contest.' };
  assert.deepEqual(review.reviewDraft(j, pair, d1.courses.prog1, { aspects }), []);
  const noActivity = pairOf(d1.items.find(i => i.id === 'vu-prog1-no-activity'));
  noActivity.source += '\nDefinitions of the values named:\nCompassion: students in a laboratory help their partner.';
  assert.ok(review.reviewDraft({ label: 'NOT_ALIGNED', draft: 'Compassion: in a laboratory, students help partners.' }, noActivity).some(n => n.code === 'adds_activity'));
  const course = { description: 'The course includes laboratory work in pairs and community activities.' };
  const absent = pairOf(d1.items.find(i => i.id === 'vu-prog1-no-activity'));
  assert.ok(review.reviewDraft({ draft: 'Compassion: partners help each other in the laboratory.' }, absent, course).some(n => n.code === 'adds_activity'), 'course-wide laboratory provision cannot supply an absent lesson activity');
  const community = { ...pair, target: 'Community-orientedness' };
  assert.ok(!review.reviewDraft({ label: 'PARTIALLY_ALIGNED', draft: 'Community-orientedness: students share what they learned with a classmate.' }, community).some(n => n.code === 'adds_participant'));
});

test('week review respects multiweek spans, relative week positions and an explicitly stated week', () => {
  const pair = { id: 'week', type: 'Value-use', source: 'Week 4-5 course content: sensors\nLearning activities: pairs build a circuit.', target: 'Courage' };
  for (const draft of ['Courage: in Week 4 students ask for help.', 'Courage: in the second week students ask for help.']) assert.deepEqual(review.reviewDraft({ draft }, pair), []);
  for (const draft of ['Courage: in Week 8 students ask for help.', 'Courage: next week students ask for help.']) assert.ok(review.reviewDraft({ draft }, pair).some(n => n.code === 'adds_week'));
});

test('metadata review flags unsupported named venues, years, journal standing and author credentials, while respecting disclaimers', () => {
  const pair = { id: 'ref', type: 'Ref-relevance', source: 'Sensors and signal conditioning, Week 3', target: 'Reyes, A. (2022). Sensor circuits. Example Press.' };
  for (const explanation of ['It is a reputable publisher.', 'It was published by Invented Scientific Press.', 'It appears in the Example Journal of Medicine.']) assert.ok(review.reviewExplanation({ explanation }, pair).some(n => n.code === 'venue_claim'), explanation);
  for (const explanation of ['The authors are leading experts.', 'The book is widely cited.', 'The work dates from 2019.']) assert.ok(review.reviewExplanation({ explanation }, pair).some(n => n.code === 'metadata_claim'), explanation);
  for (const explanation of ['The entry does not say whether the publisher is reputable.', 'It is unknown whether this is peer-reviewed.', 'The entry does not establish publication in 2019.', 'It was published by Example Press.', 'The year listed is 2022.']) assert.deepEqual(review.reviewExplanation({ explanation }, pair), [], explanation);
  const subjectVenue = { ...pair, target: 'Reyes, A. (2022). Sensor circuits. Example Journal of Sensors and Signal Conditioning, 4(2), 1-10.' };
  assert.deepEqual(review.reviewExplanation({ explanation: 'The title and journal name concern sensors.' }, subjectVenue, [], null, { values: { relevance: 'relevant', basis: 'title_and_venue' } }), []);
  assert.ok(review.reviewExplanation({ explanation: 'Insufficient basis.' }, pair, [], null, { values: { relevance: 'relevant', basis: 'insufficient' } }).some(n => n.code === 'basis_contradicts_relevance'));
});

// Scripted Gemini transport only. No fetch, network, DB, real keys or provider calls.
async function engineResult(draft) {
  const { content, masters } = sample();
  content.plan[2].contents = 'Java conditionals';
  content.plan[2].activities = 'Pair programming in the laboratory and peer code review.';
  content.plan[2].tasks = 'Write and test a program.';
  content.plan[2].values = 'Compassion: help each other.';
  const before = structuredClone(content);
  let requests = 0;
  const env = { ...D1, SYLLABUS_CHECK_STAGE_B: 'on', SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only', SYLLABUS_CHECK_VALUES_FILE: 'no-such-values-file.json' };
  const transport = async (_url, req) => {
    requests++;
    const pairs = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    const judgements = pairs.map(p => ({ id: p.id, label: p.id === 'row2-valueuse' ? 'NOT_ALIGNED' : 'ALIGNED', explanation: 'Scripted academic judgement.', sourceQuote: p.source.slice(0, 16), targetQuote: p.target.slice(0, 16), sourceBloom: 'N/A', targetBloom: 'N/A', draft: p.id === 'row2-valueuse' ? draft : '', ...Object.fromEntries(gemini.aspectKeysFor({ d1: true }).map(k => [k, 'not_assessed'])), ...(p.type === 'Value-use' ? { valueUse: p.id === 'row2-valueuse' ? 'unrelated' : 'integrated', carriedBy: p.id === 'row2-valueuse' ? 'none' : 'activity', valueFit: 'fits' } : {}) }));
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements }) }] } }] }) };
  };
  const result = await run(content, masters, { env, useAi: true, transport, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) });
  assert.deepEqual(content, before, 'faculty content is never mutated');
  return { result, requests };
}
test('withholding an unsupported draft preserves scores, deductions, pass mark, readiness and submission gates, without additional requests', async () => {
  const good = await engineResult('Compassion: partners help each other understand the conditional program.');
  const held = await engineResult('Compassion: partners help a classmate from another section understand the conditional program.');
  const official = r => ({ score: r.score, overall: r.overall, passed: r.passed, band: r.band, conformance: r.conformance, ready: r.hybrid.ready, deductions: r.hybrid.deductions, scoring: r.hybrid.scoring.official, policy: r.hybrid.policy });
  assert.deepEqual(official(held.result), official(good.result));
  assert.equal(held.requests, good.requests);
  assert.ok(good.result.hybrid.suggestions.some(s => s.path === 'plan[2].values'));
  assert.ok(!held.result.hybrid.suggestions.some(s => s.path === 'plan[2].values'));
  const unresolved = held.result.hybrid.unresolved.filter(u => u.path === 'plan[2].values');
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].reason, 'draft_needs_review');
  assert.deepEqual(unresolved[0].checks, ['adds_participant']);
  assert.equal(aiGate({}), 'advisory');
  assert.equal(held.result.hybrid.titlePolicy.comparison, 'exact');
  assert.equal(POLICY.version, 'syllabus-policy-2');
});
