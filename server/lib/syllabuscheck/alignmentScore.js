'use strict';
// AI Alignment Score: a SHADOW score (0-100), computed beside the official score and never used in its place. It never changes the official
// score, the 47 rules, the pass mark, a gate or a submission. It exists so faculty and the VPAA can compare it with the official result on real
// syllabi before anyone decides whether it should count (docs: the checker-improvement rules, "new scoring starts as a shadow").
//
// It is built from the AI's verdicts and organised by the school's Outcome-Based Education rules, five areas with proposed weights:
//   program     CLO <-> PO, CLO <-> EGA, CLO <-> course title, CLO classification                         25
//   lesson      weekly content <-> course title, content -> ILO, ILO <-> CLO                                 25
//   activities  content -> activity, ILO -> activity, activity fit (incl. diverse learners)                  20
//   assessment  ILO -> task, content -> task, activity -> task, assessment fit                               20
//   values      the Augustinian-Marian value of each week, matched to its ILO                                 10
// Credit per verdict: ALIGNED 1, PARTIALLY_ALIGNED 0.5, NOT_ALIGNED 0. A verdict that is missing, unverified or INSUFFICIENT_EVIDENCE earns nothing
// and costs nothing: it lowers COVERAGE instead, and a score whose coverage is below MIN_COVERAGE is reported as provisional, never as final.
// Each FIELD counts once: a CLO is one item whatever number of POs it is tagged with, and it earns its PO credit from its best PO (and its best
// EGA), the "one is enough" rule the engine already applies (engine.js tag groups). The same holds for an ILO and its CLO tags. Several ILOs of
// one week judged against the same activity are averaged into the week's activity item.
// Week 1, Week 2, the course description, the plan sequence and the references are a separate CHECKLIST (completeness, not alignment).

const VERSION = 'alignment-score-2'; // 2: serious problems cap the band
const WEIGHTS = Object.freeze({ program: 25, lesson: 25, activities: 20, assessment: 20, values: 10 });
const MIN_COVERAGE = 0.9;
const CREDIT = { ALIGNED: 1, PARTIALLY_ALIGNED: 0.5, NOT_ALIGNED: 0 };
const BANDS = [{ min: 90, label: 'Excellent' }, { min: 79, label: 'Meets the standard' }, { min: 0, label: 'Needs work' }];
const CAPPED_BAND = 'Needs work';

// type -> [area, how its item is named from the relationship id, component, how several verdicts of one component combine]
const MAX = 'max', MEAN = 'mean';
const clo = id => { const m = /^clo(\d+)-/.exec(id); return m ? `clo${m[1]}` : null; };
const row = id => { const m = /^row(\d+)-/.exec(id); return m ? `row${m[1]}` : null; };
const ilo = id => { const m = /^row(\d+)-ilo(\d+)-/.exec(id); return m ? `row${m[1]}-ilo${m[2]}` : null; };
const MAP = {
  'CLO-PO': ['program', clo, 'po', MAX], 'CLO-anyPO': ['program', clo, 'po', MAX],
  'CLO-EGA': ['program', clo, 'ega', MAX], 'CLO-anyEGA': ['program', clo, 'ega', MAX],
  'Course-CLO': ['program', clo, 'title', MEAN], 'CLO-classification': ['program', clo, 'classification', MEAN],
  'Content-course': ['lesson', row, 'title', MEAN],
  'Content-ILO': ['lesson', ilo, 'content', MAX], 'ILO-content': ['lesson', ilo, 'content', MAX],
  'ILO-CLO': ['lesson', ilo, 'clo', MAX],
  'ILO-activity': ['activities', row, 'ilo', MEAN], 'Content-activity': ['activities', row, 'content', MEAN], 'Activity-fit': ['activities', row, 'fit', MEAN],
  'ILO-assessment': ['assessment', row, 'ilo', MEAN], 'Content-assessment': ['assessment', row, 'content', MEAN],
  'Activity-assessment': ['assessment', row, 'activity', MEAN], 'Assessment-fit': ['assessment', row, 'fit', MEAN],
  'Module-value': ['values', row, 'value', MEAN], 'Value-use': ['values', row, 'value', MEAN],
};
const CHECKLIST = { 'Week1-introduction': 'week1', 'Week2-topic': 'week2', 'Title-description': 'descriptionTitle', 'Description-plan': 'descriptionPlan', 'Plan-sequence': 'planSequence', 'CLO-set': 'cloSet', 'Ref-relevance': 'references', 'REF-plan': 'references' };

const verified = j => Object.hasOwn(CREDIT, j.label) && !j.unverified;

