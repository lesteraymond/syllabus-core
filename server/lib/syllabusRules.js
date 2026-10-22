// Who may do what with a syllabus. Used by every write route in routes/syllabi.js.
// `user` is the session user ({ id, role }); `syllabus` is a syllabi row ({ user_id, status }).

// An owner may edit only a draft, or a syllabus the administrator returned for revision. Once submitted it is locked (so what the
// administrator checks and reviews cannot change underneath them); it opens again when the administrator selects "For revision" or
// "Rejected", and a resubmission goes to the AI Checker queue again. Approved is final. A subject has one syllabus for each person (lib/subjectLock.js),
// so a rejected one is edited and sent again rather than replaced by a new draft.
// Keep in sync with src/lib/syllabusRules.js on the client.
const RETURNED_STATUSES = ['for_revision', 'rejected']; // the administrator sent it back: the next submission is a new version with a note
const EDITABLE_STATUSES = ['draft', ...RETURNED_STATUSES];
const isReturned = (status) => RETURNED_STATUSES.includes(status);
// Statuses an admin may set. 'draft' is the owner's alone: it is never settable by an admin and drafts are invisible to admins.
const STATUSES = ['submitted', 'under_review', 'for_revision', 'approved', 'rejected'];

const isOwner = (user, syllabus) => user.id === syllabus.user_id;
const isAdmin = (user) => user.role === 'admin';

const canView = (user, syllabus) => isOwner(user, syllabus) || (isAdmin(user) && syllabus.status !== 'draft');
// Faculty may discard only their own drafts. Keep existing administrator access unchanged.
const canDelete = (user, syllabus) => (isAdmin(user) && canView(user, syllabus))
  || (user.role === 'faculty' && isOwner(user, syllabus) && syllabus.status === 'draft');
// A syllabus is archived when its subject is assigned to another faculty member (lib/assignments.js): it stays as a record, read-only.
const isArchived = (syllabus) => !!(syllabus && syllabus.archived_at);
const canEdit = (user, syllabus) => isOwner(user, syllabus) && EDITABLE_STATUSES.includes(syllabus.status) && !isArchived(syllabus);
const canChangeStatus = isAdmin; // under_review / approved / for_revision / rejected

// A returned (for revision or rejected) edit is a resubmission, and saving a draft as a version submits it. (A submitted or under-review syllabus cannot be edited.)
const statusAfterOwnerEdit = (status) => (isReturned(status) || status === 'draft' ? 'submitted' : status);

// 'v1.0' -> 'v1.1'. Tolerates the doubled prefix ('vv1.1') an old client-side bump left in some rows;
// anything else unparseable restarts at v1.0.
function nextVersionLabel(label) {
  const m = /^v*(\d+)\.(\d+)$/.exec(String(label || ''));
  return m ? `v${m[1]}.${Number(m[2]) + 1}` : 'v1.0';
}

// A syllabus returned for revision is submitted again only with a change, and a sentence saying what the change is. A version exists
// only when something changed, so there is nothing to save for an unchanged one.
const MIN_NOTE = 10;
const UNCHANGED = 'Nothing has changed since the version you submitted. Make the changes the reviewer asked for, then submit again.';
const NEED_NOTE = 'Tell the reviewer what you changed (at least a sentence) before you submit again.';

// What the owner is told when a write is refused, so every route says the same thing.
const ARCHIVED_MESSAGE = 'This syllabus is archived because its subject was assigned to another faculty member. You can still read it.';
const lockedMessage = (syllabus) => (isArchived(syllabus) ? ARCHIVED_MESSAGE : syllabus.status === 'submitted' || syllabus.status === 'under_review'
  ? 'This syllabus was submitted and is locked. It can be edited again only if the administrator returns it for revision.'
  : `This syllabus is ${String(syllabus.status).replace('_', ' ')} and can no longer be edited`);

module.exports = { ARCHIVED_MESSAGE, isArchived, MIN_NOTE, UNCHANGED, NEED_NOTE, lockedMessage, isOwner, isAdmin, EDITABLE_STATUSES, RETURNED_STATUSES, isReturned, STATUSES, canView, canEdit, canDelete, canChangeStatus, statusAfterOwnerEdit, nextVersionLabel };
