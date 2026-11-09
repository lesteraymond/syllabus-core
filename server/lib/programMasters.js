'use strict';
// A program's masters (its EGAs and Program Outcomes, plus the school's vision and mission) and how they reach the subjects of the program.
//   The masters are what the AI Checker compares every syllabus with. A subject keeps its own copy (courses.standards_json); that copy is filled
//   - when the subject is created (lib/subjectStandards.js standardsFromMasters), so the builder shows what the administrator set up for the program, and
//   - when the administrator asks for it (syncSubjects below), never automatically, so an existing subject never changes under its authors.
const { loadProgramEgas } = require('./programEgas');
const { loadOutcomes } = require('./institution');
const { loadClos } = require('./courses');
const { readStandards, applyMasters } = require('./subjectStandards');

const numbers = (s) => String(s || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);

async function loadMasters(db, programId) {
  const egas = await loadProgramEgas(db, programId);
  if (!egas.length) return { institution: null, egas: [], pos: [] };
  const [pos] = await db.query('SELECT po_no, short_name, outcome_text, ega_nos FROM program_outcomes WHERE program_id = ? ORDER BY po_no', [programId]);
  const school = await loadOutcomes(db);
  return {
    institution: { vision: school.vision, mission: school.mission },
    egas,
    pos: pos.map((p) => ({ no: p.po_no, short: p.short_name, text: p.outcome_text, egas: numbers(p.ega_nos) })),
  };
}

// Copies the masters into every subject of the program (inside the caller's transaction `conn`). A subject a CLO still depends on is skipped with the reason.
// Returns { subjects, updated, unchanged, skipped: [{ id, code, reason }] }.
async function syncSubjects(conn, programId) {
  const masters = await loadMasters(conn, programId);
  if (!masters.egas.length) return { masters: false, subjects: 0, updated: 0, unchanged: 0, skipped: [] };
  const [rows] = await conn.query('SELECT course_id, code, standards_json FROM courses WHERE program_id = ? ORDER BY code FOR UPDATE', [programId]);
  const out = { masters: true, subjects: rows.length, updated: 0, unchanged: 0, skipped: [] };
  for (const row of rows) {
    const result = applyMasters(readStandards(row.standards_json), masters, await loadClos(conn, row.course_id));
    if (result.conflict) { out.skipped.push({ id: row.course_id, code: row.code, reason: result.conflict }); continue; }
    if (!result.changed.length) { out.unchanged += 1; continue; }
    await conn.query('UPDATE courses SET standards_json = ? WHERE course_id = ?', [JSON.stringify(result.next), row.course_id]);
    out.updated += 1;
  }
  return out;
}

module.exports = { loadMasters, syncSubjects };
