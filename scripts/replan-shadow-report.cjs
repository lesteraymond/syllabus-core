'use strict';
// Read-only view of the re-planned AI Checker's shadow results, next to the official (old checker) numbers of the same checks.
//
//   node scripts/replan-shadow-report.cjs                    the latest 10 checks that carry a shadow result
//   node scripts/replan-shadow-report.cjs --limit 30         more of them
//   node scripts/replan-shadow-report.cjs --syllabus 12      only the checks of syllabus 12
//   node scripts/replan-shadow-report.cjs --run 345          everything the new checker found in check 345
//   add --json for machine-readable output
//
// It reads the development database named in server/.env inside a READ ONLY transaction and only runs SELECT statements: it changes nothing,
// sends nothing to any AI provider, and prints no setting from server/.env. Output stays in this terminal.
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const { summarize, renderList, renderDetail } = require('../server/lib/syllabuscheck/pipeline/shadowReport');

const args = process.argv.slice(2);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const intArg = (name, fallback, max) => { const raw = value(name); if (raw === undefined) return fallback; const n = Number.parseInt(raw, 10); if (!Number.isInteger(n) || n < 1 || n > max) throw Error(`${name} must be a whole number from 1 to ${max}`); return n; };

const BASE = 'SELECT r.run_id, r.syllabus_id, r.created_at, r.overall, s.course_code, s.title, p.report_json FROM syllabus_check_reports p JOIN ai_check_runs r ON r.run_id = p.run_id LEFT JOIN syllabi s ON s.syllabus_id = r.syllabus_id';

async function main() {
  const run = intArg('--run', null, 2147483647), syllabus = intArg('--syllabus', null, 2147483647), limit = intArg('--limit', 10, 200);
  const env = require('../server/node_modules/dotenv').parse(fs.readFileSync(path.join(root, 'server', '.env')));
  const mysql = require('../server/node_modules/mysql2/promise');
  const conn = await mysql.createConnection({ host: env.DB_HOST, user: env.DB_USER, password: env.DB_PASS, database: env.DB_NAME });
  try {
    await conn.query('START TRANSACTION READ ONLY');
    let rows;
    if (run) [rows] = await conn.query(`${BASE} WHERE r.run_id = ?`, [run]);
    else if (syllabus) [rows] = await conn.query(`${BASE} WHERE r.syllabus_id = ? AND p.report_json LIKE ? ORDER BY r.run_id DESC LIMIT ?`, [syllabus, '%"replanShadow"%', limit]);
    else [rows] = await conn.query(`${BASE} WHERE p.report_json LIKE ? ORDER BY r.run_id DESC LIMIT ?`, ['%"replanShadow"%', limit]);
    await conn.query('ROLLBACK');
    const items = rows.map(summarize);
    if (args.includes('--json')) { console.log(JSON.stringify(run ? items[0] || null : items, null, 2)); return; }
    if (run) console.log(items[0] ? renderDetail(items[0]) : `No stored report for check ${run}.`);
    else console.log(renderList(items));
  } finally { await conn.end(); }
}

if (require.main === module) main().catch(error => { console.error('replan-shadow-report failed:', error.code || error.message); process.exitCode = 1; });
module.exports = { BASE };
