// Subject deadlines. An administrator gives a subject a submission deadline for a term; every faculty member assigned to that subject
// has their own requirement against it. Whether a requirement is met is worked out from the submission history that already exists
// (syllabus_versions), so nothing here has to be kept in step with it.
//
//   subject_deadlines  one row per subject and term. due_at and opens_at are TIMESTAMPs (read as epoch seconds, so the server's time zone
//                      never matters); a submission counts if it was made at or after opens_at. cancelled_at marks a cancelled deadline.
//   deadline_notices   who was told what and when (a reminder, a missed-deadline notice), so nobody is told the same thing twice by
//                      accident and the administrator can see when someone was last reminded.
// Used by migrate-deadlines.js; server/db/schema.sql carries the same definitions for fresh installs.
module.exports = {
  tables: [
    `CREATE TABLE IF NOT EXISTS subject_deadlines (
    deadline_id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    term VARCHAR(30) NOT NULL,
    due_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    opens_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    instructions VARCHAR(1000) NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY unique_subject_term (course_id, term),
    INDEX idx_deadlines_due (cancelled_at, due_at),
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
  )`,
    `CREATE TABLE IF NOT EXISTS deadline_notices (
    notice_id INT AUTO_INCREMENT PRIMARY KEY,
    deadline_id INT NOT NULL,
    user_id INT NOT NULL,
    kind ENUM('created', 'updated', 'cancelled', 'before', 'due', 'missed', 'manual') NOT NULL,
    sent_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notices_lookup (deadline_id, user_id, kind, created_at),
    FOREIGN KEY (deadline_id) REFERENCES subject_deadlines(deadline_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  )`,
  ],
};
