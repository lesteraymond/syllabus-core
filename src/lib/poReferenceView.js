// Pure helpers of the Admin reference panel (components/PoReferencePanel.jsx): the shape of a version comparison and of a change-log line. No network and no React, so they are tested on their
// own (poReferenceView.test.js).

// A server comparison ({ added, removed, changed }) as plain lines, in PO order.
export function diffLines(diff) {
  if (!diff) return [];
  return [...diff.added.map((p) => ({ kind: 'added', no: p.no, fields: ['text'] })), ...diff.removed.map((p) => ({ kind: 'removed', no: p.no, fields: ['text'] })), ...diff.changed.map((c) => ({ kind: 'changed', no: c.no, fields: c.fields }))].sort((a, b) => a.no - b.no);
}
export const shortHash = (hash) => String(hash || '').slice(0, 12);
const versionOf = (side) => (side && (side.version || side.id)) || null;
// One change-log entry ({ action, at, by, previous, next }) as the values of its line: which change, when, by whom, from which version to which.
export const changeLine = (c) => ({ key: 'poRef.change.' + c.action, date: c.at ? String(c.at).slice(0, 10) : '—', by: c.by || null, from: versionOf(c.previous), to: versionOf(c.next) });
