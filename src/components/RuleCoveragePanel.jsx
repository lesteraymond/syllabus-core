import { t, tr } from '../i18n';

// Extends the existing report only. Historical reports without receipts have no
// synthetic coverage, and no verdict panel or workflow control is introduced.
// The status words are hybrid.coverageStatus.*; the backend status codes are unchanged.
// part="notices": only what must be seen first (coverage unavailable, or cut short by the budget). part="list": only the collapsed rule-by-rule list,
// which the card puts after the results. Without `part`, both (the earlier behaviour).
export default function RuleCoveragePanel({ coverage, part }) {
  const showNotices = part !== 'list', showList = part !== 'notices';
  if (coverage?.unavailable) return showNotices ? <p className="hy-hint" role="alert">{t('hybrid.ruleCoverageUnavailable')}</p> : null;
  if (!coverage?.rules) return null;
  const counts = coverage.counts, budget = coverage.budget;
  // A rule replaced by an authorized alternative check keeps its NOT_CHECKED code but is shown as what it is.
  const statusOf = rule => t('hybrid.coverageStatus.' + (rule.reasonCode === 'replaced' ? 'REPLACED' : rule.status));
  return <>
    {/* Required academic coverage cut short by the configured per-check budget: said first, outside the collapsed list, and never hidden behind a pass. */}
    {showNotices && budget?.requiredIncomplete && <div className="info-banner warning" role="alert" data-testid="budget-required-incomplete">{t('hybrid.budgetRequiredIncomplete', { cost: budget.advice?.estimatedRequiredCostUsd ?? '?', cap: budget.advice?.currentCapUsd ?? budget.limits?.maxCostUsd ?? '?' })}</div>}
    {showNotices && !budget?.requiredIncomplete && budget?.deferredOptional > 0 && <div className="info-banner" role="status" data-testid="budget-optional-deferred">{t('hybrid.budgetDeferred', { count: budget.deferredOptional })}</div>}
    {showList && <details className="hy-details">
      <summary>{t('hybrid.ruleCoverage', { verified: counts.verified, total: counts.catalogued })}</summary>
      <p>{t('hybrid.ruleCoverageScope')}</p>
      <p>{t('hybrid.ruleCoverageCounts', { failed: counts.failed, review: counts.needsReview, partial: counts.partiallyEvaluated, unchecked: counts.notChecked })}</p>
      <ul>{coverage.rules.map(rule => <li key={rule.ruleId}>
        <code>{rule.ruleId}</code> · {statusOf(rule)}
        {rule.reasonCode === 'budget_deferred' ? <p>{t('hybrid.reason.budget_deferred')}</p> : rule.reason && <p>{tr(rule.reason)}</p>}
        {rule.instances.filter(i => i.status !== 'PASS').map((instance, i) => <span key={i}> {instance.path || ''}{instance.week ? ` (${instance.week})` : ''}</span>)}
      </li>)}</ul>
    </details>}
  </>;
}
