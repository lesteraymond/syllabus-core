'use strict';
// What the per-check AI budget did, in the terms a reader needs (stored on the report as hybrid.budget; reporting only, nothing reads it to score or gate).
// The caps themselves are the operator's: this module never raises one, it only says whether the required evaluations fit and by roughly how much they do not.
const round = (n) => Math.round(n * 100) / 100;

function budgetReport(summary, { plannedRequired = 0, v2Status = null } = {}) {
  if (!summary) return null;
  const by = summary.byPriority || {};
  const costOf = (k) => (by[k] && by[k].reservedCostUsd) || 0, countOf = (k) => (by[k] && by[k].requests) || 0;
  const capped = typeof summary.maxCostUsd === 'number';
  // Required work was cut short only if V2 did not complete AND the budget (not the provider) is what stopped it.
  const requiredIncomplete = !!summary.exhausted && v2Status !== null && v2Status !== 'completed';
  const perV2 = countOf('v2') ? costOf('v2') / countOf('v2') : countOf('scored') ? costOf('scored') / countOf('scored') : 0;
  const estimatedRequiredCostUsd = capped ? round(costOf('scored') + Math.max(plannedRequired, countOf('v2')) * perV2 * 1.25) : null;
  return {
    planned: !!summary.planned,
    limits: { maxRequests: summary.maxRequests, maxTokens: summary.maxTokens, ...(capped ? { maxCostUsd: summary.maxCostUsd } : {}) },
    used: { requests: summary.requests, reservedTokens: summary.reservedTokens, ...(capped ? { reservedCostUsd: summary.reservedCostUsd } : {}) },
    byPriority: by,
    plannedRequiredRequests: plannedRequired,
    deferredOptional: summary.deferredOptional || 0,
    exhausted: !!summary.exhausted, stopReason: summary.stopReason || null,
    requiredIncomplete,
    // Four different things, never added together or presented as one: what was reserved against the cap (an upper-bound estimate made before each request),
    // what the provider reported it used (token counts), and the charge those tokens come to at the published list prices (calculatedUsd; not an invoice).
    // Only provider-reported usage is real; a scripted or simulated provider's numbers are not billing.
    ...(summary.providerReported ? { accounting: {
      reservedCostUsd: capped ? summary.reservedCostUsd : null,
      providerReported: { requests: summary.providerReported.requests, inputTokens: summary.providerReported.inputTokens, outputTokens: summary.providerReported.outputTokens,
        cacheCreationInputTokens: summary.providerReported.cacheCreationInputTokens, cacheReadInputTokens: summary.providerReported.cacheReadInputTokens },
      calculatedUsd: summary.providerReported.calculatedUsd,
    } } : {}),
    // An operator decision, never applied automatically.
    ...(requiredIncomplete && capped ? { advice: { estimatedRequiredCostUsd, currentCapUsd: summary.maxCostUsd, options: ['raise_cost_cap', 'run_fewer_optional_checks'] } } : {}),
  };
}

module.exports = { budgetReport };
