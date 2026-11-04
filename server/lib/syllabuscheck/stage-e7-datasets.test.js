const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const d1 = require('./eval/stage-d1-dataset.json');
const d2 = require('./eval/stage-d2-dataset.json');
const nextD1 = require('./eval/stage-d1-followup-dataset.json');
const nextD2 = require('./eval/stage-d2-followup-dataset.json');
const { ASPECTS } = require('./gemini');
const { scoreEval } = require('./eval/metrics');
const { answerOf, summarizeReviews } = require('./eval/answerReviews');

test('E.7 D1 follow-up preserves every baseline text, label and field expectation', () => {
  assert.equal(d1.version, 'stage-d1-1');
  assert.equal(nextD1.version, 'stage-d1-2');
  assert.equal(nextD1.items.length, 29);
  assert.deepEqual(nextD1.items.slice(0, d1.items.length), d1.items);
  const added = nextD1.items.slice(d1.items.length);
  for (const course of ['prog1', 'syseng', 'sensors']) {
    const examples = added.filter(item => item.course === course);
    assert.deepEqual(examples.map(item => item.evidenceDistinction).sort(), ['demonstrated', 'insufficient-evidence', 'name-only', 'opportunity']);
    assert.equal(examples.find(item => item.evidenceDistinction === 'name-only').expectedAspects.valueUse, 'name_only');
    assert.equal(examples.find(item => item.evidenceDistinction === 'opportunity').expectedAspects.valueUse, 'opportunity');
    assert.equal(examples.find(item => item.evidenceDistinction === 'demonstrated').expectedAspects.valueUse, 'integrated');
    assert.equal(examples.find(item => item.evidenceDistinction === 'insufficient-evidence').expectedAspects.valueUse, 'insufficient');
    for (const item of examples.filter(item => item.evidenceDistinction !== 'demonstrated')) assert.ok(!item.accept.includes('ALIGNED'), item.id);
  }
});

test('E.7 D2 adds evidence-basis expectations without changing baseline labels or relevance', () => {
  assert.equal(d2.version, 'stage-d2-1');
  assert.equal(nextD2.version, 'stage-d2-2');
  assert.equal(nextD2.items.length, 13);
  for (const original of d2.items) {
    const current = structuredClone(nextD2.items.find(item => item.id === original.id));
    const basis = current.expectedAspects.basis;
    assert.ok(basis);
    delete current.expectedAspects.basis; delete current.expectationStatus;
    assert.deepEqual(current, original, original.id);
    const expected = original.id === 'rr-prog1-cannot-tell' ? 'insufficient' : original.id === 'rr-sensors-web' ? ['title_only', 'title_and_venue'] : 'title_only';
    assert.deepEqual(basis, expected);
  }
  assert.ok(nextD2.items.some(item => item.category === 'venue-support' && item.expectedAspects.basis === 'title_and_venue'));
  assert.ok(nextD2.items.some(item => item.category === 'venue-keyword-trap' && !item.accept.includes('ALIGNED')));
  assert.ok(nextD2.items.some(item => item.category === 'venue-web-publisher' && item.expectedAspects.basis === 'title_and_venue'));
});

test('all follow-up examples are unique, synthetic, unreviewed, and use valid provisional field values', () => {
  for (const dataset of [nextD1, nextD2]) {
    assert.equal(dataset.reviewStatus, 'unreviewed'); assert.match(dataset.status, /NOT faculty-reviewed/);
    assert.equal(new Set(dataset.items.map(item => item.id)).size, dataset.items.length);
    for (const item of dataset.items) {
      assert.equal(item.reviewStatus, 'unreviewed', item.id); assert.equal(item.facultyVerdict, null); assert.equal(item.facultyNotes, '');
      assert.ok(dataset.courses[item.course] && item.source && item.target && item.why, item.id);
      if (!item.excludeFromAgreement) assert.ok(item.accept.length, item.id);
      for (const [key, expected] of Object.entries(item.expectedAspects || {})) {
        const acceptable = Array.isArray(expected) ? expected : [expected];
        assert.ok(acceptable.every(value => ASPECTS[key].includes(value)), `${item.id}: ${key}`);
      }
    }
  }
});

