// Run: npm test (from the project root)
const test = require('node:test');
const assert = require('node:assert');
const A = require('./assignments');

const faculty = { id: 5, role: 'faculty' };
const admin = { id: 1, role: 'admin' };
const catalog = {
  programs: [{ id: 1 }, { id: 2 }],
  courses: [{ id: 10, programId: 1 }, { id: 11, programId: 1 }, { id: 20, programId: 2 }],
};
const some = { programIds: [1], courseIds: [10] };
const none = { programIds: [], courseIds: [] };

test('an assigned course may be written, any other may not', () => {
  assert.strictEqual(A.mayWriteSyllabus(faculty, some, 10), true);
  assert.strictEqual(A.mayWriteSyllabus(faculty, some, 11), false);
  assert.strictEqual(A.mayWriteSyllabus(faculty, some, 20), false);
  assert.strictEqual(A.mayWriteSyllabus(faculty, some, '10'), true); // ids may arrive as text
});

test('a faculty member with no assignments cannot start a syllabus or use any course', () => {
  assert.strictEqual(A.mayWriteSyllabus(faculty, none, null), false);
  assert.strictEqual(A.mayWriteSyllabus(faculty, none, 10), false);
  assert.strictEqual(A.mayWriteSyllabus(faculty, undefined, null), false);
  assert.strictEqual(A.writeBlockedReason(faculty, none, null), A.NOTHING_ASSIGNED);
  assert.strictEqual(A.writeBlockedReason(faculty, none, 10), A.NOT_ASSIGNED);
});

test('a program with no subject yet blocks starting a syllabus, with a message that says so', () => {
  const programOnly = { programIds: [1], courseIds: [] };
  assert.strictEqual(A.mayWriteSyllabus(faculty, programOnly, null), false);
  assert.strictEqual(A.mayWriteSyllabus(faculty, programOnly, 10), false);
  assert.strictEqual(A.writeBlockedReason(faculty, programOnly, null), A.NO_SUBJECT_YET);
  assert.match(A.NO_SUBJECT_YET, /program is assigned to you, but no subject yet/);
  assert.strictEqual(A.writeBlockedReason(faculty, none, null), A.NOTHING_ASSIGNED);
});

test('with no course chosen yet, one assigned course is enough to start a draft', () => {
  assert.strictEqual(A.mayWriteSyllabus(faculty, some, null), true);
  assert.strictEqual(A.mayWriteSyllabus(faculty, some, undefined), true);
  assert.strictEqual(A.writeBlockedReason(faculty, some, 10), null);
});

test('admins are never restricted by assignments', () => {
  assert.strictEqual(A.mayWriteSyllabus(admin, none, 10), true);
  assert.strictEqual(A.mayWriteSyllabus(admin, none, null), true);
});

test('unknown roles and missing users are refused', () => {
  assert.strictEqual(A.mayWriteSyllabus(null, some, 10), false);
  assert.strictEqual(A.mayWriteSyllabus({ role: 'student' }, some, 10), false);
});

test('canUseCourse needs a whole-number id', () => {
  assert.strictEqual(A.canUseCourse(some, 10), true);
  assert.strictEqual(A.canUseCourse(some, 10.5), false);
  assert.strictEqual(A.canUseCourse(some, null), false);
  assert.deepStrictEqual(A.assignedProgramIds(undefined), []);
  assert.deepStrictEqual(A.assignedCourseIds(some), [10]);
});

test('a course whose program is not selected is dropped (removing a program removes its courses)', () => {
  const r = A.normalizeAssignments({ programs: [1], courses: [10, 11, 20] }, catalog);
  assert.deepStrictEqual(r.programIds, [1]);
  assert.deepStrictEqual(r.courseIds, [10, 11]);
  assert.deepStrictEqual(r.dropped, [20]);
  const none2 = A.normalizeAssignments({ programs: [], courses: [10] }, catalog);
  assert.deepStrictEqual(none2.courseIds, []);
});

test('normalizing removes duplicates, accepts numeric text and sorts', () => {
  const r = A.normalizeAssignments({ programs: ['2', 1, 1], courses: [20, '10', 10] }, catalog);
  assert.deepStrictEqual(r.programIds, [1, 2]);
  assert.deepStrictEqual(r.courseIds, [10, 20]);
});

