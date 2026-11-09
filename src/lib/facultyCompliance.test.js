// Run: npm test. The Compliance tab: each faculty member against the subjects the administrator assigned to them (src/lib/facultyCompliance.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { facultyCompliance } from './facultyCompliance.js';

const faculty = [{ id: 5, firstName: 'Ana', lastName: 'Cruz' }, { id: 6, firstName: 'Ben', lastName: 'Go' }, { id: 7, firstName: 'Cy', lastName: 'Dee' }];
const subjects = [1, 2, 3, 4].map((id) => ({ id, code: 'IT 10' + id, title: 'Subject ' + id, program: 'BSIT' })).concat([{ id: 9, code: 'CPE 201', title: 'Logic', program: 'BSCPE' }]);
const holders = [{ courseId: 1, userId: 5 }, { courseId: 2, userId: 5 }, { courseId: 3, userId: 5 }, { courseId: 9, userId: 5 }, { courseId: 4, userId: 6 },
  { courseId: 99, userId: 6 }]; // 99: a subject of another academic year, not on screen

test('each faculty member is measured against their assigned subjects of the year: submitted out of assigned, with what is still missing', () => {
  const syllabi = [
    { userId: 5, courseId: 1, status: 'approved' }, { userId: 5, courseId: 2, status: 'under_review' },
    { userId: 5, courseId: 3, status: 'for_revision' },                       // returned: to submit again, so not counted
    { userId: 6, courseId: 4, status: 'submitted' },
  ];
  const [ana, ben, cy] = facultyCompliance({ faculty, holders, subjects, syllabi });
  assert.deepEqual([ana.name, ana.total, ana.submitted, ana.approved, ana.pct, ana.compliant], ['Ana Cruz', 4, 2, 1, 50, false]);
  assert.deepEqual(ana.programs, ['BSCPE', 'BSIT']);
  assert.deepEqual(ana.missing, [{ code: 'CPE 201', status: null }, { code: 'IT 103', status: 'for_revision' }]);
  assert.deepEqual([ben.total, ben.submitted, ben.pct, ben.compliant], [1, 1, 100, true], 'the other year\'s subject is not counted');
  assert.deepEqual([cy.total, cy.compliant, cy.pct], [0, false, 0], 'nothing assigned: listed last, not compliant');
});

test('a syllabus for a subject that is not assigned to its author, an archived one, or another person\'s does not count', () => {
  const syllabi = [{ userId: 5, courseId: 4, status: 'approved' }, { userId: 6, courseId: 1, status: 'approved' }, { userId: 5, courseId: 1, status: 'approved', archived: true }];
  const [ana] = facultyCompliance({ faculty, holders, subjects, syllabi });
  assert.deepEqual([ana.submitted, ana.approved], [0, 0]);
});

test('with several syllabi for one subject the furthest one counts', () => {
  const syllabi = [{ userId: 6, courseId: 4, status: 'rejected' }, { userId: 6, courseId: 4, status: 'approved' }];
  const ben = facultyCompliance({ faculty, holders, subjects, syllabi }).find((f) => f.userId === 6);
  assert.deepEqual([ben.submitted, ben.approved, ben.missing], [1, 1, []]);
});
