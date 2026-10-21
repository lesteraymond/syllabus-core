// Adds syllabi.archived_at on an existing database (fresh installs get it from schema.sql). A syllabus is archived when its subject is
// assigned to a different faculty member: it stays, read-only, under the former faculty member's name, and leaves the working lists.
// Safe to run repeatedly: it adds the column only when it is missing and touches no data.
// Run: npm run migrate-archive (from server/)
require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  const [found] = await conn.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'syllabi' AND column_name = 'archived_at'");
  if (found.length) console.log('syllabi.archived_at already exists.');
  else { await conn.query('ALTER TABLE syllabi ADD COLUMN archived_at DATETIME NULL AFTER course_id'); console.log('Added syllabi.archived_at.'); }
  await conn.end();
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
