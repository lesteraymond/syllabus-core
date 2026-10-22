// Adds each subject's credit units (lecture and laboratory, as the curriculum prints them) to the courses table, so the syllabus form can fill
// Credit Units (V) by itself when a subject is chosen. Safe to run repeatedly; it only adds the two columns and changes no data. Fresh installs
// get them from schema.sql. Until the units are loaded (npm run seed-curriculum) a subject has none and the form is typed by hand as before.
// Run: npm run migrate-credit-units (from server/), then restart the API server.
require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  const [cols] = await conn.query("SELECT column_name AS name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'courses'");
  const have = new Set(cols.map((c) => c.name.toLowerCase()));
  if (!have.has('lecture_units')) await conn.query('ALTER TABLE courses ADD COLUMN lecture_units DECIMAL(3,1) NULL');
  if (!have.has('lab_units')) await conn.query('ALTER TABLE courses ADD COLUMN lab_units DECIMAL(3,1) NULL');
  await conn.end();
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
