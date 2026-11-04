// Fills the program and subject catalog from the curricula in db/curriculum-data.js (see lib/curriculumImport.js for the rules): the programs,
// each program's own subjects, every subject's prerequisites as links to other subjects, and its credit units (lecture and laboratory). It adds what is missing and never deletes. An existing subject with the same code in the same program but another title is retitled,
// and one an earlier import added with a program suffix (IT 202-CS) gets its printed code back, unless --no-updates is given; the CLOs, standards
// and syllabi of an existing subject are never touched.
//   npm run seed-curriculum -- --dry-run      only report
//   npm run seed-curriculum -- --no-updates   add, but leave the title of existing subjects alone
// Run migrate-prerequisites, migrate-course-code-per-program and migrate-credit-units first. Safe to run again: the second run changes nothing.
require('dotenv').config();
const mysql = require('mysql2/promise');
const data = require('./curriculum-data');
const { planImport } = require('../lib/curriculumImport');
const { blankStandards } = require('../lib/subjectStandards');

const DRY = process.argv.includes('--dry-run');
const NO_UPDATES = process.argv.includes('--no-updates');

async function seed() {
  const conn = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  const say = (m) => console.log((DRY ? '[dry run] ' : '') + m);
  try {
    const [unitCols] = await conn.query("SHOW COLUMNS FROM courses LIKE 'lecture_units'");
    if (!unitCols.length) { console.error('The credit unit columns are missing. Run: npm run migrate-credit-units'); process.exitCode = 1; return; }
    try { await conn.query('SELECT 1 FROM course_prerequisites LIMIT 1'); } catch (e) {
      if (e.code === 'ER_NO_SUCH_TABLE') { console.error('The course_prerequisites table is missing. Run: npm run migrate-prerequisites'); process.exitCode = 1; return; }
      throw e;
    }
    const [keys] = await conn.query("SELECT index_name AS name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS cols FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'courses' AND non_unique = 0 GROUP BY index_name");
    if (keys.some((k) => k.cols === 'code')) { console.error('Subject codes are still unique across the whole catalog. Run: npm run migrate-course-code-per-program'); process.exitCode = 1; return; }
    const [programs] = await conn.query('SELECT program_id AS id, code, name FROM programs');
    const [courses] = await conn.query('SELECT c.course_id AS id, c.code, c.title, p.code AS programCode FROM courses c JOIN programs p ON p.program_id = c.program_id');
    const plan = planImport(data, { programs, courses });
    const updates = plan.courses.filter((c) => c.action === 'update');
    if (NO_UPDATES) updates.forEach((c) => { c.action = 'unchanged'; delete c.newTitle; delete c.newCode; });

    plan.programs.forEach((p) => say(`program ${p.code}: ${p.exists ? 'already there' : 'created'}`));
    plan.courses.forEach((c) => {
      if (c.action === 'create') say(`subject ${c.code} (${c.programCode}): created`);
      else if (c.action === 'update') say(`subject ${c.oldCode || c.code} (${c.programCode}): ${[c.newCode ? `code -> ${c.newCode}` : '', c.newTitle ? `title "${c.oldTitle}" -> "${c.newTitle}"` : ''].filter(Boolean).join(', ')}`);
    });
    plan.notes.forEach((n) => say('note: ' + n));
    if (NO_UPDATES && updates.length) say(`${updates.length} existing subject title(s) left as they are (--no-updates): ${updates.map((c) => c.code).join(', ')}`);
    const created = plan.courses.filter((c) => c.action === 'create').length;
    say(`${plan.programs.filter((p) => !p.exists).length} program(s) and ${created} subject(s) to add; ${NO_UPDATES ? 0 : updates.length} to retitle; ${plan.prerequisites.length} subject(s) with their prerequisites set; credit units for ${plan.units.length}.`);
    if (DRY) return;

    await conn.beginTransaction();
    const programId = new Map(programs.map((p) => [p.code, p.id]));
    for (const p of plan.programs) {
      if (p.exists) continue;
      const [r] = await conn.query('INSERT INTO programs (code, name) VALUES (?, ?)', [p.code, p.name]);
      programId.set(p.code, r.insertId);
    }
    const idOf = new Map();
    for (const c of plan.courses) {
      if (c.action === 'create') {
        const [r] = await conn.query('INSERT INTO courses (code, title, program_id, standards_json) VALUES (?, ?, ?, ?)', [c.code, c.title, programId.get(c.programCode), JSON.stringify(blankStandards())]);
        idOf.set(c.key, r.insertId);
      } else {
        idOf.set(c.key, c.id);
        if (c.action === 'update') await conn.query('UPDATE courses SET code = ?, title = ? WHERE course_id = ?', [c.newCode || c.code, c.newTitle || c.title, c.id]);
      }
    }
    for (const p of plan.prerequisites) {
      const id = idOf.get(p.key);
      await conn.query('DELETE FROM course_prerequisites WHERE course_id = ?', [id]);
      for (let i = 0; i < p.items.length; i += 1) {
        const it = p.items[i];
        await conn.query('INSERT INTO course_prerequisites (course_id, position, prereq_course_id, label) VALUES (?, ?, ?, ?)', [id, i + 1, it.target ? idOf.get(it.target) : null, it.label.slice(0, 60)]);
      }
    }
    for (const u of plan.units) {
      if (Number.isFinite(u.lecture) && Number.isFinite(u.lab)) await conn.query('UPDATE courses SET lecture_units = ?, lab_units = ? WHERE course_id = ?', [u.lecture, u.lab, idOf.get(u.key)]);
    }
    await conn.commit();
    say('done.');
  } catch (err) {
    try { await conn.rollback(); } catch { /* nothing to undo */ }
    throw err;
  } finally {
    await conn.end();
  }
}

seed().catch((err) => { console.error('Seed failed:', err.message); process.exit(1); });
