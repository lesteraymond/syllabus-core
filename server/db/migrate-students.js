// Upgrades an existing database for student registration (verified from the Certificate of Registration, COR):
//   - users.role gains 'student'. A student signs in with their student ID, which is stored in users.email.
//   - student_profiles    (one row per student): what was read from the COR and the verification state
//   - student_enrollments (one row per subject on the COR): linked to the course catalog when it can be matched
// Only what is needed to verify enrollment is kept: no fees, rates, units or schedules. Fresh installs get all of
// this from schema.sql. Safe to run repeatedly. Use --dry-run to only report. Run migrate-builder first (courses).
require('dotenv').config();
const mysql = require('mysql2/promise');

const DRY = process.argv.includes('--dry-run');

const TABLES = {
  student_profiles: `CREATE TABLE IF NOT EXISTS student_profiles (
    user_id INT NOT NULL PRIMARY KEY,
    student_id VARCHAR(30) NOT NULL UNIQUE,
    student_name VARCHAR(255) NOT NULL,
    program VARCHAR(255) NOT NULL,
    year_level TINYINT NULL,
    section VARCHAR(50) NULL,
    school_year VARCHAR(20) NULL,
    term VARCHAR(30) NULL,
    cor_printed_at DATETIME NULL,
    cor_image_path VARCHAR(255) NULL,
    verification_status ENUM('verified', 'pending', 'rejected') NOT NULL DEFAULT 'pending',
    verification_note VARCHAR(500) NULL,
    verified_at TIMESTAMP NULL,
    verified_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL
  )`,
  student_enrollments: `CREATE TABLE IF NOT EXISTS student_enrollments (
    enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    subject_code VARCHAR(50) NOT NULL,
    subject_title VARCHAR(255) NOT NULL,
    section VARCHAR(50) NULL,
    school_year VARCHAR(20) NULL,
    term VARCHAR(30) NULL,
    course_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_enroll_user (user_id, school_year, term),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE SET NULL
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

  for (const need of ['users', 'courses']) {
    if (!(await exists(need))) throw new Error(`table ${need} is missing. Run migrate-builder first.`);
  }

  const [[col]] = await conn.query("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'", [db]);
  if (/'student'/.test(col.COLUMN_TYPE)) say("users.role: already has 'student'");
  else {
    if (!DRY) await conn.query("ALTER TABLE users MODIFY role ENUM('faculty', 'admin', 'student') NOT NULL DEFAULT 'faculty'");
    say("users.role: added 'student' (existing users keep their role)");
  }

  for (const [name, ddl] of Object.entries(TABLES)) {
    if (await exists(name)) { say(`table ${name}: already exists`); continue; }
    if (!DRY) await conn.query(ddl);
    say(`table ${name}: created`);
  }

  await conn.end();
  console.log(DRY ? 'Dry run complete. Nothing was changed.' : 'Migration complete. Restart the API server.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
