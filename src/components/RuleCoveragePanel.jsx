import { t, tr } from '../i18n';

// Extends the existing report only. Historical reports without receipts have no
// synthetic coverage, and no verdict panel or workflow control is introduced.
// The status words are the same ones the Policy V2 panel uses (hybrid.coverageStatus.* / academicV2.status.*); the backend status codes are unchanged.
export default function RuleCoveragePanel({ coverage }) {
  if (coverage?.unavailable) return <p>{t('hybrid.ruleCoverageUnavailable')}</p>;
  if (!coverage?.rules) return null;
  const counts = coverage.counts, budget = coverage.budget;
  // A rule replaced by an authorized alternative check keeps its NOT_CHECKED code but is shown as what it is.
  const statusOf = rule => t('hybrid.coverageStatus.' + (rule.reasonCode === 'replaced' ? 'REPLACED' : rule.status));
  return <>
    {/* Required academic coverage cut short by the configured per-check budget: said first, outside the collapsed list, and never hidden behind a pass. */}
    {budget?.requiredIncomplete && <div className="info-banner warning" role="alert" data-testid="budget-required-incomplete">{t('hybrid.budgetRequiredIncomplete', { cost: budget.advice?.estimatedRequiredCostUsd ?? '?', cap: budget.advice?.currentCapUsd ?? budget.limits?.maxCostUsd ?? '?' })}</div>}
    {!budget?.requiredIncomplete && budget?.deferredOptional > 0 && <div className="info-banner" role="status" data-testid="budget-optional-deferred">{t('hybrid.budgetDeferred', { count: budget.deferredOptional })}</div>}
    <details className="hy-details">
      <summary>{t('hybrid.ruleCoverage', { verified: counts.verified, total: counts.catalogued })}</summary>
      <p>{t('hybrid.ruleCoverageScope')}</p>
      <p>{t('hybrid.ruleCoverageCounts', { failed: counts.failed, review: counts.needsReview, partial: counts.partiallyEvaluated, unchecked: counts.notChecked })}</p>
      <ul>{coverage.rules.map(rule => <li key={rule.ruleId}>
        <code>{rule.ruleId}</code> · {statusOf(rule)}
        {rule.reasonCode === 'budget_deferred' ? <p>{t('hybrid.reason.budget_deferred')}</p> : rule.reason && <p>{tr(rule.reason)}</p>}
        {rule.instances.filter(i => i.status !== 'PASS').map((instance, i) => <span key={i}> {instance.path || ''}{instance.week ? ` (${instance.week})` : ''}</span>)}
      </li>)}</ul>
    </details>
  </>;
}
