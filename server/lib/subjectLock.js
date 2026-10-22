// One syllabus for each subject for each person. An administrator assigns a subject to one faculty member (lib/assignments.js) and
// reassigns it to change who writes it, so the syllabus on a subject belongs to whoever it is assigned to. A draft may take a subject only
// when this person has no other syllabus on it, in any state: a draft, submitted, under review, returned for revision, approved or
// rejected (a returned or rejected one is edited and sent again, not replaced by a new draft). What another person wrote for the subject
// earlier is theirs, so it does not block the person it is reassigned to. The check runs where a draft gets its subject
// (PUT /:id/content), inside that save's transaction, where the subject row is already locked, so two tabs cannot both claim it. Drafts that
// already share a subject are left alone (and an archived syllabus, from before the subject was reassigned, is a record: it does not count): the rule applies when a subject is chosen, not to rows that exist.
const { httpError } = require('./http');

const LABELS = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', for_revision: 'For Revision', approved: 'Approved', rejected: 'Rejected' };

// `others` are the syllabi on the subject other than the one being saved: [{ syllabus_id, user_id, status }]. Returns null, or what blocks.
function conflictFor(others, me) {
  const mine = (others || []).filter((r) => r.user_id === me.id);
  // When there are several, report the furthest along (not a draft), so the message is the useful one.
  const held = mine.find((r) => r.status !== 'draft') || mine[0];
  return held ? { id: held.syllabus_id, status: held.status } : null;
}

function messageFor(conflict) {
  if (conflict.status === 'draft') return 'You already have a draft for this subject. Open it from My Syllabi instead of starting another.';
  const next = conflict.status === 'for_revision' || conflict.status === 'rejected' ? ' to edit and submit it again' : '';
  return `You already have a syllabus for this subject (${LABELS[conflict.status] || conflict.status}). Open it from My Syllabi${next}.`;
}

// For the builder's subject list: which of these subjects the person already has a syllabus on. `rows` are syllabi on those subjects
// ({ syllabus_id, course_id, user_id, status }). Returns Map(courseId -> { status }); a free subject is not in it.
function takenBySubject(rows, me) {
  const byCourse = new Map();
  for (const r of rows || []) { if (!byCourse.has(r.course_id)) byCourse.set(r.course_id, []); byCourse.get(r.course_id).push(r); }
  const out = new Map();
  for (const [courseId, list] of byCourse) { const c = conflictFor(list, me); if (c) out.set(courseId, { status: c.status }); }
  return out;
}

async function assertSubjectFree(conn, me, courseId, exceptId) {
  if (!courseId) return;
  const [others] = await conn.query('SELECT syllabus_id, user_id, status FROM syllabi WHERE course_id = ? AND syllabus_id <> ? AND user_id = ? AND archived_at IS NULL', [courseId, exceptId, me.id]);
  const conflict = conflictFor(others, me);
  if (conflict) throw httpError(409, messageFor(conflict), { code: 'syllabus_exists', existingId: conflict.id, existingStatus: conflict.status });
}

module.exports = { conflictFor, messageFor, takenBySubject, assertSubjectFree };
