// Upgrades an existing database for faculty assignments:
//   - faculty_programs (user_id, program_id): the programs an admin assigned to a faculty member
//   - faculty_courses  (user_id, course_id):  the courses an admin assigned to a faculty member
// A faculty member can create and edit syllabi only for assigned courses. Fresh installs get both tables from
// schema.sql. Safe to run repeatedly. Use --dry-run to only report. Run migrate-builder first (programs and courses).
// The older course_assignments table (keyed to a syllabus and a term) is left untouched.
require('dotenv').config();
const mysql = require('mysql2/promise');

const DRY = process.argv.includes('--dry-run');

const TABLES = {
  faculty_programs: `CREATE TABLE IF NOT EXISTS faculty_programs (
    user_id INT NOT NULL,
    program_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, program_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (program_id) REFERENCES programs(program_id) ON DELETE CASCADE
  )`,
  faculty_courses: `CREATE TABLE IF NOT EXISTS faculty_courses (
    user_id INT NOT NULL,
    course_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, course_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
  )`,
};

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  const db = process.env.DB_NAME;
  const say = (m) => console.log((DRY ? '[dry run] ' : '') + m);
  const exists = async (name) => (await conn.query('SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [db, name]))[0].length > 0;

  for (const need of ['users', 'programs', 'courses']) {
    if (!(await exists(need))) throw new Error(`table ${need} is missing. Run migrate-builder first.`);
  }
  for (const [name, ddl] of Object.entries(TABLES)) {
    if (await exists(name)) { say(`table ${name}: already exists`); continue; }
    if (!DRY) await conn.query(ddl);
    say(`table ${name}: created`);
  }

  await conn.end();
  console.log(DRY ? 'Dry run complete. Nothing was changed.' : 'Migration complete. Assign programs and courses to faculty in Users & Roles.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
