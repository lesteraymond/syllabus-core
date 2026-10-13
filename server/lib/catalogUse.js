// Which EGAs and POs are still in use. EGAs and POs are referenced by number inside CLO tags (course_clos.ega_nos /
// po_nos) and in each PO's own EGA mapping, with no database link, so removing one would silently break those tags.
// The program and institution PUT routes call these to refuse that (409) and name what still uses the item.
// EGAs and POs belong to a program, so usage is always looked up inside that program only.
const { parseNums } = require('./courses');

const addTo = (map, no, label) => {
  if (!map.has(no)) map.set(no, []);
  const list = map.get(no);
  if (!list.includes(label)) list.push(label);
};

// no -> [labels of what uses it]. `clos` rows: { code, ega_nos, po_nos }; `pos` rows: { po_no, program_code, ega_nos }.
function egaUsage(clos, pos) {
  const map = new Map();
  clos.forEach((c) => parseNums(c.ega_nos).forEach((n) => addTo(map, n, c.code)));
  pos.forEach((p) => parseNums(p.ega_nos).forEach((n) => addTo(map, n, `PO ${p.po_no} (${p.program_code})`)));
  return map;
}
function poUsage(clos) {
  const map = new Map();
  clos.forEach((c) => parseNums(c.po_nos).forEach((n) => addTo(map, n, c.code)));
  return map;
}

// Messages for the removed numbers that are still used, e.g. "EGA 2 is used by IT 204, PO 4 (BSIT)".
function inUseMessages(kind, removed, usage) {
  return removed.filter((n) => usage.has(n)).map((n) => {
    const who = usage.get(n);
    return `${kind} ${n} is used by ${who.slice(0, 5).join(', ')}${who.length > 5 ? ` and ${who.length - 5} more` : ''}`;
  });
}
const inUseError = (messages) => `${messages.join('; ')}. Remove those tags first.`;

async function closRows(db, programId) {
  const [rows] = await db.query('SELECT c.code, k.ega_nos, k.po_nos FROM course_clos k JOIN courses c ON c.course_id = k.course_id WHERE c.program_id = ?', [programId]);
  return rows;
}

// EGAs of ONE program still used by a CLO of its subjects or by one of its POs.
async function egasInUse(db, programId) {
  const [pos] = await db.query('SELECT o.po_no, o.ega_nos, p.code AS program_code FROM program_outcomes o JOIN programs p ON p.program_id = o.program_id WHERE o.program_id = ?', [programId]);
  return egaUsage(await closRows(db, programId), pos);
}
// POs of ONE program still tagged on a CLO of its subjects.
async function posInUse(db, programId) { return poUsage(await closRows(db, programId)); }

// How many other subjects share a program's EGAs and POs (shown to the admin before they change them).
async function subjectsOf(db, programId) {
  const [rows] = await db.query('SELECT code FROM courses WHERE program_id = ? ORDER BY code', [programId]);
  return rows.map((r) => r.code);
}

module.exports = { egaUsage, poUsage, inUseMessages, inUseError, egasInUse, posInUse, subjectsOf };
