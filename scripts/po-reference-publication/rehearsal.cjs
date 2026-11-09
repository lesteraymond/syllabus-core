'use strict';
// Rehearsal of the additive PO reference publication migration on a SYNTHETIC database that has the OLD schema (the four program_po_reference_* tables as the controlled official-PO migration
// made them, with the four official programs, their official versions and active pointers, eight needs_review rows and a syllabus with a saved report). ISOLATED ONLY: it refuses any
// database whose name does not contain "e2e", any non-loopback host, and any port except E2E_DB_PORT. Steps and evidence: snapshot -> dry run -> apply migration -> verify -> apply it again
// (idempotent) -> rollback -> verify the old state is restored -> apply once more.
//   E2E_DB_PORT=43312 node scripts/po-reference-publication/rehearsal.cjs [--out file.json]
const path = require('node:path'), fs = require('node:fs'), cp = require('node:child_process');
const ROOT = path.resolve(__dirname, '../..');
const PORT = process.env.E2E_DB_PORT, NAME = process.env.E2E_DB_NAME || 'syllabus_e2e_rehearsal';
if (!PORT || !/e2e/i.test(NAME)) { console.error('refusing: E2E_DB_PORT and an e2e database name are required'); process.exit(2); }
const mysql = require(path.join(ROOT, 'server/node_modules/mysql2/promise'));
const official = require(path.join(ROOT, 'src/data/officialProgramOutcomes.json'));
const outFile = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : '';
const log = []; const step = (name, ok, detail) => { log.push({ step: name, ok: !!ok, ...(detail !== undefined ? { detail } : {}) }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 200) : '')); };
const run = (script, extra) => cp.spawnSync(process.execPath, [path.join(ROOT, script), ...extra], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, DB_HOST: '127.0.0.1', DB_PORT: PORT, DB_USER: 'root', DB_PASS: '', DB_NAME: NAME } });
const target = ['--host', '127.0.0.1', '--port', PORT, '--user', 'root', '--database', NAME, '--expect-database', NAME];
const OLD_DDL = [
  'CREATE TABLE program_po_reference_versions (reference_id VARCHAR(100) PRIMARY KEY, program_id INT NOT NULL, version_label VARCHAR(80) NOT NULL, source_file VARCHAR(500) NOT NULL, source_sha256 CHAR(64) NOT NULL, outcomes_json LONGTEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(program_id) REFERENCES programs(program_id) ON DELETE RESTRICT)',
  'CREATE TABLE program_po_reference_active (program_id INT PRIMARY KEY, reference_id VARCHAR(100) NOT NULL, FOREIGN KEY(program_id) REFERENCES programs(program_id) ON DELETE RESTRICT, FOREIGN KEY(reference_id) REFERENCES program_po_reference_versions(reference_id) ON DELETE RESTRICT)',
  'CREATE TABLE IF NOT EXISTS program_po_reference_migrations (migration_id VARCHAR(80) PRIMARY KEY, status VARCHAR(30) NOT NULL, backup_sha256 CHAR(64) NOT NULL, after_json LONGTEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
  'CREATE TABLE IF NOT EXISTS program_po_reference_remediation (migration_id VARCHAR(80) NOT NULL, entity_type VARCHAR(30) NOT NULL, entity_id INT NOT NULL, status VARCHAR(30) NOT NULL, details_json LONGTEXT NOT NULL, PRIMARY KEY(migration_id, entity_type, entity_id), FOREIGN KEY(migration_id) REFERENCES program_po_reference_migrations(migration_id) ON DELETE RESTRICT)',
];
(async () => {
  const admin = await mysql.createConnection({ host: '127.0.0.1', port: Number(PORT), user: 'root', password: '' });
  await admin.query('DROP DATABASE IF EXISTS ??', [NAME]); await admin.end();
  // 1. a fresh bootstrap of the repository schema, then put the four reference tables back to their OLD definitions (what development has today)
  const boot = cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts/e2e/db-bootstrap-check.cjs')], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, E2E_DB_PORT: PORT, E2E_DB_NAME: NAME, E2E_KEEP: '1' } });
  step('a scratch database was bootstrapped from the repository', boot.status === 0, (boot.stdout || '').trim().slice(-120));
  const db = await mysql.createConnection({ host: '127.0.0.1', port: Number(PORT), user: 'root', password: '', database: NAME });
  await db.query('SET FOREIGN_KEY_CHECKS=0');
  for (const t of ['program_po_reference_audit', 'program_po_reference_remediation', 'program_po_reference_migrations', 'program_po_reference_active', 'program_po_reference_versions']) await db.query(`DROP TABLE IF EXISTS ${t}`);
  await db.query('SET FOREIGN_KEY_CHECKS=1');
  for (const ddl of OLD_DDL) await db.query(ddl);
  // 2. synthetic old-state data: the four official programs with their official versions, eight reviews, a syllabus with a saved report
  await db.query('DELETE FROM program_outcome_sources'); await db.query('DELETE FROM program_outcomes'); await db.query('DELETE FROM program_egas'); await db.query('SET FOREIGN_KEY_CHECKS=0'); await db.query('DELETE FROM programs'); await db.query('SET FOREIGN_KEY_CHECKS=1');
  await db.query('INSERT INTO academic_years (label, start_year, is_current) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE is_current = 1', ['2026–2027', 2026]);
  const ids = {};
  for (const [code, name] of [['BSIT', 'BS Information Technology'], ['BSIE', 'BS Industrial Engineering'], ['BSCPE', 'BS Computer Engineering'], ['BSIT-CYBERSECURITY', 'BSIT - Cyber Security']]) { const [r] = await db.query('INSERT INTO programs (code, name, academic_year) VALUES (?, ?, ?)', [code, name, '2026–2027']); ids[code] = r.insertId; await db.query('INSERT INTO program_egas (program_id, ega_no, name, short_name) VALUES (?, 1, ?, ?)', [r.insertId, 'Synthetic EGA', 'EGA1']); }
  for (const code of ['BSIT', 'BSIE', 'BSCPE']) {
    const ref = official.programs[code], id = `lcup-po-2026-10-29-${code}`;
    for (const p of ref.outcomes) await db.query('INSERT INTO program_outcomes (program_id, po_no, short_name, outcome_text, ega_nos) VALUES (?, ?, ?, ?, ?)', [ids[code], p.no, p.short, p.text, '']);
    await db.query('INSERT INTO program_po_reference_versions (reference_id, program_id, version_label, source_file, source_sha256, outcomes_json) VALUES (?, ?, ?, ?, ?, ?)', [id, ids[code], official.version, ref.sourceFile, ref.sha256, JSON.stringify(ref.outcomes)]);
    await db.query('INSERT INTO program_po_reference_active (program_id, reference_id) VALUES (?, ?)', [ids[code], id]);
  }
  await db.query('INSERT INTO program_outcome_sources (program_id, source_program_id, specialization) VALUES (?, ?, ?)', [ids['BSIT-CYBERSECURITY'], ids.BSIT, 'Cyber Security']);
  await db.query("INSERT INTO program_po_reference_migrations (migration_id, status, backup_sha256, after_json) VALUES ('lcup-po-2026-10-29', 'applied', ?, '{}')", ['0'.repeat(64)]);
  for (const id of [43, 93, 97, 99, 100, 101, 102]) await db.query("INSERT INTO program_po_reference_remediation (migration_id, entity_type, entity_id, status, details_json) VALUES ('lcup-po-2026-10-29', 'syllabus', ?, 'needs_review', '{\"cloMappings\":true}')", [id]);
  await db.query("INSERT INTO program_po_reference_remediation (migration_id, entity_type, entity_id, status, details_json) VALUES ('lcup-po-2026-10-29', 'syllabus', 110, 'needs_review', '{\"curriculumReview\":true}')");
  await db.query("INSERT INTO syllabus_check_curricula (program_code, curriculum_year, status, source, courses_json) VALUES ('BSIT', '2022-2023', 'approved', 'synthetic', '[]'), ('BSIE', '2022-2023', 'approved', 'synthetic', '[]'), ('BSCPE', '2022-2023', 'approved', 'synthetic', '[]')");
  const [[inst]] = await db.query('SELECT COUNT(*) AS n FROM institution_settings'); if (!inst.n) await db.query("INSERT INTO institution_settings (setting_id, vision, mission_lead, mission_items) VALUES (1, 'Synthetic vision', 'Synthetic lead', '[]')");
  await db.query("INSERT IGNORE INTO institution_egas (ega_no, name, short_name) VALUES (1, 'Synthetic EGA', 'EGA1')");
  const cols = (await db.query("SELECT COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'program_po_reference_versions'"))[0].map((r) => r.c);
  step('the rehearsal database has the OLD schema and the old data', cols.length === 7 && !cols.includes('status'), cols.join(','));
  await db.end();
  const tmp = path.join(require('node:os').tmpdir(), 'po-ref-rehearsal'); fs.mkdirSync(tmp, { recursive: true });
  // 3. snapshot, dry run
  const snap = run('scripts/po-reference-publication/check.cjs', ['snapshot', ...target, '--out', path.join(tmp, 'before.json')]);
  const before = JSON.parse(fs.readFileSync(path.join(tmp, 'before.json'), 'utf8'));
  step('snapshot: the four programs resolve 9 / 13 / 13 / 9 from the old schema', snap.status === 0 && ['BSIT', 'BSIE', 'BSCPE', 'BSIT-CYBERSECURITY'].map((c) => before.resolved[c].pos).join('/') === [official.programs.BSIT.outcomes.length, official.programs.BSIE.outcomes.length, official.programs.BSCPE.outcomes.length, official.programs.BSIT.outcomes.length].join('/'), JSON.stringify(before.resolved));
  step('snapshot: the eight reviews are present', before.remediation.length === 8, before.remediation.join(' '));
  const dry = run('scripts/po-reference-publication/check.cjs', ['dry-run', ...target, '--out', path.join(tmp, 'dry.json')]);
  const dryJson = JSON.parse(fs.readFileSync(path.join(tmp, 'dry.json'), 'utf8'));
  step('dry run: COMPATIBLE and says exactly what it would add, with zero writes', dry.status === 0 && dryJson.verdict === 'COMPATIBLE' && dryJson.writesPerformed === 0 && dryJson.plan.versionsColumns.filter((c) => c.action === 'would be added').length === 6 && dryJson.plan.activeColumns.filter((c) => c.action === 'would be added').length === 4 && dryJson.plan.tables.some((t) => /audit/.test(t.table) && t.action === 'would be created'), dryJson.verdict);
  const still = run('scripts/po-reference-publication/check.cjs', ['verify', ...target, '--before', path.join(tmp, 'before.json'), '--out', path.join(tmp, 'noop.json')]);
  step('the dry run changed nothing (a verification against the snapshot finds the old structure and no preservation problem; only the new structure is reported missing)', JSON.parse(fs.readFileSync(path.join(tmp, 'noop.json'), 'utf8')).preservationProblems.length === 0 && still.status === 1);
  // 4. apply, verify
  const apply = run('server/db/migrate-po-reference-publication.js', []);
  step('the migration ran', apply.status === 0, (apply.stdout || apply.stderr).trim());
  const ver = run('scripts/po-reference-publication/check.cjs', ['verify', ...target, '--before', path.join(tmp, 'before.json'), '--out', path.join(tmp, 'after.json')]);
  const after = JSON.parse(fs.readFileSync(path.join(tmp, 'after.json'), 'utf8'));
  step('verification: VERIFIED (old rows and columns unchanged, defaults in place, nothing published, the four programs still resolve, the eight reviews intact)', ver.status === 0 && after.verdict === 'VERIFIED', after.preservationProblems.concat(after.newStructure.filter((c) => !c.ok).map((c) => c.name)));
  step('the existing official versions are still read as official sources (not as administrator publications)', (() => { const r = after.resolvedAfter; return r.BSIT.reference === official.version && r.BSIE.reference === official.version && r.BSCPE.reference === official.version && r['BSIT-CYBERSECURITY'].source === 'BSIT'; })(), JSON.stringify(after.resolvedAfter));
  const again = run('server/db/migrate-po-reference-publication.js', []);
  const ver2 = run('scripts/po-reference-publication/check.cjs', ['verify', ...target, '--before', path.join(tmp, 'before.json')]);
  step('applying it again is harmless (idempotent)', again.status === 0 && ver2.status === 0);
  // 5. rollback, only while nothing is published
  const refuse = run('scripts/po-reference-publication/rollback.cjs', ['--database', NAME]);
  step('rollback refuses without the confirmation and expectation flags', refuse.status === 2);
  const back = run('scripts/po-reference-publication/rollback.cjs', ['--database', NAME, '--expect-database', NAME, '--confirm-authorized', '--host', '127.0.0.1', '--port', PORT]);
  step('rollback removed only the added structure', back.status === 0 && /rolledBack/.test(back.stdout), (back.stdout || back.stderr).replace(/\s+/g, ' ').slice(0, 160));
  const restored = run('scripts/po-reference-publication/check.cjs', ['verify', ...target, '--before', path.join(tmp, 'before.json'), '--out', path.join(tmp, 'restored.json')]);
  const rj = JSON.parse(fs.readFileSync(path.join(tmp, 'restored.json'), 'utf8'));
  step('after the rollback the database equals the snapshot again (no preservation problem; the new structure is gone)', rj.preservationProblems.length === 0 && rj.newStructure.some((c) => !c.ok));
  // 6. rollback is refused once something is published
  run('server/db/migrate-po-reference-publication.js', []);
  const c2 = await mysql.createConnection({ host: '127.0.0.1', port: Number(PORT), user: 'root', password: '', database: NAME });
  await c2.query("INSERT INTO program_po_reference_audit (program_id, action, details_json) VALUES (?, 'published', '{}')", [ids.BSIT]); await c2.end();
  const blocked = run('scripts/po-reference-publication/rollback.cjs', ['--database', NAME, '--expect-database', NAME, '--confirm-authorized', '--host', '127.0.0.1', '--port', PORT]);
  step('once a publication is recorded the rollback refuses (it would lose data); recovery is the backup', blocked.status === 1 && /REFUSED/.test(blocked.stderr));
  const ok = log.every((l) => l.ok);
  const report = { kind: 'REHEARSAL on a synthetic old-schema database (isolated port ' + PORT + '); no existing database was touched', database: NAME, at: new Date().toISOString(), allPassed: ok, steps: log };
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(ok ? '\nREHEARSAL PASSED' : '\nREHEARSAL FAILED'); process.exitCode = ok ? 0 : 1;
})().catch((e) => { console.error(e); process.exit(2); });
