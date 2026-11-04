'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVerdict } = require('./verdict');
const { sample } = require('./fixtures');

const reportOf = judgement => ({ baseScore: 100, findings: [], hybrid: { codedChecks: [], alignment: { status: 'completed', judgements: [judgement] } } });
const decisionOf = v => ({ completeness: v.completeness, curriculum: v.curriculum, alignment: v.alignment, overall: v.overall, states: v.states, rubric: v.rubric, counts: v.counts, unverified: v.unverified, aspectCoverage: v.aspectCoverage });
const lessonAnswer = overrides => ({ id: 'academic-case', type: 'Activity-fit', label: 'NOT_ALIGNED', path: 'plan[2].activities', targetPath: 'plan[2].activities', explanation: 'The existing activity does not practise the stated competency.', draft: 'Discuss the worked example and explain each decision.', aspects: { values: { teaching: 'weak', learnerSupport: 'adequate' } }, ...overrides });

test('E.8 an advisory draft warning preserves the eligible proposal and every verdict aggregate', () => {
  const { content } = sample();
  const original = content.plan[2].activities;
  const answer = lessonAnswer();
  const baseline = buildVerdict(reportOf(answer), content, { all: true });
  const warnedReport = reportOf({ ...answer, draftWarnings: ['borrowed_wording', 'borrowed_wording'], reviewEvidence: { draftWarnings: [{ code: 'borrowed_wording', evidence: 'explain each decision', from: 'sibling' }] } });
  const before = structuredClone(warnedReport);
  const warned = buildVerdict(warnedReport, content, { all: true });
  assert.deepEqual(decisionOf(warned), decisionOf(baseline));
  const base = warned.findings.filter(f => f.relationshipId === answer.id && f.ruleId === 'ALN-05');
  assert.equal(base.length, 1);
  assert.equal(base[0].status, 'FAIL');
  assert.equal(base[0].withheld, null);
  assert.equal(base[0].recommendation, answer.draft);
  assert.equal(base[0].recommendationType, 'REWRITE_TEXT');
  assert.deepEqual(base[0].draftWarnings, ['borrowed_wording']);
  assert.deepEqual(base[0].reviewEvidence.draftWarnings, [{ code: 'borrowed_wording', evidence: 'explain each decision', from: 'sibling' }]);
  assert.equal(warned.all.filter(f => f.draftWarnings?.length).length, 1, 'quality metadata is attached once to the base finding');
  assert.deepEqual(warnedReport, before, 'reading a judgment does not mutate the saved answer');
  assert.equal(content.plan[2].activities, original);
});

test('E.8 a conditional resource caution does not fail or hide a passing academic judgment', () => {
  const { content } = sample();
  const answer = lessonAnswer({ label: 'ALIGNED', draft: '', aspects: { values: { teaching: 'sound', learnerSupport: 'adequate' } } });
  const baseline = buildVerdict(reportOf(answer), content, { all: true });
  const warned = buildVerdict(reportOf({ ...answer, draftWarnings: ['conditional_resource'], reviewEvidence: { draftWarnings: [{ code: 'conditional_resource', evidence: 'if equipment is available' }] } }), content, { all: true });
  assert.deepEqual(decisionOf(warned), decisionOf(baseline));
  const base = warned.findings.find(f => f.relationshipId === answer.id && f.ruleId === 'ALN-05');
  assert.equal(base.status, 'PASS');
  assert.equal(base.recommendationType, 'NO_CHANGE');
  assert.equal(base.withheld, null);
  assert.deepEqual(base.draftWarnings, ['conditional_resource']);
});

test('E.8 unsupported-resource and competency warnings withhold only the proposed correction', () => {
  const { content } = sample();
  for (const code of ['assumes_resource', 'unnecessary_practical', 'expands_competency']) {
    const answer = lessonAnswer({ draft: 'Use laboratory equipment to implement a complete program.' });
    const baseline = buildVerdict(reportOf(answer), content, { all: true });
    const reviewed = buildVerdict(reportOf({ ...answer, draftReview: [code], reviewEvidence: { draft: [{ code, evidence: 'laboratory equipment' }] } }), content, { all: true });
    assert.deepEqual(decisionOf(reviewed), decisionOf(baseline), code);
    const finding = reviewed.findings.find(f => f.relationshipId === answer.id && f.ruleId === 'ALN-05');
    assert.equal(finding.status, 'FAIL');
    assert.equal(finding.withheld, 'draft_review');
    assert.equal(finding.recommendation, null);
    assert.equal(finding.recommendationType, 'REVIEW_REQUIRED');
    assert.deepEqual(finding.draftReview, [code]);
  }
});

test('E.8 reports saved before draft cautions retain their existing withholding semantics and shape', () => {
  const { content } = sample();
  const old = reportOf(lessonAnswer({ draftReview: ['copies_other_relationship'], reviewEvidence: { draft: [{ code: 'copies_other_relationship', evidence: 'earlier phrase', from: 'historical-sibling' }] } }));
  const before = structuredClone(old);
  const verdict = buildVerdict(old, content, { all: true });
  const finding = verdict.findings.find(f => f.ruleId === 'ALN-05');
  assert.equal(finding.withheld, 'draft_review');
  assert.equal(finding.recommendation, null);
  assert.ok(!Object.hasOwn(finding, 'draftWarnings'));
  assert.ok(!Object.hasOwn(finding.reviewEvidence, 'draftWarnings'));
  assert.deepEqual(old, before);
});
