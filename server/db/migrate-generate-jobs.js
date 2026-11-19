// Adds the AI Syllabus Generator's jobs table (db/generate-jobs-ddl.js): background generations survive a server restart, and the daily limit counts from it.
// Additive and idempotent: it only creates a table that is missing, so no row changes. Fresh installs get it from schema.sql. Without it the generator still works,
// keeping its jobs and its daily count in the server's memory (lost on a restart).
// Run: npm run migrate-generate-jobs (from server/); add --dry-run to see what it would do and change nothing.
// Rollback (drops only the recorded generations): DROP TABLE syllabus_generate_jobs;
require('dotenv').config();
const mysql = require('mysql2/promise');
const statements = require('./generate-jobs-ddl');

async function migrate(conn, { dryRun = false } = {}) {
  const [tables] = await conn.query("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'syllabus_generate_jobs'");
  if (tables.length) return { created: 0 };
  if (!dryRun) for (const sql of statements) await conn.query(sql);
  return { created: 1 };
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  (async () => {
    const conn = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME }); // same connection as every migration
    try {
      const r = await migrate(conn, { dryRun });
      console.log(r.created ? (dryRun ? '[dry run] would create syllabus_generate_jobs' : 'syllabus_generate_jobs created') : 'syllabus_generate_jobs already present');
    } finally { await conn.end(); }
  })().catch((e) => { console.error('migrate-generate-jobs failed:', e.code || e.message); process.exit(1); });
}

module.exports = { migrate };
