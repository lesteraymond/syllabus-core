// Read-only identity context for import preview. Never reads/writes outcomes.
async function contextFor(db, courseId) {
  const [courses] = await db.query('SELECT c.course_id, c.code, c.title, p.code AS program_code FROM courses c JOIN programs p ON p.program_id = c.program_id WHERE c.course_id = ?', [courseId]);
  const course = courses[0];
  if (!course) return { selected: null, curricula: [] };
  let rows;
  try {
    [rows] = await db.query("SELECT reference_id, program_code, curriculum_year, courses_json FROM syllabus_check_curricula WHERE program_code = ? AND status = 'approved' ORDER BY reference_id", [course.program_code]);
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
    rows = []; // preview remains available; Apply explains missing context
  }
  return {
    selected: { id: course.course_id, program: course.program_code, code: course.code, title: course.title },
    curricula: rows.map(row => ({ id: row.reference_id, program: row.program_code, curriculumYear: row.curriculum_year, status: 'approved', courses: JSON.parse(row.courses_json).map(c => ({ code: c.code, title: c.title })) })),
  };
}
module.exports = { contextFor };
