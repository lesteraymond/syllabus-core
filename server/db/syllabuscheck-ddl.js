'use strict';
module.exports = [
  `CREATE TABLE IF NOT EXISTS syllabus_check_curricula (
    reference_id INT AUTO_INCREMENT PRIMARY KEY,
    program_code VARCHAR(40) NOT NULL,
    curriculum_year VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    source VARCHAR(500) NOT NULL,
    courses_json LONGTEXT NOT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY curriculum_version (program_code, curriculum_year)
  )`,
  `CREATE TABLE IF NOT EXISTS syllabus_check_reports (
    run_id INT PRIMARY KEY,
    reference_hash CHAR(64) NOT NULL,
    report_json LONGTEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES ai_check_runs(run_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS syllabus_check_decisions (
    decision_id INT AUTO_INCREMENT PRIMARY KEY,
    run_id INT NOT NULL,
    suggestion_id VARCHAR(255) NOT NULL,
    action VARCHAR(20) NOT NULL,
    edited_text TEXT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES ai_check_runs(run_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  )`,
];
