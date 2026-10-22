'use strict';
// A student's enrolled subjects (read from the COR) tied to the catalog, so the student's views show the catalog's program, code, title and
// faculty instead of what the COR printed ("IT-401", "QUANTITATIVE METHODS ..."), and so each subject finds its approved syllabus.
//   matchCourses(db, subjects, programCode)   -> a course id (or null) for each { code, title }
//   syncEnrollments(db, userId, programCode)  links the student's unlinked enrollments to the catalog; returns how many it linked
//   enrolledSubjects(db, userId)              -> the student's subjects with their catalog subject, program and faculty
// A COR line matches a subject by code (spaces, hyphens and case ignored), else by exact title. A code can exist in several programs, so the
// subject of the student's own program wins; otherwise the one listed first.
const key = (s) => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');

// The program a section belongs to ("BSIT4B" is BSIT, "BSITCS4A" is BSIT-CS): the longest program code the section starts with.
function programOfSection(section, programCodes) {
  const s = key(section);
  return programCodes.filter((c) => s.startsWith(key(c))).sort((a, b) => key(b).length - key(a).length)[0] || null;
}

async function matchCourses(db, subjects, programCode = null) {
  const [courses] = await db.query('SELECT c.course_id, c.code, c.title, p.code AS program_code FROM courses c JOIN programs p ON p.program_id = c.program_id ORDER BY c.course_id');
  const pick = (map, k) => { const list = map.get(k) || []; return (list.find((c) => c.program_code === programCode) || list[0] || {}).course_id || null; };
  const group = (of) => courses.reduce((m, c) => m.set(of(c), [...(m.get(of(c)) || []), c]), new Map());
  const byCode = group((c) => key(c.code));
  const byTitle = group((c) => key(c.title));
  return subjects.map((s) => pick(byCode, key(s.code)) || pick(byTitle, key(s.title)));
}

async function syncEnrollments(db, userId, programCode = null) {
  const [rows] = await db.query('SELECT enrollment_id, subject_code, subject_title FROM student_enrollments WHERE user_id = ? AND course_id IS NULL', [userId]);
  if (!rows.length) return 0;
  const ids = await matchCourses(db, rows.map((r) => ({ code: r.subject_code, title: r.subject_title })), programCode);
  let linked = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if (!ids[i]) continue;
    await db.query('UPDATE student_enrollments SET course_id = ? WHERE enrollment_id = ?', [ids[i], rows[i].enrollment_id]);
    linked += 1;
  }
  return linked;
}

async function enrolledSubjects(db, userId) {
  const [rows] = await db.query(
    `SELECT e.subject_code, e.subject_title, e.section, e.course_id, c.code AS course_code, c.title AS course_title, p.code AS program_code, p.name AS program_name,
       (SELECT CONCAT(u.first_name, ' ', u.last_name) FROM faculty_courses fc JOIN users u ON u.user_id = fc.user_id WHERE fc.course_id = c.course_id LIMIT 1) AS faculty
     FROM student_enrollments e LEFT JOIN courses c ON c.course_id = e.course_id LEFT JOIN programs p ON p.program_id = c.program_id
     WHERE e.user_id = ? ORDER BY e.enrollment_id`, [userId]);
  return rows.map((r) => ({
    // what the COR printed (kept for older screens), then the catalog's own values
    subject_code: r.subject_code, subject_title: r.subject_title, section: r.section,
    courseId: r.course_id || null,
    code: r.course_code || r.subject_code, title: r.course_title || '',
    program: r.program_code || '', programName: r.program_name || '',
    faculty: (r.faculty || '').trim(),
  }));
}

module.exports = { matchCourses, syncEnrollments, enrolledSubjects, programOfSection, key };
