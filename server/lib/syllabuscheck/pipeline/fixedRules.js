'use strict';
// Re-planned AI Checker, Phase 1: the rules that need no AI, run on the map from extract.js. Pure and deterministic: the same syllabus always gives
// the same findings. Not wired into the running server and costs no points here (scoring is a later phase).
//
// severity 'finding' : the syllabus breaks a rule; the author must change it.
// severity 'review'  : a person must confirm (for example an older reference that may be a classic); never penalized.
// Every finding names its area (rules.AREAS), its field and where it is, so the repair plan can order fixes top-down (rules.CHAIN).
const R = require('./rules');
const { parseReference } = require('../references');
const { nearCopy, leadingVerbs } = require('./extract');

function finding(rule, severity, area, field, where, message, fix) {
  return { rule, severity, area, field, layer: R.layerOf(field), where, message, ...(fix ? { fix } : {}) };
}
const rowsCovering = (weeks, no) => weeks.filter(w => w.weeks.includes(no));
const weekName = w => 'Week ' + (w.label || '?');

function cloRules(map, out) {
  const { clos, masters } = map;
  if (clos.length !== R.CLO_COUNT) out.push(finding('CLO-COUNT', 'finding', 'clo', 'clo', {}, `The syllabus has ${clos.length} CLO${clos.length === 1 ? '' : 's'}; it must have exactly ${R.CLO_COUNT} (Introductory, Enabling, Demonstrating, Integration of Values, in that order).`));
  const poNos = new Set(masters.pos.map(p => p.no)), egaNos = new Set(masters.egas.map(e => e.no));
  for (const clo of clos) {
    const where = { clo: clo.no, cloId: clo.id };
    if (!clo.statement) out.push(finding('CLO-STATEMENT', 'finding', 'clo', 'clo', where, `CLO ${clo.no} has no statement.`));
    if (clo.requiredLevel && clo.savedLevel !== clo.requiredLevel) out.push(finding('CLO-LEVEL-LABEL', 'finding', 'clo', 'clo', where, `CLO ${clo.no} must be classified "${clo.requiredLevel}" (fixed by its number); it is saved as "${clo.savedLevel || 'none'}".`, { level: clo.requiredLevel }));
    const goodPos = clo.pos.filter(no => poNos.has(no)), goodEgas = clo.egas.filter(no => egaNos.has(no));
    if (!goodPos.length) out.push(finding('CLO-PO-TAG', 'finding', 'clo', 'clo', where, `CLO ${clo.no} is not tagged to any program outcome of this program; it must support at least one PO.`));
    if (!goodEgas.length) out.push(finding('CLO-EGA-TAG', 'finding', 'clo', 'clo', where, `CLO ${clo.no} is not tagged to any graduate attribute (EGA); it must support at least one.`));
    const badPos = clo.pos.filter(no => !poNos.has(no)), badEgas = clo.egas.filter(no => !egaNos.has(no));
    if (badPos.length || badEgas.length) out.push(finding('CLO-UNKNOWN-TAG', 'finding', 'clo', 'clo', where, `CLO ${clo.no} is tagged to ${[...badPos.map(n => 'PO ' + n), ...badEgas.map(n => 'EGA ' + n)].join(', ')}, which ${badPos.length + badEgas.length === 1 ? 'does' : 'do'} not exist for this program.`));
    const reached = map.weeks.some(w => w.ilos.some(ilo => ilo.cloIds.includes(clo.id)));
    if (!reached) out.push(finding('CLO-COVERAGE', 'finding', 'ilo', 'ilo', where, `No ILO in the plan is aligned to CLO ${clo.no}; at least one week must build it.`));
  }
}

function scheduleRules(map, out) {
  const week1 = rowsCovering(map.weeks, R.SCHEDULE.orientationWeek), week2 = rowsCovering(map.weeks, R.SCHEDULE.firstTopicWeek);
  if (!week1.length) out.push(finding('WEEK1-ORIENTATION', 'finding', 'ilo', 'ilo', {}, 'The plan has no Week 1. Week 1 must be the course orientation.'));
  else if (!week1.some(w => w.kind === 'orientation')) out.push(finding('WEEK1-ORIENTATION', 'finding', 'ilo', 'ilo', { week: week1[0].label, row: week1[0].rowId }, 'Week 1 must be the course orientation (vision, mission, course outcomes, requirements, grading, policies); its content and ILO read as a regular topic.'));
  if (!week2.length) out.push(finding('WEEK2-FIRST-TOPIC', 'finding', 'content', 'content', {}, 'The plan has no Week 2. Week 2 starts the first topic.'));
  else {
    const row = week2[0], where = { week: row.label, row: row.rowId };
    if (row.weeks.includes(R.SCHEDULE.orientationWeek)) out.push(finding('WEEK2-FIRST-TOPIC', 'finding', 'content', 'content', where, `Week 2 shares a row with Week 1 (${weekName(row)}). Orientation is Week 1 only; Week 2 starts the first topic.`));
    else if (row.kind === 'exam') out.push(finding('WEEK2-FIRST-TOPIC', 'finding', 'content', 'content', where, 'Week 2 is an examination row; Week 2 starts the first topic.'));
  }
}

