'use strict';
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
async function migrate(db) {
  const [rows] = await db.query('SHOW INDEX FROM courses');
  const indexes = new Map();
  for (const row of rows) {
    if (row.Non_unique || row.Key_name === 'PRIMARY') continue;
    if (!indexes.has(row.Key_name)) indexes.set(row.Key_name, []);
    indexes.get(row.Key_name)[row.Seq_in_index - 1] = row.Column_name;
  }
  const scoped = [...indexes.values()].some(cols => cols.join(',') === 'program_id,code');
  if (!scoped) await db.query('ALTER TABLE courses ADD UNIQUE KEY courses_program_code (program_id, code)');
  for (const [name, cols] of indexes) if (cols.join(',') === 'code') {
    // Index names come only from server metadata and are escaped as identifiers.
    await db.query('ALTER TABLE courses DROP INDEX `' + name.replaceAll('`', '``') + '`');
  }
  return { uniqueness: 'program_id,code' };
}
if (require.main === module) (async () => {
  const db = await require('mysql2/promise').createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  try { console.log(JSON.stringify(await migrate(db))); } finally { await db.end(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { migrate };
