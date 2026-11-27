import { tr } from "../i18n/index.js";
import { phDate } from './phTime.js';
// Plain helpers for the reviewer's queue and the syllabus modal. No React and no network, so they are tested on their own.
import { STATUS_LABELS } from './syllabusRules.js';
import { STAGES, isApprover, stageOf } from './roles.js';

// A row of GET /api/syllabi, shaped for groupByFacultyProgram / filterRows (src/lib/complianceView.js): faculty member, program,
// subject. A syllabus from the builder has a catalog program (`programCode`); an old upload may only have the curriculum's program
// name (`program`), which then becomes the program's name so the row is still filed somewhere meaningful. `raw` is the original row.
export function toReviewRow(s) {
  return {
    syllabusId: s.id,
    userId: s.userId,
    facultyName: s.faculty || '',
    programCode: s.programCode || '',
    programName: s.programCode ? '' : (s.program || ''),
    courseCode: s.courseCode || '',
    courseTitle: s.courseTitle || s.title || '',
    title: s.title || '',
    status: s.status,
    version: s.version,
    raw: s,
  };
}

// "/uploads/syllabi/data-analytics.pdf" -> "data-analytics.pdf"
export function fileName(path) {
  if (!path) return '';
  const last = String(path).split(/[\\/]/).filter(Boolean).pop() || '';
  try { return decodeURIComponent(last); } catch { return last; }
}

const dateText = (d) => phDate(d); // Philippine time

// One entry of the version picker: "v2 · Submitted · Jan 2, 2026 (current)".
export function versionOption(v, isLatest) {
  return [v.label, tr(STATUS_LABELS[v.statusAtSave] || v.statusAtSave), dateText(v.createdAt)].filter(Boolean).join(' · ') + (isLatest ? ' (' + tr('current') + ')' : '');
}

// "Fay F · BSIT · IT 204 — Computer Programming 2": who, which program, which subject.
export function headline(s) {
  const program = s.programCode || (s.programName && s.programName !== 'No program' ? s.programName : '');
  return [s.facultyName, program || 'No program', [s.courseCode, s.courseTitle].filter(Boolean).join(' — ')].filter(Boolean).join(' · ');
}

// What the modal says when a syllabus has no builder form: the file to open, or that nothing was stored.
export function noFormMessage(file) {
  return file
    ? 'This syllabus was submitted as an uploaded file, so there is no builder form to show. Open the file below.'
    : 'This syllabus has no builder form and no uploaded file stored with it, so there is nothing to show here.';
}

// ---- the review board's cards, and the decision rules the right panel applies ----

// A card shows exactly three things: who submitted, the program, and the subject.
export const programLabel = (row) => (row.programCode ? row.programCode + (row.programName ? ' · ' + row.programName : '') : row.programName || tr('No program'));
export const subjectLabel = (row) => [row.courseCode, row.courseTitle].filter(Boolean).join(' — ') || row.title || tr('Untitled syllabus');

// Only a syllabus that is waiting for a decision can be decided; the board lists exactly those.
export const PENDING = ['submitted', 'under_review'];
export const canDecide = (status) => PENDING.includes(status);
// A submission is checked in the AI Checker first and decided here afterwards. `awaitingAiCheck` is the server's answer for an administrator:
// the newest version has no check of the administrator's own yet. Such a submission is listed in the AI Checker, not on this board.
export const waitsForCheck = (s) => !!s && PENDING.includes(s.status) && !!s.awaitingAiCheck;
export const readyForReview = (s) => !!s && PENDING.includes(s.status) && !s.awaitingAiCheck;

