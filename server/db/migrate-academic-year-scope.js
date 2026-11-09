// Gives every syllabus its own academic year and lets an administrator say which academic year is the current one. Safe to run again.
//  - academic_years gets is_current (exactly one year is current; the earliest year becomes current if none is);
//  - syllabi gets academic_year, and every existing syllabus is stamped with the current year (nothing older was ever recorded).
// Run: npm run migrate-academic-year-scope (from server/). It creates academic_years itself if migrate-subject-term has not run yet.
require('dotenv').config();
const mysql = require('mysql2/promise');
async function main() {
  const conn = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  try {
    await conn.query('CREATE TABLE IF NOT EXISTS academic_years (label VARCHAR(9) NOT NULL PRIMARY KEY, start_year INT NOT NULL, UNIQUE KEY academic_years_start (start_year))');
    await conn.query('INSERT IGNORE INTO academic_years (label, start_year) VALUES (?, ?)', ['2026–2027', 2026]);
    const [isCurrent] = await conn.query("SHOW COLUMNS FROM academic_years LIKE 'is_current'");
    if (!isCurrent.length) await conn.query('ALTER TABLE academic_years ADD COLUMN is_current TINYINT NOT NULL DEFAULT 0');
    const [[has]] = await conn.query('SELECT COUNT(*) AS n FROM academic_years WHERE is_current = 1');
    if (!has.n) await conn.query('UPDATE academic_years SET is_current = 1 ORDER BY start_year LIMIT 1');
    const [column] = await conn.query("SHOW COLUMNS FROM syllabi LIKE 'academic_year'");
    if (!column.length) {
      await conn.query('ALTER TABLE syllabi ADD COLUMN academic_year VARCHAR(9) NULL');
      await conn.query('ALTER TABLE syllabi ADD INDEX syllabi_academic_year (academic_year)');
    }
    const [[current]] = await conn.query('SELECT label FROM academic_years WHERE is_current = 1 LIMIT 1');
    const [stamped] = await conn.query('UPDATE syllabi SET academic_year = ? WHERE academic_year IS NULL', [current.label]);
    console.log(`Academic year scope is ready. Current academic year: ${current.label}. Syllabi stamped with it: ${stamped.affectedRows}.`);
  } finally { await conn.end(); }
}
main().catch((error) => { console.error('Academic year scope migration failed:', error.message); process.exitCode = 1; });
