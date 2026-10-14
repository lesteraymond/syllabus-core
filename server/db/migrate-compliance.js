// Creates the compliance tables (ai_check_runs, ai_check_area_scores, ai_findings) on an existing database.
// Fresh installs get them from schema.sql. Safe to run repeatedly: it only creates what is missing and touches no data.
// Run: npm run migrate-compliance (from server/)
require('dotenv').config();
const mysql = require('mysql2/promise');
const statements = require('./compliance-ddl');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  for (const sql of statements) await conn.query(sql);
  await conn.end();
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
