'use strict';
// Where a check's FINAL score was lost, area by area (the dashboard's AI Quality Snapshot). The final score of a check is the coded rules' score (the
// weighted mean of the six areas of standard-v4) minus the AI check's deductions (lib/syllabuscheck/engine.js: alignment, broken reference links, a
// missing core value), each on the 0-100 scale of the overall score. The stored area scores are the rules' only, so they can all read 100 while the AI took
// points off. Here each deduction is charged to the area it is about, and that area's score drops by its share:
//   area after AI = area score − points × (sum of the live areas' weights) / (the area's weight)
// so the weighted mean of the areas after AI is the final score again (until an area reaches 0). Display only: nothing official changes.
//   areas       the run's stored area scores ([{ key | area_key, weight, score }]; score null: the area was not scored)
//   deductions  the run's AI deductions ([{ kind, path, points }]), from its stored report
// -> [{ key, weight, score, rules }] (rules: the area's score before the AI deductions; score: after them)

// Which area a deduction is about, from what it points at.
function areaOf(d) {
  if (!d) return null;
  if (d.kind === 'link') return 'reference_currency';
  if (d.kind === 'value') return 'completeness';
  const path = String(d.path || '');
  if (/refs/.test(path)) return 'reference_currency';
  if (/tasks|assessment|activities|grading/.test(path)) return 'assessment';
  if (/clos|ilos|outcomes/.test(path)) return 'co_po';
  return 'completeness';
}

function finalAreas(areas, deductions) {
  const list = (areas || []).map((a) => ({ key: a.key || a.area_key, weight: Number(a.weight) || 0, rules: a.score === null || a.score === undefined ? null : Number(a.score) }));
  const live = list.filter((a) => a.rules !== null && a.weight > 0);
  const weightSum = live.reduce((s, a) => s + a.weight, 0);
  const lost = new Map();
  for (const d of deductions || []) {
    const key = areaOf(d), points = Number(d && d.points) || 0;
    if (key && points > 0) lost.set(key, (lost.get(key) || 0) + points);
  }
  return list.map((a) => {
    if (a.rules === null || !a.weight || !weightSum) return { ...a, score: a.rules };
    const minus = (lost.get(a.key) || 0) * weightSum / a.weight;
    return { ...a, score: Math.max(0, Math.round(a.rules - minus)) };
  });
}

module.exports = { finalAreas, areaOf };
