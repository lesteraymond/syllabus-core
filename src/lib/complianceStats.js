// The dashboard's compliance numbers, as plain functions (no React, no network) so the counting is tested on its own.
//
// Two different things, kept apart on purpose:
//   AI score      how well the syllabi scored in the AI checker (the latest stored check of each syllabus)
//   approval      how many of the syllabi an administrator has approved
// A row is one syllabus as GET /api/compliance?syllabus=all sends it: { programCode, status, run: { overall } | null }.
// (The syllabus list the app already holds has `program` instead of `programCode` and no run; both are accepted.)
const programOf = (row) => String((row && (row.programCode || row.program)) || '').trim();
const scoreOf = (row) => (row && row.run && Number.isFinite(row.run.overall) ? row.run.overall : null);
const average = (values) => (values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : null);
const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

// Only syllabi with a score count towards an average: one that was never checked, or whose check has no score yet, is not a zero.
export const aiAverage = (rows) => average((rows || []).map(scoreOf).filter((v) => v !== null));

// Approved syllabi as a share of all of them.
export function approval(rows) {
  const list = rows || [];
  const approved = list.filter((row) => row && row.status === 'approved').length;
  return { approved, total: list.length, percent: percent(approved, list.length) };
}

// One entry per program: its average AI score (null when none of its syllabi has one), how many were checked, and its approval share.
// Programs with a score come first, best first; the others follow alphabetically.
export function programScores(rows) {
  const byProgram = new Map();
  for (const row of rows || []) {
    const program = programOf(row);
    if (!program) continue;
    if (!byProgram.has(program)) byProgram.set(program, []);
    byProgram.get(program).push(row);
  }
  return [...byProgram.entries()].map(([program, list]) => {
    const scores = list.map(scoreOf).filter((v) => v !== null);
    const { approved, total, percent: approvedPercent } = approval(list);
    return { program, average: average(scores), checked: scores.length, total, approved, approvedPercent };
  }).sort((a, b) => (a.average === null) - (b.average === null) || (b.average ?? 0) - (a.average ?? 0) || a.program.localeCompare(b.program));
}

// The four areas the dashboard's quality snapshot shows, each with the average of that area over the checked syllabi (null when none).
// `summary.areas` is what the same endpoint returns: [{ key, name, average }].
export const SNAPSHOT_AREAS = ['template', 'completeness', 'co_po', 'assessment'];
export function areaAverages(summary) {
  const areas = (summary && Array.isArray(summary.areas)) ? summary.areas : [];
  return SNAPSHOT_AREAS.map((key) => {
    const found = areas.find((a) => a && a.key === key);
    return { key, average: found && Number.isFinite(found.average) ? found.average : null };
  });
}

// How the scored syllabi spread over the bands the Analytics legend names: high 80-100, medium 50-79, low under 50.
// Shares are of the syllabi that have a score; they always add to 100 (or all zero when nothing is scored).
export function scoreBands(rows) {
  const scores = (rows || []).map(scoreOf).filter((v) => v !== null);
  const count = scores.length;
  if (!count) return { count: 0, high: 0, medium: 0, low: 0 };
  const high = percent(scores.filter((v) => v >= 80).length, count);
  const medium = percent(scores.filter((v) => v >= 50 && v < 80).length, count);
  return { count, high, medium, low: 100 - high - medium };
}

// The administrator's Program Compliance (the dashboard): for each program, how many of its SUBJECTS have an approved syllabus, out of all the subjects
// the program has in the catalog. An approved syllabus counts whether or not it was checked by AI. 100% means every subject of the program has one.
//   programs  the catalog's programs ({ code, name }) — so a program with no approved syllabus, or no subject yet, still shows
//   subjects  the catalog's subjects ({ id, program }) of the same academic year
//   syllabi   the syllabus list ({ courseId, status, archived }); a subject counts once however many approved syllabi it has
//   statuses  which syllabus statuses count (default: approved). A faculty member's own view counts what they have submitted:
//             FACULTY_SUBMITTED (Submitted, Under Review, Approved; not a draft, nor one returned for revision or rejected, which must be submitted again).
// -> [{ program, name, total, approved, percent }] (approved: the subjects that count), in the programs' own order (by code).
export const FACULTY_SUBMITTED = Object.freeze(['submitted', 'under_review', 'approved']);
export function programCoverage(programs, subjects, syllabi, { statuses = ['approved'] } = {}) {
  const approvedSubjects = new Set((syllabi || []).filter((s) => s && statuses.includes(s.status) && !s.archived && s.courseId != null).map((s) => Number(s.courseId)));
  const byProgram = new Map();
  for (const p of programs || []) if (p && p.code) byProgram.set(p.code, { program: p.code, name: p.name || '', total: 0, approved: 0 });
  for (const s of subjects || []) {
    if (!s || !s.program) continue;
    if (!byProgram.has(s.program)) byProgram.set(s.program, { program: s.program, name: '', total: 0, approved: 0 });
    const entry = byProgram.get(s.program);
    entry.total += 1;
    if (approvedSubjects.has(Number(s.id))) entry.approved += 1;
  }
  return [...byProgram.values()].map((e) => ({ ...e, percent: percent(e.approved, e.total) })).sort((a, b) => a.program.localeCompare(b.program));
}

// The dashboard's AI Quality Snapshot: the FINAL AI check score (the coded rules' score minus the AI check's deductions, averaged over the latest check of
// each syllabus), and the four areas after those deductions (server/lib/compliance/finalAreas.js), with the lowest one named: where the score was lost.
//   summary  what GET /api/compliance?syllabus=all returns: { average, areas: [{ key, average (rules), final (after AI) }] }
// -> { final, areas: [{ key, rules, score }], lowest: { key, score } | null } (lowest: only an area below 100)
export function snapshotOf(summary) {
  const areas = (summary && Array.isArray(summary.areas)) ? summary.areas : [];
  const list = SNAPSHOT_AREAS.map((key) => {
    const found = areas.find((a) => a && a.key === key) || {};
    const rules = Number.isFinite(found.average) ? found.average : null;
    return { key, rules, score: Number.isFinite(found.final) ? found.final : rules };
  });
  const scored = list.filter((a) => a.score !== null);
  const low = scored.length ? scored.reduce((min, a) => (a.score < min.score ? a : min)) : null;
  return { final: summary && Number.isFinite(summary.average) ? summary.average : null, areas: list, lowest: low && low.score < 100 ? { key: low.key, score: low.score } : null };
}
