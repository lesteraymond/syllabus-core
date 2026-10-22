const { blankStandards, readStandards, updateStandards } = require('../lib/subjectStandards');
// Course catalog: course code, title, program and the course learning outcomes (CLOs).
// Everyone signed in reads; only admins write. Faculty cannot change a course's CLOs: syllabus content
// always takes them from here (see routes/syllabusContent.js).
const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { inTransaction, httpError, sendError } = require('../lib/http');
const { LEVELS, cloKey, parseCloKey, loadCourse, loadClos } = require('../lib/courses');
const { isStale, STALE_MESSAGE } = require('../lib/programEgas');
const { createProgram, PROGRAM_CODE } = require('../lib/programs');
const { catalogGaps } = require('../lib/catalogReady');
const { takenBySubject } = require('../lib/subjectLock');
const router = express.Router();

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw httpError(404, 'Subject not found');
  return id;
};

const text = (v, max, what, { required = true } = {}) => {
  if (typeof v !== 'string' || (required && !v.trim())) throw httpError(400, `${what} is required`);
  if (v.length > max) throw httpError(400, `${what} is too long (max ${max} characters)`);
  return v.trim();
};

// List, optionally for one program (?program=BSIT).
router.get('/', requireAuth, async (req, res) => {
  try {
    const params = [];
    const conds = [];
    if (req.query.program) { conds.push('p.code = ?'); params.push(String(req.query.program).toUpperCase()); }
    // Faculty see only the courses an admin assigned to them; admins see every course.
    if (req.session.user.role !== 'admin') { conds.push('c.course_id IN (SELECT course_id FROM faculty_courses WHERE user_id = ?)'); params.push(req.session.user.id); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const [rows] = await req.app.locals.db.query(
      `SELECT c.course_id, c.code, c.title, c.program_id, p.code AS program_code, COUNT(k.clo_id) AS clo_count, c.standards_json
       FROM courses c JOIN programs p ON p.program_id = c.program_id LEFT JOIN course_clos k ON k.course_id = c.course_id
       ${where} GROUP BY c.course_id, c.code, c.title, c.program_id, p.code ORDER BY c.code`, params);
    const list = rows.map((r) => ({ id: r.course_id, code: r.code, title: r.title, program: r.program_code, cloCount: Number(r.clo_count) }));

    // For an admin, say what is still missing before faculty can use each subject (the vision, mission, the program's
    // EGAs and POs, the subject's CLOs). Faculty do not get this: their list is unchanged.
    if (req.session.user.role === 'admin') {
      const db = req.app.locals.db;
      rows.forEach((r, i) => {
        const standards = readStandards(r.standards_json);
        list[i].gaps = catalogGaps({
          vision: standards.vision, mission: standards.mission,
          egaCount: standards.egas.length,
          poCount: standards.pos.length, cloCount: list[i].cloCount,
          programCode: r.program_code, subjectCode: r.code,
        });
      });
    }
    // The builder asks (?taken=1) which subjects this person already has a syllabus on, so it can grey them out instead of failing after the pick.
    // ?except= is the syllabus being edited: its own subject is not "taken" by itself.
    if (req.query.taken === '1' && list.length) {
      const except = Number(req.query.except) > 0 ? Number(req.query.except) : 0;
      const [held] = await req.app.locals.db.query('SELECT syllabus_id, course_id, user_id, status FROM syllabi WHERE course_id IN (?) AND syllabus_id <> ? AND user_id = ? AND archived_at IS NULL', [list.map((c) => c.id), except, req.session.user.id]);
      const taken = takenBySubject(held, req.session.user);
      list.forEach((c) => { if (taken.has(c.id)) c.taken = taken.get(c.id); });
    }
    res.json(list);
  } catch (err) { sendError(res, err); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const course = await loadCourse(req.app.locals.db, parseId(req.params.id));
    if (!course) throw httpError(404, 'Subject not found');
    res.json(course);
  } catch (err) { sendError(res, err); }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { code, title, program, programName } = req.body || {};
    const c = text(code, 50, 'Subject code');
    const t = text(title, 255, 'Subject title');
    const progCode = String(program || '').trim().toUpperCase();
    if (!progCode) throw httpError(400, 'Enter the program code');

    // An existing program is used as it is (programName is ignored). A new one is created together with its first
    // subject in ONE transaction, so a failure leaves nothing behind.
    const made = await inTransaction(db, async (conn) => {
      const [progRows] = await conn.query('SELECT program_id FROM programs WHERE code = ?', [progCode]);
      let programId = progRows[0] && progRows[0].program_id;
      let programCreated = false;
      if (!programId) {
        if (!PROGRAM_CODE.test(progCode)) throw httpError(400, 'A program code uses 2 to 20 letters, digits or hyphens, for example BSIT.');
        const name = typeof programName === 'string' ? programName.trim().replace(/\s+/g, ' ') : '';
        if (!name) throw httpError(400, "Enter the program's full name");
        if (name.length < 2 || !/[A-Za-z].*[A-Za-z]/.test(name)) throw httpError(400, "The program's name needs at least two letters");
        if (name.length > 255) throw httpError(400, 'The program name is too long (max 255 characters)');
        programId = await createProgram(conn, { code: progCode, name });
        programCreated = true;
      }
      const [dup] = await conn.query('SELECT 1 FROM courses WHERE code = ?', [c]);
      if (dup.length) throw httpError(409, `${c} already exists`);
      const [r] = await conn.query('INSERT INTO courses (code, title, program_id, standards_json) VALUES (?, ?, ?, ?)', [c, t, programId, JSON.stringify(blankStandards())]);
      return { id: r.insertId, programCreated };
    });
    res.json({ ...(await loadCourse(db, made.id)), programCreated: made.programCreated });
  } catch (err) { sendError(res, err); }
});

