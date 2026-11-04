'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { termOf, rangeOf } = require('./terms');

test('a moment falls in the term of its Philippine date', () => {
  assert.deepEqual(termOf('2026-10-22T06:00:00Z'), { schoolYear: '2026-2027', semester: '1st Semester' });
  assert.deepEqual(termOf('2027-02-10T06:00:00Z'), { schoolYear: '2026-2027', semester: '2nd Semester' });
  assert.deepEqual(termOf('2027-06-15T06:00:00Z'), { schoolYear: '2027-2028', semester: 'Summer' });
  // 31 May 20:00 UTC is already 1 June in Manila.
  assert.deepEqual(termOf('2027-05-31T20:00:00Z'), { schoolYear: '2027-2028', semester: 'Summer' });
});

test('the range of a term starts at midnight in Manila and ends where the next term starts', () => {
  const r = rangeOf('2026-2027', '1st Semester');
  assert.equal(r.from.toISOString(), '2026-07-31T16:00:00.000Z');
  assert.equal(r.to.toISOString(), '2026-12-31T16:00:00.000Z');
  assert.equal(rangeOf('2026-2027', '2nd Semester').from.toISOString(), r.to.toISOString());
});

test('an invalid term has no range', () => {
  assert.equal(rangeOf('2026-2028', '1st Semester'), null);
  assert.equal(rangeOf('2026-2027', 'Fall'), null);
  assert.equal(rangeOf(undefined, undefined), null);
});
