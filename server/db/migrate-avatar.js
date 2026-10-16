// Adds the nullable users.avatar_path column (profile picture) to an existing database.
// Fresh installs get it from schema.sql. Safe to run repeatedly.
require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  const [cols] = await conn.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'avatar_path'"
  );
  if (cols.length === 0) {
    await conn.query('ALTER TABLE users ADD COLUMN avatar_path VARCHAR(255) NULL AFTER last_name');
    console.log('Added users.avatar_path.');
  } else {
    console.log('users.avatar_path already exists.');
  }

  await conn.end();
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
