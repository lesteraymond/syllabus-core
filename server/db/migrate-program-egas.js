// Upgrades an existing database so each program has its own expected graduate attributes (EGAs):
//   - program_egas (program_id, ega_no, name, short_name): a program's own EGA list
//   - programs.egas_version / programs.pos_version, courses.clos_version, institution_settings.version:
//     counters bumped on every save, so a save made from a stale screen is refused instead of overwriting
// Every program that has no EGAs of its own gets a copy of the current school-wide list (institution_egas), so
// nothing changes for faculty until an admin edits a program. Vision and mission stay school-wide.
// Fresh installs get the tables and columns from schema.sql (and the copy happens when the program is created / seeded).
// Safe to run repeatedly. Use --dry-run to only report. Run migrate-builder first.
require('dotenv').config();
const mysql = require('mysql2/promise');

const DRY = process.argv.includes('--dry-run');

const TABLES = {
  program_egas: `CREATE TABLE IF NOT EXISTS program_egas (
    program_id INT NOT NULL,
    ega_no INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(120) NOT NULL,
    PRIMARY KEY (program_id, ega_no),
    FOREIGN KEY (program_id) REFERENCES programs(program_id) ON DELETE CASCADE
  )`,
};

const COLUMNS = [
  ['programs', 'egas_version', 'INT NOT NULL DEFAULT 1'],
  ['programs', 'pos_version', 'INT NOT NULL DEFAULT 1'],
  ['courses', 'clos_version', 'INT NOT NULL DEFAULT 1'],
  ['institution_settings', 'version', 'INT NOT NULL DEFAULT 1'],
];

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  const db = process.env.DB_NAME;
  const say = (m) => console.log((DRY ? '[dry run] ' : '') + m);
  const run = async (sql, params) => { if (!DRY) await conn.query(sql, params); };
  const tableExists = async (name) => (await conn.query('SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [db, name]))[0].length > 0;

  for (const need of ['programs', 'courses', 'institution_egas', 'institution_settings']) {
    if (!(await tableExists(need))) throw new Error(`table ${need} is missing. Run migrate-builder first.`);
  }
  for (const [name, ddl] of Object.entries(TABLES)) {
    if (await tableExists(name)) { say(`table ${name}: already exists`); continue; }
    await run(ddl);
    say(`table ${name}: created`);
  }
  for (const [table, column, type] of COLUMNS) {
    const [r] = await conn.query('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?', [db, table, column]);
    if (r.length) { say(`${table}.${column}: already exists`); continue; }
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    say(`${table}.${column}: added`);
  }

  // Give each program without EGAs a copy of the school-wide list. Programs that already have their own are left alone.
  const [egas] = await conn.query('SELECT ega_no, name, short_name FROM institution_egas ORDER BY ega_no');
  const hasTable = !DRY || (await tableExists('program_egas'));
  const [programs] = await conn.query('SELECT program_id, code FROM programs ORDER BY code');
  for (const p of programs) {
    const [[{ n }]] = hasTable ? await conn.query('SELECT COUNT(*) AS n FROM program_egas WHERE program_id = ?', [p.program_id]) : [[{ n: 0 }]];
    if (n > 0) { say(`program ${p.code}: ${n} EGAs of its own, left as is`); continue; }
    if (!egas.length) { say(`program ${p.code}: no school-wide EGAs to copy`); continue; }
    await run('INSERT INTO program_egas (program_id, ega_no, name, short_name) VALUES ?', [egas.map((e) => [p.program_id, e.ega_no, e.name, e.short_name])]);
    say(`program ${p.code}: copied ${egas.length} EGAs`);
  }

  await conn.end();
  console.log(DRY ? 'Dry run complete. Nothing was changed.' : 'Migration complete. Restart the API server.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
