'use strict';
// Validation of a program's EGAs and Program Outcomes as typed by an administrator. One place for the rules, used by the edit routes (routes/programs.js) and by
// the creation of a new program together with its first subject (routes/courses.js), so both accept and refuse exactly the same input.
const { httpError } = require('./http');

const text = (v, max, what) => {
  if (typeof v !== 'string' || !v.trim()) throw httpError(400, `${what} is required`);
  if (v.length > max) throw httpError(400, `${what} is too long (max ${max} characters)`);
  return v.trim();
};

// [{ no, name, short }] -> [{ no, name, short }] (trimmed). 1 to 20 EGAs, numbers 1 to 99, none twice.
function parseEgas(egas) {
  if (!Array.isArray(egas) || !egas.length || egas.length > 20) throw httpError(400, 'Provide 1 to 20 EGAs');
  const seen = new Set();
  return egas.map((e, i) => {
    const no = Number(e && e.no);
    if (!Number.isInteger(no) || no < 1 || no > 99 || seen.has(no)) throw httpError(400, `EGA ${i + 1} needs a unique number from 1 to 99`);
    seen.add(no);
    return { no, name: text(e.name, 255, `EGA ${no} name`), short: text(e.short, 120, `EGA ${no} short name`) };
  });
}

// [{ no, short, text, egas }] -> [{ no, short, text, egas: sorted unique }]. Up to 50 outcomes; a PO may map only to EGAs in `validEgaNos` (a Set of numbers).
function parsePos(pos, validEgaNos, programCode = 'this program') {
  if (!Array.isArray(pos) || pos.length > 50) throw httpError(400, 'Provide a list of up to 50 program outcomes');
  const seen = new Set();
  return pos.map((p, i) => {
    const no = Number(p && p.no);
    if (!Number.isInteger(no) || no < 1 || no > 99 || seen.has(no)) throw httpError(400, `Outcome ${i + 1} needs a unique number from 1 to 99`);
    seen.add(no);
    if (typeof p.short !== 'string' || !p.short.trim() || p.short.length > 120) throw httpError(400, `PO ${no} needs a short name (max 120 characters)`);
    if (typeof p.text !== 'string' || !p.text.trim() || p.text.length > 2000) throw httpError(400, `PO ${no} needs its statement (max 2000 characters)`);
    const egas = Array.isArray(p.egas) ? [...new Set(p.egas.map(Number))] : [];
    if (egas.some((e) => !validEgaNos.has(e))) throw httpError(400, `PO ${no} maps to an EGA that does not exist in ${programCode}`);
    return { no, short: p.short.trim(), text: p.text.trim(), egas: egas.sort((a, b) => a - b) };
  });
}

module.exports = { parseEgas, parsePos };
