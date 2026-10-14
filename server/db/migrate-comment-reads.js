// Creates the comment_reads table on an existing database (fresh installs get it from schema.sql). Safe to run repeatedly: it only creates
// what is missing and touches no data. Until it is run, faculty still see their reviewer comments; the unread count simply is not shown.
// Run: npm run migrate-comment-reads (from server/)
require('dotenv').config();
const mysql = require('mysql2/promise');
const statements = require('./comment-reads-ddl');

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