test('unknown program or course ids are rejected with a 400', () => {
  assert.throws(() => A.normalizeAssignments({ programs: [99], courses: [] }, catalog), (e) => e.status === 400);
  assert.throws(() => A.normalizeAssignments({ programs: [1], courses: [99] }, catalog), (e) => e.status === 400);
});

test('malformed lists are rejected with a 400', () => {
  for (const body of [{ programs: 'BSIT' }, { programs: [1.5] }, { programs: [0] }, { programs: [-1] }, { courses: {} }, { courses: [null] }, { programs: ['x'] }]) {
    assert.throws(() => A.normalizeAssignments(body, catalog), (e) => e.status === 400, JSON.stringify(body));
  }
});

test('lists beyond the caps are rejected', () => {
  const many = Array.from({ length: A.MAX_COURSES + 1 }, (_, i) => i + 1);
  assert.throws(() => A.normalizeAssignments({ courses: many }, catalog), (e) => e.status === 400);
  const progs = Array.from({ length: A.MAX_PROGRAMS + 1 }, (_, i) => i + 1);
  assert.throws(() => A.normalizeAssignments({ programs: progs }, catalog), (e) => e.status === 400);
});

test('an empty or missing body means no assignments', () => {
  for (const body of [{}, undefined, null]) {
    const r = A.normalizeAssignments(body, catalog);
    assert.deepStrictEqual([r.programIds, r.courseIds], [[], []]);
  }
});

test('saveAssignments replaces both lists in order and skips empty inserts', async () => {
  const calls = [];
  const conn = { query: async (sql, params) => { calls.push([sql.split(' ').slice(0, 3).join(' '), params]); return [[]]; } };
  await A.saveAssignments(conn, 5, { programIds: [1], courseIds: [10, 11] });
  assert.deepStrictEqual(calls.map((c) => c[0]), ['SELECT course_id FROM', 'DELETE FROM faculty_courses', 'DELETE FROM faculty_programs', 'INSERT INTO faculty_programs', 'INSERT INTO faculty_courses', 'UPDATE syllabi s', 'SELECT syllabus_id, course_id,'],
    'what she held is read first; the subjects she is newly given archive what others wrote, then look for what she wrote herself');
  assert.deepStrictEqual(calls[4][1], [[[5, 10], [5, 11]]]);
  assert.deepStrictEqual(calls[5][1], [[10, 11], 5]);
  calls.length = 0;
  await A.saveAssignments(conn, 5, { programIds: [], courseIds: [] });
  assert.deepStrictEqual(calls.map((c) => c[0]), ['SELECT course_id FROM', 'DELETE FROM faculty_courses', 'DELETE FROM faculty_programs'], 'nothing given, so nothing archived');
});

test('only subjects newly given are archived over, and only the syllabi of other faculty members', async () => {
  const calls = [];
  const conn = { query: async (sql, params) => { calls.push([sql, params]); return sql.startsWith('SELECT') ? [sql.startsWith('SELECT course_id') ? [{ course_id: 10 }] : []] : [{ affectedRows: 2 }]; } };
  await A.saveAssignments(conn, 5, { programIds: [], courseIds: [10, 11] });
  const update = calls.find((c) => c[0].startsWith('UPDATE syllabi'));
  assert.deepStrictEqual(update[1], [[11], 5], 'IT 101 was hers already, so only subject 11 is newly given');
  assert.match(update[0], /s\.user_id <> \? AND s\.archived_at IS NULL AND o\.role = 'faculty'/);
  assert.strictEqual(await A.archiveReassigned(conn, 5, []), 0, 'no subjects, no query');
  assert.strictEqual(await A.archiveReassigned(conn, 5, [11]), 2);
});

