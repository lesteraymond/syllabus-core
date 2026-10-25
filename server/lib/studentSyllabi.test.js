const test = require('node:test');
const assert = require('node:assert');
const { norm, isMajor, currentPerSubject, mySubjects } = require('./studentSyllabi');

test('a subject code is the same with or without spaces and hyphens', () => {
  assert.strictEqual(norm('IT 301'), 'IT301');
  assert.strictEqual(norm('it-301'), 'IT301');
  assert.strictEqual(norm('IT-ELEC3'), 'ITELEC3');
  assert.strictEqual(norm(null), '');
});

test('only IT-xxx, IT-ELECx and CAPSPRO subjects are major', () => {
  for (const code of ['IT-401', 'IT 301', 'IT-ELEC3', 'IT-ELEC4', 'CAPSPRO 2']) assert.strictEqual(isMajor(code), true, code);
  for (const code of ['TH 3', 'GE 101', 'NSTP 1', 'PE 2', 'ITALIAN 1', 'QUANTITATIVE METHODS', '']) assert.strictEqual(isMajor(code), false, code);
});

test('the newest approved syllabus of each subject is kept', () => {
  const rows = [
    { syllabus_id: 9, course_code: 'IT 401' },
    { syllabus_id: 7, course_code: 'IT-402' },
    { syllabus_id: 5, course_code: 'IT-401' },
    { syllabus_id: 4, course_code: '' },
    { syllabus_id: 3, course_code: '' },
  ];
  assert.deepStrictEqual(currentPerSubject(rows).map((r) => r.syllabus_id), [9, 7, 4, 3]);
});

test('my subjects lists major subjects with their syllabus, or null when there is none yet', () => {
  const enrolled = [
    { subject_code: 'CAPSPRO 2', subject_title: 'Capstone Project 2' },
    { subject_code: 'IT-401', subject_title: 'Quantitative Methods' },
    { subject_code: 'IT 401', subject_title: 'Quantitative Methods' },
    { subject_code: 'TH 3', subject_title: 'Ecclesiology' },
    { subject_code: 'IT-ELEC3', subject_title: 'Multimedia' },
  ];
  const current = [{ syllabus_id: 11, course_code: 'IT401' }, { syllabus_id: 12, course_code: 'IT 301' }];
  assert.deepStrictEqual(mySubjects(enrolled, current), [
    { code: 'CAPSPRO 2', title: 'Capstone Project 2', syllabusId: null },
    { code: 'IT-401', title: 'Quantitative Methods', syllabusId: 11 },
    { code: 'IT-ELEC3', title: 'Multimedia', syllabusId: null },
  ]);
});
