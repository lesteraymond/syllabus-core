// Student registration, verified from the Certificate of Registration (COR).
//   POST /scan      (public)  upload a COR photo; the server reads it and keeps the result in the session
//   POST /register  (public)  create the account from that scan; the client sends only a password
//   GET  /me        (student) the signed-in student's profile and enrolled subjects
// There is no administrator review: the scan decides (owner decision 2026-11-23). A scan that cannot confirm the program, the name, or the school year
// and term creates no account; the student retakes the photo and registers again.
// Nothing the student can type decides who they are: the student ID, name and program all come from the scan.
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { requireAuth } = require('../middleware/auth');
const { inTransaction, httpError, sendError } = require('../lib/http');
const { pastCourseIds, resolveYear, yearClause } = require('../lib/academicYear');
const { activeYear } = require('../lib/activeYearGate');
const { PRIVATE_ROOT } = require('../lib/avatar');
const { validatePassword } = require('../lib/passwords');
const { scanCor } = require('../lib/corClaude');
const { createLimiter } = require('../lib/rateLimit');
const accountActivity = require('../lib/accountActivity');
const { TERMS_VERSION } = require('../../shared/corTerms.cjs'); // the registration Terms and Conditions (src/lib/corTerms.js)
const router = express.Router();
const TERMS_NEEDED = 'Please read and agree to the Terms and Conditions to continue.';
const TERMS_CHANGED = 'The Terms and Conditions were updated. Reload the page, read them and agree again.';

const COR_DIR = path.join(PRIVATE_ROOT, 'cor');
const SCAN_TTL_MS = 30 * 60 * 1000;
const NOT_AN_IMAGE = 'Upload a photo of your COR (JPG, PNG or WebP).';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 },
  fileFilter: (req, file, cb) => (/^image\/(jpeg|png|webp)$/.test(file.mimetype) ? cb(null, true) : cb(httpError(400, NOT_AN_IMAGE))),
});
// multer's own refusals become a JSON answer that says why (not the generic error of the final handler).
const onePhoto = (req, res, next) => upload.single('cor')(req, res, (err) => {
  if (!err) return next();
  if (err.status) return sendError(res, err);
  if (err.code === 'LIMIT_FILE_SIZE') return sendError(res, httpError(413, 'That photo is larger than 10 MB.'));
  return sendError(res, httpError(400, NOT_AN_IMAGE));
});

// This route is open to anyone and every scan is a paid Claude call, so it is held back three ways: a few scans per address per hour,
// only SCAN_CONCURRENCY scans read at the same moment for the whole server, and nothing that is not really an image of a sensible size is read at all.
// The per-address limit is generous because a whole campus usually reaches the server from ONE public address (its Wi-Fi), and a class registers
// together: 15 an hour, shared with registering, stopped about 7 students an hour (2026-11-23). One browser is held to a few scans, so a single
// person retaking photos cannot use up the address's allowance. SCAN_CONCURRENCY bounds the spend at any moment; each scan is a small Haiku call.
const SCANS_PER_HOUR = 120; // per address
const SCANS_PER_SESSION = 10; // per browser session, per hour
const REGISTERS_PER_HOUR = 240; // per address; no paid call, and each needs a scan in its own session first
const SCAN_CONCURRENCY = 2;
const MAX_PIXELS = 40 * 1000 * 1000; // 40 megapixels: more than any phone photo of a page
const HOUR = 60 * 60 * 1000;
const scanLimiter = createLimiter({ max: SCANS_PER_HOUR, windowMs: HOUR }); // each prunes itself (lib/rateLimit.js)
const sessionScanLimiter = createLimiter({ max: SCANS_PER_SESSION, windowMs: HOUR });
const registerLimiter = createLimiter({ max: REGISTERS_PER_HOUR, windowMs: HOUR });
const TOO_MANY = 'Too many attempts. Try again later.';
const ALREADY_REGISTERED = 'This student ID is already registered. Sign in instead.';
const refuse = (res, slot) => { res.set('Retry-After', String(slot.retryAfterSec)); return res.status(429).json({ message: TOO_MANY, error: TOO_MANY }); };
function scanRate(req, res, next) {
  const byAddress = scanLimiter.take('ip:' + req.ip);
  if (!byAddress.ok) return refuse(res, byAddress);
  const bySession = sessionScanLimiter.take('sid:' + req.sessionID);
  if (!bySession.ok) { scanLimiter.give('ip:' + req.ip); return refuse(res, bySession); } // this browser's own limit: the address keeps its slot
  return next();
}
function registerRate(req, res, next) {
  const slot = registerLimiter.take('ip:' + req.ip);
  return slot.ok ? next() : refuse(res, slot);
}
let scansRunning = 0;
let readCor = scanCor; // image bytes -> the parsed COR
const setReader = (fn) => { readCor = fn || scanCor; }; // tests replace the reader (like mailer.setTransport)

