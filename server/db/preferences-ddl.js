const SETTINGS_DDL = `CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(60) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`;
async function migratePreferences(conn) {
  const [cols] = await conn.query("SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'preferred_language'");
  if (!cols.length) await conn.query("ALTER TABLE users ADD COLUMN preferred_language VARCHAR(2) NOT NULL DEFAULT 'en'");
  await conn.query(SETTINGS_DDL);
}
module.exports = { SETTINGS_DDL, migratePreferences };
