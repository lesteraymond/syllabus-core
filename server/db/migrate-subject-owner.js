// Makes "one subject, one faculty member" a rule of the database: a unique key on faculty_courses.course_id (fresh installs get it from
// schema.sql). Programs can still be assigned to many faculty.
// It changes no data. If some subject is held by more than one faculty member it stops and lists them, so an administrator decides who keeps
// each one (Users and Roles > Assignments) and runs it again. Safe to run repeatedly. Use --dry-run to only report.
// Run: npm run migrate-subject-owner (from server/)
require('dotenv').config();
const mysql = require('mysql2/promise');

const DRY = process.argv.includes('--dry-run');
const KEY = 'unique_course_owner';

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  try {
    const [exists] = await conn.query(
      "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'faculty_courses' AND INDEX_NAME = ? LIMIT 1", [KEY]);
    if (exists.length) { console.log('Already in place: a subject has one faculty member.'); return; }

    const [shared] = await conn.query(
      `SELECT c.code, GROUP_CONCAT(CONCAT(u.first_name, ' ', u.last_name) ORDER BY u.last_name SEPARATOR ', ') AS faculty
       FROM faculty_courses fc JOIN courses c ON c.course_id = fc.course_id JOIN users u ON u.user_id = fc.user_id
       GROUP BY fc.course_id, c.code HAVING COUNT(*) > 1 ORDER BY c.code`);
    if (shared.length) {
      console.error('Not applied: these subjects are assigned to more than one faculty member. Keep one for each, then run this again:');
      shared.forEach((r) => console.error('  ' + r.code + ': ' + r.faculty));
      process.exitCode = 1;
      return;
    }
    if (DRY) { console.log('Dry run: no subject is shared; the unique key would be added.'); return; }
    await conn.query(`ALTER TABLE faculty_courses ADD UNIQUE KEY ${KEY} (course_id)`);
    console.log('Migration complete: a subject now has one faculty member.');
  } finally {
    await conn.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
