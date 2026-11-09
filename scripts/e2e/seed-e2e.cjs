'use strict';
// Seeds an ISOLATED local test database with SYNTHETIC data only (no institutional or faculty text): one program with outcomes, one course with four CLOs,
// an approved curriculum row, and test accounts. It refuses to touch any database whose name does not contain "e2e", so it can never write to the development
// or any staging/production database. Accounts use throwaway passwords that exist only in this test database.
//   node scripts/e2e/seed-e2e.cjs            (DB_* come from the process environment; nothing is read from server/.env)
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const mysql = require(path.join(ROOT, 'server/node_modules/mysql2/promise'));
const bcrypt = require(path.join(ROOT, 'server/node_modules/bcryptjs'));
const { sample } = require(path.join(ROOT, 'server/lib/syllabuscheck/vpaa-conformance/harness'));

const LEVELS = ['Introductory', 'Enabling', 'Demonstrating', 'Integration of Values']; // the fixed LCUP CLO1..CLO4 classification
const PASSWORD = 'E2e-Local-Only-Pass1!'; // test accounts of the scratch database only
// a second synthetic subject, so scenarios that must not disturb the approved first syllabus (AI-offline, responsive) have an editable one of their own
const SECOND = { courseId: 11, code: 'IT 205', title: 'Data Structures and Algorithms (synthetic)', prereq: 'IT 204 - Computer Programming 2', lecture: 2, lab: 1, yearLevel: 2 };
const ACCOUNTS = [
  { email: 'e2e.admin@e2e.invalid', role: 'admin', first: 'Test', last: 'Administrator' },
  { email: 'e2e.faculty@e2e.invalid', role: 'faculty', first: 'Test', last: 'Faculty' },
  { email: 'e2e.other@e2e.invalid', role: 'faculty', first: 'Other', last: 'Faculty' },
  { email: 'e2e.asst@e2e.invalid', role: 'asst_vpaa', first: 'Test', last: 'AsstVpaa' },
  { email: 'e2e.lic@e2e.invalid', role: 'lic_director', first: 'Test', last: 'LicDirector' },
  { email: 'e2e.vpaa@e2e.invalid', role: 'vpaa', first: 'Test', last: 'Vpaa' },
];

