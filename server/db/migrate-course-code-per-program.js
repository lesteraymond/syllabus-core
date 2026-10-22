// A subject code only has to be unique within its program, not across the whole catalog: the same ENGEC, CAD or IS-CITE can exist in several
// programs, each with its own prerequisites and syllabi. This replaces the unique key on courses(code) with one on courses(program_id, code).
// Safe to run repeatedly; it changes no rows (every catalog that was unique by code is unique by program and code). Fresh installs get the
// same from schema.sql. Run: npm run migrate-course-code-per-program (from server/), then restart the API server.
require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  const [keys] = await conn.query("SELECT index_name AS name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS cols FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'courses' AND non_unique = 0 GROUP BY index_name");
  const codeOnly = keys.filter((k) => k.cols === 'code');
  const perProgram = keys.some((k) => k.cols === 'program_id,code');
  if (!perProgram) await conn.query('ALTER TABLE courses ADD UNIQUE KEY unique_program_code (program_id, code)');
  for (const k of codeOnly) await conn.query('ALTER TABLE courses DROP INDEX `' + String(k.name).replace(/`/g, '') + '`');
  await conn.end();
  console.log(perProgram && !codeOnly.length ? 'Already done.' : 'Migration complete: a subject code is now unique within its program.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
