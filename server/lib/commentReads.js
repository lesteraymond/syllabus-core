// Which reviewer comments a faculty member has read. The table is created by `npm run migrate-comment-reads`; until then every function
// here answers as if tracking did not exist (unread is null), and nothing else in the app is affected.

// Only a positive answer is remembered, so running the migration needs no restart.
let installed = false;
async function isInstalled(db) {
  if (installed) return true;
  try { await db.query('SELECT 1 FROM comment_reads LIMIT 1'); installed = true; } catch { installed = false; }
  return installed;
}
const resetInstalledCache = () => { installed = false; };

// For each of a faculty member's syllabi that has comments: how many there are and how many are unread (comments by someone else, newer
// than the last one read). `unread` is null when tracking is not installed. Returns { [syllabusId]: { total, unread } }.
async function counts(db, userId) {
  const ready = await isInstalled(db);
  const [rows] = ready
    ? await db.query(
      `SELECT c.syllabus_id, COUNT(*) AS total, SUM(c.comment_id > COALESCE(r.last_comment_id, 0) AND c.user_id <> ?) AS unread
       FROM comments c JOIN syllabi s ON s.syllabus_id = c.syllabus_id
       LEFT JOIN comment_reads r ON r.user_id = s.user_id AND r.syllabus_id = c.syllabus_id
       WHERE s.user_id = ? GROUP BY c.syllabus_id`, [userId, userId])
    : await db.query(
      `SELECT c.syllabus_id, COUNT(*) AS total FROM comments c JOIN syllabi s ON s.syllabus_id = c.syllabus_id
       WHERE s.user_id = ? GROUP BY c.syllabus_id`, [userId]);
  return { installed: ready, counts: Object.fromEntries(rows.map((r) => [r.syllabus_id, { total: Number(r.total), unread: ready ? Number(r.unread || 0) : null }])) };
}

// The id of the last comment this person has read on a syllabus (0 if none), or null when tracking is not installed.
async function lastRead(db, userId, syllabusId) {
  if (!(await isInstalled(db))) return null;
  const [rows] = await db.query('SELECT last_comment_id FROM comment_reads WHERE user_id = ? AND syllabus_id = ?', [userId, syllabusId]);
  return rows[0] ? rows[0].last_comment_id : 0;
}

// Marks everything on the syllabus as read. It only ever moves forward, so reading an old copy of the thread cannot make comments unread
// again. Returns false when tracking is not installed.
async function markRead(db, userId, syllabusId) {
  if (!(await isInstalled(db))) return false;
  const [[row]] = await db.query('SELECT COALESCE(MAX(comment_id), 0) AS last FROM comments WHERE syllabus_id = ?', [syllabusId]);
  await db.query(
    'INSERT INTO comment_reads (user_id, syllabus_id, last_comment_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE last_comment_id = GREATEST(last_comment_id, VALUES(last_comment_id))',
    [userId, syllabusId, row.last]
  );
  return true;
}

module.exports = { isInstalled, resetInstalledCache, counts, lastRead, markRead };
