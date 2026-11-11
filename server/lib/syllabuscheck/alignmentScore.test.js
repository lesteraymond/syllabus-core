const test = require('node:test');
const assert = require('node:assert/strict');
const { alignmentScoreOf, WEIGHTS } = require('./alignmentScore');
const { loadManifest, variant } = require('./eval/phase3/fixtures');
const { runWithOracle } = require('./eval/phase3/oracle');

// AI Alignment Score (alignmentScore.js): a shadow score by OBE area. Built from scripted verdicts only; no provider is asked.
const j = (id, type, label, extra = {}) => ({ id, type, label, ...extra });
const A = 'ALIGNED', P = 'PARTIALLY_ALIGNED', N = 'NOT_ALIGNED';

test('the five areas carry the proposed weights and add up to 100', () => {
  assert.deepEqual(WEIGHTS, { program: 25, lesson: 25, activities: 20, assessment: 20, values: 10 });
  assert.equal(Object.values(WEIGHTS).reduce((s, w) => s + w, 0), 100);
});

test('credit: aligned 1, partial 0.5, not aligned 0; every area full gives 100 and Excellent', () => {
  const all = [j('clo0-po1', 'CLO-PO', A), j('clo0-ega1', 'CLO-EGA', A), j('row1-content', 'Content-course', A), j('row1-ilo0-clo:c1', 'ILO-CLO', A),
    j('row1-ilo0-activity', 'ILO-activity', A), j('row1-ilo0-assessment', 'ILO-assessment', A), j('row1-value', 'Module-value', A)];
  const r = alignmentScoreOf(all);
  assert.equal(r.score, 100); assert.equal(r.band, 'Excellent'); assert.equal(r.status, 'shadow'); assert.equal(r.official, false);
  const half = alignmentScoreOf(all.map(x => ({ ...x, label: P })));
  assert.equal(half.score, 50); assert.equal(half.band, 'Needs work');
  assert.equal(alignmentScoreOf(all.map(x => ({ ...x, label: N }))).score, 0);
});

test('a field counts once: a CLO with three POs earns its PO credit from its best PO (one is enough), not three deductions', () => {
  const base = [j('clo0-ega1', 'CLO-EGA', A)];
  const r = alignmentScoreOf([...base, j('clo0-po1', 'CLO-PO', N), j('clo0-po2', 'CLO-PO', N), j('clo0-po3', 'CLO-PO', A)]);
  assert.equal(r.areas.program.items, 1, 'one CLO, one item');
  assert.equal(r.areas.program.points, 25);
  // An ILO tagged to two CLOs: the one it builds is enough.
  const ilo = alignmentScoreOf([j('row1-ilo0-clo:c1', 'ILO-CLO', N), j('row1-ilo0-clo:c2', 'ILO-CLO', A)]);
  assert.equal(ilo.areas.lesson.points, 25);
  // Several ILOs of one week against the same activity are averaged, not maxed.
  const act = alignmentScoreOf([j('row1-ilo0-activity', 'ILO-activity', A), j('row1-ilo1-activity', 'ILO-activity', N)]);
  assert.equal(act.areas.activities.percent, 50);
});

test('unchecked verdicts earn and cost nothing: they lower coverage, and low coverage or an unfinished check is provisional with no band', () => {
  const r = alignmentScoreOf([j('row1-ilo0-activity', 'ILO-activity', A), j('row2-ilo0-activity', 'ILO-activity', 'INSUFFICIENT_EVIDENCE'), j('row3-ilo0-activity', 'ILO-activity', A, { unverified: true })]);
  assert.equal(r.areas.activities.percent, 100, 'the unchecked answers are not failures');
  assert.deepEqual(r.coverage, { checked: 1, counted: 3, percent: 33 });
  assert.equal(r.status, 'provisional'); assert.equal(r.band, null);
  const unfinished = alignmentScoreOf([j('row1-ilo0-activity', 'ILO-activity', A)], { completed: false });
  assert.equal(unfinished.status, 'provisional');
  assert.equal(alignmentScoreOf([]).status, 'not_available');
});

test('an area the check did not reach is left out and the rest is scaled to 100, and said so', () => {
  const r = alignmentScoreOf([j('clo0-po1', 'CLO-PO', A), j('clo0-ega1', 'CLO-EGA', P)]);
  assert.deepEqual(r.areasLeftOut, ['lesson', 'activities', 'assessment', 'values']);
  assert.equal(r.score, 75, 'program 18.75/25 scaled to 100');
});

test('Week 1, Week 2, description, sequence and references are a separate checklist (worst answer stands), not part of the score', () => {
  const r = alignmentScoreOf([j('clo0-po1', 'CLO-PO', A), j('row0-week1introduction', 'Week1-introduction', A), j('row1-week2firsttopic', 'Week2-topic', N),
    j('ref0', 'Ref-relevance', A), j('ref1', 'Ref-relevance', P), j('description-plan', 'Description-plan', A, { unverified: true })]);
  assert.deepEqual(r.checklist, { week1: A, week2: N, references: P, descriptionPlan: 'NOT_CHECKED' });
  assert.equal(r.score, 100, 'the checklist does not move the score');
});

