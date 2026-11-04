'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { matchCourses, syncEnrollments, enrolledSubjects, programOfSection } = require('./enrollments');

const COURSES = [
  { course_id: 1, code: 'IT 202', title: 'Computer Programming 1', program_code: 'BSIT' },
  { course_id: 2, code: 'IT 401', title: 'Quantitative Methods (Including Modeling and Simulation)', program_code: 'BSIT' },
  { course_id: 3, code: 'IT 202', title: 'System Integration and Architecture 1', program_code: 'BSIT-CS' },
  { course_id: 4, code: 'IS-CITE', title: 'Integrating Seminar', program_code: 'BSIT' },
];
const db = (enrollments = []) => ({
  updates: [],
  query: async function (sql, params = []) {
    if (sql.startsWith('SELECT c.course_id, c.code, c.title, p.code')) return [COURSES];
    if (sql.startsWith('SELECT enrollment_id')) return [enrollments.filter((e) => e.user_id === params[0] && !e.course_id)];
    if (sql.startsWith('UPDATE student_enrollments')) { this.updates.push(params); return [{}]; }
    throw new Error('unexpected query: ' + sql.slice(0, 60));
  },
});

test('a section belongs to the longest program code it starts with', () => {
  const codes = ['BSIT', 'BSIT-CS', 'BSCPE', 'BSIE'];
  assert.equal(programOfSection('BSIT4B', codes), 'BSIT');
  assert.equal(programOfSection('BSITCS4A', codes), 'BSIT-CS');
  assert.equal(programOfSection('bscpe 2a', codes), 'BSCPE');
  assert.equal(programOfSection('XYZ1', codes), null);
  assert.equal(programOfSection(null, codes), null);
});

test('a COR line matches by code ignoring hyphens and case, else by title; the student\'s own program wins', async () => {
  const lines = [{ code: 'IT-401', title: 'QUANTITATIVE METHODS' }, { code: 'it202', title: 'x' }, { code: 'ZZ 9', title: 'Integrating Seminar' }, { code: 'ZZ 9', title: 'Nothing' }];
  assert.deepEqual(await matchCourses(db(), lines, 'BSIT-CS'), [2, 3, 4, null]);
  assert.deepEqual(await matchCourses(db(), lines, 'BSIT'), [2, 1, 4, null]);
  assert.deepEqual(await matchCourses(db(), lines, null), [2, 1, 4, null]); // no program: the one listed first
});

test('only the unlinked enrollments are linked, and the count says how many', async () => {
  const fake = db([
    { enrollment_id: 10, user_id: 7, subject_code: 'IT-401', subject_title: 'Q', course_id: null },
    { enrollment_id: 11, user_id: 7, subject_code: 'NOPE', subject_title: 'Nothing', course_id: null },
    { enrollment_id: 12, user_id: 7, subject_code: 'IT 202', subject_title: 'Done already', course_id: 1 },
  ]);
  assert.equal(await syncEnrollments(fake, 7, 'BSIT'), 1);
  assert.deepEqual(fake.updates, [[2, 10]]);
  assert.equal(await syncEnrollments(db([]), 7, 'BSIT'), 0);
});

test('enrolled subjects come with the catalog\'s code, title, program and faculty, and fall back to what the COR printed', async () => {
  const fake = { query: async () => [[
    { subject_code: 'IT-401', subject_title: 'QUANTITATIVE METHODS', section: 'BSIT4B', course_id: 2, course_code: 'IT 401', course_title: 'Quantitative Methods (Including Modeling and Simulation)', program_code: 'BSIT', program_name: 'BS IT', faculty: 'Juan Santos ' },
    { subject_code: 'ZZ 9', subject_title: 'SOMETHING', section: 'BSIT4B', course_id: null, course_code: null, course_title: null, program_code: null, program_name: null, faculty: null },
  ]] };
  const [a, b] = await enrolledSubjects(fake, 7);
  assert.deepEqual([a.courseId, a.code, a.title, a.program, a.faculty], [2, 'IT 401', 'Quantitative Methods (Including Modeling and Simulation)', 'BSIT', 'Juan Santos']);
  assert.deepEqual([b.courseId, b.code, b.title, b.program, b.faculty], [null, 'ZZ 9', '', '', '']);
  assert.equal(a.subject_code, 'IT-401'); // the COR's own line is still there for older screens
});
