'use strict';
// A syllabus is submitted, and approved, only with a subject that exists, is the subject its form names, and belongs to the syllabus's program and academic year.
// It is checked against the database each time, inside the transaction that changes the status, after that transaction has locked the syllabus row (FOR UPDATE).
// Deleting a subject sets syllabi.course_id to NULL in the deletion's own transaction (ON DELETE SET NULL), and that update has to wait for the same row lock:
// so the course_id read under the lock is the committed one, and it stays so until the status change commits. Nothing locks the subject row here, so a subject
// deletion and a submission or approval cannot deadlock: each waits for the syllabus row, then sees what the other committed.
const { httpError } = require('./http');
const { currentLabel } = require('./academicYear');

const CODES = { REQUIRED: 'subject_required', MISMATCH: 'subject_mismatch' };
const MESSAGES = {
  submit: {
    subject_required: 'This syllabus has no valid subject. Choose an existing subject in Step 1, save, then submit again.',
    subject_mismatch: 'The subject of this syllabus does not match its program or academic year. Choose the correct subject in Step 1, save, then submit again.',
  },
  approve: {
    subject_required: 'This syllabus has no valid subject, so it cannot be approved. Return it for revision so the author can choose an existing subject.',
    subject_mismatch: 'The subject of this syllabus does not match its program or academic year, so it cannot be approved. Return it for revision so the author can choose the correct subject.',
  },
};
const refuse = (stage, code) => httpError(409, MESSAGES[stage][code], { code });
const norm = (value) => String(value ?? '').trim().toUpperCase();

// A program renamed after the syllabus was saved keeps its old code as an alias (lib/programManagement.js rename).
async function isAliasOf(conn, programId, code) {
  try {
    const [rows] = await conn.query('SELECT 1 FROM program_code_aliases WHERE program_id = ? AND UPPER(code) = ? LIMIT 1', [programId, code]);
    return rows.length > 0;
  } catch (error) {
    if (error && error.code === 'ER_NO_SUCH_TABLE') return false;
    throw error;
  }
}

// syl: the syllabus row, locked by the caller. content: the form being submitted or approved. stage: 'submit' or 'approve'. Throws 409 with a code, or returns the subject.
async function assertValidSubject(conn, syl, content, stage) {
  if (!MESSAGES[stage]) throw new Error('unknown stage ' + stage);
  const courseId = syl.course_id === null || syl.course_id === undefined ? null : Number(syl.course_id);
  if (!Number.isInteger(courseId) || courseId <= 0) throw refuse(stage, CODES.REQUIRED);
  const [rows] = await conn.query('SELECT c.course_id AS subject_id, c.code AS subject_code, p.* FROM courses c JOIN programs p ON p.program_id = c.program_id WHERE c.course_id = ?', [courseId]);
  const subject = rows[0];
  if (!subject) throw refuse(stage, CODES.REQUIRED);
  // The form must name this very subject: a stored code or title is not enough, and neither is a subject chosen in the browser but never saved.
  const meta = content && content.meta;
  if (!meta || Number(meta.courseId) !== courseId) throw refuse(stage, CODES.MISMATCH);
  // The program comes from the subject in the database. A form that names a different one contradicts it; a form from before the program was stamped (no
  // meta.program) does not, and is judged by its subject alone.
  const program = norm(meta.program);
  if (program && program !== norm(subject.code) && !(await isAliasOf(conn, subject.program_id, program))) throw refuse(stage, CODES.MISMATCH);
  // The academic year: a subject belongs to its program's year (a program without one is the current year's), a syllabus to the year it was started in.
  if (typeof syl.academic_year === 'string' && syl.academic_year) {
    const year = subject.academic_year || (await currentLabel(conn));
    if (year && year !== syl.academic_year) throw refuse(stage, CODES.MISMATCH);
  }
  return subject;
}

module.exports = { CODES, MESSAGES, assertValidSubject };
