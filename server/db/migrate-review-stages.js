// Adds the review chain to an existing database: the three reviewer roles (asst_vpaa, lic_director, vpaa) in users.role, and the table
// that records who cleared which stage of which version of a syllabus. Fresh installs get both from schema.sql. It only adds values to the
// end of the role list and creates a table if it is missing, so no row changes. Safe to run repeatedly.
// Run: npm run migrate-review-stages (from server/); add --dry-run to see what it would do and change nothing.
require('dotenv').config();
const mysql = require('mysql2/promise');
const statements = require('./review-stages-ddl');

const ROLES = ['faculty', 'admin', 'student', 'asst_vpaa', 'lic_director', 'vpaa'];
const dryRun = process.argv.includes('--dry-run');
const say = (message) => console.log((dryRun ? '[dry run] would: ' : '') + message);

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  const [cols] = await conn.query(
    "SELECT column_type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'role'");
  if (!cols.length) throw new Error('users.role was not found. Run the base schema first.');
  const current = String(cols[0].column_type || cols[0].COLUMN_TYPE);
  const missing = ROLES.filter((r) => !current.includes(`'${r}'`));
  if (!missing.length) console.log('users.role already allows every role.');
  else {
    say('add to users.role: ' + missing.join(', '));
    if (!dryRun) await conn.query(`ALTER TABLE users MODIFY role ENUM(${ROLES.map((r) => `'${r}'`).join(', ')}) NOT NULL DEFAULT 'faculty'`);
  }
  const [tables] = await conn.query("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'syllabus_review_stages'");
  if (tables.length) console.log('syllabus_review_stages already exists.');
  else {
    say('create syllabus_review_stages');
    if (!dryRun) for (const sql of statements) await conn.query(sql);
  }
  await conn.end();
  console.log(dryRun ? 'Dry run complete. Nothing was changed.' : 'Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