function weekRules(map, out) {
  for (const w of map.weeks) {
    const where = { week: w.label, row: w.rowId };
    if (w.kind === 'lesson') {
      if (!w.content.text) out.push(finding('CONTENT-MISSING', 'finding', 'content', 'content', where, `${weekName(w)} has no course content. Content comes first: write the week's topics, then the ILO.`));
      if (!w.ilos.length) out.push(finding('ILO-MISSING', 'finding', 'ilo', 'ilo', where, `${weekName(w)} has no ILO.`));
      for (const ilo of w.ilos) {
        const iloWhere = { ...where, ilo: ilo.id };
        if (!ilo.cloIds.length) out.push(finding('ILO-CLO-TAG', 'finding', 'ilo', 'ilo', iloWhere, `An ILO in ${weekName(w)} is not aligned to any CLO: "${ilo.text}".`));
        else if (ilo.unknownClos.length) out.push(finding('ILO-CLO-TAG', 'finding', 'ilo', 'ilo', iloWhere, `An ILO in ${weekName(w)} is tagged to a CLO that no longer exists: "${ilo.text}".`));
      }
      const options = w.activities.items.length;
      if (options < R.MIN_ACTIVITY_OPTIONS) out.push(finding('ACTIVITY-OPTIONS', 'finding', 'activities', 'activities', where, options ? `${weekName(w)} offers ${options} learning activity; give at least ${R.MIN_ACTIVITY_OPTIONS} alternatives for diverse learners.` : `${weekName(w)} has no learning activities; give at least ${R.MIN_ACTIVITY_OPTIONS} alternatives for diverse learners.`));
      if (!w.tasks.items.length) out.push(finding('TASKS-MISSING', 'finding', 'tasks', 'tasks', where, `${weekName(w)} has no assessment tasks.`));
    }
    if (R.VALUES_REQUIRED_IN === 'all' && !w.values.named.length) out.push(finding('VALUES-WEEKLY', 'finding', 'values', 'values', where, w.values.text
      ? `${weekName(w)} names no core value by its exact name ("${w.values.text}"). Use one of: ${R.VALUE_NAMES.join(', ')}.`
      : `${weekName(w)} has no value. Every week, including orientation and exam weeks, names at least one of: ${R.VALUE_NAMES.join(', ')}.`));
  }
}

// Copied ILOs (DSP re-run, 2026-11-15: the same two ILOs in Weeks 2-3, 4-5 and 7-8). The FIRST occurrence stays; each later one is a finding:
//   within a week  a near copy of an earlier ILO of the same week (extract.js nearCopy)
//   across weeks   the same text (letters and digits, case and punctuation ignored) as an ILO of an earlier week
// An ILO is written from its own week's content, so a repeated one says nothing new about that week. The plan rewrites it (judge.js FIXED_TEXT_RULES).
function duplicateIloRules(map, out) {
  const seen = new Map();
  for (const w of map.weeks) {
    if (w.kind === 'exam') continue;
    w.ilos.forEach((ilo, i) => {
      const where = { week: w.label, row: w.rowId, ilo: ilo.id };
      const norm = ilo.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const twin = w.ilos.slice(0, i).findIndex(o => nearCopy(ilo.text, o.text));
      if (twin >= 0) {
        out.push(finding('ILO-DUPLICATE', 'finding', 'ilo', 'ilo', where, `${weekName(w)} ILO ${i + 1} repeats ILO ${twin + 1} of the same week: "${ilo.text}". Each ILO should state a different outcome.`));
        if (!seen.has(norm)) seen.set(norm, weekName(w)); // later weeks are named against the first week this text appeared in
        return;
      }
      if (seen.has(norm)) out.push(finding('ILO-DUPLICATE', 'finding', 'ilo', 'ilo', where, `${weekName(w)} ILO ${i + 1} repeats an ILO of ${seen.get(norm)}: "${ilo.text}". An ILO is written from its own week's content.`));
      else seen.set(norm, weekName(w));
    });
  }
}

