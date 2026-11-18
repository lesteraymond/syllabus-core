'use strict';
// Re-planned AI Checker, Phase 1: the owner's rules as DATA, so every later stage (fixed rules, AI judgment, repair plan, verification) reads one
// definition instead of each stage carrying its own wording. Nothing here calls a model, reads the database or changes a score. Not wired into the
// running server: the current checker (engine.js) is unchanged.
//
// Source of the rules: the owner's statement of 2026-11-12 and the answers to the six rule questions the same day (see
// docs/ai-checker-replan.md). Change a rule here and the version below, never in a prompt.

// 2: constructive alignment (owner, 2026-11-17): activities and tasks must reach the verb level of the week's ILO, and each CLO's own verb level must
//    be reached by the activities and tasks of at least one week mapped to it (CLO-EVIDENCE). A new version: no answer stored under 1 is reused.
const VERSION = 'replan-rules-2';
// Where the constructive-alignment rule comes from, as the owner stated it on 2026-11-17.
const CONSTRUCTIVE_ALIGNMENT_SOURCE = 'Constructive alignment as the CHED Handbook on Typology, Outcomes-Based Education, and Institutional Sustainability Assessment describes it: the outcome\'s verb must match the teaching-learning activities (TLAs) and the assessment tasks (ATs). Owner decision 2026-11-17: checked each week and each CLO, both TLAs and ATs must match, a mismatch is partly aligned (-1).';

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
const BLOOM_SOURCE = 'derived from the CLO classification labels; confirmed by the owner on 2026-11-12; apply added to CLO 1 by the owner on 2026-11-15; analyze and evaluate added to CLO 3 by the owner on 2026-11-17, after the CHED Implementation Handbook for OBE and ISA (2014): I introduces an outcome, E strengthens it, D demonstrates it';
// The affective domain (Krathwohl, Bloom and Masia, 1964), lowest to highest, with the sample verbs of the CHED Implementation Handbook for OBE and
// ISA (2014), Annex 4 "Recommended Verbs for Writing Learning Outcomes". Only CLO 4 takes affective levels (CLO_LEVELS[3].affective).
const AFFECTIVE_ORDER = Object.freeze([
  { level: 'receive', meaning: 'selectively responds to stimuli', verbs: 'acknowledge, choose, demonstrate awareness, demonstrate tolerance, locate, select' },
  { level: 'respond', meaning: 'responds to stimuli', verbs: 'answer, communicate, comply, contribute, cooperate, discuss, participate willingly, volunteer' },
  { level: 'value', meaning: 'attaches value or worth to something', verbs: 'adopt, assume responsibility, behave according to, choose, commit, express, initiate, justify, propose, show concern' },
  { level: 'organize', meaning: 'conceptualizes the value and resolves conflict between it and other values', verbs: 'adapt, adjust, arrange, balance, classify, conceptualize, formulate, organize, prepare, rank, theorize' },
  { level: 'internalize', meaning: 'integrates the value into a value system that controls behavior', verbs: 'act upon, advocate, defend, exemplify, influence, perform, practice, serve, support' },
]);
const AFFECTIVE_SOURCE = 'CLO 4 takes the affective levels value, organize and internalize besides evaluate and create: owner, 2026-11-17, after the CHED Implementation Handbook for OBE and ISA (2014), "consider the three domains of learning" and Annex 4 (affective verbs)';
// What CHED's curriculum-map stages mean (CHED Implementation Handbook for OBE and ISA, 2014), sent with the CLO rule so the focus is judged by them.
// CLO 4 (Integration of Values) is LCUP's own classification, not a CHED stage.
const CHED_STAGES = Object.freeze({
  Introductory: 'the course introduces students to the outcome',
  Enabling: 'the course strengthens the outcome through practice with supervision',
  Demonstrating: 'students demonstrate the outcome independently, without supervision, in a product, performance or solution',
});
const CLO_LEVELS = Object.freeze([
  { no: 1, level: 'Introductory', focus: 'Foundational Knowledge', bloom: ['remember', 'understand', 'apply'] }, // apply added by the owner 2026-11-15
  { no: 2, level: 'Enabling', focus: 'Skill Development / Evaluate', bloom: ['apply', 'analyze', 'evaluate'] },
  // analyze and evaluate added by the owner 2026-11-17: CHED's "demonstrative" means the outcome is demonstrated independently, with higher-order skills
  // (analyzing, evaluating, creating); the CHED handbook ties no verb range to a stage
  { no: 3, level: 'Demonstrating', focus: 'Application / Create', bloom: ['apply', 'analyze', 'evaluate', 'create'] },
  // the affective levels added by the owner 2026-11-17: a values outcome is often affective ("Advocate ...", "Practice ...", "Commit to ..."); the CHED
  // handbook tells faculty to consider the three domains and lists affective verbs (Annex 4)
  { no: 4, level: 'Integration of Values', focus: 'Ethics & Responsibility / Evaluate & Create', bloom: ['evaluate', 'create'], affective: ['value', 'organize', 'internalize'] },
]);

