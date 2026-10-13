// How a syllabus is named in lists a reviewer reads: the faculty member, the program and the subject. One place for the SQL that joins
// them and for the fallbacks, used by the compliance routes and the review route.
//
// A syllabus from the builder has a catalog subject (courses -> programs). One uploaded as a file may only have a curriculum, and an
// old one may have neither, in which case the program reads "No program".
//
// LABEL_SQL continues a SELECT list and supplies the FROM: `SELECT s.syllabus_id, ... , ${LABEL_SQL} WHERE s.syllabus_id = ?`
const LABEL_SQL = `u.first_name, u.last_name, c.title AS course_title, p.code AS program_code, p.name AS program_name, cu.program_name AS curriculum_program
  FROM syllabi s JOIN users u ON u.user_id = s.user_id LEFT JOIN courses c ON c.course_id = s.course_id
  LEFT JOIN programs p ON p.program_id = c.program_id LEFT JOIN curriculum cu ON cu.curriculum_id = s.curriculum_id`;

// `r` is a row selected with LABEL_SQL (and s.title); `content` is the parsed form, if any (its program is the fallback).
function labelsOf(r, content) {
  const metaProgram = content && content.meta && typeof content.meta.program === 'string' ? content.meta.program : '';
  const code = r.program_code || metaProgram || r.curriculum_program || '';
  return {
    facultyName: [r.first_name, r.last_name].filter(Boolean).join(' '),
    programCode: code,
    programName: r.program_name || (code ? '' : 'No program'),
    courseTitle: r.course_title || r.title || '',
  };
}

module.exports = { LABEL_SQL, labelsOf };
