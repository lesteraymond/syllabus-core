// Adds a subject's curriculum year: courses.curriculum_year ("2022-2023", NULL while not set), independent of the subject's academic year (lib/curriculumYear.js).
// Additive and idempotent: no row is changed, every existing subject reads "not set". Run: npm run migrate-curriculum-year (from server/).
// Rollback (drops only the new values): ALTER TABLE courses DROP COLUMN curriculum_year;
require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate(conn) {
  const [found] = await conn.query("SHOW COLUMNS FROM courses LIKE 'curriculum_year'");
  if (found.length) return { added: 0 };
  await conn.query('ALTER TABLE courses ADD COLUMN curriculum_year VARCHAR(9) NULL DEFAULT NULL');
  return { added: 1 };
}

if (require.main === module) {
  (async () => {
    const conn = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME }); // same connection as every migrate-* script
    try { const r = await migrate(conn); console.log(r.added ? 'courses: curriculum_year column added' : 'courses: curriculum_year column already present'); }
    finally { await conn.end(); }
  })().catch((e) => { console.error('migrate-curriculum-year failed:', e.code || e.message); process.exit(1); });
}

module.exports = { migrate };
