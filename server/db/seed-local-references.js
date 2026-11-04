'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { programs } = require('./local-curriculum-data.cjs');
const { sources } = require('./local-outcome-data.cjs');
const officialPoReferences = require('../../src/data/officialProgramOutcomes.json');
const { migrate } = require('./migrate-course-program-codes');
const { canonical } = require('../lib/compliance/hash');
const { loadOutcomes } = require('../lib/institution');
const { loadResolvedProgram, findProgram } = require('../lib/programs');
const root = path.resolve(__dirname, '../..');
const normalize = text => String(text).trim().replace(/\s+/g, ' ').toUpperCase();

function validateData(data = programs) {
  for (const p of data) {
    const courses = p.terms.flatMap(t => t.rows);
    assert.equal(new Set(courses.map(c => normalize(c.code))).size, courses.length, `${p.code}: duplicate course`);
    for (const term of p.terms) {
      assert.equal(term.rows.reduce((sum, c) => sum + c.lecture + c.lab, 0), term.totalUnits, `${p.code}: term credit total`);
      for (const c of term.rows) {
        assert.ok(c.code && c.title && c.prereq && c.sourceFile, `${p.code}: incomplete row`);
        assert.ok([c.lecture, c.lab, c.lectureHours, c.labHours].every(n => Number.isFinite(n) && n >= 0));
        assert.ok(c.yearLevel >= 1 && c.yearLevel <= 4);
      }
    }
    assert.equal(courses.reduce((s, c) => s + c.lecture, 0), p.lectureUnits, `${p.code}: lecture total`);
    assert.equal(courses.reduce((s, c) => s + c.lab, 0), p.labUnits, `${p.code}: lab total`);
    assert.equal(p.lectureUnits + p.labUnits, p.totalUnits);
  }
}

async function verify(db) {
  const results = [];
  for (const p of programs) {
    const program = await loadResolvedProgram(db, await findProgram(db, p.code));
    const [courses] = await db.query('SELECT course_id, code, title FROM courses WHERE program_id = ? ORDER BY code', [program.id]);
    const [refs] = await db.query('SELECT reference_id, status, source, courses_json FROM syllabus_check_curricula WHERE program_code = ? AND curriculum_year = ?', [p.code, p.curriculumYear]);
    assert.equal(refs.length, 1);
    const expected = p.terms.flatMap(t => t.rows), stored = JSON.parse(refs[0].courses_json);
    assert.equal(stored.length, expected.length);
    assert.equal(refs[0].status, 'approved');
    for (const row of expected) {
      assert.ok(courses.some(c => normalize(c.code) === normalize(row.code) && c.title === row.title), `${p.code}: subject missing or conflicting ${row.code}`);
      const actual = stored.find(c => c.code === row.code);
      for (const key of ['title', 'prereq', 'lecture', 'lab', 'yearLevel', 'semester', 'rawPrerequisite', 'lectureHours', 'labHours']) assert.deepEqual(actual[key], row[key], `${p.code} ${row.code}: ${key}`);
    }
    assert.equal(program.egas.length, 4);
    assert.ok(program.pos.length > 0);
    const [termRows] = await db.query('SELECT year_level, semester FROM curriculum WHERE program_name = ?', [p.name]);
    for (const term of p.terms) assert.ok(termRows.some(r => r.year_level === term.yearLevel && r.semester === term.semester));
    results.push({ program: p.code, curriculumYear: p.curriculumYear, curriculumSubjects: stored.length, catalogSubjects: courses.length, pos: program.pos.length, egas: program.egas.length, curriculumTerms: p.terms.length, referenceId: refs[0].reference_id, referenceStatus: refs[0].status, lectureUnits: p.lectureUnits, labUnits: p.labUnits, totalUnits: p.totalUnits, databaseVerified: true, sourceWarnings: [`PO source: ${officialPoReferences.version}; Cyber requires the explicit inheritance migration, not a copy.`] });
  }
  return results;
}

