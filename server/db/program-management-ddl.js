const statements = [
"CREATE TABLE IF NOT EXISTS program_code_aliases (code VARCHAR(20) PRIMARY KEY, program_id INT NOT NULL, FOREIGN KEY (program_id) REFERENCES programs(program_id) ON DELETE CASCADE)",
`CREATE TABLE IF NOT EXISTS program_name_aliases (program_id INT NOT NULL, name VARCHAR(255) NOT NULL, PRIMARY KEY (program_id, name), FOREIGN KEY (program_id) REFERENCES programs(program_id) ON DELETE CASCADE)`,
`CREATE TABLE IF NOT EXISTS catalog_events (event_id INT AUTO_INCREMENT PRIMARY KEY, actor_id INT NULL, action VARCHAR(30) NOT NULL, program_code VARCHAR(20) NOT NULL, program_name VARCHAR(255) NOT NULL, details LONGTEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE SET NULL)`,
`CREATE TABLE IF NOT EXISTS catalog_file_cleanup (file_path VARCHAR(500) PRIMARY KEY, attempts INT NOT NULL DEFAULT 0, last_error VARCHAR(255) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
];
async function migrate(db) { for (const sql of statements) await db.query(sql); }
module.exports = { statements, migrate };
