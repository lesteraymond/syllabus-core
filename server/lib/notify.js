// Creates an in-app notification. It never throws: a failed notification must not break the
// action that triggered it (sending a message, changing a status, submitting a syllabus).
async function createNotification(db, { userId, type, syllabusId = null, title, body = '' }) {
  try {
    if (!userId || !type || !title) return;
    await db.query(
      'INSERT INTO notifications (user_id, type, syllabus_id, title, body) VALUES (?, ?, ?, ?, ?)',
      [userId, type, syllabusId, String(title).slice(0, 255), String(body).slice(0, 1000)]
    );
  } catch (err) {
    console.error('NOTIFICATION ERROR:', err.message);
  }
}

// Notify every admin (optionally except one user, e.g. the person who triggered it). Also never throws.
async function notifyAdmins(db, { exceptUserId = null, ...n }) {
  try {
    const [admins] = await db.query("SELECT user_id FROM users WHERE role = 'admin' AND user_id <> ?", [exceptUserId ?? 0]);
    await Promise.all(admins.map((a) => createNotification(db, { ...n, userId: a.user_id })));
  } catch (err) {
    console.error('NOTIFICATION ERROR:', err.message);
  }
}

module.exports = { createNotification, notifyAdmins };
