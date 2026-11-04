'use strict';
// When is a relationship ACCEPTABLE, and what kind of change is it worth asking for? One place, so the prompt, the tiers, the documentation and the
// tests agree. The criteria restate the tests already in the alignment prompt (gemini.js) and the policy (policy.js); they add no new institutional
// requirement. `tier` follows the policy: a scored relationship is a material deficiency when it is not aligned, an advisory one is optional advice.
//
//   mandatory  required by the approved curriculum, the institution or the official form (the fixed rules): blocks, or lowers the standard's score
//   material   a specific academic deficiency that costs points (a scored relationship that is not aligned, or a lesson with no core value)
//   optional   advice that costs nothing and blocks nothing (advisory relationships, reference pages, quality notes)
const { POLICY } = require('./policy');
const { C3 } = require('./stages');

const SCORED = {
  'CLO-PO': { resolvedWhen: 'ALIGNED', group: 'A CLO needs ONE aligned PO of its program (its other PO tags are then advice only).', criteria: ['the CLO has the key action or competency of the PO, or a clear equivalent', 'its level is not lower than the PO asks for', 'its subject matter is the PO\'s', 'a shared topic word alone is not alignment'] },
  'CLO-EGA': { resolvedWhen: 'ALIGNED', group: 'A CLO needs ONE aligned EGA (its other EGA tags are then advice only).', criteria: ['the CLO shows the competency the graduate attribute names', 'the relationship is supported by what the CLO says, not by the tag'] },
  'ILO-CLO': { resolvedWhen: 'ALIGNED', group: 'An ILO needs ONE fully aligned CLO (its other CLO tags are then advice only).', criteria: ['the ILO is a smaller step of the CLO in the same subject', 'its level is the CLO\'s or builds toward it', 'it does not claim more than the CLO'] },
  'ILO-activity': { resolvedWhen: 'ALIGNED', criteria: ['the activities include something the student does that practises the ILO\'s action', 'the activity reaches the ILO\'s level', 'it is about the ILO\'s subject'] },
  'ILO-assessment': { resolvedWhen: 'ALIGNED', criteria: ['the task collects evidence of the ILO\'s own action, not a lower one', 'it reaches the ILO\'s level and covers its subject', 'it says what is produced or answered'] },
  'Module-value': { resolvedWhen: 'ALIGNED', criteria: ['one of the six core values is named', 'it is integrated with the lesson\'s ILO, content, activities or tasks, saying what students do or decide'] },
};
const ADVISORY = {
  'CLO-anyPO': { resolvedWhen: 'no obligation', criteria: ['the CLO fits at least ONE item of the whole PO list (fitting more is fine)'] },
  'CLO-anyEGA': { resolvedWhen: 'no obligation', criteria: ['the CLO fits at least ONE of the graduate attributes'] },
  'ILO-content': { resolvedWhen: 'no obligation', criteria: ['the contents cover the topics the ILO needs, at its level', 'they are not tied to one narrow background (judged leniently)'] },
  'Description-plan': { resolvedWhen: 'no obligation', criteria: ['the description says what the plan teaches, names its main topics, promises nothing the plan lacks'] },
  'Course-CLO': { resolvedWhen: 'no obligation', criteria: ['the CLO develops a competence of this course\'s own subject', 'it states an observable, assessable performance at a level that suits the year', 'it is not a generic outcome that would fit any course'] },
  'CLO-set': { resolvedWhen: 'no obligation', criteria: ['the CLOs together cover the essential learning of the course', 'no two repeat the same competence', 'none is generic'] },
  'Content-course': { resolvedWhen: 'no obligation', criteria: ['the topic belongs to this course\'s subject as its title and description define it', 'it suits the year level', 'it does not repeat the previous week or depend on later teaching'] },
  'Plan-sequence': { resolvedWhen: 'no obligation', criteria: ['the weekly topics follow a reasonable progression', 'no unjustified repetition or empty week', 'no unsupported jump', 'the main topics of the description are taught'] },
  'Content-ILO': { resolvedWhen: 'no obligation', criteria: ['the ILO is directly about the week\'s content', 'it states an observable, assessable performance at a level the content can teach', 'it is specific enough to guide teaching and assessment'] },
  'ILO-anyCLO': { resolvedWhen: 'no obligation', criteria: ['the ILO builds at least ONE CLO of the course (named by number)', 'a CLO tag is never evidence by itself'] },
  'CLO-coverage': { resolvedWhen: 'no obligation', criteria: ['the weeks that are tagged to the CLO really build it, judged from content and ILO text', 'together they progress toward its level', 'no equal share of weeks is expected; examination and orientation weeks do not count against it'] },
  'REF-plan': { resolvedWhen: 'no obligation', criteria: ['the referenced page is about the subject of the course topics'] },
};

const CRITERIA = Object.freeze(Object.fromEntries([
  ...Object.entries(SCORED).map(([type, c]) => [type, { tier: 'material', ...c }]),
  ...Object.entries(ADVISORY).map(([type, c]) => [type, { tier: 'optional', ...c }]),
]));

// The tier of a relationship type, from the policy (so a type moved to or from `advisoryTypes` moves tier with it). Stage C3's links advise only and are
// not in the policy until the stage is reviewed (gemini.js isAdvisory).
const tierOfType = (type) => (type === 'REF-plan' || POLICY.advisoryTypes.includes(type) || C3.types.includes(type) || require('./requirementsAdvice').TYPES.includes(type) ? 'optional' : 'material');

module.exports = { CRITERIA, tierOfType };
