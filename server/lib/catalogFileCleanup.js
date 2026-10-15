const fs = require('fs/promises');
const path = require('path');
let running = null;
function uploadFile(filePath, root = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads')) {
  const match = /^\/uploads\/([A-Za-z0-9][A-Za-z0-9._-]*\.pdf)$/i.exec(String(filePath));
  if (!match || match[1].includes('..')) throw new Error('Invalid syllabus upload path');
  const target = path.resolve(root, match[1]);
  if (path.dirname(target) !== path.resolve(root)) throw new Error('Upload path escaped storage');
  return target;
}
async function drain(db, { root, unlink = fs.unlink } = {}) {
  const [jobs] = await db.query('SELECT file_path FROM catalog_file_cleanup ORDER BY created_at LIMIT 100');
  for (const job of jobs) {
    try {
      const target = uploadFile(job.file_path, root);
      const [references] = await db.query('SELECT 1 FROM syllabi WHERE file_path = ? UNION ALL SELECT 1 FROM syllabus_versions WHERE file_path = ? LIMIT 1', [job.file_path, job.file_path]);
      if (!references.length) {
        try { await unlink(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      await db.query('DELETE FROM catalog_file_cleanup WHERE file_path = ?', [job.file_path]);
    } catch (error) {
      await db.query('UPDATE catalog_file_cleanup SET attempts = attempts + 1, last_error = ? WHERE file_path = ?', [String(error.message).slice(0, 255), job.file_path]);
    }
  }
  const [[row]] = await db.query('SELECT COUNT(*) AS pending FROM catalog_file_cleanup');
  return { pending: Number(row.pending) };
}
function processCleanup(db) {
  if (!running) running = drain(db).finally(() => { running = null; });
  return running;
}
function startCleanup(db) {
  const run = () => processCleanup(db).catch(error => { if (error.code !== 'ER_NO_SUCH_TABLE') console.error('Catalog file cleanup:', error.code || error.message); });
  run();
  const timer = setInterval(run, 5 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
module.exports = { uploadFile, drain, processCleanup, startCleanup };
