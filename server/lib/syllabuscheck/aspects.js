'use strict';
// The structured fields of a Stage C / D answer (enums in gemini.js ASPECTS) and what is wrong with them:
//   invalid         a value outside its enum (recorded by gemini.js)
//   missing         a field the relationship type needs that was not answered (recorded by gemini.js)
//   contradictions  the label says the opposite of the answer's own fields (found here)
// Nothing is guessed: an absent or malformed field is simply not known, a contradictory answer is trusted in neither direction, and no rule is ever
// passed from a field that is not there.
const none = x => x === undefined || x === 'not_assessed';
const TYPES = new Set(['Activity-fit', 'Assessment-fit', 'Value-use', 'Value-map', 'Ref-relevance']);
const CORE = ['Compassion', 'Courage', 'Community-orientedness', 'Humility', 'Interiority', 'Missionary Spirit'];
// The fields each type must answer (gemini.js asks for them and records the missing ones), and (Stage E.6) the fields the base rule of the type rests
// on: ALN-05 on the teaching, ALN-07 on whether the task measures the ILO, VAL-03 on how the value is used, VAL-05 on the core value and its
// integration, REF-05 on the relevance. The base judgement is accepted when these were assessed; with one of them unassessed it is not a verified pass
// or failure (verdict.js). The other fields have rules of their own (ALN-06 learner support, ALN-08 evidence, ALN-09 level, VAL-02 value fit), which
// are NOT_CHECKED for an answer that did not assess them, or support the base judgement without a rule (carriedBy, basis).
const REQUIRED = { 'Activity-fit': ['teaching', 'learnerSupport'], 'Assessment-fit': ['measures', 'evidence', 'level'], 'Value-use': ['valueUse', 'carriedBy', 'valueFit'], 'Value-map': ['coreValue', 'integration'], 'Ref-relevance': ['relevance', 'basis'] };
const DECISIVE = { 'Activity-fit': ['teaching'], 'Assessment-fit': ['measures'], 'Value-use': ['valueUse'], 'Value-map': ['coreValue', 'integration'], 'Ref-relevance': ['relevance'] };
// Stage E.6: what an ALIGNED Value-use answer contradicts when its valueUse is anything but integrated.
const NOT_INTEGRATED = { name_only: 'only named', generic: 'only generic', unrelated: 'unrelated to what students do', opportunity: 'only a potential opportunity', insufficient: 'not shown (insufficient evidence)' };

