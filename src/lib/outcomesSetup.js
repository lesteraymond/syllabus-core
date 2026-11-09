// Setting up a program's EGAs (expected graduate attributes) and Program Outcomes (POs). A new program is created with none; the administrator sets them in the
// Outcomes dialog (src/components/ProgramOutcomesEditor.jsx). These are the pure parts: which programs still need setting up, the editor rows, and the checks the server
// also makes (server/routes/programs.js), so a mistake is explained before the request.

// A program "needs setup" when it has no EGAs or no Program Outcomes of its own. A specialization (it inherits both from another program) is set up there instead.
export const needsSetup = (program) => !!program && !program.inheritedFrom && !(Number(program.egaCount) > 0 && Number(program.outcomeCount) > 0);
export const programsNeedingSetup = (programs) => (programs || []).filter(needsSetup);

export const LIMITS = { egas: 20, pos: 50, egaName: 255, short: 120, poText: 2000 };

const numbers = (rows) => rows.map((r) => Number(r.no)).filter((n) => Number.isInteger(n));
// the next free number for a new row
export const nextNo = (rows) => String((numbers(rows).length ? Math.max(...numbers(rows)) : 0) + 1);

// server data -> editor rows (numbers as strings, because they are typed into inputs)
export const egaRows = (egas) => (egas || []).map((e) => ({ no: String(e.no), name: e.name || '', short: e.short || '' }));
export const poRows = (pos) => (pos || []).map((p) => ({ no: String(p.no), short: p.short || '', text: p.text || '', egas: (p.egas || []).map(Number) }));
export const blankEga = (rows) => ({ no: nextNo(rows), name: '', short: '' });
export const blankPo = (rows) => ({ no: nextNo(rows), short: '', text: '', egas: [] });

// editor rows -> what the server expects
export const egaPayload = (rows) => rows.map((r) => ({ no: Number(r.no), name: r.name.trim(), short: r.short.trim() }));
export const poPayload = (rows) => rows.map((r) => ({ no: Number(r.no), short: r.short.trim(), text: r.text.trim(), egas: [...new Set(r.egas.map(Number))].sort((a, b) => a - b) }));

// A problem is { key, params } (an i18n key and its values) or null when the rows can be saved.
const badNumber = (rows) => {
  const seen = new Set();
  for (let i = 0; i < rows.length; i += 1) {
    const n = Number(rows[i].no);
    if (!/^\d+$/.test(String(rows[i].no).trim()) || !Number.isInteger(n) || n < 1 || n > 99 || seen.has(n)) return { key: 'outcomes.err.number', params: { row: i + 1 } };
    seen.add(n);
  }
  return null;
};
export function checkEgas(rows) {
  if (!rows.length) return { key: 'outcomes.err.noEgas', params: {} };
  if (rows.length > LIMITS.egas) return { key: 'outcomes.err.tooManyEgas', params: { max: LIMITS.egas } };
  const number = badNumber(rows);
  if (number) return number;
  for (const r of rows) {
    if (!r.name.trim() || !r.short.trim()) return { key: 'outcomes.err.egaText', params: { no: r.no } };
    if (r.name.length > LIMITS.egaName || r.short.length > LIMITS.short) return { key: 'outcomes.err.egaLong', params: { no: r.no } };
  }
  return null;
}
// `egas` are the program's SAVED EGAs (a PO can only map to those)
export function checkPos(rows, egas) {
  if (rows.length > LIMITS.pos) return { key: 'outcomes.err.tooManyPos', params: { max: LIMITS.pos } };
  const number = badNumber(rows);
  if (number) return number;
  const known = new Set((egas || []).map((e) => Number(e.no)));
  for (const r of rows) {
    if (!r.short.trim() || !r.text.trim()) return { key: 'outcomes.err.poText', params: { no: r.no } };
    if (r.short.length > LIMITS.short || r.text.length > LIMITS.poText) return { key: 'outcomes.err.poLong', params: { no: r.no } };
    if (r.egas.some((n) => !known.has(Number(n)))) return { key: 'outcomes.err.poEga', params: { no: r.no } };
  }
  return null;
}

// The same rows with and without edits, so Save is offered only for a real change.
export const sameRows = (a, b) => JSON.stringify(a) === JSON.stringify(b);
