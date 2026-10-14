// Run: npm test. The dashboard's Recent Activity as sentences, grouped by Philippine day.
import test from 'node:test';
import assert from 'node:assert';
import { describeActivity, dayLabel, groupByDay, KINDS } from './activityView.js';

const log = (over = {}) => ({ id: 1, action: 'approve', user: 'Diana Evale', courseCode: 'FM 202', title: 'Fundamentals of Mathematics', actionDate: '2026-10-14T13:16:43.000Z', ...over });
const NOW = new Date('2026-10-14T14:00:00.000Z'); // 10:00 PM on Oct 14 in Manila

test('a log row reads as a sentence: who, what, which syllabus, with the course title beneath', () => {
  const a = describeActivity(log());
  assert.deepStrictEqual([a.who, a.verb, a.subject, a.detail, a.time], ['Diana Evale', 'approved', 'FM 202', 'Fundamentals of Mathematics', '9:16 PM']);
  assert.deepStrictEqual([a.icon, a.tone], ['sealCheck', 'good']);
  assert.strictEqual(a.iso, '2026-10-14T13:16:43.000Z');
});

test('decisions carry a color and routine events stay quiet, each with its own icon', () => {
  const tone = (action) => describeActivity(log({ action })).tone;
  assert.deepStrictEqual(['approve', 'revision', 'reject'].map(tone), ['good', 'warn', 'bad']);
  assert.deepStrictEqual(['submit', 'upload'].map(tone), ['info', 'info']);
  assert.deepStrictEqual(['update', 'delete'].map(tone), ['quiet', 'quiet']);
  assert.strictEqual(new Set(Object.values(KINDS).map((k) => k.icon)).size, Object.keys(KINDS).length); // no two actions share an icon
  assert.strictEqual(describeActivity(log({ action: 'revision' })).verb, 'returned for revision');
});

test('missing pieces still read well: no name, no course code, an action nobody has heard of, a bad date', () => {
  const a = describeActivity(log({ user: '', courseCode: '', action: 'something-new', actionDate: 'nope' }));
  assert.deepStrictEqual([a.who, a.verb, a.subject, a.detail, a.time, a.iso], ['Someone', 'made a change to', 'Fundamentals of Mathematics', '', '', '']);
  assert.strictEqual(describeActivity({}).subject, 'a syllabus');
  assert.strictEqual(describeActivity(null, 3).key, 'row-3');
});

test('the day is Today or Yesterday by the Philippine calendar, else the date', () => {
  assert.strictEqual(dayLabel('2026-10-14T13:16:43.000Z', NOW), 'Today');
  assert.strictEqual(dayLabel('2026-10-13T03:44:26.000Z', NOW), 'Yesterday');
  assert.strictEqual(dayLabel('2026-10-12T03:00:00.000Z', NOW), 'Oct 12, 2026');
  assert.strictEqual(dayLabel('', NOW), '');
  // 17:00 UTC is already past midnight in Manila: the next day
  assert.strictEqual(dayLabel('2026-10-14T17:00:00.000Z', new Date('2026-10-15T01:00:00.000Z')), 'Today');
});

test('rows are gathered under their day, in the order given', () => {
  const rows = [log({ id: 1 }), log({ id: 2, actionDate: '2026-10-14T05:00:00.000Z' }), log({ id: 3, actionDate: '2026-10-13T08:00:00.000Z' }), log({ id: 4, actionDate: '2026-10-09T08:00:00.000Z' })].map(describeActivity);
  const g = groupByDay(rows, NOW);
  assert.deepStrictEqual(g.map((x) => [x.label, x.items.length]), [['Today', 2], ['Yesterday', 1], ['Oct 9, 2026', 1]]);
  assert.deepStrictEqual(groupByDay([], NOW), []);
});