async function seed(cfg) {
  if (!/e2e/i.test(String(cfg.database || ''))) throw new Error('refusing to seed: the database name must contain "e2e" (this script only writes to an isolated test database)');
  if (!cfg.host || !['localhost', '127.0.0.1', '::1'].includes(cfg.host)) throw new Error('refusing to seed: the test database must be on this machine');
  const db = await mysql.createConnection({ ...cfg, multipleStatements: false });
  const { content, masters } = sample();
  const hash = await bcrypt.hash(PASSWORD, 8);
  await db.query('SET FOREIGN_KEY_CHECKS=0');
  for (const t of ['syllabus_check_reports', 'ai_check_runs', 'syllabus_review_stages', 'syllabus_versions', 'submission_logs', 'syllabi', 'faculty_courses', 'faculty_programs', 'course_clos', 'courses', 'syllabus_check_curricula', 'program_outcomes', 'program_egas', 'programs', 'institution_egas', 'institution_settings', 'remember_tokens', 'users']) await db.query('DELETE FROM ?? ', [t]).catch(() => {});
  await db.query('SET FOREIGN_KEY_CHECKS=1');

  await db.query('INSERT INTO institution_settings (setting_id, vision, mission_lead, mission_items) VALUES (1, ?, ?, ?)', [masters.institution.vision, masters.institution.mission.lead, JSON.stringify(masters.institution.mission.items)]);
  for (const e of masters.institution.egas) await db.query('INSERT INTO institution_egas (ega_no, name, short_name) VALUES (?, ?, ?)', [e.no, e.name, e.short]);
  const [p] = await db.query('INSERT INTO programs (code, name) VALUES (?, ?)', ['BSIT', 'BS Information Technology (synthetic test program)']);
  const programId = p.insertId;
  for (const e of masters.institution.egas) await db.query('INSERT INTO program_egas (program_id, ega_no, name, short_name) VALUES (?, ?, ?, ?)', [programId, e.no, e.name, e.short]);
  for (const o of masters.pos) await db.query('INSERT INTO program_outcomes (program_id, po_no, short_name, outcome_text, ega_nos) VALUES (?, ?, ?, ?, ?)', [programId, o.no, o.short, o.text, o.egas.join(',')]);
  const course = masters.curricula[0].courses[0];
  const [c] = await db.query('INSERT INTO courses (course_id, code, title, program_id, standards_json) VALUES (?, ?, ?, ?, ?)', [content.meta.courseId, course.code, course.title, programId, JSON.stringify({ vision: masters.institution.vision, mission: masters.institution.mission, egas: masters.institution.egas, pos: masters.pos, versions: { vision: 1, egas: 1, pos: 1 } })]);
  for (const [i, clo] of content.clos.entries()) await db.query('INSERT INTO course_clos (course_id, sort_order, title, clo_level, statement, ega_nos, po_nos) VALUES (?, ?, ?, ?, ?, ?, ?)', [content.meta.courseId, i + 1, clo.title, LEVELS[i], clo.statement, clo.egas.join(','), clo.pos.join(',')]);
  await db.query("INSERT INTO syllabus_check_curricula (program_code, curriculum_year, status, source, courses_json) VALUES (?, ?, 'approved', 'synthetic e2e test curriculum', ?)", ['BSIT', masters.curricula[0].curriculumYear, JSON.stringify([...masters.curricula[0].courses, { code: SECOND.code, title: SECOND.title, prereq: SECOND.prereq, lecture: SECOND.lecture, lab: SECOND.lab, yearLevel: SECOND.yearLevel }])]);
  await db.query('INSERT INTO courses (course_id, code, title, program_id, standards_json) SELECT ?, ?, ?, program_id, standards_json FROM courses WHERE course_id = ?', [SECOND.courseId, SECOND.code, SECOND.title, content.meta.courseId]);
  await db.query('INSERT INTO course_clos (course_id, sort_order, title, clo_level, statement, ega_nos, po_nos) SELECT ?, sort_order, title, clo_level, statement, ega_nos, po_nos FROM course_clos WHERE course_id = ?', [SECOND.courseId, content.meta.courseId]);
  // the catalog is per academic year: stamp the seeded program and subjects with the current year, as migrate-catalog-year does for existing rows
  // (a NULL year would follow the current year the day the administrator changes it)
  const [[year]] = await db.query('SELECT label FROM academic_years WHERE is_current = 1');
  if (year) { await db.query('UPDATE programs SET academic_year = ? WHERE academic_year IS NULL', [year.label]); await db.query('UPDATE courses SET academic_year = ? WHERE academic_year IS NULL', [year.label]); }
  const ids = {};
  for (const a of ACCOUNTS) {
    const [u] = await db.query('INSERT INTO users (email, password_hash, must_change_password, role, first_name, last_name, preferred_language) VALUES (?, ?, 0, ?, ?, ?, ?)', [a.email, hash, a.role, a.first, a.last, 'en']);
    ids[a.email] = u.insertId;
  }
  for (const courseId of [content.meta.courseId, SECOND.courseId]) await db.query('INSERT INTO faculty_courses (user_id, course_id) VALUES (?, ?)', [ids['e2e.faculty@e2e.invalid'], courseId]);
  await db.query('INSERT INTO faculty_programs (user_id, program_id) VALUES (?, ?)', [ids['e2e.faculty@e2e.invalid'], programId]);
  const [[counts]] = await db.query('SELECT (SELECT COUNT(*) FROM users) users, (SELECT COUNT(*) FROM courses) courses, (SELECT COUNT(*) FROM syllabi) syllabi');
  await db.end();
  return { database: cfg.database, programId, courseId: content.meta.courseId, counts, accounts: ACCOUNTS.map((a) => ({ email: a.email, role: a.role })) };
}

module.exports = { seed, ACCOUNTS, PASSWORD, LEVELS, SECOND };
if (require.main === module) {
  seed({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME })
    .then((r) => console.log(JSON.stringify(r))).catch((e) => { console.error('ERR', e.message); process.exit(1); });
}
