'use strict';
// Stage S7: provider drift. Two whole-pipeline evaluations (scripts/live-pipeline-eval.cjs) of the same synthetic syllabi under the same settings, by two
// providers or models (or by one model twice, for the run-to-run noise floor), compared syllabus by syllabus with the Phase 3 comparator
// (phase3/score.js comparePairedOfficial): what would change in the official score, the pass mark of 79, readiness and the submission gates, and in
// the scored relationships, if the candidate's verdicts stood where the baseline's do. Offline: it reads result files and sends nothing. The
// evaluation keeps of each syllabus's engine result only what the comparator reads (officialOf, saved as officialDetail), so a result file stays small
// and carries no syllabus text beyond the quotes, explanations and drafts of the answers. The comparator names its two sides legacy and enhanced: here
// they are the baseline and the candidate. Every figure is measured against developer-written expectations, not faculty-verified.
const { comparePairedOfficial, DRIFT_CATEGORIES, AGREEMENT_LABEL } = require('./phase3/score');

const pick = (object, keys) => Object.fromEntries(keys.filter(key => object?.[key] !== undefined).map(key => [key, object[key]]));
// What comparePairedOfficial reads of an engine result, and nothing more (the provider marks are kept to label the result).
function officialOf(result) {
  const hybrid = result?.hybrid || {}, alignment = hybrid.alignment || {}, verdict = hybrid.verdict || {};
  return {
    ...pick(result, ['score', 'passed', 'baseScore']),
    findings: (result?.findings || []).map(f => pick(f, ['ruleId', 'id', 'severity'])),
    conformance: { failed: (result?.conformance?.failed || []).map(c => pick(c, ['id'])) },
    hybrid: {
      ...pick(hybrid, ['ready', 'provisionalScore', 'mappingAdvice']),
      deductions: (hybrid.deductions || []).map(d => pick(d, ['id', 'kind', 'path', 'points', 'reason'])),
      alignment: { ...pick(alignment, ['status', 'provider', 'model', 'promptVersion', 'evaluationOnly']),
        judgements: (alignment.judgements || []).map(j => pick(j, ['id', 'type', 'label', 'unverified', 'path', 'targetPath', 'sourceQuote', 'targetQuote', 'evidenceMatching', 'explanation'])) },
      verdict: { ...pick(verdict, ['overall', 'counts']), findings: (verdict.findings || []).map(f => pick(f, ['status', 'ruleId', 'relationshipId', 'path', 'withheld'])) },
      suggestions: (hybrid.suggestions || []).map(s => pick(s, ['id', 'path', 'text'])),
    },
  };
}
// The settings two evaluations must share for their difference to be the provider's: the prompt version (it names the stages and the variant), the
// prompt trim, and whether every stage was off (--legacy).
const SHARED_SETTINGS = ['promptVersion', 'prompt', 'legacy'];
const labelOf = report => `${report?.provider || '?'}/${report?.model || '?'}`;
// Compares two live-pipeline result files (parsed). Syllabi are paired by name; one checked on one side only, or without an official result (its
// check failed, or the file was written before Stage S7), is listed as unpaired. A syllabus the run stopped during (stoppedDuring) is compared and
// marked partial. settingsDiffer lists the shared settings that differ: the difference is then not the provider's alone (the report refuses it).
function compareProviders(baseline, candidate) {
  const settingsDiffer = SHARED_SETTINGS.filter(key => JSON.stringify(baseline?.[key] ?? null) !== JSON.stringify(candidate?.[key] ?? null))
    .map(key => ({ setting: key, baseline: baseline?.[key] ?? null, candidate: candidate?.[key] ?? null }));
  const checked = report => new Map((report?.results || []).filter(r => r && r.officialDetail).map(r => [r.name, r]));
  const base = checked(baseline), cand = checked(candidate);
  const pairs = [...base.keys()].filter(name => cand.has(name)).map(name => {
    const a = base.get(name), b = cand.get(name);
    return { name, syllabus: a.syllabus || b.syllabus || name, partial: !!(a.stoppedDuring || b.stoppedDuring), comparison: comparePairedOfficial(a.officialDetail, b.officialDetail) };
  });
  const names = report => (report?.results || []).map(r => r?.name).filter(Boolean);
  const categories = Object.fromEntries(Object.keys(DRIFT_CATEGORIES).map(key => [key, pairs.filter(p => p.comparison.drift.category === key).length]));
  return {
    offline: true, agreementNote: AGREEMENT_LABEL,
    baseline: { label: labelOf(baseline), generated: baseline?.generated ?? null, evaluationOnly: !!baseline?.evaluationOnly },
    candidate: { label: labelOf(candidate), generated: candidate?.generated ?? null, evaluationOnly: !!candidate?.evaluationOnly },
    sameProviderAndModel: labelOf(baseline) === labelOf(candidate),
    settingsDiffer,
    unpaired: { baselineOnly: names(baseline).filter(n => !cand.has(n) || !base.has(n)), candidateOnly: names(candidate).filter(n => !base.has(n) || !cand.has(n)) },
    categories, pairs,
  };
}
module.exports = { officialOf, compareProviders, SHARED_SETTINGS, DRIFT_CATEGORIES };
