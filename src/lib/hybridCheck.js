// Shared presentation rules: the server remains authoritative.

// Findings that come from the AI or from reaching out to the network. Under the advisory policy these inform the author and the
// reviewer; they never stop a submit or an approval. Everything else that is blocking is a coded hard gate (the server's `coded()`).
const ADVISORY_RULES = new Set(['AI-REQUIRED', 'SEM', 'LINK', 'REF-PLAN']);
export const hardGatesOf = (run) => (run?.findings || []).filter((f) => f.severity === 'blocking' && !ADVISORY_RULES.has(f.ruleId));

// `gate` is the server's policy (GET /syllabus-check/status): 'advisory' lets the person decide once the hard gates are clear, 'required'
// also needs a completed, current AI check. Until the policy is known the strict rule applies. A check that no longer matches the
// form says nothing about its hard gates, so the server (which checks the saved form again) decides and explains a refusal.
export function canSubmitHybrid(run, signature, gate = 'required') {
  if (gate === 'advisory') {
    if (!run || run.stale || (signature && run.draftSignature !== signature)) return true;
    return hardGatesOf(run).length === 0;
  }
  return !!(run?.hybrid?.ready && run.hybrid.alignment?.status === 'completed' && !run.stale &&
    (!signature || run.draftSignature === signature) && Date.now() - Date.parse(run.hybrid.checkedAt) <= 30 * 60 * 1000);
}
const sameValue = (a, b) => {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a).sort(), other = Object.keys(b).sort();
  return keys.length === other.length && keys.every((key, i) => key === other[i] && sameValue(a[key], b[key]));
};
export function applySuggestion(draft, patch, { requireOriginal = false } = {}) {
  if (!patch || !/^(meta\.(title|prereq|lecture|lab|yearLevel)|outcomes\.(vision|mission|egas|pos)|description|clos\[\d+\]\.statement|plan\[\d+\]\.(values|contents|activities|tasks)|plan\[\d+\]\.ilos\[\d+\]\.text)$/.test(patch.path)) throw Error('This suggestion cannot be applied to the form.');
  if (requireOriginal && !Object.hasOwn(patch, 'originalValue')) throw Error('hybrid.refreshSuggestions');
  const result = structuredClone(draft);
  const parts = patch.path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let parent = result;
  for (const key of parts.slice(0, -1)) {
    if (!parent || !Object.prototype.hasOwnProperty.call(parent, key)) throw Error('The target field changed; run the checker again.');
    parent = parent[key];
  }
  const row = patch.path.match(/^(clos|plan)\[(\d+)\](?:\.ilos\[(\d+)\])?/);
  if (row) {
    const target = draft[row[1]]?.[Number(row[2])];
    if ((patch.targetIds?.row !== undefined && target?.id !== patch.targetIds.row) ||
        (patch.targetIds?.ilo !== undefined && target?.ilos?.[Number(row[3])]?.id !== patch.targetIds.ilo)) throw Error('hybrid.suggestionTargetChanged');
  }
  const current = parent[parts.at(-1)];
  const original = patch.originalMissing ? undefined : patch.originalValue;
  if (Object.hasOwn(patch, 'originalValue') && !sameValue(current, original) && !sameValue(current, patch.replacement)) throw Error('hybrid.suggestionTargetChanged');
  parent[parts.at(-1)] = structuredClone(patch.replacement);
  return result;
}

// Take back an applied recommendation: restore the original text, but only while the field still holds what was applied
// (applySuggestion refuses if it was edited since), then record the reversal as a rejection. The log stays append-only.
export async function undoSuggestion({ suggestion, appliedValue, applyDraft, recordDecision }) {
  if (!applyDraft || suggestion.originalMissing || !Object.hasOwn(suggestion, 'originalValue')) throw Error('hybrid.cannotUndo');
  await applyDraft({ ...suggestion, originalValue: appliedValue, originalMissing: false, replacement: suggestion.originalValue });
  try {
    return await recordDecision({ suggestionId: suggestion.id, action: 'undo' });
  } catch (error) {
    error.draftSaved = true;
    throw error;
  }
}

// A successful decision must never be shown before the author-approved draft is
// saved. Reviewer-only decisions attach a proposal without editing the syllabus.
export async function decideSuggestion({ suggestion, action, editedText, verificationToken, applyDraft, recordDecision }) {
  let applied = false;
  if (action !== 'reject' && action !== 'undo' && applyDraft) {
    await applyDraft({ ...suggestion, replacement: action === 'edit' ? editedText : suggestion.replacement });
    applied = true;
  }
  try {
    const decision = await recordDecision({ suggestionId: suggestion.id, action, editedText, verificationToken });
    return { decision, applied };
  } catch (error) {
    if (applied) error.draftSaved = true;
    throw error;
  }
}
