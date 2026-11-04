// What the dashboard and the analytics tab show, worked out from the stored compliance checks (GET /api/compliance: { syllabi: [{ syllabusId, courseCode,
// programCode, status, run: { overall, passed, createdAt, areas: [{ key, score }] } | null }], summary }). Plain functions with no React and no network,
// so the numbers are tested on their own. A syllabus with no score (never checked, too little written, an upload) is left out of every average.

const avg = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
const scoreOf = (row) => (row && row.run && typeof row.run.overall === 'number' ? row.run.overall : null);
const areaScore = (row, key) => { const a = row && row.run && Array.isArray(row.run.areas) ? row.run.areas.find((x) => x.key === key) : null; return a && typeof a.score === 'number' ? a.score : null; };

// The three bands the legends name: High 80-100, Medium 50-79, Low under 50. Counts, as whole-number percentages of the scored ones.
export function bands(scores) {
  if (!scores.length) return { high: 0, med: 0, low: 0 };
  const high = Math.round((scores.filter((s) => s >= 80).length / scores.length) * 100);
  const med = Math.round((scores.filter((s) => s >= 50 && s < 80).length / scores.length) * 100);
  return { high, med, low: Math.max(0, 100 - high - med) };
}

const shortDay = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }); };

// Scores in the order they were checked, at most `max` points (the last ones), as [{ label, value }].
export function trend(rows, max = 6) {
  return rows
    .filter((r) => scoreOf(r) !== null && r.run.createdAt)
    .map((r) => ({ at: new Date(r.run.createdAt).getTime(), value: scoreOf(r), label: shortDay(r.run.createdAt) }))
    .filter((p) => !Number.isNaN(p.at))
    .sort((a, b) => a.at - b.at)
    .slice(-max)
    .map(({ label, value }) => ({ label, value }));
}

// rows: the signed-in user's syllabi with their latest check. `isFaculty` decides the bar chart: one bar per subject, or one per program.
export function buildAnalytics(rows, { isFaculty = false, passThreshold = 79 } = {}) {
  const scored = rows.filter((r) => scoreOf(r) !== null);
  const scores = scored.map(scoreOf);
  const average = avg(scores);
  const area = (key) => avg(scored.map((r) => areaScore(r, key)).filter((v) => v !== null));
  const areas = [['Format', 'template'], ['Complete', 'completeness'], ['CO–PO', 'co_po'], ['Assessment', 'assessment'], ['References', 'reference_currency']]
    .map(([label, key]) => [label, area(key)]);

  let bars;
  if (isFaculty) bars = scored.map((r) => [r.courseCode, scoreOf(r)]);
  else {
    const byProgram = new Map();
    scored.forEach((r) => { const p = r.programCode || 'No program'; byProgram.set(p, [...(byProgram.get(p) || []), scoreOf(r)]); });
    bars = [...byProgram.entries()].map(([p, xs]) => [p, avg(xs)]).sort((a, b) => b[1] - a[1]);
  }

  const lowest = areas.filter(([, v]) => v !== null).sort((a, b) => a[1] - b[1])[0] || null;
  const belowPass = scored.filter((r) => scoreOf(r) < passThreshold).length;
  const waiting = rows.filter((r) => r.status === 'submitted' || r.status === 'under_review').length;
  const returned = rows.filter((r) => r.status === 'for_revision' || r.status === 'rejected').length;
  const unchecked = rows.filter((r) => r.checkable !== false && !r.run).length;
  const best = !isFaculty && bars.length > 1 ? bars[0] : null;

  return {
    average, count: rows.length, scoredCount: scored.length, trend: trend(scored), bands: bands(scores), bars, areas,
    references: { value: area('reference_currency'), ...bands(scored.map((r) => areaScore(r, 'reference_currency')).filter((v) => v !== null)) },
    insights: { lowest, belowPass, waiting, returned, unchecked, best },
  };
}
