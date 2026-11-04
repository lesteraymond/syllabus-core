// Lets the activity log (submission_logs.action) record an AI check ('check') and an answer to a recommendation ('recommend') on an
// existing database; fresh installs get both from schema.sql. It only adds values to the end of the list, so no row changes.
// Safe to run repeatedly: it does nothing when the column already has them.
// Run: npm run migrate-activity-log (from server/)
require('dotenv').config();
const mysql = require('mysql2/promise');

const ACTIONS = ['upload', 'update', 'submit', 'approve', 'reject', 'revision', 'delete', 'check', 'recommend'];

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  const [rows] = await conn.query(
    "SELECT column_type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'submission_logs' AND column_name = 'action'");
  if (!rows.length) throw new Error('submission_logs.action was not found. Run the base schema first.');
  const current = String(rows[0].column_type || rows[0].COLUMN_TYPE);
  const missing = ACTIONS.filter((a) => !current.includes(`'${a}'`));
  if (!missing.length) console.log('submission_logs.action already allows every activity.');
  else {
    await conn.query(`ALTER TABLE submission_logs MODIFY action ENUM(${ACTIONS.map((a) => `'${a}'`).join(', ')}) NOT NULL`);
    console.log('Added to submission_logs.action: ' + missing.join(', ') + '.');
  }
  await conn.end();
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