// What the bytes are, from their first bytes: the declared type and the file name are never trusted.
function imageKind(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

const removeFile = (rel) => (rel ? fs.promises.unlink(path.join(COR_DIR, path.basename(rel))).catch(() => {}) : Promise.resolve());

// What the student is shown: only what was read, never the stored file path.
// What a scan must confirm before an account is made: an accepted program (BSIT, BSCPE or BSIE: lib/corPrograms.js), the student's name, and the school year and term. -> the parts that are not confirmed.
// The registration screen gets the same list with the scan, so it never offers to register what the server will refuse.
const unclearParts = (p) => [...(p.programOk !== 'yes' ? ['program'] : []), ...(!p.studentName ? ['name'] : []), ...(!p.schoolYear || !p.term ? ['term'] : [])];
const UNCLEAR = 'We could not confirm your program, name, school year and term on your COR, so no account was created. Retake the photo (full page, flat, in good light) and register again.';
// Only a COR of the ACTIVE academic year registers (owner decision 2026-11-23): an old COR would make an account for a student who may no longer be
// enrolled. The scan reads "2026-2027" and the year is stored as "2026–2027", so only the digits are compared. When no academic year is active
// (or the table is not there yet) there is nothing to compare with, and the COR is not refused for its year.
const WRONG_YEAR = (cor, active) => `This COR is for the ${cor} school year. Register with your COR for the current academic year, ${active}.`;
const yearDigits = (y) => String(y || '').replace(/\D/g, '');
async function assertCurrentYear(db, parsed) {
  if (!parsed.schoolYear) return; // unreadable: unclearParts says so ('term')
  const active = await activeYear(db);
  if (active && yearDigits(active) !== yearDigits(parsed.schoolYear)) throw httpError(422, WRONG_YEAR(parsed.schoolYear, active), { code: 'cor_wrong_year', corYear: parsed.schoolYear, activeYear: active });
}
const publicScan = (p) => ({
  studentId: p.studentId, studentName: p.studentName, program: p.program, programCode: p.programCode || null, programOk: p.programOk, yearLevel: p.yearLevel,
  section: p.section, schoolYear: p.schoolYear, term: p.term, subjects: p.subjects.map((s) => ({ code: s.code, title: s.title })),
  unclear: unclearParts(p),
});

router.post('/scan', scanRate, onePhoto, async (req, res) => {
  let counted = false;
  try {
    if (!req.file) throw httpError(400, 'Choose a photo of your COR.');
    if (req.body.consent !== 'yes') throw httpError(400, TERMS_NEEDED, { code: 'terms_required' });
    // The consent is to one version of the terms: a page loaded before they changed sends an older one (or none) and must show the new text first.
    if (String(req.body.terms || '') !== TERMS_VERSION) throw httpError(409, TERMS_CHANGED, { code: 'terms_outdated', termsVersion: TERMS_VERSION });
    if (!imageKind(req.file.buffer)) throw httpError(400, NOT_AN_IMAGE);
    let meta;
    try { meta = await sharp(req.file.buffer, { limitInputPixels: false }).metadata(); } catch { throw httpError(400, NOT_AN_IMAGE); } // the header only: no pixels are decoded
    if (!meta.width || !meta.height) throw httpError(400, NOT_AN_IMAGE);
    if (meta.width * meta.height > MAX_PIXELS) throw httpError(413, 'That photo is too large. Take it again with your phone camera at its normal size.');
    if (scansRunning >= SCAN_CONCURRENCY) { res.set('Retry-After', '10'); throw httpError(503, 'Other photos are being read right now. Try again in a few seconds.', { code: 'scanner_busy' }); }
    scansRunning += 1; counted = true;
    const parsed = await readCor(req.file.buffer);
    if (!parsed.studentId) throw httpError(422, 'We could not read the student ID on your COR. Retake the photo: full page, flat, in good light.');
    // Said now, not after "Confirm and register": an ID that already has an account cannot register again (the photo is not kept).
    const [taken] = await req.app.locals.db.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER(?)', [parsed.studentId]);
    if (taken.length) throw httpError(409, ALREADY_REGISTERED, { code: 'already_registered' });
    await assertCurrentYear(req.app.locals.db, parsed); // another school year's COR: refused now, and its photo is never stored
    await fs.promises.mkdir(COR_DIR, { recursive: true });
    const file = `${crypto.randomBytes(12).toString('hex')}.jpg`;
    await sharp(req.file.buffer, { limitInputPixels: MAX_PIXELS }).rotate().resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(path.join(COR_DIR, file));
    if (req.session.corScan) await removeFile(req.session.corScan.file);
    req.session.corScan = { file, parsed, at: Date.now(), terms: TERMS_VERSION, termsAt: new Date().toISOString() }; // the consent, kept for the account
    res.json(publicScan(parsed));
  } catch (err) { sendError(res, err); }
  finally { if (counted) scansRunning -= 1; }
});

// Courses of the catalog that a COR subject matches: by code (spaces and case ignored), else by exact title.
async function matchCourses(db, subjects) {
  const [all] = await db.query('SELECT course_id, code, title FROM courses');
  const past = await pastCourseIds(db); // a student matches the current academic year's subjects
  const courses = all.filter((c) => !past.has(c.course_id));
  const key = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const byCode = new Map(courses.map((c) => [key(c.code), c.course_id]));
  const byTitle = new Map(courses.map((c) => [key(c.title), c.course_id]));
  return subjects.map((s) => byCode.get(key(s.code)) || byTitle.get(key(s.title)) || null);
}

router.post('/register', registerRate, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const password = String(req.body.password || '');
    const problem = validatePassword(password); // the one rule for a password a person chooses (lib/passwords.js): 8 to 72 characters, a letter and a number
    if (problem) throw httpError(400, problem);
    const scan = req.session.corScan;
    if (!scan || Date.now() - scan.at > SCAN_TTL_MS) throw httpError(400, 'Scan your COR again to continue.');
    const p = scan.parsed;

    // Verified only when every check passes. Anything doubtful creates nothing: the photo is deleted and the student scans again (no administrator review).
    const unclear = unclearParts(p);
    if (unclear.length) {
      await removeFile(scan.file);
      req.session.corScan = null;
      throw httpError(422, UNCLEAR, { code: 'cor_unclear', unclear });
    }
    try { await assertCurrentYear(db, p); } // checked again: the administrator may have switched the active year since the scan
    catch (error) { await removeFile(scan.file); req.session.corScan = null; throw error; }
    const status = 'verified';

    // "INSULAR, RAYMOND LESTER" -> last name before the comma, the given names after it.
    const [last, given] = p.studentName && p.studentName.includes(',') ? p.studentName.split(',').map((x) => x.trim()) : [p.studentId, 'Student'];
    const hash = await bcrypt.hash(password, 10);
    const courseIds = await matchCourses(db, p.subjects);

    const userId = await inTransaction(db, async (conn) => {
      const [taken] = await conn.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER(?)', [p.studentId]);
      if (taken.length) throw httpError(409, ALREADY_REGISTERED, { code: 'already_registered' }); // checked again: two registrations at once
      const [u] = await conn.query("INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES (?, ?, 'student', ?, ?)", [p.studentId, hash, given, last]);
      await conn.query(
        `INSERT INTO student_profiles (user_id, student_id, student_name, program, year_level, section, school_year, term, cor_image_path, verification_status, verification_note, verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [u.insertId, p.studentId, p.studentName || p.studentId, p.program || 'Unknown', p.yearLevel, p.section, p.schoolYear, p.term,
         null, status, null, new Date()]
      );
      for (let i = 0; i < p.subjects.length; i++) {
        const s = p.subjects[i];
        await conn.query('INSERT INTO student_enrollments (user_id, subject_code, subject_title, section, school_year, term, course_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [u.insertId, s.code, s.title, s.section, p.schoolYear, p.term, courseIds[i]]);
      }
      return u.insertId;
    });
    // The consent on the new account's record (RA 10173): which version of the Terms and Conditions was agreed to, and when (at the scan). Best effort,
    // like every activity line (lib/accountActivity.js); a scan stored before the terms existed carries no version and records none.
    if (scan.terms) await accountActivity.record(db, { userId, action: 'terms_accept', notes: `${scan.terms} at ${scan.termsAt || ''}`.trim(), request: req });

    await removeFile(scan.file); // the extracted fields are enough; the photo is not kept
    req.session.corScan = null;
    res.json({ status, message: 'Your account is ready. Sign in with your student ID and password.' });
  } catch (err) { sendError(res, err); }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'student') throw httpError(403, 'Students only');
    const db = req.app.locals.db;
    const [[profile]] = await db.query('SELECT student_id, student_name, program, year_level, section, school_year, term, verification_status FROM student_profiles WHERE user_id = ?', [req.session.user.id]);
    const [subjects] = await db.query('SELECT subject_code, subject_title, section, course_id FROM student_enrollments WHERE user_id = ? ORDER BY enrollment_id', [req.session.user.id]);
    res.json({ profile: profile || null, subjects });
  } catch (err) { sendError(res, err); }
});

// What a student may read: every APPROVED syllabus, like the Repository (the subjects on their own COR are marked). Read-only: no draft, no unapproved
// version, no archived one, and nothing here writes anything. The ? in ENROLLED is the student's id.
const ENROLLED = '(s.course_id IN (SELECT course_id FROM student_enrollments WHERE user_id = ? AND course_id IS NOT NULL))';
const FOR_STUDENT = `FROM syllabi s JOIN users u ON u.user_id = s.user_id
  LEFT JOIN courses c ON c.course_id = s.course_id LEFT JOIN programs p ON p.program_id = c.program_id
  WHERE s.status = 'approved' AND s.archived_at IS NULL`;
// The academic year is the syllabus's own (syllabi.academic_year); a database before that migration has no such column, so the read is repeated without it.
async function readSyllabi(db, sql, params, inYear = null) {
  const filterSql = inYear && inYear.sql ? inYear.sql : '';
  const filterParams = inYear && inYear.params ? inYear.params : [];
  try { return await db.query(sql.replace('/*Y*/', ', s.academic_year').replace('/*YF*/', filterSql), [...params, ...filterParams]); }
  catch (err) { if (err && err.code === 'ER_BAD_FIELD_ERROR') return db.query(sql.replace('/*Y*/', '').replace('/*YF*/', ''), params); throw err; }
}
const studentOnly = (req) => { if (req.session.user.role !== 'student') throw httpError(403, 'Students only'); };
const summaryOf = (r) => ({ id: r.syllabus_id, courseId: r.course_id, courseCode: r.course_code, title: r.title, version: r.version, program: r.program_code || '', academicYear: r.academic_year || null, enrolled: !!r.enrolled, faculty: [r.first_name, r.last_name].filter(Boolean).join(' '), updatedAt: r.updated_at, hasFile: !!r.file_path });

router.get('/syllabi', requireAuth, async (req, res) => {
  try {
    studentOnly(req);
    const db = req.app.locals.db;
    const inYear = yearClause(await resolveYear(db, req.session.user));
    const [rows] = await readSyllabi(db, 'SELECT s.syllabus_id, s.course_id, s.course_code, s.title, s.version, s.file_path, s.updated_at, u.first_name, u.last_name, p.code AS program_code/*Y*/, ' + ENROLLED + ' AS enrolled ' + FOR_STUDENT + '/*YF*/ ORDER BY s.uploaded_at DESC', [req.session.user.id], inYear);
    const seen = new Set();
    // the newest approved one per subject (a syllabus with no catalog subject stands on its own)
    res.json({ syllabi: rows.filter((r) => (r.course_id == null ? true : seen.has(r.course_id) ? false : seen.add(r.course_id))).map(summaryOf) });
  } catch (err) { sendError(res, err); }
});

router.get('/syllabi/:id', requireAuth, async (req, res) => {
  try {
    studentOnly(req);
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(404, 'Syllabus not found');
    const [rows] = await readSyllabi(req.app.locals.db, 'SELECT s.syllabus_id, s.course_id, s.course_code, s.title, s.version, s.file_path, s.content, s.updated_at, u.first_name, u.last_name, p.code AS program_code/*Y*/, ' + ENROLLED + ' AS enrolled ' + FOR_STUDENT + ' AND s.syllabus_id = ?', [req.session.user.id, id]);
    const r = rows[0];
    if (!r) throw httpError(404, 'Syllabus not found'); // not approved, archived, or not there: the same answer
    let content = null;
    if (r.content) { try { content = JSON.parse(r.content); } catch { content = null; } }
    // The viewer needs the program's outcomes, and students cannot read the outcomes API: send the snapshot stored with the syllabus, or build one.
    if (content && !content.catalog) { try { content.catalog = await require('./syllabusContent').catalogSnapshot(req.app.locals.db, content); } catch { /* the viewer then shows what it can */ } }
    // The printed form's sign-off (who checked it at each stage, who approved it and when), as staff see it (routes/reviewChain.js GET /:id/stages).
    // Best effort: without the stage table, or if it cannot be read, the form prints without names.
    let signoffs = null;
    try {
      const reviewStages = require('../lib/reviewStages');
      const db = req.app.locals.db;
      if (await reviewStages.isInstalled(db)) signoffs = { enabled: true, stages: (await reviewStages.stagesOf(db, [id])).get(id), approved: await reviewStages.approvalOf(db, id), submitted: await reviewStages.submittedOf(db, id) };
    } catch { signoffs = null; }
    res.json({ syllabus: summaryOf(r), content, file: r.file_path ? { path: r.file_path } : null, signoffs });
  } catch (err) { sendError(res, err); }
});

// The uploaded PDF of an approved syllabus a student may read (same rule as the detail route above). ?download=1 sends it as a download.
router.get('/syllabi/:id/file', requireAuth, async (req, res) => {
  try {
    studentOnly(req);
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw httpError(404, 'File not found');
    const [rows] = await readSyllabi(req.app.locals.db, 'SELECT s.syllabus_id, s.file_path/*Y*/, ' + ENROLLED + ' AS enrolled ' + FOR_STUDENT + ' AND s.syllabus_id = ?', [req.session.user.id, id]);
    const file = rows[0] && require('./syllabusFiles').storedFile(rows[0].file_path);
    if (!file) throw httpError(404, 'File not found');
    const name = path.basename(file).replace(/[^A-Za-z0-9._ -]/g, '_');
    res.removeHeader('X-Frame-Options');
    res.sendFile(file, {
      dotfiles: 'deny',
      cacheControl: false,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${name}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': `frame-ancestors ${require('./syllabusFiles').frameAncestors()}`, // the app's own origins, as the staff file route (E2E report 2026-11-23, BUG-014)
      },
    }, (err) => { if (err && !res.headersSent) res.status(404).json({ error: 'File not found' }); });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
module.exports.scanLimiter = scanLimiter;
module.exports.sessionScanLimiter = sessionScanLimiter;
module.exports.registerLimiter = registerLimiter;
module.exports.SCANS_PER_SESSION = SCANS_PER_SESSION;
module.exports.setReader = setReader;
module.exports.SCAN_CONCURRENCY = SCAN_CONCURRENCY;
module.exports.SCANS_PER_HOUR = SCANS_PER_HOUR;
