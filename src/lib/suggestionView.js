// Suggested fixes as the builder uses them. A suggestion is { id, kind, label, why, rules, covers, changes: [{ title?, before, after }], ops, expect }
// (server/lib/compliance/suggest.js and fixes.js); ops and expect are formOps.js operations and the text they were written for.
import { applyOps, holds } from './formOps.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

// Whether the suggested text of change `i` can be edited by the author before accepting: the operation at the same position writes exactly that
// text, as a set of a text field or as the text of an inserted row. Other suggestions (merged grading, reordered weeks, removals) stay as they are.
export function editableAt(suggestion, i) {
  const ops = suggestion.ops || [];
  const changes = suggestion.changes || [];
  if (ops.length !== changes.length) return null;
  const op = ops[i];
  const after = changes[i] && changes[i].after;
  if (!op || typeof after !== 'string') return null;
  if (op.op === 'set' && op.value === after) return 'set';
  if (op.op === 'insert' && op.value && op.value.t === after) return 'insert';
  return null;
}

// `suggestion` with the author's edited texts ({ changeIndex: text }) written into its operations. An edit that is empty or the same as the
// suggestion is ignored, and so is one for a change that cannot be edited.
export function withEdits(suggestion, edits) {
  const keys = Object.keys(edits || {}).filter((k) => {
    const i = Number(k);
    const text = String(edits[k]).trim();
    return editableAt(suggestion, i) && text && text !== suggestion.changes[i].after;
  });
  if (!keys.length) return suggestion;
  const copy = clone(suggestion);
  keys.forEach((k) => {
    const i = Number(k);
    const text = String(edits[k]).trim();
    if (editableAt(suggestion, i) === 'set') copy.ops[i].value = text; else copy.ops[i].value.t = text;
    copy.changes[i].after = text;
  });
  return copy;
}

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
