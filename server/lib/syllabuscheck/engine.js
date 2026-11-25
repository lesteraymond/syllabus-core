'use strict';
const { canonical } = require('../compliance/hash');
const { evaluate } = require('../compliance/rules');
const { POLICY } = require('./policy');
const { gradingTotal, weeksOf, mappingChecks } = require('./validation');
const { bindSuggestions } = require('./suggestions');
const standard = require('../compliance/standard-v4.json');
const { checkLinks } = require('./links');
const { samePrerequisite, isBlankCell, notListedMessage } = require('./prerequisite');
const { summarize } = require('./stewardship');
const { qualityOf, VERSION: QUALITY_VERSION } = require('./quality');
const VERSION = 'hybrid-2';
const VALUES = ['Compassion', 'Courage', 'Community-orientedness', 'Humility', 'Interiority', 'Missionary Spirit'];
const HEADERS = ['I. COURSE CODE', 'II. COURSE TITLE', 'III. COURSE DESCRIPTION', 'IV. PRE-REQUISITE', 'V. CREDIT UNITS', 'VI. COURSE LEARNING OUTCOMES', 'VII. LEARNING PLAN', 'VIII. COURSE REQUIREMENTS', 'IX. REFERENCES', 'X. GRADING SYSTEM'];
// Explicit policy, not model-generated scores. Penalties are absolute percentage points.
const PENALTIES = POLICY;
// The final policy replaces legacy citation-age/year/count heuristics with link
// verification; undated or foundational works are not automatically penalized.
const codedStandard = { ...standard, rules: standard.rules.filter(rule => !['C-04', 'R-02', 'R-03'].includes(rule.id)) };
const str = value => String(value ?? '');
const { normCode } = require('../subjectCode'); // "IT 204" and "IT-204" are one code
const equal = (a, b) => canonical(a) === canonical(b);
const { titleRelation, titleDecision, titlePolicyOf, officialComparison, TITLE_POLICY_VERSION } = require('./titles');
const { identityOf } = require('./identity');

