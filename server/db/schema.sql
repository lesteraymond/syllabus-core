CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('faculty', 'admin', 'student') NOT NULL DEFAULT 'faculty',
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  avatar_path VARCHAR(255) NULL,
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
  code VARCHAR(50) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  program_id INT NOT NULL,
  clos_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (program_id) REFERENCES programs(program_id) ON DELETE RESTRICT
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

CREATE TABLE IF NOT EXISTS co_po_mapping (
  mapping_id INT AUTO_INCREMENT PRIMARY KEY,
  curriculum_id INT NOT NULL,
  co_number INT NOT NULL,
  po_number INT NOT NULL,
  level ENUM('I', 'R', 'M') DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_mapping (curriculum_id, co_number, po_number),
  FOREIGN KEY (curriculum_id) REFERENCES curriculum(curriculum_id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS student_profiles (
  user_id INT NOT NULL PRIMARY KEY,
  student_id VARCHAR(30) NOT NULL UNIQUE,
  student_name VARCHAR(255) NOT NULL,
  program VARCHAR(255) NOT NULL,
  year_level TINYINT NULL,
  section VARCHAR(50) NULL,
  school_year VARCHAR(20) NULL,
  term VARCHAR(30) NULL,
  cor_printed_at DATETIME NULL,
  cor_image_path VARCHAR(255) NULL,
  verification_status ENUM('verified', 'pending', 'rejected') NOT NULL DEFAULT 'pending',
  verification_note VARCHAR(500) NULL,
  verified_at TIMESTAMP NULL,
  verified_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS student_enrollments (
  enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  subject_code VARCHAR(50) NOT NULL,
  subject_title VARCHAR(255) NOT NULL,
  section VARCHAR(50) NULL,
  school_year VARCHAR(20) NULL,
  term VARCHAR(30) NULL,
  course_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_enroll_user (user_id, school_year, term),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE SET NULL
);
