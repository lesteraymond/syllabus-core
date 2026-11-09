// Programs, their expected graduate attributes (EGAs) and their program outcomes (POs).
// Everyone signed in reads; only admins write. `:id` is the numeric program id or the program code (e.g. BSIT).
//
// EGAs and POs belong to ONE program (other programs are never touched). They are edited separately and each save
// carries the version the screen loaded: a save from an out-of-date screen is refused with 409, so two admins never
// overwrite each other. Removing an EGA or PO that a CLO of the program's subjects still uses is refused too.
const express = require('express');
const { isReviewer } = require('../lib/roles');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { inTransaction, httpError, sendError } = require('../lib/http');
const { findProgram, loadResolvedProgram, requireOwnOutcomes, inheritedFrom, createProgram } = require('../lib/programs');
const { cleanProgram, parseTypedOutcomes, insertOutcomes } = require('../lib/programCreate');
const { loadProgramEgas, isStale, STALE_MESSAGE } = require('../lib/programEgas');
const { egasInUse, posInUse, inUseMessages, inUseError, subjectsOf } = require('../lib/catalogUse');
const management = require('../lib/programManagement');
const { parseEgas, parsePos } = require('../lib/programOutcomesInput');
const { syncSubjects } = require('../lib/programMasters');
const poReferences = require('../lib/programPoReferences');
const { processCleanup } = require('../lib/catalogFileCleanup');
const { catalogYear, programYearClause, assertCatalogEditable } = require('../lib/academicYear');
const router = express.Router();
const catalogId = raw => { const id = Number(raw); if (!Number.isInteger(id) || id <= 0) throw httpError(404, 'Program not found'); return id; };
const managementError = (res, error) => {
  if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT', 'ER_DUP_ENTRY', 'ER_ROW_IS_REFERENCED_2', 'ER_NO_REFERENCED_ROW_2'].includes(error.code)) return res.status(409).json({ error: 'The catalog changed. Reload and try again.', code: 'preview_required' });
  if (error.code === 'ER_NO_SUCH_TABLE') return res.status(503).json({ error: 'Program management is not set up. Ask an administrator to run the database migration.' });
  return sendError(res, error);
};

router.get('/', requireAuth, async (req, res) => {
  try {
    // Faculty see only the programs an admin assigned to them; admins see every program.
    const mine = !isReviewer(req.session.user); // reviewers (dean, Asst. VPAA, LIC Director, VPAA) read every program
    // The catalog belongs to an academic year (the requested one, the current one by default): a new academic year starts with no programs.
    const inYear = programYearClause(await catalogYear(req.app.locals.db, req.session.user, req.query.year));
    const conditions = [], values = [];
    if (inYear.sql) { conditions.push(inYear.sql.replace(/^ AND /, '')); values.push(...inYear.params); }
    if (mine) { conditions.push('p.program_id IN (SELECT program_id FROM faculty_programs WHERE user_id = ?)'); values.push(req.session.user.id); }
    const [rows] = await req.app.locals.db.query(
      `SELECT p.program_id, p.code, p.name, COUNT(o.po_no) AS outcome_count, (SELECT COUNT(*) FROM program_egas e WHERE e.program_id = p.program_id) AS ega_count
       FROM programs p LEFT JOIN program_outcomes o ON o.program_id = p.program_id
       ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
       GROUP BY p.program_id, p.code, p.name ORDER BY p.code`,
      values
    );
    const result=[];
    for(const row of rows){
      const source=await inheritedFrom(req.app.locals.db,{program_id:row.program_id});
      const shared=source?await loadResolvedProgram(req.app.locals.db,source):null;
      const count=shared?shared.pos.length:row.code==='BSIT-CYBERSECURITY'?0:Number(row.outcome_count);
      // egaCount and inheritedFrom tell the admin's screen which programs still need their EGAs and POs set up (a specialization is set up in the program it inherits from)
      result.push({id:row.program_id,code:row.code,name:row.name,outcomeCount:count,egaCount:shared?shared.egas.length:row.code==='BSIT-CYBERSECURITY'?0:Number(row.ega_count)||0,inheritedFrom:source?source.code:null});
    }
    res.json(result);
  } catch (err) { sendError(res, err); }
});

