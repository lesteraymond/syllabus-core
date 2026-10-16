// Upgrades an existing database for the new syllabus builder:
//   - syllabi: 'draft' status, content / content_schema_version / content_updated_at
//   - syllabus_versions: content
//   - institution_settings, institution_egas, programs, program_outcomes
//   - courses, course_clos (the course catalog: admin-managed course learning outcomes), syllabi.course_id
// Fresh installs get all of this from schema.sql. Safe to run repeatedly. Use --dry-run to only report.
// Afterwards run `npm run seed-outcomes` to load the vision, mission, EGAs and program outcomes.
require('dotenv').config();
const mysql = require('mysql2/promise');

const DRY = process.argv.includes('--dry-run');

const TABLES = {
  institution_settings: `CREATE TABLE IF NOT EXISTS institution_settings (
    setting_id TINYINT PRIMARY KEY,
    vision TEXT NOT NULL,
    mission_lead TEXT NOT NULL,
    mission_items LONGTEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  institution_egas: `CREATE TABLE IF NOT EXISTS institution_egas (
    ega_no INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(120) NOT NULL
  )`,
  programs: `CREATE TABLE IF NOT EXISTS programs (
    program_id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL
  )`,
  program_outcomes: `CREATE TABLE IF NOT EXISTS program_outcomes (
    program_id INT NOT NULL,
    po_no INT NOT NULL,
    short_name VARCHAR(120) NOT NULL,
    outcome_text TEXT NOT NULL,
    ega_nos VARCHAR(50) NOT NULL DEFAULT '',
    PRIMARY KEY (program_id, po_no),
    FOREIGN KEY (program_id) REFERENCES programs(program_id) ON DELETE CASCADE
  )`,
  courses: `CREATE TABLE IF NOT EXISTS courses (
    course_id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    program_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id) REFERENCES programs(program_id) ON DELETE RESTRICT
  )`,
  course_clos: `CREATE TABLE IF NOT EXISTS course_clos (
    clo_id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    title VARCHAR(255) NOT NULL DEFAULT '',
    clo_level VARCHAR(40) NOT NULL,
    statement TEXT NOT NULL,
    ega_nos VARCHAR(50) NOT NULL DEFAULT '',
    po_nos VARCHAR(100) NOT NULL DEFAULT '',
    INDEX idx_course_clos (course_id, sort_order),
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
  )`,
};

const COLUMNS = [
  ['syllabi', 'content', 'LONGTEXT NULL'],
  ['syllabi', 'content_schema_version', 'INT NULL'],
  ['syllabi', 'content_updated_at', 'TIMESTAMP NULL'],
  ['syllabus_versions', 'content', 'LONGTEXT NULL'],
  ['syllabi', 'course_id', 'INT NULL'],
];

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  const db = process.env.DB_NAME;
  const say = (m) => console.log((DRY ? '[dry run] ' : '') + m);
  const run = async (sql) => { if (!DRY) await conn.query(sql); };

  for (const [name, ddl] of Object.entries(TABLES)) {
    const [r] = await conn.query('SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [db, name]);
    if (r.length) { say(`table ${name}: already exists`); continue; }
    await run(ddl);
    say(`table ${name}: created`);
  }

  for (const [table, column, type] of COLUMNS) {
    const [r] = await conn.query('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?', [db, table, column]);
    if (r.length) { say(`${table}.${column}: already exists`); continue; }
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    say(`${table}.${column}: added`);
  }

  const [[st]] = await conn.query("SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'syllabi' AND COLUMN_NAME = 'status'", [db]);
  if (st.t.includes("'draft'")) {
    say("syllabi.status: 'draft' already allowed");
  } else {
    await run("ALTER TABLE syllabi MODIFY COLUMN status ENUM('submitted', 'under_review', 'approved', 'rejected', 'for_revision', 'draft') DEFAULT 'submitted'");
    say("syllabi.status: added 'draft' (existing rows keep their status)");
  }

  const [fk] = await conn.query("SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'syllabi' AND COLUMN_NAME = 'course_id' AND REFERENCED_TABLE_NAME = 'courses'", [db]);
  if (fk.length) say('syllabi.course_id: foreign key already exists');
  else {
    await run('ALTER TABLE syllabi ADD CONSTRAINT fk_syllabi_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE SET NULL');
    say('syllabi.course_id: foreign key added');
  }

  await conn.end();
  console.log(DRY ? 'Dry run complete. Nothing was changed.' : 'Migration complete. Next: npm run seed-outcomes');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
