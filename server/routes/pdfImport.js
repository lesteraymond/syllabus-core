const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { httpError, sendError } = require('../lib/http');
const rules = require('../lib/syllabusRules');
const assignments = require('../lib/assignments');
const { createLimiter } = require('../lib/rateLimit');
const importer = require('../lib/pdfImport');
const identity = require('../lib/pdfImportIdentity');
const router = express.Router();
const limiter = createLimiter({ max: 5, windowMs: 10 * 60 * 1000 });
const active = new WeakSet();
const enabled = () => process.env.SYLLABUS_PDF_IMPORT !== 'off';
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: importer.MAX_BYTES, fields: 0 } }).single('file');
router.get('/pdf-import/config', requireAuth, (req, res) => res.json({ enabled: enabled(), maxBytes: importer.MAX_BYTES, maxPages: 30 }));
// Preview only. No file is published, no draft is written, no AI is invoked.
router.post('/:id/import-pdf', requireAuth, async (req, res) => {
  let release;
  try {
    if (!enabled()) throw httpError(503, 'pdfImport.disabled');
    const db = req.app.locals.db, me = req.session.user;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw httpError(404, 'Syllabus not found');
    const [rows] = await db.query('SELECT * FROM syllabi WHERE syllabus_id = ?', [id]);
    const syl = rows[0];
    if (!syl || !rules.isOwner(me, syl)) throw httpError(404, 'Syllabus not found');
    if (!rules.canEdit(me, syl)) throw httpError(409, rules.lockedMessage(syl));
    if (!syl.course_id) throw httpError(409, 'pdfImport.chooseSubject');
    await assignments.requireCourseAccess(db, me, syl.course_id);
    if (active.has(req.app)) throw httpError(409, 'pdfImport.busy');
    const slot = limiter.take(String(me.id));
    if (!slot.ok) { res.set('Retry-After', String(slot.retryAfterSec)); throw httpError(429, 'pdfImport.rateLimit'); }
    active.add(req.app); release = () => active.delete(req.app);
    await new Promise((resolve, reject) => upload(req, res, error => error ? reject(httpError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code === 'LIMIT_FILE_SIZE' ? 'pdfImport.tooLarge' : 'pdfImport.invalid')) : resolve()));
    importer.validatePdf(req.file?.buffer);
    const preview = await importer.extractPdf(req.file?.buffer);
    // A status/assignment change while extraction ran must not produce a usable
    // preview for an inaccessible draft. The normal content PUT checks again too.
    const [latest] = await db.query('SELECT * FROM syllabi WHERE syllabus_id = ?', [id]);
    if (!latest[0] || !rules.isOwner(me, latest[0]) || !rules.canEdit(me, latest[0]) || latest[0].course_id !== syl.course_id) throw httpError(409, 'pdfImport.draftChanged');
    await assignments.requireCourseAccess(db, me, latest[0].course_id);
    res.json({ ...preview, identityContext: await identity.contextFor(db, latest[0].course_id) });
  } catch (error) { sendError(res, error); }
  finally { if (release) release(); }
});
module.exports = router;
module.exports.limiter = limiter;
