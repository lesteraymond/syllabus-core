// Deletes the subjects that are not in the current curricula (db/curriculum-data.js), together with what hangs on them: their syllabi (and each
// syllabus's versions, comments, AI checks, notifications), prerequisites, CLOs, owners, assignments and deadlines. A student's enrollment row is
// kept; it only loses its link to the subject. Programs are never deleted: the ones left without any subject are listed.
// A subject is current when its code matches one in the same program's curriculum (written as printed, so "IT 204" and "IT-204" are two codes).
//   npm run purge-old-subjects            only report (nothing is changed)
//   npm run purge-old-subjects -- --apply delete them, in one transaction
// This cannot be undone: back up the database first (mysqldump).
require('dotenv').config();
const mysql = require('mysql2/promise');
const data = require('./curriculum-data');

const APPLY = process.argv.includes('--apply');

async function purge() {
  const conn = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  const say = (m) => console.log((APPLY ? '' : '[dry run] ') + m);
  try {
    const current = new Set(data.programs.flatMap((p) => p.subjects.map((s) => `${p.code}|${s.code}`)));
    const [rows] = await conn.query('SELECT c.course_id AS id, c.code, c.title, p.code AS programCode FROM courses c LEFT JOIN programs p ON p.program_id = c.program_id ORDER BY p.code, c.code');
    const old = rows.filter((r) => !current.has(`${r.programCode}|${r.code}`));
    if (!old.length) { say('No old subjects: every subject is in the current curricula.'); return; }
    const ids = old.map((r) => r.id);
    const [[{ n: syllabi }]] = await conn.query('SELECT COUNT(*) AS n FROM syllabi WHERE course_id IN (?)', [ids]);
    const [[{ n: enrolled }]] = await conn.query('SELECT COUNT(*) AS n FROM student_enrollments WHERE course_id IN (?)', [ids]).catch(() => [[{ n: 0 }]]);

    const byProgram = new Map();
    old.forEach((r) => byProgram.set(r.programCode || '(no program)', [...(byProgram.get(r.programCode || '(no program)') || []), r.code]));
    byProgram.forEach((codes, program) => say(`${program}: ${codes.length} old subject(s): ${codes.join(', ')}`));
    say(`${old.length} of ${rows.length} subject(s) are old, with ${syllabi} syllabus/syllabi and ${enrolled} student enrollment(s) pointing at them.`);

    if (!APPLY) { say('Nothing deleted. Back up the database, then run again with --apply.'); return; }

    await conn.beginTransaction();
    await conn.query('DELETE FROM syllabi WHERE course_id IN (?)', [ids]);
    await conn.query('DELETE FROM courses WHERE course_id IN (?)', [ids]);
    await conn.commit();
    say(`Deleted ${old.length} subject(s) and ${syllabi} syllabus/syllabi.`);

    const [empty] = await conn.query('SELECT p.code FROM programs p LEFT JOIN courses c ON c.program_id = p.program_id GROUP BY p.program_id, p.code HAVING COUNT(c.course_id) = 0');
    if (empty.length) say(`Programs now without subjects (kept): ${empty.map((p) => p.code).join(', ')}`);
  } catch (err) {
    try { await conn.rollback(); } catch { /* nothing to undo */ }
    throw err;
  } finally {
    await conn.end();
  }
}

purge().catch((err) => { console.error(err.message); process.exitCode = 1; });
