// Adds each subject's term (academic year, semester, year level 1-4, pre-requisite, all nullable: existing subjects keep working and stay editable by faculty) and the list of
// academic years an administrator manages. Safe to run again. Run: npm run migrate-subject-term (from server/).
require('dotenv').config();
const mysql = require('mysql2/promise');
const COLUMNS = [['academic_year', 'VARCHAR(9) NULL'], ['semester', 'VARCHAR(20) NULL'], ['year_level', 'TINYINT NULL'], ['prerequisite', 'VARCHAR(255) NULL']];
async function main() {
  const conn = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  try {
    for (const [name, type] of COLUMNS) {
      const [found] = await conn.query('SHOW COLUMNS FROM courses LIKE ?', [name]);
      if (!found.length) await conn.query(`ALTER TABLE courses ADD COLUMN ${name} ${type}`);
    }
    await conn.query('CREATE TABLE IF NOT EXISTS academic_years (label VARCHAR(9) NOT NULL PRIMARY KEY, start_year INT NOT NULL, UNIQUE KEY academic_years_start (start_year))');
    await conn.query('INSERT IGNORE INTO academic_years (label, start_year) VALUES (?, ?)', ['2026–2027', 2026]);
    console.log('Subject terms and academic years are ready. Existing subjects were not changed.');
  } finally { await conn.end(); }
}
main().catch((error) => { console.error('Subject term migration failed:', error.message); process.exitCode = 1; });
