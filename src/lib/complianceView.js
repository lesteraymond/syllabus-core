import { phDate, phDateTime, phDayStart, phTime } from './phTime.js';
// Plain helpers for showing a stored compliance run (the shared ComplianceCard, the builder's Review & Check step, the admin overview
// and Review & Approval). No React and no network, so they are tested on their own.
//
// A run, as the server sends it: { id, status: 'scored' | 'insufficient', overall, band, passThreshold, passed, conformant, stale,
// aiStatus: 'none' | 'pending' | 'ok' | 'failed', provider, areas: [{ key, name, weight, score }], findings: [{ id, area, ruleId,
// severity: 'blocking' | 'major' | 'minor', step, path, message }], recommendations: [{ source: 'rule' | 'ai', title, text, step,
// areas, rows, clos, priority, level }], contact }.

export const SOURCE_LABEL = { rule: 'Rule', ai: 'AI' };

// The builder's steps by key: the number and title a finding or recommendation is linked to.
export const STEP_INFO = {
  info: { n: 1, title: 'Course Information' },
  clos: { n: 2, title: 'Learning Outcomes' },
  plan: { n: 3, title: 'Learning Plan' },
  reqs: { n: 4, title: 'Course Requirements' },
  refs: { n: 5, title: 'References' },
  grade: { n: 6, title: 'Grading System' },
  review: { n: 7, title: 'Review & Check' },
};
export const stepLabel = (key) => (STEP_INFO[key] ? 'Step ' + STEP_INFO[key].n + ': ' + STEP_INFO[key].title : '');

// 'none' (never checked), 'insufficient' (not enough written to score) or 'scored'.
export function runState(run) {
  if (!run) return 'none';
  return run.status === 'insufficient' || run.overall === null || run.overall === undefined ? 'insufficient' : 'scored';
}

// 'good' at or above the pass line, 'warn' below it, 'none' when there is no score.
export function tone(score, passThreshold) {
  if (score === null || score === undefined) return 'none';
  return score >= passThreshold ? 'good' : 'warn';
}

export const ringAngle = (score) => Math.max(0, Math.min(100, Number(score) || 0)) * 3.6 + 'deg';

// What the check was made with. Until a model runs it is the "Rule-based check"; recommendations still being written show as pending,
// and a model that failed shows as unavailable (the recommendations are then the rules' own).
export function basis(run) {
  if (!run) return { kind: 'none', label: '', note: '' };
  if (run.aiStatus === 'pending') return { kind: 'pending', label: 'Provisional score', note: 'The rule check is done. The score can still change when the AI has checked the fields, and the recommendations are still being written.' };
  if (run.aiStatus === 'failed') return { kind: 'unavailable', label: 'AI unavailable', note: 'AI suggestions are not available right now, so these recommendations come from the rules.' };
  if (run.aiStatus === 'ok') return { kind: 'ai', label: 'AI-assisted check', note: '' };
  return { kind: 'rule', label: 'Rule-based check', note: '' };
}

export const blockersOf = (run) => (run && run.findings ? run.findings.filter((f) => f.severity === 'blocking') : []);
export const warningsOf = (run) => (run && run.findings ? run.findings.filter((f) => f.severity !== 'blocking') : []);

// How many warnings the author would be submitting with. Only a current run counts: a stale one describes an older syllabus.
export const warningCount = (run) => (run && !run.stale ? warningsOf(run).length : 0);

// One line under the score.
export function headline(run) {
  const st = runState(run);
  if (st === 'none') return 'Not checked yet.';
  if (st === 'insufficient') return 'Not enough written yet to give a score. Fill in more of the form.';
  const blockers = blockersOf(run).length;
  if (blockers) return blockers + ' ' + (blockers === 1 ? 'problem stops' : 'problems stop') + ' this syllabus from being submitted.';
  return run.overall >= run.passThreshold ? 'Meets the standard (pass line ' + run.passThreshold + '%).' : 'Below the pass line of ' + run.passThreshold + '%. You can still submit; the reviewer will see this score.';
}

// Names of the areas a recommendation is about, in the order the run lists them.
export function areaNames(run, rec) {
  const names = new Map((run.areas || []).map((a) => [a.key, a.name]));
  return (rec.areas || []).map((k) => names.get(k) || k);
}

// Findings grouped by area, in the run's area order, skipping areas with none.
export function groupFindings(run) {
  const by = new Map();
  (run.findings || []).forEach((f) => { (by.get(f.area) || by.set(f.area, []).get(f.area)).push(f); });
  return (run.areas || []).filter((a) => by.has(a.key)).map((a) => ({ key: a.key, name: a.name, findings: by.get(a.key) }));
}

// "2026-01-05 10:30:00" or an ISO date -> "Jan 5, 2026", in Philippine time; anything unreadable -> ''.
export const when = (createdAt) => phDate(createdAt);

// "3:42 PM" in Philippine time: the time a run was stored; anything unreadable -> ''.
export const timeOf = (createdAt) => phTime(createdAt);
export const stamp = (createdAt) => phDateTime(createdAt);

