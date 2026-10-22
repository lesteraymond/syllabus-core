// Loads the institution's vision, mission, EGAs, programs and the BSIT program outcomes from
// src/data/outcomesSeed.js (copied from the institutional form). Idempotent and non-destructive:
// it only inserts what is missing, so anything an admin has edited is never overwritten.
// Use --dry-run to only report. Run migrate-builder first.
require('dotenv').config();
const path = require('path');
const { pathToFileURL } = require('url');
const mysql = require('mysql2/promise');

const DRY = process.argv.includes('--dry-run');

async function seed() {
  const { INSTITUTION, PROGRAMS, COURSES } = await import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'data', 'outcomesSeed.js')).href);
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  const say = (m) => console.log((DRY ? '[dry run] ' : '') + m);
  const run = async (sql, params) => { if (!DRY) await conn.query(sql, params); };

  const [has] = await conn.query('SELECT 1 FROM institution_settings WHERE setting_id = 1');
  if (has.length) say('institution settings: already present, left as is');
  else {
    await run('INSERT INTO institution_settings (setting_id, vision, mission_lead, mission_items) VALUES (1, ?, ?, ?)',
      [INSTITUTION.vision, INSTITUTION.mission.lead, JSON.stringify(INSTITUTION.mission.items)]);
    say('institution settings: inserted');
  }

  for (const e of INSTITUTION.egas) {
    const [r] = await conn.query('SELECT 1 FROM institution_egas WHERE ega_no = ?', [e.no]);
    if (r.length) { say(`EGA ${e.no}: already present`); continue; }
    await run('INSERT INTO institution_egas (ega_no, name, short_name) VALUES (?, ?, ?)', [e.no, e.name, e.short]);
    say(`EGA ${e.no}: inserted`);
  }

  for (const [code, prog] of Object.entries(PROGRAMS)) {
    let [r] = await conn.query('SELECT program_id FROM programs WHERE code = ?', [code]);
    let id = r[0] && r[0].program_id;
    if (id) say(`program ${code}: already present`);
    else {
      if (!DRY) { const [ins] = await conn.query('INSERT INTO programs (code, name) VALUES (?, ?)', [code, prog.name]); id = ins.insertId; }
      say(`program ${code}: inserted`);
    }
    // Each program has its own EGAs: a program without any gets a copy of the school-wide list.
    const [[{ g }]] = await conn.query('SELECT COUNT(*) AS g FROM program_egas WHERE program_id = ?', [id || 0]);
    if (g === 0 && id) {
      await run('INSERT INTO program_egas (program_id, ega_no, name, short_name) VALUES ?', [INSTITUTION.egas.map((e) => [id, e.no, e.name, e.short])]);
      say(`  ${code} EGAs: copied ${INSTITUTION.egas.length} from the school-wide list`);
    }
    if (!prog.pos.length) continue;
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM program_outcomes WHERE program_id = ?', [id || 0]);
    if (n > 0) { say(`  ${code} outcomes: ${n} already present, left as is`); continue; }
    await run('INSERT INTO program_outcomes (program_id, po_no, short_name, outcome_text, ega_nos) VALUES ?',
      [prog.pos.map((p) => [id, p.no, p.short, p.text, p.egas.join(',')])]);
    say(`  ${code} outcomes: inserted ${prog.pos.length}`);
  }

  for (const course of COURSES) {
    const [prog] = await conn.query('SELECT program_id FROM programs WHERE code = ?', [course.program]);
    const [existing] = await conn.query('SELECT course_id FROM courses WHERE code = ? AND program_id = ?', [course.code, prog[0] && prog[0].program_id]);
    let courseId = existing[0] && existing[0].course_id;
    if (courseId) say(`course ${course.code}: already present`);
    else if (!prog[0]) { say(`course ${course.code}: skipped, program ${course.program} is missing`); continue; }
    else {
      if (!DRY) { const [ins] = await conn.query('INSERT INTO courses (code, title, program_id) VALUES (?, ?, ?)', [course.code, course.title, prog[0].program_id]); courseId = ins.insertId; }
      say(`course ${course.code}: inserted`);
    }
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM course_clos WHERE course_id = ?', [courseId || 0]);
    if (n > 0) { say(`  ${course.code} CLOs: ${n} already present, left as is`); continue; }
    await run('INSERT INTO course_clos (course_id, sort_order, title, clo_level, statement, ega_nos, po_nos) VALUES ?',
      [course.clos.map((c, i) => [courseId, i, c.title, c.level, c.statement, c.egas.join(','), c.pos.join(',')])]);
    say(`  ${course.code} CLOs: inserted ${course.clos.length}`);
  }

  await conn.end();
  console.log(DRY ? 'Dry run complete. Nothing was changed.' : 'Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
