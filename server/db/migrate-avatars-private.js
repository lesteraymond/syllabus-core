// One-time, idempotent: moves profile photos out of the public uploads/avatars folder into the
// private avatars folder and makes users.avatar_path relative ("avatars/<file>").
// Usage: node db/migrate-avatars-private.js [--dry-run]
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { AVATAR_DIR, avatarRelPath } = require('../lib/avatar');

const LEGACY_DIR = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads', 'avatars');
const AVATAR_FILE = /^u\d+-\d+\.(jpg|png|webp)$/;

async function move(from, to) {
  try {
    await fs.promises.rename(from, to);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    await fs.promises.copyFile(from, to); // different drive: copy then delete
    await fs.promises.unlink(from);
  }
}

async function migrate({ db, legacyDir = LEGACY_DIR, newDir = AVATAR_DIR, dryRun = false, log = console.log }) {
  const say = (m) => log(dryRun ? `[dry run] ${m}` : m);
  if (!dryRun) await fs.promises.mkdir(newDir, { recursive: true });

  // 1) move every legacy avatar file (including any orphans that were publicly reachable)
  let moved = 0;
  const legacy = fs.existsSync(legacyDir) ? await fs.promises.readdir(legacyDir) : [];
  for (const name of legacy.filter((n) => AVATAR_FILE.test(n))) {
    const dest = path.join(newDir, name);
    if (fs.existsSync(dest)) { say(`skip ${name}: already in private folder`); continue; }
    say(`move ${name}`);
    if (!dryRun) await move(path.join(legacyDir, name), dest);
    moved++;
  }

  // 2) make the column relative
  const [rows] = await db.query('SELECT user_id, avatar_path FROM users WHERE avatar_path IS NOT NULL');
  let updated = 0;
  for (const r of rows) {
    const name = path.basename(r.avatar_path);
    const rel = avatarRelPath(name);
    if (r.avatar_path === rel) continue;
    say(`user ${r.user_id}: ${r.avatar_path} -> ${rel}`);
    if (!dryRun) await db.query('UPDATE users SET avatar_path = ? WHERE user_id = ?', [rel, r.user_id]);
    updated++;
  }
  say(`done: ${moved} file(s) moved, ${updated} row(s) updated`);
  return { moved, updated };
}

module.exports = { migrate };

if (require.main === module) {
  (async () => {
    const mysql = require('mysql2/promise');
    const db = await mysql.createConnection({
      host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME,
    });
    try {
      await migrate({ db, dryRun: process.argv.includes('--dry-run') });
    } finally {
      await db.end();
    }
  })().catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
}
