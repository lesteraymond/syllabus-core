// The compliance tables. One list of statements, used by migrate-compliance.js; server/db/schema.sql carries the same
// definitions for fresh installs (server/lib/compliance/recommend.test.js checks that the two agree).
//   ai_check_runs         one row per check of a syllabus: the score, the content it was made from, and how the AI step went
//   ai_check_area_scores  the score of each of the six areas for a run
//   ai_findings           what a run found (kind 'finding', source 'rule') and what it recommends (kind 'recommendation',
//                         source 'rule' or 'ai'), with the step, rows and CLOs each is linked to
module.exports = [
  `CREATE TABLE IF NOT EXISTS ai_check_runs (
    run_id INT AUTO_INCREMENT PRIMARY KEY,
    syllabus_id INT NOT NULL,
    version_id INT NULL,
    content_hash CHAR(64) NOT NULL,
    standard_version VARCHAR(20) NOT NULL,
    overall TINYINT UNSIGNED NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scored',
    passed TINYINT(1) NOT NULL DEFAULT 0,
    conformant TINYINT(1) NOT NULL DEFAULT 0,
    ai_status VARCHAR(20) NOT NULL DEFAULT 'none',
    ai_error VARCHAR(255) NULL,
    provider VARCHAR(40) NULL,
    model VARCHAR(80) NULL,
    prompt_version VARCHAR(20) NULL,
    contact TEXT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_runs_syllabus (syllabus_id, created_at),
    INDEX idx_runs_hash (syllabus_id, content_hash, standard_version),
    INDEX idx_runs_version (version_id),
    FOREIGN KEY (syllabus_id) REFERENCES syllabi(syllabus_id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES syllabus_versions(version_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ai_check_area_scores (
    run_id INT NOT NULL,
    area_key VARCHAR(30) NOT NULL,
    name VARCHAR(60) NOT NULL,
    weight TINYINT UNSIGNED NOT NULL,
    score TINYINT UNSIGNED NULL,
    PRIMARY KEY (run_id, area_key),
    FOREIGN KEY (run_id) REFERENCES ai_check_runs(run_id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS ai_findings (
    finding_id INT AUTO_INCREMENT PRIMARY KEY,
    run_id INT NOT NULL,
    kind VARCHAR(16) NOT NULL,
    source VARCHAR(8) NOT NULL,
    area VARCHAR(30) NULL,
    rule_id VARCHAR(20) NULL,
    severity VARCHAR(10) NULL,
    step VARCHAR(20) NULL,
    path VARCHAR(255) NULL,
    title VARCHAR(160) NULL,
    message TEXT NOT NULL,
    evidence TEXT NULL,
    based_on TEXT NULL,
    links TEXT NULL,
    priority DECIMAL(6,2) NULL,
    priority_level VARCHAR(10) NULL,
    position SMALLINT NOT NULL DEFAULT 0,
    INDEX idx_findings_run (run_id, kind, position),
    FOREIGN KEY (run_id) REFERENCES ai_check_runs(run_id) ON DELETE CASCADE
  )`,
];
