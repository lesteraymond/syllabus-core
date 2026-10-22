// Student registration, verified from the Certificate of Registration (COR).
//   POST /scan      (public)  upload a COR photo; the server reads it and keeps the result in the session
//   POST /register  (public)  create the account from that scan; the client sends only a password
//   GET  /me        (student) the signed-in student's profile and enrolled subjects
//   GET  /pending, GET /:id/cor, POST /:id/verify  (admin) the review queue for registrations that were not auto-verified
// Nothing the student can type decides who they are: the student ID, name and program all come from the scan.
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { inTransaction, httpError, sendError } = require('../lib/http');
const { PRIVATE_ROOT } = require('../lib/avatar');
const { extractCor } = require('../lib/corAi');
const { readText } = require('../lib/corOcr');
const { parseCor } = require('../lib/corParser');
const router = express.Router();

const COR_DIR = path.join(PRIVATE_ROOT, 'cor');
const SCAN_TTL_MS = 30 * 60 * 1000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (/^image\/(jpeg|png|webp)$/.test(file.mimetype) ? cb(null, true) : cb(httpError(400, 'Upload a photo of your COR (JPG, PNG or WebP).'))),
});

// A few scans per address per hour: OCR is slow and this route is open to anyone.
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const list = (hits.get(req.ip) || []).filter((t) => now - t < 60 * 60 * 1000);
  if (list.length >= 15) return res.status(429).json({ message: 'Too many attempts. Try again later.', error: 'Too many attempts. Try again later.' });
  list.push(now);
  hits.set(req.ip, list);
  next();
}

const removeFile = (rel) => (rel ? fs.promises.unlink(path.join(COR_DIR, path.basename(rel))).catch(() => {}) : Promise.resolve());

// What the student is shown: only what was read, never the stored file path.
const publicScan = (p) => ({
  studentId: p.studentId, studentName: p.studentName, program: p.program, bsit: p.bsit, yearLevel: p.yearLevel,
  section: p.section, schoolYear: p.schoolYear, term: p.term, subjects: p.subjects.map((s) => ({ code: s.code, title: s.title })),
});

