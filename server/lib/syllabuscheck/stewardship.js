'use strict';
// Pure functions (no provider, no database):
//
//   isTrivialRewrite   a proposed rewrite that does not change the text in any way that matters (pipeline/refine.js: "Check & improve")
//   summarize          the one answer to "does this syllabus still need changes?" (engine.js, pipeline/official.js)
//
// Why isTrivialRewrite exists (found in the stored runs of one syllabus): the AI sometimes judged a text PARTIALLY_ALIGNED and returned the same text
// as its "fix"; accepting it changed nothing, and the same suggestion came back check after check. The old checker's correction history
// (assessCorrections) was removed with the old AI Checker.

const wordsOf = (value) => String(value ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
// Function words carry no requirement of their own; a rewrite that only adds or drops them says nothing new.
const FUNCTION_WORDS = new Set(['a', 'an', 'the', 'of', 'to', 'and', 'or', 'in', 'on', 'for', 'with', 'by', 'is', 'are', 'be', 'as', 'at', 'that', 'this', 'their', 'its']);

// The text of a field as a string (the description is a list of paragraphs).
function textOf(value) {
  if (Array.isArray(value)) return value.map((item) => String(item?.t ?? '')).filter(Boolean).join('\n\n');
  return String(value ?? '');
}

// A rewrite is trivial when it adds no information: the same text, the same words in another case or punctuation, the same words reordered, or a
// change only in function words. A change of even one content word is NOT trivial: adding "justify" can be exactly the missing piece.
function isTrivialRewrite(current, draft) {
  const a = textOf(current), b = textOf(draft);
  if (a === b) return { trivial: true, reason: 'identical' };
  const wa = wordsOf(a), wb = wordsOf(b);
  if (wa.join(' ') === wb.join(' ')) return { trivial: true, reason: 'case_or_punctuation' };
  const sorted = (w) => [...w].sort().join(' ');
  if (sorted(wa) === sorted(wb)) return { trivial: true, reason: 'reordered' };
  const content = (w) => new Set(w.filter((x) => !FUNCTION_WORDS.has(x)));
  const ca = content(wa), cb = content(wb);
  if (ca.size === cb.size && [...ca].every((x) => cb.has(x))) return { trivial: true, reason: 'function_words_only' };
  return { trivial: false, reason: null };
}

// mandatory_open (a blocking rule fails), incomplete (the AI check did not finish), material_open (problems that cost points remain), or
// no_changes_needed. `corrections` is kept for the report shape; the new checker passes none.
function summarize({ findings, quality, semanticCompleted, missingValues = 0, unresolved = [], corrections = [] }) {
  const f = findings || [];
  const mandatory = f.filter((x) => x.severity === 'blocking' && x.ruleId !== 'AI-REQUIRED' && x.ruleId !== 'SEM').length;
  const material = f.filter((x) => x.severity === 'major').length + missingValues;
  const optional = f.filter((x) => x.severity === 'minor' && x.ruleId !== 'SEM-TAG').length + (quality?.counts?.total || 0);
  const status = mandatory > 0 ? 'mandatory_open' : !semanticCompleted ? 'incomplete' : material > 0 ? 'material_open' : 'no_changes_needed';
  return {
    status,
    counts: { mandatory, material, optional, unresolved: unresolved.length, regressed: corrections.filter((c) => c.status === 'regressed').length },
  };
}

module.exports = { isTrivialRewrite, summarize, textOf };