// Serious problems (chosen by the owner, 2026-11-11). While any exists the score stays proportional, but the band is capped at "Needs work".
// Only verified NOT_ALIGNED verdicts count; a problem the AI could not check is never assumed.
//   content_off_subject   a week's course content is not about the course (Content-course NOT_ALIGNED)
//   ilo_unrelated         an ILO is NOT_ALIGNED to EVERY CLO it is tagged to (one CLO it builds is enough, as in the scoring)
//   task_unrelated        an assessment task does not assess what the week teaches (ILO-assessment or Content-assessment NOT_ALIGNED)
//   clo_no_po / clo_no_ega a CLO supports no PO (or no EGA) of the whole list (CLO-anyPO / CLO-anyEGA NOT_ALIGNED)
function seriousProblemsOf(judgements, content) {
  const out = [], seen = new Set();
  const add = (kind, item, relationships) => { const key = `${kind}:${item}`; if (seen.has(key)) return; seen.add(key); out.push({ kind, item, relationships }); };
  const iloTags = new Map();
  for (const j of judgements) {
    const id = String(j.id || '');
    if (j.type === 'ILO-CLO') { const key = ilo(id); if (key) iloTags.set(key, [...(iloTags.get(key) || []), j]); continue; }
    if (!verified(j) || j.label !== 'NOT_ALIGNED') continue;
    if (j.type === 'Content-course') add('content_off_subject', row(id), [id]);
    else if (j.type === 'ILO-assessment' || j.type === 'Content-assessment') add('task_unrelated', row(id), [id]);
    else if (j.type === 'CLO-anyPO') add('clo_no_po', clo(id), [id]);
    else if (j.type === 'CLO-anyEGA') add('clo_no_ega', clo(id), [id]);
  }
  for (const [item, tags] of iloTags) {
    const checked = tags.filter(verified);
    if (checked.length && checked.length === tags.length && checked.every(t => t.label === 'NOT_ALIGNED')) add('ilo_unrelated', item, checked.map(t => t.id));
  }
  // Where each problem is, so the panel can name it: the week as the plan writes it, the CLO by its number.
  return out.map(p => {
    const r = /^row(\d+)/.exec(p.item), c = /^clo(\d+)/.exec(p.item), i = /-ilo(\d+)$/.exec(p.item);
    const week = r && content?.plan?.[Number(r[1])]?.week;
    return { ...p, ...(r ? { rowIndex: Number(r[1]) } : {}), ...(week !== undefined && week !== null ? { week: String(week) } : {}), ...(i ? { ilo: Number(i[1]) + 1 } : {}), ...(c ? { clo: Number(c[1]) + 1 } : {}) };
  });
}
const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
const round1 = x => Math.round(x * 10) / 10;

function alignmentScoreOf(judgements = [], { completed = true, content = null } = {}) {
  // area -> item -> component -> credits
  const items = Object.fromEntries(Object.keys(WEIGHTS).map(area => [area, new Map()]));
  let counted = 0, checked = 0;
  const checklist = {};
  for (const j of judgements) {
    if (CHECKLIST[j.type]) {
      const key = CHECKLIST[j.type], ok = verified(j) ? j.label : 'NOT_CHECKED';
      // The worst answer of the key stands for it (several references: one off-topic reference is what the author must see).
      const rank = { ALIGNED: 0, PARTIALLY_ALIGNED: 1, NOT_ALIGNED: 2, NOT_CHECKED: 3 };
      if (!checklist[key] || rank[ok] > rank[checklist[key]]) checklist[key] = ok;
      continue;
    }
    const spec = MAP[j.type];
    if (!spec) continue;
    const [area, itemOf, component, combine] = spec, item = itemOf(String(j.id || ''));
    if (!item) continue;
    counted++;
    if (!verified(j)) continue;
    checked++;
    const entry = items[area].get(item) || {};
    (entry[component] = entry[component] || { combine, credits: [] }).credits.push(CREDIT[j.label]);
    items[area].set(item, entry);
  }
  const areas = {};
  let earned = 0, possible = 0;
  for (const [area, weight] of Object.entries(WEIGHTS)) {
    const credits = [...items[area].values()].map(components => mean(Object.values(components).map(c => (c.combine === MAX ? Math.max(...c.credits) : mean(c.credits)))));
    if (!credits.length) { areas[area] = { weight, items: 0, points: null, percent: null }; continue; }
    const share = mean(credits);
    areas[area] = { weight, items: credits.length, points: round1(share * weight), percent: Math.round(share * 100) };
    earned += share * weight; possible += weight;
  }
  // An area the check did not reach (its stage was off, or no verdict in it verified) is left out and the rest is scaled to 100, and said so.
  const coverage = counted ? checked / counted : 0;
  const score = possible ? Math.round((earned / possible) * 100) : null;
  const final = completed && score !== null && coverage >= MIN_COVERAGE;
  const seriousProblems = seriousProblemsOf(judgements, content);
  const uncappedBand = final ? BANDS.find(b => score >= b.min).label : null;
  const bandCapped = !!uncappedBand && seriousProblems.length > 0 && uncappedBand !== CAPPED_BAND;
  return {
    version: VERSION, shadow: true, official: false, weights: { ...WEIGHTS }, minCoverage: MIN_COVERAGE,
    score, status: score === null ? 'not_available' : final ? 'shadow' : 'provisional',
    band: bandCapped ? CAPPED_BAND : uncappedBand, ...(bandCapped ? { bandCapped: true, uncappedBand } : {}), seriousProblems,
    coverage: { checked, counted, percent: Math.round(coverage * 100) },
    areas, areasLeftOut: Object.entries(areas).filter(([, a]) => a.points === null).map(([area]) => area),
    checklist,
  };
}

module.exports = { VERSION, WEIGHTS, MIN_COVERAGE, CREDIT, alignmentScoreOf };
