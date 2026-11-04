// What the downloaded analytics report says, worked out from the same rows the Analytics tab reads (GET /api/compliance). Plain data in, plain
// data out (no React, no PDF), so the numbers are tested on their own. reportPdf.js only draws what this returns.
import { buildAnalytics } from './analyticsView.js';
import { facultyCompliance, REQUIRED } from './facultyCompliance.js';

const AREAS = [['template', 'Format'], ['completeness', 'Completeness'], ['co_po', 'CO–PO alignment'], ['assessment', 'Assessment'], ['reference_currency', 'References']];
const STATUS_GROUPS = [
  ['Approved', ['approved']],
  ['Submitted, waiting for review', ['submitted', 'under_review']],
  ['For revision', ['for_revision', 'rejected']],
  ['Not yet submitted', ['draft']],
];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const scoreOf = (r) => (r && r.run && typeof r.run.overall === 'number' ? r.run.overall : null);
const areaOf = (r, key) => { const a = r.run && Array.isArray(r.run.areas) ? r.run.areas.find((x) => x.key === key) : null; return a && typeof a.score === 'number' ? a.score : null; };
const avg = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

// "2026-2027" and a semester for a date: the school year starts in June (summer), the first semester is August to December, the second January to May.
export function termAt(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'numeric', timeZone: 'Asia/Manila' }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year').value);
  const month = Number(parts.find((p) => p.type === 'month').value);
  const start = month >= 6 ? year : year - 1;
  const semester = month >= 8 ? '1st Semester' : month >= 6 ? 'Summer' : '2nd Semester';
  return { schoolYear: start + '-' + (start + 1), semester };
}

// The month of each syllabus's latest check, as [{ label, value }] (average score), oldest first, at most `max` months.
function monthly(scored, max = 6) {
  const by = new Map();
  scored.forEach((r) => {
    const d = new Date(r.run.createdAt);
    if (Number.isNaN(d.getTime())) return;
    const p = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'numeric', timeZone: 'Asia/Manila' }).formatToParts(d);
    const y = Number(p.find((x) => x.type === 'year').value);
    const m = Number(p.find((x) => x.type === 'month').value);
    const key = y * 12 + (m - 1);
    by.set(key, [...(by.get(key) || []), scoreOf(r)]);
  });
  return [...by.entries()].sort((a, b) => a[0] - b[0]).slice(-max).map(([key, xs]) => ({ label: MONTHS[key % 12], value: avg(xs) }));
}

// rows: the signed-in user's syllabi with their latest check. `user`: { role, name }.
// `term` ({ schoolYear, semester }) makes it the report of a past term: rows are then the syllabi checked in that term, with their newest check in it.
export function buildReport(rows, { user = {}, now = new Date(), passThreshold = 79, term = null } = {}) {
  const isFaculty = user.role === 'faculty';
  const a = buildAnalytics(rows, { isFaculty, passThreshold });
  const scored = rows.filter((r) => scoreOf(r) !== null);
  const scores = scored.map(scoreOf);
  const below = scored.filter((r) => scoreOf(r) < passThreshold);
  const total = rows.length;

  const statuses = STATUS_GROUPS.map(([label, keys]) => {
    const n = rows.filter((r) => keys.includes(r.status)).length;
    return { label, count: n, share: pct(n, total) };
  });
  // A status this list does not know still counts toward the total, under "Not yet submitted".
  const known = statuses.reduce((s, x) => s + x.count, 0);
  if (known < total) { statuses[3].count += total - known; statuses[3].share = pct(statuses[3].count, total); }

  const band = (label, test) => { const n = scores.filter(test).length; return { label, count: n, share: pct(n, scores.length) }; };
  const distribution = [
    band('High (80–100)', (s) => s >= 80),
    band('Medium (50–79)', (s) => s >= 50 && s < 80),
    band('Low (below 50)', (s) => s < 50),
  ];

  const areas = AREAS.map(([key, label]) => ({ label, value: avg(scored.map((r) => areaOf(r, key)).filter((v) => v !== null)) }));

  const programs = new Map();
  scored.forEach((r) => { const p = r.programCode || 'No program'; programs.set(p, [...(programs.get(p) || []), r]); });
  const byProgram = [...programs.entries()]
    .map(([program, rs]) => ({ program, count: rs.length, average: avg(rs.map(scoreOf)), below: rs.filter((r) => scoreOf(r) < passThreshold).length }))
    .sort((x, y) => y.average - x.average);

  const needAttention = below
    .map((r) => {
      const weakest = AREAS.map(([key, label]) => [label, areaOf(r, key)]).filter(([, v]) => v !== null).sort((x, y) => x[1] - y[1])[0] || null;
      return { code: r.courseCode || '', title: r.courseTitle || r.title || '', faculty: r.facultyName || '', score: scoreOf(r), weakest: weakest ? weakest[0] + ' (' + weakest[1] + '%)' : '—' };
    })
    .sort((x, y) => x.score - y.score);

  const i = a.insights;
  const insights = [];
  if (a.scoredCount) {
    insights.push(`${a.average}% average across ${a.scoredCount} checked ${a.scoredCount === 1 ? 'syllabus' : 'syllabi'}.`);
    if (i.lowest) insights.push(`${i.lowest[0]} is the lowest area, at ${i.lowest[1]}% on average.`);
    insights.push(i.belowPass ? `${i.belowPass} ${i.belowPass === 1 ? 'syllabus is' : 'syllabi are'} below the ${passThreshold}% pass mark.` : 'Every checked syllabus meets the pass mark.');
    insights.push(`${i.waiting} awaiting review, ${i.returned} returned, ${i.unchecked} not checked yet.`);
  }

  return {
    title: 'Syllabus Compliance Report',
    ...(term || termAt(now)),
    historical: !!term,
    generatedAt: now,
    preparedBy: user.name || (isFaculty ? 'Faculty' : 'Administrator'),
    preparedRole: isFaculty ? 'Faculty (own subjects only)' : 'Administrator',
    isFaculty,
    passThreshold,
    summary: { average: a.average, checks: a.scoredCount, passing: scored.length - below.length, below: below.length, assigned: total },
    statuses,
    distribution,
    areas,
    trend: monthly(scored),
    byProgram: isFaculty ? [] : byProgram,
    needAttention,
    insights,
  };
}

// The Faculty Compliance report: how many syllabi each faculty member has submitted against the requirement (facultyCompliance.js).
export function buildFacultyReport(syllabi, { user = {}, now = new Date() } = {}) {
  const faculty = facultyCompliance(syllabi).sort((a, b) => Number(a.compliant) - Number(b.compliant) || String(a.name).localeCompare(String(b.name)));
  return {
    title: 'Faculty Compliance Report',
    ...termAt(now),
    generatedAt: now,
    preparedBy: user.name || (user.role === 'faculty' ? 'Faculty' : 'Administrator'),
    isFaculty: user.role === 'faculty',
    required: REQUIRED,
    summary: {
      faculty: faculty.length,
      compliant: faculty.filter((f) => f.compliant).length,
      behind: faculty.filter((f) => !f.compliant).length,
      counted: faculty.reduce((n, f) => n + f.counted, 0),
      approved: faculty.reduce((n, f) => n + f.approved, 0),
    },
    faculty,
  };
}
