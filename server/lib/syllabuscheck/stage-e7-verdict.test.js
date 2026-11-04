'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVerdict } = require('./verdict');
const { sample } = require('./fixtures');
const gemini = require('./gemini');
const repository = require('./repository');
const { valuePairs } = require('./values');

test.afterEach(() => gemini.resetProviderBlock());

const definitions = { status: 'not_supplied', definitions: {} };
const addEvidenceToWeekThree = content => {
  const lesson = content.plan[2];
  lesson.contents = 'Secure programming: validate user input and protect account credentials.';
  lesson.ilos[0].text = 'Explain how input validation prevents unauthorized access to user accounts.';
  lesson.activities = 'In pairs, compare two validation designs and respectfully discuss how each protects users.';
  lesson.tasks = 'Write a short justification comparing the privacy and security trade-offs.';
  lesson.values = 'Humility: acknowledge design limits, listen to peer feedback, and revise responsibly.';
  return content;
};
const moveWeekThree = content => {
  const moved = structuredClone(content);
  [moved.plan[2], moved.plan[3]] = [moved.plan[3], moved.plan[2]];
  return moved;
};
const valueUsePair = (content, index) => valuePairs(content, [index], definitions)[0];
const cacheKeyFor = (pair, content, env) => {
  const model = gemini.providerConfig(env).model;
  return gemini.pairKey(pair, 'gemini', model, gemini.promptVersionOf(model, env), gemini.courseKeyOf(gemini.courseOf(content)));
};
const savedJudgement = (pair, key) => ({
  id: pair.id, type: pair.type, path: pair.path, targetPath: pair.targetPath, key,
  label: 'PARTIALLY_ALIGNED', explanation: 'Earlier evidence-based explanation.', draft: 'Earlier faculty-review draft.',
  sourceQuote: pair.source.slice(0, 36), targetQuote: pair.target, sourceBloom: 'N/A', targetBloom: 'N/A',
  explanationReview: ['explanation_from_other_pair'], draftReview: ['copies_other_relationship'],
  reviewEvidence: {
    explanation: [{ code: 'explanation_from_other_pair', evidence: 'report every failing test case', from: 'old-sibling-removed' }],
    draft: [{ code: 'copies_other_relationship', evidence: 'listen carefully to another student', from: 'old-sibling-removed' }],
  },
});

const reportOf = judgement => ({ baseScore: 100, findings: [], hybrid: { codedChecks: [], alignment: { status: 'completed', judgements: [judgement] } } });
const decisionOf = v => ({ completeness: v.completeness, curriculum: v.curriculum, alignment: v.alignment, overall: v.overall, states: v.states, rubric: v.rubric, counts: v.counts, unverified: v.unverified, aspectCoverage: v.aspectCoverage });

test('E.7 reasoning warnings show a passed D1/D2 relationship once without changing any verdict aggregate', () => {
  const { content } = sample();
  for (const [type, values, code] of [
    ['Value-map', { coreValue: 'Humility', integration: 'demonstrated' }, 'explanation_from_other_pair'],
    ['Ref-relevance', { relevance: 'relevant', basis: 'title_and_venue' }, 'venue_claim'],
  ]) {
    const judgement = { id: 'academic-case', type, label: 'ALIGNED', path: 'plan[2].values', targetPath: 'plan[2].values', explanation: 'The quoted evidence supports the judgment.', draft: '', aspects: { values }, evidenceMatching: { source: 'exact', target: 'exact' } };
    const oldReport = reportOf(judgement), before = structuredClone(oldReport);
    const baseline = buildVerdict(oldReport, content, { all: true });
    const flagged = structuredClone(oldReport);
    Object.assign(flagged.hybrid.alignment.judgements[0], { explanationReview: [code, code], reviewEvidence: { explanation: [{ code, evidence: 'report every failing test case', from: 'another-relationship' }] } });
    const reviewed = buildVerdict(flagged, content, { all: true });
    assert.deepEqual(decisionOf(reviewed), decisionOf(baseline));
    const shown = reviewed.findings.filter(f => f.relationshipId === judgement.id);
    assert.equal(shown.length, 1);
    assert.equal(shown[0].status, 'PASS');
    assert.equal(shown[0].verification, 'quotes_verified');
    assert.deepEqual(shown[0].explanationReview, [code]);
    assert.equal(shown[0].reviewEvidence.explanation[0].from, 'another-relationship');
    assert.deepEqual(oldReport, before, 'building the verdict preserves the stored report');
    assert.ok(!baseline.all.some(f => 'reviewEvidence' in f || 'explanationReview' in f || 'draftReview' in f), 'legacy reports gain no review fields');
  }
});

