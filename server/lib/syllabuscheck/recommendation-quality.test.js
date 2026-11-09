// Recommendation consistency (2026-11-09): a lesson Policy V2 finds off-topic gets no rewrites that would keep its topic, and a draft never silently
// replaces the core value the faculty selected. Suggestions only: judgements, findings, deductions and the official score are unchanged. Scripted AI only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { withholdConflicts, offTopicLessons } = require('./offTopicLessons');
const harness = require('./vpaa-conformance/harness');
const engine = require('./engine');
const repo = require('./repository');
const service = require('../compliance/service');

const v2 = (records) => ({ academicV2: { academic: { relationships: records } } });
const rec = (row, label, extra = {}) => ({ id: `row${row}-content`, relationshipType: 'Content-course', academicJudgment: label, path: `plan[${row}].contents`, week: String(row + 1), explanation: 'x', ...extra });

test('a lesson Policy V2 finds off-topic keeps only its own Content-course recommendation; other weeks are untouched', () => {
  const hybrid = { ...v2([rec(3, 'NOT_ALIGNED'), rec(5, 'PARTIALLY_ALIGNED'), rec(1, 'ALIGNED')]), suggestions: [
    { id: 'SEM:row3-ilo0-content', path: 'plan[3].contents', basedOn: ['SEM:row3-ilo0-content'] },
    { id: 'SEM:row3-ilo0-activity', path: 'plan[3].activities', basedOn: ['SEM:row3-ilo0-activity'] },
    { id: 'SEM:row3-value', path: 'plan[3].values', basedOn: ['SEM:row3-value'] },
    { id: 'SEM:row3-ilo0-clo:c3', path: 'plan[3].ilos[0].text', basedOn: ['SEM:row3-ilo0-clo:c3'] },
    { id: 'review:row3-content', path: 'plan[3].contents', basedOn: ['row3-content'] },
    { id: 'SEM:row5-ilo0-activity', path: 'plan[5].activities', basedOn: ['SEM:row5-ilo0-activity'] },
    { id: 'SEM:clo0-po1', path: 'clos[0].statement', basedOn: ['SEM:clo0-po1'] },
  ] };
  const out = withholdConflicts(hybrid);
  assert.deepEqual(out.suggestions.map((s) => s.id), ['review:row3-content', 'SEM:row5-ilo0-activity', 'SEM:clo0-po1'], 'the topic rewrite, a partially aligned week and the CLOs stay');
  assert.deepEqual(out.suggestionsWithheld.map((w) => [w.id, w.reason, w.offTopicRelationship, w.week]), [
    ['SEM:row3-ilo0-content', 'off_topic_lesson', 'row3-content', '4'], ['SEM:row3-ilo0-activity', 'off_topic_lesson', 'row3-content', '4'],
    ['SEM:row3-value', 'off_topic_lesson', 'row3-content', '4'], ['SEM:row3-ilo0-clo:c3', 'off_topic_lesson', 'row3-content', '4']]);
  assert.equal(hybrid.suggestions.length, 7, 'the input is not mutated');
  assert.deepEqual(offTopicLessons(hybrid).map((l) => l.row), [3]);
});

test('no Policy V2 records, no off-topic week, or no suggestions: nothing changes', () => {
  assert.deepEqual(withholdConflicts({ suggestions: [{ id: 'a', path: 'plan[0].contents' }] }), {});
  assert.deepEqual(withholdConflicts({ ...v2([rec(0, 'PARTIALLY_ALIGNED')]), suggestions: [{ id: 'a', path: 'plan[0].contents' }] }), {});
  assert.deepEqual(withholdConflicts({ ...v2([rec(0, 'NOT_ALIGNED')]) }), {});
});

// ---- the faculty-selected core value (engine.js, scripted legacy answers) ----
const ENV = harness.envFor({ SYLLABUS_CHECK_ACADEMIC_V2: 'off' });
async function valueRun(drafts, labels = {}) {
  const s = harness.sample(), rows = s.content.plan.map((r, i) => [r, i]).filter(([r]) => r.kind !== 'exam').slice(0, 3).map(([, i]) => i);
  rows.forEach((i) => { s.content.plan[i].values = 'Core Value: Courage'; });
  const t = harness.scriptedTransport((pair) => {
    const k = rows.findIndex((i) => pair.id === `row${i}-value`);
    if (k < 0) return { label: 'ALIGNED' };
    return { label: labels[k] || 'PARTIALLY_ALIGNED', draft: drafts[k] };
  });
  const r = await engine.run(s.content, s.masters, { env: ENV, transport: t });
  return { r, rows };
}
const valueSuggestion = (r, row) => (r.hybrid.suggestions || []).find((x) => x.path === `plan[${row}].values`);

test('a values rewrite that keeps the selected value is offered; one that swaps it for another is held for review', async () => {
  const { r, rows } = await valueRun(['Core Value: Courage. Students attempt unfamiliar problems at the board and explain their reasoning.', 'Core Value: Humility. Students accept correction of their errors.', 'Students accept correction of their errors.']);
  assert.ok(valueSuggestion(r, rows[0]), 'kept value: offered');
  assert.equal(valueSuggestion(r, rows[1]), undefined, 'replaced value: not offered');
  assert.equal(valueSuggestion(r, rows[2]), undefined, 'a rewrite naming no value at all also drops the selected one: not offered');
  const held = (r.hybrid.alignment.judgements || []).filter((j) => (j.draftReview || []).includes('replaces_core_value')).map((j) => j.id);
  assert.deepEqual(held, [`row${rows[1]}-value`, `row${rows[2]}-value`]);
  const rowsOfVerdict = JSON.stringify(r.hybrid.verdict);
  assert.ok(rowsOfVerdict.includes('"withheld":"value_replaced"'), 'the verdict says why the rewrite is withheld');
  assert.ok(rowsOfVerdict.includes('Keep your selected value'), 'and recommends integrating the selected value');
});

