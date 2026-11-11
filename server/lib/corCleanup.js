'use strict';
// COR photos nobody needs any more. POST /api/students/scan saves the photo in private/cor and keeps its name in the visitor's session, for the registration
// that follows (routes/students.js). A visitor who scans and leaves, or whose session ends, would leave a student's COR on disk for good. The sweep removes a
// photo once it is older than a scan lasts and no registration waiting for an administrator refers to it (student_profiles.cor_image_path).
// It removes nothing when the database cannot be asked, and touches only .jpg files directly in the folder.
const fs = require('fs/promises');
const path = require('path');

const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000; // twice the 30 minutes a scan stays usable, so a registration in progress is never cut short
const EVERY_MS = 15 * 60 * 1000;
const corDir = () => path.join(require('./avatar').PRIVATE_ROOT, 'cor');

// -> { removed, kept }. Throws when the database cannot be asked (and then removes nothing).
async function sweepCorPhotos(db, { dir = corDir(), now = Date.now(), maxAgeMs = DEFAULT_MAX_AGE_MS } = {}) {
  let names;
  try { names = await fs.readdir(dir); } catch (error) { if (error.code === 'ENOENT') return { removed: 0, kept: 0 }; throw error; }
  const photos = names.filter((name) => /^[A-Za-z0-9_-]+\.jpg$/.test(name));
  if (!photos.length) return { removed: 0, kept: 0 };
  const [rows] = await db.query('SELECT cor_image_path FROM student_profiles WHERE cor_image_path IS NOT NULL');
  const inUse = new Set(rows.map((row) => path.basename(String(row.cor_image_path))));
  let removed = 0, kept = 0;
  for (const name of photos) {
    const file = path.join(dir, name);
    let stat;
    try { stat = await fs.stat(file); } catch { continue; }
    if (inUse.has(name) || now - stat.mtimeMs < maxAgeMs) { kept += 1; continue; }
    try { await fs.unlink(file); removed += 1; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { removed, kept };
}

function startCorCleanup(db) {
  const run = () => sweepCorPhotos(db).catch((error) => { if (error.code !== 'ER_NO_SUCH_TABLE') console.error('COR photo cleanup:', error.code || error.message); });
  run();
  const timer = setInterval(run, EVERY_MS);
  timer.unref();
  return () => clearInterval(timer);
}

module.exports = { sweepCorPhotos, startCorCleanup, DEFAULT_MAX_AGE_MS };
