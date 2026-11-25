// Adds a subject's credit units: courses.lecture_units and courses.lab_units (NULL while the administrator has not set them, lib/subjectUnits.js).
// Additive and idempotent: no row is changed, every existing subject reads "not set". Run: npm run migrate-subject-units (from server/).
// Rollback (drops only the new values): ALTER TABLE courses DROP COLUMN lecture_units, DROP COLUMN lab_units;
require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate(conn) {
  let added = 0;
  for (const column of ['lecture_units', 'lab_units']) {
    const [found] = await conn.query('SHOW COLUMNS FROM courses LIKE ?', [column]);
    if (found.length) continue;
    await conn.query(`ALTER TABLE courses ADD COLUMN ${column} DECIMAL(3,1) NULL DEFAULT NULL`);
    added += 1;
  }
  return { added };
}

if (require.main === module) {
  (async () => {
    const conn = await mysql.createConnection(require('../lib/dbConfig').resolveConnectionConfig()); // same connection as every migrate-* script
    try { const r = await migrate(conn); console.log(r.added ? `courses: ${r.added} unit column(s) added` : 'courses: unit columns already present'); }
    finally { await conn.end(); }
  })().catch((e) => { console.error('migrate-subject-units failed:', e.code || e.message); process.exit(1); });
}

module.exports = { migrate };