test('an inappropriate value is still identified, and the scores do not depend on the drafts', async () => {
  const keep = await valueRun(['Core Value: Courage. a', 'Core Value: Courage. b', 'Core Value: Courage. c'], { 2: 'NOT_ALIGNED' });
  const swap = await valueRun(['Core Value: Courage. a', 'Core Value: Humility. b', 'Core Value: Compassion. c'], { 2: 'NOT_ALIGNED' });
  const notAligned = (r) => r.hybrid.alignment.judgements.find((j) => j.id === `row${keep.rows[2]}-value`);
  assert.equal(notAligned(swap.r).label, 'NOT_ALIGNED', 'the finding that the value does not fit the lesson stands');
  assert.ok((swap.r.findings || []).some((f) => f.id === `SEM:row${keep.rows[2]}-value`), 'and is listed as a finding');
  assert.deepEqual(swap.r.hybrid.deductions, keep.r.hybrid.deductions, 'same points whether or not a draft is offered');
  assert.deepEqual(swap.r.hybrid.scoring, keep.r.hybrid.scoring);
});

test('a lesson that names no core value yet can still be offered one', async () => {
  const s = harness.sample(), i = s.content.plan.findIndex((r) => r.kind !== 'exam');
  s.content.plan[i].values = '';
  const t = harness.scriptedTransport((pair) => (pair.id === `row${i}-value` ? { label: 'PARTIALLY_ALIGNED', draft: 'Core Value: Courage. Students attempt the problems first.' } : { label: 'ALIGNED' }));
  const r = await engine.run(s.content, s.masters, { env: ENV, transport: t });
  assert.ok(!(r.hybrid.alignment.judgements.find((j) => j.id === `row${i}-value`).draftReview || []).includes('replaces_core_value'));
});

// ---- through the service (Policy V2 on, scripted): off-topic week withheld, Policy V2 stays advisory, the official score is unchanged ----
test('end to end with Policy V2: the off-topic week loses its conflicting rewrites, the finding stays, and the official score equals the Policy V2-off score', async () => {
  const s = harness.sample(), row = s.content.plan.findIndex((r) => r.kind !== 'exam');
  const script = (pair) => {
    if (pair.type === 'Content-course' && pair.id === `row${row}-content`) return { label: 'NOT_ALIGNED', explanation: 'The week teaches spreadsheet formulas, which is not part of this course.', draft: '', recommendation: 'REVIEW_REQUIRED', correctionField: 'none', correctionReason: '' };
    if (new RegExp(`^row${row}-`).test(pair.id)) return { label: 'PARTIALLY_ALIGNED' };
    return { label: 'ALIGNED' };
  };
  const orig = repo.mastersFor; repo.mastersFor = async () => JSON.parse(JSON.stringify(s.masters));
  try {
    const on = await service.checkHybrid(null, JSON.parse(JSON.stringify(s.content)), { env: harness.envFor({ SYLLABUS_CHECK_ACADEMIC_V2: 'on', SYLLABUS_CHECK_AI_MAX_REQUESTS: '64' }), transport: harness.scriptedTransport(script) });
    const off = await service.checkHybrid(null, JSON.parse(JSON.stringify(s.content)), { env: harness.envFor({ SYLLABUS_CHECK_ACADEMIC_V2: 'off', SYLLABUS_CHECK_AI_MAX_REQUESTS: '64' }), transport: harness.scriptedTransport(script) });
    const finding = on.hybrid.academicV2.academic.relationships.find((r) => r.id === `row${row}-content`);
    assert.equal(finding.academicJudgment, 'NOT_ALIGNED', 'the off-topic finding is preserved');
    assert.ok(finding.explanation && finding.evidence, 'with its explanation and evidence');
    const onRow = (h) => (h.suggestions || []).filter((x) => new RegExp(`^plan\\[${row}\\]`).test(x.path) && !(x.basedOn || []).includes(`row${row}-content`));
    assert.ok(onRow(off.hybrid).length > 0, 'without Policy V2 the lesson has rewrites (nothing to compare against)');
    assert.equal(onRow(on.hybrid).length, 0, 'with Policy V2 the rewrites that keep the off-topic content are withheld');
    assert.ok((on.hybrid.suggestionsWithheld || []).every((w) => w.reason === 'off_topic_lesson' && w.offTopicRelationship === `row${row}-content`) && on.hybrid.suggestionsWithheld.length > 0, 'and recorded');
    const elsewhere = (h) => (h.suggestions || []).filter((x) => !new RegExp(`^plan\\[${row}\\]`).test(x.path)).map((x) => x.id).sort();
    assert.deepEqual(elsewhere(on.hybrid).filter((id) => elsewhere(off.hybrid).includes(id)), elsewhere(off.hybrid), 'every recommendation for other weeks is still offered');
    assert.deepEqual(on.hybrid.scoring.official, off.hybrid.scoring.official, 'Policy V2 is advisory: the official score is the same');
    assert.deepEqual(on.hybrid.deductions, off.hybrid.deductions);
  } finally { repo.mastersFor = orig; }
});
