// Run: npm test. Dates and times are Philippine time (UTC+8), whatever time zone the computer running this test is in.
import test from 'node:test';
import assert from 'node:assert';
import { toDate, phDate, phTime, phDateTime, phCompact, phDayStart, phHour, dayPeriod } from './phTime.js';

test('an instant is shown in Manila time: 12:18 UTC is 8:18 PM the same day, 17:00 UTC is 1:00 AM the next', () => {
  assert.strictEqual(phTime('2026-10-14T12:18:04.000Z'), '8:18 PM');
  assert.strictEqual(phDateTime('2026-10-14T12:18:04.000Z'), 'Oct 14, 2026, 8:18 PM');
  assert.strictEqual(phDate('2026-10-14T17:00:00.000Z'), 'Oct 15, 2026'); // past midnight in Manila
  assert.strictEqual(phTime('2026-10-14T17:00:00.000Z'), '1:00 AM');
  assert.strictEqual(phTime('2026-10-14T16:00:00.000Z'), '12:00 AM');
  assert.strictEqual(phTime('2026-10-14T04:00:00.000Z'), '12:00 PM');
});

test('a time with an offset is converted, and a Date object works the same as its string', () => {
  assert.strictEqual(phDateTime('2026-10-14T20:18:04+08:00'), 'Oct 14, 2026, 8:18 PM');
  assert.strictEqual(phDateTime('2026-10-14T00:18:04-08:00'), 'Oct 14, 2026, 4:18 PM');
  assert.strictEqual(phDateTime(new Date('2026-10-14T12:18:04.000Z')), 'Oct 14, 2026, 8:18 PM');
});

test('a MySQL time with no zone is the database clock, which is Philippine time: it is not shifted', () => {
  assert.strictEqual(phDateTime('2026-01-05 15:42:00'), 'Jan 5, 2026, 3:42 PM');
  assert.strictEqual(phDateTime('2026-01-05T15:42:00'), 'Jan 5, 2026, 3:42 PM');
  assert.strictEqual(phTime('2026-01-05 00:05:00'), '12:05 AM');
});

test('the compact form used in lists and notifications', () => {
  assert.strictEqual(phCompact('2026-10-14T12:18:04.000Z'), '14 Oct 2026 · 8:18 PM');
  assert.strictEqual(phCompact('2026-10-14T03:05:00.000Z'), '14 Oct 2026 · 11:05 AM');
  assert.strictEqual(phCompact(null), '');
});

test('anything unreadable shows nothing instead of "Invalid Date"', () => {
  for (const v of [null, undefined, '', 'not a date', '2026-13-45']) {
    assert.strictEqual(phDate(v), ''); assert.strictEqual(phTime(v), ''); assert.strictEqual(phDateTime(v), ''); assert.strictEqual(toDate(v), null);
  }
});

test('a Philippine day starts at 16:00 UTC the day before, and the day after is 24 hours later', () => {
  assert.strictEqual(phDayStart('2026-03-02').toISOString(), '2026-03-01T16:00:00.000Z');
  assert.strictEqual(phDayStart('2026-03-02', 1).toISOString(), '2026-03-02T16:00:00.000Z');
  assert.strictEqual(phDayStart('2026-02-28', 1).toISOString(), '2026-02-28T16:00:00.000Z'); // crosses into March
  assert.strictEqual(phDayStart('2026-02-31'), null);
  assert.strictEqual(phDayStart('abc'), null);
  assert.strictEqual(phDate(phDayStart('2026-03-02')), 'Mar 2, 2026'); // and it reads as that day in Manila
  assert.strictEqual(phTime(phDayStart('2026-03-02')), '12:00 AM');
});

test('the greeting follows Manila time, not the computer clock: the boundaries are 5:00, 12:00 and 18:00 in Manila', () => {
  const at = (hhmm) => new Date('2026-10-14T' + hhmm + ':00+08:00');
  assert.strictEqual(dayPeriod(at('04:59')), 'evening');
  assert.strictEqual(dayPeriod(at('05:00')), 'morning');
  assert.strictEqual(dayPeriod(at('11:59')), 'morning');
  assert.strictEqual(dayPeriod(at('12:00')), 'afternoon');
  assert.strictEqual(dayPeriod(at('17:59')), 'afternoon');
  assert.strictEqual(dayPeriod(at('18:00')), 'evening');
  assert.strictEqual(dayPeriod(at('00:00')), 'evening');
  assert.strictEqual(phHour(at('00:30')), 0);
  assert.strictEqual(dayPeriod(new Date('2026-10-14T21:00:00Z')), 'morning'); // 9 PM UTC is 5 AM the next day in Manila
});
