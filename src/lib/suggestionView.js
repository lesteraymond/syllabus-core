// Suggested fixes as the builder uses them. A suggestion is { id, kind, label, why, rules, covers, changes: [{ title?, before, after }], ops, expect }
// (server/lib/compliance/suggest.js and fixes.js); ops and expect are formOps.js operations and the text they were written for.
import { applyOps, holds } from './formOps.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

// What accepting `suggestion` on `content` would do, without touching it: { ok: false } when the form no longer holds the text it was
// written for or an operation does not fit, else { ok: true, undo } with the operations that put the form back.
export function trial(content, suggestion) {
  if (!holds(content, suggestion.expect)) return { ok: false };
  const copy = clone(content);
  const undo = applyOps(copy, suggestion.ops);
  return undo ? { ok: true, undo } : { ok: false };
}

// The operations of `list` that still fit, applied one after another to `content` (changed in place). Returns what was applied and the undo
// operations of each, so each can be undone on its own.
export function applyAll(content, list) {
  const applied = [];
  list.forEach((s) => {
    if (!holds(content, s.expect)) return;
    const undo = applyOps(content, s.ops);
    if (undo) applied.push({ id: s.id, undo });
  });
  return applied;
}

// Rejections are remembered per syllabus (this browser only), by suggestion id: the id is made from what the suggestion is about, so a
// rejected suggestion is not offered again until that part of the form changes.
const KEY = (syllabusId) => 'scms.suggest.rejected.' + syllabusId;
export function loadRejected(syllabusId, storage = globalThis.localStorage) {
  try { return new Set(JSON.parse(storage.getItem(KEY(syllabusId)) || '[]')); } catch { return new Set(); }
}
export function saveRejected(syllabusId, set, storage = globalThis.localStorage) {
  try { storage.setItem(KEY(syllabusId), JSON.stringify([...set].slice(-300))); } catch { /* the choice is simply not remembered */ }
}
