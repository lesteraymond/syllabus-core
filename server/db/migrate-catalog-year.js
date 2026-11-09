// Makes the catalog (programs, and through them subjects) belong to an academic year, so a new academic year can start with none.
//  - programs gets academic_year; every existing program is stamped with the CURRENT academic year (nothing is deleted or moved);
//  - the program code is no longer unique on its own but per academic year (the same code can exist in two years, as two separate rows with their own EGAs, POs and subjects);
//  - program_code_aliases (old codes kept after a rename) is keyed by (code, program) so two years can keep the same old code;
//  - a subject's academic_year is its program's year (one source of truth).
// Safe to run again. Needs the academic years: it sets them up itself if migrate-academic-year-scope has not run. Run: npm run migrate-catalog-year (from server/).
require('dotenv').config();
const mysql = require('mysql2/promise');

const columnsOf = async (conn, table, indexName) => { const [rows] = await conn.query('SHOW INDEX FROM ?? WHERE Key_name = ?', [table, indexName]); return rows.sort((a, b) => a.Seq_in_index - b.Seq_in_index).map((r) => r.Column_name); };
const tableExists = async (conn, name) => { const [rows] = await conn.query('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?', [name]); return rows.length > 0; };
const hasColumn = async (conn, table, column) => { const [rows] = await conn.query('SHOW COLUMNS FROM ?? LIKE ?', [table, column]); return rows.length > 0; };

async function main() {
  const conn = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  try {
    // the academic years and the current one (the same setup as migrate-academic-year-scope, so the order of the two scripts does not matter)
    await conn.query('CREATE TABLE IF NOT EXISTS academic_years (label VARCHAR(9) NOT NULL PRIMARY KEY, start_year INT NOT NULL, UNIQUE KEY academic_years_start (start_year))');
    await conn.query('INSERT IGNORE INTO academic_years (label, start_year) VALUES (?, ?)', ['2026–2027', 2026]);
    if (!(await hasColumn(conn, 'academic_years', 'is_current'))) await conn.query('ALTER TABLE academic_years ADD COLUMN is_current TINYINT NOT NULL DEFAULT 0');
    const [[has]] = await conn.query('SELECT COUNT(*) AS n FROM academic_years WHERE is_current = 1');
    if (!has.n) await conn.query('UPDATE academic_years SET is_current = 1 ORDER BY start_year LIMIT 1');
    const [[current]] = await conn.query('SELECT label FROM academic_years WHERE is_current = 1 LIMIT 1');

    if (!(await hasColumn(conn, 'programs', 'academic_year'))) await conn.query('ALTER TABLE programs ADD COLUMN academic_year VARCHAR(9) NULL');
    const [stamped] = await conn.query('UPDATE programs SET academic_year = ? WHERE academic_year IS NULL', [current.label]);

    // the code is unique per academic year, not on its own
    const [indexes] = await conn.query('SHOW INDEX FROM programs');
    const names = [...new Set(indexes.map((r) => r.Key_name))];
    for (const name of names) {
      if (name === 'PRIMARY') continue;
      const cols = await columnsOf(conn, 'programs', name);
      const unique = indexes.find((r) => r.Key_name === name).Non_unique === 0;
      if (unique && cols.length === 1 && cols[0] === 'code') await conn.query('ALTER TABLE programs DROP INDEX ??', [name]);
    }
    if (!names.includes('programs_year_code')) await conn.query('ALTER TABLE programs ADD UNIQUE KEY programs_year_code (academic_year, code)');

    if (await tableExists(conn, 'program_code_aliases')) {
      const key = await columnsOf(conn, 'program_code_aliases', 'PRIMARY');
      if (key.length === 1 && key[0] === 'code') await conn.query('ALTER TABLE program_code_aliases DROP PRIMARY KEY, ADD PRIMARY KEY (code, program_id)');
    }

    // a subject's year is its program's year
    if (!(await hasColumn(conn, 'courses', 'academic_year'))) await conn.query('ALTER TABLE courses ADD COLUMN academic_year VARCHAR(9) NULL');
    const [courses] = await conn.query('UPDATE courses c JOIN programs p ON p.program_id = c.program_id SET c.academic_year = p.academic_year');
    console.log(`The catalog is per academic year. Current academic year: ${current.label}. Programs stamped with it: ${stamped.affectedRows}. Subjects set to their program's year: ${courses.affectedRows}.`);
  } finally { await conn.end(); }
}
main().catch((error) => { console.error('Catalog year migration failed:', error.message); process.exitCode = 1; });
