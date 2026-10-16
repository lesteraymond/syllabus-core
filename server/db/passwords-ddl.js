// What generated passwords need: a flag on the user ("choose your own password before anything else") and the table that holds a
// temporary password from "Forgot password" apart from the real one, so asking for one can never lock anybody out. One row per user;
// a new request replaces the old one. Used by migrate-passwords.js; server/db/schema.sql carries the same definitions for fresh installs.
module.exports = {
  column: { table: 'users', name: 'must_change_password', ddl: 'ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash' },
  tables: [
    `CREATE TABLE IF NOT EXISTS password_temp (
    user_id INT NOT NULL PRIMARY KEY,
    temp_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  )`,
  ],
};
