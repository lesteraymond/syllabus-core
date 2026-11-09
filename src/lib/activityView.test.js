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

test('an AI check and an answer to a recommendation read as sentences, with the verb that says what the person did', () => {
  const check = describeActivity(log({ action: 'check', notes: 'AI check: score 97%; 2 recommendations' }), 0, 7);
  assert.deepStrictEqual([check.verb, check.icon, check.tone], ['ran an AI check on', 'sparkle', 'info']);
  const verb = (notes) => describeActivity(log({ action: 'recommend', notes })).verb;
  assert.strictEqual(verb('Accepted recommendation: plan[3].tasks'), 'accepted a recommendation on');
  assert.strictEqual(verb('Edited and applied recommendation: clos[0].statement'), 'edited and applied a recommendation on');
  assert.strictEqual(verb('Rejected recommendation: plan[3].tasks'), 'rejected a recommendation on');
  assert.strictEqual(verb('Undid recommendation: plan[3].tasks'), 'undid a recommendation on');
  assert.strictEqual(verb('something else'), 'answered a recommendation on');
  assert.strictEqual(verb(null), 'answered a recommendation on');
});

// The account's own activity (server/lib/accountActivity.js): rows that are about the account read without a syllabus; drafts, edits and deletions
// say whether it was a draft. Never a password: only how the person signed in.
test('the account activity reads as sentences: sign-in and sign-out, password, name, photo and language, without a syllabus', () => {
  const row = (action, notes, over = {}) => describeActivity(log({ action, notes, courseCode: null, title: null, userId: 5, ...over }), 0, 5);
  const said = (a) => [a.who, a.verb, a.subject, a.detail, a.note];
  assert.deepStrictEqual(said(row('login', 'password')), ['You', 'signed in', '', '', 'with a password']);
  assert.deepStrictEqual(said(row('login', 'google')), ['You', 'signed in', '', '', 'with Google']);
  assert.deepStrictEqual(said(row('login', 'temporary')), ['You', 'signed in', '', '', 'with a temporary password']);
  assert.deepStrictEqual(said(row('logout', null)), ['You', 'signed out', '', '', '']);
  assert.deepStrictEqual(said(row('password_change', 'self')), ['You', 'changed the password', '', '', '']);
  assert.deepStrictEqual(said(row('password_change', 'required')), ['You', 'changed the password', '', '', 'after a generated password, as required']);
  assert.deepStrictEqual(said(row('name_change', 'Fay F → Faye Flores')), ['You', 'changed the name', '', 'Fay F → Faye Flores', '']);
  assert.deepStrictEqual(said(row('photo_change', 'upload')), ['You', 'changed the profile photo', '', '', '']);
  assert.deepStrictEqual(said(row('photo_change', 'google')), ['You', 'used the Google photo as the profile photo', '', '', '']);
  assert.deepStrictEqual(said(row('photo_change', 'remove')), ['You', 'removed the profile photo', '', '', '']);
  assert.deepStrictEqual(said(row('photo_change', 'remove_other', { courseCode: 'Gus Gomez' })), ['You', 'removed the profile photo of', 'Gus Gomez', '', '']);
  assert.deepStrictEqual(said(row('language_change', 'tl')), ['You', 'changed the language', '', '', 'Tagalog']);
  assert.deepStrictEqual(said(row('language_change', 'en')), ['You', 'changed the language', '', '', 'English']);
  for (const action of ['login', 'logout', 'password_change', 'name_change', 'photo_change', 'language_change']) assert.strictEqual(KINDS[action].account, true, action);
});

test('drafts, edits and deletions name the syllabus and say whether it was a draft', () => {
  const row = (action, notes, over = {}) => { const a = describeActivity(log({ action, notes, ...over })); return [a.verb, a.subject, a.detail]; };
  assert.deepStrictEqual(row('draft_create', null, { courseCode: '', title: '' }), ['started a new draft', '', ''], 'a new draft has no subject yet');
  assert.deepStrictEqual(row('draft_create', null), ['started a new draft of', 'FM 202', 'Fundamentals of Mathematics'], 'once a subject is chosen the line names it');
  assert.deepStrictEqual(row('content_edit', 'draft'), ['edited the draft of', 'FM 202', 'Fundamentals of Mathematics']);
  assert.deepStrictEqual(row('content_edit', 'for_revision'), ['edited', 'FM 202', 'Fundamentals of Mathematics']);
  assert.deepStrictEqual(row('syllabus_delete', 'draft'), ['deleted the draft of', 'FM 202', 'Fundamentals of Mathematics']);
  assert.deepStrictEqual(row('syllabus_delete', 'submitted', { title: '' }), ['deleted', 'FM 202', '']);
  assert.deepStrictEqual([describeActivity(log({ action: 'syllabus_delete', notes: 'draft' })).icon, describeActivity(log({ action: 'syllabus_delete' })).tone], ['trash', 'warn']);
  assert.strictEqual(describeActivity(log({ action: 'update' })).verb, 'updated', 'the review history reads as before');
});

test('refused sign-ins, a remembered device and the administrator\'s management of accounts read as sentences', () => {
  const row = (action, notes, over = {}) => { const a = describeActivity(log({ action, notes, courseCode: null, title: null, userId: 5, ...over }), 0, 5); return [a.who, a.verb, a.subject, a.note, a.tone]; };
  assert.deepStrictEqual(row('login', 'remembered'), ['You', 'signed in', '', 'on a remembered device', 'quiet']);
  assert.deepStrictEqual(row('login_failed', 'password'), ['You', 'failed to sign in', '', 'wrong password', 'bad']);
  assert.deepStrictEqual(row('login_failed', 'disabled'), ['You', 'failed to sign in', '', 'the account is disabled', 'bad']);
  assert.deepStrictEqual(row('login_failed', 'disabled_remembered'), ['You', 'failed to sign in', '', 'the account is disabled (remembered device)', 'bad']);
  const fay = { courseCode: 'Fay Flores' }; // the account's name, recorded at the time (server/lib/accountActivity.js listFor)
  assert.deepStrictEqual(row('user_create', 'lic_director', fay), ['You', 'registered the account of', 'Fay Flores', 'LIC Director', 'info']);
  assert.deepStrictEqual(row('user_credentials', null, fay), ['You', 'sent new sign-in details to', 'Fay Flores', '', 'info']);
  assert.deepStrictEqual(row('user_disable', null, fay), ['You', 'disabled the account of', 'Fay Flores', '', 'bad']);
  assert.deepStrictEqual(row('user_enable', null, fay), ['You', 'enabled the account of', 'Fay Flores', '', 'good']);
  assert.deepStrictEqual(row('user_delete', null, fay), ['You', 'removed the account of', 'Fay Flores', '', 'bad']);
  assert.deepStrictEqual(row('user_assignments', '3', fay), ['You', 'changed the assignments of', 'Fay Flores', 'Subjects assigned: 3', 'quiet']);
  assert.deepStrictEqual(row('user_disable', null), ['You', 'disabled the account of', 'an account', '', 'bad'], 'no name recorded');
  // in the administrator's view of everyone, somebody else's line names them
  assert.strictEqual(describeActivity(log({ action: 'login_failed', notes: 'password', user: 'Gus Go', userId: 6 }), 0, 1).who, 'Gus Go');
});
