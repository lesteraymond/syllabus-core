import test from 'node:test';
import assert from 'node:assert/strict';
import { parseValue, formatValue, parseTime, timeValue, addMonths, addDays, monthGrid, isOutOfRange, clampDay, moveDay, todayPH, dateKey } from './datePickerModel.js';

test('reads and writes the strings a native date and datetime-local input use', () => {
  assert.deepEqual(parseValue('2026-10-16'), { y: 2026, m: 10, d: 16, hh: null, mm: null });
  assert.deepEqual(parseValue('2026-10-16T17:30'), { y: 2026, m: 10, d: 16, hh: 17, mm: 30 });
  assert.equal(formatValue({ y: 2026, m: 3, d: 5 }, null, false), '2026-03-05');
  assert.equal(formatValue({ y: 2026, m: 3, d: 5 }, { hh: 9, mm: 0 }, true), '2026-03-05T09:00');
});

test('a value that is not a real day or time gives null', () => {
  for (const bad of ['', null, undefined, 'x', '2026-02-30', '2026-13-01', '2026-10-16T25:00', '2026-10-16T10:75']) assert.equal(parseValue(bad), null, String(bad));
  assert.deepEqual(parseValue('2028-02-29'), { y: 2028, m: 2, d: 29, hh: null, mm: null }); // a leap day is real
});

test('time text', () => {
  assert.deepEqual(parseTime('08:05'), { hh: 8, mm: 5 });
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime(''), null);
  assert.equal(timeValue({ hh: 8, mm: 5 }), '08:05');
  assert.equal(timeValue({ hh: null, mm: null }), '');
});

test('moving by months keeps the day when it can and clamps it when it cannot', () => {
  assert.deepEqual(addMonths({ y: 2026, m: 1, d: 31 }, 1), { y: 2026, m: 2, d: 28 });
  assert.deepEqual(addMonths({ y: 2028, m: 1, d: 31 }, 1), { y: 2028, m: 2, d: 29 });
  assert.deepEqual(addMonths({ y: 2026, m: 12, d: 15 }, 1), { y: 2027, m: 1, d: 15 });
  assert.deepEqual(addMonths({ y: 2026, m: 1, d: 15 }, -1), { y: 2025, m: 12, d: 15 });
  assert.deepEqual(addDays({ y: 2026, m: 12, d: 31 }, 1), { y: 2027, m: 1, d: 1 });
});

test('a month is six Sunday-first weeks, with the days of the next and previous month marked outside', () => {
  const grid = monthGrid(2026, 10); // 1 Oct 2026 is a Thursday
  assert.equal(grid.length, 6);
  assert.ok(grid.every((week) => week.length === 7));
  assert.deepEqual(grid[0].map((c) => c.d), [27, 28, 29, 30, 1, 2, 3]);
  assert.deepEqual(grid[0].map((c) => c.outside), [true, true, true, true, false, false, false]);
  assert.equal(grid[5][6].key, '2026-11-07');
  assert.equal(grid.flat().filter((c) => !c.outside).length, 31);
});

test('min and max limit the days, and only the day part counts', () => {
  const day = { y: 2026, m: 10, d: 16 };
  assert.equal(isOutOfRange(day, '2026-10-17', ''), true);
  assert.equal(isOutOfRange(day, '2026-10-16T23:00', ''), false);
  assert.equal(isOutOfRange(day, '', '2026-10-15'), true);
  assert.equal(isOutOfRange(day, '', ''), false);
  assert.deepEqual(clampDay(day, '2026-11-01', ''), { y: 2026, m: 11, d: 1 });
  assert.deepEqual(clampDay(day, '', '2026-10-01'), { y: 2026, m: 10, d: 1 });
  assert.deepEqual(clampDay(day, '', ''), day);
});

test('arrow, Home, End and Page keys move the highlighted day', () => {
  const day = { y: 2026, m: 10, d: 16 }; // a Friday
  assert.equal(dateKey(moveDay(day, 'ArrowLeft')), '2026-10-15');
  assert.equal(dateKey(moveDay(day, 'ArrowDown')), '2026-10-23');
  assert.equal(dateKey(moveDay(day, 'ArrowUp')), '2026-10-09');
  assert.equal(dateKey(moveDay(day, 'Home')), '2026-10-11');
  assert.equal(dateKey(moveDay(day, 'End')), '2026-10-17');
  assert.equal(dateKey(moveDay(day, 'PageDown')), '2026-11-16');
  assert.equal(moveDay(day, 'a'), null);
});

test('today is the Philippine day, whatever the computer zone is', () => {
  assert.equal(dateKey(todayPH(new Date('2026-10-15T17:00:00Z'))), '2026-10-16'); // 01:00 in Manila
  assert.equal(dateKey(todayPH(new Date('2026-10-15T15:59:00Z'))), '2026-10-15'); // 23:59 in Manila
});
