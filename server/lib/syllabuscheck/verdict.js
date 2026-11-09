'use strict';
// A verdict layer on top of a finished hybrid report. It never changes the official score, the pass mark or any gate: it re-expresses the
// report as typed findings (status / severity / method) and keeps three questions apart:
//   completeness  are the fields filled in?            curriculum  does the course match the approved curriculum?
//   alignment     do the parts teach one another?      overall     what can honestly be said, given what was NOT checked?
// A check that could not be made reports NOT_CHECKED or NEEDS_REVIEW, never a pass. Pure: no I/O, no model calls.
const VERSION = 'verdict-1';
const STATUS = ['PASS', 'FAIL', 'NEEDS_REVIEW', 'NOT_CHECKED', 'NOT_APPLICABLE'];
// Not approved university values: the requester stated four CLOs and the six-column weights below are a starting proposal. Change them here only.
const CONFIG = Object.freeze({
  expectedCloCount: 4,
  cloLevels: ['Introductory', 'Enabling', 'Demonstrating', 'Integration of Values'],
  duplicateSimilarity: 0.8,
  maxShown: 200,
  rubric: Object.freeze({ approved: false, weights: { curriculum: 20, cloAlignment: 25, planAlignment: 25, activitiesAssessments: 20, quality: 10 } }),
});
// Where an existing check lands in the proposed catalog. Existing rule IDs are untouched; `legacyRuleId` keeps the original.
const CODED = { 'CUR-REF': ['CUR-02', 'curriculum'], 'CUR-CODE': ['CUR-03', 'curriculum'], INST: ['CUR-01', 'curriculum'], PO: ['CLO-06', 'cloAlignment'], 'CLO-ID': ['STR-06', 'structure'], 'CLO-MAP': ['CLO-06', 'cloAlignment'], 'ILO-MAP': ['STR-06', 'structure'], HEADER: ['STR-01', 'structure'], WEEK: ['PLAN-01', 'structure'], 'WEEK-DUP': ['PLAN-01', 'structure'], 'WEEK-GAP': ['PLAN-01', 'structure'], 'ILO-MISSING': ['STR-04', 'structure'], 'ILO-GAP': ['STR-06', 'structure'], 'ILO-NUM': ['STR-06', 'structure'], 'GRADE-RANGE': ['ADM-03', 'quality'], 'GRADE-100': ['ADM-03', 'quality'], VALUE: ['VAL-01', 'quality'], LINK: ['REF-04', 'quality'] };
const CUR_FIELD = { title: 'CUR-04', lecture: 'CUR-05', lab: 'CUR-05', yearLevel: 'CUR-06', prereq: 'CUR-07' };
const AI = { 'CLO-PO': ['CLO-06', 'cloAlignment'], 'CLO-anyPO': ['CLO-06', 'cloAlignment'], 'CLO-EGA': ['CLO-07', 'cloAlignment'], 'CLO-anyEGA': ['CLO-07', 'cloAlignment'], 'ILO-CLO': ['ALN-02', 'planAlignment'], 'ILO-content': ['ALN-01', 'planAlignment'], 'ILO-activity': ['ALN-05', 'activitiesAssessments'], 'ILO-assessment': ['ALN-07', 'activitiesAssessments'], 'Module-value': ['VAL-02', 'quality'], 'Description-plan': ['CUR-09', 'planAlignment'], 'Course-CLO': ['CLO-03', 'cloAlignment'], 'Content-course': ['PLAN-03', 'planAlignment'], 'Plan-sequence': ['PLAN-04', 'planAlignment'], 'Content-ILO': ['ALN-01', 'planAlignment'], 'ILO-anyCLO': ['ALN-02', 'planAlignment'], 'Activity-fit': ['ALN-05', 'activitiesAssessments'], 'Value-use': ['VAL-03', 'quality'], 'Value-map': ['VAL-05', 'quality'], 'Ref-relevance': ['REF-05', 'quality'], 'Assessment-fit': ['ALN-07', 'activitiesAssessments'], 'CLO-coverage': ['PLAN-10', 'planAlignment'], 'CLO-set': ['CLO-09', 'cloAlignment'], 'REF-plan': ['REF-05', 'quality'] };
// Stage C3, the weekly chain: a rule of its own for each link, so no link's result is merged with another's. Expected (NOT_CHECKED until answered) only
// in a report whose stages include C3, so every other report reads exactly as before.
const CHAIN = { 'Content-activity': ['ALN-11', 'activitiesAssessments'], 'Content-assessment': ['ALN-12', 'activitiesAssessments'], 'Activity-assessment': ['ALN-13', 'activitiesAssessments'] };
const REQUIREMENTS = { 'Title-description':['CUR-11','curriculum'], 'Week1-introduction':['PLAN-11','planAlignment'] };
// Needs a model's reading of meaning. Offline these are NOT_CHECKED (and stay so when AI ran but covers only some of them).
const SEMANTIC = { 'CLO-03': 'cloAlignment', 'CLO-05': 'cloAlignment', 'CLO-09': 'cloAlignment', 'CLO-10': 'cloAlignment', 'PLAN-03': 'planAlignment', 'PLAN-04': 'planAlignment', 'PLAN-05': 'planAlignment', 'PLAN-06': 'planAlignment', 'PLAN-10': 'planAlignment', 'ALN-03': 'planAlignment', 'ALN-04': 'planAlignment', 'ALN-06': 'activitiesAssessments', 'ALN-08': 'activitiesAssessments', 'ALN-09': 'activitiesAssessments', 'ALN-10': 'activitiesAssessments', 'VAL-03': 'quality', 'VAL-04': 'quality', 'REF-02': 'quality', 'REF-03': 'quality' };
// No check exists yet, in this version or because the policy is not approved.
const PENDING = { 'STR-07': 'Exported document rendering is not checked yet.', 'ADM-04': 'No approved, versioned institutional grading policy is configured.', 'ADM-05': 'Approval and revision metadata is not checked yet.', 'CUR-10': 'Reference availability and version are not checked separately yet.' };

