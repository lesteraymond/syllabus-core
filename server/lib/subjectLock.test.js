const test = require('node:test');
const assert = require('node:assert');
const { conflictFor, messageFor, takenBySubject, assertSubjectFree } = require('./subjectLock');
const rules = require('./syllabusRules');

const me = { id: 26, role: 'faculty' };
const row = (syllabus_id, status, user_id = 26) => ({ syllabus_id, user_id, status });

test('a subject the person has nothing on is free', () => {
  assert.strictEqual(conflictFor([], me), null);
  assert.strictEqual(conflictFor(undefined, me), null);
});

test('a syllabus of the person in any state keeps the subject: draft, submitted, under review, returned, rejected and approved', () => {
  for (const status of ['draft', 'submitted', 'under_review', 'for_revision', 'rejected', 'approved']) {
    assert.deepStrictEqual(conflictFor([row(58, status)], me), { id: 58, status }, status);
  }
});

test("what someone else wrote for the subject is theirs: it does not block the person the subject is assigned to now", () => {
  assert.strictEqual(conflictFor([row(87, 'approved', 1)], me), null);
  assert.strictEqual(conflictFor([row(85, 'draft', 1)], me), null);
  assert.deepStrictEqual(conflictFor([row(87, 'approved', 1), row(75, 'draft')], me), { id: 75, status: 'draft' }, "only the person's own counts");
});

test("with several of the person's own, the furthest along is reported", () => {
  assert.deepStrictEqual(conflictFor([row(75, 'draft'), row(58, 'approved')], me), { id: 58, status: 'approved' });
});

test('the message names the state and where to go', () => {
  assert.match(messageFor({ id: 1, status: 'draft' }), /already have a draft.*My Syllabi/);
  assert.match(messageFor({ id: 1, status: 'for_revision' }), /For Revision.*edit and submit it again/);
  assert.match(messageFor({ id: 1, status: 'rejected' }), /Rejected.*edit and submit it again/);
  assert.match(messageFor({ id: 1, status: 'approved' }), /Approved\)\. Open it from My Syllabi\./);
});

test('saving refuses with 409 and a code the builder reads, and skips the query when there is no subject', async () => {
  const calls = [];
  const conn = { query: async (sql, params) => { calls.push([sql, params]); return [[row(58, 'submitted')]]; } };
  await assert.rejects(() => assertSubjectFree(conn, me, 9, 93), (e) => e.status === 409 && e.body.code === 'syllabus_exists' && e.body.existingId === 58 && e.body.existingStatus === 'submitted');
  assert.deepStrictEqual(calls[0][1], [9, 93, 26], "the syllabus being saved is not counted against itself, and only the person's own are read");
  calls.length = 0;
  await assertSubjectFree(conn, me, null, 93);
  assert.strictEqual(calls.length, 0);
});

test('the subject list marks what the person already has a syllabus on, and leaves free subjects out', () => {
  const rows = [
    { syllabus_id: 58, course_id: 9, user_id: 26, status: 'approved' },
    { syllabus_id: 75, course_id: 9, user_id: 26, status: 'draft' },
    { syllabus_id: 80, course_id: 10, user_id: 26, status: 'draft' },
    { syllabus_id: 81, course_id: 11, user_id: 5, status: 'draft' },
    { syllabus_id: 87, course_id: 12, user_id: 1, status: 'under_review' },
  ];
  const taken = takenBySubject(rows, me);
  assert.deepStrictEqual(taken.get(9), { status: 'approved' }, 'a submitted or later one is reported before a draft');
  assert.deepStrictEqual(taken.get(10), { status: 'draft' });
  assert.strictEqual(taken.has(11), false, "another person's draft is not this person's");
  assert.strictEqual(taken.has(12), false, 'nor is their syllabus, so a reassigned subject is free for its new faculty member');
  assert.strictEqual(takenBySubject([], me).size, 0);
});

test("a returned or rejected syllabus is the owner's to edit and resubmit; approved and submitted stay locked", () => {
  const owner = { id: 26, role: 'faculty' };
  for (const status of ['draft', 'for_revision', 'rejected']) assert.strictEqual(rules.canEdit(owner, { user_id: 26, status }), true, status);
  for (const status of ['submitted', 'under_review', 'approved']) assert.strictEqual(rules.canEdit(owner, { user_id: 26, status }), false, status);
  assert.strictEqual(rules.canEdit(owner, { user_id: 5, status: 'rejected' }), false, 'only the owner');
  assert.strictEqual(rules.statusAfterOwnerEdit('rejected'), 'submitted');
  assert.strictEqual(rules.statusAfterOwnerEdit('for_revision'), 'submitted');
  assert.strictEqual(rules.statusAfterOwnerEdit('approved'), 'approved');
});

test('an archived syllabus is a read-only record: its owner cannot edit it, and its status cannot be decided on', () => {
  const owner = { id: 26, role: 'faculty' };
  const archived = { user_id: 26, status: 'draft', archived_at: '2026-10-16T00:00:00.000Z' };
  assert.strictEqual(rules.isArchived(archived), true);
  assert.strictEqual(rules.isArchived({ user_id: 26, status: 'draft', archived_at: null }), false);
  for (const status of ['draft', 'for_revision', 'rejected']) assert.strictEqual(rules.canEdit(owner, { ...archived, status }), false, status);
  assert.match(rules.lockedMessage(archived), /archived because its subject was assigned to another faculty member/);
});
