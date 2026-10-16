// The table that remembers, for each faculty member and syllabus, the last reviewer comment they have read. One row per pair; a comment is
// unread when its id is greater than last_comment_id. Used by migrate-comment-reads.js; server/db/schema.sql carries the same definition
// for fresh installs (server/routes/comments.routes.test.js checks that the two agree).
module.exports = [
  `CREATE TABLE IF NOT EXISTS comment_reads (
    user_id INT NOT NULL,
    syllabus_id INT NOT NULL,
    last_comment_id INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, syllabus_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (syllabus_id) REFERENCES syllabi(syllabus_id) ON DELETE CASCADE
  )`,
];
