// An uploaded syllabus file, read through the API. Mounted on /api/syllabi.
//   GET /:id/file              the file of the syllabus as it is now
//   GET /:id/file?version=12   the file of one of its versions
//   ...&download=1             sent as a download instead of opened in the browser
// Uploaded files are private. There is no public /uploads folder: this route is the only way to a file, and it answers the same people who may read the
// syllabus (lib/syllabusRules.js canView: its owner, and a reviewer once it is not a draft). Everyone else gets 404, signed-out callers 401.
// The stored path (syllabi.file_path, syllabus_versions.file_path: "/uploads/<name>.pdf") is resolved by storedFile below, which never leaves the upload
// folder, never reaches the old avatars folder, and only ever names a PDF.
const path = require('path');
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { httpError, sendError } = require('../lib/http');
const rules = require('../lib/syllabusRules');
const router = express.Router();

const uploadRoot = () => path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._ -]*$/; // a plain file or folder name: no "..", no leading dot, no slash, backslash, percent or control character

// "/uploads/1791825591628-1234.pdf" -> the absolute file inside `root`, or null for anything else.
function storedFile(filePath, root = uploadRoot()) {
  if (typeof filePath !== 'string' || !filePath.startsWith('/uploads/')) return null;
  const parts = filePath.slice('/uploads/'.length).split('/');
  if (!parts.length || parts.some((part) => !SEGMENT.test(part) || part.toLowerCase() === 'avatars')) return null;
  if (!/\.pdf$/i.test(parts[parts.length - 1])) return null;
  const base = path.resolve(root), target = path.resolve(base, ...parts);
  if (!target.startsWith(base + path.sep)) return null;
  return target;
}

// The pages that may show the file in a frame: the application's own origins (lib/hostConfig.js), never anyone else's.
function frameAncestors() {
  try { return ["'self'", ...require('../lib/hostConfig').resolveHostConfig(process.env).origins].join(' '); } catch { return "'self'"; }
}

router.get('/:id/file', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(404, 'File not found');
    const [rows] = await db.query('SELECT syllabus_id, user_id, status, file_path FROM syllabi WHERE syllabus_id = ?', [id]);
    const syl = rows[0];
    if (!syl || !rules.canView(req.session.user, syl)) throw httpError(404, 'File not found'); // never reveal it to non-participants

    let stored = syl.file_path;
    if (req.query.version !== undefined) {
      const versionId = Number(req.query.version);
      if (!Number.isInteger(versionId) || versionId <= 0) throw httpError(404, 'File not found');
      const [versions] = await db.query('SELECT file_path FROM syllabus_versions WHERE version_id = ? AND syllabus_id = ?', [versionId, id]);
      if (!versions[0]) throw httpError(404, 'File not found'); // not one of this syllabus's versions
      stored = versions[0].file_path;
    }
    const file = storedFile(stored);
    if (!file) throw httpError(404, 'File not found');

    const name = path.basename(file).replace(/[^A-Za-z0-9._ -]/g, '_');
    res.removeHeader('X-Frame-Options'); // the review window shows the PDF in a frame of the application's own page; frame-ancestors below says which pages may
    res.sendFile(file, {
      dotfiles: 'deny',
      cacheControl: false, // set explicitly below
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${name}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': `frame-ancestors ${frameAncestors()}`,
      },
    }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: 'File not found' }); // missing on disk
    });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
module.exports.storedFile = storedFile;
