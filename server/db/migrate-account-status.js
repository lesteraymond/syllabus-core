// Adds account disabling: users.disabled_at (when the account was disabled, NULL while active) and users.disabled_by (the administrator who did it).
// Additive and idempotent: no row is changed, every account stays active. Run: npm run migrate-account-status (from server/).
// Rollback (only while no account is disabled): ALTER TABLE users DROP COLUMN disabled_by, DROP COLUMN disabled_at;
require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate(conn) {
  const [columns] = await conn.query("SHOW COLUMNS FROM users WHERE Field IN ('disabled_at', 'disabled_by')");
  const have = new Set(columns.map((c) => c.Field));
  const add = [];
  if (!have.has('disabled_at')) add.push('ADD COLUMN disabled_at DATETIME NULL DEFAULT NULL');
  if (!have.has('disabled_by')) add.push('ADD COLUMN disabled_by INT NULL DEFAULT NULL');
  if (add.length) await conn.query('ALTER TABLE users ' + add.join(', '));
  return { added: add.length };
}

if (require.main === module) {
  (async () => {
    const conn = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME }); // same connection as every migrate-* script
    try { const r = await migrate(conn); console.log(r.added ? `users: ${r.added} account-status column(s) added` : 'users: account-status columns already present'); }
    finally { await conn.end(); }
  })().catch((e) => { console.error('migrate-account-status failed:', e.code || e.message); process.exit(1); });
}

module.exports = { migrate };
