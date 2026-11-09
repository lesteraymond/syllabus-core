'use strict';
// A warning for the administrator, never a block: the approved curriculum lists this subject with a different pre-requisite or year level than the one just entered.
// The official submit check (CUR-FIELD in lib/syllabuscheck/engine.js) compares a syllabus with that approved curriculum exactly, so a difference here would stop faculty at
// submit until the curriculum or the subject is corrected. This only tells the administrator early; it changes no rule and no score.
const { normalizeCurriculumYear } = require('./curriculumYear');
const normCode = (value) => String(value == null ? '' : value).trim().replace(/\s+/g, ' ').toUpperCase();

// rows: approved syllabus_check_curricula rows ({ program_code, curriculum_year, courses_json }). Returns null when nothing differs or nothing is comparable.
// curriculumYear: the subject's own curriculum year (lib/curriculumYear.js). When it is set, only that curriculum is compared; when it is not, every approved curriculum
// of the program is (the behaviour before subjects had a curriculum year).
function curriculumNote({ programCode, code, term, curriculumYear = null }, rows) {
  if (!term || (!term.prerequisite && term.yearLevel == null)) return null;
  const differences = [];
  for (const row of rows || []) {
    if (row.program_code !== programCode) continue;
    if (curriculumYear && normalizeCurriculumYear(row.curriculum_year) !== curriculumYear) continue;
    let courses; try { courses = JSON.parse(row.courses_json); } catch { continue; }
    const official = (courses || []).find((c) => normCode(c.code) === normCode(code));
    if (!official) continue;
    if (term.prerequisite && String(official.prereq == null ? '' : official.prereq) !== term.prerequisite) differences.push({ field: 'prerequisite', entered: term.prerequisite, curriculum: String(official.prereq == null ? '' : official.prereq), curriculumYear: row.curriculum_year });
    if (term.yearLevel != null && official.yearLevel != null && Number(official.yearLevel) !== term.yearLevel) differences.push({ field: 'yearLevel', entered: term.yearLevel, curriculum: Number(official.yearLevel), curriculumYear: row.curriculum_year });
  }
  return differences.length ? { differences } : null;
}

async function approvedCurricula(db) {
  try { const [rows] = await db.query("SELECT program_code, curriculum_year, courses_json FROM syllabus_check_curricula WHERE status = 'approved'"); return rows; }
  catch (error) { if (error && error.code === 'ER_NO_SUCH_TABLE') return []; throw error; }
}

module.exports = { curriculumNote, approvedCurricula };
