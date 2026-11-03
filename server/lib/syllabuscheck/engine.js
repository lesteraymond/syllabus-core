'use strict';
const { canonical } = require('../compliance/hash');
const { evaluate } = require('../compliance/rules');
const { POLICY } = require('./policy');
const { gradingTotal, weeksOf, mappingChecks } = require('./validation');
const { bindSuggestions } = require('./suggestions');
const standard = require('../compliance/standard-v4.json');
const { checkLinks } = require('./links');
const { align, createRequestBudget, isAdvisory, REF_PAIR, blockedNow } = require('./gemini');
const { stageFlags, C3 } = require('./stages');
const { mappingAdviceOf, iloCandidates, anyCloPairs, iloMappingAdviceOf } = require('./mapping');
const { coverageTable, coverageSummary } = require('./coverage');
const fit = require('./lessonfit');
const valuesStage = require('./values');
const valueClass = require('./valueClassification');
const refsStage = require('./references');
const requirementsAdvice = require('./requirementsAdvice');
const { similarWeek } = require('./planrows');
const { shadowOf } = require('./scoring');
const { isTrivialRewrite, assessCorrections, summarize, textOf, RANK: VERDICT_RANK } = require('./stewardship');
const { tierOfType } = require('./acceptance');
const { qualityOf, VERSION: QUALITY_VERSION } = require('./quality');
const verdict = require('./verdict'); // called as verdict.buildVerdict so a test can replace it
const VERDICT_VERSION = verdict.VERSION;
const { withholdReviewedDrafts } = require('./reportSafety');
const VERSION = 'hybrid-2';
const VALUES = ['Compassion', 'Courage', 'Community-orientedness', 'Humility', 'Interiority', 'Missionary Spirit'];
const HEADERS = ['I. COURSE CODE', 'II. COURSE TITLE', 'III. COURSE DESCRIPTION', 'IV. PRE-REQUISITE', 'V. CREDIT UNITS', 'VI. COURSE LEARNING OUTCOMES', 'VII. LEARNING PLAN', 'VIII. COURSE REQUIREMENTS', 'IX. REFERENCES', 'X. GRADING SYSTEM'];
// Explicit policy, not model-generated scores. Penalties are absolute percentage points.
const PENALTIES = POLICY;
// The final policy replaces legacy citation-age/year/count heuristics with link
// verification; undated or foundational works are not automatically penalized.
const codedStandard = { ...standard, rules: standard.rules.filter(rule => !['C-04', 'R-02', 'R-03'].includes(rule.id)) };
const str = value => String(value ?? '');
const normCode = value => str(value).trim().replace(/\s+/g, ' ').toUpperCase();
const equal = (a, b) => canonical(a) === canonical(b);
const { titleRelation, titleDecision, titlePolicyOf, officialComparison, TITLE_POLICY_VERSION } = require('./titles');
const { identityOf, NEEDS_IDENTITY } = require('./identity');
// Why a draft was held back (gemini.js draftReviewOf), for the "needs your decision" list.
const DRAFT_CHECKS = { copies_reference: 'it copies the text it is checked against instead of revising this one', keeps_off_subject: 'it keeps most of the off-subject wording of the text it replaces', copies_other_relationship: 'it may import unsupported details from another relationship', adds_participant: 'it may introduce participants the lesson does not describe', adds_activity: 'it may introduce an activity the lesson does not describe', adds_resource: 'it may introduce a resource the lesson does not describe', adds_week: 'it may introduce work outside the stated lesson weeks', value_not_expressed: 'it may keep a value name without describing how the value is expressed', unnecessary_practical: 'it may add a practical performance beyond the conceptual ILO', expands_competency: 'it may expand the required competency or project scope', assumes_resource: 'it assumes an instructional resource whose availability is not established' };

