const { readStandards, updateStandards, standardsFromMasters } = require('../lib/subjectStandards');
const { loadMasters } = require('../lib/programMasters');
const { loadOutcomes } = require('../lib/institution');
const { cleanProgram, parseTypedOutcomes, insertOutcomes } = require('../lib/programCreate');
const { recordNewProgram } = require('../lib/programPoReferences');
const { approvedOfCourse, subjectRefused } = require('../lib/approvedRecords');
// Course catalog: course code, title, program and the course learning outcomes (CLOs).
// Everyone signed in reads; only admins write. Faculty cannot change a course's CLOs: syllabus content
// always takes them from here (see routes/syllabusContent.js).
const express = require('express');
const { isReviewer } = require('../lib/roles');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { inTransaction, httpError, sendError } = require('../lib/http');
const { LEVELS, cloKey, parseCloKey, loadCourse, loadClos } = require('../lib/courses');
const { isStale, STALE_MESSAGE } = require('../lib/programEgas');
const { createProgram, requireOwnOutcomes, inheritStandards, findProgram } = require('../lib/programs');
const { catalogGaps } = require('../lib/catalogReady');
const { takenBySubject } = require('../lib/subjectLock');
const { queryInSameYear, catalogYear, programYearClause, assertSubjectEditable } = require('../lib/academicYear');
const { TERM_COLUMNS, termOf, hasTerm, withColumnFallbacks, parseTerm, saveTerm } = require('../lib/subjectTerm');
const { COLUMN: CURRICULUM_YEAR_COLUMN, parseCurriculumYear, curriculumYearOf, saveCurriculumYear } = require('../lib/curriculumYear');
const { curriculumNote, approvedCurricula } = require('../lib/curriculumNote');
const router = express.Router();

