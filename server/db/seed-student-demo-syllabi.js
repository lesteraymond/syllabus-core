// Demo data for the student pages: an APPROVED sample syllabus for each subject a student is enrolled in, so the student's Syllabi page has something
// to open. Development only. The content is built with the builder's own model (src/lib/syllabusModel.js), so it reads like a real syllabus; it is
// sample text, not a real course plan. Adds rows only; a subject that already has an approved syllabus is skipped, so it is safe to run repeatedly.
// Run: npm run seed-student-demo-syllabi -- <student id>      (after seed-student-demo)
//      npm run seed-student-demo-syllabi -- --faculty <email>  (a DRAFT sample syllabus, authored by that faculty member, for each subject assigned to them)
require('dotenv').config();
const path = require('path');
const { pathToFileURL } = require('url');
const mysql = require('mysql2/promise');
const { loadCourse } = require('../lib/courses');
const { mastersFor } = require('../lib/syllabuscheck/repository');

let n = 0;
const newId = () => 'demo' + (n += 1).toString(36);

// The institution's vision and mission (institution_settings): a syllabus must carry them word for word to pass the submission check.
async function loadInstitution(db) {
  const [[row]] = await db.query('SELECT vision, mission_lead, mission_items FROM institution_settings ORDER BY setting_id LIMIT 1');
  if (!row) return null;
  const items = typeof row.mission_items === 'string' ? JSON.parse(row.mission_items) : row.mission_items;
  return { vision: row.vision, mission: { lead: row.mission_lead, items: items || [] } };
}

// Copy the program's official EGAs and POs into the syllabus (what the submission check compares against, word for word) and tag every CLO with a valid
// EGA and PO, taken from the same masters the check uses (syllabuscheck/repository.js).
async function withMasters(db, d) {
  const m = await mastersFor(db, d);
  const egas = (m.institution && m.institution.egas) || [], pos = m.pos || [];
  d.outcomes = d.outcomes || {};
  d.outcomes.egas = JSON.parse(JSON.stringify(egas));
  d.outcomes.pos = JSON.parse(JSON.stringify(pos));
  if (m.poReference) for (const k of ['id', 'version', 'sourceFile', 'sourceSha256', 'authorization', 'institutionalApproval']) if (m.poReference[k] !== undefined) (d.outcomes.poReference = d.outcomes.poReference || {})[k] = m.poReference[k];
  // Step 1 must equal the official curriculum row for this subject (title, pre-requisite, year level, lecture and lab units) when the program has one.
  const norm = (x) => String(x || '').replace(/\s+/g, '').toUpperCase();
  const row = (m.curricula || []).flatMap((c) => c.courses || []).find((c) => norm(c.code) === norm(d.meta.code));
  if (row) { d.meta.title = row.title; d.meta.prereq = row.prereq; d.meta.yearLevel = String(row.yearLevel); d.meta.lecture = String(row.lecture); d.meta.lab = String(row.lab); }
  d.clos.forEach((clo, i) => {
    const po = pos[i % (pos.length || 1)];
    if (!(clo.pos && clo.pos.length) && po) clo.pos = [po.no];
    if (!(clo.egas && clo.egas.length)) { const ega = (po && po.egas && po.egas[0]) || (egas[0] && egas[0].no); if (ega !== undefined) clo.egas = [ega]; }
  });
  return d;
}

function sampleContent(model, course, inst) {
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
    { id: newId(), kind: 'lesson', week: '10-13', ilos: [ilo(`Design a solution to a realistic problem using ${t}.`, first)], authoringOrder: 1, contents: 'Advanced topics and applications', activities: 'Project work and consultation', tasks: 'Project milestone', values: '' },
    { id: newId(), kind: 'lesson', week: '14-17', ilos: [ilo(`Evaluate and present a completed ${t} output.`, first)], authoringOrder: 1, contents: 'Integration, presentation and review', activities: 'Project presentation and peer review', tasks: 'Final project', values: '' },
    { id: newId(), kind: 'exam', week: '18', ilos: [ilo('Show what was learned in the whole term.')], contents: 'Final examination', activities: '', tasks: 'Written examination', values: '' },
  ];
  if (inst && d.outcomes) { d.outcomes.vision = inst.vision; d.outcomes.mission = JSON.parse(JSON.stringify(inst.mission)); }
  d.reqs = ['Attend at least 80% of the sessions.', 'Submit all exercises and the case write-up on time.', 'Take the midterm and final examinations.'].map((x) => ({ id: newId(), t: x }));
  d.refs = {
    books: { na: false, items: [{ id: newId(), t: `Sample Author. (2023). Introduction to ${t} (3rd ed.). Sample Publisher.` }] },
    program: { na: true, items: [] }, online: { na: true, items: [] }, electronics: { na: true, items: [] },
  };
  d.grading = { rows: [{ id: newId(), label: 'Quizzes and exercises', abbr: 'QE', pct: '40' }, { id: newId(), label: 'Laboratory and case work', abbr: 'LC', pct: '30' }, { id: newId(), label: 'Major examination', abbr: 'ME', pct: '30' }], override: { on: false, term: '', final: '' } };
  return d;
}

