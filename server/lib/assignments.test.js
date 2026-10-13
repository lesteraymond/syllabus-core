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
  assert.deepStrictEqual(calls.map((c) => c[0]), ['DELETE FROM faculty_courses', 'DELETE FROM faculty_programs', 'INSERT INTO faculty_programs', 'INSERT INTO faculty_courses']);
  assert.deepStrictEqual(calls[3][1], [[[5, 10], [5, 11]]]);
  calls.length = 0;
  await A.saveAssignments(conn, 5, { programIds: [], courseIds: [] });
  assert.strictEqual(calls.length, 2);
});

test('loadAssignments reads both tables', async () => {
  const conn = { query: async (sql) => [sql.includes('faculty_programs') ? [{ program_id: 1 }] : [{ course_id: 10 }, { course_id: 11 }]] };
  assert.deepStrictEqual(await A.loadAssignments(conn, 5), { programIds: [1], courseIds: [10, 11] });
});
