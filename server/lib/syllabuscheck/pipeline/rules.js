'use strict';
// Re-planned AI Checker, Phase 1: the owner's rules as DATA, so every later stage (fixed rules, AI judgment, repair plan, verification) reads one
// definition instead of each stage carrying its own wording. Nothing here calls a model, reads the database or changes a score. Not wired into the
// running server: the current checker (engine.js) is unchanged.
//
// Source of the rules: the owner's statement of 2026-11-12 and the answers to the six rule questions the same day (see
// docs/ai-checker-replan.md). Change a rule here and the version below, never in a prompt.

const VERSION = 'replan-rules-1';

// The six core Augustinian-Marian values (same list and order as values.js, which the current checker uses).
const { VALUE_NAMES } = require('../values');

// CLO n carries a fixed classification by its number (1..4). Exactly four CLOs.
const CLO_COUNT = 4;
// Bloom's revised taxonomy, lowest to highest, with typical verbs. The Bloom levels of each CLO classification below were derived from the owner's
// labels (Foundational Knowledge; Skill Development / Evaluate; Application / Create; Ethics & Responsibility / Evaluate & Create) and CONFIRMED by
// the owner on 2026-11-12 (BLOOM_SOURCE). Change them only with the owner's decision.
const BLOOM_ORDER = Object.freeze([
  { level: 'remember', verbs: 'define, list, identify, recall' },
  { level: 'understand', verbs: 'explain, describe, summarize, classify' },
  { level: 'apply', verbs: 'use, implement, solve, demonstrate, write' },
  { level: 'analyze', verbs: 'analyze, compare, differentiate, examine' },
  { level: 'evaluate', verbs: 'evaluate, judge, justify, critique' },
  { level: 'create', verbs: 'design, create, develop, construct' },
]);
const BLOOM_SOURCE = 'derived from the CLO classification labels; confirmed by the owner on 2026-11-12; apply added to CLO 1 by the owner on 2026-11-15';
const CLO_LEVELS = Object.freeze([
  { no: 1, level: 'Introductory', focus: 'Foundational Knowledge', bloom: ['remember', 'understand', 'apply'] }, // apply added by the owner 2026-11-15
  { no: 2, level: 'Enabling', focus: 'Skill Development / Evaluate', bloom: ['apply', 'analyze', 'evaluate'] },
  { no: 3, level: 'Demonstrating', focus: 'Application / Create', bloom: ['apply', 'create'] },
  { no: 4, level: 'Integration of Values', focus: 'Ethics & Responsibility / Evaluate & Create', bloom: ['evaluate', 'create'] },
]);

// The dependency chain: what each field depends on. Judging and repairing both follow this order (top-down); a field is never rewritten to suit a
// field below it. Layer 0 is fixed by the school and never rewritten.
const CHAIN = Object.freeze([
  { layer: 0, field: 'ega', alignsTo: [], rewritable: false, note: 'Given by the school; rarely changes.' },
  { layer: 0, field: 'po', alignsTo: ['ega'], rewritable: false, note: 'Given by the school per program; based on the EGAs.' },
  { layer: 1, field: 'clo', alignsTo: ['courseTitle', 'po', 'ega'], rewritable: true, note: 'Exactly 4, fixed classification by number. Never judged against the course description.' },
  { layer: 2, field: 'content', alignsTo: ['courseTitle'], rewritable: true, note: 'Per week; written before the ILO. Never rewritten to fit an ILO (content first).' },
  { layer: 3, field: 'ilo', alignsTo: ['content', 'clo'], rewritable: true, note: 'Per week; built from that week\'s content and aligned to one CLO. Week 1 is orientation.' },
  { layer: 4, field: 'activities', alignsTo: ['content', 'ilo'], rewritable: true, note: 'At least 2 alternative options per topic week for diverse learners.' },
  { layer: 5, field: 'tasks', alignsTo: ['content', 'activities'], rewritable: true, note: 'Scored against content and activities; the ILO link is advice only.' },
  { layer: 6, field: 'values', alignsTo: ['ilo'], rewritable: true, note: 'Every week, including Week 1 and exam weeks: at least one of the six values that fits the ILO.' },
  { layer: 7, field: 'references', alignsTo: ['courseTitle'], rewritable: false, note: 'APA 7th; mostly within 5 years (older classics go to faculty review); existence looked up, never invented.' },
]);
const layerOf = field => { const row = CHAIN.find(r => r.field === field); return row ? row.layer : null; };

