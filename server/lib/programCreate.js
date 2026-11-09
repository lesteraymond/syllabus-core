'use strict';
// Creating a program: the checks on the typed code and name, and the insert of its EGAs and Program Outcomes. One place, used by POST /api/programs (the Add program button)
// and by POST /api/courses (a subject whose program does not exist yet), so both accept and refuse exactly the same input.
const { httpError } = require('./http');
const { PROGRAM_CODE } = require('./programs');
const { parseEgas, parsePos } = require('./programOutcomesInput');

// { code, name } as typed -> { code, name } cleaned (code upper-cased and trimmed, name trimmed with repeated spaces collapsed), or a 400.
function cleanProgram({ code, name }) {
  const progCode = String(code || '').trim().toUpperCase();
  if (!PROGRAM_CODE.test(progCode)) throw httpError(400, 'A program code uses 2 to 20 letters, digits or hyphens, for example BSIT.');
  const clean = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  if (!clean) throw httpError(400, "Enter the program's full name");
  if (clean.length < 2 || !/[A-Za-z].*[A-Za-z]/.test(clean)) throw httpError(400, "The program's name needs at least two letters");
  if (clean.length > 255) throw httpError(400, 'The program name is too long (max 255 characters)');
  return { code: progCode, name: clean };
}

// The EGAs and Program Outcomes typed for a new program, validated (null when none were sent). Nothing is written.
function parseTypedOutcomes(outcomes, programCode) {
  if (outcomes === undefined || outcomes === null) return null;
  const egas = parseEgas(outcomes.egas);
  return { egas, pos: parsePos(outcomes.pos === undefined ? [] : outcomes.pos, new Set(egas.map((e) => e.no)), programCode) };
}

// Writes the validated EGAs and POs of a NEW program (inside the caller's transaction).
async function insertOutcomes(conn, programId, typed) {
  await conn.query('INSERT INTO program_egas (program_id, ega_no, name, short_name) VALUES ?', [typed.egas.map((e) => [programId, e.no, e.name, e.short])]);
  if (typed.pos.length) await conn.query('INSERT INTO program_outcomes (program_id, po_no, short_name, outcome_text, ega_nos) VALUES ?', [typed.pos.map((p) => [programId, p.no, p.short, p.text, p.egas.join(',')])]);
}

module.exports = { cleanProgram, parseTypedOutcomes, insertOutcomes };