// Advisory quality notes (quality.js). They never score or block, and a fault in them must never break a check.
function qualityNotes(content) {
  try { return qualityOf(content); } catch (error) { return { version: QUALITY_VERSION, advisory: true, findings: [], counts: { total: 0, minor: 0, info: 0 }, unavailable: true }; }
}
function coded(content, masters = {}, opts = {}) {
  const c = content || {}, meta = c.meta || {};
  const base = evaluate(c, codedStandard, { year: masters.year || 2026, coverage: true });
  const findings = [...base.findings];
  const suggestions = [];
  const checks = [];
  const add = (id, path, message, options = {}) => {
    const finding = { id: `${id}:${path}`, ruleId: id, path, message, severity: 'blocking', area: 'template', step: 'info', source: 'rule', ...options };
    findings.push(finding);
    if (options.replacement !== undefined) suggestions.push({ id: finding.id, path, title: 'Use the exact master text', text: typeof options.replacement === 'string' ? options.replacement : JSON.stringify(options.replacement), replacement: options.replacement, source: 'rule', basedOn: [finding.id] });
  };
  const check = (id, path, ok, actual, expected, message, options = {}) => {
    const status = ok === null ? 'NOT_EVALUATED' : ok ? 'PASS' : 'FAIL';
    const evidence = { actual: actual ?? null, expected: expected ?? null };
    checks.push({ id: `${id}:${path}`, ruleId: id, path, status, evidence, source: 'rule', ruleVersion: VERSION });
    if (ok !== true) add(id, path, message, { ...options, status, evidence });
  };
  let critical = false, identityCourse = null;
  const sets = (masters.curricula || []).filter(r => (masters.programCodes || [meta.program]).includes(r.program) && r.status === 'approved' && (!meta.curriculumYear || r.curriculumYear === meta.curriculumYear));
  let curriculum = null;
  check('CUR-REF', 'meta.program', sets.length === 1 ? true : null, sets.map(row => ({ id: row.id, curriculumYear: row.curriculumYear })), 'One selected approved curriculum', sets.length ? 'Choose the official curriculum year; multiple approved versions exist.' : `Official approved curriculum unavailable for ${meta.program || 'the selected program'}. Submission is blocked until it is supplied.`);
  if (sets.length !== 1) checks.push({ id: 'CUR-CODE:meta.code', ruleId: 'CUR-CODE', path: 'meta.code', status: 'NOT_EVALUATED', evidence: { actual: meta.code, expected: null }, source: 'rule', ruleVersion: VERSION });
  if (sets.length === 1) {
    curriculum = sets[0];
    const course = curriculum.courses.find(row => normCode(row.code) === normCode(meta.code));
    identityCourse = course || null;
    if (!course) {
      critical = true;
      check('CUR-CODE', 'meta.code', false, meta.code, curriculum.courses.map(row => row.code), `CRITICAL MISMATCH: Course Code ${meta.code || '[CODE]'} does not exist in the official ${meta.program || '[PROGRAM]'} curriculum.`);
    } else {
      check('CUR-CODE', 'meta.code', true, meta.code, course.code, 'Course exists in the selected curriculum.');
      // The title comparison follows the title policy (titles.js): exact unless SYLLABUS_CHECK_TITLE_POLICY=normalized. A caller that names no comparison
      // (the submission gate in compliance/service.js) gets the one the policy makes official, so the check and the gate always decide alike.
      // The prerequisite is exact (the spacing and normalisation rules of a title do not cover it), except that the ways of writing "no pre-requisite"
      // (empty, None, N/A, the import's blank-cell sentence) are one value: prerequisite.js. A real pre-requisite on either side is still compared exactly,
      // but for a hyphen or a space in a code.
      // A value the administrator set on the subject is restored by every save (routes/syllabusContent.js applyCatalog), so a recommendation to change it would do
      // nothing: the author is told who corrects it. Once the subject itself is corrected, the recommendation is offered again (applying or saving brings it in).
      const adminMeta = masters.adminMeta || {};
      const fieldDiffers = (key, official) => (key in adminMeta && !equal(str(adminMeta[key]), str(official))
        ? { message: `${key} differs from the official curriculum, which has "${str(official)}". The administrator sets it on the subject, so it cannot be changed in the syllabus: ask the administrator to correct the subject, then save the syllabus and check it again.`, fix: {} }
        : { message: `${key} differs from the official curriculum.`, fix: { replacement: ['title', 'prereq'].includes(key) ? official : String(official) } });
      const title = fieldDiffers('title', course.title);
      check('CUR-FIELD', 'meta.title', titleDecision(opts.titleComparison || officialComparison(titlePolicyOf(process.env)), meta.title, course.title), meta.title, course.title, title.message, title.fix);
      // Same check, same status and severity; only the wording differs for a blank curriculum cell, which is never offered as replacement text (prerequisite.js).
      const blankCell = isBlankCell(course.prereq);
      check('CUR-FIELD', 'meta.prereq', samePrerequisite(meta.prereq, course.prereq), meta.prereq, course.prereq, blankCell ? notListedMessage(meta.prereq) : fieldDiffers('prereq', course.prereq).message, blankCell ? {} : fieldDiffers('prereq', course.prereq).fix);
      for (const key of ['lecture', 'lab', 'yearLevel']) check('CUR-FIELD', `meta.${key}`, !!str(meta[key]).trim() && Number(meta[key]) === Number(course[key]), meta[key], course[key], fieldDiffers(key, course[key]).message, fieldDiffers(key, course[key]).fix);
    }
  }
  const outcomes = c.outcomes || { ...(c.catalog?.institution || {}), egas: c.catalog?.program?.egas || [], pos: c.catalog?.program?.pos || [] };
  for (const key of ['vision', 'mission', 'egas']) {
    const master = masters.institution?.[key];
    if (master === undefined || master === '' || (Array.isArray(master) && !master.length)) check('INST-MASTER', `outcomes.${key}`, null, outcomes[key], master, `The official ${key} master is unavailable.`, { step: 'clos' });
    else check('INST-EXACT', `outcomes.${key}`, equal(outcomes[key], master), outcomes[key], master, `${key} must match the institutional master exactly.`, { step: 'clos', replacement: master });
  }
  if (!masters.pos?.length) check('PO-MASTER', 'outcomes.pos', null, outcomes.pos, null, 'Official program outcomes are unavailable; program alignment cannot be verified.', { step: 'clos' });
  else check('PO-EXACT', 'outcomes.pos', equal(outcomes.pos, masters.pos), outcomes.pos, masters.pos, 'Program outcomes must match the selected program master.', { step: 'clos', replacement: masters.pos });
  mappingChecks(c, masters, check);
  // For the builder, headers are guaranteed by the renderer, and each backing section must exist.
  const sections = ['meta.code', 'meta.title', 'description', 'meta.prereq', 'meta.lecture', 'clos', 'plan', 'reqs', 'refs', 'grading'];
  sections.forEach((path, i) => {
    const value = path.split('.').reduce((o, k) => o?.[k], c);
    check('HEADER', path, value !== undefined && value !== null && (!c.headers || c.headers.includes(HEADERS[i])), value, HEADERS[i], `Missing standard header: ${HEADERS[i]}.`);
  });
  const seen = new Set();
  (c.plan || []).forEach((row, i) => {
    const weeks = weeksOf(row.week);
    check('WEEK', `plan[${i}].week`, !!weeks?.length, row.week, `Weeks ${POLICY.minWeek}-${POLICY.maxWeek}, comma separated or ranges`, 'Enter a valid week assignment without unrecognized fragments.', { step: 'plan' });
    const duplicates = [];
    for (const week of weeks || []) {
      if (seen.has(week)) duplicates.push(week);
      seen.add(week);
    }
    check('WEEK-DUP', `plan[${i}].week`, weeks ? !duplicates.length : null, duplicates, [], `Weeks ${duplicates.join(', ')} are assigned more than once.`, { step: 'plan' });
    const ilos = row.ilos || [];
    if (row.kind !== 'exam') check('ILO-MISSING', `plan[${i}].ilos`, ilos.some(ilo => str(ilo.text).trim()), ilos, 'At least one lesson ILO', `Week ${row.week} needs a lesson ILO.`, { step: 'plan' });
    else checks.push({ id: `ILO-MISSING:plan[${i}].ilos`, ruleId: 'ILO-MISSING', path: `plan[${i}].ilos`, status: 'NOT_APPLICABLE', evidence: { actual: row.kind, expected: 'Lesson row' }, source: 'rule', ruleVersion: VERSION });
    const filled = ilos.map(ilo => !!str(ilo.text).trim());
    check('ILO-GAP', `plan[${i}].ilos`, !filled.some((yes, j) => yes && filled.slice(0, j).includes(false)), filled, 'No empty ILO before a filled ILO', 'ILO numbering contains a gap.', { step: 'plan' });
    check('ILO-NUM', `plan[${i}].ilos`, !ilos.some((ilo, j) => ilo.no !== undefined && Number(ilo.no) !== j + 1), ilos.map(ilo => ilo.no ?? null), 'Consecutive explicit numbering when supplied', 'ILO numbers must be consecutive and unique.', { step: 'plan' });
  });
  const missingWeeks = Array.from({ length: POLICY.maxWeek }, (_, i) => i + 1).filter(week => !seen.has(week));
  check('WEEK-GAP', 'plan', !missingWeeks.length, missingWeeks, [], 'The learning plan must cover all 18 weeks, including examination weeks.', { step: 'plan' });
  const grade = gradingTotal(c.grading?.rows || []);
  check('GRADE-RANGE', 'grading.rows', grade.valid, (c.grading?.rows || []).map(row => row.pct), 'Decimal percentages from 0 to 100 (up to 12 decimal places)', 'Each grading percentage must be a number between 0 and 100.', { step: 'grade' });
  check('GRADE-100', 'grading.rows', grade.valid ? grade.exact : null, grade, 'Exactly 100%', 'Grading components must total exactly 100%.', { step: 'grade' });
  const missingValues = [];
  (c.plan || []).forEach((row, i) => {
    if (row.kind === 'exam') return;
    const hasValue = VALUES.some(value => str(row.values).toLowerCase().includes(value.toLowerCase()));
    check('VALUE', `plan[${i}].values`, hasValue, row.values, VALUES, `Week ${row.week}: integrate at least one Marian-Augustinian core value.`, { severity: 'major', area: 'assessment', step: 'plan' });
    if (!hasValue) {
      const path = `plan[${i}].values`;
      missingValues.push({ path, week: row.week });
      // The finding and its point stay. What changed is the recommendation: the checker used to pick a value from keywords and otherwise fall back to
      // "Compassion", with a generic sentence, and as a deterministic suggestion it even displaced the model's evidence-based draft for the same field.
      // Now no value is chosen for the author: run() lists the field as NEEDS_REVIEW ("Needs your decision") unless the model offers a draft that is
      // grounded in the lesson. SYLLABUS_CHECK_VALUE_SUGGESTION=legacy restores the old template (rollback only).
      if (opts.valueSuggestion === 'legacy') {
        const value = /team|group|collaborat/i.test(`${row.contents} ${row.activities}`) ? 'Community-orientedness' : /test|debug|reflect/i.test(row.contents) ? 'Interiority' : 'Compassion';
        suggestions.push({ id: `VALUE:${path}`, path, title: `Integrate ${value}`, text: `${value}: explain how the module's decisions affect other people and demonstrate this value in the activity.`, replacement: `${value}: explain how the module's decisions affect other people and demonstrate this value in the activity.`, source: 'rule', basedOn: [`VALUE:${path}`] });
      }
    }
  });
  for (const finding of findings) if (!checks.some(row => row.id === finding.id)) checks.push({ id: finding.id, ruleId: finding.ruleId || finding.id, path: finding.path, status: 'FAIL', evidence: finding.evidence || { message: finding.message }, source: 'rule', ruleVersion: VERSION });
  return { base, findings, suggestions, critical, curriculum, missingValues, checks, identity: identityOf(meta, masters, sets, identityCourse) };
}