// Schedule rules.
const SCHEDULE = Object.freeze({ orientationWeek: 1, firstTopicWeek: 2 });
// Activities: alternative options a topic week must offer.
const MIN_ACTIVITY_OPTIONS = 2;
// References: recency window in years; older ones are flagged for faculty confirmation, never penalized.
const REFERENCE_RECENCY_YEARS = 5;
// Values: which weeks need one ('all' = every week, including Week 1 orientation and exam weeks).
const VALUES_REQUIRED_IN = 'all';

// ---- the AI checklists ----
// The AI never chooses a verdict. It answers each item yes / no / unclear with a quote from the text as evidence; code sets the verdict (verdictOf).
// `critical: true` means a "no" makes the relationship NOT_ALIGNED; any other "no" makes it PARTIALLY_ALIGNED.
// `scored: false` relationships are advice: shown, never deducted.
// `need: 'any'` (a field tagged to several targets): the best answer counts; a tag that does not fit beside it goes to faculty review, no penalty.
const CHECKLISTS = Object.freeze({
  'CLO-TITLE': { from: 'clo', to: 'courseTitle', area: 'clo', scored: true, items: [
    { id: 'subject', critical: true, ask: 'Does the CLO statement concern the subject named in the course title?' },
  ] },
  'CLO-PO': { from: 'clo', to: 'po', area: 'clo', scored: true, need: 'any', items: [
    { id: 'supports', critical: true, ask: 'Does achieving this CLO build some part of this program outcome?' },
  ] },
  'CLO-EGA': { from: 'clo', to: 'ega', area: 'clo', scored: true, need: 'any', items: [
    { id: 'supports', critical: true, ask: 'Does achieving this CLO contribute to this graduate attribute?' },
  ] },
  'CLO-LEVEL': { from: 'clo', to: 'cloLevel', area: 'clo', scored: true, items: [
    { id: 'verb', critical: false, ask: 'Is the CLO\'s main action verb at the cognitive level of its fixed classification?' },
    { id: 'focus', critical: true, ask: 'Does the CLO describe the focus of its fixed classification (for CLO 4: ethics, values or responsibility)?' },
  ] },
  'CONTENT-TITLE': { from: 'content', to: 'courseTitle', area: 'content', scored: true, items: [
    { id: 'subject', critical: true, ask: 'Are this week\'s topics part of the subject named in the course title?' },
  ] },
  'ILO-CONTENT': { from: 'ilo', to: 'content', area: 'ilo', scored: true, items: [
    { id: 'topic', critical: true, ask: 'Does the ILO name a topic that appears in this week\'s content?' },
    { id: 'within', critical: false, ask: 'Does the ILO stay within this week\'s content (no topic the week does not list)?' },
  ] },
  'CONTENT-SEQUENCE': { from: 'content', to: 'plan', area: 'content', scored: false, items: [
    { id: 'order', critical: false, ask: 'Can this week\'s topics be taught with only the earlier weeks\' topics (nothing needed from a later week)?' },
    { id: 'distinct', critical: false, ask: 'Does this week add something new rather than repeat another week\'s topics?' },
  ] },
  'ILO-CLO': { from: 'ilo', to: 'clo', area: 'ilo', scored: true, need: 'any', items: [
    { id: 'step', critical: true, ask: 'Is the ILO a step toward the CLO (it builds what the CLO asks), without needing to repeat the CLO\'s words?' },
    { id: 'level', critical: false, ask: 'Is the ILO\'s cognitive level at or below the CLO\'s level?' },
    { id: 'student', critical: false, ask: 'Is the ILO written as something the student does (not what the teacher does)?' },
  ] },
  'ACTIVITY-FIT': { from: 'activities', to: ['content', 'ilo'], area: 'activities', scored: true, items: [
    { id: 'content', critical: true, ask: 'Do the activities work on this week\'s content?' },
    { id: 'ilo', critical: false, ask: 'Do the activities let students practise what the ILO asks them to do?' },
    { id: 'diverse', critical: false, ask: 'Do the activities offer at least two alternatives suited to different learners, each fitting the ILO?' },
  ] },
  'TASK-FIT': { from: 'tasks', to: ['content', 'activities'], area: 'tasks', scored: true, items: [
    { id: 'content', critical: true, ask: 'Do the tasks assess this week\'s content?' },
    { id: 'activities', critical: false, ask: 'Do the tasks follow from the activities (they assess what students practised)?' },
  ] },
  'TASK-ILO': { from: 'tasks', to: 'ilo', area: 'tasks', scored: false, items: [
    { id: 'measures', critical: false, ask: 'Would the tasks show whether students reached the ILO?' },
  ] },
  'VALUE-ILO': { from: 'values', to: 'ilo', area: 'values', scored: true, items: [
    { id: 'fits', critical: true, ask: 'Can the named value be practised through this week\'s ILO and activities, or, in the orientation week or an examination week, through the orientation or the examination itself (for example Interiority through honest self-assessment)?' },
  ] },
  'REF-RELEVANCE': { from: 'references', to: 'courseTitle', area: 'references', scored: true, items: [
    { id: 'subject', critical: true, ask: 'Does the source concern the subject of the course?' },
  ] },
});

