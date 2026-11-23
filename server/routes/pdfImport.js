const express = require('express');
const multer = require('multer');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { requireAuth } = require('../middleware/auth');
const { httpError, sendError } = require('../lib/http');
const rules = require('../lib/syllabusRules');
const subjectLock = require('../lib/subjectLock');
const assignments = require('../lib/assignments');
const { createLimiter } = require('../lib/rateLimit');
const importer = require('../lib/pdfImport');
const identity = require('../lib/pdfImportIdentity');
const academicYear = require('../lib/academicYear');
const router = express.Router();
const limiter = createLimiter({ max: 5, windowMs: 10 * 60 * 1000 });
// Imports running now, per app: { users: Set of person ids }. Each person runs one import at a time; the server runs
// up to SYLLABUS_PDF_IMPORT_CONCURRENCY (default 2, at most 8) at once, each in its own worker thread.
const active = new WeakMap();
const concurrency = () => Math.min(8, Math.max(1, Number.parseInt(process.env.SYLLABUS_PDF_IMPORT_CONCURRENCY, 10) || 2));
const enabled = () => process.env.SYLLABUS_PDF_IMPORT !== 'off';
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: importer.MAX_BYTES, fields: 0 } }).single('file');
const RECEIVE_MS = 30 * 1000;
const uploadError = error => httpError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code === 'LIMIT_FILE_SIZE' ? 'pdfImport.tooLarge' : 'pdfImport.invalid');
// Reads the upload into memory before anything shared is taken, so a slow or stalled sender holds only its own request
// (never the server-wide extraction slot or a rate-limit slot), and is cut off after RECEIVE_MS.
function receive(req, res) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { reject(httpError(408, 'pdfImport.uploadTimeout')); req.unpipe(); req.resume(); }, RECEIVE_MS);
    upload(req, res, error => { clearTimeout(timer); if (error) reject(uploadError(error)); else resolve(); });
  });
}
// Once a valid PDF is in memory: refuse while this person already has an import running or every extraction slot is taken,
// then use one of this person's rate-limit slots, then hold a slot. Returns the release function.
function claim(req, res, me) {
  if (!active.has(req.app)) active.set(req.app, { users: new Set() });
  const running = active.get(req.app), user = String(me.id);
  if (running.users.has(user) || running.users.size >= concurrency()) throw httpError(409, 'pdfImport.busy');
  const slot = limiter.take(user);
  if (!slot.ok) { res.set('Retry-After', String(slot.retryAfterSec)); throw httpError(429, 'pdfImport.rateLimit'); }
  running.users.add(user);
  return () => running.users.delete(user);
}
router.get('/pdf-import/config', requireAuth, (req, res) => res.json({ enabled: enabled(), maxBytes: importer.MAX_BYTES, maxPages: 30 }));
const codeKey = value => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// The very comparison the form uses at Apply, loaded from src/lib/pdfImportReview.js, so a subject found here is never
// refused at Apply for its title (case, punctuation, "&"/"and", "II"/"2", a trailing "(...)").
let review;
const titleMatcher = async () => (review ??= import(pathToFileURL(path.resolve(__dirname, '../../src/lib/pdfImportReview.js')).href)).then(module => module.titleMatches);
// Subjects the PDF's own course code AND title point at (one code can belong to different subjects in different programs), limited to what this person may write:
// faculty only their assigned subjects, nobody a subject of a past academic year.
async function subjectsForCode(db, me, fields) {
  const key = codeKey(fields.code);
  if (!key || !String(fields.title ?? '').trim()) return [];
  const titleMatches = await titleMatcher();
  const [rows] = await db.query('SELECT c.course_id, c.code, c.title, p.code AS program_code FROM courses c JOIN programs p ON p.program_id = c.program_id');
  const past = await academicYear.pastCourseIds(db);
  const assigned = me.role === 'admin' ? null : new Set((await assignments.loadAssignments(db, me.id)).courseIds);
  const program = String(fields.program ?? '').trim().toUpperCase();
  return rows.filter(r => codeKey(r.code) === key && titleMatches(fields.title, r.title) && !past.has(r.course_id) && (!assigned || assigned.has(r.course_id)) && (!program || String(r.program_code).toUpperCase() === program));
}
// When nothing matched: is the PDF's subject in this year's catalog but simply not assigned to this person? Then say so.
async function existsUnassigned(db, me, fields) {
  if (me.role === 'admin') return false;
  const key = codeKey(fields.code);
  if (!key || !String(fields.title ?? '').trim()) return false;
  const titleMatches = await titleMatcher();
  const [rows] = await db.query('SELECT c.course_id, c.code, c.title FROM courses c');
  const past = await academicYear.pastCourseIds(db);
  return rows.some(r => codeKey(r.code) === key && titleMatches(fields.title, r.title) && !past.has(r.course_id));
}
// Same preview as /:id/import-pdf, for a person who has not chosen a subject: the PDF names it.
// Nothing is saved. The one assigned subject the PDF's code matches is returned so the form can select it.
router.post('/pdf-import/extract', requireAuth, async (req, res) => {
  let release;
  try {
    if (!enabled()) throw httpError(503, 'pdfImport.disabled');
    const db = req.app.locals.db, me = req.session.user;
    await assignments.requireCourseAccess(db, me, null);
    await receive(req, res);
    importer.validatePdf(req.file?.buffer);
    release = claim(req, res, me);
    const preview = await importer.extractPdf(req.file?.buffer);
    const matches = await subjectsForCode(db, me, preview.fields || {});
    if (!matches.length) throw httpError(409, (await existsUnassigned(db, me, preview.fields || {})) ? 'pdfImport.subjectNotAssigned' : 'pdfImport.subjectNotFound');
    if (matches.length > 1) throw httpError(409, 'pdfImport.chooseSubject');
    const [match] = matches;
    await assignments.requireCourseAccess(db, me, match.course_id);
    // Check whether this user already has a syllabus on the matched subject in the current academic year.
    // Editable drafts/returned syllabi are returned so the builder attaches to them instead of creating a duplicate (409 syllabus_exists).
    // Locked syllabi (submitted, under_review, approved) are refused immediately with the real reason.
    const [existingRows] = await academicYear.queryInSameYear(
      db,
      'SELECT syllabus_id, user_id, status FROM syllabi WHERE course_id = ? AND user_id = ? AND archived_at IS NULL',
      [match.course_id, me.id],
    );
    const conflict = subjectLock.conflictFor((existingRows || []).filter((r) => r && r.syllabus_id), me);
    if (conflict && !rules.canEdit(me, { user_id: me.id, status: conflict.status })) {
      throw httpError(409, subjectLock.messageFor(conflict), { code: 'syllabus_exists', existingId: conflict.id, existingStatus: conflict.status });
    }
    res.json({
      ...preview,
      subject: { id: match.course_id, code: match.code, title: match.title, program: match.program_code },
      ...(conflict ? { existingSyllabus: { id: conflict.id, status: conflict.status } } : {}),
      identityContext: await identity.contextFor(db, match.course_id),
    });
  } catch (error) { sendError(res, error); }
  finally { if (release) release(); }
});
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
    await receive(req, res);
    importer.validatePdf(req.file?.buffer);
    release = claim(req, res, me);
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