router.post('/scan', rateLimit, upload.single('cor'), async (req, res) => {
  try {
    if (!req.file) throw httpError(400, 'Choose a photo of your COR.');
    // The uploaded photo is read by the AI alone: a missing key or a provider failure is reported, never guessed around.
    // COR_READER=ocr is for testing only: it reads the photo with Tesseract OCR instead (no AI, nothing leaves the server).
    let parsed;
    if (process.env.COR_READER === 'ocr') parsed = parseCor(await readText(req.file.buffer));
    else {
      try { parsed = await extractCor(req.file.buffer); } catch (err) { console.warn('COR AI read failed:', err.message); throw httpError(503, 'We could not read your COR right now (' + String(err.message || 'unknown error').replace(/\.$/, '').slice(0, 140) + '). Try again in a moment.'); }
      if (!parsed) throw httpError(503, 'COR scanning is not available right now. Ask an administrator.');
    }
    if (!parsed.studentId) throw httpError(422, 'We could not read the student ID on your COR. Retake the photo: full page, flat, in good light.');
    await fs.promises.mkdir(COR_DIR, { recursive: true });
    const file = `${crypto.randomBytes(12).toString('hex')}.jpg`;
    await sharp(req.file.buffer).rotate().resize({ width: 2000, withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(path.join(COR_DIR, file));
    if (req.session.corScan) await removeFile(req.session.corScan.file);
    req.session.corScan = { file, parsed, at: Date.now() };
    res.json(publicScan(parsed));
  } catch (err) { sendError(res, err); }
});

// Courses of the catalog that a COR subject matches: by code (spaces and case ignored), else by exact title.
async function matchCourses(db, subjects) {
  const [courses] = await db.query('SELECT course_id, code, title FROM courses');
  const key = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const byCode = new Map(courses.map((c) => [key(c.code), c.course_id]));
  const byTitle = new Map(courses.map((c) => [key(c.title), c.course_id]));
  return subjects.map((s) => byCode.get(key(s.code)) || byTitle.get(key(s.title)) || null);
}

router.post('/register', rateLimit, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const password = String(req.body.password || '');
    if (password.length < 8) throw httpError(400, 'Use a password of at least 8 characters.');
    const scan = req.session.corScan;
    if (!scan || Date.now() - scan.at > SCAN_TTL_MS) throw httpError(400, 'Scan your COR again to continue.');
    const p = scan.parsed;

    // Verified automatically only when every check passes; anything doubtful goes to an admin instead of being rejected.
    const notes = [];
    if (p.bsit !== 'yes') notes.push(p.bsit === 'maybe' ? 'Program not fully readable (could be another Information program)' : 'Program not readable');
    if (!p.studentName) notes.push('Name not readable');
    if (!p.schoolYear || !p.term) notes.push('Term not readable');
    const status = notes.length ? 'pending' : 'verified';

    // "INSULAR, RAYMOND LESTER" -> last name before the comma, the given names after it.
    const [last, given] = p.studentName && p.studentName.includes(',') ? p.studentName.split(',').map((x) => x.trim()) : [p.studentId, 'Student'];
    const hash = await bcrypt.hash(password, 10);
    const courseIds = await matchCourses(db, p.subjects);

    await inTransaction(db, async (conn) => {
      const [taken] = await conn.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER(?)', [p.studentId]);
      if (taken.length) throw httpError(409, 'This student ID is already registered. Sign in instead.');
      const [u] = await conn.query("INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES (?, ?, 'student', ?, ?)", [p.studentId, hash, given, last]);
      await conn.query(
        `INSERT INTO student_profiles (user_id, student_id, student_name, program, year_level, section, school_year, term, cor_image_path, verification_status, verification_note, verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [u.insertId, p.studentId, p.studentName || p.studentId, p.program || 'Unknown', p.yearLevel, p.section, p.schoolYear, p.term,
         status === 'verified' ? null : `cor/${scan.file}`, status, notes.join('; ') || null, status === 'verified' ? new Date() : null]
      );
      for (let i = 0; i < p.subjects.length; i++) {
        const s = p.subjects[i];
        await conn.query('INSERT INTO student_enrollments (user_id, subject_code, subject_title, section, school_year, term, course_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [u.insertId, s.code, s.title, s.section, p.schoolYear, p.term, courseIds[i]]);
      }
    });

    if (status === 'verified') await removeFile(scan.file); // the extracted fields are enough; the photo is not kept
    req.session.corScan = null;
    res.json({ status, message: status === 'verified' ? 'Your account is ready. Sign in with your student ID and password.' : 'Your account was created and is waiting for an administrator to verify your COR.' });
  } catch (err) { sendError(res, err); }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'student') throw httpError(403, 'Students only');
    const db = req.app.locals.db;
    const [[profile]] = await db.query('SELECT student_id, student_name, program, year_level, section, school_year, term, verification_status FROM student_profiles WHERE user_id = ?', [req.session.user.id]);
    const [subjects] = await db.query('SELECT subject_code, subject_title, section FROM student_enrollments WHERE user_id = ? ORDER BY enrollment_id', [req.session.user.id]);
    res.json({ profile: profile || null, subjects });
  } catch (err) { sendError(res, err); }
});

router.get('/pending', requireAdmin, async (req, res) => {
  try {
    const [rows] = await req.app.locals.db.query(
      "SELECT user_id, student_id, student_name, program, year_level, section, school_year, term, verification_note, created_at FROM student_profiles WHERE verification_status = 'pending' ORDER BY created_at");
    res.json(rows);
  } catch (err) { sendError(res, err); }
});

router.get('/:id/cor', requireAdmin, async (req, res) => {
  try {
    const [[row]] = await req.app.locals.db.query('SELECT cor_image_path FROM student_profiles WHERE user_id = ?', [Number(req.params.id)]);
    if (!row || !row.cor_image_path) throw httpError(404, 'No COR on file');
    res.sendFile(path.join(COR_DIR, path.basename(row.cor_image_path)));
  } catch (err) { sendError(res, err); }
});

router.post('/:id/verify', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = Number(req.params.id);
    const { decision, note } = req.body;
    if (!['approve', 'reject'].includes(decision)) throw httpError(400, 'decision must be approve or reject');
    const [[row]] = await db.query("SELECT cor_image_path FROM student_profiles WHERE user_id = ? AND verification_status = 'pending'", [id]);
    if (!row) throw httpError(404, 'No pending registration for that student');
    await db.query(
      'UPDATE student_profiles SET verification_status = ?, verification_note = ?, verified_at = NOW(), verified_by = ?, cor_image_path = NULL WHERE user_id = ?',
      [decision === 'approve' ? 'verified' : 'rejected', typeof note === 'string' ? note.slice(0, 500) : null, req.session.user.id, id]
    );
    await removeFile(row.cor_image_path);
    res.json({ message: decision === 'approve' ? 'Student verified' : 'Registration rejected' });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