test('E.7 draft warnings withhold the suggestion while preserving faculty text, judgment and counts', () => {
  const { content } = sample();
  const original = content.plan[2].values;
  const judgement = { id: 'value-case', type: 'Value-use', label: 'NOT_ALIGNED', path: 'plan[2].values', targetPath: 'plan[2].values', explanation: 'The named value is unrelated to this lesson.', draft: 'Share the program with a classmate from another section.', aspects: { values: { valueUse: 'unrelated', carriedBy: 'none', valueFit: 'clashes' } } };
  const baseline = buildVerdict(reportOf(judgement), content, { all: true });
  const flagged = reportOf({ ...judgement, draftReview: ['adds_participant'], reviewEvidence: { draft: [{ code: 'adds_participant', evidence: 'another section' }] } });
  const reviewed = buildVerdict(flagged, content, { all: true });
  assert.deepEqual(decisionOf(reviewed), decisionOf(baseline));
  const finding = reviewed.findings.find(f => f.relationshipId === judgement.id && f.ruleId === 'VAL-03');
  assert.equal(finding.withheld, 'draft_review');
  assert.equal(finding.recommendation, null);
  assert.equal(finding.recommendationType, 'REVIEW_REQUIRED');
  assert.equal(finding.actual, original);
  assert.ok(reviewed.all.filter(f => f.relationshipId === judgement.id).every(f => !f.recommendation));
  assert.equal(content.plan[2].values, original);
  assert.equal(flagged.hybrid.alignment.judgements[0].label, judgement.label);
  assert.equal(flagged.hybrid.alignment.judgements[0].draft, judgement.draft, 'the raw model draft remains diagnostic evidence');
});

test('E.7 direct cache-map reuse binds an unchanged instructional lesson relationship to its new identifier and path', async () => {
  const { content: sampleContent, masters } = sample();
  const content = addEvidenceToWeekThree(sampleContent);
  const env = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' };
  const original = valueUsePair(content, 2);
  const movedContent = moveWeekThree(content);
  const moved = valueUsePair(movedContent, 3);
  assert.equal(content.plan[2].kind, 'lesson');
  assert.equal(movedContent.plan[3].kind, 'lesson');
  assert.deepEqual([original.id, original.type, original.path], ['row2-valueuse', 'Value-use', 'plan[2].values']);
  assert.deepEqual([moved.id, moved.type, moved.path], ['row3-valueuse', 'Value-use', 'plan[3].values']);
  assert.match(moved.source, /^Week 3 course content: Secure programming:/);
  assert.match(moved.source, /Explain how input validation/);
  assert.match(moved.source, /respectfully discuss how each protects users/);
  assert.match(moved.source, /privacy and security trade-offs/);
  assert.match(moved.target, /listen to peer feedback/);
  assert.equal(moved.target, original.target);
  const key = cacheKeyFor(original, content, env);
  assert.equal(cacheKeyFor(moved, movedContent, env), key, 'the same evidence and course context retain the same cache key after moving');
  const modelName = gemini.providerConfig(env).model;
  assert.notEqual(gemini.pairKey(moved, 'gemini', modelName, gemini.promptVersionOf(modelName, env) + '-changed', gemini.courseKeyOf(gemini.courseOf(movedContent))), key,
    'a prompt-version change invalidates the old key');
  const earlier = savedJudgement(original, key);
  const snapshot = structuredClone(earlier);
  let calls = 0;
  const result = await gemini.align(movedContent, masters, { env, pairs: [moved], reuse: new Map([[key, earlier]]), transport: async () => { calls++; throw Error('a reused answer must not call the provider'); } });
  assert.equal(calls, 0);
  assert.deepEqual(result.reuse, { reused: 1, asked: 0, requests: 0 });
  const current = result.judgements[0];
  assert.equal(current.reused, true);
  assert.deepEqual([current.id, current.type, current.path, current.targetPath], [moved.id, moved.type, moved.path, moved.targetPath]);
  assert.equal(current.label, earlier.label);
  assert.deepEqual(current.explanationReview, earlier.explanationReview);
  assert.deepEqual(current.draftReview, earlier.draftReview);
  assert.deepEqual(current.reviewEvidence, earlier.reviewEvidence, 'source relationship IDs describe the original AI request, not current positions');
  assert.deepEqual(earlier, snapshot, 'reading a saved judgment does not rewrite it');
});

