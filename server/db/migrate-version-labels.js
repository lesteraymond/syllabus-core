// Renumbers syllabus versions as whole numbers: v1, v2, v3 ... instead of v1.0, v1.1, v1.2 (2026-11-24: "v1.1" read as confusing).
//   syllabus_versions.version_label  each syllabus's versions, oldest first, become v1, v2, v3 ... (the order they were saved in, by version_id)
//   syllabi.version                  the label of the version it named, renumbered the same way; a syllabus with no saved version yet is v1
//   syllabi.version DEFAULT          'v1' (was 'v1.0'), for rows inserted without a version
// Only labels change: version ids, contents, checks and review stages (all keyed by version_id) are untouched. Text already written into
// activity notes or emails ("Submitted v1.1") stays as it was written.
// Idempotent: a second run finds every label already numbered and changes nothing. One transaction: all or nothing.
// Run: npm run migrate-version-labels (from server/); add --dry-run to see what it would change and change nothing.
// Take a database backup first; the old labels are not kept anywhere else.
require('dotenv').config();
const mysql = require('mysql2/promise');
const { versionNumber, FIRST_VERSION } = require('../lib/syllabusRules');

// The new labels, worked out without touching the database: { versions: [{ id, from, to }], syllabi: [{ id, from, to }] } (changes only).
function plan(versionRows, syllabusRows) {
  const versions = [];
  const renamed = new Map(); // syllabus id -> Map(old label -> new label of its newest version with that label)
  let current = null, n = 0;
  for (const v of versionRows) { // ordered by syllabus_id, version_id
    if (v.syllabus_id !== current) { current = v.syllabus_id; n = 0; renamed.set(current, new Map()); }
    const to = 'v' + (++n);
    renamed.get(current).set(v.version_label, to);
    if (v.version_label !== to) versions.push({ id: v.version_id, syllabusId: v.syllabus_id, from: v.version_label, to });
  }
  const syllabi = [];
  for (const s of syllabusRows) {
    const known = renamed.get(s.syllabus_id);
    const to = (known && known.get(s.version)) || (versionNumber(s.version) > 0 ? 'v' + versionNumber(s.version) : FIRST_VERSION);
    if (s.version !== to) syllabi.push({ id: s.syllabus_id, from: s.version, to });
  }
  return { versions, syllabi };
}

async function migrate(conn, { dryRun = false } = {}) {
  const [versionRows] = await conn.query('SELECT version_id, syllabus_id, version_label FROM syllabus_versions ORDER BY syllabus_id, version_id');
  const [syllabusRows] = await conn.query('SELECT syllabus_id, version FROM syllabi');
  const changes = plan(versionRows, syllabusRows);
  if (dryRun) return { ...changes, dryRun: true };
  await conn.beginTransaction();
  try {
    for (const v of changes.versions) await conn.query('UPDATE syllabus_versions SET version_label = ? WHERE version_id = ?', [v.to, v.id]);
    for (const s of changes.syllabi) await conn.query('UPDATE syllabi SET version = ? WHERE syllabus_id = ?', [s.to, s.id]);
    await conn.commit();
  } catch (err) { await conn.rollback(); throw err; }
  await conn.query("ALTER TABLE syllabi ALTER COLUMN version SET DEFAULT 'v1'"); // DDL: outside the transaction (it would commit it)
  return changes;
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  (async () => {
    const conn = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME }); // same connection as every migrate-* script
    try {
      const r = await migrate(conn, { dryRun });
      const tag = dryRun ? '[dry run] would renumber' : 'renumbered';
      console.log(`${tag} ${r.versions.length} version label(s) and ${r.syllabi.length} syllabus version(s)`);
      for (const v of r.versions.slice(0, 20)) console.log(`  version ${v.id} (syllabus ${v.syllabusId}): ${v.from} -> ${v.to}`);
      if (r.versions.length > 20) console.log(`  ... and ${r.versions.length - 20} more`);
      if (!dryRun) console.log("syllabi.version default is now 'v1'");
    } finally { await conn.end(); }
  })().catch((e) => { console.error('migrate-version-labels failed:', e.code || e.message); process.exit(1); });
}

module.exports = { migrate, plan };
