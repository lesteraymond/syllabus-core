// The table that remembers who has cleared which stage of the review chain, for which version of a syllabus. One row per (syllabus,
// version, stage): the row exists when that stage is cleared. A new version has a new version_id, so what was cleared on an older version
// no longer counts and the three stages are cleared again. Used by migrate-review-stages.js; server/db/schema.sql carries the same
// definition for fresh installs (server/lib/reviewStages.test.js checks that the two agree).
module.exports = [
  `CREATE TABLE IF NOT EXISTS syllabus_review_stages (
    stage_id INT AUTO_INCREMENT PRIMARY KEY,
    syllabus_id INT NOT NULL,
    version_id INT NOT NULL,
    stage ENUM('dean', 'asst_vpaa', 'lic_director') NOT NULL,
    reviewer_id INT NOT NULL,
    note TEXT NULL,
    cleared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_stage_per_version (syllabus_id, version_id, stage),
    INDEX idx_stage_syllabus (syllabus_id),
    FOREIGN KEY (syllabus_id) REFERENCES syllabi(syllabus_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE CASCADE
  )`,
];
