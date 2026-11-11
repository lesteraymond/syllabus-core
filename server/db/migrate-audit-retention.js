// Keeps the audit trail when an account or a syllabus is deleted (docs/security/SECURITY-AUDIT-REPORT.md SEC-15, DB-04).
//   submission_logs   syllabus_id and user_id become NULL-able and ON DELETE SET NULL (they were CASCADE: deleting a syllabus or an account erased what was done
//                     to it); new columns subject and actor keep its name, written by the routes just before the delete.
//   account_activity  user_id becomes NULL-able and ON DELETE SET NULL; new columns actor (the name, as above), ip_address and user_agent (of each sign-in line),
//                     and a failed sign-in on an email that is not registered can now be recorded with no account.
// Additive: no row is changed or removed, no table is dropped. Idempotent: it reads information_schema and does only what is missing.
// Run: npm run migrate-audit-retention (from server/); add --dry-run to print the statements and change nothing. Take a backup first.
// Run it with the migration database account (ALTER on this database): set DB_USER and DB_PASS for this command only (server/lib/dbConfig.js).
// Rollback: put the foreign keys back to ON DELETE CASCADE with the same ALTER statements (the new columns can stay; nothing reads them if absent).
require('dotenv').config();

const TABLES = {
  submission_logs: {
    columns: { subject: 'VARCHAR(300) NULL', actor: 'VARCHAR(300) NULL' },
    keys: [{ column: 'syllabus_id', references: 'syllabi(syllabus_id)', name: 'fk_submission_logs_syllabus' }, { column: 'user_id', references: 'users(user_id)', name: 'fk_submission_logs_user' }],
  },
  account_activity: {
    columns: { actor: 'VARCHAR(300) NULL', ip_address: 'VARCHAR(45) NULL', user_agent: 'VARCHAR(255) NULL' },
    keys: [{ column: 'user_id', references: 'users(user_id)', name: 'fk_account_activity_user' }],
  },
};
const IDENTIFIER = /^[A-Za-z0-9_]{1,64}$/;

// The ALTER statements this database still needs, in order. Reads only.
async function plan(conn) {
  const [cols] = await conn.query(
    "SELECT table_name, column_name, is_nullable FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name IN ('submission_logs', 'account_activity')");
  const [fks] = await conn.query(
    "SELECT k.table_name, k.column_name, k.constraint_name, r.delete_rule, k.referenced_table_name FROM information_schema.key_column_usage k JOIN information_schema.referential_constraints r ON r.constraint_schema = k.constraint_schema AND r.constraint_name = k.constraint_name WHERE k.table_schema = DATABASE() AND k.table_name IN ('submission_logs', 'account_activity') AND k.referenced_table_name IS NOT NULL");
  const lower = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  const columns = cols.map(lower), keys = fks.map(lower);
  const steps = [];
  for (const [table, want] of Object.entries(TABLES)) {
    const have = new Map(columns.filter((c) => c.table_name === table).map((c) => [c.column_name, c]));
    if (!have.size) continue; // the table is not there yet: its migration (or schema.sql) creates it in the new shape
    for (const [column, type] of Object.entries(want.columns)) if (!have.has(column)) steps.push(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    for (const key of want.keys) {
      const current = keys.find((k) => k.table_name === table && k.column_name === key.column);
      const nullable = have.get(key.column) && have.get(key.column).is_nullable === 'YES';
      if (current && String(current.delete_rule).toUpperCase() === 'SET NULL' && nullable) continue;
      const parts = [];
      if (current) {
        if (!IDENTIFIER.test(String(current.constraint_name))) throw new Error(`Unexpected constraint name on ${table}.${key.column}; nothing was changed. Fix it by hand.`);
        parts.push(`DROP FOREIGN KEY \`${current.constraint_name}\``);
      }
      parts.push(`MODIFY ${key.column} INT NULL`, `ADD CONSTRAINT \`${key.name}\` FOREIGN KEY (${key.column}) REFERENCES ${key.references} ON DELETE SET NULL`);
      steps.push(`ALTER TABLE ${table} ${parts.join(', ')}`);
    }
  }
  return steps;
}

async function migrate(conn, { dryRun = false } = {}) {
  const steps = await plan(conn);
  if (!dryRun) for (const sql of steps) await conn.query(sql);
  return { steps };
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  (async () => {
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME });
    try {
      const { steps } = await migrate(conn, { dryRun });
      if (!steps.length) console.log('The audit tables already keep their rows: nothing to do.');
      for (const sql of steps) console.log((dryRun ? '[dry run] ' : 'done: ') + sql);
    } finally { await conn.end(); }
  })().catch((e) => { console.error('migrate-audit-retention failed:', e.code || e.message); process.exit(1); });
}

module.exports = { migrate, plan, TABLES };
