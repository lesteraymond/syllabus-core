'use strict';
// What stops a check from asking for changes forever. Pure functions (no provider, no database), used by engine.js and refine.js.
//
//   isTrivialRewrite   a proposed rewrite that does not change the text in any way that matters
//   assessCorrections  did an earlier, applied correction actually fix what it was for, and did it break anything else?
//   summarize          the one answer to "does this syllabus still need changes?"
//
// Why they exist (found in the stored runs of one syllabus): the AI sometimes judged a text PARTIALLY_ALIGNED and returned the same text as its
// "fix"; accepting it changed nothing, so the verdict was reused and the same suggestion came back 15 checks in a row. And every rewrite is written for
// one relationship but changes text that up to four others depend on, so each round fixed some relationships and flagged new ones.
const RANK = { ALIGNED: 0, PARTIALLY_ALIGNED: 1, NOT_ALIGNED: 2, INSUFFICIENT_EVIDENCE: 3 };

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

// Compare what an applied correction was meant to fix with what the new check says.
//   history.last[path]  { runId, basedOn: [relationship ids], before: { id: verdict } }   the correction applied most recently to that field
//   history.attempts    { path: number }                                                   corrections applied since the field last passed
//   history.previous    { id: verdict }                                                    the verdicts of the check before this one
// status: resolved (all fixed), improved (some better, none worse), unresolved (no better), regressed (something is worse, or a relationship that
// passed before now fails because of the edit), unknown (the relationships can no longer be matched).
function assessCorrections({ history, judgements }) {
  if (!history || !history.last) return [];
  const now = new Map((judgements || []).map((j) => [j.id, j]));
  const previous = history.previous || {};
  return Object.entries(history.last).map(([path, c]) => {
    const relationships = (c.basedOn || []).map((id) => ({ id, before: c.before?.[id] ?? null, after: now.get(id)?.label ?? null }));
    const known = relationships.filter((r) => r.before && r.after && !now.get(r.id)?.unverified);
    const worse = known.some((r) => RANK[r.after] > RANK[r.before]);
    const better = known.some((r) => RANK[r.after] < RANK[r.before]);
    // A relationship that touches the edited field, was not part of the correction, passed before and fails now.
    const introduced = (judgements || [])
      .filter((j) => (j.path === path || j.targetPath === path) && !(c.basedOn || []).includes(j.id) && previous[j.id] === 'ALIGNED' && ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'].includes(j.label) && !j.unverified)
      .map((j) => ({ id: j.id, before: 'ALIGNED', after: j.label }));
    const status = worse || introduced.length ? 'regressed'
      : !known.length ? 'unknown'
      : known.every((r) => r.after === 'ALIGNED') ? 'resolved'
      : better ? 'improved' : 'unresolved';
    return { path, appliedInRun: c.runId ?? null, attempts: history.attempts?.[path] ?? 0, status, relationships, introduced };
  });
}

// One answer for the author and the reviewer. Only the fixed rules can make it "mandatory_open"; an unfinished AI check is "incomplete", never
// "no changes needed"; advice that costs nothing is counted but never keeps the answer from being "no_changes_needed".
//   mandatory_open   a required rule fails (the submit is blocked)
//   incomplete       the AI check did not finish, so nothing can be said about the meaning yet
//   material_open    a specific deficiency that costs points is still there
//   no_changes_needed  the required rules pass, the check finished, and no material deficiency remains
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

module.exports = { isTrivialRewrite, assessCorrections, summarize, textOf, RANK };
