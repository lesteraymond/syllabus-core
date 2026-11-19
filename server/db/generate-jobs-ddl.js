// The AI Syllabus Generator's jobs (server/lib/syllabuscheck/pipeline/generateJobs.js). One row per generation: who started it for which syllabus, how far it got, and its result
// until the author's screen has applied it (then result_json is emptied and the row stays as the record). The rows also count a person's generations in the last 24 hours (the daily
// limit), so both survive a server restart. A row left "running" by a restart is marked failed the next time it is read. Rows go with their syllabus or account.
// Used by migrate-generate-jobs.js; server/db/schema.sql carries the same definition for fresh installs (server/lib/syllabuscheck/pipeline/generateJobs.test.js checks that the two agree).
module.exports = [
  `CREATE TABLE IF NOT EXISTS syllabus_generate_jobs (
    job_id CHAR(16) NOT NULL PRIMARY KEY,
    syllabus_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('running', 'done', 'failed', 'applied') NOT NULL DEFAULT 'running',
    step TINYINT NOT NULL DEFAULT 0,
    steps TINYINT NOT NULL DEFAULT 7,
    stage VARCHAR(20) NULL,
    result_json LONGTEXT NULL,
    error_json TEXT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP NULL,
    INDEX idx_generate_jobs_user (user_id, started_at),
    INDEX idx_generate_jobs_syllabus (syllabus_id, started_at),
    FOREIGN KEY (syllabus_id) REFERENCES syllabi(syllabus_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  )`,
];
