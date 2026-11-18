import test from 'node:test';
import assert from 'node:assert/strict';
import { searchAll, facultyDirectory, syllabusDestination, queryWords } from './globalSearch.js';

const syllabi = [
  { id: 1, userId: 10, courseCode: 'CPE 101', title: 'Logic Circuits', courseTitle: 'Logic Circuits', faculty: 'Maria Santos', programCode: 'BSCPE', status: 'approved', academicYear: '2026-2027' },
  { id: 2, userId: 11, courseCode: 'IT 201', title: 'Data Structures', courseTitle: '', faculty: 'José Reyes', programCode: 'BSIT', status: 'under_review' },
  { id: 3, userId: 10, courseCode: 'CPE 102', title: 'Digital Design', faculty: 'Maria Santos', programCode: 'BSCPE', status: 'draft' },
];
const courses = [{ id: 7, code: 'CPE 101', title: 'Logic Circuits', program: 'BSCPE' }, { id: 8, code: 'MATH 1', title: 'Calculus', program: 'BSIT' }];
const users = [{ id: 12, role: 'faculty', firstName: 'Ana', lastName: 'Cruz', email: 'ana@school.edu' }, { id: 1, role: 'admin', firstName: 'Admin', lastName: 'One', email: 'a@school.edu' }];
const pages = [{ page: 'repository', label: 'Repository' }, { page: 'users', label: 'Users & Roles' }];
const run = (query, extra = {}) => searchAll({ query, syllabi, courses, users, pages, ...extra });
const keys = (groups, group) => (groups.find((g) => g.key === group)?.items || []).map((i) => i.key);

test('an empty or blank query finds nothing', () => {
  assert.deepEqual(run(''), []);
  assert.deepEqual(run('   ,; '), []);
});

test('finds a syllabus by course code, title, faculty, program and status', () => {
  assert.deepEqual(keys(run('cpe 101'), 'syllabi'), ['syllabus-1']);
  assert.deepEqual(keys(run('data struc'), 'syllabi'), ['syllabus-2']);
  assert.deepEqual(keys(run('santos'), 'syllabi'), ['syllabus-1', 'syllabus-3']);
  assert.deepEqual(keys(run('bsit'), 'syllabi'), ['syllabus-2']);
  assert.deepEqual(keys(run('under review'), 'syllabi'), ['syllabus-2']);
  assert.deepEqual(keys(run('2026-2027'), 'syllabi'), ['syllabus-1']);
});

test('every word must match, in any order, ignoring accents and capitals', () => {
  assert.deepEqual(keys(run('SANTOS cpe 101'), 'syllabi'), ['syllabus-1']);
  assert.deepEqual(keys(run('jose'), 'syllabi'), ['syllabus-2']);
  assert.deepEqual(keys(run('santos calculus'), 'syllabi'), []);
});

test('a record whose main field starts with the word comes before one that only contains it', () => {
  const two = [{ id: 1, userId: 1, courseCode: 'X 1', title: 'Applied Logic', faculty: 'A' }, { id: 2, userId: 1, courseCode: 'LOG 1', title: 'Basics', faculty: 'A' }];
  assert.deepEqual(searchAll({ query: 'log', syllabi: two }).find((g) => g.key === 'syllabi').items.map((i) => i.id), [2, 1]);
});

test('courses are searched for the administrator only', () => {
  assert.deepEqual(keys(run('calculus', { isAdmin: true }), 'courses'), ['course-8']);
  assert.deepEqual(run('calculus', { isAdmin: false }), []);
});

test('faculty come from the syllabi and, for the administrator, from the user list; each person once', () => {
  assert.deepEqual(keys(run('santos'), 'faculty'), ['faculty-10']);
  assert.deepEqual(keys(run('cruz', { users }), 'faculty'), ['faculty-12']);
  assert.deepEqual(keys(run('cruz', { users: [] }), 'faculty'), []);
  assert.deepEqual(keys(run('ana@school', { users }), 'faculty'), ['faculty-12']);
  const santos = run('santos').find((g) => g.key === 'faculty').items[0];
  assert.equal(santos.count, 2);
  assert.equal(keys(run('admin one', { users }), 'faculty').length, 0); // an administrator who owns no syllabus is not "faculty"
});

test('pages are matched by their label', () => {
  assert.deepEqual(keys(run('repo'), 'pages'), ['page-repository']);
  assert.deepEqual(keys(run('roles'), 'pages'), ['page-users']);
});

test('groups come in a fixed order and are cut to the limit, with the full count kept', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, userId: 1, courseCode: `AB ${i}`, title: 'Algebra', faculty: 'Z' }));
  const groups = searchAll({ query: 'ab', syllabi: many, pages: [{ page: 'a', label: 'About' }], limit: 4 });
  assert.deepEqual(groups.map((g) => g.key), ['syllabi', 'pages']);
  assert.equal(groups[0].items.length, 4);
  assert.equal(groups[0].total, 9);
});

test('facultyDirectory tolerates missing names and ids', () => {
  assert.deepEqual(facultyDirectory({ syllabi: [{ id: 1, userId: null, faculty: 'X' }, { id: 2, userId: 5, faculty: '  ' }] }), []);
});

test('queryWords drops separators', () => {
  assert.deepEqual(queryWords(' CPE,  101; Santos '), ['cpe', '101', 'santos']);
});

test('syllabusDestination: own unfinished work goes to My Syllabi, reviewers open the window, others the repository', () => {
  const me = { id: 10 };
  assert.equal(syllabusDestination(me, { userId: 10, status: 'draft' }, true), 'my-syllabi');
  assert.equal(syllabusDestination(me, { userId: 10, status: 'for_revision' }, false), 'my-syllabi');
  assert.equal(syllabusDestination(me, { userId: 11, status: 'under_review' }, true), 'view');
  assert.equal(syllabusDestination(me, { userId: 10, status: 'approved' }, true), 'view');
  assert.equal(syllabusDestination(me, { userId: 10, status: 'approved' }, false), 'my-syllabi');
  assert.equal(syllabusDestination(me, { userId: 11, status: 'approved' }, false), 'repository');
});
