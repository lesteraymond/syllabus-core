// Adds users.must_change_password and the password_temp table to an existing database (fresh installs get them from schema.sql).
// Safe to run repeatedly: it only adds what is missing and changes no data, so nobody is made to change a password by running it.
// Run: npm run migrate-passwords (from server/)
require('dotenv').config();
const mysql = require('mysql2/promise');
const { column, tables } = require('./passwords-ddl');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  const [have] = await conn.query('SHOW COLUMNS FROM ' + column.table + ' LIKE ?', [column.name]);
  if (!have.length) await conn.query(column.ddl);
  for (const sql of tables) await conn.query(sql);
  await conn.end();
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
