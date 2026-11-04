// Links a specialization to the program whose Program Outcomes (and EGAs) it inherits, so the checker keeps ONE authoritative copy:
//   BSIT-CYBERSECURITY -> BSIT
// Additive and idempotent. It creates program_outcome_sources and the link; it never deletes or edits a program, course, curriculum, PO or EGA row.
// Guard: the link is refused while the specialization's own PO / EGA copy differs from the authoritative program's, because linking would
// silently change what its syllabi are checked against. The differences are listed. --force overrides, but only together with --confirm=<CODE>.
// Rollback: DROP TABLE program_outcome_sources (every program then uses its own POs again).
// Usage: node db/migrate-program-outcome-sources.js [--dry-run | --verify] [--force --confirm=BSIT-CYBERSECURITY]
//   --dry-run / --verify  write nothing (not even the table) and report; --verify also exits with status 1 when a link would be refused.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const LINKS = [{ code: 'BSIT-CYBERSECURITY', source: 'BSIT', specialization: 'Cyber Security' }];
const DDL = 'CREATE TABLE IF NOT EXISTS program_outcome_sources (program_id INT PRIMARY KEY, source_program_id INT NOT NULL, specialization VARCHAR(120) NULL, FOREIGN KEY (program_id) REFERENCES programs(program_id) ON DELETE CASCADE, FOREIGN KEY (source_program_id) REFERENCES programs(program_id) ON DELETE RESTRICT)';
const POS = 'SELECT po_no AS no, short_name, outcome_text, ega_nos FROM program_outcomes WHERE program_id = ? ORDER BY po_no';
const EGAS = 'SELECT ega_no AS no, name, short_name FROM program_egas WHERE program_id = ? ORDER BY ega_no';

// What differs between the authoritative rows and the copy, as readable lines. [] when they are identical.
function diffRows(kind, source, copy) {
  const out = [], by = rows => new Map(rows.map(row => [row.no, row]));
  const a = by(source), b = by(copy);
  for (const [no, row] of a) {
    if (!b.has(no)) { out.push(`${kind} ${no}: missing in the copy`); continue; }
    for (const key of Object.keys(row)) if (String(row[key]) !== String(b.get(no)[key])) out.push(`${kind} ${no}: ${key} differs`);
  }
  for (const no of b.keys()) if (!a.has(no)) out.push(`${kind} ${no}: only in the copy`);
  return out;
}
const diffOutcomes = (source, copy) => [...diffRows('PO', source.pos, copy.pos), ...diffRows('EGA', source.egas, copy.egas)];
const load = async (db, id) => ({ pos: (await db.query(POS, [id]))[0], egas: (await db.query(EGAS, [id]))[0] });

async function migrate(db, { dryRun = false, force = false, confirm = '' } = {}) {
  if (force && !LINKS.some(link => link.code === confirm)) throw new Error('--force needs --confirm=<program code> naming the specialization you accept differences for.');
  if (!dryRun) await db.query(DDL);
  const report = [];
  for (const link of LINKS) {
    const [[program]] = await db.query('SELECT program_id FROM programs WHERE code = ?', [link.code]);
    const [[source]] = await db.query('SELECT program_id FROM programs WHERE code = ?', [link.source]);
    if (!program || !source) { report.push({ ...link, linked: false, reason: 'program not found' }); continue; }
    let existing = [];
    try { [existing] = await db.query('SELECT source_program_id FROM program_outcome_sources WHERE program_id = ?', [program.program_id]); } catch (error) { if (error.code !== 'ER_NO_SUCH_TABLE') throw error; }
    if (existing.length && existing[0].source_program_id === source.program_id) { report.push({ ...link, linked: true, alreadyLinked: true, differences: [] }); continue; }
    const differences = diffOutcomes(await load(db, source.program_id), await load(db, program.program_id));
    const allowed = !differences.length || (force && confirm === link.code);
    if (!allowed) { report.push({ ...link, linked: false, refused: true, reason: 'The specialization\'s own outcomes differ from the authoritative program; review them, or rerun with --force --confirm=' + link.code, differences }); continue; }
    if (!dryRun) await db.query('INSERT INTO program_outcome_sources (program_id, source_program_id, specialization) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE source_program_id = VALUES(source_program_id), specialization = VALUES(specialization)', [program.program_id, source.program_id, link.specialization]);
    report.push({ ...link, linked: !dryRun, wouldLink: dryRun, forced: !!differences.length, differences });
  }
  return report;
}
if (require.main === module) (async () => {
  const args = process.argv.slice(2);
  const confirm = (args.find(arg => arg.startsWith('--confirm=')) || '').slice(10);
  const verify = args.includes('--verify');
  const db = await require('mysql2/promise').createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  try {
    const report = await migrate(db, { dryRun: args.includes('--dry-run') || verify, force: args.includes('--force'), confirm });
    console.log(JSON.stringify(report, null, 2));
    if (report.some(row => row.refused || row.reason === 'program not found') && (verify || !args.includes('--dry-run'))) process.exitCode = 1;
  } finally { await db.end(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { migrate, diffOutcomes, LINKS };
