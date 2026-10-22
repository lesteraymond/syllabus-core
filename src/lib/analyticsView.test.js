import test from 'node:test';
import assert from 'node:assert/strict';
import { bands, buildAnalytics, trend } from './analyticsView.js';

const row = (id, code, program, status, overall, areas = {}, at = '2026-10-20T01:00:00Z') => ({
  syllabusId: id, courseCode: code, programCode: program, status, checkable: true,
  run: overall === null ? null : { overall, createdAt: at, areas: Object.entries(areas).map(([key, score]) => ({ key, score })) },
});

test('bands split scores into High 80+, Medium 50-79, Low under 50 and add up to 100', () => {
  assert.deepEqual(bands([90, 85, 60, 20]), { high: 50, med: 25, low: 25 });
  assert.deepEqual(bands([]), { high: 0, med: 0, low: 0 });
});

test('a syllabus with no score is left out of the average, the bars and the bands', () => {
  const a = buildAnalytics([row(1, 'IT101', 'BSIT', 'approved', 90), row(2, 'IT102', 'BSIT', 'submitted', null), row(3, 'FM1', 'BSFM', 'approved', 70)]);
  assert.equal(a.average, 80);
  assert.equal(a.scoredCount, 2);
  assert.deepEqual(a.bars, [['BSIT', 90], ['BSFM', 70]]);
  assert.equal(a.insights.unchecked, 1);
});

test('a faculty member gets one bar per subject, and the weakest area is named', () => {
  const a = buildAnalytics([row(1, 'IT101', 'BSIT', 'approved', 90, { template: 95, co_po: 40 }), row(2, 'IT102', 'BSIT', 'for_revision', 60, { template: 85, co_po: 60 })], { isFaculty: true });
  assert.deepEqual(a.bars, [['IT101', 90], ['IT102', 60]]);
  assert.deepEqual(a.insights.lowest, ['CO–PO', 50]);
  assert.equal(a.insights.belowPass, 1);
  assert.equal(a.insights.returned, 1);
});

test('the trend is the last scored checks in date order', () => {
  const rows = [row(1, 'A', 'P', 'approved', 50, {}, '2026-10-22T01:00:00Z'), row(2, 'B', 'P', 'approved', 70, {}, '2026-10-20T01:00:00Z'), row(3, 'C', 'P', 'approved', null)];
  assert.deepEqual(trend(rows).map((p) => p.value), [70, 50]);
  assert.equal(trend(rows)[0].label, 'Oct 20');
});

test('with nothing checked there is no average and nothing to chart', () => {
  const a = buildAnalytics([]);
  assert.equal(a.average, null);
  assert.deepEqual(a.bars, []);
  assert.deepEqual(a.trend, []);
});