// One observable verb per outcome (owner, 2026-11-17, following the CHED Implementation Handbook for OBE and ISA, rule 7 of writing learning outcomes:
// "Choose only one observable verb/behavior in a statement of outcome; choose the behavior that is of a higher dimension of complexity").
// A CLO or ILO that OPENS with two or more joined verbs ("Define and explain ...") is a finding on its own text; the plan drafts a one-verb rewrite
// (judge.js FIXED_TEXT_RULES). Like every rule of the new checker that needs no AI, it costs no points in official mode.
const BLOOM_RANK = Object.fromEntries(R.BLOOM_ORDER.flatMap((b, i) => b.verbs.split(/,\s*/).map(v => [v, i])));
const higherOf = verbs => [...verbs].sort((a, b) => (BLOOM_RANK[b] ?? -1) - (BLOOM_RANK[a] ?? -1))[0];
const verbAdvice = verbs => {
  const list = verbs.map(v => `"${v}"`).join(verbs.length === 2 ? ' and ' : ', ');
  // name the one to keep only when every verb has a known Bloom level (otherwise the faculty, or the plan's AI rewrite, chooses)
  const keep = verbs.every(v => BLOOM_RANK[v] !== undefined) ? higherOf(verbs) : null;
  return `It uses ${verbs.length} verbs (${list}); CHED advises one observable verb per outcome, the one of higher complexity${keep ? ` (here "${keep}")` : ''}.`;
};
function oneVerbRules(map, out) {
  for (const clo of map.clos) {
    const verbs = leadingVerbs(clo.statement);
    if (verbs.length > 1) out.push(finding('OUTCOME-ONE-VERB', 'finding', 'clo', 'clo', { clo: clo.no, cloId: clo.id, verbs }, `CLO ${clo.no}: ${verbAdvice(verbs)}`));
  }
  for (const w of map.weeks) w.ilos.forEach((ilo, i) => {
    const verbs = leadingVerbs(ilo.text);
    if (verbs.length > 1) out.push(finding('OUTCOME-ONE-VERB', 'finding', 'ilo', 'ilo', { week: w.label, row: w.rowId, ilo: ilo.id, verbs }, `${weekName(w)} ILO ${i + 1}: ${verbAdvice(verbs)}`));
  });
}

function referenceRules(map, out, year) {
  if (!map.references.length) { out.push(finding('REF-NONE', 'finding', 'references', 'references', {}, 'The syllabus lists no references.')); return; }
  for (const ref of map.references) {
    const where = { group: ref.group, ref: ref.id };
    const parsed = parseReference(ref.text, { year });
    const problems = parsed.issues.filter(i => i.severity === 'definite').map(i => i.message);
    if (parsed.format.status === 'FAIL') out.push(finding('REF-APA', 'finding', 'references', 'references', where, `Not in APA 7th format: ${problems.join(' ')}`, parsed.suggestedText ? { text: parsed.suggestedText } : null));
    else if (parsed.format.status === 'NEEDS_REVIEW') out.push(finding('REF-APA', 'review', 'references', 'references', where, 'APA 7th format could not be confirmed for this reference; please check it.'));
    const published = Number((String(parsed.components?.date || '').match(/^(\d{4})/) || [])[1]);
    if (Number.isFinite(published) && published < year - R.REFERENCE_RECENCY_YEARS) out.push(finding('REF-RECENCY', 'review', 'references', 'references', where, `Published ${published}, more than ${R.REFERENCE_RECENCY_YEARS} years ago. Keep it only if it is a classic in the field; otherwise use a newer source.`));
  }
}

// All fixed-rule findings for a map. ctx.year fixes "this year" (tests); defaults to the current year.
function check(map, ctx = {}) {
  const year = Number.isFinite(ctx.year) ? ctx.year : new Date().getFullYear();
  const findings = [];
  cloRules(map, findings);
  scheduleRules(map, findings);
  weekRules(map, findings);
  duplicateIloRules(map, findings);
  oneVerbRules(map, findings);
  referenceRules(map, findings, year);
  findings.sort((a, b) => (a.layer ?? 99) - (b.layer ?? 99));
  const count = severity => findings.filter(f => f.severity === severity).length;
  return { version: R.VERSION, findings, summary: { finding: count('finding'), review: count('review') } };
}

// Every rule check() runs, in the order a syllabus is read. The check coverage list (ruleCoverage.js) shows each one, with no finding as checked and
// passed; coverage.test.js fails when a rule above is missing here.
const RULE_IDS = ['CLO-COUNT', 'CLO-STATEMENT', 'CLO-LEVEL-LABEL', 'CLO-PO-TAG', 'CLO-EGA-TAG', 'CLO-UNKNOWN-TAG', 'CLO-COVERAGE', 'WEEK1-ORIENTATION', 'WEEK2-FIRST-TOPIC',
  'CONTENT-MISSING', 'ILO-MISSING', 'ILO-CLO-TAG', 'ACTIVITY-OPTIONS', 'TASKS-MISSING', 'VALUES-WEEKLY', 'ILO-DUPLICATE', 'OUTCOME-ONE-VERB', 'REF-NONE', 'REF-APA', 'REF-RECENCY'];

module.exports = { check, higherOf, RULE_IDS };
