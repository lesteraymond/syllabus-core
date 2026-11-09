// Adds the account activity log: the table account_activity (db/account-activity-ddl.js), read by the dashboard's Recent Activity.
// Additive and idempotent: it only creates a table that is missing, so no row changes. Fresh installs get it from schema.sql.
// Run: npm run migrate-account-activity (from server/); add --dry-run to see what it would do and change nothing.
// Rollback (drops only the recorded account activity): DROP TABLE account_activity;
require('dotenv').config();
const mysql = require('mysql2/promise');
const statements = require('./account-activity-ddl');

async function migrate(conn, { dryRun = false } = {}) {
  const [tables] = await conn.query("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'account_activity'");
  if (tables.length) return { created: 0 };
  if (!dryRun) for (const sql of statements) await conn.query(sql);
  return { created: 1 };
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  (async () => {
    const conn = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME }); // same connection as every migrate-* script
    try {
      const r = await migrate(conn, { dryRun });
      console.log(r.created ? (dryRun ? '[dry run] would create account_activity' : 'account_activity created') : 'account_activity already present');
    } finally { await conn.end(); }
  })().catch((e) => { console.error('migrate-account-activity failed:', e.code || e.message); process.exit(1); });
}

module.exports = { migrate };
