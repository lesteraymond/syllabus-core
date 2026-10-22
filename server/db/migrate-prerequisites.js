// Adds the course_prerequisites table (a subject's prerequisites, linked to other subjects) to an existing database; fresh installs get it from
// schema.sql. Safe to run repeatedly: it only creates what is missing and changes no data. Until it has run, subjects simply have no
// prerequisites and the syllabus form's Pre-requisite field is typed by hand as before. Run: npm run migrate-prerequisites (from server/)
require('dotenv').config();
const mysql = require('mysql2/promise');
const { tables } = require('./prerequisites-ddl');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  for (const sql of tables) await conn.query(sql);
  await conn.end();
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
