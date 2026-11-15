// Demo data for the student pages: an APPROVED sample syllabus for each subject a student is enrolled in, so the student's Syllabi page has something
// to open. Development only. The content is built with the builder's own model (src/lib/syllabusModel.js), so it reads like a real syllabus; it is
// sample text, not a real course plan. Adds rows only; a subject that already has an approved syllabus is skipped, so it is safe to run repeatedly.
// Run: npm run seed-student-demo-syllabi -- <student id>      (after seed-student-demo)
require('dotenv').config();
const path = require('path');
const { pathToFileURL } = require('url');
const mysql = require('mysql2/promise');
const { loadCourse } = require('../lib/courses');

let n = 0;
const newId = () => 'demo' + (n += 1).toString(36);

function sampleContent(model, course) {
  const { emptyDraft, applyCourse } = model;
  const d = applyCourse(emptyDraft(newId), course);
  const t = course.title.replace(/\s*\(.*\)\s*$/, '');
  d.meta.lecture = d.meta.lecture || '3';
  d.meta.lab = d.meta.lab || '0';
  d.meta.prereq = d.meta.prereq || 'None';
  d.description = [{ id: newId(), t: `This is a sample syllabus for ${t}, prepared for testing the student view. It introduces the key concepts of the subject, applies them in guided activities and ends with an assessment of what the learner can do.` }];
  if (!d.clos.length) {
    d.clos = [1, 2, 3].map((i) => ({ id: 'c' + i, title: 'CLO ' + i, level: ['Introductory', 'Enabling', 'Demonstrating'][i - 1], statement: `Sample outcome ${i}: the learner explains and applies the core ideas of ${t}.`, egas: [], pos: [] }));
  }
  const ilo = (text, tag) => ({ id: newId(), text, tags: tag ? ['clo:' + tag] : [] });
  const first = d.clos[0] && d.clos[0].id;
  d.plan = [
    { id: newId(), kind: 'lesson', week: '1-2', ilos: [ilo(`Describe the scope and vocabulary of ${t}.`, first)], authoringOrder: 1, contents: 'Course orientation; overview and basic terms', activities: 'Lecture and class discussion', tasks: 'Short quiz', values: '' },
    { id: newId(), kind: 'lesson', week: '3-6', ilos: [ilo(`Apply the main techniques of ${t} to a guided problem.`, first)], authoringOrder: 1, contents: 'Core concepts and worked examples', activities: 'Guided exercises in pairs', tasks: 'Laboratory exercise', values: '' },
    { id: newId(), kind: 'lesson', week: '7-8', ilos: [ilo(`Analyse a small case using ${t}.`, first)], authoringOrder: 1, contents: 'Case study and review', activities: 'Case analysis and group presentation', tasks: 'Case write-up', values: '' },
    { id: newId(), kind: 'exam', week: '9', ilos: [ilo('Show what was learned in the first half of the term.')], contents: 'Midterm examination', activities: '', tasks: 'Written examination', values: '' },
  ];
  d.reqs = ['Attend at least 80% of the sessions.', 'Submit all exercises and the case write-up on time.', 'Take the midterm and final examinations.'].map((x) => ({ id: newId(), t: x }));
  d.refs = {
    books: { na: false, items: [{ id: newId(), t: `Sample Author. (2023). Introduction to ${t} (3rd ed.). Sample Publisher.` }] },
    program: { na: true, items: [] }, online: { na: true, items: [] }, electronics: { na: true, items: [] },
  };
  d.grading = { rows: [{ id: newId(), label: 'Quizzes and exercises', abbr: 'QE', pct: '40' }, { id: newId(), label: 'Laboratory and case work', abbr: 'LC', pct: '30' }, { id: newId(), label: 'Major examination', abbr: 'ME', pct: '30' }], override: { on: false, term: '', final: '' } };
  return d;
}

async function main() {
  const studentId = process.argv[2];
  if (!studentId) throw new Error('Give the student ID: npm run seed-student-demo-syllabi -- 23-3389-455');
  const model = await import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'lib', 'syllabusModel.js')).href);
  const db = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, port: process.env.DB_PORT || 3306 });
  try {
    const [[profile]] = await db.query('SELECT user_id FROM student_profiles WHERE student_id = ?', [studentId]);
    if (!profile) throw new Error(`No registered student has the ID ${studentId}.`);
    const [enrolled] = await db.query('SELECT DISTINCT course_id FROM student_enrollments WHERE user_id = ? AND course_id IS NOT NULL', [profile.user_id]);
    if (!enrolled.length) throw new Error('This student has no subjects linked to the catalog. Run seed-student-demo first.');
    const [[author]] = await db.query("SELECT user_id FROM users WHERE role IN ('faculty', 'admin') ORDER BY (role = 'faculty') DESC, user_id LIMIT 1");
    let added = 0;
    for (const { course_id: courseId } of enrolled) {
      const [have] = await db.query("SELECT 1 FROM syllabi WHERE course_id = ? AND status = 'approved' AND archived_at IS NULL LIMIT 1", [courseId]);
      if (have.length) continue;
      const course = await loadCourse(db, courseId);
      const content = JSON.stringify(sampleContent(model, course));
      const [r] = await db.query("INSERT INTO syllabi (user_id, title, course_code, status, version, content, content_schema_version, content_updated_at, course_id) VALUES (?, ?, ?, 'approved', 'v1.0', ?, 3, NOW(), ?)",
        [author.user_id, course.title.slice(0, 255), course.code, content, courseId]);
      try { await db.query("INSERT INTO syllabus_versions (syllabus_id, version_label, title, course_code, status_at_save, note, content, created_by) VALUES (?, 'v1.0', ?, ?, 'approved', 'Sample syllabus for testing the student view', ?, ?)", [r.insertId, course.title.slice(0, 255), course.code, content, author.user_id]); }
      catch (e) { if (!(e && (e.code === 'ER_NO_SUCH_TABLE' || e.code === 'ER_BAD_FIELD_ERROR'))) throw e; } // before the versions migration: the syllabus alone is enough
      added += 1;
    }
    console.log(`Added ${added} approved sample syllabus(es)${enrolled.length - added ? `; ${enrolled.length - added} subject(s) already had one` : ''}.`);
  } finally { await db.end(); }
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
