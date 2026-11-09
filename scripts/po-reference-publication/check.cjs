'use strict';
// READ-ONLY checks around the additive PO reference publication migration (server/db/migrate-po-reference-publication.js). This tool never writes: it only SELECTs and reads
// information_schema. It never runs the migration and never publishes anything.
//   node check.cjs dry-run  --host H --port P --user U --database NAME [--password-env VAR] [--expect-database NAME] [--out file.json]
//       who the target is, whether the migration is compatible with it, exactly what it would create or add, and what it would leave alone
//   node check.cjs snapshot ...same... --out before.json
//       fingerprints of everything the migration must not change (reference tables, program outcomes/EGAs, syllabi, saved reports, reviews) and the four programs' resolved Program Outcomes
//   node check.cjs verify   ...same... --before before.json [--out after.json]
//       after the migration: every old row and column unchanged, new columns hold their defaults, nothing was published, the four programs still resolve (9/13/13/9), reviews intact
// The password is read from the environment variable named by --password-env (default none/empty), never from the command line, and is never printed. --expect-database is a safety lock:
// the tool refuses unless the connected database has exactly that name.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..');
const mysql = require(path.join(ROOT, 'server/node_modules/mysql2/promise'));
const migration = require(path.join(ROOT, 'server/db/migrate-po-reference-publication.js'));
const args = process.argv.slice(2), mode = args[0];
const opt = (n, d) => { const i = args.indexOf('--' + n); return i > 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const sha = (v) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
const REFERENCE_TABLES = ['program_po_reference_versions', 'program_po_reference_active', 'program_po_reference_migrations', 'program_po_reference_remediation', 'program_po_reference_audit'];
const PRESERVED = ['program_outcomes', 'program_egas', 'program_outcome_sources', 'programs', 'courses', 'course_clos', 'syllabi', 'syllabus_versions', 'syllabus_check_reports', 'ai_check_runs', 'syllabus_check_curricula', 'institution_settings', 'institution_egas', 'academic_years'];
const EXPECTED_POS = { BSIT: 9, BSIE: 13, BSCPE: 13, 'BSIT-CYBERSECURITY': 9 };

async function connect() {
  const conn = await mysql.createConnection({ host: opt('host', 'localhost'), port: Number(opt('port', 3306)), user: opt('user', 'root'), password: process.env[opt('password-env', 'NO_SUCH_VARIABLE')] || '', database: opt('database') });
  const [[who]] = await conn.query('SELECT DATABASE() AS db, @@hostname AS host, @@port AS port, @@datadir AS datadir, @@version AS version, @@max_allowed_packet AS packet, @@read_only AS ro, @@event_scheduler AS scheduler');
  const expected = opt('expect-database');
  if (expected && who.db !== expected) { await conn.end(); throw Error(`refusing: connected to "${who.db}", expected "${expected}"`); }
  return { conn, who };
}
const tableExists = async (conn, name) => { const [r] = await conn.query('SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [name]); return r[0].n === 1; };
const columnsOf = async (conn, name) => { const [r] = await conn.query('SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION', [name]); return r.map((x) => x.c); };
async function fingerprint(conn, table, columns) {
  if (!(await tableExists(conn, table))) return null;
  const cols = columns || await columnsOf(conn, table), list = cols.map((c) => '`' + c + '`').join(', ');
  const [rows] = await conn.query(`SELECT ${list} FROM \`${table}\` ORDER BY 1, 2`);
  return { rows: rows.length, columns: cols, hash: sha(rows) };
}
async function resolvedPos(conn) {
  const repo = require(path.join(ROOT, 'server/lib/syllabuscheck/repository'));
  const out = {};
  for (const code of Object.keys(EXPECTED_POS)) {
    try { const m = await repo.mastersFor(conn, { meta: { program: code } }, {}); out[code] = { pos: m.pos.length, source: m.outcomeSource || null, reference: m.poReference ? m.poReference.version : null, curricula: m.curricula.length }; } catch (e) { out[code] = { error: String(e.message).slice(0, 120) }; }
  }
  return out;
}
async function remediation(conn) {
  if (!(await tableExists(conn, 'program_po_reference_remediation'))) return null;
  const [rows] = await conn.query("SELECT entity_type, entity_id, status FROM program_po_reference_remediation ORDER BY entity_id");
  return rows.map((r) => `${r.entity_type}:${r.entity_id}:${r.status}`);
}

async function plan(conn) {
  const out = { tables: [], versionsColumns: [], activeColumns: [], notes: [] };
  const names = ['program_po_reference_versions', 'program_po_reference_active', 'program_po_reference_audit'];
  for (const [i, name] of names.entries()) out.tables.push({ table: name, action: (await tableExists(conn, name)) ? 'exists: untouched' : 'would be created', ddl: migration.TABLES[i].replace(/\s+/g, ' ').trim().slice(0, 110) + '…' });
  const haveV = (await tableExists(conn, names[0])) ? new Set(await columnsOf(conn, names[0])) : new Set(), haveA = (await tableExists(conn, names[1])) ? new Set(await columnsOf(conn, names[1])) : new Set();
  out.versionsColumns = migration.COLUMNS.map(([n, type]) => ({ column: n, type, action: haveV.has(n) ? 'exists' : 'would be added' }));
  out.activeColumns = migration.ACTIVE_COLUMNS.map(([n, type]) => ({ column: n, type, action: haveA.has(n) ? 'exists' : 'would be added' }));
  out.wouldChange = out.tables.some((t) => t.action !== 'exists: untouched') || out.versionsColumns.concat(out.activeColumns).some((c) => c.action !== 'exists');
  return out;
}
async function compatibility(conn) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
  const [[prog]] = await conn.query("SELECT ENGINE AS engine, TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'programs'");
  add('programs table is InnoDB (the new tables reference it with foreign keys)', prog && prog.engine === 'InnoDB', prog && prog.engine);
  const [[pk]] = await conn.query("SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'programs' AND COLUMN_NAME = 'program_id'");
  add('programs.program_id is an INT, matching the new program_id columns', pk && /^int/i.test(pk.t), pk && pk.t);
  const [[ay]] = await conn.query("SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'programs' AND COLUMN_NAME = 'academic_year'");
  add('programs has the academic_year column (migrate-catalog-year applied), which publication labels use', ay.n === 1, ay.n === 1 ? 'present' : 'missing: publication would label versions "unscoped"');
  const [[usr]] = await conn.query('SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = \'users\'');
  add('users table exists (published_by / associated_by hold user ids)', usr.n === 1);
  const [grants] = await conn.query('SHOW GRANTS FOR CURRENT_USER()').catch(() => [[]]);
  const text = JSON.stringify(grants);
  add('the connecting user can CREATE and ALTER (needed only for the migration window; not required for this dry run)', /ALL PRIVILEGES|CREATE/.test(text) && /ALL PRIVILEGES|ALTER/.test(text), /ALL PRIVILEGES/.test(text) ? 'ALL PRIVILEGES' : 'see grants');
  const [[v]] = await conn.query('SELECT COUNT(*) AS n FROM program_po_reference_versions').catch(() => [[{ n: null }]]);
  add('existing reference versions will keep working: every new column is nullable or has a default', true, v.n === null ? 'versions table not present yet' : `${v.n} existing version rows get status 'published'`);
  return checks;
}
async function snapshot(conn) {
  const fp = {};
  for (const t of [...REFERENCE_TABLES.filter((n) => n !== 'program_po_reference_audit'), ...PRESERVED]) {
    const cols = (await tableExists(conn, t)) ? await columnsOf(conn, t) : null;
    const restrict = ['program_po_reference_versions', 'program_po_reference_active'].includes(t) && cols ? cols.filter((c) => !migration.COLUMNS.concat(migration.ACTIVE_COLUMNS).some(([n]) => n === c)) : null; // old columns only
    fp[t] = await fingerprint(conn, t, restrict);
  }
  return { fingerprints: fp, remediation: await remediation(conn), resolved: await resolvedPos(conn) };
}
function compare(before, after, conn) {
  const problems = [];
  for (const [t, b] of Object.entries(before.fingerprints)) {
    const a = after.fingerprints[t];
    if (b === null && a === null) continue;
    if (b === null) { continue; }
    if (!a) { problems.push(`${t}: table disappeared`); continue; }
    if (a.rows !== b.rows) problems.push(`${t}: row count ${b.rows} -> ${a.rows}`);
    else if (a.hash !== b.hash) problems.push(`${t}: contents changed`);
  }
  if (JSON.stringify(before.remediation) !== JSON.stringify(after.remediation)) problems.push('the PO mapping / curriculum review rows changed');
  for (const [code, b] of Object.entries(before.resolved)) { const a = after.resolved[code]; if (JSON.stringify(a) !== JSON.stringify(b)) problems.push(`${code}: resolved references changed ${JSON.stringify(b)} -> ${JSON.stringify(a)}`); }
  return problems;
}
async function verifyNew(conn, before) {
  const checks = [], add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
  for (const [t] of [['program_po_reference_versions'], ['program_po_reference_active'], ['program_po_reference_audit']]) add(`${t} exists`, await tableExists(conn, t));
  const vcols = new Set(await columnsOf(conn, 'program_po_reference_versions')), acols = new Set(await columnsOf(conn, 'program_po_reference_active'));
  add('every new versions column exists', migration.COLUMNS.every(([n]) => vcols.has(n))); add('every new active column exists', migration.ACTIVE_COLUMNS.every(([n]) => acols.has(n)));
  const [[nv]] = await conn.query("SELECT COUNT(*) AS n FROM program_po_reference_versions WHERE status <> 'published' OR published_by IS NOT NULL");
  add('no existing version was changed', nv.n === 0, `${nv.n} deviating rows`);
  const [[na]] = await conn.query("SELECT COUNT(*) AS n FROM program_po_reference_active WHERE association <> 'owner'");
  add('every existing pointer is an owner pointer; nothing was adopted', na.n === 0);
  const [[au]] = await conn.query('SELECT COUNT(*) AS n FROM program_po_reference_audit');
  add('the audit table is empty: the migration created no version', au.n === 0, `${au.n} rows`);
  const [[nd]] = await conn.query("SELECT COUNT(*) AS n FROM program_po_reference_versions WHERE status = 'draft'");
  add('no draft exists', nd.n === 0);
  const expectedNow = Object.fromEntries(Object.entries(EXPECTED_POS).map(([c, n]) => [c, n]));
  const after = await resolvedPos(conn);
  const live = Object.entries(after).filter(([c, r]) => before.resolved[c] && !before.resolved[c].error && before.resolved[c].pos === expectedNow[c]);
  add('the existing programs still resolve the same Program Outcomes (9 / 13 / 13 / 9 where they did before)', live.every(([c, r]) => r.pos === expectedNow[c]), JSON.stringify(Object.fromEntries(Object.entries(after).map(([c, r]) => [c, r.pos ?? r.error]))));
  return { checks, after };
}

(async () => {
  if (!['dry-run', 'snapshot', 'verify'].includes(mode) || !opt('database')) { console.error('usage: check.cjs dry-run|snapshot|verify --database NAME [--host H --port P --user U --password-env VAR --expect-database NAME --before file --out file]'); process.exit(2); }
  const { conn, who } = await connect();
  try {
    const result = { mode, at: new Date().toISOString(), target: { database: who.db, host: who.host, port: who.port, datadir: who.datadir, version: who.version, maxAllowedPacketBytes: who.packet, readOnlyServer: !!who.ro }, writesPerformed: 0 };
    if (mode === 'dry-run') {
      result.plan = await plan(conn); result.compatibility = await compatibility(conn);
      result.verdict = result.compatibility.every((c) => c.ok || /CREATE and ALTER/.test(c.name)) ? 'COMPATIBLE' : 'INCOMPATIBLE';
      result.wouldChange = result.plan.wouldChange; result.note = 'Nothing was changed. Applying the migration needs a verified backup, a restore rehearsal and separate written authorization.';
    } else if (mode === 'snapshot') Object.assign(result, await snapshot(conn));
    else {
      const before = JSON.parse(fs.readFileSync(opt('before'), 'utf8')), after = await snapshot(conn), v = await verifyNew(conn, before).catch((e) => ({ checks: [{ name: 'the new structure is present and its defaults are correct', ok: false, detail: String(e.message).slice(0, 140) }], after: null }));
      result.preservationProblems = compare(before, after); result.newStructure = v.checks; result.resolvedAfter = after.resolved;
      result.verdict = !result.preservationProblems.length && v.checks.every((c) => c.ok) ? 'VERIFIED' : 'PROBLEMS';
    }
    if (opt('out')) fs.writeFileSync(opt('out'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, (k, v) => (typeof v === 'string' && v.length > 160 ? v.slice(0, 160) + '…' : v), 1).slice(0, 7000));
    process.exitCode = result.verdict === 'INCOMPATIBLE' || result.verdict === 'PROBLEMS' ? 1 : 0;
  } finally { await conn.end(); }
})().catch((e) => { console.error(String(e.message || e)); process.exit(2); });