// ---- the history's date filter ----
// A range is two 'YYYY-MM-DD' strings from <input type="date">; either may be empty. The server wants instants: the start of the first day and
// the start of the day after the last, in Philippine time, so "Oct 14" means Oct 14 in Manila for every admin.
// -> { from, to } as ISO strings (null for an open side), or null when a date is unreadable or the range ends before it starts.
export function rangeToInstants(fromDate, toDate) {
  const a = fromDate ? phDayStart(fromDate) : null;
  const b = toDate ? phDayStart(toDate, 1) : null;
  if ((fromDate && !a) || (toDate && !b)) return null;
  if (a && b && a >= b) return null;
  return { from: a ? a.toISOString() : null, to: b ? b.toISOString() : null };
}
const dayLabel = (ymd) => { const d = phDayStart(ymd); return d ? phDate(d) : ''; };
export function rangeLabel(fromDate, toDate) {
  const a = dayLabel(fromDate);
  const b = dayLabel(toDate);
  if (a && b) return fromDate === toDate ? a : a + ' – ' + b;
  if (a) return 'Since ' + a;
  if (b) return 'Until ' + b;
  return '';
}

// An approved syllabus is final: it is not checked again, but its stored checks can still be read.
export const isLocked = (row) => !!row && row.status === 'approved';

// The checker's queue: a submitted syllabus the administrator has not checked yet (the run a faculty member's own submit stored is not
// one: the list only carries the administrator's own checks), or whose check is out of date because a new version was submitted since.
// Once it is checked it moves to the history; an approved one is final and lives in the Repository. An uploaded file belongs here too.
export const needsCheck = (row) => !!row && !isLocked(row) && (!row.run || !!row.run.stale);

// Whether the check can be run now. A syllabus built in the form can. An uploaded file will be checked by matching it to the template,
// which needs the AI service: until that is switched on it waits in the queue. This is the one place to change when it is.
export const canCheckNow = (row) => !!row && !!row.checkable;

// A compact score for a list row: "92%" or "—".
export const scoreText = (run) => (runState(run) === 'scored' ? run.overall + '%' : '—');

// The label of the check across a list of runs: "Rule-based check" until a model has run on at least one of them.
export const listBasis = (runs) => (runs.some((r) => r && r.aiStatus === 'ok') ? 'AI-assisted check' : 'Rule-based check');

// ---- the admin's list: one row per submitted syllabus, with who wrote it, for which program and subject ----
// A row, as GET /api/compliance?syllabus=all sends it: { syllabusId, userId, facultyName, programCode, programName, courseCode,
// courseTitle, title, status, version, checkable, run }. `checkable` is false for a syllabus submitted as an uploaded file: it has
// no builder form, so the rule check has nothing to read.

// 'uploaded' (nothing to check), 'unchecked' (checkable, no run yet), 'insufficient' or 'scored'.
export function rowState(row) {
  if (!row.checkable) return 'uploaded';
  if (!row.run) return 'unchecked';
  return runState(row.run);
}

// The button on a row, and in the page header for one syllabus: Check the first time, Re-check afterwards, none for an upload.
export const actionLabel = (row) => (!row || !row.checkable ? null : row.run ? 'Re-check' : 'Check');

// Syllabi that have a form and no check yet: what "Check unchecked" runs.
export const bulkTargets = (rows) => rows.filter((r) => r.checkable && !r.run);

const norm = (s) => String(s == null ? '' : s).toLowerCase();

// q: text matched against faculty, program, subject code and title. status: 'all' or a syllabus status.
// needs: 'all' | 'unchecked' | 'below' (scored under the pass line) | 'stale' (changed since the check).
export function filterRows(rows, { q = '', status = 'all', needs = 'all' } = {}) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  return rows.filter((r) => {
    if (status !== 'all' && r.status !== status) return false;
    if (needs === 'unchecked' && !(r.checkable && !r.run)) return false;
    if (needs === 'below' && !(r.run && r.run.overall !== null && r.run.overall < r.run.passThreshold)) return false;
    if (needs === 'stale' && !(r.run && r.run.stale)) return false;
    const hay = norm([r.facultyName, r.programCode, r.programName, r.courseCode, r.courseTitle, r.title].join(' '));
    return words.every((w) => hay.indexOf(w) > -1);
  });
}

const byText = (a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
const avgOf = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

// Faculty -> program -> subject, each level sorted by name. A faculty member's header carries how many syllabi they have and the
// average of the scored ones; a program with no code or name is "No program". Never mutates the rows.
export function groupByFacultyProgram(rows) {
  const faculty = new Map();
  rows.forEach((r) => {
    const fKey = String(r.userId) + '|' + (r.facultyName || '');
    if (!faculty.has(fKey)) faculty.set(fKey, { key: fKey, userId: r.userId, facultyName: r.facultyName || 'Unknown faculty', programs: new Map() });
    const f = faculty.get(fKey);
    const pKey = r.programCode || (r.programName ? 'name:' + r.programName : '—'); // an old upload has a program name but no code
    if (!f.programs.has(pKey)) f.programs.set(pKey, { key: fKey + '|' + pKey, code: r.programCode || '', name: r.programName || (r.programCode ? '' : 'No program'), rows: [] });
    f.programs.get(pKey).rows.push(r);
  });
  return [...faculty.values()]
    .map((f) => {
      const programs = [...f.programs.values()]
        .map((p) => ({ ...p, rows: [...p.rows].sort((a, b) => byText(a.courseCode, b.courseCode) || a.syllabusId - b.syllabusId) }))
        .sort((a, b) => (!a.code - !b.code) || byText(a.code, b.code) || (a.name === 'No program') - (b.name === 'No program') || byText(a.name, b.name)); // no program goes last
      const all = programs.flatMap((p) => p.rows);
      const scored = all.filter((r) => r.run && r.run.overall !== null && r.run.overall !== undefined);
      return { key: f.key, userId: f.userId, facultyName: f.facultyName, count: all.length, scored: scored.length, average: avgOf(scored.map((r) => r.run.overall)), programs };
    })
    .sort((a, b) => byText(a.facultyName, b.facultyName));
}
