// Creates the sessions table used by SESSION_STORE=mysql (server/lib/sessionStore.js, SEC-09). Staging and production always keep sessions there, and the server
// refuses to start without the table. Additive and idempotent: it only creates the table when it is missing. Fresh installs get it from schema.sql.
// Run: npm run migrate-session-store (from server/); add --dry-run to change nothing. Run it with the migration database account (server/lib/dbConfig.js).
// Rollback: DROP TABLE sessions; (everyone is signed out; set SESSION_STORE=memory in development first).
require('dotenv').config();
const { SESSIONS_DDL } = require('../lib/sessionStore');

async function migrate(conn, { dryRun = false } = {}) {
  const [tables] = await conn.query("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'sessions'");
  if (tables.length) return { created: 0 };
  if (!dryRun) await conn.query(SESSIONS_DDL);
  return { created: 1 };
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  (async () => {
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection(require('../lib/dbConfig').resolveConnectionConfig());
    try {
      const r = await migrate(conn, { dryRun });
      console.log(r.created ? (dryRun ? '[dry run] would create the sessions table' : 'sessions table created') : 'sessions table already present');
    } finally { await conn.end(); }
  })().catch((e) => { console.error('migrate-session-store failed:', e.code || e.message); process.exit(1); });
}

module.exports = { migrate };
