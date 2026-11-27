require('dotenv').config();
const mysql = require('mysql2/promise');
const { migratePreferences } = require('./preferences-ddl');
async function main() {
  const conn = await mysql.createConnection(require('../lib/dbConfig').resolveConnectionConfig());
  try { await migratePreferences(conn); console.log('Language preferences and administrator settings are ready.'); }
  finally { await conn.end(); }
}
main().catch(error => { console.error('Preferences migration failed:', error.message); process.exitCode = 1; });
