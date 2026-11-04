const { readStandards } = require('./subjectStandards');
const { inheritStandards } = require('./programs');
const { sameBasis } = require('./programPoReferences');
const { httpError } = require('./http');
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

async function loadCourse(db, courseId, { lock = false } = {}) {
  const [rows] = await db.query(
    `SELECT c.course_id, c.code, c.title, c.clos_version, p.program_id, p.code AS program_code, p.name AS program_name, c.standards_json
     FROM courses c JOIN programs p ON p.program_id = c.program_id WHERE c.course_id = ?${lock ? ' FOR UPDATE' : ''}`, [courseId]);
  const c = rows[0];
  if (!c) return null;
  const original = readStandards(c.standards_json), standards = await inheritStandards(db,c.program_id,original), clos = await loadClos(db,c.course_id);
  if(standards.poReference && clos.some(clo=>clo.pos.length) && !sameBasis(original.pos,standards.pos)) throw httpError(409,'Catalog CLO mappings use an older PO reference. Review them before selecting this subject; no historical mapping was changed.',{code:'catalog_po_reference_review_required',courseId:c.course_id});
  return { id: c.course_id, code: c.code, title: c.title, program: { id: c.program_id, code: c.program_code, name: c.program_name }, clos, version: c.clos_version || 1, standards };
}

module.exports = { LEVELS, cloKey, parseCloKey, parseNums, loadClos, loadCourse };
