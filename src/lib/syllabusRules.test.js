// Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import { assignmentState, courseLockReason, NOT_ASSIGNED, NOTHING_ASSIGNED, NO_SUBJECT_YET } from './syllabusRules.js';

const faculty = { id: 5, role: 'faculty' };
const mine = { unrestricted: false, programIds: [1], courseIds: [10], courses: [{ id: 10, code: 'IT 101' }] };
const none = { unrestricted: false, programIds: [], courseIds: [], courses: [] };
const programOnly = { unrestricted: false, programIds: [1], courseIds: [], courses: [] };

test('an assigned course is editable, an unassigned one says so', () => {
  assert.strictEqual(courseLockReason(faculty, mine, { courseId: 10 }), '');
  assert.strictEqual(courseLockReason(faculty, mine, { courseId: 11 }), NOT_ASSIGNED);
});

test('older syllabi without a course id are matched by course code, ignoring case and spaces', () => {
  assert.strictEqual(courseLockReason(faculty, mine, { courseCode: ' it 101 ' }), '');
  assert.strictEqual(courseLockReason(faculty, mine, { courseCode: 'IT 204' }), NOT_ASSIGNED);
});

test('a faculty member with nothing assigned is told so', () => {
  assert.strictEqual(courseLockReason(faculty, none, { courseCode: 'IT 101' }), NOTHING_ASSIGNED);
  assert.strictEqual(courseLockReason(faculty, none, { courseCode: '' }), NOTHING_ASSIGNED);
  assert.strictEqual(courseLockReason(faculty, mine, { courseCode: '' }), '');
});

test('the assignment state tells nothing, program-only and ready apart', () => {
  assert.strictEqual(assignmentState(none), 'none');
  assert.strictEqual(assignmentState(programOnly), 'noSubject');
  assert.strictEqual(assignmentState(mine), 'ok');
  assert.strictEqual(assignmentState(null), null);
  assert.strictEqual(assignmentState({ unrestricted: true, programIds: [], courseIds: [], courses: [] }), null);
});

test('a program without a subject yet says so, instead of claiming nothing is assigned', () => {
  assert.strictEqual(courseLockReason(faculty, programOnly, { courseCode: '' }), NO_SUBJECT_YET);
  assert.strictEqual(courseLockReason(faculty, programOnly, { courseCode: 'IT 101' }), NO_SUBJECT_YET);
});

test('nothing is blocked while the assignments load, and admins are never blocked', () => {
  assert.strictEqual(courseLockReason(faculty, null, { courseId: 99 }), '');
  assert.strictEqual(courseLockReason({ id: 1, role: 'admin' }, none, { courseId: 99 }), '');
  assert.strictEqual(courseLockReason(faculty, { unrestricted: true, programIds: [], courseIds: [], courses: [] }, { courseId: 99 }), '');
});
