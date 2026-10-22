// Keep EDITABLE_STATUSES in sync with server/lib/syllabusRules.js: the Edit button and the server must agree.
// A draft, or a syllabus the administrator sent back (for revision, or rejected: a subject has one syllabus for each person, so it is edited and sent
// again, not replaced by a new draft). Once submitted it is locked until the administrator sends it back.
export const RETURNED_STATUSES = ['for_revision', 'rejected'];
export const EDITABLE_STATUSES = ['draft', ...RETURNED_STATUSES];
export const isReturned = (status) => RETURNED_STATUSES.includes(status);

// Back from "For revision", a submission needs a sentence saying what changed (the server insists on it too).
export const MIN_NOTE = 10;
export const noteMissing = (status, note) => isReturned(status) && String(note || '').trim().length < MIN_NOTE;

export const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', for_revision: 'For Revision', approved: 'Approved', rejected: 'Rejected' };

// Only the owner edits content, and only while the syllabus is in an editable status.
export const canEditSyllabus = (user, syllabus) => user.id === syllabus.userId && EDITABLE_STATUSES.includes(syllabus.status) && !syllabus.archived;

// Keep in sync with server/lib/syllabusRules.js. Submission records stay in the review workflow.
export const canDeleteSyllabus = (user, syllabus) => (user.role === 'admin' && (user.id === syllabus.userId || syllabus.status !== 'draft'))
  || (user.role === 'faculty' && user.id === syllabus.userId && syllabus.status === 'draft');

export const ARCHIVED_REASON = 'This syllabus is archived because its subject was assigned to another faculty member. You can still read it.';
export const editBlockedReason = (syllabus) => (syllabus.archived ? ARCHIVED_REASON : EDITABLE_STATUSES.includes(syllabus.status)
  ? ''
  : syllabus.status === 'submitted' || syllabus.status === 'under_review'
    ? 'This syllabus was submitted and is locked. You can edit it again only if the administrator sends it back.'
    : `${STATUS_LABELS[syllabus.status] || syllabus.status} syllabi can't be edited`);

// "Subject" is the catalog item (IT 204, Programming 2); in this school a "course" is the program.
export const NOT_ASSIGNED = 'This subject is no longer assigned to you.';
export const NOTHING_ASSIGNED = 'No program or subject is assigned to you yet. Ask an administrator.';
export const NO_SUBJECT_YET = 'A program is assigned to you, but no subject yet. Ask an administrator.';

// Where a faculty member stands, from users.myAssignments(): 'none' (nothing assigned), 'noSubject' (a program but
// no subject yet), 'ok'. null while loading, and for admins (never restricted).
export function assignmentState(mine) {
  if (!mine || mine.unrestricted) return null;
  if (mine.courseIds.length) return 'ok';
  return mine.programIds.length ? 'noSubject' : 'none';
}
export const ASSIGNMENT_MESSAGES = { none: NOTHING_ASSIGNED, noSubject: NO_SUBJECT_YET };

// Why a faculty member cannot edit this syllabus because of their assignments ('' when they can).
// `mine` is the result of users.myAssignments(), or null while it is loading (nothing is blocked then; the server
// has the final say). Admins are never restricted. Mirrors server/lib/assignments.js.
export function courseLockReason(user, mine, syllabus) {
  if (!mine || mine.unrestricted || (user && user.role === 'admin')) return '';
  const code = String(syllabus.courseCode || '').trim().toLowerCase();
  if (syllabus.courseId) return mine.courseIds.includes(syllabus.courseId) ? '' : NOT_ASSIGNED;
  const none = ASSIGNMENT_MESSAGES[assignmentState(mine)] || '';
  if (!code) return none;
  return mine.courses.some((c) => c.code.toLowerCase() === code) ? '' : (none || NOT_ASSIGNED);
}

// Maps an API syllabus row to the shape the builder works with (courseCode -> code, ...).
// Fields the server doesn't store (description, outcomes, ...) are filled in by the builder's defaults.
export function toBuilderShape(s) {
  return {
    syllabusId: s.id,
    status: s.status,
    version: s.version,
    code: s.courseCode,
    title: s.title,
    program: s.program || undefined,
    curriculumId: s.curriculumId,
    fileName: s.filePath ? decodeURIComponent(s.filePath.split('/').pop()) : '',
  };
}

// Approval is a separate administrator decision after reading a completed check of their own draft.
export function canApproveAdminDraft(user, syllabus, run, isLatest = true) {
  return !!(user?.role === 'admin' && syllabus?.userId === user.id && syllabus.status === 'under_review'
    && isLatest && run?.id && run.syllabusId === syllabus.syllabusId && run.createdBy === user.id
    && run.status === 'scored' && run.conformant && !run.stale && ['ok','none'].includes(run.aiStatus));
}
