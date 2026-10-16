// Time-usage tracking: one row per user per day, holding the active seconds counted that day. The server keeps the live counting in
// memory and writes these rows in one batch about once a minute, so the table stays small (one row per user per day) and is written
// rarely. Used by migrate-usage.js; schema.sql carries the same definition for fresh installs.
module.exports = {
  tables: [
    `CREATE TABLE IF NOT EXISTS usage_daily (
    user_id INT NOT NULL,
    usage_date DATE NOT NULL,
    active_seconds INT NOT NULL DEFAULT 0,
    session_count SMALLINT NOT NULL DEFAULT 0,
    longest_session_seconds INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, usage_date),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  )`,
  ],
};
