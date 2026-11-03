require('dotenv').config();
const mysql = require('mysql2/promise');
async function main() {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  try {
    for (const ddl of [...require('./compliance-ddl'), ...require('./syllabuscheck-ddl')]) await db.query(ddl);
    const [normalized] = await db.query(`UPDATE ai_check_runs r
      JOIN syllabus_check_reports h ON h.run_id = r.run_id
      SET r.overall = NULL, r.passed = 0, r.status = 'incomplete'
      WHERE JSON_UNQUOTE(JSON_EXTRACT(h.report_json, '$.hybrid.ready')) = 'false'
        AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(h.report_json, '$.hybrid.critical')), 'false') <> 'true'
        AND (r.overall IS NOT NULL OR r.passed <> 0 OR r.status <> 'incomplete')`);
    console.log('Incomplete historical scores normalized: ' + normalized.affectedRows + '. Syllabus content and decisions were not changed.');
    console.log('Hybrid syllabus-check tables are ready. No curriculum records were invented or approved.');
  } finally { await db.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
