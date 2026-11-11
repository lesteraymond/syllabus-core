// Adds users.password_expires_at: when a password the system generated stops working if it has not been replaced (server/lib/passwordExpiry.js, SEC-12).
// Additive and idempotent: it only adds the column when it is missing, and changes no row, so no existing password starts to expire by running it (only
// passwords generated afterwards get an expiry). Fresh installs get the column from schema.sql.
// Run: npm run migrate-password-expiry (from server/); add --dry-run to change nothing. Run it with the migration database account (server/lib/dbConfig.js).
// Rollback: ALTER TABLE users DROP COLUMN password_expires_at;
require('dotenv').config();

const DDL = 'ALTER TABLE users ADD COLUMN password_expires_at DATETIME NULL AFTER must_change_password';

async function migrate(conn, { dryRun = false } = {}) {
  const [have] = await conn.query("SHOW COLUMNS FROM users LIKE 'password_expires_at'");
  if (have.length) return { added: 0 };
  if (!dryRun) await conn.query(DDL);
  return { added: 1 };
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  (async () => {
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
    try {
      const r = await migrate(conn, { dryRun });
      console.log(r.added ? (dryRun ? '[dry run] would add users.password_expires_at' : 'users.password_expires_at added') : 'users.password_expires_at already present');
    } finally { await conn.end(); }
  })().catch((e) => { console.error('migrate-password-expiry failed:', e.code || e.message); process.exit(1); });
}

module.exports = { migrate, DDL };