test('E.7 saved-report retrieval reuses verified evidence and notes; changed evidence is asked again', async () => {
  const { content: sampleContent, masters } = sample();
  const content = addEvidenceToWeekThree(sampleContent);
  const env = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' };
  const original = valueUsePair(content, 2);
  const movedContent = moveWeekThree(content);
  const moved = valueUsePair(movedContent, 3);
  const key = cacheKeyFor(original, content, env);
  const earlier = savedJudgement(original, key);
  let stored;
  const db = { query: async (sql, params = []) => {
    if (sql === 'INSERT INTO syllabus_check_reports (run_id, reference_hash, report_json) VALUES (?, ?, ?)') {
      stored = params[2];
      return [{ affectedRows: 1 }];
    }
    if (sql === 'SELECT p.report_json FROM syllabus_check_reports p JOIN ai_check_runs r ON r.run_id = p.run_id WHERE r.syllabus_id = ? ORDER BY r.run_id DESC LIMIT ?') {
      assert.deepEqual(params, [77, 3]);
      return [[{ report_json: stored }]];
    }
    throw new Error('unexpected cache repository query: ' + sql);
  } };
  await repository.saveReport(db, 145, { hybrid: { alignment: { judgements: [earlier] } } }, 'fixture-reference-hash');
  const saved = await repository.reusableJudgements(db, 77);
  assert.equal(saved.size, 1, 'the actual saved-report reader returned one verified keyed judgment');
  assert.deepEqual(saved.get(key).reviewEvidence, earlier.reviewEvidence, 'report serialization preserved review evidence');
  assert.deepEqual(saved.get(key).explanationReview, earlier.explanationReview);
  assert.deepEqual(saved.get(key).draftReview, earlier.draftReview);

  let reuseCalls = 0;
  const reused = await gemini.align(movedContent, masters, { env, pairs: [moved], reuse: saved, transport: async () => { reuseCalls++; throw Error('saved evidence should satisfy this unchanged pair'); } });
  assert.equal(reuseCalls, 0);
  assert.equal(reused.reuse.reused, 1);
  assert.deepEqual([reused.judgements[0].id, reused.judgements[0].path], [moved.id, moved.path]);
  assert.deepEqual(reused.judgements[0].reviewEvidence, earlier.reviewEvidence);

  const changedContent = structuredClone(movedContent);
  changedContent.plan[3].activities = 'Students independently compare two alternative solutions and explain their choices.';
  const changed = valueUsePair(changedContent, 3);
  assert.notEqual(cacheKeyFor(changed, changedContent, env), key, 'changed lesson evidence produces a different key');
  let offlineCalls = 0;
  const stale = await gemini.align(changedContent, masters, { env, pairs: [changed], reuse: saved, transport: async () => { offlineCalls++; throw Error('offline fixture: provider unavailable'); } });
  assert.ok(offlineCalls > 0, 'changed evidence reaches only the injected offline transport');
  assert.equal(stale.reuse.reused, 0);
  assert.equal(stale.reuse.asked, 1);
  assert.notEqual(stale.judgements[0].reused, true);
});