const str = v => String(v ?? '');
const clip = (v, n = 200) => { const s = typeof v === 'string' ? v : JSON.stringify(v ?? null); return s.length > n ? `${s.slice(0, n)}…` : s; };
const textAt = (content, path) => { const v = String(path || '').replace(/\[(\d+)\]/g, '.$1').split('.').reduce((o, k) => (o == null ? o : o[k]), content); return Array.isArray(v) ? v.map(x => (x && (x.t ?? x.text)) ?? x).join(' ') : typeof v === 'string' ? v : ''; };
const weekOf = (content, path) => { const m = /^plan\[(\d+)\]/.exec(str(path)); return m ? content.plan?.[Number(m[1])]?.week ?? null : null; };
// What a faculty member needs to act on a finding, in the same five parts every time: what is wrong, why, which field is responsible, what should
// change, and the reference that supports it. Only for findings that ask for something.
const WITHHELD = { content_sound: "The week's course content was verified to belong to the course, so it is not rewritten to fit this ILO; the ILO is the field to review.", values_classified: 'The values question for this lesson has been answered (see VAL-05), so its answer stands and no rewrite of the values statement is offered.', upstream_invalid: "The lesson's course content or ILO is itself off, so correct that first; no rewrite of this field is offered.", upstream_unverified: "The lesson's course content and ILO have not been verified (the Stage B checks are off or incomplete), so no rewrite of this field is offered.", activity_invalid: 'The learning activity is not aligned, so correct the activity first; no rewrite of this field is offered.', assessment_invalid: 'The assessment task is not aligned, so correct the assessment first; no rewrite of the values statement is offered.', draft_review: 'A static review found possible unsupported or copied wording in the proposed rewrite, so it is withheld for faculty review. The academic judgment and your original text are unchanged.', value_replaced: 'The proposed rewrite named a different core value from the one you selected, so it is not offered. Keep your selected value and show what students do or decide in this lesson that expresses it; if that value does not fit the lesson, review your choice. The academic judgment and your original text are unchanged.', retag_conflict: "The answers about this CLO's tags say the CLO can stay as written, so this rewrite is not offered; whether to change the CLO or its tags is your decision.", clo_off_course: 'This CLO was judged not to be about the course (CLO-03), so it is rewritten for the course first; no rewrite toward a PO or EGA is offered until then.' };
// What kind of change a finding asks for (Stage E.4): NO_CHANGE, REWRITE_TEXT (a draft is offered), RETAG_OUTCOME (keep the text, change its tag; only with a
// verified approved item) or REVIEW_REQUIRED (the author decides; nothing is proposed). Null for a rule that was not checked or is not an AI judgement.
const recommendationTypeOf = f => (f.recommendationType !== undefined ? f.recommendationType : f.method !== 'ai_semantic' ? null : f.status === 'PASS' || f.status === 'NOT_APPLICABLE' ? 'NO_CHANGE' : f.status === 'NOT_CHECKED' ? null : f.recommendation ? 'REWRITE_TEXT' : 'REVIEW_REQUIRED');
const WHAT = { 'CUR-11':'Course description against the selected title', 'PLAN-11':'Week 1 introduction to the course and objectives', 'VAL-05': 'Supporting values and the core values',  'VAL-03': 'How the value is integrated in the lesson', 'VAL-04': 'Value integration across the course', 'REF-02': 'APA 7 format of the reference', 'REF-03': 'Required parts of the reference', 'REF-04': 'DOI and link of the reference', 'REF-05': 'Relevance of the source to the course', 'ALN-06': 'Support for diverse learners in the activities', 'ALN-08': 'Evidence the assessment produces', 'ALN-09': 'Level and difficulty of the assessment', 'CLO-03': 'CLO relevance to the course title', 'CLO-06': 'CLO to Program Outcome', 'CLO-07': 'CLO to Expected Graduate Attribute', 'CLO-09': 'The CLOs as a set', 'PLAN-03': 'Weekly course content', 'PLAN-04': 'Order of the learning plan', 'PLAN-10': 'Whole-course CLO coverage', 'ALN-01': "ILO against the week's course content", 'ALN-02': 'ILO to CLO', 'ALN-05': 'Learning activity for the ILO', 'ALN-07': 'Assessment of the ILO', 'VAL-02': 'Value integration', 'CUR-09': 'Course description against the plan', 'ALN-11': "Learning activities for the week's course content", 'ALN-12': "Assessment tasks for the week's course content", 'ALN-13': 'Assessment tasks for the learning activities' };
const FIELD = { description:'the course description', course_content: 'the weekly course content', ilo: 'the ILO', clo: 'the CLO', clo_mapping: 'the CLO tag of the ILO', po_mapping: 'the PO / EGA tag of the CLO', course_plan: 'the learning plan as a whole', institution_policy: 'an institutional decision', values: 'the values statement', references: 'the reference list', activity: 'the learning activity', assessment: 'the assessment task' };
function detailOf(f) {
  if (f.status !== 'FAIL' && f.status !== 'NEEDS_REVIEW') return null;
  if (f.severity === 'INFO' && !f.recommendation) return null;
  return { what: f.what || WHAT[f.ruleId] || f.ruleId, why: f.explanation || null, field: f.path ?? null, responsible: f.responsible ? FIELD[f.responsible] || f.responsible : null, change: f.recommendation ?? null, reference: f.reference ?? f.evidence ?? null };
}
function finding(content, f) {
  return { ruleId: f.ruleId, legacyRuleId: f.legacyRuleId ?? null, relationshipId: f.relationshipId ?? null, recommendationType: recommendationTypeOf(f), category: f.category, path: f.path ?? null, week: weekOf(content, f.path), status: f.status, severity: f.severity, method: f.method, actual: f.actual === undefined ? null : clip(f.actual), evidence: f.evidence === undefined ? null : clip(f.evidence), reference: f.reference === undefined ? null : clip(f.reference, 400), responsible: f.responsible || null, verification: f.verification || 'deterministic', bloom: f.bloom || null, explanation: f.explanation || '', recommendation: f.recommendation ?? null, aiConfidence: null, requiresFacultyApproval: !!f.recommendation, coverageState: f.coverageState || null, classification: f.classification || null, identityBasis: f.identityBasis || null, carriedBy: f.carriedBy || null, definitions: f.definitions || null, authenticity: f.authenticity || null, responseNote: f.responseNote || null, withheld: f.withheld || null, withheldNote: f.withheldNote || null, issueMessages: f.issueMessages || null, modelResponsible: f.modelResponsible || null, supportingWeeks: f.supportingWeeks || null, gaps: f.gaps || null, detail: detailOf(f), scope: weekOf(content, f.path) !== null ? 'week' : 'course', clo: f.clo ?? (/^clos\[(\d+)\]/.test(str(f.path)) ? Number(/^clos\[(\d+)\]/.exec(str(f.path))[1]) + 1 : null),
    ...(f.aspectCoverage ? { aspectCoverage: f.aspectCoverage } : {}), // Stage E.6: absent on older saved answers
    // Static answer review is display-only evidence. It never changes a finding's academic status or the verdict aggregates.
    ...(f.explanationReview?.length ? { explanationReview: [...new Set(f.explanationReview)] } : {}),
    ...(f.draftReview?.length ? { draftReview: [...new Set(f.draftReview)] } : {}),
    ...(f.draftWarnings?.length ? { draftWarnings: [...new Set(f.draftWarnings)] } : {}),
    ...(f.reviewEvidence ? { reviewEvidence: Object.fromEntries(['explanation', 'draft', ...(f.reviewEvidence.draftWarnings ? ['draftWarnings'] : [])].map(kind => [kind, (f.reviewEvidence[kind] || []).map(r => ({ code: r.code, evidence: clip(r.evidence, 240), ...(r.from ? { from: clip(r.from, 120) } : {}) }))])) } : {}) };
}

