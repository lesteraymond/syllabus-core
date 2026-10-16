const path = require('path');

// Avatars live OUTSIDE the public /uploads static folder and are only served by
// GET /api/users/:id/avatar (see routes/users.js), which checks who is asking.
const PRIVATE_ROOT = path.join(__dirname, '..', process.env.PRIVATE_DIR || 'private');
const AVATAR_DIR = path.join(PRIVATE_ROOT, 'avatars');

// users.avatar_path is stored relative to PRIVATE_ROOT, e.g. "avatars/u2-1791825591628.webp".
const avatarRelPath = (fileName) => `avatars/${fileName}`;

// Only the basename of the stored value is ever used on disk, so a bad value can't escape AVATAR_DIR.
const avatarFile = (avatarPath) => (avatarPath ? path.join(AVATAR_DIR, path.basename(avatarPath)) : null);

// The one place an avatar URL is built. The ?v= part is the upload timestamp from the file name,
// so a new upload changes the URL and browsers don't show a stale cached photo.
function avatarUrlFor(userId, avatarPath) {
  if (!avatarPath) return null;
  const m = path.basename(avatarPath).match(/-(\d+)\.[a-z]+$/);
  return `/api/users/${userId}/avatar${m ? `?v=${m[1]}` : ''}`;
}

module.exports = { PRIVATE_ROOT, AVATAR_DIR, avatarRelPath, avatarFile, avatarUrlFor };