// Code and title only. The program is fixed: a CLO's PO tags are validated against it.
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = parseId(req.params.id);
    const { code, title } = req.body || {};
    const c = text(code, 50, 'Subject code');
    const t = text(title, 255, 'Subject title');
    if (!(await loadCourse(db, id))) throw httpError(404, 'Subject not found');
    const [dup] = await db.query('SELECT 1 FROM courses WHERE code = ? AND course_id <> ?', [c, id]);
    if (dup.length) throw httpError(409, `${c} already exists`);
    await db.query('UPDATE courses SET code = ?, title = ? WHERE course_id = ?', [c, t, id]);
    res.json(await loadCourse(db, id));
  } catch (err) { sendError(res, err); }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = parseId(req.params.id);
    if (!(await loadCourse(db, id))) throw httpError(404, 'Subject not found');
    await db.query('DELETE FROM courses WHERE course_id = ?', [id]); // syllabi.course_id becomes NULL; saved versions keep their snapshot
    res.json({ message: 'Subject deleted' });
  } catch (err) { sendError(res, err); }
});

// Replace a course's CLOs. Items that carry an existing id are updated in place (their tags in syllabi stay valid);
// items without one are new; existing CLOs that are left out are removed (tags that pointed at them then show as unresolved).
router.put('/:id/clos', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = parseId(req.params.id);
    const course = await loadCourse(db, id);
    if (!course) throw httpError(404, 'Subject not found');
    const { clos, version } = req.body || {};
    if (!Array.isArray(clos) || clos.length > 20) throw httpError(400, 'Provide a list of up to 20 CLOs');

    // A CLO is tagged only with its own program's EGAs and POs.
    const validEgas = new Set(course.standards.egas.map(e => e.no));
    const validPos = new Set(course.standards.pos.map(p => p.no));
    const mine = new Set(course.clos.map((c) => c.id));

    const items = clos.map((c, i) => {
      const n = `CLO ${i + 1}`;
      if (!c || typeof c !== 'object') throw httpError(400, `${n} is invalid`);
      if (c.id !== undefined && c.id !== null && (!mine.has(c.id))) throw httpError(400, `${n} does not belong to this subject`);
      if (!LEVELS.includes(c.level)) throw httpError(400, `${n} needs a level (${LEVELS.join(', ')})`);
      const egas = [...new Set((Array.isArray(c.egas) ? c.egas : []).map(Number))];
      const pos = [...new Set((Array.isArray(c.pos) ? c.pos : []).map(Number))];
      if (egas.some((e) => !validEgas.has(e))) throw httpError(400, `${n} has an EGA that does not exist in ${course.program.code}`);
      if (pos.some((p) => !validPos.has(p))) throw httpError(400, `${n} has a program outcome that does not exist in ${course.program.code}`);
      return { key: c.id || null, title: text(typeof c.title === 'string' ? c.title : '', 255, `${n} title`, { required: false }), level: c.level, statement: text(c.statement, 2000, `${n} statement`), egas: egas.sort((a, b) => a - b), pos: pos.sort((a, b) => a - b) };
    });
    const keys = items.map((i) => i.key).filter(Boolean);
    if (new Set(keys).size !== keys.length) throw httpError(400, 'A CLO appears twice');

    await inTransaction(db, async (conn) => {
      // Lock the subject and refuse a save from an out-of-date screen, so two admins never overwrite each other.
      const [[locked]] = await conn.query('SELECT clos_version AS v, standards_json FROM courses WHERE course_id = ? FOR UPDATE', [id]);
      const current = readStandards(locked.standards_json);
      if (items.some(item => item.egas.some(n => !current.egas.some(e => e.no === n)) || item.pos.some(n => !current.pos.some(p => p.no === n)))) throw httpError(409, 'The subject setup changed. Reload before saving its CLOs.');
      if (isStale(version, locked.v)) throw httpError(409, STALE_MESSAGE);
      await conn.query('UPDATE courses SET clos_version = clos_version + 1 WHERE course_id = ?', [id]);
      const keep = new Set(keys);
      for (const old of course.clos) {
        if (!keep.has(old.id)) await conn.query('DELETE FROM course_clos WHERE clo_id = ? AND course_id = ?', [parseCloKey(old.id), id]);
      }
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const vals = [i, it.title, it.level, it.statement, it.egas.join(','), it.pos.join(',')];
        if (it.key) await conn.query('UPDATE course_clos SET sort_order = ?, title = ?, clo_level = ?, statement = ?, ega_nos = ?, po_nos = ? WHERE clo_id = ? AND course_id = ?', [...vals, parseCloKey(it.key), id]);
        else await conn.query('INSERT INTO course_clos (sort_order, title, clo_level, statement, ega_nos, po_nos, course_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [...vals, id]);
      }
    });
    const fresh = await loadCourse(db, id);
    res.json({ ...course, clos: fresh.clos, version: fresh.version });
  } catch (err) { sendError(res, err); }
});

router.put('/:id/standards', requireAuth, requireAdmin, async (req,res) => {
  try {
    const id=parseId(req.params.id); const db=req.app.locals.db;
    const { section, value, version }=req.body||{};
    await inTransaction(db,async conn=>{
      const [[row]]=await conn.query('SELECT standards_json FROM courses WHERE course_id = ? FOR UPDATE',[id]);
      if (!row) throw httpError(404,'Subject not found');
      const clos=await loadClos(conn,id);
      const next=updateStandards(readStandards(row.standards_json),section,value,version,clos);
      await conn.query('UPDATE courses SET standards_json = ? WHERE course_id = ?',[JSON.stringify(next),id]);
    });
    res.json(await loadCourse(db,id));
  } catch(err) { sendError(res,err); }
});
module.exports = router;