// ---- Deterministic checks that only need the content (no reference data, no model) ----
const PLACEHOLDER = /^(n\/?a|none|tbd|tba|todo|to be (determined|announced|filled)|lorem ipsum.*|sample|placeholder|test|asdf.*|xxx+|\?+|\.+|-+|_+)$/i;
const isPlaceholder = text => { const t = str(text).trim(); return !!t && (PLACEHOLDER.test(t) || /lorem ipsum/i.test(t) || /^(.)\1{3,}$/.test(t) || (!/\s/.test(t) && t.length < 3)); };
function fillerChecks(content, add) {
  const fields = [];
  (content.description || []).forEach((p, i) => fields.push([`description[${i}]`, p?.t]));
  (content.clos || []).forEach((c, i) => fields.push([`clos[${i}].statement`, c?.statement]));
  (content.plan || []).forEach((row, i) => {
    fields.push([`plan[${i}].contents`, row?.contents]);
    if (row?.kind === 'exam') return; // an examination row legitimately has no activities, tasks or values
    for (const key of ['activities', 'tasks', 'values']) fields.push([`plan[${i}].${key}`, row?.[key]]);
    (row?.ilos || []).forEach((ilo, j) => fields.push([`plan[${i}].ilos[${j}].text`, ilo?.text]));
  });
  (content.reqs || []).forEach((r, i) => fields.push([`reqs[${i}]`, r?.t]));
  for (const [path, value] of fields) {
    const raw = str(value);
    if (raw.length && !raw.trim()) add({ ruleId: 'STR-05', category: 'structure', path, status: 'FAIL', severity: 'MINOR', method: 'deterministic', actual: raw, explanation: 'The field holds only whitespace.', recommendation: 'Enter the real content or leave the field empty.' });
    else if (isPlaceholder(raw)) add({ ruleId: 'STR-05', category: 'structure', path, status: 'FAIL', severity: 'MAJOR', method: 'deterministic', actual: raw, explanation: 'The field holds placeholder or filler text, so it counts as filled but says nothing.', recommendation: 'Replace it with the real course content.' });
  }
}
const tokens = text => new Set(str(text).toLowerCase().match(/[a-z0-9]{3,}/g) || []);
const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let both = 0; for (const t of a) if (b.has(t)) both++; return both / (a.size + b.size - both); };
function cloChecks(content, add) {
  const clos = content.clos || [];
  const expected = CONFIG.expectedCloCount;
  add({ ruleId: 'CLO-01', category: 'cloAlignment', path: 'clos', status: clos.length === expected ? 'PASS' : 'FAIL', severity: 'MAJOR', method: 'deterministic', actual: clos.length, evidence: `${expected} CLOs (stated institutional standard; confirm against the approved policy)`, explanation: clos.length === expected ? `The syllabus has the expected ${expected} CLOs.` : `The syllabus has ${clos.length} CLOs; the institutional standard is exactly ${expected}.`, recommendation: clos.length === expected ? null : `Ask the administrator to set exactly ${expected} CLOs for this course.` });
  const shown = clos.slice(0, 20);
  shown.forEach((clo, i) => {
    if (CONFIG.cloLevels[i] && CONFIG.cloLevels.some(l=>l.toLowerCase()===str(clo.level).trim().toLowerCase()) && str(clo.level).trim().toLowerCase() !== CONFIG.cloLevels[i].toLowerCase()) add({ruleId:'CLO-08', category:'cloAlignment', path:`clos[${i}].level`, status:'FAIL', severity:'MAJOR', method:'deterministic', actual:clo.level, evidence:CONFIG.cloLevels[i], explanation:`CLO ${i+1} requires ${CONFIG.cloLevels[i]}. The stored label differs; no classification was changed.`, recommendation:'Review the stored label and statement with faculty.'});
    if (!CONFIG.cloLevels.some(l => l.toLowerCase() === str(clo.level).trim().toLowerCase())) add({ ruleId: 'CLO-08', category: 'cloAlignment', path: `clos[${i}].level`, status: 'FAIL', severity: str(clo.level).trim() ? 'MAJOR' : 'MINOR', method: 'deterministic', actual: clo.level, evidence: CONFIG.cloLevels, explanation: 'The CLO tag is not one of the approved tags.', recommendation: `Choose one of: ${CONFIG.cloLevels.join(', ')}.` });
  });
  const missingLevels = CONFIG.cloLevels.filter(level=>!shown.some(clo=>str(clo.level).trim().toLowerCase()===level.toLowerCase()));
  add({ruleId:'CLO-08',legacyRuleId:'clo-classification-coverage',category:'cloAlignment',path:'clos',status:missingLevels.length?'FAIL':'PASS',severity:missingLevels.length?'MAJOR':'INFO',method:'deterministic',actual:shown.map(clo=>clo.level),evidence:CONFIG.cloLevels,explanation:missingLevels.length?`Required CLO classifications are missing: ${missingLevels.join(', ')}.`:'All four required CLO classifications are present.',recommendation:missingLevels.length?`Ask faculty to review the CLO classifications and include ${missingLevels.join(', ')}. No CLO was reclassified automatically.`:null});
  let duplicate = false;
  for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) {
    const a = tokens(shown[i].statement), b = tokens(shown[j].statement);
    if (jaccard(a, b) >= CONFIG.duplicateSimilarity) {
      duplicate = true;
      add({ ruleId: 'CLO-02', category: 'cloAlignment', path: `clos[${j}].statement`, status: 'FAIL', severity: 'MAJOR', method: 'deterministic', actual: shown[j].statement, evidence: shown[i].statement, explanation: `CLO ${j + 1} repeats the wording of CLO ${i + 1}. Only repeated wording is detected here; repeated meaning in different words is not checked.`, recommendation: `Rewrite CLO ${j + 1} so it targets a different competence than CLO ${i + 1}.` });
    }
  }
  if (!duplicate && shown.length > 1) add({ ruleId: 'CLO-02', category: 'cloAlignment', path: 'clos', status: 'PASS', severity: 'INFO', method: 'deterministic', explanation: 'No two CLOs repeat each other\'s wording (repeated meaning is not checked).' });
}
const { ORIENTATION, citedWeeks, orientationIlo, weeksIn } = require('./planrows');
const { titleRelation } = require('./titles');
const { NEEDS_IDENTITY } = require('./identity');
const { draftWithheld, readAspects, upstreamOf } = require('./lessonfit');
const { coverageOf, coverageSummaryOf } = require('./aspects');
// Stage E.6: the structured field behind each derived rule, and what the rule says when that field was not assessed in an answer.
const ASPECT_RULE = { learnerSupport: 'ALN-06', valueFit: 'VAL-02', evidence: 'ALN-08', level: 'ALN-09' };
const ASPECT_NAME = { teaching: 'the teaching method', learnerSupport: 'the learner support', measures: 'whether the task measures the ILO', evidence: 'the evidence the task produces', level: 'the cognitive level of the task', valueUse: 'how the value is used', carriedBy: 'where the value is lived', valueFit: 'whether the value fits the lesson', coreValue: 'the core value supported', integration: 'whether the value is demonstrated', relevance: 'the relevance of the reference', basis: 'the basis of the relevance judgement' };
function weekOneCheck(content, add) {
  const first = (content.plan || []).map((row, i) => [row, i]).find(([row]) => /^\s*1\s*($|-|,)/.test(str(row.week)));
  if (!first) return add({ ruleId: 'PLAN-02', category: 'structure', path: 'plan', status: 'FAIL', severity: 'MAJOR', method: 'deterministic', explanation: 'The learning plan has no Week 1 row, so the course orientation (objectives, requirements, grading, policies) is missing.', recommendation: 'Add a Week 1 row that introduces the course objectives, requirements, expectations, grading and policies.' });
  const [row, i] = first, text = `${str(row.contents)} ${str(row.activities)}`.trim();
  if (!text) return add({ ruleId: 'PLAN-02', category: 'structure', path: `plan[${i}].contents`, week: row.week, status: 'FAIL', severity: 'MAJOR', method: 'deterministic', actual: row.contents, explanation: 'Week 1 has no course content, so the required course orientation is missing.', recommendation: 'Add the course orientation (objectives, requirements, expectations, grading, policies) to Week 1.' });
  // A word match is a hint, not proof of orientation content, so a hit still asks for a human look.
  const hint = ORIENTATION.test(text);
  add({ ruleId: 'PLAN-02', category: 'structure', path: `plan[${i}].contents`, status: hint ? 'NEEDS_REVIEW' : 'FAIL', severity: hint ? 'INFO' : 'MINOR', method: 'deterministic', actual: row.contents, explanation: hint ? 'Week 1 mentions orientation-type content (keyword hint only); a reviewer should confirm it covers objectives, requirements, grading and policies.' : 'Week 1 does not appear to introduce the course objectives, requirements, expectations, grading or policies.', recommendation: hint ? null : 'Add course orientation (objectives, requirements, grading, policies) to Week 1.' });
}