test('in a real check: the planted-mistake syllabus scores below the aligned one, by area, and the official score is untouched', async () => {
  const m = loadManifest(), out = {};
  for (const v of ['aligned', 'misaligned']) {
    const s = variant('bsit', v, m), { result } = await runWithOracle(s, { variantSpec: m.variants[`bsit-${v}`] });
    out[v] = result;
    assert.equal(result.hybrid.alignmentScore.official, false);
  }
  assert.equal(out.aligned.hybrid.alignmentScore.score, 100);
  assert.ok(out.misaligned.hybrid.alignmentScore.score < 100);
  for (const area of ['lesson', 'activities', 'assessment', 'values']) assert.ok(out.misaligned.hybrid.alignmentScore.areas[area].percent < 100, area + ' shows its planted mistakes');
  // The official score is computed exactly as before: the shadow score is never used in its place.
  for (const r of Object.values(out)) assert.equal(r.score, r.hybrid.critical ? 0 : r.hybrid.ready ? r.hybrid.scoring.official.score : null, 'official = rule score minus the official deductions');
  assert.notEqual(out.misaligned.score, out.misaligned.hybrid.alignmentScore.score);
});

// ---- serious problems cap the band (owner's choice, 2026-11-11): the score stays proportional ----
const strongSyllabus = () => {
  const out = [];
  for (let c = 0; c < 4; c++) out.push(j(`clo${c}-po1`, 'CLO-PO', A), j(`clo${c}-ega1`, 'CLO-EGA', A), j(`clo${c}-anypo`, 'CLO-anyPO', A), j(`clo${c}-anyega`, 'CLO-anyEGA', A));
  for (let r = 1; r <= 10; r++) out.push(j(`row${r}-content`, 'Content-course', A), j(`row${r}-ilo0-clo:c1`, 'ILO-CLO', A), j(`row${r}-ilo0-activity`, 'ILO-activity', A),
    j(`row${r}-ilo0-assessment`, 'ILO-assessment', A), j(`row${r}-contentassessment`, 'Content-assessment', A), j(`row${r}-value`, 'Module-value', A));
  return out;
};
const content = { plan: Array.from({ length: 11 }, (_, i) => ({ week: String(i + 1) })) };
const withOne = (id, label = N) => strongSyllabus().map(x => (x.id === id ? { ...x, label } : x));

test('each serious problem caps the band at Needs work, names where it is, and leaves the score itself unchanged', () => {
  const cases = [['row3-content', 'content_off_subject', { week: '4' }], ['row3-ilo0-clo:c1', 'ilo_unrelated', { week: '4', ilo: 1 }],
    ['row3-ilo0-assessment', 'task_unrelated', { week: '4' }], ['row3-contentassessment', 'task_unrelated', { week: '4' }],
    ['clo2-anypo', 'clo_no_po', { clo: 3 }], ['clo2-anyega', 'clo_no_ega', { clo: 3 }]];
  for (const [id, kind, where] of cases) {
    const r = alignmentScoreOf(withOne(id), { content });
    assert.ok(r.score >= 90, `${kind}: the proportional score stays high (${r.score})`);
    assert.equal(r.band, 'Needs work', kind);
    assert.equal(r.bandCapped, true); assert.equal(r.uncappedBand, 'Excellent');
    assert.deepEqual(r.seriousProblems.map(p => p.kind), [kind]);
    for (const [key, value] of Object.entries(where)) assert.equal(r.seriousProblems[0][key], value, `${kind} names ${key}`);
  }
});

test('not serious: a partial verdict, an ILO that builds at least one of its CLOs, or a NOT_ALIGNED the AI could not verify', () => {
  assert.equal(alignmentScoreOf(withOne('row3-content', P), { content }).bandCapped, undefined, 'partly off-subject is not serious');
  const twoTags = [...withOne('row3-ilo0-clo:c1'), j('row3-ilo0-clo:c2', 'ILO-CLO', A)];
  assert.deepEqual(alignmentScoreOf(twoTags, { content }).seriousProblems, [], 'one CLO it builds is enough');
  const unverified = strongSyllabus().map(x => (x.id === 'row3-content' ? { ...x, label: N, unverified: true } : x));
  assert.deepEqual(alignmentScoreOf(unverified, { content }).seriousProblems, []);
  const clean = alignmentScoreOf(strongSyllabus(), { content });
  assert.equal(clean.band, 'Excellent'); assert.equal(clean.bandCapped, undefined); assert.deepEqual(clean.seriousProblems, []);
});

test('a provisional score has no band to cap, but still lists its serious problems', () => {
  const r = alignmentScoreOf(withOne('row3-content'), { content, completed: false });
  assert.equal(r.status, 'provisional'); assert.equal(r.band, null); assert.equal(r.bandCapped, undefined);
  assert.equal(r.seriousProblems.length, 1);
});

test('in a real check: the planted-mistake syllabus is capped at Needs work, with its off-subject week and unrelated tasks listed', async () => {
  const m = loadManifest(), s = variant('bsit', 'misaligned', m), { result } = await runWithOracle(s, { variantSpec: m.variants['bsit-misaligned'] });
  const a = result.hybrid.alignmentScore;
  assert.equal(a.band, 'Needs work'); assert.equal(a.bandCapped, true);
  const kinds = new Set(a.seriousProblems.map(p => p.kind));
  for (const kind of ['content_off_subject', 'ilo_unrelated', 'task_unrelated']) assert.ok(kinds.has(kind), kind);
  assert.ok(a.seriousProblems.every(p => p.week || p.clo), 'every problem says where it is');
  const clean = (await runWithOracle(variant('bsit', 'aligned', m), { variantSpec: m.variants['bsit-aligned'] })).result.hybrid.alignmentScore;
  assert.equal(clean.band, 'Excellent'); assert.deepEqual(clean.seriousProblems, []);
});