// The review chain. The dean (admin), the Asst. VPAA and the LIC Director each check a submission and clear their own stage (or send it back
// for revision); the VPAA approves once all three are cleared on the newest version. The server decides; these only shape the screens.
//   s.stages           { dean, asst_vpaa, lic_director: { cleared, by, at }, allCleared } (a reviewer's list only)
//   s.myStageCleared   did this reviewer already clear their own stage on the newest version
//   s.readyForApproval all three cleared, and still waiting for the VPAA
//   s.turn             whose turn it is: 'dean', then 'asst_vpaa', then 'lic_director', then 'vpaa' (the chain is cleared in that order)
//   s.myTurn           it is waiting for this reviewer now (their stage is the turn, or for the VPAA all three are cleared)
// When the server sends no turn (an older server) the screens behave as before: a reviewer's own stage, in any order.
// The queue is what needs this person now: a stage reviewer's open checks, or the VPAA's approvals. `rest` is what is still with others.
// A reviewer never checks their own syllabus (a dean who wrote one sends it for review).
export function reviewQueue(list, role, userId) {
  const pending = (list || []).filter((s) => !!s && PENDING.includes(s.status) && s.userId !== userId);
  const open = pending.filter(readyForReview);
  if (isApprover(role)) {
    return {
      queue: open.filter((s) => s.readyForApproval),
      rest: pending.filter((s) => !s.readyForApproval && (!s.awaitingAiCheck || s.myTurn === false)),
    };
  }
  if (!stageOf(role)) return { queue: [], rest: [] };
  const mine = (s) => (s.myTurn === undefined ? !s.myStageCleared : !!s.myTurn);
  return {
    queue: open.filter(mine),
    rest: pending.filter((s) => !mine(s) && (!s.awaitingAiCheck || s.myTurn === false)),
  };
}
// Is it this role's turn on this syllabus? true when the server sends no turn (see above).
export const isMyTurn = (role, s) => !s || s.turn === undefined || s.turn === (isApprover(role) ? 'vpaa' : stageOf(role));
// The stage reviewer may return it for revision only on their turn; the VPAA once it has reached them.
export const canReturnNow = (role, s) => isMyTurn(role, s);
// The stages that have not been cleared yet, in the order the form lists them. [] when nothing is known.
export const openStages = (s) => (s && s.stages ? STAGES.filter((stage) => !s.stages[stage].cleared) : []);
// What the person may do with an open syllabus: the VPAA decides; the others clear their stage or send it back. A reviewer who wrote the
// syllabus themselves can do neither (it is already cleared by authoring).
export const decisionKeysFor = (role) => (isApprover(role) ? ['approve', 'revise', 'reject'] : ['revise']);
export const canClearStage = (role, s, userId) => !!stageOf(role) && !!s && canDecide(s.status) && !s.awaitingAiCheck && !s.myStageCleared && s.userId !== userId && isMyTurn(role, s);
export const canApprove = (role, s) => isApprover(role) && !!s && canDecide(s.status) && !s.awaitingAiCheck && !!(s.stages && s.stages.allCleared);
// The review progress: the three stages and the VPAA, in order, each { key, state, by, at }. state is
//   'cleared'   the stage is cleared on the newest version (or, for the VPAA, approved)
//   'current'   it is with this step now
//   'returned'  this step returned it for revision (or the VPAA rejected it): the resubmission comes back here
//   'waiting'   a later step, not reached yet
// stages: { dean, asst_vpaa, lic_director: { cleared, by, at } } (from the list or GET /:id/stages); status: the syllabus status;
// decision: { action: 'approve'|'reject'|'revision', by, role, at } (the last one), optional; approved: { by, at } (GET /:id/stages), optional.
const ROLE_STEP = { admin: 'dean', asst_vpaa: 'asst_vpaa', lic_director: 'lic_director', vpaa: 'vpaa' };
export const PROGRESS_STEPS = Object.freeze([...STAGES, 'vpaa']);
export function progressSteps(stages, status, decision, approved) {
  if (!stages) return [];
  const pending = PENDING.includes(status);
  const returned = status === 'for_revision' || status === 'rejected';
  const returner = returned && decision && ['revision', 'reject'].includes(decision.action) ? ROLE_STEP[decision.role] || null : null;
  const turn = STAGES.find((s) => !(stages[s] && stages[s].cleared)) || 'vpaa';
  return PROGRESS_STEPS.map((key) => {
    if (key === 'vpaa') {
      if (status === 'approved') {
        const who = approved || (decision && decision.action === 'approve' ? decision : null);
        return { key, state: 'cleared', by: who ? who.by || '' : '', at: who ? who.at || null : null };
      }
      if (returner === 'vpaa') return { key, state: 'returned', by: decision.by || '', at: decision.at || null, action: decision.action };
      return { key, state: pending && turn === 'vpaa' ? 'current' : 'waiting', by: '', at: null };
    }
    const st = stages[key] || {};
    if (returner === key) return { key, state: 'returned', by: decision.by || '', at: decision.at || null, action: decision.action };
    if (st.cleared) return { key, state: 'cleared', by: st.by || '', at: st.at || null };
    return { key, state: pending && turn === key ? 'current' : 'waiting', by: '', at: null };
  });
}