// The current academic year (null before the academic-year migration). A syllabus without one cannot be AI-checked (lib/activeYearGate.js).
async function currentYear(db) {
  try { const [[y]] = await db.query('SELECT label FROM academic_years WHERE is_current = 1 LIMIT 1'); return y ? y.label : null; }
  catch (e) { if (e && (e.code === 'ER_NO_SUCH_TABLE' || e.code === 'ER_BAD_FIELD_ERROR')) return null; throw e; }
}
const stampYear = async (db, id, year) => { if (year) await db.query('UPDATE syllabi SET academic_year = ? WHERE syllabus_id = ?', [year, id]); };

async function seedFaculty(email) {
  const model = await import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'lib', 'syllabusModel.js')).href);
  const db = await mysql.createConnection(require('../lib/dbConfig').resolveConnectionConfig());
  try {
    const [[user]] = await db.query("SELECT user_id FROM users WHERE email = ? AND role = 'faculty'", [email]);
    if (!user) throw new Error(`No faculty account has the email ${email}.`);
    const [owned] = await db.query('SELECT course_id FROM faculty_courses WHERE user_id = ?', [user.user_id]);
    if (!owned.length) throw new Error('No subjects are assigned to this faculty member.');
    const year = await currentYear(db);
    const inst = await loadInstitution(db);
    let added = 0;
    for (const { course_id: courseId } of owned) {
      const [have] = await db.query('SELECT 1 FROM syllabi WHERE course_id = ? AND user_id = ? AND archived_at IS NULL LIMIT 1', [courseId, user.user_id]);
      if (have.length) continue;
      const course = await loadCourse(db, courseId);
      const content = JSON.stringify(await withMasters(db, sampleContent(model, course, inst)));
      const [r] = await db.query("INSERT INTO syllabi (user_id, title, course_code, status, version, content, content_schema_version, content_updated_at, course_id) VALUES (?, ?, ?, 'draft', 'v1', ?, 3, NOW(), ?)",
        [user.user_id, course.title.slice(0, 255), course.code, content, courseId]);
      await stampYear(db, r.insertId, year);
      try { await db.query("INSERT INTO syllabus_versions (syllabus_id, version_label, title, course_code, status_at_save, note, content, created_by) VALUES (?, 'v1', ?, ?, 'draft', 'Sample syllabus for testing', ?, ?)", [r.insertId, course.title.slice(0, 255), course.code, content, user.user_id]); }
      catch (e) { if (!(e && (e.code === 'ER_NO_SUCH_TABLE' || e.code === 'ER_BAD_FIELD_ERROR'))) throw e; }
      added += 1;
    }
    console.log(`Added ${added} draft sample syllabus(es) for ${email}${owned.length - added ? `; ${owned.length - added} subject(s) already had one` : ''}.`);
  } finally { await db.end(); }
}

async function main() {
  if (process.argv[2] === '--faculty') {
    if (!process.argv[3]) throw new Error('Give the faculty email: npm run seed-student-demo-syllabi -- --faculty faculty@university.edu.ph');
    return seedFaculty(process.argv[3]);
  }
  const studentId = process.argv[2];
  if (!studentId) throw new Error('Give the student ID: npm run seed-student-demo-syllabi -- 23-3389-455');
  const model = await import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'lib', 'syllabusModel.js')).href);
  const db = await mysql.createConnection(require('../lib/dbConfig').resolveConnectionConfig());
  try {
    const [[profile]] = await db.query('SELECT user_id FROM student_profiles WHERE student_id = ?', [studentId]);
    if (!profile) throw new Error(`No registered student has the ID ${studentId}.`);
    const [enrolled] = await db.query('SELECT DISTINCT course_id FROM student_enrollments WHERE user_id = ? AND course_id IS NOT NULL', [profile.user_id]);
    if (!enrolled.length) throw new Error('This student has no subjects linked to the catalog. Run seed-student-demo first.');
    const [[author]] = await db.query("SELECT user_id FROM users WHERE role IN ('faculty', 'admin') ORDER BY (role = 'faculty') DESC, user_id LIMIT 1");
    const year = await currentYear(db);
    const inst = await loadInstitution(db);
    let added = 0;
    for (const { course_id: courseId } of enrolled) {
      const [have] = await db.query("SELECT 1 FROM syllabi WHERE course_id = ? AND status = 'approved' AND archived_at IS NULL LIMIT 1", [courseId]);
      if (have.length) continue;
      const course = await loadCourse(db, courseId);
      const content = JSON.stringify(await withMasters(db, sampleContent(model, course, inst)));
      const [r] = await db.query("INSERT INTO syllabi (user_id, title, course_code, status, version, content, content_schema_version, content_updated_at, course_id) VALUES (?, ?, ?, 'approved', 'v1', ?, 3, NOW(), ?)",
        [author.user_id, course.title.slice(0, 255), course.code, content, courseId]);
      await stampYear(db, r.insertId, year);
      try { await db.query("INSERT INTO syllabus_versions (syllabus_id, version_label, title, course_code, status_at_save, note, content, created_by) VALUES (?, 'v1', ?, ?, 'approved', 'Sample syllabus for testing the student view', ?, ?)", [r.insertId, course.title.slice(0, 255), course.code, content, author.user_id]); }
      catch (e) { if (!(e && (e.code === 'ER_NO_SUCH_TABLE' || e.code === 'ER_BAD_FIELD_ERROR'))) throw e; } // before the versions migration: the syllabus alone is enough
      added += 1;
    }
    console.log(`Added ${added} approved sample syllabus(es)${enrolled.length - added ? `; ${enrolled.length - added} subject(s) already had one` : ''}.`);
  } finally { await db.end(); }
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
