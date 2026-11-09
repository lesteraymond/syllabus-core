'use strict';
// A subject's place in the curriculum, set by an administrator: academic year, semester, year level (1-4) and pre-requisite. Faculty cannot change these:
// routes/syllabusContent.js copies them into a syllabus's Step 1 on every save (applyTerm). A subject without them (created before this existed) leaves Step 1 editable.
const { httpError } = require('./http');

const SEMESTERS = ['1st Semester', '2nd Semester', 'Summer']; // Summer: some official curricula have a summer term (e.g. BSIT-Cyber Security 2025-2026, 3rd year); deadlines already use the same three
const YEAR_LEVELS = [1, 2, 3, 4];
const YEAR_LABEL = /^(\d{4})[–-](\d{4})$/;
const TERM_COLUMNS = 'c.academic_year, c.semester, c.year_level, c.prerequisite';
const NO_PREREQUISITE = 'None'; // what a syllabus shows for a subject without a pre-requisite

// The label an academic year is stored under, built from its first year: 2027 -> "2027–2028" (en dash, as everywhere in the application).
const labelOf = (startYear) => `${startYear}–${startYear + 1}`;
function parseYearLabel(value) {
  const m = YEAR_LABEL.exec(String(value || '').trim());
  if (!m || Number(m[2]) !== Number(m[1]) + 1) return null;
  return { label: labelOf(Number(m[1])), startYear: Number(m[1]) };
}

const termOf = (row) => ({
  academicYear: (row && row.academic_year) || null,
  semester: (row && row.semester) || null,
  yearLevel: row && row.year_level != null ? Number(row.year_level) : null,
  prerequisite: (row && row.prerequisite) || null,
});
const hasTerm = (term) => !!term && (!!term.academicYear || !!term.semester || term.yearLevel != null || !!term.prerequisite);
// The administrator entered the subject's term (the automatic academic-year stamp alone is not a set-up): only then is an empty pre-requisite "None".
const setUp = (term) => !!term && (!!term.semester || term.yearLevel != null || !!term.prerequisite);

// Run a query that mentions the new columns; on a database that has not had `npm run migrate-subject-term` yet, run the old form instead (term empty).
async function withTermFallback(db, withTerm, withoutTerm, params) {
  try { return await db.query(withTerm, params); } catch (error) { if (error && error.code === 'ER_BAD_FIELD_ERROR') return db.query(withoutTerm, params); throw error; }
}
// The same for several optional column groups, newest first: each query is tried in turn while the database lacks a column (the subject's curriculum year, then its term).
async function withColumnFallbacks(db, queries, params) {
  for (let i = 0; i < queries.length - 1; i += 1) {
    try { return await db.query(queries[i], params); } catch (error) { if (!(error && error.code === 'ER_BAD_FIELD_ERROR')) throw error; }
  }
  return db.query(queries[queries.length - 1], params);
}

// The term fields of a request body. None sent -> null (leave the subject as it is). Any sent -> the academic year, semester and year level are needed and
// must be valid; the pre-requisite is optional (many subjects have none): left empty it is stored as nothing, and the syllabus shows "None" (applyTerm).
async function parseTerm(db, body) {
  const b = body || {};
  const sent = ['academicYear', 'semester', 'yearLevel', 'prerequisite'].some((k) => b[k] !== undefined && b[k] !== null && b[k] !== '');
  if (!sent) return null;
  const year = parseYearLabel(b.academicYear);
  if (!year) throw httpError(400, 'Choose the academic year.');
  try {
    const [rows] = await db.query('SELECT 1 FROM academic_years WHERE label = ?', [year.label]);
    if (!rows.length) throw httpError(400, `The academic year ${year.label} has not been added yet.`);
  } catch (error) { if (error && error.code === 'ER_NO_SUCH_TABLE') throw httpError(503, 'Run npm run migrate-subject-term before setting academic years.'); throw error; }
  if (!SEMESTERS.includes(b.semester)) throw httpError(400, 'Choose the semester (1st Semester, 2nd Semester or Summer).');
  const level = Number(b.yearLevel);
  if (!YEAR_LEVELS.includes(level)) throw httpError(400, 'Choose the year level (1 to 4).');
  const prerequisite = typeof b.prerequisite === 'string' ? b.prerequisite.trim() : '';
  if (prerequisite.length > 255) throw httpError(400, 'The pre-requisite is too long (max 255 characters).');
  return { academicYear: year.label, semester: b.semester, yearLevel: level, prerequisite: prerequisite || null };
}

async function saveTerm(db, courseId, term) {
  try { await db.query('UPDATE courses SET academic_year = ?, semester = ?, year_level = ?, prerequisite = ? WHERE course_id = ?', [term.academicYear, term.semester, term.yearLevel, term.prerequisite, courseId]); }
  catch (error) { if (error && error.code === 'ER_BAD_FIELD_ERROR') throw httpError(503, "Run npm run migrate-subject-term before setting a subject's term."); throw error; }
}

// Step 1 values the administrator owns (pre-requisite, year level, semester). Called with the saved syllabus meta and the course's term; returns the meta with those values forced.
function applyTerm(meta, term) {
  if (!meta || !hasTerm(term)) return meta;
  // a subject the administrator SET UP (semester, year level or pre-requisite entered) without a pre-requisite has none: the syllabus says so, and faculty
  // cannot type one. The academic year alone does not count: every subject of a catalog year is stamped with it automatically (routes/courses.js), so a
  // subject whose term was never set keeps the pre-requisite as typed, as before v1.73.3. Nothing is invented for it.
  if (term.prerequisite) meta.prereq = term.prerequisite;
  else if (setUp(term)) meta.prereq = NO_PREREQUISITE;
  if (term.yearLevel != null) meta.yearLevel = String(term.yearLevel);
  // the academic year is NOT forced: a syllabus belongs to the academic year it was created in (syllabi.academic_year, lib/academicYear.js), not to the subject's year
  if (term.semester) meta.semester = term.semester;
  return meta;
}

module.exports = { SEMESTERS, YEAR_LEVELS, TERM_COLUMNS, labelOf, parseYearLabel, termOf, hasTerm, setUp, withTermFallback, withColumnFallbacks, parseTerm, saveTerm, applyTerm };
