// The table that remembers a reviewer's choice to review a submitted syllabus WITHOUT an AI check (lib/reviewAiChoice.js). One row per (syllabus, version,
// reviewer): the row exists when that reviewer chose it for that version. A new version has a new version_id, so the choice is asked again after a resubmission.
// Used by migrate-review-ai-choice.js; server/db/schema.sql carries the same definition for fresh installs (server/lib/reviewAiChoice.test.js checks that the two agree).
module.exports = [
  `CREATE TABLE IF NOT EXISTS syllabus_review_ai_choices (
    choice_id INT AUTO_INCREMENT PRIMARY KEY,
    syllabus_id INT NOT NULL,
    version_id INT NOT NULL,
    reviewer_id INT NOT NULL,
    choice ENUM('without_ai') NOT NULL DEFAULT 'without_ai',
    note VARCHAR(500) NULL,
    chosen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_ai_choice_per_version (syllabus_id, version_id, reviewer_id),
    INDEX idx_ai_choice_syllabus (syllabus_id),
    FOREIGN KEY (syllabus_id) REFERENCES syllabi(syllabus_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE CASCADE
  )`,
];