// With the catalog per academic year the administrator no longer picks a subject's academic year: it is the year of the catalog it is made in. Sent only when the rest of the
// term is sent (the term is all four fields or none).
const withYear = (body, label) => ((body && ['semester', 'yearLevel', 'prerequisite'].some((k) => body[k] !== undefined && body[k] !== null && body[k] !== '')) ? { ...body, academicYear: label } : body);

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
    // The catalog belongs to an academic year: the requested one (an administrator may ask for any, others only the current and the previous), the current one by default.
    // A new academic year therefore starts with no subjects. The year goes before the user id: the fakes of the tests read the user id last.
    const inYear = programYearClause(await catalogYear(req.app.locals.db, req.session.user, req.query.year));
    if (inYear.sql) { conds.push(inYear.sql.replace(/^ AND /, '')); params.push(...inYear.params); }
    // Faculty see only the courses an admin assigned to them; admins see every course.
    if (!isReviewer(req.session.user)) { conds.push('c.course_id IN (SELECT course_id FROM faculty_courses WHERE user_id = ?)'); params.push(req.session.user.id); }
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    const select = (term, curriculum) => `SELECT c.course_id, c.code, c.title, c.program_id, p.code AS program_code, COUNT(k.clo_id) AS clo_count, c.standards_json${term ? ', ' + TERM_COLUMNS : ''}${curriculum ? ', ' + CURRICULUM_YEAR_COLUMN : ''}
       FROM courses c JOIN programs p ON p.program_id = c.program_id LEFT JOIN course_clos k ON k.course_id = c.course_id
       ${where} GROUP BY c.course_id, c.code, c.title, c.program_id, p.code ORDER BY c.code`;
    const [rows] = await withColumnFallbacks(req.app.locals.db, [select(true, true), select(true, false), select(false, false)], params);
    // term: the administrator-set academic year, semester, year level and pre-requisite (empty values for a subject that has none yet);
    // curriculumYear: the curriculum the subject belongs to (lib/curriculumYear.js), null when not set
    const list = rows.map((r) => ({ id: r.course_id, code: r.code, title: r.title, program: r.program_code, cloCount: Number(r.clo_count), term: termOf(r), curriculumYear: curriculumYearOf(r) }));

    // For an admin, say what is still missing before faculty can use each subject (the vision, mission, the program's
    // EGAs and POs, the subject's CLOs). Faculty do not get this: their list is unchanged.
    if (req.session.user.role === 'admin') {
      const db = req.app.locals.db;
      // warn (never block) where the approved curriculum lists a subject with a different pre-requisite or year level
      const curricula = list.some((c) => hasTerm(c.term)) ? await approvedCurricula(db) : [];
      rows.forEach((r, i) => {
        const note = curriculumNote({ programCode: r.program_code, code: r.code, term: list[i].term, curriculumYear: list[i].curriculumYear }, curricula);
        if (note) list[i].curriculumNote = note;
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
      const [held] = await queryInSameYear(req.app.locals.db, 'SELECT syllabus_id, course_id, user_id, status FROM syllabi WHERE course_id IN (?) AND syllabus_id <> ? AND user_id = ? AND archived_at IS NULL', [list.map((c) => c.id), except, req.session.user.id], except); // this academic year's syllabi only
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
    const { code, title, program, programName, outcomes } = req.body || {};
    const c = text(code, 50, 'Subject code');
    const t = text(title, 255, 'Subject title');
    const progCode = String(program || '').trim().toUpperCase();
    if (!progCode) throw httpError(400, 'Enter the program code');
    // The catalog is per academic year: a subject (and a program created with it) is always made in the CURRENT year, and its academic year is that year.
    const scope = await catalogYear(db, req.session.user);
    const term = await parseTerm(db, scope.scoped ? withYear(req.body, scope.label) : req.body); // academic year, semester, year level, pre-requisite: all four or none
    const curriculumYear = parseCurriculumYear(req.body); // optional and independent of the academic year (lib/curriculumYear.js)

    // The EGAs and Program Outcomes typed for a NEW program, checked before anything is written (the same rules as the program's own edit routes).
    const typed = parseTypedOutcomes(outcomes, progCode);

    // An existing program is used as it is (programName is ignored). A new one is created together with its first
    // subject in ONE transaction, so a failure leaves nothing behind.
    const made = await inTransaction(db, async (conn) => {
      const [progRows] = scope.scoped
        ? await conn.query('SELECT program_id FROM programs WHERE code = ? AND COALESCE(academic_year, ?) = ?', [progCode, scope.current, scope.label])
        : await conn.query('SELECT program_id FROM programs WHERE code = ?', [progCode]);
      let programId = progRows[0] && progRows[0].program_id;
      let programCreated = false;
      if (!programId) {
        const { name } = cleanProgram({ code: progCode, name: programName });
        programId = await createProgram(conn, scope.scoped ? { code: progCode, name, year: scope.label, current: scope.current } : { code: progCode, name });
        programCreated = true;
      }
      if (typed && !programCreated) throw httpError(400, "Outcomes can only be sent with a new program. Change an existing program's outcomes in its Outcomes dialog.");
      let masters;
      if (typed) {
        await insertOutcomes(conn, programId, typed);
        await recordNewProgram(conn, { program_id: programId, code: progCode }, typed, { actorId: req.session.user.id, academicYear: scope.scoped ? scope.label : null });
        const school = await loadOutcomes(conn);
        masters = { institution: { vision: school.vision, mission: school.mission }, egas: typed.egas, pos: typed.pos };
      } else masters = await loadMasters(conn, programId);   // the subject starts with a copy of what its program already has (blank when the program has nothing yet)
      const [dup] = await conn.query('SELECT 1 FROM courses WHERE code = ? AND program_id = ?', [c, programId]);
      if (dup.length) throw httpError(409, `${c} already exists`);
      const [r] = await conn.query('INSERT INTO courses (code, title, program_id, standards_json) VALUES (?, ?, ?, ?)', [c, t, programId, JSON.stringify(standardsFromMasters(masters))]);
      if (term) await saveTerm(conn, r.insertId, term);
      else if (scope.scoped) await conn.query('UPDATE courses SET academic_year = ? WHERE course_id = ?', [scope.label, r.insertId]);
      if (curriculumYear) await saveCurriculumYear(conn, r.insertId, curriculumYear); // in the same transaction: a missing column leaves no subject behind
      return { id: r.insertId, programCreated };
    });
    const created = await loadCourse(db, made.id);
    const note = term ? curriculumNote({ programCode: created.program.code, code: created.code, term: created.term, curriculumYear: created.curriculumYear }, await approvedCurricula(db)) : null;
    res.json({ ...created, programCreated: made.programCreated, ...(note ? { curriculumNote: note } : {}) });
  } catch (err) { sendError(res, err); }
});