// The owner's list row carries only which stages are cleared ({ dean: true, asst_vpaa: false, lic_director: false }): shaped as stages for progressSteps.
export const stagesFromFlags = (flags) => (flags ? Object.fromEntries(STAGES.map((s) => [s, { cleared: !!flags[s], by: '', at: null }])) : null);

export const CLEAR = { label: 'Clear my check', hint: 'Passes it on to the VPAA once all three have', icon: 'approved', confirm: 'Clear your check of this syllabus? It goes to the VPAA once the dean, the Asst. VPAA and the LIC Director have all cleared it.' };

export const MIN_REASON = 5;
// The three decisions: the label handleStatus expects, whether a written reason is required, and the sentence that asks to confirm.
export const DECISIONS = {
  approve: { status: 'Approved', label: 'Approve syllabus', hint: 'Locks it from further edits', icon: 'approved', reason: false, confirm: 'Approve this syllabus? It will be locked from further edits.' },
  revise: { status: 'For Revision', label: 'Return for revision', hint: 'The faculty member edits and resubmits', icon: 'revise', reason: true, confirm: 'Return this syllabus to the faculty member for revision?' },
  reject: { status: 'Rejected', label: 'Reject', hint: 'Sent back; it can still be edited', icon: 'denied', reason: true, confirm: 'Reject this syllabus? The faculty member is told why and can edit and submit it again.' },
};

// '' when the decision may go ahead, otherwise what is missing. A return for revision or a rejection needs a reason.
export function checkDecision(key, note) {
  const d = DECISIONS[key];
  if (!d) return 'Choose a decision.';
  if (d.reason && String(note == null ? '' : note).trim().length < MIN_REASON) {
    return key === 'reject' ? 'Say why it is rejected (at least ' + MIN_REASON + ' characters).' : 'Say what needs to change (at least ' + MIN_REASON + ' characters).';
  }
  return '';
}

const TYPE_LABELS = { comment: 'Comment', revision: 'Revision request', rejection: 'Rejection', approval: 'Approval' };
export const commentTypeLabel = (type) => TYPE_LABELS[type] || 'Comment';

// Each program gets its own colour so a card is recognised at a glance. The colour comes from the program code, so it is the same
// every time and everywhere (the card, the panel and the window header). Every colour reads on white and on its own tint at 4.5:1 or
// better. A syllabus with no program gets a neutral slate.
export const PROGRAM_COLORS = ['#0b2d8f', '#0f766e', '#8a5a0c', '#6b4bc4', '#b4405c', '#1f7a4d'];
const NEUTRAL = '#5b6475';
const tint = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(', ') + ', ' + alpha + ')';
};
export function programTone(code) {
  const key = String(code == null ? '' : code).trim().toUpperCase();
  if (!key) return { color: NEUTRAL, soft: tint(NEUTRAL, 0.12), index: -1 };
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const index = h % PROGRAM_COLORS.length;
  return { color: PROGRAM_COLORS[index], soft: tint(PROGRAM_COLORS[index], 0.12), index };
}
// What goes on an element's style so CSS can use var(--tone) and var(--tone-soft).
export const toneStyle = (row) => { const t = programTone(row.programCode || (row.programName && row.programName !== 'No program' ? row.programName : '')); return { '--tone': t.color, '--tone-soft': t.soft }; };
