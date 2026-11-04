// Explicit, optional local read-only export. Never run server/index.js or migrations.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const mysql = require('../../server/node_modules/mysql2/promise');
const config = require('../../server/node_modules/dotenv').parse(fs.readFileSync(path.join(root, 'server/.env')));
const { mastersFor } = require('../../server/lib/syllabuscheck/repository');
const { loadOutcomes } = require('../../server/lib/institution');
const { findProgram, loadResolvedProgram } = require('../../server/lib/programs');
(async () => {
  const connection = await mysql.createConnection({ host: config.DB_HOST, user: config.DB_USER, password: config.DB_PASS, database: config.DB_NAME, connectTimeout: 5000 });
  try {
    await connection.query('SET TRANSACTION READ ONLY');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    const queries = [];
    const db = { query: async (sql, params) => {
      if (!/^SELECT\b/i.test(sql.trim())) throw Error('Only SELECT permitted');
      queries.push(sql);
      return connection.query(sql, params);
    } };
    const institution = await loadOutcomes(db), programs = {};
    for (const code of ['BSIT', 'BSIE', 'BSCPE', 'BSIT-CYBERSECURITY']) {
      const program = await loadResolvedProgram(db, await findProgram(db, code));
      programs[code] = { versions: program.versions, inheritedFrom: program.inheritedFrom || null,
        masters: await mastersFor(db, { meta: { program: code } }) };
    }
    await connection.rollback();
    fs.writeFileSync(path.join(root, 'docs/lcup-approved-offline/masters.json'), JSON.stringify({ exportedAt: new Date().toISOString(), source: 'local MySQL read-only consistent transaction; production mastersFor; no syllabus records read', institutionVersion: institution.version, programs, queries, databaseWrites: 0 }, null, 2) + '\n');
    console.log('Read-only master export complete; four programs; zero database writes.');
  } finally { await connection.end(); }
})().catch(e => { console.error(e.code || e.message); process.exitCode = 1; });
