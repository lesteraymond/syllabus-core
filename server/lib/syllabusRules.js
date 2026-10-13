// Who may do what with a syllabus. Used by every write route in routes/syllabi.js.
// `user` is the session user ({ id, role }); `syllabus` is a syllabi row ({ user_id, status }).

// An owner may edit while the syllabus is in one of these statuses (approved and rejected are locked).
// Keep in sync with src/lib/syllabusRules.js on the client.
const EDITABLE_STATUSES = ['draft', 'submitted', 'under_review', 'for_revision'];
// Statuses an admin may set. 'draft' is the owner's alone: it is never settable by an admin and drafts are invisible to admins.
const STATUSES = ['submitted', 'under_review', 'for_revision', 'approved', 'rejected'];

const isOwner = (user, syllabus) => user.id === syllabus.user_id;
const isAdmin = (user) => user.role === 'admin';

const canView = (user, syllabus) => isOwner(user, syllabus) || (isAdmin(user) && syllabus.status !== 'draft');
const canDelete = canView;
const canEdit = (user, syllabus) => isOwner(user, syllabus) && EDITABLE_STATUSES.includes(syllabus.status);
const canChangeStatus = isAdmin; // under_review / approved / for_revision / rejected

// An owner edit keeps submitted / under_review as they are; a for_revision edit is a resubmission, and saving a draft as a version submits it.
const statusAfterOwnerEdit = (status) => (status === 'for_revision' || status === 'draft' ? 'submitted' : status);

// 'v1.0' -> 'v1.1'. Tolerates the doubled prefix ('vv1.1') an old client-side bump left in some rows;
// anything else unparseable restarts at v1.0.
function nextVersionLabel(label) {
  const m = /^v*(\d+)\.(\d+)$/.exec(String(label || ''));
  return m ? `v${m[1]}.${Number(m[2]) + 1}` : 'v1.0';
}

module.exports = { isOwner, isAdmin, EDITABLE_STATUSES, STATUSES, canView, canEdit, canDelete, canChangeStatus, statusAfterOwnerEdit, nextVersionLabel };