// Advisory quality notes (quality.js). They never score or block, and a fault in them must never break a check.
function qualityNotes(content) {
  try { return qualityOf(content); } catch (error) { return { version: QUALITY_VERSION, advisory: true, findings: [], counts: { total: 0, minor: 0, info: 0 }, unavailable: true }; }
}
// The text of a field by its path (the description is a list of paragraphs, read as one text).
const textAt = (content, path) => textOf(String(path).replace(/\[(\d+)\]/g, '.$1').split('.').reduce((value, key) => value?.[key], content));
function coded(content, masters = {}, opts = {}) {
  const c = content || {}, meta = c.meta || {};
  const base = evaluate(c, codedStandard, { year: masters.year || 2026 });
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
      // The prerequisite is always exact: only the title is covered by the normalisation policy.
      check('CUR-FIELD', 'meta.title', titleDecision(opts.titleComparison || officialComparison(titlePolicyOf(process.env)), meta.title, course.title), meta.title, course.title, 'title differs from the official curriculum.', { replacement: course.title });
      check('CUR-FIELD', 'meta.prereq', str(meta.prereq) === str(course.prereq), meta.prereq, course.prereq, 'prereq differs from the official curriculum.', { replacement: course.prereq });
      for (const key of ['lecture', 'lab', 'yearLevel']) check('CUR-FIELD', `meta.${key}`, !!str(meta[key]).trim() && Number(meta[key]) === Number(course[key]), meta[key], course[key], `${key} differs from the official curriculum.`, { replacement: String(course[key]) });
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

async function run(content, masters, options = {}) {
  if (options.academicPolicy === 'legacy') { options = {...options}; delete options.academicPolicy; }
  // An explicit data-only preview selects the replacement academic policy.
  // Existing stage flags and the production default never select it.
  if (options.academicPolicy && options.academicPolicy !== 'legacy') {
    const v2 = require('./academicPolicyV2');
    if (options.academicPolicy !== v2.POLICY.id) throw Object.assign(Error('Unknown academic policy'), {status:400});
    return v2.evaluate(content, masters, options, coded);
  }
  const env0 = options.env || process.env;
  const requestBudget = options.requestBudget || createRequestBudget(env0);
  // Title policy (titles.js). 'exact' keeps the original comparison; 'shadow' (the default) keeps it as the OFFICIAL one and also computes what the normalised
  // comparison would decide, reported in hybrid.shadowCurriculum; 'normalized' makes the normalised comparison official and needs explicit approval.
  const titleMode = titlePolicyOf(env0);
  const valueSuggestion = String(env0.SYLLABUS_CHECK_VALUE_SUGGESTION || '').trim().toLowerCase() === 'legacy' ? 'legacy' : 'review';
  const partA = coded(content, masters, { titleComparison: officialComparison(titleMode), valueSuggestion });
  // The other comparison, computed beside the official one: in shadow mode what normalisation WOULD decide; once normalisation is official, what the
  // old exact comparison would have decided (so the effect of the activation stays visible and reversible). Never used by the official result.
  const altA = titleMode === 'exact' ? null : coded(content, masters, { titleComparison: titleMode === 'normalized' ? 'exact' : 'normalized', valueSuggestion });
  // A wrong course code zeroes the official score and, as before, stops the AI - unless the operator allows PROVISIONAL feedback
  // (SYLLABUS_CHECK_PROVISIONAL_AI=on, off by default). Provisional feedback is labelled as such and can never make the verdict COMPLIANT.
  const provisionalAi = partA.critical && String(env0.SYLLABUS_CHECK_PROVISIONAL_AI || '').toLowerCase() === 'on';
  const identityStop = partA.critical && !provisionalAi;
  const links = partA.critical ? [] : await checkLinks(content, options.linkChecker);
  // The AI runs even while fixed rules fail, so one check lists every recommendation; only a wrong course code (nothing to compare against) stops it.
  const blocked = partA.findings.some(f => f.severity === 'blocking');
  const flags = stageFlags(options.env || process.env);
  // Stage D2, the deterministic part: APA 7 format, required components and DOI / URL structure of every reference, from the text alone. No model is involved,
  // so it also runs when the AI is unavailable. Authenticity stays 'not_verified' unless the operator switched on the external DOI check.
  const referenceEntries = flags.d2 ? refsStage.referenceReport(content, { year: masters.year || 2026 }) : null;
  if (referenceEntries && String((options.env || process.env).SYLLABUS_CHECK_REF_VERIFY || '').toLowerCase() === 'crossref') await refsStage.verifyDois(referenceEntries, options.refFetch || refsStage.crossrefFetch);
  const valueDefinitions = flags.d1 ? valuesStage.loadDefinitions(options.env || process.env) : null;
  const valuesLexicon = flags.d1 ? valueClass.loadLexicon(options.env || process.env) : null;
  // The new advice wording is used only by its own request. Existing scored and
  // staged requests keep their original prompt/schema/cache identity even when
  // the operator opts into the two additional advisory relationships.
  const alignOptions = { ...options, requestBudget, ...(flags.requirements ? {env:{...env0,SYLLABUS_CHECK_REQUIREMENTS_ADVICE:'off'}} : {}), links, skipEmpty: blocked, previous: options.history?.previous ? new Map(Object.entries(options.history.previous)) : undefined };
  const semantic = identityStop ? { status: 'not_evaluated', reason: 'The course code is not in the official curriculum, so AI alignment cannot run.', judgements: [] } : await align(content, masters, alignOptions);
  // Stage B3: only an ILO whose every tagged CLO failed is asked "does it build any CLO of the course?" - one scoped question each, at most 12, and
  // answered from the cache when the ILO and the CLOs have not changed. A failed or partial answer simply leaves those ILOs without mapping advice.
  if (flags.b3 && !identityStop && semantic.judgements?.length && (!semantic.failure || semantic.failure.kind === 'invalid_output') && !blockedNow()) {
    const asked = anyCloPairs(content, iloCandidates(content, semantic.judgements));
    if (asked.length) {
      const extra = await align(content, masters, { ...alignOptions, pairs: asked, previous: undefined });
      semantic.judgements = [...semantic.judgements, ...(extra.judgements || [])];
      semantic.b3 = { asked: asked.length, answered: (extra.judgements || []).filter(j => !j.unverified).length };
    }
  }
  const findings = [...partA.findings];
  // Stage C: learning activities (C1) and assessment tasks (C2). The scored ILO-activity / ILO-assessment answers are reused: only a lesson whose scored
  // answer is ALIGNED, and whose content and ILO are not known to be off, gets the deeper question (lessonfit.js). C1 is asked before C2.
  semantic.stageC = { c1: null, c2: null };
  for (const [flag, kind, build] of [['c1', 'activity', fit.activityPairs], ['c2', 'assessment', fit.assessmentPairs]]) {
    if (!flags[flag] || identityStop || !semantic.judgements?.length || (semantic.failure && semantic.failure.kind !== 'invalid_output') || blockedNow()) continue;
    const plan = fit.eligible(content, semantic.judgements, kind);
    semantic.stageC[flag] = { asked: plan.asked.length, reusedScored: plan.reused.length, heldBackUpstream: plan.upstream.length, noText: plan.missing.length };
    if (!plan.asked.length) continue;
    const extra = await align(content, masters, { ...alignOptions, pairs: build(content, plan.asked), previous: undefined });
    semantic.judgements = [...semantic.judgements, ...(extra.judgements || [])];
  }
  // Stage C3: the weekly chain (lessonfit.js chainPairs) - content -> activities, content -> tasks, activities -> tasks - asked about every lesson whatever
  // the other answers say, so a link that fails is never covered by another that passes. Advice only, after the C passes, never after a provider refusal.
  // An empty side is answered INSUFFICIENT_EVIDENCE without a request even while fixed rules fail (skipEmpty off), and a link that got no answer is
  // listed as not checked, so none is silently missing. With the stage off nothing here runs and the report has no c3 entry.
  if (flags.c3) {
    const pairs = fit.chainPairs(content, fit.chainRows(content).map(({ i }) => i)), limit = fit.MAX_LESSON_PAIRS * C3.types.length;
    // An empty activities or tasks field leaves the scored check incomplete (insufficient_text), but the provider answered: the other lessons' links
    // are still asked, and the links of the empty field are not checked (skipEmpty off, above).
    const usable = !identityStop && semantic.judgements?.length && !(semantic.failure && !['invalid_output', 'insufficient_text'].includes(semantic.failure.kind)) && !blockedNow();
    const extra = usable && pairs.length ? await align(content, masters, { ...alignOptions, pairs: pairs.slice(0, limit), skipEmpty: false, previous: undefined }) : null;
    const answered = new Map(((extra && extra.judgements) || []).map(j => [j.id, j]));
    const chain = extra ? pairs.map((pair, k) => answered.get(pair.id) || fit.chainNotChecked(pair, k >= limit ? 'not_asked' : extra.failure ? extra.failure.kind : 'not_answered')) : [];
    semantic.judgements = [...semantic.judgements, ...chain];
    semantic.stageC.c3 = { relationships: pairs.length, verified: chain.filter(j => !j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE').length, noText: chain.filter(j => j.failureKind === 'insufficient_text').length, notChecked: chain.filter(j => j.unverified).length,
      ...(extra ? { reused: extra.reuse ? extra.reuse.reused : 0, requests: extra.reuse ? extra.reuse.requests : 0 } : { skipped: identityStop ? 'course_not_in_curriculum' : pairs.length ? 'ai_unavailable' : 'no_lessons' }) };
  }
  // Optional original-requirement advice uses the existing alignment transport,
  // evidence contract and findings. A separate advisory request preserves the
  // core scored pair list; missing inputs are kept, never silently counted as fit.
  if (flags.requirements) {
    const pairs = requirementsAdvice.pairsOf(content);
    const requestPairs = pairs.filter(pair=>!pair.contextLimited);
    const usable = !identityStop && !(semantic.failure && semantic.failure.kind !== 'invalid_output') && !blockedNow();
    const extra = usable && requestPairs.length ? await align(content, masters, {...alignOptions,env:env0,pairs:requestPairs,skipEmpty:false,previous:undefined}) : null;
    const answers = new Map((extra?.judgements || []).map(j=>[j.id,j]));
    const judgements = pairs.map(pair=>answers.get(pair.id) || {...fit.chainNotChecked(pair,pair.contextLimited?'context_limit':identityStop?'course_not_in_curriculum':extra?.failure?.kind||'not_answered'),explanation:pair.contextLimited?'This original-requirement relationship exceeds the 6000-character per-side advisory context limit. Faculty must review the complete text; no conclusion was made from a truncated excerpt.':'This original-requirement relationship was not checked; the course identity or AI provider is unavailable. No academic conclusion was made.'});
    semantic.judgements = [...semantic.judgements,...judgements];
    semantic.requirementsAdvice = {relationships:pairs.length,verified:judgements.filter(j=>!j.unverified&&j.label!=='INSUFFICIENT_EVIDENCE').length,notChecked:judgements.filter(j=>j.unverified).length,promptVersion:extra?.promptVersion||null};
  }
  // Stage D1: how each named value is integrated in a lesson. The scored Module-value answer is reused: only a lesson it judged ALIGNED, whose earlier fields
  // (content, ILO, activity, assessment) are not known to be off, gets the structured question. Stage D2: one relevance question per reference that no page
  // judgement (REF-plan) already covers. Both after the C passes, both once per syllabus revision, neither after a provider refusal.
  semantic.stageD = { d1: null, d2: null };
  const providerOk = !identityStop && semantic.judgements?.length && !(semantic.failure && semantic.failure.kind !== 'invalid_output') && !blockedNow();
  if (flags.d1 && providerOk) {
    const plan = valuesStage.eligible(content, semantic.judgements);
    semantic.stageD.d1 = { asked: plan.asked.length, reusedScored: plan.reused.length, heldBackUpstream: plan.upstream.length, noValueNamed: plan.noValue.length, definitions: valueDefinitions.status };
    if (plan.asked.length) {
      const extra = await align(content, masters, { ...alignOptions, pairs: valuesStage.valuePairs(content, plan.asked, valueDefinitions), previous: undefined });
      semantic.judgements = [...semantic.judgements, ...(extra.judgements || [])];
    }
    // Value-map: lessons that wrote supporting values (Respect, Honesty ...) and no core value. Advice only; the faculty text is never rewritten.
    const targets = valueClass.mapTargets(content, semantic.judgements, valuesLexicon);
    semantic.stageD.d1.valueMap = { asked: targets.asked.length, heldBackUpstream: targets.held.length, lexicon: valuesLexicon.status };
    if (targets.asked.length) {
      const extra = await align(content, masters, { ...alignOptions, pairs: valueClass.mapPairs(content, targets.asked, valueDefinitions, valuesLexicon, valuesStage.valueContext), previous: undefined });
      semantic.judgements = [...semantic.judgements, ...(extra.judgements || [])];
    }
  }
  if (flags.d2 && referenceEntries && referenceEntries.length && providerOk && !blockedNow()) {
    const targets = refsStage.relevanceTargets(content, referenceEntries, semantic.judgements);
    semantic.stageD.d2 = { references: referenceEntries.length, asked: targets.asked.length, coveredByPageJudgement: targets.reused.length };
    if (targets.asked.length) {
      const extra = await align(content, masters, { ...alignOptions, pairs: refsStage.relevancePairs(content, targets.asked), previous: undefined });
      semantic.judgements = [...semantic.judgements, ...(extra.judgements || [])];
    }
  }
  // Precedence for recommendations (see below): the week's content, then the ILO against it, then the CLO tag.
  const verdicts = new Map((semantic.judgements || []).map(j => [j.id, j]));
  const contentOff = i => verdicts.get(`row${i}-content`)?.label === 'NOT_ALIGNED';
  const iloOff = (i, j) => ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'].includes(verdicts.get(`row${i}-ilo${j}-contentilo`)?.label);
  const suggestions = [...partA.suggestions];
  // An ILO-CLO rewrite is not offered while an earlier element is the problem (the week's content, or the ILO against that content): the earlier
  // element's own recommendation comes first, so the author is not given two drafts for the same ILO that contradict each other. Points are unchanged.
  const behindEarlierProblem = judgement => { const m = /^row(\d+)-ilo(\d+)-/.exec(judgement.id); return !!m && (contentOff(Number(m[1])) || iloOff(Number(m[1]), Number(m[2]))); };
  // Stage A, the same order for a CLO: a CLO judged not to be about the course (Course-CLO) is rewritten for the course first. A rewrite toward one of its
  // PO / EGA tags or the whole lists would fit the outcome to a subject the course does not teach, so it is not offered while the CLO is off-course;
  // the findings and their points are unchanged (Stage E.4).
  const cloOff = i => verdicts.get(`clo${i}-course`)?.label === 'NOT_ALIGNED';
  const OUTCOME_FIT = new Set(['CLO-PO', 'CLO-EGA', 'CLO-anyPO', 'CLO-anyEGA']);
  const behindOffCourseClo = judgement => { const m = /^clos\[(\d+)\]\.statement$/.exec(judgement.targetPath || ''); return !!m && OUTCOME_FIT.has(judgement.type) && cloOff(Number(m[1])); };
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
  // One recommendation per field. Several relationships can point at the same text (a CLO is judged against each PO and EGA, an ILO
  // against its CLOs, activity and assessment); a separate rewrite for each would fight over that text and, once one was applied,
  // surface a new one on the next check. The most serious relationship supplies the draft and the rest are listed in basedOn.
  // A CLO that fits no PO or EGA of the whole list is rewritten toward the best-fitting one (CLO-anyPO / CLO-anyEGA), which beats a draft
  // written for one particular tag.
  // The description is a list of paragraphs: a rewrite of it replaces them all with one paragraph (the first keeps its id).
  const replacementFor = (path, draft) => (path === 'description' ? [{ id: content.description?.[0]?.id ?? 'd1', t: draft }] : draft);
  const isAny = j => j.type === 'CLO-anyPO' || j.type === 'CLO-anyEGA';
  const rank = j => (j.label === 'NOT_ALIGNED' ? 2 : 1) + (isAny(j) ? 0.5 : 0);
  const proposals = new Map(suggestions.map(s => [s.path, { suggestion: s, rank: 3 }])); // a coded suggestion for a field is deterministic: it wins
  // A CLO is usually tagged to several POs and EGAs, and no CLO covers all of them. It is enough that it clearly supports ONE PO and ONE EGA:
  // when some tag in its PO group (or EGA group) is ALIGNED, the others in that group are advice only (no points, no rewrite).
  // The same holds for an ILO and its CLO tags: an ILO that builds ONE of its CLOs is accepted, and its other CLO tags are advice only.
  // CLO-anyPO / CLO-anyEGA join the group of the tags: the CLO fitting ANY item of the whole list is as good as fitting a tagged one.
  const GROUP = { 'CLO-PO': 'CLO-PO', 'CLO-anyPO': 'CLO-PO', 'CLO-EGA': 'CLO-EGA', 'CLO-anyEGA': 'CLO-EGA', 'ILO-CLO': 'ILO-CLO' };
  const tagKey = j => (GROUP[j.type] ? `${GROUP[j.type]}:${j.path}` : null);
  const supported = new Set((semantic.judgements || []).filter(j => j.label === 'ALIGNED' && tagKey(j)).map(tagKey));
  // When NO tag of a group is aligned, only ONE of them has to become aligned. The draft is therefore written from the tag that is CLOSEST to
  // aligned (the smallest gap), not from the worst one: a rewrite that tries to satisfy every tag at once is what produced rewrites that
  // changed nothing. All the tags keep their findings and points; the others are listed in `basedOn` of the same suggestion.
  const representative = new Map();
  for (const j of semantic.judgements || []) {
    const key = tagKey(j);
    if (!key || supported.has(key) || !['PARTIALLY_ALIGNED', 'NOT_ALIGNED'].includes(j.label) || !j.draft || !j.targetPath || j.draftReview?.length) continue;
    const best = representative.get(key);
    if (!best || VERDICT_RANK[j.label] < VERDICT_RANK[best.label] || (VERDICT_RANK[j.label] === VERDICT_RANK[best.label] && isAny(j) && !isAny(best))) representative.set(key, j);
  }
  const alsoFlagged = [];
  // Drafts that failed a static check of gemini.js (draftReviewOf: a copy of the reference text, or a rewrite that keeps the off-subject wording). They are
  // never offered as a fix; their field is listed for the author's decision below.
  const heldDrafts = [];
  for (const judgement of semantic.judgements || []) {
    if (judgement.label === 'ALIGNED') continue;
    // Not reached because the provider call failed: nothing is known about the relationship. The check is already marked incomplete (AI-REQUIRED),
    // and listing one blocking finding for each would be noise about the provider, not about the syllabus.
    if (judgement.unverified && String(judgement.failureKind || '').startsWith('provider_')) continue;
    if (['PARTIALLY_ALIGNED', 'NOT_ALIGNED'].includes(judgement.label) && supported.has(tagKey(judgement))) {
      if (isAny(judgement)) continue; // the CLO already fits a PO or EGA of the group: the whole-list question needs no advice
      findings.push({ id: `TAG:${judgement.id}`, ruleId: 'SEM-TAG', path: judgement.path, step: judgement.type === 'ILO-CLO' ? 'plan' : 'clos', area: 'assessment', severity: 'minor', source: 'ai', message: `${judgement.explanation} ${judgement.type === 'ILO-CLO' ? 'Another CLO tag of this ILO is aligned, so this is advice only: keep the tag only if the ILO really builds that CLO.' : 'Another tag of this CLO is aligned, so this is advice only: keep the tag only if the CLO really supports it.'}`, evidence: judgement });
      continue;
    }
    // Stage B: an ILO is judged against the week's course content, so when that content is itself not about the course the content is what has to
    // change first. The ILO is listed as advice that waits for it, and no rewrite of the ILO is offered (it would be fitted to the wrong topic).
    if (judgement.type === 'Content-ILO') {
      const week = /^row(\d+)-/.exec(judgement.id), content0 = week && (semantic.judgements || []).find(j => j.id === `row${week[1]}-content`);
      if (content0 && content0.label === 'NOT_ALIGNED') {
        findings.push({ id: `SEM:${judgement.id}`, ruleId: 'SEM', path: judgement.path, step: 'plan', area: 'assessment', severity: 'minor', source: 'ai', responsible: 'course_content', message: `This week's course content is itself not about the course, so correct the content first and check the ILO again afterwards. ${judgement.explanation}`, evidence: judgement });
        continue;
      }
    }
    if (judgement.type === REF_PAIR) { // does a reference page fit the learning plan: advice only, no points, no block, no rewrite
      findings.push({ id: `REF:${judgement.id}`, ruleId: 'REF-PLAN', path: judgement.path, step: 'refs', area: 'reference_currency', severity: 'minor', source: 'ai', message: judgement.explanation, evidence: judgement });
      continue;
    }
    // Advisory relationships (policy.js `advisoryTypes`) supply verdicts and rewrites only: no points, never blocking. The whole-list CLO
    // questions overlap the tags, which already cost the points.
    const advisory = isAdvisory(judgement.type);
    const points = advisory ? 0 : judgement.label === 'PARTIALLY_ALIGNED' ? PENALTIES.partialAlignment : judgement.label === 'NOT_ALIGNED' ? PENALTIES.alignment : 0;
    const id = `SEM:${judgement.id}`;
    findings.push({ id, ruleId: 'SEM', path: judgement.path, step: judgement.path === 'description' ? 'info' : judgement.path.startsWith('clos') ? 'clos' : 'plan', area: 'assessment', severity: advisory ? 'minor' : judgement.label === 'INSUFFICIENT_EVIDENCE' ? 'blocking' : 'major', source: 'ai', message: judgement.explanation, evidence: judgement });
    if (points) deductions.push({ id, points, reason: judgement.label, kind: 'alignment', path: judgement.targetPath || judgement.path });
    const groupKey = tagKey(judgement);
    if (judgement.draft && judgement.targetPath && groupKey && representative.has(groupKey) && representative.get(groupKey) !== judgement) {
      alsoFlagged.push([judgement.targetPath, id]); // flagged and costing points, but not the one the draft is written for
    } else if (judgement.draft && judgement.targetPath && !(flags.b3 && judgement.type === 'ILO-CLO' && behindEarlierProblem(judgement)) && !behindOffCourseClo(judgement) && !fit.draftWithheld(judgement.type, judgement.id, content, semantic.judgements, flags) && !(provisionalAi && NEEDS_IDENTITY.has(judgement.type)) && !fit.contradictory(judgement)) {
      const held = proposals.get(judgement.targetPath);
      if (judgement.draftReview?.length) heldDrafts.push(judgement);
      else if (!held) {
        const suggestion = { id, path: judgement.targetPath, title: 'Suggested alignment revision', text: judgement.draft, replacement: replacementFor(judgement.targetPath, judgement.draft), source: 'ai', basedOn: [id] };
        proposals.set(judgement.targetPath, { suggestion, rank: rank(judgement) });
        suggestions.push(suggestion);
      } else {
        const keep = held.suggestion;
        if (rank(judgement) > held.rank) { // a more serious relationship takes over the draft; the earlier ones stay listed
          Object.assign(keep, { id, text: judgement.draft, replacement: replacementFor(judgement.targetPath, judgement.draft), basedOn: [id, ...(keep.basedOn || [])] });
          held.rank = rank(judgement);
        } else keep.basedOn = [...(keep.basedOn || []), id];
      }
    }
  }
  for (const [path, id] of alsoFlagged) {
    const held = proposals.get(path);
    if (held && !held.suggestion.basedOn.includes(id)) held.suggestion.basedOn.push(id);
  }

  // Stage A: a CLO whose PO / EGA tags do not fit, while it fits ANOTHER approved PO / EGA, is a mapping problem. The advice names the approved item
  // (checked against the approved list and the quoted evidence); the CLO text is not rewritten to fit the wrong tag and no tag is changed.
  // Precedence, so the recommendations do not contradict each other: the week's course content first, then the ILO against that content, then the
  // CLO tag. An ILO is only sent to another CLO when its week's content belongs to the course and the ILO itself fits the content.
  const mappingAdvice = [...(flags.a ? mappingAdviceOf(content, masters, semantic.judgements || []) : []), ...(flags.b3 ? iloMappingAdviceOf(content, semantic.judgements || [], (i, j) => contentOff(i) || iloOff(i, j)) : [])];
  const mappedClos = new Set(mappingAdvice.filter(advice => advice.type !== 'CLO').map(advice => advice.cloIndex));
  const mappedIlos = new Set(mappingAdvice.filter(advice => advice.type === 'CLO').map(advice => `${advice.rowIndex}.${advice.iloIndex}`));
  // Stage E.4: an answer that keeps the text and says only its tag is wrong (recommendation RETAG_OUTCOME, Stage A / B3) carries no draft. The mapping
  // advice above is its recommendation when the whole-list check verified another approved item; otherwise no item is invented and the tag field is
  // listed for the author's decision (below). A CLO rewrite built only from tag groups whose every failing tag said "keep the text" is not offered
  // either: the model's answers disagree about whether the text must change, and only the author can settle that.
  const TAG_GROUP = { 'CLO-PO': 'pos', 'CLO-anyPO': 'pos', 'CLO-EGA': 'egas', 'CLO-anyEGA': 'egas' };
  const keepsText = (i, key) => {
    const tags = (semantic.judgements || []).filter(j => TAG_GROUP[j.type] === key && !isAny(j) && j.path === `clos[${i}].statement` && !j.unverified && ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'].includes(j.label));
    return tags.length > 0 && tags.every(j => j.recommendation === 'RETAG_OUTCOME');
  };
  const retagFieldOf = j => { const clo = /^clo(\d+)-(po|ega)\d+$/.exec(j.id), ilo = /^row(\d+)-ilo(\d+)-clo:/.exec(j.id); return clo ? `clos[${clo[1]}].${clo[2] === 'po' ? 'pos' : 'egas'}` : ilo ? `plan[${ilo[1]}].ilos[${ilo[2]}].tags` : null; };
  const withheldRewrites = new Map(); // tag field -> the CLO rewrite that was not offered
  // ---- Keep the checker from asking for changes forever (stewardship.js) ----
  // `history` (from the author's earlier checks of this syllabus) says which corrections were already applied to which field and what they were
  // for. Without it (a first check) nothing below drops a suggestion except one that would change nothing.
  const history = options.history || null;
  const verdictNow = new Map((semantic.judgements || []).map(j => [j.id, j]));
  const corrections = assessCorrections({ history, judgements: semantic.judgements });
  const unresolved = [];
  const offered = [];
  for (const s of suggestions) {
    if (s.source !== 'ai') { s.tier = String(s.id).startsWith('VALUE') ? 'material' : 'mandatory'; offered.push(s); continue; }
    const driving = (s.basedOn || []).map(b => verdictNow.get(String(b).replace(/^SEM:/, ''))).filter(Boolean);
    s.tier = driving.some(j => tierOfType(j.type) === 'material') ? 'material' : 'optional';
    const attempts = history?.attempts?.[s.path] || 0;
    const change = isTrivialRewrite(textAt(content, s.path), s.text);
    // Stage B: a replacement topic that mostly repeats another week is not a correction - the plan already teaches it there.
    const repeats = flags.b && /^plan\[\d+\]\.contents$/.test(s.path) ? similarWeek(s.text, content.plan, Number(/\d+/.exec(s.path)[0])) : null;
    // Mapping advice is the answer to a wrong tag: a rewrite built only from the failing tag relationships is dropped even when the model did not leave
    // the text unchanged as told, so the author is never given "re-tag it" and "rewrite it to fit" for the same field.
    const tagOnly = (s.basedOn || []).length > 0 && (s.basedOn || []).every(b => /^(SEM:)?(clo\d+-(po|ega)\d+|row\d+-ilo\d+-clo:)/.test(String(b)));
    const ilo0 = /^plan\[(\d+)\]\.ilos\[(\d+)\]\.text$/.exec(s.path), clo0 = /^clos\[(\d+)\]\.statement$/.exec(s.path);
    // A sound ILO (it fits its week's content, B2) that builds none of the course's CLOs (B3) is not rewritten to suit a CLO either: the ILO-anyCLO
    // finding says so, and whether the ILO or the CLO list should change is the author's decision.
    const soundButUnmapped = (i, j) => flags.b3 && verdicts.get(`row${i}-ilo${j}-contentilo`)?.label === 'ALIGNED' && ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'].includes(verdicts.get(`row${i}-ilo${j}-anyclo`)?.label);
    if (tagOnly && ((ilo0 && (mappedIlos.has(`${ilo0[1]}.${ilo0[2]}`) || soundButUnmapped(ilo0[1], ilo0[2]))) || (clo0 && mappedClos.has(Number(clo0[1]))))) continue;
    if (clo0 && driving.length && driving.every(j => TAG_GROUP[j.type] && keepsText(Number(clo0[1]), TAG_GROUP[j.type]))) {
      for (const key of new Set(driving.map(j => TAG_GROUP[j.type]))) withheldRewrites.set(`clos[${clo0[1]}].${key}`, { path: s.path, relationships: driving.map(j => j.id) });
      continue;
    }
    const reason =change.trivial ? 'no_change_proposed' : repeats ? 'duplicates_week' : attempts >= POLICY.maxRewriteAttempts ? 'attempt_limit' : null;
    if (!reason) { s.attempt = attempts + 1; offered.push(s); continue; }
    if (reason === 'no_change_proposed' && mappedClos.has(Number((/^clos\[(\d+)\]\.statement$/.exec(s.path) || [])[1]))) continue; // told to leave the CLO as it is: the mapping advice says why
    const ilo = /^plan\[(\d+)\]\.ilos\[(\d+)\]\.text$/.exec(s.path);
    if (reason === 'no_change_proposed' && ilo && mappedIlos.has(`${ilo[1]}.${ilo[2]}`)) continue; // the same for an ILO that is sound but tagged to the wrong CLO
    // The problem is still there (its finding and points stay); there is just no useful rewrite to offer, so say so and stop.
    const worst = driving.slice().sort((a, b) => VERDICT_RANK[b.label] - VERDICT_RANK[a.label])[0];
    unresolved.push({ path: s.path, reason, detail: repeats ? `The proposed topic mostly repeats week ${repeats.week}.` : change.reason, repeatsWeek: repeats ? repeats.week : undefined, tier: s.tier, attempts, label: worst?.label || null, relationships: driving.map(j => j.id), explanation: worst ? String(worst.explanation || '').slice(0, 500) : '' });
  }
  // A lesson that names no core value and gets no grounded draft: the field is listed for the author's decision (NEEDS_REVIEW), with the finding and its
  // point unchanged. A draft the model wrote from the lesson's own text (it passed the quote checks) is offered instead; nothing is chosen blindly.
  // With Stage D1, when the lesson's own activity was found to support a core value (Value-map), the entry says which, and still changes nothing.
  const valuesClassification = flags.d1 ? valueClass.classifyCourse(content, semantic.judgements || [], valuesLexicon) : null;
  if (valueSuggestion !== 'legacy') for (const missing of partA.missingValues) {
    if (offered.some(s => s.path === missing.path) || unresolved.some(u => u.path === missing.path)) continue;
    const supported = (valuesClassification || []).find(c => c.path === missing.path && c.classificationStatus === 'core_supported');
    unresolved.push({ path: missing.path, reason: supported ? 'value_supported' : 'value_needs_review', status: 'NEEDS_REVIEW', tier: 'material', attempts: 0, label: null, relationships: [`VALUE:${missing.path}`], explanation: null,
      ...(supported ? { value: supported.canonicalCoreValue } : {}),
      detail: supported ? `Week ${missing.week} names no core value; what students do in it supports ${supported.canonicalCoreValue}. Naming it is the author's decision.` : `Week ${missing.week} names no Marian-Augustinian core value, and nothing in the check grounds a recommendation for one, so none is proposed.` });
  }
  // A field whose only drafts failed the static review (heldDrafts): listed for the author's decision, with its findings and points unchanged.
  const heldByPath = new Map();
  for (const j of heldDrafts) heldByPath.set(j.targetPath, [...(heldByPath.get(j.targetPath) || []), j]);
  for (const [path, group] of heldByPath) {
    if (offered.some(s => s.path === path) || unresolved.some(u => u.path === path)) continue;
    const worst = group.slice().sort((a, b) => VERDICT_RANK[b.label] - VERDICT_RANK[a.label])[0], checks = [...new Set(group.flatMap(j => j.draftReview))];
    unresolved.push({ path, reason: 'draft_needs_review', status: 'NEEDS_REVIEW', recommendationType: 'REVIEW_REQUIRED', tier: group.some(j => tierOfType(j.type) === 'material') ? 'material' : 'optional', attempts: history?.attempts?.[path] || 0, label: worst.label, relationships: group.map(j => j.id), explanation: String(worst.explanation || '').slice(0, 500), checks,
      detail: `The proposed rewrite is not offered: ${checks.map(c => DRAFT_CHECKS[c] || c).join('; ')}. The finding stands; how to change the text is the author's decision.` });
  }
  // Stage E.4: the RETAG_OUTCOME answers that no verified mapping advice answers. No approved item is named (none was verified), nothing is changed, and
  // the field waits for the author. Skipped where the text itself is the problem (a CLO not about the course; an ILO whose week or ILO is off), whose
  // own finding comes first, and where another tag of the group is aligned (the tag is advice only, SEM-TAG). A group that only the whole-list answer
  // supports is still listed when that answer's item could not be verified (no mapping advice): which tag is right is then not known. Points unchanged.
  const tagAligned = new Set((semantic.judgements || []).filter(j => j.label === 'ALIGNED' && tagKey(j) && !isAny(j)).map(tagKey));
  const retagClaims = new Map();
  for (const j of semantic.judgements || []) {
    if (j.recommendation !== 'RETAG_OUTCOME' || j.unverified || tagAligned.has(tagKey(j))) continue;
    const field = retagFieldOf(j);
    if (field) retagClaims.set(field, [...(retagClaims.get(field) || []), j]);
  }
  for (const [field, claims] of retagClaims) {
    if (mappingAdvice.some(advice => advice.path === field) || unresolved.some(u => u.path === field)) continue;
    const clo = /^clos\[(\d+)\]\.(pos|egas)$/.exec(field), ilo = /^plan\[(\d+)\]\.ilos\[(\d+)\]\.tags$/.exec(field);
    if (clo ? cloOff(Number(clo[1])) : contentOff(Number(ilo[1])) || iloOff(Number(ilo[1]), Number(ilo[2]))) continue;
    const name = clo ? (clo[2] === 'pos' ? 'PO' : 'EGA') : 'CLO', owner = clo ? 'CLO' : 'ILO';
    const whole = clo ? verdicts.get(`clo${clo[1]}-any${clo[2] === 'pos' ? 'po' : 'ega'}`) : verdicts.get(`row${ilo[1]}-ilo${ilo[2]}-anyclo`);
    const fitsNone = !!whole && !whole.unverified && ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'].includes(whole.label), namedUnverified = !!whole && !whole.unverified && whole.label === 'ALIGNED';
    const withheld = withheldRewrites.get(field), worst = claims.slice().sort((a, b) => VERDICT_RANK[b.label] - VERDICT_RANK[a.label])[0];
    unresolved.push({ path: field, reason: 'retag_needs_review', status: 'NEEDS_REVIEW', recommendationType: 'REVIEW_REQUIRED', tier: claims.some(j => tierOfType(j.type) === 'material') ? 'material' : 'optional', attempts: 0, label: worst.label, relationships: [...claims.map(j => j.id), ...(whole ? [whole.id] : [])], explanation: String(worst.explanation || '').slice(0, 500), ...(withheld ? { withheldRewrite: withheld } : {}),
      detail: `The check says the ${owner} can stay as written and its ${name} tag does not fit, but no approved ${name} was verified as the right one, so none is proposed.${fitsNone ? ` The whole-list check found no approved ${name} that this ${owner} clearly ${clo ? 'supports' : 'builds'}.` : namedUnverified ? ` The whole-list check says the ${owner} ${clo ? 'supports' : 'builds'} an approved ${name}, but the ${name} it named could not be verified as another approved ${name} (one in the approved list, not already tagged, whose own text holds the quote).` : ''}${withheld ? ` Its proposed rewrite of the ${owner} is not offered either, because the tag answers say the ${owner} can stay as written.` : ''} Whether to change the tag or the ${owner} is the author's decision.` });
  }
  suggestions.length = 0;
  suggestions.push(...offered);
  if (semantic.status !== 'completed') findings.push({ id: 'AI-REQUIRED:review', ruleId: 'AI-REQUIRED', path: 'review', step: 'review', area: 'assessment', severity: 'blocking', source: 'rule', message: `AI alignment must complete before submission. ${semantic.reason || 'Alignment is not evaluated.'}` });
  // Provisional feedback (wrong course code, SYLLABUS_CHECK_PROVISIONAL_AI=on): the alignment points are NOT charged to the official result, which stays at zero
  // with the curriculum failure; they are kept apart for review.
  const provisionalDeductions = provisionalAi ? deductions.filter(d => d.kind === 'alignment') : [];
  if (provisionalAi) for (let k = deductions.length - 1; k >= 0; k--) if (deductions[k].kind === 'alignment') deductions.splice(k, 1);
  const failed = findings.filter(f => f.severity === 'blocking');
  const points = deductions.reduce((sum, d) => sum + d.points, 0);
  const provisionalScore = partA.critical ? 0 : Math.max(0, (partA.base.overall ?? 0) - points);
  const ready = !failed.length && semantic.status === 'completed' && !masters.synthetic;
  // The title policy in force and the decision the other comparison would make (shadow: normalised; active: the old exact one). Nothing here is used
  // by the official result.
  let shadowCurriculum = null;
  if (altA) {
    const official = partA.checks.find(c => c.ruleId === 'CUR-FIELD' && c.path === 'meta.title'), other = altA.checks.find(c => c.ruleId === 'CUR-FIELD' && c.path === 'meta.title');
    const rel = official ? titleRelation(official.evidence.actual, official.evidence.expected) : null;
    const delta = official && other && official.status !== other.status ? (other.status === 'PASS' ? -1 : 1) : 0; // blocking findings the other comparison would remove (-1) or add (+1)
    const otherFailed = failed.length + delta;
    const active = titleMode === 'normalized';
    shadowCurriculum = { policy: TITLE_POLICY_VERSION, mode: active ? 'active' : 'shadow', note: active ? 'The normalised comparison is official. "legacyStatus" is what the old exact comparison would have decided.' : 'The official decision is unchanged. This is what the normalised comparison would decide.',
      title: official ? { entered: official.evidence.actual, approved: official.evidence.expected, relation: rel.relation, officialStatus: official.status, [active ? 'legacyStatus' : 'shadowStatus']: other ? other.status : null, suggestion: rel.relation === 'case_or_space' ? { kind: 'formatting', text: official.evidence.expected } : null } : null,
      impact: { numericScore: 'The points total is unchanged (the title check deducts no points). As a blocking finding it withholds the published score until resolved, so it decides whether a score is shown at all.', points: provisionalScore, blockingFindings: { official: failed.length, [active ? 'legacy' : 'shadow']: otherFailed }, readyWouldChange: (!otherFailed && semantic.status === 'completed' && !masters.synthetic) !== ready } };
  }
  // A structural baseline is not a verified AI score. Preserve a real critical
  // zero, but do not publish a final numeric score for an incomplete pipeline.
  const score = partA.critical ? 0 : ready ? provisionalScore : null;
  const quality = qualityNotes(content);
  // Is anything still needed? Optional advice is counted but never changes the answer; an unfinished AI check is never reported as "no changes".
  const summary = summarize({ findings, quality, semanticCompleted: semantic.status === 'completed', missingValues: partA.missingValues.length, unresolved, corrections });
  const result = {
    ...partA.base, standard: VERSION, status: score === null ? 'incomplete' : 'scored', overall: score, score, baseScore: partA.base.overall,
    passed: ready && score >= standard.passThreshold, band: score === null ? null : score >= 90 ? 'Excellent' : score >= 79 ? 'Meets the standard' : 'Needs work',
    conformance: { ok: !failed.length, failed }, findings,
    hybrid: { identity: partA.identity, titlePolicy: { mode: titleMode, comparison: officialComparison(titleMode), version: TITLE_POLICY_VERSION }, valueSuggestion, shadowCurriculum, provisional: provisionalAi ? { reason: 'The course code is not in the approved curriculum; these AI findings are provisional and not curriculum-verified.', deductions: provisionalDeductions } : null, version: VERSION, reportVersion: 2, policy: { ...POLICY, ...(flags.c3 || flags.requirements ? { advisoryTypes: [...POLICY.advisoryTypes, ...(flags.c3 ? C3.types : []), ...(flags.requirements ? requirementsAdvice.TYPES : [])] } : {}) }, codedChecks: partA.checks, ready, critical: partA.critical, score, provisionalScore, baseScore: partA.base.overall, deductions,
      // The official model and a proposed one side by side. Only the official one is used; see scoring.js.
      quality, summary, corrections, unresolved,
      scoring: { official: { policy: POLICY.version, deducted: points, score: provisionalScore }, shadow: shadowOf({ base: partA.base.overall, deductions, critical: partA.critical }) }, links, alignment: semantic, suggestions: bindSuggestions(content, suggestions), outcomeSource: masters.outcomeSource || null, mappingAdvice, stageC: semantic.stageC, stageD: semantic.stageD, references: referenceEntries, valuesDefinitions: valueDefinitions ? valueDefinitions.status : null, valuesClassification, valuesProfile: flags.d1 ? valuesStage.valuesProfile(content, semantic.judgements || [], valueDefinitions) : null, coverage: flags.b4 ? coverageTable(content, semantic.judgements || []) : null, coverageSummary: flags.b4 ? coverageSummary(content, coverageTable(content, semantic.judgements || []), semantic.judgements || []) : null, stages: flags, synthetic: !!masters.synthetic, checkedMeta: content.meta, checkedAt: new Date().toISOString(), curriculum: partA.curriculum ? { id: partA.curriculum.id, source: partA.curriculum.source, program: partA.curriculum.program, curriculumYear: partA.curriculum.curriculumYear } : null },
  };
  // Shadow verdict (verdict.js): typed findings and separate completeness / curriculum / alignment answers. A fault here must never break a check.
  try { result.hybrid.verdict = verdict.buildVerdict(result, content); } catch (error) {
    console.error('VERDICT ERROR (advisory layer skipped, the check is unaffected):', error && error.stack || error);
    result.hybrid.verdict = { version: VERDICT_VERSION, unavailable: true };
  }
  return withholdReviewedDrafts(result);
}
module.exports = { run, coded, VERSION, VALUES, HEADERS, PENALTIES, normCode };
