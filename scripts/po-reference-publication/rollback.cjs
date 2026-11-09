'use strict';
// Reverses ONLY the additive PO reference publication migration, and only while nothing has been published through it. It removes the columns and the audit table that the migration added;
// it never touches a reference version, a pointer, a Program Outcome, a syllabus or a report. It REFUSES if any administrator-published version, draft, adoption or audit row exists (that
// would be data this tool must not delete: the recovery then is the backup, under separate authorization).
//   node rollback.cjs --database NAME --expect-database NAME --confirm-authorized [--host H --port P --user U --password-env VAR]
// WRITES to the target. Never run it against an environment without the written authorization that the activation plan requires; it is exercised only on the synthetic rehearsal database.
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const mysql = require(path.join(ROOT, 'server/node_modules/mysql2/promise'));
const migration = require(path.join(ROOT, 'server/db/migrate-po-reference-publication.js'));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
(async () => {
  if (!opt('database') || opt('expect-database') !== opt('database') || !args.includes('--confirm-authorized')) { console.error('refusing: --database, a matching --expect-database and --confirm-authorized are all required'); process.exit(2); }
  const conn = await mysql.createConnection({ host: opt('host', 'localhost'), port: Number(opt('port', 3306)), user: opt('user', 'root'), password: process.env[opt('password-env', 'NO_SUCH_VARIABLE')] || '', database: opt('database') });
  try {
    const [[who]] = await conn.query('SELECT DATABASE() AS db'); if (who.db !== opt('expect-database')) throw Error(`refusing: connected to "${who.db}"`);
    const count = async (sql) => (await conn.query(sql))[0][0].n;
    const blockers = [];
    const has = async (t) => (await count(`SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${t}'`)) === 1;
    if (await has('program_po_reference_audit') && await count('SELECT COUNT(*) AS n FROM program_po_reference_audit') > 0) blockers.push('the audit table has rows');
    const vcols = new Set((await conn.query("SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'program_po_reference_versions'"))[0].map((r) => r.c));
    if (vcols.has('status') && await count("SELECT COUNT(*) AS n FROM program_po_reference_versions WHERE status <> 'published' OR published_by IS NOT NULL") > 0) blockers.push('an administrator-published version or a draft exists');
    const acols = new Set((await conn.query("SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'program_po_reference_active'"))[0].map((r) => r.c));
    if (acols.has('association') && await count("SELECT COUNT(*) AS n FROM program_po_reference_active WHERE association <> 'owner'") > 0) blockers.push('an academic-year association exists');
    if (blockers.length) { console.error('REFUSED, data would be lost: ' + blockers.join('; ') + '. Recover from the verified backup under separate authorization instead.'); process.exit(1); }
    const dropped = [];
    for (const [n] of migration.ACTIVE_COLUMNS) if (acols.has(n)) { await conn.query(`ALTER TABLE program_po_reference_active DROP COLUMN ${n}`); dropped.push('active.' + n); }
    for (const [n] of migration.COLUMNS) if (vcols.has(n)) { await conn.query(`ALTER TABLE program_po_reference_versions DROP COLUMN ${n}`); dropped.push('versions.' + n); }
    if (await has('program_po_reference_audit')) { await conn.query('DROP TABLE program_po_reference_audit'); dropped.push('table program_po_reference_audit'); }
    console.log(JSON.stringify({ rolledBack: true, removed: dropped, untouched: 'every reference version, pointer, Program Outcome, syllabus and report' }, null, 1));
  } finally { await conn.end(); }
})().catch((e) => { console.error(String(e.message || e)); process.exit(2); });
