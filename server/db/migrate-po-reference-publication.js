// Prepares the database for Admin-saved reference versions (lib/programPoReferences.js): a version per program row (and so per academic year), who saved it and when, the version it supersedes, and
// an audit trail that also keeps the before and after of EGA and Vision/Mission saves.
// Purely additive and safe to run again: it creates the three program_po_reference_* tables when they do not exist (the controlled official-PO migration creates the same tables with the same
// columns it needs; it keeps working because every new column has a default), and adds the new columns to a table that already has them. It never changes or deletes a row and never touches
// program_outcomes. Existing versions get status 'published' by default.
// NOT run by any test or tool against an existing database; applying it is a separate, authorized step. Run: npm run migrate-po-reference-publication (from server/).
const mysql = require('mysql2/promise');
const TABLES = [
  `CREATE TABLE IF NOT EXISTS program_po_reference_versions (
    reference_id VARCHAR(100) PRIMARY KEY, program_id INT NOT NULL, version_label VARCHAR(80) NOT NULL, source_file VARCHAR(500) NOT NULL, source_sha256 CHAR(64) NOT NULL, outcomes_json LONGTEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (program_id) REFERENCES programs(program_id) ON DELETE RESTRICT)`,
  `CREATE TABLE IF NOT EXISTS program_po_reference_active (
    program_id INT PRIMARY KEY, reference_id VARCHAR(100) NOT NULL,
    FOREIGN KEY (program_id) REFERENCES programs(program_id) ON DELETE RESTRICT, FOREIGN KEY (reference_id) REFERENCES program_po_reference_versions(reference_id) ON DELETE RESTRICT)`,
  `CREATE TABLE IF NOT EXISTS program_po_reference_audit (
    audit_id BIGINT AUTO_INCREMENT PRIMARY KEY, reference_id VARCHAR(100) NULL, program_id INT NULL, action VARCHAR(30) NOT NULL, actor_id INT NULL,
    at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, details_json LONGTEXT NULL, KEY program_po_reference_audit_program (program_id, audit_id))`,
];
const COLUMNS = [
  ['status', "VARCHAR(20) NOT NULL DEFAULT 'published'"], ['academic_year', 'VARCHAR(9) NULL'], ['published_by', 'INT NULL'], ['published_at', 'TIMESTAMP NULL DEFAULT NULL'],
  ['supersedes_reference_id', 'VARCHAR(100) NULL'], ['created_by', 'INT NULL'],
];
// An existing published version can be explicitly ASSOCIATED with another academic year's program row of the same program code (no copy of the statements): the association lives on the
// active pointer, with who made it and why. 'owner' is every pointer that exists today.
const ACTIVE_COLUMNS = [['association', "VARCHAR(10) NOT NULL DEFAULT 'owner'"], ['associated_by', 'INT NULL'], ['associated_at', 'TIMESTAMP NULL DEFAULT NULL'], ['association_note', 'VARCHAR(500) NULL']];
async function main() {
  require('dotenv').config();
  const conn = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
  try {
    for (const ddl of TABLES) await conn.query(ddl);
    for (const [name, type] of COLUMNS) {
      const [found] = await conn.query('SHOW COLUMNS FROM program_po_reference_versions LIKE ?', [name]);
      if (!found.length) await conn.query(`ALTER TABLE program_po_reference_versions ADD COLUMN ${name} ${type}`);
    }
    for (const [name, type] of ACTIVE_COLUMNS) {
      const [found] = await conn.query('SHOW COLUMNS FROM program_po_reference_active LIKE ?', [name]);
      if (!found.length) await conn.query(`ALTER TABLE program_po_reference_active ADD COLUMN ${name} ${type}`);
    }
    console.log('Reference versions are ready. No version was created and no existing row was changed.');
  } finally { await conn.end(); }
}
module.exports = { TABLES, COLUMNS, ACTIVE_COLUMNS }; // read by scripts/po-reference-publication/check.cjs (dry run); requiring this file runs nothing
if (require.main === module) main().catch((error) => { console.error('PO reference publication migration failed:', error.message); process.exitCode = 1; });