// The dependency chain: what each field depends on. Judging and repairing both follow this order (top-down); a field is never rewritten to suit a
// field below it. Layer 0 is fixed by the school and never rewritten.
const CHAIN = Object.freeze([
  { layer: 0, field: 'ega', alignsTo: [], rewritable: false, note: 'Given by the school; rarely changes.' },
  { layer: 0, field: 'po', alignsTo: ['ega'], rewritable: false, note: 'Given by the school per program; based on the EGAs.' },
  { layer: 1, field: 'clo', alignsTo: ['courseTitle', 'po', 'ega'], rewritable: true, note: 'Exactly 4, fixed classification by number. Never judged against the course description.' },
  { layer: 2, field: 'content', alignsTo: ['courseTitle'], rewritable: true, note: 'Per week; written before the ILO. Never rewritten to fit an ILO (content first).' },
  { layer: 3, field: 'ilo', alignsTo: ['content', 'clo'], rewritable: true, note: 'Per week; built from that week\'s content and aligned to one CLO. Week 1 is orientation.' },
  { layer: 4, field: 'activities', alignsTo: ['content', 'ilo'], rewritable: true, note: 'At least 2 alternative options per topic week for diverse learners, at the cognitive level of the ILO\'s verb.' },
  { layer: 5, field: 'tasks', alignsTo: ['content', 'activities', 'ilo'], rewritable: true, note: 'Scored against content and activities, and against the cognitive level of the ILO\'s verb (constructive alignment, 2026-11-17). Whether the tasks fully measure the ILO stays advice (TASK-ILO).' },
  { layer: 6, field: 'values', alignsTo: ['ilo', 'activities'], rewritable: true, note: 'Every week, including Week 1 and exam weeks: at least one of the six values that fits the ILO; it may be practised through the activities (judged with both).' },
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
    { id: 'verb', critical: false, ask: 'Is the CLO\'s main action verb at one of the levels of its fixed classification (its Bloom levels, or for CLO 4 also its affective levels)?' },
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
    // the CLO's OWN verb, not the highest level its classification allows (owner, 2026-11-17): under a CLO 1 that says "explain", an "apply" ILO is
    // above it, although Introductory itself allows apply
    // an affective CLO (CLO 4 "Advocate ..."): an affective ILO at or below its level fits, and so does a cognitive ILO (the thinking a value rests on)
    { id: 'level', critical: false, ask: 'Is the ILO\'s level at or below the level of the CLO\'s own main verb (as the CLO is written, not the highest level its classification allows)? When the CLO\'s verb is affective, an affective ILO at or below that affective level fits, and so does a cognitive ILO.' },
    { id: 'student', critical: false, ask: 'Is the ILO written as something the student does (not what the teacher does)?' },
  ] },
  'ACTIVITY-FIT': { from: 'activities', to: ['content', 'ilo'], area: 'activities', scored: true, items: [
    { id: 'content', critical: true, ask: 'Do the activities work on this week\'s content?' },
    // A week may have several ILOs, tagged to different CLOs (owner, 2026-11-17): EVERY ILO needs at least one activity, at its OWN verb's level;
    // the two alternatives for diverse learners are for the week as a whole, not two per ILO.
    { id: 'ilo', critical: false, ask: 'Does EVERY ILO of the week have at least one activity that lets students practise what that ILO asks them to do?' },
    { id: 'level', critical: false, ask: 'Is each ILO of the week practised by at least one activity at the cognitive level of that ILO\'s own verb (for "apply": solve problems, perform tasks or use concepts in a real scenario; listening, reading or recalling alone is below it)?' },
    { id: 'diverse', critical: false, ask: 'Does the week offer at least two alternative activities suited to different learners (two for the week as a whole, not two per ILO), each fitting an ILO of the week?' },
  ] },
  'TASK-FIT': { from: 'tasks', to: ['content', 'activities', 'ilo'], area: 'tasks', scored: true, items: [
    { id: 'content', critical: true, ask: 'Do the tasks assess this week\'s content?' },
    { id: 'activities', critical: false, ask: 'Do the tasks follow from the activities (they assess what students practised)?' },
    // every ILO of the week is assessed by at least one task at its own verb's level (one task may cover several ILOs)
    { id: 'level', critical: false, ask: 'Is each ILO of the week assessed by at least one task at the cognitive level of that ILO\'s own verb (for "apply": students solve problems or perform a task; a recall or memorization quiz alone does not assess an outcome above "remember")? One task may cover several ILOs.' },
  ] },
  // Per CLO: its OWN verb level must be reached somewhere in the weeks mapped to it (an "apply" CLO that is only ever practised and quizzed by recall
  // fails). Judged against the ILOs, activities and tasks of the weeks whose ILOs are tagged to the CLO. repair 'manual': the fix belongs in those
  // weeks (raise an ILO with its activities and tasks), never in lowering the CLO's verb, so the repair plan does not rewrite the CLO for it.
  'CLO-EVIDENCE': { from: 'clo', to: 'plan', area: 'clo', scored: true, repair: 'manual', items: [
    { id: 'activities', critical: false, ask: 'Do the learning activities of the weeks mapped to this CLO include work at the CLO\'s own verb level (for "apply": solving problems, performing tasks or using concepts in a real scenario), not only lower-level work?' },
    { id: 'tasks', critical: false, ask: 'Do the assessment tasks of those weeks include at least one task at the CLO\'s own verb level, not only recall or memorization?' },
  ] },
  'TASK-ILO': { from: 'tasks', to: 'ilo', area: 'tasks', scored: false, items: [
    { id: 'measures', critical: false, ask: 'Would the tasks show whether students reached each of the week\'s ILOs?' },
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

// A relationship whose misalignment the repair plan never rewrites its own field for (it goes to the faculty): CLO-EVIDENCE.
const isManual = relationship => CHECKLISTS[relationship]?.repair === 'manual';

module.exports = {
  VERSION, CONSTRUCTIVE_ALIGNMENT_SOURCE, isManual, VALUE_NAMES, CLO_COUNT, CLO_LEVELS, BLOOM_ORDER, BLOOM_SOURCE, AFFECTIVE_ORDER, AFFECTIVE_SOURCE, CHED_STAGES, CHAIN, layerOf, SCHEDULE, MIN_ACTIVITY_OPTIONS, REFERENCE_RECENCY_YEARS, VALUES_REQUIRED_IN,
  CHECKLISTS, VERDICT, ANSWERS, verdictOf, DEDUCTION, AREAS, AREA_CAPS, deductions,
};
