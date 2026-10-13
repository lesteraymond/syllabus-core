// Creates syllabus_versions on an existing database and back-fills one row per existing syllabus
// from its current values. Fresh installs get the table from schema.sql. Safe to run repeatedly
// (only syllabi without any version row are back-filled).
require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  await conn.query(`CREATE TABLE IF NOT EXISTS syllabus_versions (
    version_id INT AUTO_INCREMENT PRIMARY KEY,
    syllabus_id INT NOT NULL,
    version_label VARCHAR(10) NOT NULL,
    title VARCHAR(255),
    course_code VARCHAR(50),
    curriculum_id INT NULL,
    file_path VARCHAR(500) NULL,
    status_at_save VARCHAR(20) NOT NULL,
    note TEXT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_versions_syllabus (syllabus_id, created_at),
    FOREIGN KEY (syllabus_id) REFERENCES syllabi(syllabus_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
  )`);

  const [result] = await conn.query(`INSERT INTO syllabus_versions
      (syllabus_id, version_label, title, course_code, curriculum_id, file_path, status_at_save, note, created_by, created_at)
    SELECT s.syllabus_id, COALESCE(NULLIF(s.version, ''), 'v1.0'), s.title, s.course_code, s.curriculum_id, s.file_path,
           s.status, 'Initial version', s.user_id, s.uploaded_at
    FROM syllabi s
    WHERE NOT EXISTS (SELECT 1 FROM syllabus_versions v WHERE v.syllabus_id = s.syllabus_id)`);
  // An old client-side bump produced labels like 'vv1.1'; normalize them (no-op when already clean).
  await conn.query("UPDATE syllabi SET version = CONCAT('v', TRIM(LEADING 'v' FROM version)) WHERE version LIKE 'vv%'");
  await conn.query("UPDATE syllabus_versions SET version_label = CONCAT('v', TRIM(LEADING 'v' FROM version_label)) WHERE version_label LIKE 'vv%'");
  console.log(`Back-filled ${result.affectedRows} existing syllabus(es).`);

  await conn.end();
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
