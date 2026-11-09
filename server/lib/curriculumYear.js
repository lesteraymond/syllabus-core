'use strict';
// A subject's CURRICULUM YEAR: the curriculum (the program's approved course list, for example the BSIT 2022-2023 curriculum) the subject is taught under. It is NOT the
// academic year: the 2026–2027 catalog can hold subjects of the 2022-2023 and the 2025-2026 curricula side by side. Set by an administrator; optional, so subjects made
// before it existed keep working. Stored in courses.curriculum_year as "YYYY-YYYY" with a plain hyphen, the form the approved curricula use
// (syllabus_check_curricula.curriculum_year) and the syllabus form's Curriculum year field. Added by `npm run migrate-curriculum-year`; until then the column is absent and
// everything here degrades to "not set" (reads) or a 503 that names the migration (writes).
const { httpError } = require('./http');

const COLUMN = 'c.curriculum_year';
const PATTERN = /^(\d{4})\s*[-–—]\s*(\d{4})$/;
const MIGRATION_MESSAGE = "Run npm run migrate-curriculum-year before setting a subject's curriculum year.";

// '2022-2023', '2022–2023' or '2022 - 2023' -> '2022-2023'. Anything else -> null.
function normalizeCurriculumYear(value) {
  const m = PATTERN.exec(String(value == null ? '' : value).trim());
  if (!m) return null;
  const start = Number(m[1]), end = Number(m[2]);
  if (end !== start + 1 || start < 1950 || start > 2200) return null;
  return `${start}-${end}`;
}

// The curriculum year of a request body: undefined when not sent (leave the subject as it is), null when sent empty (clear it), else the normalized value. 400 when invalid.
function parseCurriculumYear(body) {
  const raw = body ? body.curriculumYear : undefined;
  if (raw === undefined) return undefined;
  if (raw === null || (typeof raw === 'string' && !raw.trim())) return null;
  if (typeof raw !== 'string') throw httpError(400, 'Enter the curriculum year as YYYY-YYYY, for example 2022-2023.');
  const year = normalizeCurriculumYear(raw);
  if (!year) throw httpError(400, 'Enter the curriculum year as YYYY-YYYY, for example 2022-2023.');
  return year;
}

const curriculumYearOf = (row) => (row && row.curriculum_year) || null;

async function saveCurriculumYear(db, courseId, year) {
  try { await db.query('UPDATE courses SET curriculum_year = ? WHERE course_id = ?', [year, courseId]); }
  catch (error) { if (error && error.code === 'ER_BAD_FIELD_ERROR') throw httpError(503, MIGRATION_MESSAGE); throw error; }
}

module.exports = { COLUMN, MIGRATION_MESSAGE, normalizeCurriculumYear, parseCurriculumYear, curriculumYearOf, saveCurriculumYear };