// The program's own EGAs and POs, with the versions a save must send back and the subjects that share them.
// A program without outcomes returns pos: [] (the builder shows an empty state telling faculty an administrator adds them).
router.get('/:id/outcomes', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const program = await findProgram(db, req.params.id);
    res.json(await programView(db, program));
  } catch (err) { sendError(res, err); }
});

// What the outcomes dialog shows. `referencesVersioned`: saving makes a new version here, so a program that already has a version stays editable.
async function programView(db, program) {
  return { ...(await loadResolvedProgram(db, program)), subjects: await subjectsOf(db, program.program_id), referencesVersioned: await poReferences.publicationReady(db) };
}

// Locks the program row, refuses a stale save, and returns the connection-side current versions.
async function lockAndCheck(conn, programId, column, sentVersion) {
  const [[row]] = await conn.query(`SELECT ${column} AS v FROM programs WHERE program_id = ? FOR UPDATE`, [programId]);
  if (isStale(sentVersion, row.v)) throw httpError(409, STALE_MESSAGE);
}

// Replace the program's EGA list. Body: { egas: [{ no, name, short }], version }.
router.put('/:id/egas', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const program = await findProgram(db, req.params.id);
    await assertCatalogEditable(db, program.program_id); // a past academic year's catalog is view only
    await requireOwnOutcomes(db, program);
    const { egas, version } = req.body || {};
    const parsed = parseEgas(egas);
    const seen = new Set(parsed.map((e) => e.no));
    const list = parsed.map((e) => [program.program_id, e.no, e.name, e.short]);

    // An EGA that a CLO of this program's subjects or one of its POs still points at cannot be removed.
    const removed = (await loadProgramEgas(db, program.program_id)).map((e) => e.no).filter((n) => !seen.has(n));
    if (removed.length) {
      const blocked = inUseMessages('EGA', removed, await egasInUse(db, program.program_id));
      if (blocked.length) throw httpError(409, inUseError(blocked));
    }

    const previous = poReferences.statementsOfEgas(await loadProgramEgas(db, program.program_id)), year = await poReferences.academicYearOf(db, program.program_id);
    await inTransaction(db, async (conn) => {
      await lockAndCheck(conn, program.program_id, 'egas_version', version);
      await conn.query('DELETE FROM program_egas WHERE program_id = ?', [program.program_id]);
      await conn.query('INSERT INTO program_egas (program_id, ega_no, name, short_name) VALUES ?', [list]);
      await conn.query('UPDATE programs SET egas_version = egas_version + 1 WHERE program_id = ?', [program.program_id]);
      // the program's own EGA list has no version table: the audit row keeps the statements before and after, with the program's EGA version numbers
      if (JSON.stringify(previous) !== JSON.stringify(poReferences.statementsOfEgas(parsed))) await poReferences.auditIfReady(conn, { programId: program.program_id, action: 'ega_saved', actorId: req.session.user.id, details: { previous: { version: 'EGA v' + program.egas_version, egas: previous }, next: { version: 'EGA v' + (Number(program.egas_version) + 1), egas: poReferences.statementsOfEgas(parsed) }, academicYear: year } });
    });
    const fresh = await findProgram(db, program.program_id);
    res.json(await programView(db, fresh));
  } catch (err) { sendError(res, err); }
});

// Replace the program's outcomes. Body: { pos: [{ no, short, text, egas }], version }. A PO may map only to this program's EGAs.
router.put('/:id/outcomes', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const program = await findProgram(db, req.params.id);
    await assertCatalogEditable(db, program.program_id); // a past academic year's catalog is view only
    await requireOwnOutcomes(db, program);
    await poReferences.requireMutable(db,program.program_id);
    const { pos, version } = req.body || {};
    if (!Array.isArray(pos) || pos.length > 50) throw httpError(400, 'Provide a list of up to 50 program outcomes');
    const validEgas = new Set((await loadProgramEgas(db, program.program_id)).map((e) => e.no));
    const parsed = parsePos(pos, validEgas, program.code);
    const seen = new Set(parsed.map((p) => p.no));
    const rows = parsed.map((p) => [program.program_id, p.no, p.short, p.text, p.egas.join(',')]);

    // A PO that a CLO of this program's subjects is still tagged with cannot be removed: tags point at it by number.
    const [current] = await db.query('SELECT po_no FROM program_outcomes WHERE program_id = ?', [program.program_id]);
    const removed = current.map((p) => p.po_no).filter((n) => !seen.has(n));
    if (removed.length) {
      const blocked = inUseMessages('PO', removed, await posInUse(db, program.program_id));
      if (blocked.length) throw httpError(409, inUseError(blocked));
    }

    const year = await poReferences.academicYearOf(db, program.program_id);
    await inTransaction(db, async (conn) => {
      await lockAndCheck(conn, program.program_id, 'pos_version', version);
      await conn.query('DELETE FROM program_outcomes WHERE program_id = ?', [program.program_id]);
      if (rows.length) await conn.query('INSERT INTO program_outcomes (program_id, po_no, short_name, outcome_text, ega_nos) VALUES ?', [rows]);
      await conn.query('UPDATE programs SET pos_version = pos_version + 1 WHERE program_id = ?', [program.program_id]);
      await poReferences.saveVersion(conn, program, parsed, { actorId: req.session.user.id, academicYear: year }); // what the Admin saved is the version in force for this program year
    });
    const fresh = await findProgram(db, program.program_id);
    res.json(await programView(db, fresh));
  } catch (err) { sendError(res, err); }
});

