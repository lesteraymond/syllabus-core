// Adds the usage_daily table to an existing database (fresh installs get it from schema.sql). Safe to run repeatedly: it only creates
// what is missing and changes no data. Until it has run, the dashboard's time card says tracking is not set up; nothing else is affected.
// Run: npm run migrate-usage (from server/)
require('dotenv').config();
const mysql = require('mysql2/promise');
const { tables } = require('./usage-ddl');

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
