// Programs, their expected graduate attributes (EGAs) and their program outcomes (POs).
// Shared by routes/programs.js and the submit snapshot in routes/syllabusContent.js.
const { httpError } = require('./http');
const { loadProgramEgas } = require('./programEgas');

// `idOrCode` is the numeric program id or the program code (e.g. BSIT).
async function findProgram(db, idOrCode) {
  const key = String(idOrCode);
  const [rows] = /^\d+$/.test(key)
    ? await db.query('SELECT program_id, code, name, egas_version, pos_version FROM programs WHERE program_id = ?', [Number(key)])
    : await db.query('SELECT program_id, code, name, egas_version, pos_version FROM programs WHERE code = ?', [key.toUpperCase()]);
  if (rows[0]) return rows[0];
  // Old codes resolve to the same stable program ID; submitted content stays unchanged.
  if (!/^\d+$/.test(key)) {
    try {
      const [aliases] = await db.query('SELECT p.program_id, p.code, p.name, p.egas_version, p.pos_version FROM programs p JOIN program_code_aliases a ON a.program_id = p.program_id WHERE a.code = ? GROUP BY p.program_id, p.code, p.name, p.egas_version, p.pos_version', [key.toUpperCase()]);
      if (aliases.length === 1) return aliases[0];
    } catch (error) { if (error.code !== 'ER_NO_SUCH_TABLE') throw error; }
  }
  throw httpError(404, 'Program not found');
}

const parseEgas = (s) => String(s || '').split(',').map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0);

// { id, code, name, egas, pos, versions }. `egas` is the program's own list; `versions` are what a save must send back
// so that a save from an out-of-date screen is refused (see lib/programEgas.js isStale).
async function loadProgram(db, program) {
  const [pos] = await db.query('SELECT po_no, short_name, outcome_text, ega_nos FROM program_outcomes WHERE program_id = ? ORDER BY po_no', [program.program_id]);
  return {
    id: program.program_id,
    code: program.code,
    name: program.name,
    egas: await loadProgramEgas(db, program.program_id),
    pos: pos.map((p) => ({ no: p.po_no, short: p.short_name, text: p.outcome_text, egas: parseEgas(p.ega_nos) })),
    versions: { egas: program.egas_version || 1, pos: program.pos_version || 1 },
  };
}

const PROGRAM_CODE = /^[A-Z0-9-]{2,20}$/;

// Program names are compared ignoring case and repeated spaces, so "BS  Industrial engineering" is the same name as
// "BS Industrial Engineering".
const normalizeName = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Creates a program inside the caller's transaction (`conn`). The code is already trimmed and upper-cased. A new program has
// no EGAs or outcomes until an administrator configures them. A name already used by another program is refused. Returns its id. A concurrent creation of the same code is
// the unique key's job: it becomes a 409.
async function createProgram(conn, { code, name }) {
  const [named] = await conn.query('SELECT code, name FROM programs ORDER BY program_id FOR UPDATE');
  const taken = named.find((p) => normalizeName(p.name) === normalizeName(name));
  if (taken) throw httpError(409, `That name is already used by ${taken.code}.`);
  // Never recycle a code retained by historical records from another program.
  try {
    const [aliases] = await conn.query('SELECT program_id FROM program_code_aliases WHERE code = ? FOR UPDATE', [code]);
    if (aliases.length) throw httpError(409, 'That program code is reserved by existing records. Choose another code.');
  } catch (error) { if (error.code !== 'ER_NO_SUCH_TABLE') throw error; }
  let result;
  try {
    [result] = await conn.query('INSERT INTO programs (code, name) VALUES (?, ?)', [code, name]);
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') throw httpError(409, 'That program was just created. Try again.');
    throw err;
  }
  return result.insertId;
}

module.exports = { findProgram, loadProgram, parseEgas, createProgram, normalizeName, PROGRAM_CODE };