function contradictionsOf(j, v) {
  const out = [], label = j.label;
  if (j.type === 'Activity-fit') {
    if (label === 'ALIGNED' && v.teaching === 'weak') out.push('ALIGNED but teaching is weak');
    if (label === 'ALIGNED' && v.learnerSupport === 'limited') out.push('ALIGNED but learner support is limited');
    if (label === 'PARTIALLY_ALIGNED' && v.teaching === 'sound' && !none(v.learnerSupport) && v.learnerSupport !== 'limited') out.push('PARTIALLY_ALIGNED but teaching is sound and learner support is not limited');
    if (label === 'NOT_ALIGNED' && v.teaching === 'sound') out.push('NOT_ALIGNED but teaching is sound');
  }
  if (j.type === 'Assessment-fit') {
    const allGood = v.measures === 'yes' && v.evidence === 'observable' && v.level === 'matches';
    if (label === 'ALIGNED' && (v.measures === 'partly' || v.measures === 'no' || v.evidence === 'vague' || v.level === 'too_low' || v.level === 'too_high')) out.push('ALIGNED but a field reports a problem');
    if ((label === 'NOT_ALIGNED' || label === 'PARTIALLY_ALIGNED') && allGood) out.push(label + ' but measures, evidence and level are all good');
    if (label === 'NOT_ALIGNED' && v.measures === 'yes') out.push('NOT_ALIGNED but the task measures the ILO');
  }
  if (j.type === 'Value-use') {
    if (label === 'ALIGNED' && NOT_INTEGRATED[v.valueUse]) out.push('ALIGNED but the value is ' + NOT_INTEGRATED[v.valueUse]);
    if (label === 'ALIGNED' && v.valueFit === 'clashes') out.push('ALIGNED but the value clashes with what students do');
    if (v.valueUse === 'integrated' && v.carriedBy === 'none') out.push('integrated, yet nothing in the lesson carries it');
    if (label === 'NOT_ALIGNED' && v.valueUse === 'integrated' && v.valueFit === 'fits') out.push('NOT_ALIGNED but the value is integrated and fits');
    if (label === 'PARTIALLY_ALIGNED' && v.valueUse === 'integrated' && v.valueFit === 'fits' && !none(v.carriedBy) && v.carriedBy !== 'none') out.push('PARTIALLY_ALIGNED but the value is integrated, fits and is carried');
  }
  if (j.type === 'Value-map') {
    if (label === 'ALIGNED' && !CORE.includes(v.coreValue)) out.push('ALIGNED but no core value is named');
    if (label === 'ALIGNED' && v.integration !== 'demonstrated') out.push('ALIGNED but the value is not demonstrated');
    if (label === 'NOT_ALIGNED' && CORE.includes(v.coreValue) && v.integration === 'demonstrated') out.push('NOT_ALIGNED but a core value is demonstrated');
  }
  if (j.type === 'Ref-relevance') {
    if (label === 'ALIGNED' && ['tangential', 'unrelated', 'cannot_tell'].includes(v.relevance)) out.push('ALIGNED but relevance is ' + v.relevance.replace('_', ' '));
    if (label === 'NOT_ALIGNED' && v.relevance === 'relevant') out.push('NOT_ALIGNED but the reference is relevant');
    if (label === 'PARTIALLY_ALIGNED' && (v.relevance === 'relevant' || v.relevance === 'unrelated')) out.push('PARTIALLY_ALIGNED but relevance is ' + v.relevance);
  }
  return out;
}
function readAspects(j) {
  const a = j && j.aspects;
  if (!a) return { present: false, values: {}, invalid: [], missing: [], contradictions: [] };
  const v = a.values || {};
  return { present: true, values: v, invalid: a.invalid || [], missing: a.missing || [], contradictions: contradictionsOf(j, v) };
}
const contradictory = j => !!j && TYPES.has(j.type) && readAspects(j).contradictions.length > 0;
// Stage E.6: the coverage of one answer's fields, apart from whether the answer itself verified. Each field its type requires is
//   assessed      a value of its enum other than not_assessed (not_applicable, insufficient and cannot_tell are conclusions, so they count)
//   not_assessed  the model answered not_assessed           missing    the field is not in the answer
//   malformed     a value outside its enum                  contradicted  assessed, but the answer contradicts itself, so no field of it is used
// `unassessed` lists the fields that are not_assessed, missing or malformed, and `decisive` those of them the base rule rests on (DECISIVE). Nothing
// is inferred for a field that was not assessed. An answer stored without any field record (cached or saved before Stage C) has no coverage (null):
// it is read as it always was.
function coverageOf(j) {
  const required = REQUIRED[j && j.type] || [], a = j && j.aspects, v = (a && a.values) || {}, invalid = (a && a.invalid) || [];
  if (!a || !required.length) return null;
  const conflicting = contradictionsOf(j, v).length > 0;
  const stateOf = key => (invalid.includes(key) ? 'malformed' : v[key] === undefined ? 'missing' : v[key] === 'not_assessed' ? 'not_assessed' : conflicting ? 'contradicted' : 'assessed');
  const fields = Object.fromEntries(required.map(key => [key, stateOf(key)]));
  const unassessed = required.filter(key => ['not_assessed', 'missing', 'malformed'].includes(fields[key]));
  return { fields, assessed: required.filter(key => fields[key] === 'assessed'), unassessed, decisive: unassessed.filter(key => (DECISIVE[j.type] || []).includes(key)) };
}
// The field coverage of a whole check or evaluation, apart from how many of its answers verified: for each type, how many relationships were asked,
// how many answers verified (baseVerified: the quotes checked out), how many of those base judgements stand on their own assessed field
// (baseAccepted: no DECISIVE field unassessed and no contradiction; the rest are shown for review), how many were stored without any field record
// (notRecorded, before Stage C: read as before; counted in baseVerified, not in baseAccepted), and for each required field how many of the others
// assessed it. Null when no lesson relationship was asked (every stage of Stage C and D off), so a report without them is unchanged.
function coverageSummaryOf(judgements) {
  const rows = (judgements || []).filter(j => j && TYPES.has(j.type));
  if (!rows.length) return null;
  const byType = {}, total = { required: 0, assessed: 0 };
  for (const j of rows) {
    const t = byType[j.type] || (byType[j.type] = { relationships: 0, baseVerified: 0, baseAccepted: 0, notRecorded: 0, fields: {} });
    t.relationships += 1;
    if (j.unverified || j.label === 'INSUFFICIENT_EVIDENCE') continue;
    t.baseVerified += 1;
    const cov = coverageOf(j);
    if (!cov) { t.notRecorded += 1; continue; }
    if (!cov.decisive.length && !Object.values(cov.fields).includes('contradicted')) t.baseAccepted += 1;
    for (const [key, state] of Object.entries(cov.fields)) {
      const f = t.fields[key] || (t.fields[key] = { assessed: 0, not_assessed: 0, missing: 0, malformed: 0, contradicted: 0 });
      f[state] += 1; total.required += 1; if (state === 'assessed') total.assessed += 1;
    }
  }
  return { byType, fieldsRequired: total.required, fieldsAssessed: total.assessed, rate: total.required ? total.assessed / total.required : null };
}
module.exports = { readAspects, contradictory, coverageOf, coverageSummaryOf, TYPES, REQUIRED, DECISIVE };
