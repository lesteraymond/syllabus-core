// Adds the re-planned AI Checker's answer store: the table replan_answers (db/replan-answers-ddl.js).
// Additive and idempotent: it only creates a table that is missing, so no existing row changes. Fresh installs get it from schema.sql.
// Run: npm run migrate-replan-answers (from server/); add --dry-run to see what it would do and change nothing.
// Rollback (drops only the stored answers; the checker then asks again): DROP TABLE replan_answers;
require('dotenv').config();
const mysql = require('mysql2/promise');
const statements = require('./replan-answers-ddl');

async function migrate(conn, { dryRun = false } = {}) {
  const [tables] = await conn.query("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'replan_answers'");
  if (tables.length) return { created: 0 };
  if (!dryRun) for (const sql of statements) await conn.query(sql);
  return { created: 1 };
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  (async () => {
    const conn = await mysql.createConnection(require('../lib/dbConfig').resolveConnectionConfig()); // same connection as every migrate-* script
    try {
      const r = await migrate(conn, { dryRun });
      console.log(r.created ? (dryRun ? '[dry run] would create replan_answers' : 'replan_answers created') : 'replan_answers already present');
    } finally { await conn.end(); }
  })().catch((e) => { console.error('migrate-replan-answers failed:', e.code || e.message); process.exit(1); });
}

module.exports = { migrate };
