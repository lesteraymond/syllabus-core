require('dotenv').config();
const mysql = require('mysql2/promise');
const { migrate } = require('./program-management-ddl');
(async () => {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  try { await migrate(db); console.log('Program management migration complete; existing records preserved.'); }
  finally { await db.end(); }
})().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
