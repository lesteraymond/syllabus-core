// The account's own activity that is not part of a syllabus's review history (submission_logs): signing in and out, the password, the name, the
// profile photo, the language, and the work on a syllabus's content (a new draft, an editing session, a deletion). An audit trail, kept for
// transparency: rows are only ever added. A deleted syllabus keeps its rows here (syllabus_id becomes NULL; `subject` still names it).
// Used by migrate-account-activity.js; server/db/schema.sql carries the same definition for fresh installs (server/lib/accountActivity.test.js checks that the two agree).
module.exports = [
  `CREATE TABLE IF NOT EXISTS account_activity (
    activity_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(30) NOT NULL,
    syllabus_id INT NULL,
    subject VARCHAR(300) NULL,
    notes VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_account_activity_user (user_id, created_at),
    INDEX idx_account_activity_edit (user_id, syllabus_id, action, created_at),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (syllabus_id) REFERENCES syllabi(syllabus_id) ON DELETE SET NULL
  )`,
];
