import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, barLayout, dayOf, weekdayLabel } from './timeUsage.js';

test('durations read as hours and minutes', () => {
  assert.equal(formatDuration(0), '0m');
  assert.equal(formatDuration(20), '<1m');
  assert.equal(formatDuration(60), '1m');
  assert.equal(formatDuration(45 * 60), '45m');
  assert.equal(formatDuration(3600), '1h');
  assert.equal(formatDuration(2 * 3600 + 14 * 60 + 40), '2h 14m');
});

test('bad values are shown as zero instead of NaN', () => {
  assert.equal(formatDuration(undefined), '0m');
  assert.equal(formatDuration(-50), '0m');
  assert.equal(formatDuration('abc'), '0m');
});

test('a date string keeps its own calendar day whatever the time zone', () => {
  const d = dayOf('2026-10-14');
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 9, 14]);
  assert.equal(weekdayLabel('2026-10-14', 'en'), 'Wed');
});

const days = [
  { date: '2026-10-08', seconds: 0 }, { date: '2026-10-09', seconds: 3600 }, { date: '2026-10-10', seconds: 1800 },
  { date: '2026-10-11', seconds: 0 }, { date: '2026-10-12', seconds: 7200 }, { date: '2026-10-13', seconds: 600 }, { date: '2026-10-14', seconds: 5400 },
];

test('the tallest day fills the chart and the others are in proportion', () => {
  const bars = barLayout(days, { height: 100, today: '2026-10-14' });
  assert.equal(bars.length, 7);
  assert.equal(bars[4].height, 100);                 // 2h is the peak
  assert.equal(bars[1].height, 50);                  // 1h is half of it
  assert.equal(bars[6].isToday, true);
  assert.equal(bars.filter((b) => b.isToday).length, 1);
});

test('a day with no time still has a thin stub, flagged empty', () => {
  const bars = barLayout(days, { height: 100, stub: 2 });
  assert.equal(bars[0].height, 2);
  assert.equal(bars[0].empty, true);
  assert.equal(bars[0].y, 98);
});

test('a little time does not look like a full day: the scale has a floor', () => {
  const bars = barLayout([{ date: 'a', seconds: 300 }], { height: 100, floor: 900 });
  assert.equal(bars[0].height, 33);
});

test('the bars fit the width with the gaps between them, and an empty list is fine', () => {
  const bars = barLayout(days, { width: 280, gap: 6 });
  const last = bars[bars.length - 1];
  assert.ok(Math.abs(last.x + last.width - 280) < 0.1);
  assert.deepEqual(barLayout([]), []);
});