// A check without AI: the fixed rules, the curriculum and master checks, links, core values and the base score. The AI part (alignment judgements, their
// points and drafts) is the new AI Checker's: pipeline/official.js officialize fills this report in. The old checker's AI (align, Stages A-D2, Policy V2,
// the whole-syllabus plan) was removed with the old AI Checker; until the new checker has answered, the report says the alignment is not evaluated.
const NO_AI_REASON = 'The AI alignment is checked by the new AI Checker.';
// Why this report has no AI part yet: AI turned off (by the administrator in Settings, or on the server), a check run without AI, or the new checker still to answer.
function noAiReasonOf(env, options) {
  if (String(env.SYLLABUS_CHECK_AI_PROVIDER || '').trim().toLowerCase() === 'off') return env.SYLLABUS_CHECK_AI_OFF_BY === 'settings' ? require('../adminSettings').AI_OFF_MESSAGE : 'AI checking is turned off on this server (SYLLABUS_CHECK_AI_PROVIDER=off), so no AI request was sent; the coded rules ran.';
  if (options.useAi === false) return 'This check was run without AI, so no AI request was sent; the coded rules ran.';
  return NO_AI_REASON;
}
async function run(content, masters, options = {}) {
  const env0 = options.env || process.env;
  // Title policy (titles.js). 'exact' keeps the original comparison; 'shadow' (the default) keeps it as the OFFICIAL one and also computes what the normalised
  // comparison would decide, reported in hybrid.shadowCurriculum; 'normalized' makes the normalised comparison official and needs explicit approval.
  const titleMode = titlePolicyOf(env0);
  const valueSuggestion = String(env0.SYLLABUS_CHECK_VALUE_SUGGESTION || '').trim().toLowerCase() === 'legacy' ? 'legacy' : 'review';
  const partA = coded(content, masters, { titleComparison: officialComparison(titleMode), valueSuggestion });
  const altA = titleMode === 'exact' ? null : coded(content, masters, { titleComparison: titleMode === 'normalized' ? 'exact' : 'normalized', valueSuggestion });
  const links = partA.critical ? [] : await checkLinks(content, options.linkChecker);
  const semantic = { status: 'not_evaluated', reason: partA.critical ? 'The course code is not in the official curriculum, so AI alignment cannot run.' : noAiReasonOf(env0, options), judgements: [] };
  const findings = [...partA.findings];
  const deductions = [];
  for (const link of links) {
    partA.checks.push({ id: `LINK:${link.url || 'limit'}`, ruleId: 'LINK', path: 'refs', status: link.status === 'ok' ? 'PASS' : link.status === 'unverifiable' ? 'NOT_EVALUATED' : 'FAIL', evidence: link, source: 'rule', ruleVersion: VERSION });
    if (link.status === 'ok') continue;
    const id = `LINK:${link.url || 'limit'}`;
    findings.push({ id, ruleId: 'LINK', path: 'refs', area: 'reference_currency', step: 'refs', severity: link.status === 'unverifiable' ? 'blocking' : 'major', source: 'rule', message: `${link.url || 'Reference links'}: ${link.status} (${link.reason}).`, evidence: link });
    // A failed verification is distinguished from a confirmed broken link. Both prevent a silently complete check.
    if (link.status !== 'unverifiable') deductions.push({ id, points: PENALTIES.link, reason: link.status, kind: 'link', path: `refs:${link.url || ''}` });
  }
  for (const missing of partA.missingValues) deductions.push({ id: `VALUE:${missing.path}`, points: PENALTIES.value, reason: 'Missing core value', kind: 'value', path: missing.path });
  const suggestions = partA.suggestions.map(s => ({ ...s, tier: String(s.id).startsWith('VALUE') ? 'material' : 'mandatory' }));
  // A lesson that names no core value: the field is listed for the author's decision (NEEDS_REVIEW), with the finding and its point unchanged. No value is
  // chosen for the author (SYLLABUS_CHECK_VALUE_SUGGESTION=legacy restores the old template, rollback only).
  const unresolved = [];
  if (valueSuggestion !== 'legacy') for (const missing of partA.missingValues) {
    if (suggestions.some(s => s.path === missing.path)) continue;
    unresolved.push({ path: missing.path, reason: 'value_needs_review', status: 'NEEDS_REVIEW', tier: 'material', attempts: 0, label: null, relationships: [`VALUE:${missing.path}`], explanation: null,
      detail: `Week ${missing.week} names no Marian-Augustinian core value, and nothing in the check grounds a recommendation for one, so none is proposed.` });
  }
  findings.push({ id: 'AI-REQUIRED:review', ruleId: 'AI-REQUIRED', path: 'review', step: 'review', area: 'assessment', severity: 'blocking', source: 'rule', message: `AI alignment must complete before submission. ${semantic.reason}` });
  const failed = findings.filter(f => f.severity === 'blocking');
  const points = deductions.reduce((sum, d) => sum + d.points, 0);
  const provisionalScore = partA.critical ? 0 : Math.max(0, (partA.base.overall ?? 0) - points);
  // The title policy in force and the decision the other comparison would make (shadow: normalised; active: the old exact one). Nothing here is used
  // by the official result.
  let shadowCurriculum = null;
  if (altA) {
    const official = partA.checks.find(c => c.ruleId === 'CUR-FIELD' && c.path === 'meta.title'), other = altA.checks.find(c => c.ruleId === 'CUR-FIELD' && c.path === 'meta.title');
    const rel = official ? titleRelation(official.evidence.actual, official.evidence.expected) : null;
    const delta = official && other && official.status !== other.status ? (other.status === 'PASS' ? -1 : 1) : 0; // blocking findings the other comparison would remove (-1) or add (+1)
    const active = titleMode === 'normalized';
    shadowCurriculum = { policy: TITLE_POLICY_VERSION, mode: active ? 'active' : 'shadow', note: active ? 'The normalised comparison is official. "legacyStatus" is what the old exact comparison would have decided.' : 'The official decision is unchanged. This is what the normalised comparison would decide.',
      title: official ? { entered: official.evidence.actual, approved: official.evidence.expected, relation: rel.relation, officialStatus: official.status, [active ? 'legacyStatus' : 'shadowStatus']: other ? other.status : null, suggestion: rel.relation === 'case_or_space' ? { kind: 'formatting', text: official.evidence.expected } : null } : null,
      impact: { numericScore: 'The points total is unchanged (the title check deducts no points). As a blocking finding it withholds the published score until resolved, so it decides whether a score is shown at all.', points: provisionalScore, blockingFindings: { official: failed.length, [active ? 'legacy' : 'shadow']: failed.length + delta }, readyWouldChange: false } };
  }
  // No AI here, so no published score yet (a structural baseline is not a verified score); a real critical zero is kept.
  const score = partA.critical ? 0 : null;
  const quality = qualityNotes(content);
  const summary = summarize({ findings, quality, semanticCompleted: false, missingValues: partA.missingValues.length, unresolved, corrections: [] });
  const result = {
    ...partA.base, standard: VERSION, status: score === null ? 'incomplete' : 'scored', overall: score, score, baseScore: partA.base.overall,
    passed: false, band: score === null ? null : 'Needs work',
    conformance: { ok: !failed.length, failed }, findings,
    hybrid: { identity: partA.identity, titlePolicy: { mode: titleMode, comparison: officialComparison(titleMode), version: TITLE_POLICY_VERSION }, valueSuggestion, shadowCurriculum, version: VERSION, reportVersion: 2, policy: { ...POLICY }, codedChecks: partA.checks, ready: false, critical: partA.critical, score, provisionalScore, baseScore: partA.base.overall, deductions,
      quality, summary, corrections: [], unresolved,
      scoring: { official: { policy: POLICY.version, deducted: points, score: provisionalScore } },
      links, alignment: semantic, suggestions: bindSuggestions(content, suggestions), outcomeSource: masters.outcomeSource || null, synthetic: !!masters.synthetic, checkedMeta: content.meta, checkedAt: new Date().toISOString(), curriculum: partA.curriculum ? { id: partA.curriculum.id, source: partA.curriculum.source, program: partA.curriculum.program, curriculumYear: partA.curriculum.curriculumYear } : null },
  };
  if (masters.referenceContext) result.hybrid.referenceContext = masters.referenceContext;
  result.hybrid.ruleCoverage = require('./ruleCoverage').coverageOf(result, content, masters);
  return result;
}
module.exports = { run, coded, VERSION, VALUES, HEADERS, PENALTIES, normCode, NO_AI_REASON };
