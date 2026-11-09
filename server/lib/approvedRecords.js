'use strict';
// Approved syllabi are protected academic records: nothing in the application deletes one, or removes what its approval rests on. The foreign keys would do it silently, so each
// route that deletes a parent asks here first, in its own transaction, with the rows locked: syllabi.user_id and the approval records cascade from users, and syllabi.course_id and
// curriculum_id are set to NULL. Approving locks the syllabus row too (routes/syllabi.js), so an approval and a deletion of the same record run one after the other, never across each other.
const { httpError } = require('./http');

const CODE = 'approved_records_protected';
const listed = (rows) => rows.slice(0, 20).map((r) => ({ id: r.id, code: r.code, title: r.title }));
const refusal = (message, rows, details) => httpError(409, message, { code: CODE, count: rows.length, affected: listed(rows), ...details });
const SYLLABUS_REFUSED = 'This syllabus is approved and is a protected academic record. It cannot be deleted.';
const syllabusRefused = () => httpError(409, SYLLABUS_REFUSED, { code: CODE, scope: 'syllabus' });
const subjectRefused = (rows) => refusal(`This subject cannot be deleted. Approved syllabi that depend on it: ${rows.length}.`, rows, { scope: 'subject' });
const programRefused = (programCode, rows) => refusal(`${programCode} cannot be deleted. Approved syllabi that depend on it: ${rows.length}.`, rows, { scope: 'program', programCode });
const accountRefused = (rows) => refusal(`This account cannot be deleted. Approved syllabi that depend on it: ${rows.length}.`, rows, { scope: 'account' });

// The approved syllabi of a subject. Every syllabus of the subject is locked, not only the approved ones: one being approved right now is waited for, then read as it ended.
async function approvedOfCourse(conn, courseId) {
  const [rows] = await conn.query('SELECT syllabus_id AS id, course_code AS code, title, status FROM syllabi WHERE course_id = ? FOR UPDATE', [courseId]);
  return rows.filter((row) => row.status === 'approved');
}

// The approved syllabi an account's deletion would damage: those it owns, and those whose versions, review stages, log, comments or checks it wrote, which cascade or lose their author with it.
// Two statements on purpose. FOR UPDATE locks the outer rows only, and a subquery reads a snapshot, so the locks come first: an approval still running finishes, and the second statement sees it.
async function approvedTiedToAccount(conn, userId) {
  await conn.query('SELECT syllabus_id FROM syllabi FOR UPDATE');
  const [rows] = await conn.query(
    "SELECT s.syllabus_id AS id, s.course_code AS code, s.title FROM syllabi s WHERE s.status = 'approved' AND (s.user_id = ?"
    + ' OR EXISTS (SELECT 1 FROM syllabus_versions v WHERE v.syllabus_id = s.syllabus_id AND v.created_by = ?)'
    + ' OR EXISTS (SELECT 1 FROM syllabus_review_stages g WHERE g.syllabus_id = s.syllabus_id AND g.reviewer_id = ?)'
    + ' OR EXISTS (SELECT 1 FROM submission_logs l WHERE l.syllabus_id = s.syllabus_id AND l.user_id = ?)'
    + ' OR EXISTS (SELECT 1 FROM comments c WHERE c.syllabus_id = s.syllabus_id AND c.user_id = ?)'
    + ' OR EXISTS (SELECT 1 FROM ai_check_runs r WHERE r.syllabus_id = s.syllabus_id AND r.created_by = ?))',
    [userId, userId, userId, userId, userId, userId]
  );
  return rows;
}

module.exports = { CODE, SYLLABUS_REFUSED, syllabusRefused, subjectRefused, programRefused, accountRefused, approvedOfCourse, approvedTiedToAccount };