test('the venue-only diagnostic is evaluated but cannot silently set a faculty or schema policy', () => {
  const pending = nextD2.items.filter(item => item.excludeFromAgreement);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, 'rr-syseng-venue-only');
  assert.equal(pending[0].expectationStatus, 'pending_faculty_decision');
  assert.deepEqual(pending[0].accept, []); assert.deepEqual(pending[0].expectedAspects, {});
  const run = new Map(nextD2.items.map(item => [item.id, item.accept[0] || 'NOT_ALIGNED']));
  const scored = scoreEval(nextD2.items, [run]);
  assert.equal(scored.datasetItems, 13); assert.equal(scored.scoredItems, 12);
  assert.equal(scored.items, 12); assert.equal(scored.answered, 12);
  assert.equal(scored.invalid, 0); assert.equal(scored.agreement, 1);
  assert.deepEqual(scored.excludedFromAgreement.map(item => item.id), ['rr-syseng-venue-only']);
  run.set(pending[0].id, 'ALIGNED');
  assert.deepEqual(scoreEval(nextD2.items, [run]), scored, 'a pending diagnostic never raises or lowers agreement');
  const stopped = scoreEval(nextD2.items, [run], { attempted: (index, id) => id === nextD2.items[0].id });
  assert.equal(stopped.answered, 1); assert.equal(stopped.notAttempted, 11);
  assert.equal(stopped.datasetItems, 13, 'dataset scope never claims unattempted diagnostics were evaluated');
  const old = scoreEval(d2.items, [new Map(d2.items.map(item => [item.id, item.accept[0]]))]);
  assert.equal(old.items, 9); assert.equal(old.agreement, 1);
  assert.ok(!Object.hasOwn(old, 'excludedFromAgreement'), 'existing metrics retain their shape');
});

test('evaluation keeps advisory evidence beside the original verified answer without changing it', () => {
  const evidence = { explanation: [{ code: 'venue_claim', evidence: 'technical press' }], draft: [{ code: 'copies_other_relationship', evidence: 'one two three four', from: 'sibling' }] };
  const original = { label: 'ALIGNED', explanation: 'The title is relevant.', sourceQuote: 'Sensors', targetQuote: 'Sensor circuits', aspects: { values: { relevance: 'relevant', basis: 'title_only' } }, explanationReview: ['venue_claim'], draftReview: ['copies_other_relationship'], reviewEvidence: evidence };
  const saved = structuredClone(original), recorded = answerOf(original);
  assert.deepEqual(original, saved);
  assert.deepEqual(recorded.reviewEvidence, evidence);
  assert.deepEqual(recorded.explanationReview, ['venue_claim']);
  assert.equal(recorded.label, 'ALIGNED'); assert.equal(recorded.draft, '');
  assert.deepEqual(recorded.aspects, original.aspects);
  assert.ok(!Object.hasOwn(answerOf({ label: 'ALIGNED' }), 'explanationReview'), 'old answer shape remains readable');
});

test('advisory reporting counts each code once per answer and distinguishes repeat runs', () => {
  const flagged = { explanationReview: ['venue_claim', 'venue_claim'], draftReview: ['adds_participant'], reviewEvidence: { explanation: [{ code: 'venue_claim', evidence: 'technical press' }] } };
  const summary = summarizeReviews([new Map([['flagged', flagged], ['clear', { label: 'ALIGNED' }]]), new Map([['flagged', flagged]])]);
  assert.deepEqual(summary.counts, { explanationReview: { venue_claim: 2 }, draftReview: { adds_participant: 2 }, draftWarnings: {} });
  assert.deepEqual(summary.flaggedAnswers.map(answer => [answer.run, answer.id]), [[1, 'flagged'], [2, 'flagged']]);
  assert.equal(summary.advisory, true); assert.match(summary.note, /not verified academic errors/);
  assert.deepEqual(summary.flaggedAnswers[0].reviewEvidence, flagged.reviewEvidence);
});

test('follow-up runner aliases plan offline with the existing stage switches and no provider call', () => {
  const root = path.resolve(__dirname, '../../..');
  const stagesOff = Object.fromEntries(['A', 'B', 'B3', 'B4', 'C1', 'C2', 'D1', 'D2'].map(stage => [`SYLLABUS_CHECK_STAGE_${stage}`, 'off']));
  for (const [name, version, items, stage] of [['stage-d1', 'stage-d1-1', 17, 'd1'], ['stage-d2', 'stage-d2-1', 9, 'd2'], ['stage-d1-followup', 'stage-d1-2', 29, 'd1'], ['stage-d2-followup', 'stage-d2-2', 13, 'd2']]) {
    const result = spawnSync(process.execPath, ['scripts/eval-alignment.cjs', '--plan', '--dataset', name, '--runs', '1'], { cwd: root, encoding: 'utf8', env: { ...process.env, ...stagesOff, SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_MODEL: 'minimax/minimax-m3.1-flash', OPENROUTER_API_KEY: '' } });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PLAN \(no provider call is made\)/);
    assert.ok(result.stdout.includes(`Dataset ${version} (${name}): ${items} items`), result.stdout);
    assert.ok(result.stdout.includes(`"${stage}":true`));
    if (name === 'stage-d2-followup') assert.match(result.stdout, /12 scored items; 1 diagnostic/);
  }
});