// Code, title and (optionally) the term. The program is fixed: a CLO's PO tags are validated against it.
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = parseId(req.params.id);
    await assertSubjectEditable(db, id); // a past academic year's catalog is view only
    const { code, title } = req.body || {};
    const c = text(code, 50, 'Subject code');
    const t = text(title, 255, 'Subject title');
    const course = await loadCourse(db, id);
    if (!course) throw httpError(404, 'Subject not found');
    const [dup] = await db.query('SELECT 1 FROM courses WHERE code = ? AND course_id <> ? AND program_id = ?', [c, id, course.program.id]);
    if (dup.length) throw httpError(409, `${c} already exists`);
    const scope = await catalogYear(db, req.session.user);
    const term = await parseTerm(db, scope.scoped ? withYear(req.body, course.term.academicYear || scope.current) : req.body); // none sent: the subject's term is left as it is
    const curriculumYear = parseCurriculumYear(req.body); // undefined: left as it is; null: cleared
    await inTransaction(db, async (conn) => {
      await conn.query('UPDATE courses SET code = ?, title = ? WHERE course_id = ?', [c, t, id]);
      if (term) await saveTerm(conn, id, term);
      if (curriculumYear !== undefined) await saveCurriculumYear(conn, id, curriculumYear);
    });
    const updated = await loadCourse(db, id);
    const note = term || curriculumYear !== undefined ? curriculumNote({ programCode: updated.program.code, code: updated.code, term: updated.term, curriculumYear: updated.curriculumYear }, await approvedCurricula(db)) : null;
    res.json({ ...updated, ...(note ? { curriculumNote: note } : {}) });
  } catch (err) { sendError(res, err); }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = parseId(req.params.id);
    await assertSubjectEditable(db, id);
    if (!(await loadCourse(db, id))) throw httpError(404, 'Subject not found');
    await inTransaction(db, async (conn) => {
      // The syllabi first, then the subject: submitting and approving lock the syllabus row before they read its subject, so taking the locks in the same
      // order means a deletion and a submission or approval wait for each other instead of deadlocking (lib/subjectValidation.js).
      const approved = await approvedOfCourse(conn, id);
      const [locked] = await conn.query('SELECT course_id FROM courses WHERE course_id = ? FOR UPDATE', [id]);
      if (!locked.length) throw httpError(404, 'Subject not found');
      if (approved.length) throw subjectRefused(approved);
      await conn.query('DELETE FROM courses WHERE course_id = ?', [id]); // syllabi.course_id becomes NULL; saved versions keep their snapshot
    });
    res.json({ message: 'Subject deleted' });
  } catch (err) { sendError(res, err); }
});

// Replace a course's CLOs. Items that carry an existing id are updated in place (their tags in syllabi stay valid);
// items without one are new; existing CLOs that are left out are removed (tags that pointed at them then show as unresolved).
router.put('/:id/clos', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const id = parseId(req.params.id);
    await assertSubjectEditable(db, id);
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
      const [[locked]] = await conn.query('SELECT clos_version AS v, standards_json, program_id FROM courses WHERE course_id = ? FOR UPDATE', [id]);
      const current = await inheritStandards(conn, locked.program_id, readStandards(locked.standards_json));
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
    await assertSubjectEditable(db, id);
    const { section, value, version }=req.body||{};
    await inTransaction(db,async conn=>{
      const [[row]]=await conn.query('SELECT standards_json, program_id FROM courses WHERE course_id = ? FOR UPDATE',[id]);
      if (!row) throw httpError(404,'Subject not found');
      // A specialization's EGAs and POs come from the program it inherits from; only vision and mission are subject-level.
      if (section === 'egas' || section === 'pos') { await requireOwnOutcomes(conn, await findProgram(conn, row.program_id)); }
      if (section === 'pos') await require('../lib/programPoReferences').requireMutable(conn,row.program_id);
      const clos=await loadClos(conn,id);
      const next=updateStandards(readStandards(row.standards_json),section,value,version,clos);
      await conn.query('UPDATE courses SET standards_json = ? WHERE course_id = ?',[JSON.stringify(next),id]);
    });
    res.json(await loadCourse(db,id));
  } catch(err) { sendError(res,err); }
});
module.exports = router;
