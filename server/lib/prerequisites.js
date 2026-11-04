// A subject's prerequisites (the course_prerequisites table, see db/prerequisites-ddl.js) as the API and the syllabus form read them.
//   loadPrerequisites(db, courseIds) -> Map course id -> [{ position, courseId, code, title, label }] in printed order
// A linked prerequisite shows the subject's code as it is now. Before migrate-prerequisites has run the table is missing: every subject then
// has no prerequisites set, and the form's Pre-requisite field stays as the author typed it.
const { prerequisiteText } = require('./curriculumImport');

async function loadPrerequisites(db, courseIds) {
  const out = new Map();
  if (!courseIds.length) return out;
  let rows;
  try {
    [rows] = await db.query(
      `SELECT q.course_id, q.position, q.prereq_course_id, q.label, c.code, c.title
       FROM course_prerequisites q LEFT JOIN courses c ON c.course_id = q.prereq_course_id
       WHERE q.course_id IN (?) ORDER BY q.course_id, q.position`, [courseIds]);
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') return out;
    throw error;
  }
  rows.forEach((r) => {
    const list = out.get(r.course_id) || [];
    list.push({ position: r.position, courseId: r.prereq_course_id, code: r.code || r.label, title: r.title || '', label: r.label });
    out.set(r.course_id, list);
  });
  return out;
}

// { prerequisites, prerequisiteText } for one subject: the text is null when nothing is set.
const describe = (items) => ({ prerequisites: items || [], prerequisiteText: prerequisiteText(items || []) });

module.exports = { loadPrerequisites, describe };
