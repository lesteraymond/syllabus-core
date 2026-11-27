'use strict';
// The reference a syllabus is checked against for its Step 1 (code, title, pre-requisite, units, year level): the SUBJECT the administrator set up, for any program
// (owner, 2026-11-25; the 2026-11-06 policy that what the administrator saves is the reference). Before, it was a typed copy of the printed curricula
// (syllabus_check_curricula), so a new program or curriculum could not be checked until someone photographed and retyped it. That copy is kept in the database but
// nothing reads it any more. A syllabus without a subject has no reference: it is told to choose one.
//
// The record holds the syllabus's OWN subject only, found by its id: a hyphen, a new code or another subject added to the program never changes which subject it
// is, and only a change of this subject makes a stored check out of date.
const { TERM_COLUMNS, termOf, setUp, withColumnFallbacks } = require('./subjectTerm');
const { COLUMN: CURRICULUM_YEAR_COLUMN, curriculumYearOf } = require('./curriculumYear');
const { COLUMNS: UNIT_COLUMNS, unitsOf } = require('./subjectUnits');
const { normCode, sameCode } = require('./subjectCode');

const BASE = 'SELECT c.course_id, c.code, c.title, c.program_id, p.code AS program_code';
const FROM = 'FROM courses c JOIN programs p ON p.program_id = c.program_id';
const query = (db, where, params) => withColumnFallbacks(db, [
  `${BASE}, ${TERM_COLUMNS}, ${CURRICULUM_YEAR_COLUMN}, ${UNIT_COLUMNS} ${FROM} ${where}`,
  `${BASE}, ${TERM_COLUMNS}, ${CURRICULUM_YEAR_COLUMN} ${FROM} ${where}`,
  `${BASE}, ${TERM_COLUMNS} ${FROM} ${where}`,
  `${BASE} ${FROM} ${where}`,
], params);

// A subject as the checks read it. null = the administrator has not set it: unknown, never "empty". A set-up subject without a pre-requisite has none ('').
function factsOf(row) {
  const term = termOf(row), units = unitsOf(row);
  return {
    code: row.code, title: row.title,
    prereq: term.prerequisite || (setUp(term) ? '' : null),
    lecture: units ? units.lecture : null, lab: units ? units.lab : null,
    yearLevel: term.yearLevel, semester: term.semester,
  };
}

// { record, adminMeta, subjects, subject } or null when the syllabus has no subject.
//   record    the reference, in the shape of an approved curriculum (syllabuscheck/engine.js); origin 'admin'
//   adminMeta the Step 1 values every save restores, as Step 1 keeps them (routes/syllabusContent.js applyCatalog)
//   subjects  the program's subjects, for the generator's background
async function subjectReference(db, content) {
  const meta = (content && content.meta) || {};
  if (!Number.isInteger(meta.courseId)) return null;
  const [[own]] = await query(db, 'WHERE c.course_id = ?', [meta.courseId]);
  if (!own) return null;
  const [rows] = await query(db, 'WHERE c.program_id = ?', [own.program_id]);
  const course = factsOf(own), curriculumYear = curriculumYearOf(own);
  const adminMeta = { title: course.title };
  for (const key of ['prereq', 'yearLevel', 'lecture', 'lab']) if (course[key] !== null) adminMeta[key] = String(course[key]);
  return {
    // the engine selects a reference by the year the syllabus names; which year the subject belongs to is the administrator's, so it is never a mismatch
    record: { id: 'subject:' + own.course_id, origin: 'admin', source: 'Administrator subject list', program: own.program_code, curriculumYear: meta.curriculumYear || curriculumYear || null, status: 'approved', courses: [course] },
    adminMeta,
    subject: { ...course, curriculumYear, program: own.program_code },
    subjects: rows.map((row) => ({ ...factsOf(row), curriculumYear: curriculumYearOf(row) })),
  };
}

// The subjects the generator may know about: the program's, of the same curriculum year or with none set, and the subject and its pre-requisites whatever their year.
function programSubjectsOf(subjects, own) {
  const prerequisite = normCode(own.prereq);
  return (subjects || []).filter((s) => !s.curriculumYear || !own.curriculumYear || s.curriculumYear === own.curriculumYear || sameCode(s.code, own.code) || (normCode(s.code).length >= 3 && prerequisite.includes(normCode(s.code))));
}

module.exports = { subjectReference, programSubjectsOf, factsOf };
