// Run: npm test. The dashboard's Recent Activity as sentences, grouped by Philippine day.
import test from 'node:test';
import assert from 'node:assert';
import { describeActivity, dayLabel, groupByDay, KINDS, afterCleared, readClearedAt, writeClearedAt } from './activityView.js';

const log = (over = {}) => ({ id: 1, action: 'approve', user: 'Diana Evale', courseCode: 'FM 202', title: 'Fundamentals of Mathematics', actionDate: '2026-10-14T13:16:43.000Z', ...over });
const NOW = new Date('2026-10-14T14:00:00.000Z'); // 10:00 PM on Oct 14 in Manila

test('a log row reads as a sentence: who, what, which syllabus, with the course title beneath', () => {
  const a = describeActivity(log());
  assert.deepStrictEqual([a.who, a.verb, a.subject, a.detail, a.time], ['Diana Evale', 'approved', 'FM 202', 'Fundamentals of Mathematics', '9:16 PM']);
  assert.deepStrictEqual([a.icon, a.tone], ['approved', 'good']);
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

test('your own actions read "You", and nobody else\'s does', () => {
  assert.strictEqual(describeActivity(log({ userId: 1 }), 0, 1).who, 'You');
  assert.strictEqual(describeActivity(log({ userId: 1 }), 0, 5).who, 'Diana Evale');
  assert.strictEqual(describeActivity(log({ userId: 1 }), 0).who, 'Diana Evale'); // no viewer given
});

test('Clear Logs hides what was done up to then and keeps what comes after, kept per account and surviving a refresh', () => {
  const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };
  const st = store();
  assert.strictEqual(readClearedAt(1, st), '');
  const at = writeClearedAt(1, new Date('2026-10-14T13:00:00.000Z'), st);
  assert.strictEqual(at, '2026-10-14T13:00:00.000Z');
  assert.strictEqual(readClearedAt(1, st), at);
  assert.strictEqual(readClearedAt(2, st), ''); // another account is not affected
  const rows = [log({ id: 1, actionDate: '2026-10-14T13:16:43.000Z' }), log({ id: 2, actionDate: '2026-10-14T12:00:00.000Z' }), log({ id: 3, actionDate: 'nope' })];
  assert.deepStrictEqual(afterCleared(rows, at).map((r) => r.id), [1]);
  assert.deepStrictEqual(afterCleared(rows, '').map((r) => r.id), [1, 2, 3]); // never cleared: everything
  assert.deepStrictEqual(afterCleared(rows, 'not a date').map((r) => r.id), [1, 2, 3]);
});

test('blocked storage never breaks the list: nothing is remembered, nothing throws', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.strictEqual(readClearedAt(1, blocked), '');
  assert.strictEqual(typeof writeClearedAt(1, new Date(), blocked), 'string');
});

test('a first submission from the builder reads "submitted", even in older rows that logged it as an upload; a real file upload stays "uploaded"', () => {
  assert.strictEqual(describeActivity(log({ action: 'upload', notes: 'Syllabus submitted from the builder' })).verb, 'submitted');
  assert.strictEqual(describeActivity(log({ action: 'upload', notes: 'Uploaded file, saved as v1.0: Initial version (uploaded file)' })).verb, 'uploaded');
  assert.strictEqual(describeActivity(log({ action: 'upload', notes: 'Syllabus uploaded' })).verb, 'uploaded');
});
