require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function init() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
  });

  console.log('Connected to MySQL.');

  await conn.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
  await conn.query(`USE ${process.env.DB_NAME}`);
  console.log(`Database "${process.env.DB_NAME}" ready.`);

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = schema.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    await conn.query(stmt);
  }
  console.log('Schema created.');

  // seed.sql holds DEMO accounts with publicly known passwords. They are for local development only: with NODE_ENV=staging or production they are never inserted
  // (create the first administrator with db/create-admin.js instead).
  if (['staging', 'production'].includes(String(process.env.NODE_ENV || '').trim().toLowerCase())) {
    console.log('Seed data skipped: NODE_ENV=' + process.env.NODE_ENV + ' never receives the demo accounts. Create the first administrator with: node db/create-admin.js');
  } else {
    const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    const seedStmts = seed.split(';').filter(s => s.trim());
    for (const stmt of seedStmts) {
      await conn.query(stmt);
    }
    console.log('Seed data inserted.');
  }

  await conn.end();
  console.log('Done.');
}

init().catch(err => {
  console.error('Init failed:', err.message);
  process.exit(1);
});