async function seed() {
  validateData();
  const hashes = {};
  for (const file of programs.flatMap(p => p.files)) hashes[file] = crypto.createHash('sha256').update(await fs.readFile(path.join(root, 'reference-data', file))).digest('hex');
  for(const ref of Object.values(officialPoReferences.programs).filter(p=>p.sourceFile))hashes[ref.sourceFile]=crypto.createHash('sha256').update(await fs.readFile(path.join(root,ref.sourceFile))).digest('hex');
  const db = await require('mysql2/promise').createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  try {
    if (process.argv.includes('--verify')) { console.log(JSON.stringify(await verify(db), null, 2)); return; }
    const plan = programs.map(p => ({ program: p.code, year: p.curriculumYear, subjects: p.terms.flatMap(t => t.rows).length, units: p.totalUnits, outcomePolicy: p.code === 'BSIT-CYBERSECURITY' ? 'Inherit BSIT via the official versioned PO migration; never create a copy' : 'Fill missing official outcome sets only; preserve populated sets' }));
    if (!process.argv.includes('--apply')) { console.log(JSON.stringify({ dryRun: true, plan, sourceSha256: hashes }, null, 2)); return; }
    const [oldPrograms] = await db.query('SELECT * FROM programs');
    const [oldCourses] = await db.query('SELECT * FROM courses');
    const [oldPos] = await db.query('SELECT * FROM program_outcomes');
    const [oldEgas] = await db.query('SELECT * FROM program_egas');
    const [oldReferences] = await db.query('SELECT * FROM syllabus_check_curricula');
    const [oldTerms] = await db.query('SELECT * FROM curriculum');
    const backupDir = path.join(root, '.api-test-backups'); await fs.mkdir(backupDir, { recursive: true });
    const backup = path.join(backupDir, `local-reference-seed-${Date.now()}.json`);
    await fs.writeFile(backup, JSON.stringify({ programs: oldPrograms, courses: oldCourses, pos: oldPos, egas: oldEgas, references: oldReferences, curriculum: oldTerms }, null, 2), { flag: 'wx' });
    // MySQL DDL commits implicitly. This additive constraint migration is
    // idempotent; all record changes below are in one separate transaction.
    await migrate(db);
    await db.beginTransaction();
    let report;
    try {
      const institution = await loadOutcomes(db);
      for (const p of programs) {
        const [existing] = await db.query('SELECT program_id FROM programs WHERE code = ? FOR UPDATE', [p.code]);
        let id = existing[0]?.program_id;
        if (!id) {
          const [duplicateName] = await db.query('SELECT program_id FROM programs WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [p.name]);
          assert.equal(duplicateName.length, 0, `Existing program name has a different code: ${p.name}`);
          const [made] = await db.query('INSERT INTO programs (code, name) VALUES (?, ?)', [p.code, p.name]); id = made.insertId;
        }
        const egaSource = sources[p.code]?.egas || sources.BSIT.egas;
        const [existingEgas] = await db.query('SELECT ega_no, name, short_name FROM program_egas WHERE program_id = ?', [id]);
        let addedEgas = false;
        for (const e of egaSource) if (!existingEgas.some(row => row.ega_no === e.no)) {
          await db.query('INSERT INTO program_egas (program_id, ega_no, name, short_name) VALUES (?, ?, ?, ?)', [id, e.no, e.name, e.short]); addedEgas = true;
        }
        if (addedEgas) await db.query('UPDATE programs SET egas_version = egas_version + 1 WHERE program_id = ?', [id]);
        const [pos] = await db.query('SELECT po_no FROM program_outcomes WHERE program_id = ?', [id]);
        if (!pos.length && p.code !== 'BSIT-CYBERSECURITY') {
          const toInsert = officialPoReferences.programs[p.code]?.outcomes;
          assert.ok(toInsert?.length);
          for (const po of toInsert) await db.query('INSERT INTO program_outcomes (program_id, po_no, short_name, outcome_text, ega_nos) VALUES (?, ?, ?, ?, ?)', [id, po.no, po.short, po.text, po.egas.join(',')]);
          await db.query('UPDATE programs SET pos_version = pos_version + 1 WHERE program_id = ?', [id]);
        }
        const program = await loadResolvedProgram(db, await findProgram(db, p.code));
        const standards = { vision: institution.vision, mission: institution.mission, egas: program.egas, pos: program.pos, versions: { vision: 1, egas: 1, pos: 1 } };
        for (const c of p.terms.flatMap(t => t.rows)) {
          const [existingCourses] = await db.query('SELECT course_id, code, title FROM courses WHERE program_id = ? AND UPPER(TRIM(code)) = ?', [id, normalize(c.code)]);
          assert.ok(existingCourses.length <= 1, `Ambiguous course ${p.code}/${c.code}`);
          if (existingCourses.length) assert.equal(existingCourses[0].title, c.title, `Existing course title conflicts: ${p.code}/${c.code}; refusing to overwrite`);
          else await db.query('INSERT INTO courses (code, title, program_id, standards_json) VALUES (?, ?, ?, ?)', [c.code, c.title, id, JSON.stringify(standards)]);
        }
        const rows = p.terms.flatMap(t => t.rows).map(c => ({ ...c, sourceSha256: hashes[c.sourceFile] }));
        const source = p.files.map(file => `reference-data/${file} SHA256:${hashes[file]}`).join('; ');
        const [refs] = await db.query('SELECT reference_id, status, courses_json FROM syllabus_check_curricula WHERE program_code = ? AND curriculum_year = ? FOR UPDATE', [p.code, p.curriculumYear]);
        if (refs.length) {
          assert.equal(refs[0].status, 'approved', `Existing ${p.code} reference is not approved; refusing implicit replacement`);
          assert.equal(canonical(JSON.parse(refs[0].courses_json)), canonical(rows), `Immutable ${p.code} reference differs; create a reviewed revision instead`);
        } else await db.query("INSERT INTO syllabus_check_curricula (program_code, curriculum_year, status, source, courses_json) VALUES (?, ?, 'approved', ?, ?)", [p.code, p.curriculumYear, source, JSON.stringify(rows)]);
        for (const t of p.terms) {
          const [terms] = await db.query('SELECT curriculum_id FROM curriculum WHERE program_name = ? AND year_level = ? AND semester = ?', [p.name, t.yearLevel, t.semester]);
          if (!terms.length) await db.query('INSERT INTO curriculum (program_name, year_level, semester, course_description, learning_outcomes) VALUES (?, ?, ?, ?, ?)', [p.name, t.yearLevel, t.semester, `${p.curriculumYear} registrar curriculum; ${t.totalUnits} credit units. Subjects: ${t.rows.map(c => c.code).join(', ')}. Sources: ${p.files.join(', ')}.`, JSON.stringify(program.pos)]);
        }
      }
      report = await verify(db);
      await db.commit();
    } catch (error) { await db.rollback(); throw error; }
    const manifest = { importedAt: new Date().toISOString(), backup: path.relative(root, backup), sourceSha256: hashes, cybersecurityOutcomePolicy: 'Inherit BSIT via the versioned PO migration; no copied set', existingPopulatedOutcomeSetsPreserved: true, sourceOutcomeSnapshots: officialPoReferences, verification: report };
    await fs.writeFile(path.join(root, 'docs/local-reference-import.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(JSON.stringify({ applied: true, backup: manifest.backup, verification: report }, null, 2));
  } finally { await db.end(); }
}
if (require.main === module) seed().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { validateData, verify };