// ---- Existing coded checks and AI judgements, re-expressed ----
function fromCoded(report, content, add) {
  for (const c of report.hybrid?.codedChecks || []) {
    const key = CODED[c.ruleId] ? c.ruleId : /^INST-/.test(c.ruleId) ? 'INST' : /^PO-/.test(c.ruleId) ? 'PO' : null;
    let ruleId, category;
    if (c.ruleId === 'CUR-FIELD') { ruleId = CUR_FIELD[String(c.path).split('.').pop()] || 'CUR-08'; category = 'curriculum'; }
    else if (key) [ruleId, category] = CODED[key];
    else { ruleId = c.ruleId; category = /^CUR|^INST|^PO/.test(c.ruleId) ? 'curriculum' : /^P-/.test(c.ruleId) ? 'cloAlignment' : 'structure'; }
    const curriculum = category === 'curriculum';
    const cls = c.ruleId === 'VALUE' ? (report.hybrid?.valuesClassification || []).find(x => x.path === c.path) : null;
    let status = c.status === 'PASS' ? 'PASS' : c.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : c.status === 'NOT_EVALUATED' ? (curriculum || ruleId === 'CLO-06' ? 'NEEDS_REVIEW' : 'NOT_CHECKED') : 'FAIL';
    let message = (report.findings || []).find(f => f.id === c.id)?.message;
    // The title decision follows the title policy IN FORCE (titles.js), never a policy that is not active: when the official comparison still fails a title that
    // differs only in capitalisation or spacing (policy shadow or exact), this verdict fails it too, says why, and gives the approved spelling - the same thing
    // the official panel asks for. Once the normalised policy is active the official check passes it, and only an informational note remains (informationalOf).
    if (status === 'FAIL' && c.ruleId === 'CUR-FIELD' && c.path === 'meta.title' && titleRelation(c.evidence?.actual, c.evidence?.expected).match) {
      message = 'Differs from the approved title only in capitalisation or spacing. Under the title policy in force the approved spelling is still required to submit.';
    } else if (status === 'FAIL' && c.ruleId === 'CUR-FIELD' && c.path === 'meta.title' && titleRelation(c.evidence?.actual, c.evidence?.expected).relation === 'subtitle') {
      message = 'The approved title continues with a parenthetical that the entered title leaves out; this is not matched automatically.';
    }
    // VAL-01 is the official wording check (a core value must be NAMED). When the lesson wrote supporting values or competencies instead, this advisory verdict does not
    // call them invalid: it asks for review and points to VAL-05. The official check and its points are unchanged.
    let classification;
    if (cls && status === 'FAIL' && cls.classificationStatus !== 'empty') {
      status = 'NEEDS_REVIEW'; classification = { canonicalCoreValue: cls.canonicalCoreValue, supportingValue: cls.supportingValue, classificationStatus: cls.classificationStatus };
      message = cls.classificationStatus === 'competency_only' ? 'No official core value is named. The entries are academic competencies or graduate attributes, which are not Marian-Augustinian core values.' : cls.classificationStatus === 'core_supported' ? `No official core value is named. What students do in this lesson supports ${cls.canonicalCoreValue}; consider naming it alongside the supporting value.` : 'No official core value is named. The entries are supporting values or behaviours; whether they express a core value depends on what students do in the lesson (see VAL-05).';
    }
    // The official VALUE finding stays a FAIL when no core value is named and nothing classifies the entries. The recommendation never picks a value.
    const valueAdvice = c.ruleId !== 'VALUE' ? null : status === 'FAIL' ? 'Needs review: name the Marian-Augustinian core value that students actually live in this lesson. The checker does not choose one for you.' : cls && cls.classificationStatus === 'core_supported' ? `Consider naming ${cls.canonicalCoreValue}. Nothing is changed for you.` : null;
    add({ classification, ruleId, legacyRuleId: c.ruleId, category, path: c.path, status, severity: classification ? 'MINOR' : status !== 'FAIL' ? 'INFO' : c.ruleId === 'CUR-CODE' ? 'CRITICAL' : 'MAJOR', method: 'deterministic', actual: c.evidence?.actual, evidence: c.evidence?.expected, explanation: message || (status === 'PASS' ? 'Matches the approved reference.' : status === 'NEEDS_REVIEW' ? 'The approved reference needed for this check is missing, so it cannot be decided.' : 'Not applicable.'), recommendation: valueAdvice || (status === 'FAIL' && c.ruleId === 'CUR-CODE' ? 'Select this course from the approved curriculum of the program. The checker does not guess which course was meant.' : status === 'FAIL' && c.evidence?.expected != null && typeof c.evidence.expected !== 'object' && curriculum ? `Use the approved value: ${clip(c.evidence.expected)}` : null) });
  }
}
function fromAi(report, content, add) {
  const alignment = report.hybrid?.alignment || {};
  const tagAdvice = new Set((report.findings || []).filter(f => f.ruleId === 'SEM-TAG').map(f => f.id));
  // Stage E.4: the drafts of a CLO rewrite the engine did not offer because the tag answers said the CLO can stay as written, and the RETAG_OUTCOME
  // answers that verified mapping advice (an approved item named and quoted) answers.
  const heldBack = new Set((report.hybrid?.unresolved || []).flatMap(u => (u.withheldRewrite ? u.withheldRewrite.relationships : [])));
  const retagAdvised = new Set((report.hybrid?.mappingAdvice || []).flatMap(a => a.basedOn || []));
  // A CLO judged not to be about the course is rewritten for the course first (engine.js behindOffCourseClo): its PO / EGA fit drafts wait.
  const offCourse = new Set((alignment.judgements || []).filter(x => x.type === 'Course-CLO' && !x.unverified && x.label === 'NOT_ALIGNED').map(x => x.targetPath || x.path));
  const OUTCOME_FIT = new Set(['CLO-PO', 'CLO-EGA', 'CLO-anyPO', 'CLO-anyEGA']);
  for (const j of alignment.judgements || []) {
    const [ruleId, category] = AI[j.type] || CHAIN[j.type] || REQUIREMENTS[j.type] || ['ALN-00', 'planAlignment'];
    const advisory = /^(ILO-content|Description-plan|CLO-any|REF-plan|Course-CLO|CLO-set|Content-course|Plan-sequence|Content-ILO|ILO-anyCLO|CLO-coverage|Activity-fit|Assessment-fit|Value-use|Value-map|Ref-relevance)/.test(j.type) || !!CHAIN[j.type] || !!REQUIREMENTS[j.type];
    let status, severity;
    if (j.unverified || j.label === 'INSUFFICIENT_EVIDENCE') { status = 'NOT_CHECKED'; severity = 'INFO'; }
    else if (j.label === 'ALIGNED') { status = 'PASS'; severity = 'INFO'; }
    else if (tagAdvice.has(`TAG:${j.id}`)) { status = 'NEEDS_REVIEW'; severity = 'INFO'; } // another tag of the same group is aligned: advice only
    else { status = j.label === 'NOT_ALIGNED' ? 'FAIL' : 'NEEDS_REVIEW'; severity = advisory ? 'MINOR' : j.label === 'NOT_ALIGNED' ? 'MAJOR' : 'MINOR'; }
    if (j.type === 'Value-map' && !j.unverified && j.label !== 'ALIGNED') { status = 'NEEDS_REVIEW'; severity = 'MINOR'; } // not enough evidence for a core value: ask for review
    const introRow = /^plan\[(\d+)\]/.exec(j.path || '');
    const groupedIntro = j.type === 'Week1-introduction' && introRow && weeksIn(content.plan?.[Number(introRow[1])]?.week).length > 1;
    if(groupedIntro && status === 'PASS')status='NEEDS_REVIEW'; // row-level fit cannot prove which grouped week contains the introduction
    // Which element is responsible: the weekly content comes first, so an ILO is only held to account once its week's content belongs to the course.
    const owner = { 'Title-description':'description', 'Week1-introduction':'course_content', 'Content-course': 'course_content', 'Content-ILO': 'ilo', 'Course-CLO': 'clo', 'CLO-set': 'clo', 'CLO-PO': 'clo', 'CLO-EGA': 'clo', 'ILO-CLO': 'ilo', 'ILO-anyCLO': 'clo_mapping', 'CLO-coverage': 'course_plan', 'ILO-activity': 'activity', 'Activity-fit': 'activity', 'ILO-assessment': 'assessment', 'Assessment-fit': 'assessment', 'Module-value': 'values', 'Value-use': 'values', 'Value-map': 'values', 'Ref-relevance': 'references', 'Content-activity': 'activity', 'Content-assessment': 'assessment', 'Activity-assessment': 'assessment' }[j.type] || null;
    let responsible = owner, waits = false;
    // Stage E.4: an answer that keeps the text and says only its tag is wrong (RETAG_OUTCOME) holds the tag responsible, not the statement.
    if (j.recommendation === 'RETAG_OUTCOME' && status !== 'PASS' && status !== 'NOT_CHECKED') responsible = j.type === 'ILO-CLO' ? 'clo_mapping' : 'po_mapping';
    if (j.type === 'Content-ILO' && status !== 'PASS' && status !== 'NOT_CHECKED') {
      const week = /^row(\d+)-/.exec(j.id), content0 = week && (alignment.judgements || []).find(x => x.id === `row${week[1]}-content`);
      if (content0 && content0.label === 'NOT_ALIGNED') { waits = true; responsible = 'course_content'; status = 'NEEDS_REVIEW'; severity = 'INFO'; }
    }
    // A verdict about the whole plan is only as good as the weeks it cites: an explanation that names a week the plan does not have is not grounded.
    let ungrounded = [];
    if ((j.type === 'CLO-coverage' || j.type === 'Plan-sequence') && status !== 'PASS' && status !== 'NOT_CHECKED') { ungrounded = citedWeeks(j.explanation, content).missing; if (ungrounded.length) status = 'NEEDS_REVIEW'; }
    // Stage B4: the state of the CLO's coverage combines the model's verdict with the checked ILO-CLO evidence (coverage.js coverageSummary).
    let coverageState = null, supportingWeeks = null, gaps = null;
    if (j.type === 'CLO-coverage') {
      const k = Number((/^coverage-clo(\d+)$/.exec(j.id) || [])[1]), cs = (report.hybrid?.coverageSummary || []).find(x => x.cloIndex === k);
      if (cs) { coverageState = cs.state; supportingWeeks = cs.supportingWeeks; gaps = cs.gaps; if (status !== 'NOT_CHECKED' && cs.state === 'insufficient_evidence') { status = 'NEEDS_REVIEW'; severity = 'MINOR'; } }
    }
    // A Week 1 orientation ILO that is tagged to a technical CLO: the official ILO-CLO check is unchanged, but here it is information, not a failure.
    let orientation = false;
    if (j.type === 'ILO-CLO' && status !== 'PASS' && status !== 'NOT_CHECKED') {
      const at = /^row(\d+)-ilo(\d+)-/.exec(j.id), row = at && content.plan?.[Number(at[1])];
      if (row && orientationIlo(row, row.ilos?.[Number(at[2])])) { orientation = true; status = 'NEEDS_REVIEW'; severity = 'INFO'; responsible = 'institution_policy'; }
    }
    // Stage C: a rewrite of an activity or an assessment waits for the fields before it (draftWithheld). The activity verdict can also carry "Teaching: sound"
    // with only the learner support limited; that is reported as its own finding (ALN-06) and does not make the teaching itself partial.
    const stages = report.hybrid?.stages || {};
    const lesson = ['Activity-fit', 'Assessment-fit', 'Value-use', 'Value-map', 'Ref-relevance'].includes(j.type);
    const open = status !== 'PASS' && status !== 'NOT_CHECKED';
    const withheld = !open ? null : draftWithheld(j.type, j.id, content, alignment.judgements || [], stages) || (j.draft && OUTCOME_FIT.has(j.type) && offCourse.has(j.targetPath) ? 'clo_off_course' : j.draft && j.draftReview?.includes('replaces_core_value') ? 'value_replaced' : j.draft && j.draftReview?.length ? 'draft_review' : j.draft && heldBack.has(j.id) ? 'retag_conflict' : null);
    const asp = lesson && !j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE' ? readAspects(j) : null;
    const aspects = asp ? asp.values : {};
    const conflicting = !!asp && asp.contradictions.length > 0;
    // Stage E.6: the coverage of the answer's fields (aspects.js coverageOf), kept apart from whether the answer itself verified. A field the answer did
    // not assess is never read as verified, and an answer stored without any fields has every field missing.
    const cov = asp ? coverageOf(j) : null;
    const fieldIs = state => !!cov && cov.unassessed.some(key => cov.fields[key] === state);
    const responseNote = !asp ? null : conflicting ? 'contradictory' : asp.invalid.length ? 'aspects_malformed' : asp.missing.length || fieldIs('missing') ? 'aspects_missing' : fieldIs('not_assessed') ? 'aspects_not_assessed' : null;
    // A contradictory answer (the label says the opposite of its own fields) is not trusted either way: it is shown for review, with no rewrite and no derived rule.
    if (conflicting) { status = 'NEEDS_REVIEW'; severity = 'MINOR'; }
    if (withheld === 'upstream_invalid') { const at = /^row(\d+)-/.exec(j.id); const up = at && content.plan?.[Number(at[1])] ? upstreamOf(alignment.judgements || [], Number(at[1]), content.plan[Number(at[1])]) : null; if (up && up.culprit) responsible = up.culprit; }
    const teachingSound = !conflicting && j.type === 'Activity-fit' && j.label === 'PARTIALLY_ALIGNED' && aspects.teaching === 'sound';
    if (teachingSound) status = 'PASS';
    // Stage E.6: a base judgement whose own field the answer did not assess (aspects.js DECISIVE: the teaching for ALN-05, whether the task measures
    // the ILO for ALN-07, how the value is used for VAL-03, the core value and its integration for VAL-05, the relevance for REF-05) is neither a pass
    // nor a fail: it is shown for review. With that field assessed the base judgement stands, whatever other field is unassessed: those rules are
    // NOT_CHECKED below. The answer is kept, and a field it did assess still counts.
    const restsOnUnassessed = !!cov && !conflicting && cov.decisive.length > 0 && (status === 'PASS' || status === 'FAIL');
    const unassessedNote = !restsOnUnassessed ? '' : `The verdict rests on what the AI did not assess in this answer (${cov.decisive.map(key => ASPECT_NAME[key] || key).join(', ')}), so it is shown for review and not counted as ${status === 'PASS' ? 'a pass' : 'a failure'}. `;
    if (restsOnUnassessed) { status = 'NEEDS_REVIEW'; severity = 'MINOR'; }
    // actual = the faculty's own text in the field; reference = the approved/supplied text it was judged against (a quote the server found in it).
    const field = textAt(content, j.targetPath || j.path);
    const quoted = j.evidenceMatching && j.evidenceMatching.source !== 'not_evaluated' && j.evidenceMatching.target !== 'not_evaluated';
    // Stage C3 advises only (its one-sentence recommendation never replaces the faculty's text), as the answer contract records it (gemini.js NO_REWRITE).
    add({ ruleId, legacyRuleId: j.type, relationshipId: j.id, recommendationType: open && j.recommendation === 'RETAG_OUTCOME' ? (retagAdvised.has(j.id) ? 'RETAG_OUTCOME' : 'REVIEW_REQUIRED') : open && (CHAIN[j.type] || REQUIREMENTS[j.type]) ? 'REVIEW_REQUIRED' : undefined, category, path: j.path, status, severity, method: 'ai_semantic', actual: field || j.targetQuote, evidence: j.targetQuote || null, reference: j.sourceQuote || null, clo: ((/^coverage-clo(\d+)$/.exec(j.id) || [])[1] !== undefined ? Number(/^coverage-clo(\d+)$/.exec(j.id)[1]) + 1 : undefined), verification: conflicting ? 'contradictory_response' : restsOnUnassessed ? 'aspects_not_assessed' : ungrounded.length ? 'cited_week_not_in_plan' : status === 'NOT_CHECKED' ? 'not_checked' : quoted ? 'quotes_verified' : 'unverified', bloom: j.sourceBloom && j.sourceBloom !== 'N/A' ? { reference: j.sourceBloom, field: j.targetBloom } : null, coverageState, supportingWeeks, gaps, responseNote,
      explanationReview: j.explanationReview, draftReview: j.draftReview, draftWarnings: j.draftWarnings, reviewEvidence: j.reviewEvidence,
      // Stage E.6: "value lived in" only for a value the answer found integrated (an opportunity is not a lived value); "nothing carries it" always.
      carriedBy: aspects.carriedBy && aspects.carriedBy !== 'not_assessed' && (aspects.carriedBy === 'none' || aspects.valueUse === 'integrated') ? aspects.carriedBy : undefined, aspectCoverage: cov ? { fields: cov.fields, assessed: cov.assessed, unassessed: cov.unassessed } : undefined, definitions: j.type === 'Value-use' || j.type === 'Module-value' ? (report.hybrid?.valuesDefinitions || undefined) : undefined, modelResponsible: asp && aspects.responsible && !['none', 'not_assessed'].includes(aspects.responsible) ? aspects.responsible : undefined, explanation: groupedIntro && status !== 'NOT_CHECKED' ? 'This grouped row does not establish when its introduction occurs. Faculty must confirm Week 1 timing. ' + (j.explanation || '') : conflicting ? `The AI's answer contradicts itself (${asp.contradictions.join('; ')}), so it is shown for review only. ${j.explanation || ''}` : unassessedNote ? unassessedNote + (j.explanation || '') : withheld ? (j.explanation || '') : orientation ? `This is a Week 1 course-orientation ILO. Every ILO needs a CLO tag (rule T-13) and the official ILO-CLO check is unchanged; whether an orientation ILO should be judged against a technical CLO is an institutional decision, so this is shown for information. ${j.explanation || ''}` : ungrounded.length ? `[The explanation cites week(s) ${ungrounded.join(', ')}, which the plan does not contain, so it is not grounded in the supplied weeks and needs a human look.] ${j.explanation || ''}` : waits ? `This week's course content is itself not about the course, so correct the content first and check the ILO afterwards. ${j.explanation || ''}` : j.explanation || '', responsible, recommendation: groupedIntro && status === 'NEEDS_REVIEW' ? 'Confirm that the course subject and objectives are introduced in Week 1 within this grouped row.' : status === 'PASS' || status === 'NOT_CHECKED' || waits || withheld || conflicting ? null : j.draft || null, withheld: withheld || undefined, withheldNote: withheld ? WITHHELD[withheld] : undefined });
    // Stage C: the structured fields the model answered become their own rules. Only a valid, uncontradicted value is used; a missing or malformed field
    // leaves its rule NOT_CHECKED, and nothing is ever inferred as a pass.
    const extra = (ruleId, state, text, recommendation, verification = 'structured_field') => add({ ruleId, legacyRuleId: j.type, relationshipId: j.id, category: /^VAL/.test(ruleId) ? 'quality' : 'activitiesAssessments', path: j.path, status: state, severity: state === 'PASS' || state === 'NOT_CHECKED' ? 'INFO' : 'MINOR', method: 'ai_semantic', actual: field || j.targetQuote, evidence: j.targetQuote || null, reference: j.sourceQuote || null, verification, responsible, explanation: text, recommendation: state === 'PASS' || state === 'NOT_CHECKED' || withheld ? null : recommendation || null });
    // Stage E.6: a derived rule whose field this answer did not assess (not_assessed, missing or malformed) is NOT_CHECKED for this relationship: it
    // is reported, never left out and never passed. An answer stored without any field record (before Stage C) has no coverage and no derived rule.
    const notAssessed = key => !!cov && cov.unassessed.includes(key) && extra(ASPECT_RULE[key], 'NOT_CHECKED', `The AI did not assess ${ASPECT_NAME[key]} in this answer, so this rule is not checked for this lesson.`, null, 'aspect_not_assessed');
    if (asp && !conflicting) {
      if (j.type === 'Activity-fit') {
        if (aspects.learnerSupport === 'adequate') extra('ALN-06', 'PASS', 'The AI judged the learner support adequate for this lesson.');
        else if (aspects.learnerSupport === 'limited') extra('ALN-06', 'NEEDS_REVIEW', j.explanation || '', j.draft);
        else notAssessed('learnerSupport');
      }
      if (j.type === 'Value-use') {
        if (aspects.valueFit === 'fits') extra('VAL-02', 'PASS', 'The AI judged the value to fit what students do in this lesson.');
        else if (aspects.valueFit === 'partly') extra('VAL-02', 'NEEDS_REVIEW', 'The named value fits only part of what students do in this lesson. ' + (j.explanation || ''), null);
        else if (aspects.valueFit === 'clashes') extra('VAL-02', 'NEEDS_REVIEW', j.explanation || '', j.draft);
        else notAssessed('valueFit');
      }
      if (j.type === 'Assessment-fit') {
        if (aspects.evidence === 'observable') extra('ALN-08', 'PASS', 'The AI judged the evidence this task produces observable.');
        else if (aspects.evidence === 'vague') extra('ALN-08', 'NEEDS_REVIEW', 'The task does not say what is produced or answered. ' + (j.explanation || ''), null);
        else notAssessed('evidence');
        if (aspects.level === 'matches') extra('ALN-09', 'PASS', 'The AI judged the cognitive level and difficulty to match the ILO.');
        else if (aspects.level === 'too_low' || aspects.level === 'too_high') extra('ALN-09', 'NEEDS_REVIEW', 'The task is ' + (aspects.level === 'too_low' ? 'below' : 'above') + ' the level of the ILO. ' + (j.explanation || ''), null);
        else notAssessed('level');
      }
    }
  }
  // Stage A: a CLO that is sound for the course but tagged to a PO / EGA it does not develop. Advice to re-tag; the CLO text is left alone.
  for (const a of report.hybrid?.mappingAdvice || []) {
    if (a.type === 'CLO') { // Stage B3: a sound ILO tagged to a CLO it does not build; another approved CLO does
      const current = a.current.length ? a.current.map(n => `CLO ${n}`).join(', ') : 'no CLO';
      const target = (report.hybrid?.coverageSummary || []).find(x => x.number === a.suggested), helps = target && target.state === 'insufficient' ? 'insufficient' : target && target.state === 'partial' ? 'only partial' : '';
      add({ ruleId: 'ALN-02', legacyRuleId: 'mapping-advice', relationshipId: a.basedOn?.[0], recommendationType: 'RETAG_OUTCOME', category: 'planAlignment', path: a.path, status: 'NEEDS_REVIEW', severity: 'MINOR', method: 'ai_semantic', actual: current, reference: a.suggestedText, evidence: a.evidence, verification: 'quotes_verified', responsible: 'clo_mapping', clo: a.suggested, explanation: `This ILO builds CLO ${a.suggested} better than the CLO it is tagged with. ${a.reason}`, recommendation: `Consider tagging this ILO to CLO ${a.suggested} ("${a.suggestedText}") instead of ${current}. The ILO text itself does not need to change.${a.contentCheck === 'verified' ? '' : " Before re-tagging, confirm that the ILO fits the week's course content (that was not checked in this run)."}${helps ? ` This would also give CLO ${a.suggested} another week of instruction, which its coverage check found ${helps}.` : ''}` });
      continue;
    }
    const current = a.current.length ? a.current.map(n => `${a.type} ${n}`).join(', ') : `no ${a.type}`;
    add({ ruleId: a.type === 'PO' ? 'CLO-06' : 'CLO-07', legacyRuleId: 'mapping-advice', relationshipId: a.basedOn?.[0], recommendationType: 'RETAG_OUTCOME', category: 'cloAlignment', path: a.path, status: 'NEEDS_REVIEW', severity: 'MINOR', method: 'ai_semantic', actual: current, reference: a.suggestedText, evidence: a.evidence, verification: 'quotes_verified', responsible: 'po_mapping', explanation: `This CLO fits ${a.type} ${a.suggested} better than the ${a.type} it is tagged with. ${a.reason}`, recommendation: `Consider tagging this CLO to ${a.type} ${a.suggested} (approved wording: "${a.suggestedText}") instead of ${current}. The CLO statement itself does not need to change.` });
  }
  // Stage B4: a CLO whose coverage could not be asked (the plan has fewer than three teaching weeks) is "insufficient evidence", said once and plainly.
  for (const cs of report.hybrid?.coverageSummary || []) {
    if (cs.state === 'insufficient_evidence' && cs.reason === 'plan_too_short') add({ ruleId: 'PLAN-10', legacyRuleId: 'CLO-coverage', category: 'planAlignment', path: 'plan', status: 'NEEDS_REVIEW', severity: 'INFO', method: 'deterministic', clo: cs.number, responsible: 'course_plan', verification: 'not_checked', coverageState: 'insufficient_evidence', explanation: `The learning plan has fewer than three instructional weeks with course content, so whether CLO ${cs.number} is covered cannot be decided.`, recommendation: null });
  }
  // Stage B4: the evidence behind each CLO's coverage, from verdicts already made (no extra request). A tag is never counted as coverage by itself.
  for (const row of report.hybrid?.coverage || []) {
    const weeks = list => list.weeks.join(', ');
    const at = (status, severity, explanation, evidence) => add({ ruleId: 'PLAN-10', legacyRuleId: 'coverage-evidence', category: 'planAlignment', path: 'plan', status, severity, method: 'deterministic', clo: row.cloIndex + 1, responsible: 'course_plan', verification: 'derived_from_checked_relationships', reference: (content.clos?.[row.cloIndex]?.statement) || null, evidence, explanation, recommendation: null });
    const summary = `Tagged weeks: ${weeks(row.tagged) || 'none'}; judged to build the CLO: ${weeks(row.supported) || 'none'}`;
    if (!row.tagged.weeks.length) at('NEEDS_REVIEW', 'MINOR', `No instructional week is tagged to CLO ${row.cloIndex + 1}, so the plan gives it no recorded support.`, summary);
    if (row.unsupported.weeks.length) at('NEEDS_REVIEW', 'MINOR', `Week(s) ${weeks(row.unsupported)} are tagged to CLO ${row.cloIndex + 1} but their ILOs were judged not to build it, so they do not count as coverage.`, summary);
    if (row.offCourse.weeks.length) at('NEEDS_REVIEW', 'INFO', `Week(s) ${weeks(row.offCourse)} are tagged to CLO ${row.cloIndex + 1} but their course content is not about the course, so they cannot count as coverage until the content is corrected.`, summary);
  }
}

