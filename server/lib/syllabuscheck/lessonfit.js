'use strict';
// Stage C: learning activities (C1) and assessment tasks (C2), asked about one lesson at a time.
// They build on what is already known instead of asking it again:
//   - the scored ILO-activity / ILO-assessment relationships already say whether the activity practises, and the task measures, the ILO's own action.
//     When that answer is "no", the question is answered (the existing finding and draft stand) and nothing more is asked about the lesson.
//   - only a lesson whose scored answer is ALIGNED gets the deeper question: the teaching method and support for diverse learners (C1), and the evidence,
//     level, format, feasibility and accessibility of the task (C2).
//   - a lesson whose course content or ILO is already known to be off is never asked: that is what has to change first.
// Recommendation order: course content, ILO, CLO tag, learning activity, assessment task. Pure functions; the engine asks the questions.
// Stage C3 (chainPairs) is different on purpose: its three links are asked about every lesson, whatever the other answers say.
const { examLike, brief } = require('./planrows');
const { C3 } = require('./stages');
const CHAIN_TYPES = new Set(C3.types);

const MAX_LESSON_PAIRS = 36, MAX_FIELD = 2000, MAX_ILO = 300;
const label = (judgements, id) => judgements.find(j => j.id === id);
const verified = j => !!j && !j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE';
const lessonRows = content => (content.plan || []).map((row, i) => ({ row, i })).filter(({ row }) => row.kind !== 'exam' && !examLike(row) && String(row.contents || '').trim() && (row.ilos || []).some(ilo => String(ilo.text || '').trim()));
const iloIndexes = row => (row.ilos || []).map((ilo, j) => [ilo, j]).filter(([ilo]) => String(ilo.text || '').trim()).map(([, j]) => j);
// Course credits describe the course, not the methods of this lesson or availability of facilities/equipment.
function unitsLine(meta = {}) {
  const lecture = String(meta.lecture ?? '').trim(), lab = String(meta.lab ?? '').trim();
  return lecture || lab ? `Course-wide contact units (not lesson requirements or proof of resource availability): lecture ${lecture || 'not stated'}, laboratory ${lab || 'not stated'}` : '';
}
// Static hints for reviewing suggestions only, never an academic classifier or a label/score rule. A leading action is read with its object;
// 'explain how to build' still asks for explanation, while an explicit second performance ('explain and build') prevents a conceptual-only hint.
function iloTextOf(source) {
  const match = /^ILOs?:\s*\n?([\s\S]*?)(?=\n(?:Contact units|Course-wide contact|Learning activities|Assessment tasks|Definitions of|No institutional|The six official)|$)/im.exec(String(source || ''));
  return match ? match[1].trim() : '';
}
const COGNITION = [
  ['knowledge', /^(?:recall|recognize|recognise|name|list|define|identify|enumerate)\b/i],
  ['understanding', /^(?:explain|describe|summari[sz]e|interpret|compare|contrast|discuss)\b/i],
  ['application', /^(?:apply|calculate|compute|solve|use|execute)\b/i],
  ['analysis', /^(?:analy[sz]e|distinguish|examine|diagnose|differentiate)\b/i],
  ['evaluation', /^(?:evaluate|assess|justify|critique|defend|appraise)\b/i],
  ['creation', /^(?:design|create|develop|construct|implement|produce|build|compose|formulate)\b/i],
];
const PERFORMANCE = /\b(?:build|assemble|operate|calibrate|measure|implement|develop|program|code|run|test|perform)\b/i;
function competencyOf(source) {
  const text = iloTextOf(source), statements = text.split(/\n/).map(s => s.replace(/^\s*[-*\d.)]+\s*/, '').trim()).filter(Boolean);
  const categories = statements.map(s => (COGNITION.find(([, re]) => re.test(s)) || ['unknown'])[0]);
  const performanceVerb = '(?:build|assemble|operate|calibrate|measure|implement|develop|program|code|run|test|perform)';
  const secondPerformance = statements.some(s => new RegExp('(?:\\bthen\\s+|;\\s*(?:then\\s+)?)' + performanceVerb + '\\b', 'i').test(s) ||
    (!/\bhow to\b/i.test(s) && new RegExp('\\band\\s+' + performanceVerb + '\\b', 'i').test(s)));
  const conceptualOnly = statements.length > 0 && categories.every(c => c === 'knowledge' || c === 'understanding') && !secondPerformance;
  const practical = !conceptualOnly && statements.some(s => PERFORMANCE.test(s) && /\b(?:programs?|code|circuit|amplifier|equipment|machine|procedure|experiment|device|test|calibrat|measur|assembl|operat)/i.test(s));
  return { text, categories, conceptualOnly, practical };
}
function lessonContext(content, row) {
  const ilos = iloIndexes(row).map(j => `- ${brief(row.ilos[j].text, MAX_ILO)}`);
  return [`Week ${row.week} course content: ${String(row.contents).trim().slice(0, 1200)}`, 'ILOs:', ...ilos, unitsLine(content.meta)].filter(Boolean).join('\n');
}
// Has the lesson's content or ILO been found wrong (so the lesson is not asked), and has it been verified right (so a rewrite of a later field is allowed)?
function upstreamOf(judgements, i, row) {
  const content = label(judgements, `row${i}-content`);
  const ilos = iloIndexes(row).map(j => label(judgements, `row${i}-ilo${j}-contentilo`));
  const bad = (content && content.label === 'NOT_ALIGNED') || ilos.some(j => j && ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'].includes(j.label));
  const ok = verified(content) && content.label === 'ALIGNED' && ilos.length > 0 && ilos.every(j => verified(j) && j.label === 'ALIGNED');
  const culprit = content && content.label === 'NOT_ALIGNED' ? 'course_content' : ilos.some(j => j && ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'].includes(j.label)) ? 'ilo' : null;
  return { bad: !!bad, verified: ok, culprit };
}
// The activity of a lesson is invalid when the scored ILO-activity answer, the Activity-fit answer or (Stage C3) the Content-activity answer says it
// does not align at all.
function activityInvalid(judgements, i, row) {
  return label(judgements, `row${i}-activityfit`)?.label === 'NOT_ALIGNED' || label(judgements, `row${i}-contentactivity`)?.label === 'NOT_ALIGNED' || iloIndexes(row).some(j => label(judgements, `row${i}-ilo${j}-activity`)?.label === 'NOT_ALIGNED');
}
// The assessment task of a lesson is invalid when the scored ILO-assessment answer, the Assessment-fit answer or (Stage C3) the Content-assessment or
// Activity-assessment answer says it does not align at all.
function assessmentInvalid(judgements, i, row) {
  return ['assessfit', 'contentassessment', 'activityassessment'].some(id => label(judgements, `row${i}-${id}`)?.label === 'NOT_ALIGNED') || iloIndexes(row).some(j => label(judgements, `row${i}-ilo${j}-assessment`)?.label === 'NOT_ALIGNED');
}
// Why a rewrite of an activity or assessment field must not be offered, or null when one may be: recommendations follow the order course content, ILO,
// CLO tag, learning activity, assessment task, so a later field is not rewritten while an earlier one is wrong or has not been verified.
//   upstream_invalid     the lesson's content or ILO was found off          upstream_unverified  they have not been checked (Stage B is off or incomplete)
//   activity_invalid     (assessments only) the learning activity is off
function draftWithheld(type, id, content, judgements, flags) {
  const at = /^row(\d+)-/.exec(String(id));
  if (!at) return null;
  const i = Number(at[1]), row = content.plan && content.plan[i];
  const activity = type === 'Activity-fit' || (type === 'ILO-activity' && flags && flags.c1);
  const assessment = type === 'Assessment-fit' || (type === 'ILO-assessment' && flags && flags.c2);
  const values = type === 'Value-use' || (type === 'Module-value' && flags && flags.d1); // the values statement is the last field in the order
  if (!row) return null;
  // Stage B verifies the week's content against the course. When it belongs to the course, the scored ILO-content draft (which rewrites the CONTENT to
  // fit the ILO) is not offered: the ILO is the field to review (Content-ILO), and a correct content is never rewritten to fit a wrong ILO.
  const content0 = label(judgements, `row${i}-content`);
  // Stage C3 advises on one link: its recommendation waits only for the text that link is judged against - the week's content (Stage B found it off the
  // course) and, for Activity-assessment, the learning activities. An off ILO does not hold it back: these links do not involve the ILO.
  if (CHAIN_TYPES.has(type)) return content0 && content0.label === 'NOT_ALIGNED' ? 'upstream_invalid' : type === 'Activity-assessment' && activityInvalid(judgements, i, row) ? 'activity_invalid' : null;
  if (type === 'ILO-content' && flags && flags.b && verified(content0) && content0.label === 'ALIGNED') return 'content_sound';
  // Stage B alone (C1, C2 or D1 off): a scored activity, assessment or values draft for a lesson whose content or ILO is known to be off still waits.
  if (!activity && !assessment && !values && flags && flags.b && ['ILO-activity', 'ILO-assessment', 'Module-value'].includes(type) && upstreamOf(judgements, i, row).bad) return 'upstream_invalid';
  if (!activity && !assessment && !values) return null;
  const up = upstreamOf(judgements, i, row);
  if (!up.verified) return up.bad ? 'upstream_invalid' : 'upstream_unverified';
  if ((assessment || values) && activityInvalid(judgements, i, row)) return 'activity_invalid';
  if (values && assessmentInvalid(judgements, i, row)) return 'assessment_invalid';
  if (type === 'Module-value' && flags && flags.d1 && verified(label(judgements, `row${i}-valuemap`))) return 'values_classified';
  return null;
}
// The scored answers of one lesson for one kind ('activity' | 'assessment'): all aligned, any failed, or not known.
function scoredOf(judgements, i, row, kind) {
  const list = iloIndexes(row).map(j => label(judgements, `row${i}-ilo${j}-${kind}`));
  if (!list.length || list.some(j => !verified(j))) return 'unknown';
  if (list.some(j => j.label !== 'ALIGNED')) return 'failed';
  return 'aligned';
}
// The lessons that get the deeper question, and why the others do not (for the report's cost and reuse figures).
function eligible(content, judgements, kind) {
  const asked = [], reused = [], upstream = [], missing = [];
  for (const { row, i } of lessonRows(content)) {
    const field = kind === 'activity' ? row.activities : row.tasks;
    if (!String(field || '').trim()) { missing.push(i); continue; }
    if (upstreamOf(judgements, i, row).bad) { upstream.push(i); continue; }
    const scored = scoredOf(judgements, i, row, kind);
    if (scored === 'aligned') asked.push(i); else reused.push(i);
  }
  return { asked: asked.slice(0, MAX_LESSON_PAIRS), reused, upstream, missing };
}
function activityPairs(content, indexes) {
  return indexes.map(i => { const row = content.plan[i]; return { id: `row${i}-activityfit`, type: 'Activity-fit', source: lessonContext(content, row), target: String(row.activities).slice(0, MAX_FIELD), path: `plan[${i}].activities`, targetPath: `plan[${i}].activities` }; });
}
function assessmentPairs(content, indexes) {
  return indexes.map(i => { const row = content.plan[i]; return { id: `row${i}-assessfit`, type: 'Assessment-fit', source: `${lessonContext(content, row)}\nLearning activities: ${brief(row.activities, 400) || '(none written)'}`, target: String(row.tasks).slice(0, MAX_FIELD), path: `plan[${i}].tasks`, targetPath: `plan[${i}].tasks` }; });
}
// ---- Stage C3: the weekly chain ----
// Every instructional lesson with any of its three texts, whatever the other answers say. A lesson with an empty side is kept: align() answers that link
// INSUFFICIENT_EVIDENCE without asking (the engine turns skipEmpty off for it), so a missing course content is reported, never skipped.
const chainRows = content => (content.plan || []).map((row, i) => ({ row, i })).filter(({ row }) => row.kind !== 'exam' && !examLike(row) && [row.contents, row.activities, row.tasks].some(text => String(text || '').trim()));
// Three relationships per lesson, each on its own pair: content -> activities, content -> tasks, activities -> tasks. A source is headed by the lesson's
// week (grouped weeks too: "Week 4-5"), and an empty one stays empty so that it is recognised as missing. No targetPath: advice only.
function chainPairs(content, indexes) {
  const headed = (row, name, text) => (String(text || '').trim() ? `Week ${row.week} ${name}: ${String(text).trim().slice(0, MAX_FIELD)}` : '');
  return indexes.flatMap(i => {
    const row = content.plan[i], activities = String(row.activities || '').slice(0, MAX_FIELD), tasks = String(row.tasks || '').slice(0, MAX_FIELD);
    return [
      { id: `row${i}-contentactivity`, type: 'Content-activity', source: headed(row, 'course content', row.contents), target: activities, path: `plan[${i}].activities`, targetPath: null },
      { id: `row${i}-contentassessment`, type: 'Content-assessment', source: headed(row, 'course content', row.contents), target: tasks, path: `plan[${i}].tasks`, targetPath: null },
      { id: `row${i}-activityassessment`, type: 'Activity-assessment', source: headed(row, 'learning activities', row.activities), target: tasks, path: `plan[${i}].tasks`, targetPath: null },
    ];
  });
}
// A link that got no answer: not checked, never a verdict (`not_asked` beyond the lesson limit, otherwise the provider's failure kind).
const chainNotChecked = (pair, kind) => ({ id: pair.id, type: pair.type, path: pair.path, targetPath: pair.targetPath, label: 'INSUFFICIENT_EVIDENCE', unverified: true, failureKind: kind, draft: '',
  explanation: kind === 'not_asked' ? `Not checked: the weekly chain is asked for at most ${MAX_LESSON_PAIRS} lessons.` : 'The AI did not answer for this relationship (the provider call failed), so it has not been checked yet. Run the check again.',
  sourceQuote: '', targetQuote: '', evidenceMatching: { source: 'not_evaluated', target: 'not_evaluated' }, sourceBloom: 'N/A', targetBloom: 'N/A' });
const { readAspects, contradictory } = require('./aspects'); // the structured fields and their consistency live in aspects.js
module.exports = { readAspects, contradictory, draftWithheld, activityInvalid, assessmentInvalid, lessonRows, iloIndexes, label, verified, eligible, activityPairs, assessmentPairs, upstreamOf, scoredOf, MAX_LESSON_PAIRS, unitsLine, iloTextOf, competencyOf, CHAIN_TYPES, chainRows, chainPairs, chainNotChecked };