const VERDICT = Object.freeze({ ALIGNED: 'ALIGNED', PARTIALLY_ALIGNED: 'PARTIALLY_ALIGNED', NOT_ALIGNED: 'NOT_ALIGNED', INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE' });
const ANSWERS = Object.freeze(['yes', 'no', 'unclear']);

// The verdict code sets from the AI's checklist answers ({ itemId: 'yes'|'no'|'unclear' }). A missing or invalid answer for any item gives
// INSUFFICIENT_EVIDENCE: an incomplete answer is never a pass.
function verdictOf(relationship, answers) {
  const list = CHECKLISTS[relationship];
  if (!list) throw new Error('Unknown relationship: ' + relationship);
  const given = answers || {};
  if (list.items.some(item => !ANSWERS.includes(given[item.id]))) return VERDICT.INSUFFICIENT_EVIDENCE;
  if (list.items.some(item => item.critical && given[item.id] === 'no')) return VERDICT.NOT_ALIGNED;
  if (list.items.some(item => given[item.id] === 'no')) return VERDICT.PARTIALLY_ALIGNED;
  if (list.items.some(item => given[item.id] === 'unclear')) return VERDICT.INSUFFICIENT_EVIDENCE;
  return VERDICT.ALIGNED;
}

// ---- scoring ----
// Deductions stay as the current policy (-1 partial, -3 not aligned). Each area loses at most AREA_CAPS points: 5 per area, chosen by the owner on
// 2026-11-15 (at most 35 points from AI findings in all), so one weak area cannot sink the score. INSUFFICIENT_EVIDENCE and advice cost nothing.
const DEDUCTION = Object.freeze({ PARTIALLY_ALIGNED: 1, NOT_ALIGNED: 3 });
const AREAS = Object.freeze(['clo', 'content', 'ilo', 'activities', 'tasks', 'values', 'references']);
const AREA_CAP_POINTS = 5;
const AREA_CAPS = Object.freeze(Object.fromEntries(AREAS.map(area => [area, AREA_CAP_POINTS])));

// Points lost per area from a list of { relationship, verdict }. With `caps` (area -> number | null) each area's loss stops at its cap.
function deductions(results, caps = AREA_CAPS) {
  const lost = Object.fromEntries(AREAS.map(area => [area, 0]));
  for (const { relationship, verdict } of results || []) {
    const list = CHECKLISTS[relationship];
    if (!list || !list.scored) continue;
    lost[list.area] += DEDUCTION[verdict] || 0;
  }
  const capped = Object.fromEntries(AREAS.map(area => [area, Number.isFinite(caps?.[area]) ? Math.min(lost[area], caps[area]) : lost[area]]));
  return { uncapped: lost, capped, total: AREAS.reduce((sum, area) => sum + capped[area], 0) };
}

module.exports = {
  VERSION, VALUE_NAMES, CLO_COUNT, CLO_LEVELS, BLOOM_ORDER, BLOOM_SOURCE, CHAIN, layerOf, SCHEDULE, MIN_ACTIVITY_OPTIONS, REFERENCE_RECENCY_YEARS, VALUES_REQUIRED_IN,
  CHECKLISTS, VERDICT, ANSWERS, verdictOf, DEDUCTION, AREAS, AREA_CAPS, deductions,
};
