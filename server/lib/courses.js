const { readStandards } = require('./subjectStandards');
const { loadPrerequisites, describe } = require('./prerequisites');
// Course catalog helpers. A course's learning outcomes (CLOs) are constant data, like EGAs and program outcomes:
// only administrators edit them. A CLO's tag id inside syllabus content is 'c<clo_id>' (stable across edits).
const LEVELS = ['Introductory', 'Enabling', 'Demonstrating', 'Integration of Values'];

const cloKey = (id) => 'c' + id;
const parseCloKey = (key) => (/^c\d+$/.test(String(key)) ? Number(String(key).slice(1)) : null);
const parseNums = (s) => String(s || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);

// CLOs of a course in the shape the builder's rules module works with.
async function loadClos(db, courseId) {
  const [rows] = await db.query('SELECT clo_id, title, clo_level, statement, ega_nos, po_nos FROM course_clos WHERE course_id = ? ORDER BY sort_order, clo_id', [courseId]);
  return rows.map((r) => ({ id: cloKey(r.clo_id), title: r.title, level: r.clo_level, statement: r.statement, egas: parseNums(r.ega_nos), pos: parseNums(r.po_nos) }));
}

// The credit units the curriculum prints for a subject: { lecture, lab }, or null when they have not been loaded.
const unitsOf = (c) => (c.lecture_units === null || c.lecture_units === undefined || c.lab_units === null || c.lab_units === undefined ? null : { lecture: Number(c.lecture_units), lab: Number(c.lab_units) });

async function loadCourse(db, courseId, { lock = false } = {}) {
  const [rows] = await db.query(
    `SELECT c.course_id, c.code, c.title, c.clos_version, p.program_id, p.code AS program_code, p.name AS program_name, c.standards_json, c.lecture_units, c.lab_units
     FROM courses c JOIN programs p ON p.program_id = c.program_id WHERE c.course_id = ?${lock ? ' FOR UPDATE' : ''}`, [courseId]);
  const c = rows[0];
  if (!c) return null;
  return { id: c.course_id, code: c.code, title: c.title, program: { id: c.program_id, code: c.program_code, name: c.program_name }, clos: await loadClos(db, c.course_id), version: c.clos_version || 1, standards: readStandards(c.standards_json), units: unitsOf(c), ...describe((await loadPrerequisites(db, [c.course_id])).get(c.course_id)) };
}

module.exports = { LEVELS, cloKey, parseCloKey, parseNums, loadClos, loadCourse };
