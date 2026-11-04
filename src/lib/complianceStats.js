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
