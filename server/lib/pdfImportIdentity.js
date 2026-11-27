const { subjectReference } = require('./subjectReference');
// Read-only identity context for import preview. Never reads/writes outcomes.
async function contextFor(db, courseId) {
  const [courses] = await db.query('SELECT c.course_id, c.code, c.title, p.code AS program_code FROM courses c JOIN programs p ON p.program_id = c.program_id WHERE c.course_id = ?', [courseId]);
  const course = courses[0];
  if (!course) return { selected: null, curricula: [] };
  // The PDF is compared with the administrator's subject, as the AI Checker does (lib/subjectReference.js): no printed curriculum is needed for a new program or year.
  const reference = await subjectReference(db, { meta: { courseId: course.course_id } });
  return {
    selected: { id: course.course_id, program: course.program_code, code: course.code, title: course.title },
    curricula: reference ? [{ id: reference.record.id, origin: 'admin', program: reference.record.program, curriculumYear: reference.subject.curriculumYear || null, status: 'approved', courses: reference.record.courses.map(c => ({ code: c.code, title: c.title })) }] : [],
  };
}
module.exports = { contextFor };
