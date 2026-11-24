require('dotenv').config();
const mysql = require('mysql2/promise');
const { migrate } = require('./program-management-ddl');
(async () => {
  const db = await mysql.createConnection(require('../lib/dbConfig').resolveConnectionConfig());
  try { await migrate(db); console.log('Program management migration complete; existing records preserved.'); }
  finally { await db.end(); }
})().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
