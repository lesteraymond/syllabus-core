// Program compliance over time (the dashboard's "View analytics" on Program Compliance): for each program, the share of its subjects that have an approved
// syllabus, by day, week or month up to today. Plain logic, tested in programTrend.test.js; src/components/ProgramTrendModal.jsx draws it.
//   programs     the catalog's programs ({ code, name })
//   subjects     the catalog's subjects of the academic year ({ id, program })
//   approvals    when each subject's syllabus was approved ({ courseId, approvedAt }: GET /api/compliance/program-approvals)
//   granularity  'day' | 'week' (default) | 'month': one point a day, a week, or at the end of each month; the last point is always today
//   now          today (tests pass a fixed date)
// -> { granularity, dates: [ISO], series: [{ program, name, slot, total, points: [percent], counts: [approved], approved, percent }],
//      overall: { total, points: [percent], counts: [approved], approved, percent, change }, empty: [{ program, name }] }
//    series: programs with subjects, in code order; `slot` is the program's fixed colour (its place in that order, so a colour follows its program);
//    overall: all those programs' subjects together (change: percentage points since the first point); empty: programs with no subjects yet.

// The chart's line colours, in the fixed order of the reference categorical palette (validated: adjacent colour-blind separation >= 9, normal >= 19.6
// on a white card; three are below 3:1 on white, so the chart carries direct labels, a legend and a table view). Never cycled: past eight programs the
// chart shows the first eight and the table shows all.
export const SERIES_COLORS = Object.freeze(['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']);
export const GRANULARITIES = Object.freeze(['day', 'week', 'month']);

const DAY = 24 * 3600 * 1000;
const WEEK = 7 * DAY;
const MANILA = 8 * 3600 * 1000; // Philippine time is UTC+8 all year
// how far back the chart reaches at least, so a recent first approval still has a little history before it
const MIN_SPAN = { day: 30 * DAY, week: 4 * WEEK, month: 0 };

// The times of the points: from just before the first approval (and at least MIN_SPAN back) to now, one per day / week / month end; now is the last.
function timesOf(granularity, first, end) {
  const out = [];
  if (granularity === 'month') {
    // the end of each month in Philippine time (UTC+8, no daylight saving), from the month before the first approval, then now
    const d = new Date(Math.min(first, end) + MANILA);
    let y = d.getUTCFullYear(), m = d.getUTCMonth() - 1;
    for (;;) {
      const monthEnd = Date.UTC(y, m + 1, 1) - MANILA - 1;
      if (monthEnd >= end) break;
      out.push(monthEnd);
      m += 1; if (m > 11) { m = 0; y += 1; }
    }
    out.push(end);
    return out;
  }
  const stepSize = granularity === 'day' ? DAY : WEEK;
  const start = Math.min(first - stepSize, end - MIN_SPAN[granularity]);
  for (let t = start; t < end; t += stepSize) out.push(t);
  out.push(end);
  return out;
}

export function programTrend({ programs = [], subjects = [], approvals = [], granularity = 'week', now = new Date() }) {
  const grain = GRANULARITIES.includes(granularity) ? granularity : 'week';
  const end = new Date(now).getTime();
  const approvedAt = new Map();
  for (const a of approvals) {
    const t = Date.parse(a && a.approvedAt);
    const id = a && a.courseId != null ? Number(a.courseId) : null;
    if (id !== null && Number.isFinite(t)) approvedAt.set(id, Math.min(t, approvedAt.has(id) ? approvedAt.get(id) : Infinity));
  }
  const first = Math.min(...[...approvedAt.values()].filter((t) => t <= end), end);
  const times = timesOf(grain, first, end);

  const byProgram = new Map();
  for (const p of programs) if (p && p.code) byProgram.set(p.code, { program: p.code, name: p.name || '', ids: [] });
  for (const s of subjects) {
    if (!s || !s.program) continue;
    if (!byProgram.has(s.program)) byProgram.set(s.program, { program: s.program, name: '', ids: [] });
    byProgram.get(s.program).ids.push(Number(s.id));
  }
  const all = [...byProgram.values()].sort((a, b) => a.program.localeCompare(b.program));
  const withSubjects = all.filter((p) => p.ids.length);
  const countAt = (ids, t) => ids.filter((id) => approvedAt.has(id) && approvedAt.get(id) <= t).length;
  const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
  const series = withSubjects.map((p, i) => {
    const counts = times.map((t) => countAt(p.ids, t));
    const approvedNow = counts[counts.length - 1];
    return { program: p.program, name: p.name, slot: i, total: p.ids.length, counts, points: counts.map((c) => pct(c, p.ids.length)), approved: approvedNow, percent: pct(approvedNow, p.ids.length) };
  });
  const totalAll = series.reduce((sum, s) => sum + s.total, 0);
  const overallCounts = times.map((_, i) => series.reduce((sum, s) => sum + s.counts[i], 0));
  const overallPoints = overallCounts.map((c) => pct(c, totalAll));
  const overall = {
    total: totalAll, counts: overallCounts, points: overallPoints,
    approved: overallCounts.length ? overallCounts[overallCounts.length - 1] : 0,
    percent: overallPoints.length ? overallPoints[overallPoints.length - 1] : 0,
    change: overallPoints.length ? overallPoints[overallPoints.length - 1] - overallPoints[0] : 0,
    complete: series.filter((s) => s.total && s.approved === s.total).length, // programs where every subject has an approved syllabus
  };
  return { granularity: grain, dates: times.map((t) => new Date(t).toISOString()), series, overall, empty: all.filter((p) => !p.ids.length).map((p) => ({ program: p.program, name: p.name })) };
}