test('a subject given back brings one archived syllabus back: submitted-or-later before a draft, then the most recently changed', () => {
  const row = (syllabus_id, course_id, status, updated_at) => ({ syllabus_id, course_id, status, updated_at });
  const rows = [row(75, 9, 'draft', '2026-10-16T10:00:00Z'), row(58, 9, 'approved', '2026-10-14T10:00:00Z'), row(89, 9, 'approved', '2026-10-15T10:00:00Z'), row(93, 9, 'draft', '2026-10-16T11:00:00Z')];
  assert.deepStrictEqual(A.pickRestorable(rows), [89], 'an approved one beats a newer draft, and the newer approved one wins');
  assert.deepStrictEqual(A.pickRestorable([row(75, 9, 'draft', '2026-10-16T10:00:00Z'), row(93, 9, 'draft', '2026-10-16T11:00:00Z')]), [93], 'only drafts: the latest');
  assert.deepStrictEqual(A.pickRestorable([row(5, 9, 'draft', '2026-10-16T10:00:00Z'), row(6, 9, 'draft', '2026-10-16T10:00:00Z')]), [6], 'a tie goes to the higher id');
  assert.deepStrictEqual(A.pickRestorable([row(58, 9, 'approved', '2026-10-14T10:00:00Z'), row(70, 12, 'draft', '2026-10-14T10:00:00Z')]).sort(), [58, 70], 'one for each subject');
  assert.deepStrictEqual(A.pickRestorable(rows, [9]), [], 'a subject on which the person already has an active syllabus brings nothing back');
  assert.deepStrictEqual(A.pickRestorable([]), []);
  assert.deepStrictEqual(A.pickRestorable(undefined), []);
});

test('restoreReturned brings back only what pickRestorable chose, in one update, and does nothing when there is nothing archived', async () => {
  const calls = [];
  const archived = [{ syllabus_id: 58, course_id: 9, status: 'approved', updated_at: '2026-10-14T10:00:00Z' }, { syllabus_id: 75, course_id: 9, status: 'draft', updated_at: '2026-10-16T10:00:00Z' }];
  const conn = { query: async (sql, params) => { calls.push([sql, params]); return sql.includes('archived_at IS NOT NULL') ? [archived] : sql.startsWith('SELECT DISTINCT') ? [[]] : [{ affectedRows: 1 }]; } };
  assert.deepStrictEqual(await A.restoreReturned(conn, 26, [9]), [58]);
  const update = calls.find((c) => c[0].startsWith('UPDATE syllabi SET archived_at = NULL'));
  assert.deepStrictEqual(update[1], [[58]]);
  calls.length = 0;
  assert.deepStrictEqual(await A.restoreReturned({ query: async (s) => { calls.push(s); return [[]]; } }, 26, [9]), []);
  assert.strictEqual(calls.length, 1, 'no archived syllabus: one read and no update');
  assert.deepStrictEqual(await A.restoreReturned(conn, 26, []), []);
});

test('loadAssignments reads both tables', async () => {
  const conn = { query: async (sql) => [sql.includes('faculty_programs') ? [{ program_id: 1 }] : [{ course_id: 10 }, { course_id: 11 }]] };
  assert.deepStrictEqual(await A.loadAssignments(conn, 5), { programIds: [1], courseIds: [10, 11] });
});

test('assertSubjectsFree passes when nobody else holds the subjects, and skips the query for none', async () => {
  const calls = [];
  const conn = { query: async (sql, params) => { calls.push([sql, params]); return [[]]; } };
  await A.assertSubjectsFree(conn, 5, []);
  assert.strictEqual(calls.length, 0);
  await A.assertSubjectsFree(conn, 5, [10, 11]);
  assert.strictEqual(calls.length, 1);
  assert.match(calls[0][0], /FOR UPDATE/, 'the rows are locked for the transaction');
  assert.deepStrictEqual(calls[0][1], [[10, 11], 5]);
});

test('assertSubjectsFree names the holder and counts the rest', async () => {
  const rows = [{ course_id: 10, code: 'IT 101', first_name: 'Fay', last_name: 'Cruz' }, { course_id: 11, code: 'IT 204', first_name: 'Gus', last_name: 'Lim' }, { course_id: 12, code: 'IT 310', first_name: 'Gus', last_name: 'Lim' }];
  const conn = { query: async () => [rows] };
  await assert.rejects(() => A.assertSubjectsFree(conn, 7, [10, 11, 12]), (e) => e.status === 409 && e.body.code === 'subject_taken' && e.body.conflicts.length === 3
    && /^IT 101 is already assigned to Fay Cruz\./.test(e.message) && /\(2 more subjects are also taken\.\)/.test(e.message));
});

test('subjectHolders lists each subject with its faculty member', async () => {
  const conn = { query: async () => [[{ course_id: 10, user_id: 5, first_name: 'Fay', last_name: 'Cruz' }]] };
  assert.deepStrictEqual(await A.subjectHolders(conn), [{ courseId: 10, userId: 5, name: 'Fay Cruz' }]);
});
