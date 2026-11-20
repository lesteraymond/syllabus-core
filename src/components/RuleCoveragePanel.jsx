import { t } from '../i18n';

// Check coverage, at the end of the AI Checker report: the AI questions the new AI Checker asked about this syllabus, counted by kind (how many were aligned,
// partly aligned, not aligned or not answered). Owner decision 2026-11-20: only the AI questions are listed; the rule-by-rule receipts stay in the saved
// report (ruleCoverage.rules) for audit but are not shown. A report the new checker did not make (no aiQuestions) shows no list.
// part="notices": only what must be seen first (coverage unavailable, Program Outcomes not linked to an EGA, and the budget notices of an old-checker
// report, which recorded a budget). part="list": only the collapsed list, which the card puts after the results. Without `part`, both.
export default function RuleCoveragePanel({ coverage, part }) {
  const showNotices = part !== 'list', showList = part !== 'notices';
  if (coverage?.unavailable) return showNotices ? <p className="hy-hint" role="alert">{t('hybrid.ruleCoverageUnavailable')}</p> : null;
  if (!coverage?.rules) return null;
  const budget = coverage.budget, ai = coverage.aiQuestions;
  return <>
    {/* Required academic coverage cut short by the configured per-check budget: said first, outside the collapsed list, and never hidden behind a pass. */}
    {showNotices && budget?.requiredIncomplete && <div className="info-banner warning" role="alert" data-testid="budget-required-incomplete">{t('hybrid.budgetRequiredIncomplete', { cost: budget.advice?.estimatedRequiredCostUsd ?? '?', cap: budget.advice?.currentCapUsd ?? budget.limits?.maxCostUsd ?? '?' })}</div>}
    {/* The program's POs not linked to an EGA: an administrator's setup gap, said first; it blocks nothing (P-03 is then Not checked). */}
    {showNotices && coverage.posWithoutEga?.length > 0 && <div className="info-banner warning" role="status" data-testid="po-ega-unlinked">{t('hybrid.poEgaUnlinked', { list: coverage.posWithoutEga.join(', '), count: coverage.posWithoutEga.length })}</div>}
    {showNotices && !budget?.requiredIncomplete && budget?.deferredOptional > 0 && <div className="info-banner" role="status" data-testid="budget-optional-deferred">{t('hybrid.budgetDeferred', { count: budget.deferredOptional })}</div>}
    {showList && ai && ai.byRelationship.length > 0 && <details className="hy-details" data-testid="ai-coverage">
      <summary>{t('hybrid.aiCoverageHeading', { answered: ai.answered, asked: ai.asked })}</summary>
      <p>{t('hybrid.aiCoverageScope')}</p>
      <ul>{ai.byRelationship.map(k => <li key={k.relationship}><code>{k.relationship}</code> · {t('hybrid.aiQuestionsRow', { asked: k.asked, passed: k.passed, review: k.review, failed: k.failed, notChecked: k.notChecked })}</li>)}</ul>
    </details>}
  </>;
}
