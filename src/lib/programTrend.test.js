// Run: npm test. Program compliance over time (src/lib/programTrend.js): each program's share of subjects with an approved syllabus, week by week.
import test from 'node:test';
import assert from 'node:assert/strict';
import { programTrend, SERIES_COLORS } from './programTrend.js';

const NOW = new Date('2026-11-08T00:00:00.000Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 3600 * 1000).toISOString();
const programs = [{ code: 'BSIT', name: 'Information Technology' }, { code: 'BSCPE', name: 'Computer Engineering' }, { code: 'BSN', name: 'Nursing' }];
const subjects = [1, 2, 3, 4].map((id) => ({ id, program: 'BSIT' })).concat([{ id: 5, program: 'BSCPE' }, { id: 6, program: 'BSCPE' }]);

test('each program\'s line is its share of subjects approved by each week, ending today at the current share', () => {
  const approvals = [{ courseId: 1, approvedAt: daysAgo(20) }, { courseId: 2, approvedAt: daysAgo(3) }, { courseId: 5, approvedAt: daysAgo(10) }];
  const t = programTrend({ programs, subjects, approvals, now: NOW });
  assert.equal(t.dates.at(-1), NOW.toISOString(), 'the last point is today');
  assert.ok(t.dates.length >= 5, 'at least four weeks back, a point a week');
  const [cpe, it] = t.series;
  assert.deepEqual([cpe.program, cpe.slot, cpe.total, cpe.approved, cpe.percent], ['BSCPE', 0, 2, 1, 50]);
  assert.deepEqual([it.program, it.slot, it.total, it.approved, it.percent], ['BSIT', 1, 4, 2, 50]);
  assert.equal(it.points[0], 0, 'before the first approval: 0%');
  assert.equal(it.points.at(-1), 50, 'today: 2 of 4');
  assert.ok(it.points.every((v, i) => i === 0 || v >= it.points[i - 1]), 'an approval stays counted: the line never falls');
  assert.deepEqual(t.empty, [{ program: 'BSN', name: 'Nursing' }], 'a program with no subjects has no line');
});

test('no approvals yet: four weeks of 0%; a subject approved twice counts once, at its first approval', () => {
  const none = programTrend({ programs, subjects, approvals: [], now: NOW });
  assert.equal(none.dates.length, 5);
  assert.ok(none.series.every((s) => s.points.every((v) => v === 0)));
  const twice = programTrend({ programs, subjects, approvals: [{ courseId: 5, approvedAt: daysAgo(2) }, { courseId: 5, approvedAt: daysAgo(30) }], now: NOW });
  assert.equal(twice.series[0].points.filter((v) => v === 50).length >= 4, true, 'counted from 30 days ago');
});

test('the colours are the fixed eight of the reference palette, and each program keeps its slot by code order', () => {
  assert.equal(SERIES_COLORS.length, 8);
  const t = programTrend({ programs: [...programs].reverse(), subjects, approvals: [], now: NOW });
  assert.deepEqual(t.series.map((s) => [s.program, s.slot]), [['BSCPE', 0], ['BSIT', 1]], 'the order of the input does not repaint a program');
});

test('by day the line steps up on the day of each approval; by month it has a point at the end of each month and today', () => {
  const approvals = [{ courseId: 1, approvedAt: '2026-10-20T03:00:00.000Z' }, { courseId: 5, approvedAt: '2026-09-10T03:00:00.000Z' }];
  const day = programTrend({ programs, subjects, approvals, granularity: 'day', now: NOW });
  assert.equal(day.granularity, 'day');
  assert.ok(day.dates.length >= 59 && day.dates.length <= 61, 'one point a day since the day before the first approval: ' + day.dates.length);
  const it = day.series.find((s) => s.program === 'BSIT');
  const iOct20 = day.dates.findIndex((d) => d.startsWith('2026-10-20'));
  assert.equal(it.points[iOct20 - 1], 0); assert.equal(it.points[iOct20 + 1], 25, 'counted from the day after');
  const month = programTrend({ programs, subjects, approvals, granularity: 'month', now: NOW });
  assert.deepEqual(month.dates.map((d) => d.slice(0, 10)), ['2026-08-31', '2026-09-30', '2026-10-31', '2026-11-08'], 'month ends from before the first approval, then today');
  assert.deepEqual(month.series.find((s) => s.program === 'BSCPE').points, [0, 50, 50, 50]);
});

test('the overall line is all programs\' subjects together, with its change over the period and the programs fully compliant', () => {
  const approvals = [{ courseId: 5, approvedAt: daysAgo(10) }, { courseId: 6, approvedAt: daysAgo(5) }, { courseId: 1, approvedAt: daysAgo(2) }];
  const t = programTrend({ programs, subjects, approvals, now: NOW });
  assert.deepEqual([t.overall.total, t.overall.approved, t.overall.percent, t.overall.change, t.overall.complete], [6, 3, 50, 50, 1], 'BSCPE has all its subjects approved');
  assert.equal(programTrend({ programs, subjects, approvals, granularity: 'nonsense', now: NOW }).granularity, 'week');
});
