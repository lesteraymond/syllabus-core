// Who may do what with a syllabus. Used by every write route in routes/syllabi.js.
// `user` is the session user ({ id, role }); `syllabus` is a syllabi row ({ user_id, status }).

// An owner may edit only a draft, or a syllabus the administrator returned for revision. Once submitted it is locked (so what the
// administrator checks and reviews cannot change underneath them); it opens again only when the administrator selects "For revision",
// and a resubmission goes to the AI Checker queue again. Approved and rejected are final.
// Keep in sync with src/lib/syllabusRules.js on the client.
const EDITABLE_STATUSES = ['draft', 'for_revision'];
// Statuses an admin may set. 'draft' is the owner's alone: it is never settable by an admin and drafts are invisible to admins.
const STATUSES = ['submitted', 'under_review', 'for_revision', 'approved', 'rejected'];

const isOwner = (user, syllabus) => user.id === syllabus.user_id;
const isAdmin = (user) => user.role === 'admin';

const canView = (user, syllabus) => isOwner(user, syllabus) || (isAdmin(user) && syllabus.status !== 'draft');
// Faculty may discard only their own drafts. Keep existing administrator access unchanged.
const canDelete = (user, syllabus) => (isAdmin(user) && canView(user, syllabus))
  || (user.role === 'faculty' && isOwner(user, syllabus) && syllabus.status === 'draft');
const canEdit = (user, syllabus) => isOwner(user, syllabus) && EDITABLE_STATUSES.includes(syllabus.status);
const canChangeStatus = isAdmin; // under_review / approved / for_revision / rejected

// A for_revision edit is a resubmission, and saving a draft as a version submits it. (A submitted or under-review syllabus cannot be edited.)
const statusAfterOwnerEdit = (status) => (status === 'for_revision' || status === 'draft' ? 'submitted' : status);

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
const lockedMessage = (syllabus) => (syllabus.status === 'submitted' || syllabus.status === 'under_review'
  ? 'This syllabus was submitted and is locked. It can be edited again only if the administrator returns it for revision.'
  : `This syllabus is ${String(syllabus.status).replace('_', ' ')} and can no longer be edited`);

module.exports = { MIN_NOTE, UNCHANGED, NEED_NOTE, lockedMessage, isOwner, isAdmin, EDITABLE_STATUSES, STATUSES, canView, canEdit, canDelete, canChangeStatus, statusAfterOwnerEdit, nextVersionLabel };