// Add a program on its own (the Add program button): its code and name, and optionally its EGAs and Program Outcomes, in ONE transaction so a failure leaves nothing behind.
// It is always made in the CURRENT academic year. The school's vision and mission are one school-wide record (PUT /api/institution/outcomes); subjects added to this
// program later start with a copy of it, of these EGAs and of these POs. Body: { code, name, outcomes?: { egas, pos } }.
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { outcomes } = req.body || {};
    const { code, name } = cleanProgram({ code: (req.body || {}).code, name: (req.body || {}).name });
    const scope = await catalogYear(db, req.session.user);
    const typed = parseTypedOutcomes(outcomes, code);
    const made = await inTransaction(db, async (conn) => {
      const [same] = scope.scoped
        ? await conn.query('SELECT program_id FROM programs WHERE code = ? AND COALESCE(academic_year, ?) = ?', [code, scope.current, scope.label])
        : await conn.query('SELECT program_id FROM programs WHERE code = ?', [code]);
      if (same.length) throw httpError(409, `${code} already exists. Add subjects to it, or choose another code.`);
      const id = await createProgram(conn, scope.scoped ? { code, name, year: scope.label, current: scope.current } : { code, name });
      if (typed) { await insertOutcomes(conn, id, typed); await poReferences.recordNewProgram(conn, { program_id: id, code }, typed, { actorId: req.session.user.id, academicYear: scope.scoped ? scope.label : null }); }
      return id;
    });
    res.status(201).json({ id: made, code, name, egaCount: typed ? typed.egas.length : 0, outcomeCount: typed ? typed.pos.length : 0 });
  } catch (err) { sendError(res, err); }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const id = catalogId(req.params.id);
    await assertCatalogEditable(req.app.locals.db, id); // a past academic year's catalog is view only
    res.json(await management.rename(req.app.locals.db, id, req.session.user.id, req.body || {}));
  }
  catch (error) { managementError(res, error); }
});
// Copy this program's EGAs and POs, and the school's vision and mission, into its existing subjects. Subjects keep their own copy otherwise (a program's later edit never
// changes them by itself), so this is the administrator's explicit action. A subject a CLO still depends on is skipped and listed, never forced. Current academic year only.
router.post('/:id/sync-subjects', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const program = await findProgram(db, req.params.id);
    await assertCatalogEditable(db, program.program_id);
    await requireOwnOutcomes(db, program);
    const result = await inTransaction(db, (conn) => syncSubjects(conn, program.program_id));
    if (!result.masters) throw httpError(409, 'Set up the EGAs and Program Outcomes of ' + program.code + ' first.');
    res.json(result);
  } catch (err) { sendError(res, err); }
});

router.get('/:id/deletion-preview', requireAdmin, async (req, res) => {
  try { res.json(await management.preview(req.app.locals.db, catalogId(req.params.id), req.session.user.id)); }
  catch (error) { managementError(res, error); }
});
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const id = catalogId(req.params.id);
    await assertCatalogEditable(req.app.locals.db, id);
    const result = await management.remove(req.app.locals.db, id, req.session.user.id, req.body || {});
    const cleanup = await processCleanup(req.app.locals.db).catch(() => ({ pending: 1 }));
    res.json({ ...result, fileCleanupPending: cleanup.pending > 0 });
  } catch (error) { managementError(res, error); }
});
module.exports = router;
