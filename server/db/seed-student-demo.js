// Demo data for the student pages: enrols a registered student in a few real subjects of the catalog, as if their COR listed them, so the
// student Dashboard and Syllabi pages have something to show. Development only; it adds rows and never changes or removes anything.
// Safe to run repeatedly (a subject already on the student's list is skipped).
// Run: npm run seed-student-demo -- <student id>      e.g.  npm run seed-student-demo -- 23-3389-455
require('dotenv').config();
const mysql = require('mysql2/promise');

const HOW_MANY = 6;

async function main() {
  const studentId = process.argv[2];
  if (!studentId) throw new Error('Give the student ID: npm run seed-student-demo -- 23-3389-455');
  const db = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, port: process.env.DB_PORT || 3306 });
  try {
    const [[profile]] = await db.query('SELECT user_id, program, section, school_year, term FROM student_profiles WHERE student_id = ?', [studentId]);
    if (!profile) throw new Error(`No registered student has the ID ${studentId}.`);
    // The student's own program first (the code the section starts with, e.g. BSIT4B -> BSIT), fourth-year subjects first.
    const [programs] = await db.query('SELECT program_id, code FROM programs');
    const own = programs.filter((p) => String(profile.section || '').toUpperCase().replace(/[^A-Z0-9]/g, '').startsWith(p.code.toUpperCase().replace(/[^A-Z0-9]/g, ''))).sort((a, b) => b.code.length - a.code.length)[0];
    const [courses] = await db.query(
      `SELECT course_id, code, title FROM courses ${own ? 'WHERE program_id = ?' : ''} ORDER BY (code LIKE '% 4__') DESC, (code LIKE '% 3__') DESC, code LIMIT ${HOW_MANY}`,
      own ? [own.program_id] : []);
    const [have] = await db.query('SELECT subject_code FROM student_enrollments WHERE user_id = ?', [profile.user_id]);
    const taken = new Set(have.map((r) => r.subject_code));
    let added = 0;
    for (const c of courses) {
      if (taken.has(c.code)) continue;
      await db.query('INSERT INTO student_enrollments (user_id, subject_code, subject_title, section, school_year, term, course_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [profile.user_id, c.code, c.title.slice(0, 255), profile.section, profile.school_year, profile.term, c.course_id]);
      added += 1;
    }
    console.log(`Enrolled ${studentId} in ${added} subject(s)${courses.length - added ? `; ${courses.length - added} already listed` : ''}.`);
  } finally { await db.end(); }
}

main().catch((err) => { console.error(err.message); process.exitCode = 1; });
