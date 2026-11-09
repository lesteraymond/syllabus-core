// Who may do what with a syllabus. Used by every write route in routes/syllabi.js.
// `user` is the session user ({ id, role }); `syllabus` is a syllabi row ({ user_id, status }).

// An owner may edit only a draft, or a syllabus the administrator returned for revision. Once submitted it is locked (so what the
// reviewers check cannot change underneath them); it opens again when the administrator selects "For revision" or
// "Rejected", and a resubmission goes to the AI Checker queue again. Approved is final. A subject has one syllabus for each person (lib/subjectLock.js),
// so a rejected one is edited and sent again rather than replaced by a new draft.
// Keep in sync with src/lib/syllabusRules.js on the client.
// Who reviews and who approves is lib/roles.js: the dean (admin), the Asst. VPAA and the LIC Director check and review; only the VPAA approves.
const roles = require('./roles');
const RETURNED_STATUSES = ['for_revision', 'rejected']; // the administrator sent it back: the next submission is a new version with a note
const EDITABLE_STATUSES = ['draft', ...RETURNED_STATUSES];
const isReturned = (status) => RETURNED_STATUSES.includes(status);
// Statuses a reviewer may set. 'draft' is the owner's alone: it is never settable by a reviewer and drafts are invisible to reviewers.
const STATUSES = ['submitted', 'under_review', 'for_revision', 'approved', 'rejected'];

const isOwner = (user, syllabus) => user.id === syllabus.user_id;
const isAdmin = (user) => user.role === 'admin';
const isReviewer = roles.isReviewer;
const isApprover = roles.isApprover;

const canView = (user, syllabus) => isOwner(user, syllabus) || (isReviewer(user) && syllabus.status !== 'draft');
// Faculty may discard only their own drafts. Keep existing administrator access unchanged.
// An approved syllabus is a protected record: no one deletes it (lib/approvedRecords.js).
const canDelete = (user, syllabus) => syllabus.status !== 'approved' && ((isAdmin(user) && canView(user, syllabus))
  || (user.role === 'faculty' && isOwner(user, syllabus) && syllabus.status === 'draft'));
// A syllabus is archived when its subject is assigned to another faculty member (lib/assignments.js): it stays as a record, read-only.
const isArchived = (syllabus) => !!(syllabus && syllabus.archived_at);
const canEdit = (user, syllabus) => isOwner(user, syllabus) && EDITABLE_STATUSES.includes(syllabus.status) && !isArchived(syllabus);
// The VPAA decides: approved, for_revision or rejected. The dean, the Asst. VPAA and the LIC Director check and review, and may only send a
// syllabus back for revision (with a reason); they clear their own stage instead of approving (routes/reviewChain.js).
const canDecide = isApprover;
const canReturn = (user) => isReviewer(user) && !isApprover(user);
const canSetStatus = (user, status) => (isApprover(user) ? ['approved', 'for_revision', 'rejected', 'under_review'].includes(status) : canReturn(user) && ['for_revision', 'under_review'].includes(status));

// The review decisions a reviewer may record, by the status a syllabus must be in (routes/syllabi.js, PUT /:id). Roles are canSetStatus; this is the state. Approved is final: nothing leaves it.
// A returned syllabus leaves for_revision or rejected only through its author's resubmission (statusAfterOwnerEdit), so a reviewer never sets it back.
const DECISION_FROM = { approved: ['under_review'], rejected: ['submitted', 'under_review'], for_revision: ['submitted', 'under_review'], under_review: ['submitted'] };
const canTransition = (from, to) => (DECISION_FROM[to] || []).includes(from);
const APPROVED_FINAL = 'This syllabus is approved. Approval is final, so its status can no longer change.';
const transitionRefusal = (from, to) => (from === 'approved' ? { message: APPROVED_FINAL, code: 'approved_final' }
  : to === 'approved' ? { message: 'Only a syllabus under review can be approved. A returned syllabus must be submitted again by its author first.', code: 'approval_requires_review' }
    : to === 'under_review' ? { message: 'A returned syllabus goes back to review only when its author submits it again.', code: 'resubmission_required' }
      : { message: 'This syllabus is not waiting for a review decision.', code: 'not_awaiting_decision' });

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

module.exports = { canTransition, transitionRefusal, APPROVED_FINAL, ARCHIVED_MESSAGE, isArchived, MIN_NOTE, UNCHANGED, NEED_NOTE, lockedMessage, isOwner, isAdmin, isReviewer, isApprover, EDITABLE_STATUSES, RETURNED_STATUSES, isReturned, STATUSES, canView, canEdit, canDelete, canDecide, canReturn, canSetStatus, statusAfterOwnerEdit, nextVersionLabel };