// ---- Summary ----
const evaluated = f => f.status === 'PASS' || f.status === 'FAIL' || f.status === 'NEEDS_REVIEW';
const real = f => f.severity !== 'INFO'; // INFO rows explain; they do not decide
function statusOf(list, { missing }) {
  if (missing) return 'NOT_CHECKED';
  if (list.some(f => f.status === 'FAIL' && real(f))) return 'FAIL';
  if (list.some(f => f.status === 'NEEDS_REVIEW' && (real(f) || f.category === 'curriculum'))) return 'NEEDS_REVIEW';
  return list.some(evaluated) ? 'PASS' : 'NOT_CHECKED';
}
function weighted(findings) {
  const groups = Object.keys(CONFIG.rubric.weights), blank = [];
  let total = 0;
  for (const g of groups) {
    const list = findings.filter(f => f.category === g);
    const done = list.filter(f => f.status === 'PASS' || f.status === 'FAIL');
    if (!done.length || list.some(f => f.status === 'NOT_CHECKED')) { blank.push(g); continue; }
    total += CONFIG.rubric.weights[g] * done.filter(f => f.status === 'PASS').length / done.length;
  }
  // A single percentage over unevaluated categories would be misleading, so none is shown.
  return blank.length ? { score: null, approved: false, reason: `Not evaluated: ${blank.join(', ')}` } : { score: Math.round(total), approved: false, reason: 'Proposed weights, not university-approved.' };
}
// ---- Stage D2: references, from the deterministic report ----
// Three separate answers per reference: FORMAT (REF-02, REF-03, REF-04, from the text alone), RELEVANCE (REF-05, the AI, above) and AUTHENTICITY (only an external
// check can say; without one it is "not verified", reported once for the list). The mechanical repair, when there is one, uses only characters already in the reference.
const REF_RULE = { DATE_MISSING: 'REF-03', AUTHOR_MISSING: 'REF-03', TITLE_MISSING: 'REF-03', JOURNAL_VOLUME: 'REF-03', JOURNAL_PAGES: 'REF-03', JOURNAL_NAME: 'REF-03', BOOK_PUBLISHER: 'REF-03', CONF_IN: 'REF-03', WEB_URL: 'REF-03', DOI_FORM: 'REF-04', DOI_MALFORMED: 'REF-04', URL_HTTP: 'REF-04', URL_MALFORMED: 'REF-04', URL_TWICE: 'REF-04', RETRIEVED: 'REF-04' };
function fromReferences(report, content, add) {
  const entries = report.hybrid?.references;
  if (!Array.isArray(entries)) return;
  let notVerified = 0;
  for (const e of entries) {
    if (e.blank) continue;
    for (const rule of ['REF-02', 'REF-03', 'REF-04']) {
      const mine = (e.issues || []).filter(i => (REF_RULE[i.code] || 'REF-02') === rule);
      const definite = mine.some(i => i.severity === 'definite');
      const uncertain = rule === 'REF-02' && !mine.length && e.format && e.format.uncertain;
      const status = mine.length ? (definite ? 'FAIL' : 'NEEDS_REVIEW') : uncertain ? 'NEEDS_REVIEW' : 'PASS';
      const mechanical = mine.some(i => i.fix) && e.suggestedText;
      const text = mine.length ? mine.map(i => i.message).join(' ') : uncertain ? 'The kind of source (book, article, conference paper, website, official document) could not be told from the text, so no rule specific to a kind of source was applied.' : 'No problem found by the deterministic checks.';
      const recommendation = !mine.length ? null : mechanical ? 'Mechanical correction (uses only what the reference already contains): ' + e.suggestedText : rule === 'REF-03' ? 'Add the missing part(s) (' + (e.missing || []).join(', ') + ') exactly as they appear on the source itself.' : 'Correct this to follow APA 7 for this kind of source, using only what the source itself shows.';
      add({ ruleId: rule, legacyRuleId: 'reference-format', category: 'quality', path: e.path, status, severity: status === 'PASS' || uncertain ? 'INFO' : 'MINOR', method: 'deterministic', actual: e.text, reference: 'APA 7' + (e.type && e.type.kind !== 'unknown' ? ', ' + e.type.kind + ' (kind read from the text, ' + e.type.confidence + ' confidence)' : ''), verification: 'deterministic', responsible: 'references', explanation: text, issueMessages: mine.length > 1 ? mine.map(i => i.message) : undefined, recommendation, authenticity: e.authenticity && e.authenticity.status });
    }
    const auth = e.authenticity || { status: 'not_verified' };
    if (auth.status === 'verified') add({ ruleId: 'REF-04', legacyRuleId: 'authenticity', category: 'quality', path: e.path, status: 'PASS', severity: 'INFO', method: 'deterministic', actual: e.text, reference: 'Crossref', verification: 'external_check', responsible: 'references', explanation: 'The DOI is registered with Crossref and its title and year agree with the reference. This shows the work exists; it does not show that it is relevant or that the rest of the reference is right.', authenticity: 'verified' });
    else if (auth.status === 'mismatch' || auth.status === 'not_found') add({ ruleId: 'REF-04', legacyRuleId: 'authenticity', category: 'quality', path: e.path, status: 'NEEDS_REVIEW', severity: 'MINOR', method: 'deterministic', actual: e.text, reference: 'Crossref', verification: 'external_check', responsible: 'references', explanation: auth.status === 'not_found' ? 'The DOI was not found in Crossref. Check it against the source; nothing is concluded about the work.' : 'The DOI exists but is registered with another title or year' + (auth.registered ? ' (' + (auth.registered.title || '?') + ', ' + (auth.registered.year || '?') + ')' : '') + '. Check the reference against the source.', authenticity: auth.status });
    else notVerified += 1;
  }
  if (notVerified) add({ ruleId: 'REF-04', legacyRuleId: 'authenticity', category: 'quality', path: 'refs', status: 'NOT_CHECKED', severity: 'INFO', method: 'deterministic', verification: 'not_checked', responsible: 'references', explanation: notVerified + ' of ' + entries.length + ' reference(s) were not checked against any external source, so whether the works exist as cited is not known. A correct format does not show that a reference is authentic.', authenticity: 'not_verified' });
}
// ---- Stage D1: VAL-04, the values across the whole course ----
function fromValuesProfile(report, content, add) {
  const p = report.hybrid?.valuesProfile;
  if (!p) return;
  const used = Object.entries(p.valuesUsed || {}).filter(([, n]) => n > 0).map(([name, n]) => name + ' (' + n + ')').join(', ') || 'none';
  const base = { ruleId: 'VAL-04', legacyRuleId: 'values-profile', category: 'quality', path: 'plan', method: 'deterministic', responsible: 'values', definitions: p.definitions, supportingWeeks: p.integratedWeeks && p.integratedWeeks.length ? { checked: p.integratedWeeks, cited: [] } : null };
  if (p.copied) return add({ ...base, status: 'NEEDS_REVIEW', severity: 'MINOR', verification: 'deterministic', explanation: 'The same values statement is written in ' + p.copied.lessons + ' of ' + p.copied.of + ' lessons ("' + p.copied.text + '"). A value that is copied unchanged cannot say how it is lived in each lesson. No value is required in every lesson, and the course need not use all six.', recommendation: 'Write the values statement of each lesson from what students do in that lesson; a value may repeat, its description should not.' });
  if (!p.checked) return add({ ...base, status: 'NOT_CHECKED', severity: 'INFO', verification: 'not_checked', explanation: 'Whether the values are integrated across the course could not be judged: no lesson has a verified answer yet. Values used so far: ' + used + '.' });
  const share = p.integrated / p.checked;
  add({ ...base, status: share < p.policy.minIntegratedShare ? 'NEEDS_REVIEW' : 'PASS', severity: share < p.policy.minIntegratedShare ? 'MINOR' : 'INFO', verification: 'derived_from_checked_relationships', explanation: p.integrated + ' of ' + p.checked + ' lessons that name a value were judged to integrate it (values named: ' + used + '). The share that raises a review (' + Math.round(p.policy.minIntegratedShare * 100) + '%) is a proposal, not an approved institutional threshold; no value is required in every lesson.', recommendation: share < p.policy.minIntegratedShare ? 'Look at the lessons whose values statement was judged not to be integrated and describe, for each, what students do that expresses the value.' : null });
}
// ---- Stage D1: what the values column contains (valueClassification.js), where no model answer exists ----
const CLASS_TEXT = {
  needs_review: 'The lesson writes supporting values or behaviours and no official core value. Which core value they support depends on what students do in the lesson, and no verified evidence is available yet.',
  competency_only: 'The entries are academic competencies or graduate attributes (for example Critical Thinking). They are not Marian-Augustinian core values; name the core value the lesson lives through its activity.',
  unclassified: 'The entries are not recognised as a core value, a supporting value or a competency. Nothing is concluded; please review.',
};
function fromValuesClassification(report, content, add) {
  const list = report.hybrid?.valuesClassification;
  if (!Array.isArray(list)) return;
  const judged = new Set((report.hybrid?.alignment?.judgements || []).filter(j => j.type === 'Value-map' && !j.unverified).map(j => j.path));
  for (const c of list) {
    if (!CLASS_TEXT[c.classificationStatus] || judged.has(c.path)) continue;
    add({ ruleId: 'VAL-05', legacyRuleId: 'values-classification', category: 'quality', path: c.path, status: 'NEEDS_REVIEW', severity: 'MINOR', method: 'deterministic', verification: 'not_checked', responsible: 'values', actual: (c.expressions || []).map(e => e.text).join('; '),
      explanation: CLASS_TEXT[c.classificationStatus], recommendation: (report.hybrid?.suggestions || []).some(s => s.path === c.path) ? 'A draft written from this lesson is offered among the recommendations; accept it only if it says what students actually do.' : 'Keep the wording if intended, and review it against what students do in this lesson. No replacement is proposed.', classification: { canonicalCoreValue: c.canonicalCoreValue, supportingValue: c.supportingValue, classificationStatus: c.classificationStatus } });
  }
}
// The separate answers (never merged into one): structure, curriculum, alignment, institutional values, references, and the course identity they rest on.
const GROUPS = {
  structure: f => f.category === 'structure' && !/^(VAL|REF)-/.test(f.ruleId),
  curriculum: f => f.category === 'curriculum',
  academicAlignment: f => ['cloAlignment', 'planAlignment', 'activitiesAssessments'].includes(f.category) && !/^(VAL|REF)-/.test(f.ruleId),
  values: f => /^VAL-/.test(f.ruleId),
  references: f => /^REF-/.test(f.ruleId),
};
function statesOf(findings, hybrid, aiDone) {
  const one = (pred, { needsAi = false } = {}) => statusOf(findings.filter(f => pred(f) && f.status !== 'NOT_APPLICABLE'), { missing: needsAi && !aiDone });
  const refs = findings.filter(GROUPS.references);
  return {
    identity: hybrid.identity ? { status: hybrid.identity.status, elsewhere: hybrid.identity.elsewhere || [] } : null,
    structure: one(GROUPS.structure), curriculum: one(f => GROUPS.curriculum(f) && f.method === 'deterministic'),
    academicAlignment: one(GROUPS.academicAlignment, { needsAi: true }),
    values: one(GROUPS.values),
    references: { format: statusOf(refs.filter(f => f.method === 'deterministic' && f.legacyRuleId === 'reference-format'), { missing: false }), relevance: statusOf(refs.filter(f => f.ruleId === 'REF-05'), { missing: !aiDone }),
      authenticity: refs.some(f => f.authenticity === 'verified') && !refs.some(f => f.authenticity && f.authenticity !== 'verified') ? 'PASS' : refs.some(f => f.authenticity === 'mismatch' || f.authenticity === 'not_found') ? 'NEEDS_REVIEW' : 'NOT_CHECKED' },
  };
}
// Suggestions that are information, not findings: the approved spelling of a title that differs only in capitalisation or spacing AND that the official
// check accepted (normalised policy active). While the official check still fails it, the finding itself carries the approved spelling instead.
function informationalOf(hybrid) {
  const out = [];
  for (const c of hybrid.codedChecks || []) {
    if (c.ruleId === 'CUR-FIELD' && c.path === 'meta.title' && c.status === 'PASS' && titleRelation(c.evidence?.actual, c.evidence?.expected).relation === 'case_or_space') out.push({ ruleId: 'CUR-04', kind: 'formatting', path: c.path, entered: c.evidence.actual, approved: c.evidence.expected });
  }
  return out;
}
function buildVerdict(report, content, options = {}) {
  const limit = Number.isInteger(options.maxShown) && options.maxShown > 0 ? options.maxShown : CONFIG.maxShown;
  report = report || {}; content = content || {};
  const hybrid = report?.hybrid || {};
  const alignment = hybrid.alignment || {};
  const aiDone = alignment.status === 'completed';
  const findings = [];
  const add = f => findings.push(finding(content, f));
  fromCoded(report, content, add);
  cloChecks(content, add);
  fillerChecks(content, add);
  weekOneCheck(content, add);
  fromAi(report, content, add);
  fromReferences(report, content, add);
  fromValuesClassification(report, content, add);
  fromValuesProfile(report, content, add);
  // The classification of a lesson's values travels with its Value-map finding.
  for (const f of findings) if (f.legacyRuleId === 'Value-map' && !f.classification) { const c = (hybrid.valuesClassification || []).find(x => x.path === f.path); if (c) f.classification = { canonicalCoreValue: c.canonicalCoreValue, supportingValue: c.supportingValue, classificationStatus: c.classificationStatus, integrationEvidence: c.integrationEvidence }; }
  // Feedback given while the course identity is not verified is labelled provisional; it can never make the verdict COMPLIANT (the curriculum check fails then).
  const identityOpen = hybrid.identity && hybrid.identity.status !== 'verified';
  if (identityOpen) for (const f of findings) if (f.method === 'ai_semantic' && f.status !== 'NOT_CHECKED') {
    f.identityBasis = 'provisional'; f.verification = 'provisional_identity';
    // a claim that the CLOs or the plan fit THIS course needs the course identity: without it, no pass is recorded
    if (f.status === 'PASS' && NEEDS_IDENTITY.has(f.legacyRuleId)) { f.status = 'NOT_CHECKED'; f.explanation = 'Not counted: the course identity is not verified in the approved curriculum, so no claim is made that this fits the course.'; }
  }
  const wanted = { ...Object.fromEntries(Object.values(AI)), ...SEMANTIC, ...(hybrid.stages?.c3 ? Object.fromEntries(Object.values(CHAIN)) : {}), ...(hybrid.stages?.requirements ? Object.fromEntries(Object.values(REQUIREMENTS)) : {}) };
  for (const [ruleId, category] of Object.entries(wanted)) if (!findings.some(f => f.ruleId === ruleId)) add({ ruleId, category, status: 'NOT_CHECKED', severity: 'INFO', method: 'ai_semantic', explanation: aiDone ? 'No scoped AI check covers this rule yet.' : 'Needs AI semantic evaluation, which did not complete.' });
  for (const [ruleId, pending] of Object.entries(require('./pendingRules'))) {
    const existing = findings.find(f => f.ruleId === ruleId && f.status === 'NOT_CHECKED');
    if (existing) existing.explanation = pending.reason;
    else add({ ruleId, category: ruleId.startsWith('ADM-') ? 'quality' : 'structure', status: 'NOT_CHECKED', severity: 'INFO', method: PENDING[ruleId] ? 'deterministic' : 'ai_semantic', explanation: pending.reason });
  }
  if (!aiDone) for (const f of findings) if (f.method === 'ai_semantic' && f.status === 'PASS') f.status = 'NOT_CHECKED'; // never a pass when the run did not complete
  const curriculum = statusOf(findings.filter(f => f.category === 'curriculum' && f.method === 'deterministic' && f.status !== 'NOT_CHECKED'), { missing: false });
  const aiRules = findings.filter(f => f.method === 'ai_semantic' && (AI[f.legacyRuleId] || CHAIN[f.legacyRuleId] || REQUIREMENTS[f.legacyRuleId]));
  const alignmentStatus = statusOf(aiRules, { missing: !aiDone });
  const structural = findings.filter(f => f.method === 'deterministic' && f.status === 'FAIL' && (f.severity === 'MAJOR' || f.severity === 'CRITICAL'));
  const critical = findings.some(f => f.status === 'FAIL' && f.severity === 'CRITICAL');
  const unverified = [...new Map(findings.filter(f => f.status === 'NOT_CHECKED').map(f => [f.ruleId, { ruleId: f.ruleId, category: f.category, method: f.method, reason: f.explanation }])).values()];
  let overall;
  if (critical || curriculum === 'FAIL' || alignmentStatus === 'FAIL' || structural.length) overall = 'NOT_COMPLIANT';
  // COMPLIANT needs every semantic check made: a rule that returned NOT_CHECKED can never be counted as passed.
  else if (curriculum === 'NOT_CHECKED' || alignmentStatus === 'NOT_CHECKED' || unverified.some(u => u.method === 'ai_semantic')) overall = 'PARTIAL_VALIDATION';
  else if (curriculum === 'NEEDS_REVIEW' || alignmentStatus === 'NEEDS_REVIEW') overall = 'NEEDS_REVIEW';
  else overall = 'COMPLIANT';
  const counts = Object.fromEntries(STATUS.map(s => [s, findings.filter(f => f.status === s).length]));
  const hasJudgements = (alignment.judgements || []).some(j => !j.unverified);
  // Keep a passed relationship with a reasoning warning visible without adding a second finding or changing its PASS result.
  const open = findings.filter(f => f.status !== 'PASS' || f.explanationReview?.length || f.draftReview?.length || f.draftWarnings?.length);
  const rank = { FAIL: 0, NEEDS_REVIEW: 1, NOT_CHECKED: 2, NOT_APPLICABLE: 3, PASS: 4 };
  const shown = open.length <= limit ? { list: open, omitted: 0 } : { list: open.map((f, i) => [f, i]).sort((a, b) => rank[a[0].status] - rank[b[0].status] || a[1] - b[1]).slice(0, limit).sort((a, b) => a[1] - b[1]).map(x => x[0]), omitted: open.length - limit };
  // Stage E.6: how many of the lesson answers' fields were assessed, reported apart from how many answers verified (aspects.js coverageSummaryOf).
  const aspectCoverage = coverageSummaryOf(alignment.judgements);
  return {
    version: VERSION, advisory: true, // shadow: the official score, pass mark and gates are unchanged
    mode: aiDone ? 'ai' : hasJudgements ? 'ai_partial' : 'offline',
    completeness: { percent: report?.baseScore ?? hybrid.baseScore ?? null, meaning: 'How fully the required fields are filled. Says nothing about academic fit.' },
    curriculum, alignment: alignmentStatus, overall, states: statesOf(findings, hybrid, aiDone), informational: informationalOf(hybrid),
     scope: unverified.length ? 'partial' : 'full',
    rubric: weighted(findings), counts, unverified,
    findings: shown.list, omitted: shown.omitted, // passes are only counted; when the list is cut, FAIL and NEEDS_REVIEW are kept before NOT_CHECKED, and the cut is reported
    config: { expectedCloCount: CONFIG.expectedCloCount, rubric: CONFIG.rubric },
    ...(aspectCoverage ? { aspectCoverage } : {}),
    ...(options.all ? { all: findings } : {}), // diagnostics and tests only: every finding including the passes (never stored)
  };
}
module.exports = { buildVerdict, VERSION, CONFIG, isPlaceholder, STATUS };
