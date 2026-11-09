'use strict';
// Creates the FIRST administrator of a new (staging or production) database, so no demo account with a known password is ever needed.
//   CREATE_ADMIN_EMAIL=<email> CREATE_ADMIN_PASSWORD=<temporary password> [CREATE_ADMIN_FIRST=<first>] [CREATE_ADMIN_LAST=<last>] node db/create-admin.js
// The password comes from the environment, never from the command line (a command line is visible to other users and is kept in shell history), is checked with the
// application's own password rule, is stored only as a bcrypt hash, and is never printed. The account must change it at the first sign-in (must_change_password = 1).
// It refuses to overwrite an existing account. DB_* come from the environment / server/.env like every other script in this folder.
const bcrypt = require('bcryptjs');
const { validatePassword } = require('../lib/passwords');

async function createAdmin(db, { email, password, first = 'System', last = 'Administrator' }) {
  const address = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) throw new Error('CREATE_ADMIN_EMAIL must be an email address.');
  const problem = validatePassword(password, { email: address });
  if (problem) throw new Error(problem);
  const [existing] = await db.query('SELECT user_id FROM users WHERE LOWER(email) = ?', [address]);
  if (existing.length) throw new Error('An account with that email already exists; nothing was changed.');
  const hash = await bcrypt.hash(String(password), 10);
  const [result] = await db.query('INSERT INTO users (email, password_hash, must_change_password, role, first_name, last_name) VALUES (?, ?, 1, ?, ?, ?)', [address, hash, 'admin', first, last]);
  return result.insertId;
}

module.exports = { createAdmin };

if (require.main === module) {
  require('dotenv').config();
  const mysql = require('mysql2/promise');
  (async () => {
    const conn = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
    try {
      const id = await createAdmin(conn, { email: process.env.CREATE_ADMIN_EMAIL, password: process.env.CREATE_ADMIN_PASSWORD, first: process.env.CREATE_ADMIN_FIRST || undefined, last: process.env.CREATE_ADMIN_LAST || undefined });
      console.log('Administrator created (user id ' + id + '). It must change its password at the first sign-in.');
    } finally { await conn.end(); }
  })().catch((error) => { console.error('create-admin failed: ' + error.message); process.exit(1); });
}
