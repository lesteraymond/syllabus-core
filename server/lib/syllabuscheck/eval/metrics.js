'use strict';
// Scores the AI's verdicts against an evaluation dataset (dataset.json). Pure functions: no provider call, so they are unit-tested offline.
//
//   items  the dataset's items: { id, type, accept: [verdicts that are defensible], ambiguous? }
//   runs   one Map per run: id -> verdict, or null when the answer was invalid / not received
//   attempted  optional (Stage E.6): (run index, id) -> whether that run ever sent the relationship. A relationship a run never sent (it stopped
//              first) was not evaluated: it is left out of that run's answers and invalid answers and counted as notAttempted. Without it, every
//              missing answer counts as invalid, as it always did.
//
// Definitions (an `ambiguous` item is left out of the two error rates, because reviewers could reasonably differ on it):
//   false positive   a clear ALIGNED item (accept is exactly ["ALIGNED"]) that was judged anything else
//   false negative   a clear not-aligned item (ALIGNED not accepted) that was judged ALIGNED
//   agreement        answered verdicts that are in the item's `accept` list
//   stability        items answered more than once whose verdict never changed between runs
const rate = (n, d) => (d ? Math.round((n / d) * 1000) / 1000 : null);

// What an item is expected to be, for the confusion matrix. null = ambiguous or mixed, left out of it.
//   ALIGNED  accept is exactly ["ALIGNED"]      PARTIAL  accept is exactly ["PARTIALLY_ALIGNED"]
//   FLAGGED  ALIGNED is not accepted at all (PARTIALLY_ALIGNED and/or NOT_ALIGNED)
const expectedClass = (item) => {
  if (item.ambiguous) return null;
  if (item.accept.length === 1 && item.accept[0] === 'ALIGNED') return 'ALIGNED';
  if (item.accept.length === 1 && item.accept[0] === 'PARTIALLY_ALIGNED') return 'PARTIAL';
  if (!item.accept.includes('ALIGNED')) return 'FLAGGED';
  return null;
};
const GOT = ['ALIGNED', 'PARTIALLY_ALIGNED', 'NOT_ALIGNED', 'INSUFFICIENT_EVIDENCE', 'invalid'];

function scoreEval(items, runs, { disciplineOf = () => null, attempted = null } = {}) {
  // A diagnostic awaiting a faculty/schema decision is still evaluated by the runner, but has no academic expectation to score.
  const excluded = items.filter(item => item.excludeFromAgreement === true);
  items = items.filter(item => item.excludeFromAgreement !== true);
  const confusion = { ALIGNED: {}, PARTIAL: {}, FLAGGED: {} };
  for (const row of Object.values(confusion)) for (const g of GOT) row[g] = 0;
  const bucket = (map, key) => (map[key] ||= { items: 0, answered: 0, agree: 0, invalid: 0 });
  const byDiscipline = {}, byCategory = {};
  let answered = 0, invalid = 0, agree = 0, notAttempted = 0;
  let clearAligned = 0, falsePositive = 0, clearNot = 0, falseNegative = 0;
  const byType = {};
  const disagreements = [];
  let multi = 0, steady = 0;
  for (const item of items) {
    const t = (byType[item.type] ||= { items: 0, answered: 0, agree: 0, invalid: 0 });
    t.items += 1;
    const dsc = bucket(byDiscipline, disciplineOf(item) || 'unknown'); dsc.items += 1;
    const cat = bucket(byCategory, item.category || 'uncategorised'); cat.items += 1;
    const klass = expectedClass(item);
    const asked = runs.filter((run, r) => !attempted || attempted(r, item.id));
    notAttempted += runs.length - asked.length;
    const labels = asked.map((run) => run.get(item.id) ?? null);
    const valid = labels.filter(Boolean);
    for (const label of labels) {
      if (klass) confusion[klass][label || 'invalid'] += 1;
      if (!label) { invalid += 1; t.invalid += 1; dsc.invalid += 1; cat.invalid += 1; continue; }
      answered += 1; t.answered += 1; dsc.answered += 1; cat.answered += 1;
      if (item.accept.includes(label)) { agree += 1; t.agree += 1; dsc.agree += 1; cat.agree += 1; }
      if (!item.ambiguous) {
        if (item.accept.length === 1 && item.accept[0] === 'ALIGNED') { clearAligned += 1; if (label !== 'ALIGNED') falsePositive += 1; }
        else if (!item.accept.includes('ALIGNED')) { clearNot += 1; if (label === 'ALIGNED') falseNegative += 1; }
      }
    }
    if (valid.length >= 2) { multi += 1; if (new Set(valid).size === 1) steady += 1; }
    if (valid.some((label) => !item.accept.includes(label))) disagreements.push({ id: item.id, type: item.type, accept: item.accept, got: labels });
  }
  const total = answered + invalid;
  return {
    items: items.length, runs: runs.length, answered, invalid, invalidRate: rate(invalid, total), ...(attempted ? { notAttempted } : {}),
    ...(excluded.length ? {
      scoredItems: items.length, datasetItems: items.length + excluded.length,
      excludedFromAgreement: excluded.map(item => ({ id: item.id, reason: item.pendingDecision || item.expectationStatus || 'No expected academic judgment has been approved.' })),
    } : {}),
    agreement: rate(agree, answered), falsePositiveRate: rate(falsePositive, clearAligned), falseNegativeRate: rate(falseNegative, clearNot),
    counts: { clearAligned, falsePositive, clearNot, falseNegative },
    confusion,
    // Of the answered items whose best answer is PARTIALLY_ALIGNED, how many were judged PARTIALLY_ALIGNED.
    partialAccuracy: rate(confusion.PARTIAL.PARTIALLY_ALIGNED, GOT.filter((g) => g !== 'invalid').reduce((n, g) => n + confusion.PARTIAL[g], 0)),
    // Of the answered clear-ALIGNED items, how many were judged ALIGNED (the complement of the false-positive rate).
    approvalAccuracy: rate(confusion.ALIGNED.ALIGNED, GOT.filter((g) => g !== 'invalid').reduce((n, g) => n + confusion.ALIGNED[g], 0)),
    byDiscipline: Object.fromEntries(Object.entries(byDiscipline).map(([k, v]) => [k, { ...v, agreement: rate(v.agree, v.answered) }])),
    byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, { ...v, agreement: rate(v.agree, v.answered) }])),
    stability: rate(steady, multi),
    byType: Object.fromEntries(Object.entries(byType).map(([type, t]) => [type, { ...t, agreement: rate(t.agree, t.answered) }])),
    disagreements,
  };
}

module.exports = { scoreEval };
