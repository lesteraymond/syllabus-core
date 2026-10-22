CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  role ENUM('faculty', 'admin', 'student') NOT NULL DEFAULT 'faculty',
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  avatar_path VARCHAR(255) NULL,
  preferred_language VARCHAR(2) NOT NULL DEFAULT 'en',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS curriculum (
  curriculum_id INT AUTO_INCREMENT PRIMARY KEY,
  program_name VARCHAR(255) NOT NULL,
  year_level INT NOT NULL,
  semester VARCHAR(20) NOT NULL,
  course_description TEXT,
  learning_outcomes TEXT
);

CREATE TABLE IF NOT EXISTS programs (
  program_id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  egas_version INT NOT NULL DEFAULT 1,
  pos_version INT NOT NULL DEFAULT 1
);

-- Each program has its own expected graduate attributes (the school-wide institution_egas is only the default list).
CREATE TABLE IF NOT EXISTS program_egas (
  program_id INT NOT NULL,
  ega_no INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(120) NOT NULL,
  PRIMARY KEY (program_id, ega_no),
  FOREIGN KEY (program_id) REFERENCES programs(program_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS program_outcomes (
  program_id INT NOT NULL,
  po_no INT NOT NULL,
  short_name VARCHAR(120) NOT NULL,
  outcome_text TEXT NOT NULL,
  ega_nos VARCHAR(50) NOT NULL DEFAULT '',
  PRIMARY KEY (program_id, po_no),
  FOREIGN KEY (program_id) REFERENCES programs(program_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS courses (
  course_id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  program_id INT NOT NULL,
  clos_version INT NOT NULL DEFAULT 1,
  standards_json LONGTEXT NULL,
  lecture_units DECIMAL(3,1) NULL, -- the credit units the curriculum prints; the syllabus form's Credit Units (V) is filled from them
  lab_units DECIMAL(3,1) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_program_code (program_id, code), -- a code only has to be unique within its program
  FOREIGN KEY (program_id) REFERENCES programs(program_id) ON DELETE RESTRICT
);

-- A subject's prerequisites in printed order: a link to another subject, or just the printed label (3rd Yr, PATHFit 1 ...). See db/prerequisites-ddl.js.
CREATE TABLE IF NOT EXISTS course_prerequisites (
  course_id INT NOT NULL,
  position INT NOT NULL,
  prereq_course_id INT NULL,
  label VARCHAR(60) NOT NULL,
  PRIMARY KEY (course_id, position),
  FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
  FOREIGN KEY (prereq_course_id) REFERENCES courses(course_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS course_clos (
  clo_id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  title VARCHAR(255) NOT NULL DEFAULT '',
  clo_level VARCHAR(40) NOT NULL,
  statement TEXT NOT NULL,
  ega_nos VARCHAR(50) NOT NULL DEFAULT '',
  po_nos VARCHAR(100) NOT NULL DEFAULT '',
  INDEX idx_course_clos (course_id, sort_order),
  FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
);

-- Faculty assignments: a faculty member can create and edit syllabi only for assigned courses.
-- A course is assigned only if its program is assigned to the same user (kept by server/lib/assignments.js).
CREATE TABLE IF NOT EXISTS faculty_programs (
  user_id INT NOT NULL,
  program_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, program_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (program_id) REFERENCES programs(program_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS faculty_courses (
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, course_id),
  UNIQUE KEY unique_course_owner (course_id),   -- a subject has at most one faculty member
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS syllabi (
  syllabus_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  curriculum_id INT,
  file_path VARCHAR(500),
  title VARCHAR(255),
  course_code VARCHAR(50),
  status ENUM('submitted', 'under_review', 'approved', 'rejected', 'for_revision', 'draft') DEFAULT 'submitted',
  version VARCHAR(10) DEFAULT 'v1.0',
  admin_comment TEXT,
  content LONGTEXT NULL,
  content_schema_version INT NULL,
  content_updated_at TIMESTAMP NULL,
  course_id INT NULL,
  archived_at DATETIME NULL, -- set when the subject is assigned to another faculty member: read-only, out of the working lists
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (curriculum_id) REFERENCES curriculum(curriculum_id) ON DELETE SET NULL,
  FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS submission_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  syllabus_id INT NOT NULL,
  user_id INT NOT NULL,
  action ENUM('upload', 'update', 'submit', 'approve', 'reject', 'revision', 'delete') NOT NULL,
  action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (syllabus_id) REFERENCES syllabi(syllabus_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
  comment_id INT AUTO_INCREMENT PRIMARY KEY,
  syllabus_id INT NOT NULL,
  user_id INT NOT NULL,
  comment_text TEXT NOT NULL,
  comment_type ENUM('comment', 'revision', 'approval', 'rejection') DEFAULT 'comment',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (syllabus_id) REFERENCES syllabi(syllabus_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  message_id INT AUTO_INCREMENT PRIMARY KEY,
  syllabus_id INT NOT NULL,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  message_text TEXT NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (syllabus_id) REFERENCES syllabi(syllabus_id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(user_id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS course_assignments (
  assignment_id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  syllabus_id INT NOT NULL,
  term VARCHAR(30) NOT NULL,
  status ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_assignment (teacher_id, syllabus_id, term),
  FOREIGN KEY (teacher_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (syllabus_id) REFERENCES syllabi(syllabus_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS remember_tokens (
  token_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_temp (
  user_id INT NOT NULL PRIMARY KEY,
  temp_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(30) NOT NULL,
  syllabus_id INT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user (user_id, is_read, created_at),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (syllabus_id) REFERENCES syllabi(syllabus_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS syllabus_versions (
  version_id INT AUTO_INCREMENT PRIMARY KEY,
  syllabus_id INT NOT NULL,
  version_label VARCHAR(10) NOT NULL,
  title VARCHAR(255),
  course_code VARCHAR(50),
  curriculum_id INT NULL,
  file_path VARCHAR(500) NULL,
  status_at_save VARCHAR(20) NOT NULL,
  note TEXT NULL,
  content LONGTEXT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_versions_syllabus (syllabus_id, created_at),
  FOREIGN KEY (syllabus_id) REFERENCES syllabi(syllabus_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS institution_settings (
  setting_id TINYINT PRIMARY KEY,
  vision TEXT NOT NULL,
  mission_lead TEXT NOT NULL,
  mission_items LONGTEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS institution_egas (
  ega_no INT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  short_name VARCHAR(120) NOT NULL
);

-- Compliance checks (server/lib/compliance): one run per check, its area scores, and its findings and recommendations.

CREATE TABLE IF NOT EXISTS ai_check_runs (
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
  );

CREATE TABLE IF NOT EXISTS ai_check_area_scores (
    run_id INT NOT NULL,
    area_key VARCHAR(30) NOT NULL,
    name VARCHAR(60) NOT NULL,
    weight TINYINT UNSIGNED NOT NULL,
    score TINYINT UNSIGNED NULL,
    PRIMARY KEY (run_id, area_key),
    FOREIGN KEY (run_id) REFERENCES ai_check_runs(run_id) ON DELETE CASCADE
  );

CREATE TABLE IF NOT EXISTS ai_findings (
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
  );

-- Which reviewer comments a faculty member has read (server/lib/commentReads.js).

CREATE TABLE IF NOT EXISTS comment_reads (
    user_id INT NOT NULL,
    syllabus_id INT NOT NULL,
    last_comment_id INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, syllabus_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (syllabus_id) REFERENCES syllabi(syllabus_id) ON DELETE CASCADE
  );

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(60) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- The developer rule editor's change history (see lib/compliance/overridesStore.js); the current edits live in app_settings ('standard_overrides').
CREATE TABLE IF NOT EXISTS standard_changes (change_id INT AUTO_INCREMENT PRIMARY KEY, who VARCHAR(80) NOT NULL, rev INT NOT NULL, kind VARCHAR(10) NOT NULL, changes LONGTEXT NOT NULL, changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_standard_changes_time (changed_at));

CREATE TABLE IF NOT EXISTS program_name_aliases (program_id INT NOT NULL, name VARCHAR(255) NOT NULL, PRIMARY KEY (program_id, name), FOREIGN KEY (program_id) REFERENCES programs(program_id) ON DELETE CASCADE);

CREATE TABLE IF NOT EXISTS catalog_events (event_id INT AUTO_INCREMENT PRIMARY KEY, actor_id INT NULL, action VARCHAR(30) NOT NULL, program_code VARCHAR(20) NOT NULL, program_name VARCHAR(255) NOT NULL, details LONGTEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE SET NULL);

CREATE TABLE IF NOT EXISTS catalog_file_cleanup (file_path VARCHAR(500) PRIMARY KEY, attempts INT NOT NULL DEFAULT 0, last_error VARCHAR(255) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS program_code_aliases (code VARCHAR(20) PRIMARY KEY, program_id INT NOT NULL, FOREIGN KEY (program_id) REFERENCES programs(program_id) ON DELETE CASCADE);

-- Time usage: active seconds per user per day (see lib/usage.js). Written in one batch about once a minute.
CREATE TABLE IF NOT EXISTS usage_daily (
  user_id INT NOT NULL,
  usage_date DATE NOT NULL,
  active_seconds INT NOT NULL DEFAULT 0,
  session_count SMALLINT NOT NULL DEFAULT 0,
  longest_session_seconds INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Subject deadlines (see lib/deadlines.js). A submission counts if it was made at or after opens_at.
CREATE TABLE IF NOT EXISTS subject_deadlines (
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
);

CREATE TABLE IF NOT EXISTS deadline_notices (
  notice_id INT AUTO_INCREMENT PRIMARY KEY,
  deadline_id INT NOT NULL,
  user_id INT NOT NULL,
  kind ENUM('created', 'updated', 'cancelled', 'before', 'due', 'missed', 'manual') NOT NULL,
  sent_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notices_lookup (deadline_id, user_id, kind, created_at),
  FOREIGN KEY (deadline_id) REFERENCES subject_deadlines(deadline_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

