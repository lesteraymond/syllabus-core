// What the deadline screens need that has no browser in it: Philippine-time conversion for the date fields, term labels, which deadline a
// subject's row shows, and the tone of its chip. Plain functions, tested on their own. The server owns the rules (server/lib/deadlines.js);
// this only prepares what it sends for display.

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

// ---- terms ---------------------------------------------------------------------------------------------------------------------------
// A term is stored as one short English text, "2026-2027 · 1st Semester", chosen from two lists (so it is never typed and never misspelt).
// What is shown follows the language; what is stored never does.
export const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'];
export const SEMESTER_KEYS = { '1st Semester': 'deadline.sem.first', '2nd Semester': 'deadline.sem.second', Summer: 'deadline.sem.summer' };
const SEPARATOR = ' · ';

export const termOf = (schoolYear, semester) => schoolYear + SEPARATOR + semester;
export function splitTerm(term) {
  const m = /^(\d{4}-\d{4}) · (.+)$/.exec(String(term || ''));
  return m ? { schoolYear: m[1], semester: m[2] } : null;
}
// The school years to choose from: the one before the current, the current and the next two.
export function schoolYearOptions(startYear) {
  return [startYear - 1, startYear, startYear + 1, startYear + 2].map((y) => y + '-' + (y + 1));
}

// ---- Philippine time <-> the browser's date fields ------------------------------------------------------------------------------------
// <input type="datetime-local"> has no time zone, so it always holds Philippine time here, whatever the computer's own clock says.
export const toInputValue = (iso) => { const ms = Date.parse(iso); return Number.isFinite(ms) ? new Date(ms + PH_OFFSET_MS).toISOString().slice(0, 16) : ''; };
export function fromInputValue(text) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(String(text || ''));
  if (!m) return null;
  const ms = Date.parse(m[1] + 'T' + m[2] + ':00+08:00');
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
export const toDayValue = (iso) => { const v = toInputValue(iso); return v ? v.slice(0, 10) : ''; };
export function fromDayValue(ymd) {
  const m = /^(\d{4}-\d{2}-\d{2})$/.exec(String(ymd || ''));
  if (!m) return null;
  const ms = Date.parse(m[1] + 'T00:00:00+08:00');
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
export const phDayOf = (ms) => new Date(ms + PH_OFFSET_MS).toISOString().slice(0, 10);

// ---- the subject row -----------------------------------------------------------------------------------------------------------------
// A subject can have a deadline for each term. The row shows the one that matters now: the soonest one still ahead, otherwise the most
// recent one that has passed.
export function currentDeadline(list, now = Date.now()) {
  if (!list || !list.length) return null;
  const byDue = [...list].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  return byDue.find((d) => Date.parse(d.dueAt) >= now) || byDue[byDue.length - 1];
}

// How the chip looks: 'none' nobody assigned, 'failed' someone missed it, 'done' everyone has submitted, 'due_today' or 'upcoming'.
export function chipTone(deadline, now = Date.now()) {
  const s = deadline.summary;
  if (!s || s.total === 0) return 'none';
  if (s.failed > 0) return 'failed';
  if (s.waiting === 0) return 'done';
  return phDayOf(now) === phDayOf(Date.parse(deadline.dueAt)) ? 'due_today' : 'upcoming';
}
// Settled: faculty are assigned and every one has submitted. The server says it too (`settled`); this is the same rule for a list in hand.
export const isSettled = (deadline) => chipTone(deadline) === 'done';
// The toast after the administrator clicks Reminder: says who was reminded, or why nobody was. `answer` is the server's { sent, skipped: [{ reason }] };
// `names` are the people the click was for (one name for the bell next to a person, none for the Reminder button, which means everyone pending).
// -> { key, values } for t(), so the wording lives with the other deadline strings.
export function reminderToast(answer, names = []) {
  const sent = answer && answer.sent ? answer.sent : 0;
  if (sent) return names.length === 1 ? { key: 'deadline.toastSentOne', values: { name: names[0] } } : { key: 'deadline.toastSent', values: { count: sent } };
  const reasons = ((answer && answer.skipped) || []).map((s) => s.reason);
  if (reasons.includes('cooldown')) return { key: 'deadline.toastCooling', values: {} };
  if (reasons.includes('submitted')) return { key: 'deadline.toastSubmitted', values: {} };
  return { key: 'deadline.remindNobody', values: {} };
}

export const submittedCount = (summary) => (summary ? summary.submitted + summary.late : 0);

// Deadlines of every subject grouped by subject id, soonest first within each.
export function groupByCourse(list) {
  const map = new Map();
  for (const d of list || []) { if (!map.has(d.courseId)) map.set(d.courseId, []); map.get(d.courseId).push(d); }
  return map;
}

// ---- the dashboard card ---------------------------------------------------------------------------------------------------------------
// The date box of a row: the Philippine day number and the short month name ("30", "Oct").
export function dueParts(iso, locale = 'en') {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return { day: '', month: '' };
  const shifted = new Date(ms + PH_OFFSET_MS);
  return { day: String(shifted.getUTCDate()).padStart(2, '0'), month: shifted.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }) };
}

// What needs attention first. A faculty member's own list: failed, due today, upcoming, then what is already in; within a group, the soonest due.
const FACULTY_RANK = { failed: 0, due_today: 1, upcoming: 2, submitted_late: 3, submitted: 4 };
const ADMIN_RANK = { failed: 0, due_today: 1, upcoming: 2, done: 3, none: 4 };
const byDue = (a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt);
export const sortForFaculty = (list) => [...list].sort((a, b) => (FACULTY_RANK[a.status] - FACULTY_RANK[b.status]) || byDue(a, b));
export const sortForAdmin = (list, now = Date.now()) => [...list].sort((a, b) => (ADMIN_RANK[chipTone(a, now)] - ADMIN_RANK[chipTone(b, now)]) || byDue(a, b));

// The deadline a faculty member's syllabus belongs to: the one for its subject that matters now (see currentDeadline).
export const deadlineOfSyllabus = (deadlines, syllabus, now = Date.now()) =>
  syllabus && syllabus.courseId ? currentDeadline((deadlines || []).filter((d) => d.courseId === syllabus.courseId), now) : null;

// The deadline chip on one My Syllabi card. A deadline is about the subject, and "submitted" is worked out from every version this
// faculty member ever sent for it, so a second syllabus row for the same subject (a new draft beside one already submitted or approved)
// would carry a "Submitted" chip next to its own "Draft" badge. A draft has not been submitted, so on a draft card that answer is left
// out; waiting, due today and failed still show, because they are about the date, and they stay true for a draft.
const SATISFIED = ['submitted', 'submitted_late'];
export const deadlineForCard = (deadlines, syllabus, now = Date.now()) => {
  if (syllabus && syllabus.archived) return null; // a record from before the subject was reassigned: the deadline is the new faculty member's
  const d = deadlineOfSyllabus(deadlines, syllabus, now);
  return d && syllabus.status === 'draft' && SATISFIED.includes(d.status) ? null : d;
};
