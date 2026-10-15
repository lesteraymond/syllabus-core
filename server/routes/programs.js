// Programs, their expected graduate attributes (EGAs) and their program outcomes (POs).
// Everyone signed in reads; only admins write. `:id` is the numeric program id or the program code (e.g. BSIT).
//
// EGAs and POs belong to ONE program (other programs are never touched). They are edited separately and each save
// carries the version the screen loaded: a save from an out-of-date screen is refused with 409, so two admins never
// overwrite each other. Removing an EGA or PO that a CLO of the program's subjects still uses is refused too.
const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { inTransaction, httpError, sendError } = require('../lib/http');
const { findProgram, loadProgram } = require('../lib/programs');
const { loadProgramEgas, isStale, STALE_MESSAGE } = require('../lib/programEgas');
const { egasInUse, posInUse, inUseMessages, inUseError, subjectsOf } = require('../lib/catalogUse');
const management = require('../lib/programManagement');
const { processCleanup } = require('../lib/catalogFileCleanup');
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
    const mine = req.session.user.role !== 'admin';
    const [rows] = await req.app.locals.db.query(
      `SELECT p.program_id, p.code, p.name, COUNT(o.po_no) AS outcome_count
       FROM programs p LEFT JOIN program_outcomes o ON o.program_id = p.program_id
       ${mine ? 'WHERE p.program_id IN (SELECT program_id FROM faculty_programs WHERE user_id = ?)' : ''}
       GROUP BY p.program_id, p.code, p.name ORDER BY p.code`,
      mine ? [req.session.user.id] : []
    );
    res.json(rows.map((r) => ({ id: r.program_id, code: r.code, name: r.name, outcomeCount: Number(r.outcome_count) })));
  } catch (err) { sendError(res, err); }
});

// The program's own EGAs and POs, with the versions a save must send back and the subjects that share them.
// A program without outcomes returns pos: [] (the builder shows an empty state telling faculty an administrator adds them).
router.get('/:id/outcomes', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const program = await findProgram(db, req.params.id);
    res.json({ ...(await loadProgram(db, program)), subjects: await subjectsOf(db, program.program_id) });
  } catch (err) { sendError(res, err); }
});

const text = (v, max, what) => {
  if (typeof v !== 'string' || !v.trim()) throw httpError(400, `${what} is required`);
  if (v.length > max) throw httpError(400, `${what} is too long (max ${max} characters)`);
  return v.trim();
};

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
    const { egas, version } = req.body || {};
    if (!Array.isArray(egas) || !egas.length || egas.length > 20) throw httpError(400, 'Provide 1 to 20 EGAs');
    const seen = new Set();
    const list = egas.map((e, i) => {
      const no = Number(e && e.no);
      if (!Number.isInteger(no) || no < 1 || no > 99 || seen.has(no)) throw httpError(400, `EGA ${i + 1} needs a unique number from 1 to 99`);
      seen.add(no);
      return [program.program_id, no, text(e.name, 255, `EGA ${no} name`), text(e.short, 120, `EGA ${no} short name`)];
    });

    // An EGA that a CLO of this program's subjects or one of its POs still points at cannot be removed.
    const removed = (await loadProgramEgas(db, program.program_id)).map((e) => e.no).filter((n) => !seen.has(n));
    if (removed.length) {
      const blocked = inUseMessages('EGA', removed, await egasInUse(db, program.program_id));
      if (blocked.length) throw httpError(409, inUseError(blocked));
    }

    await inTransaction(db, async (conn) => {
      await lockAndCheck(conn, program.program_id, 'egas_version', version);
      await conn.query('DELETE FROM program_egas WHERE program_id = ?', [program.program_id]);
      await conn.query('INSERT INTO program_egas (program_id, ega_no, name, short_name) VALUES ?', [list]);
      await conn.query('UPDATE programs SET egas_version = egas_version + 1 WHERE program_id = ?', [program.program_id]);
    });
    const fresh = await findProgram(db, program.program_id);
    res.json({ ...(await loadProgram(db, fresh)), subjects: await subjectsOf(db, program.program_id) });
  } catch (err) { sendError(res, err); }
});

// Replace the program's outcomes. Body: { pos: [{ no, short, text, egas }], version }. A PO may map only to this program's EGAs.
router.put('/:id/outcomes', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const program = await findProgram(db, req.params.id);
    const { pos, version } = req.body || {};
    if (!Array.isArray(pos) || pos.length > 50) throw httpError(400, 'Provide a list of up to 50 program outcomes');
    const validEgas = new Set((await loadProgramEgas(db, program.program_id)).map((e) => e.no));
    const seen = new Set();
    const rows = pos.map((p, i) => {
      const no = Number(p && p.no);
      if (!Number.isInteger(no) || no < 1 || no > 99 || seen.has(no)) throw httpError(400, `Outcome ${i + 1} needs a unique number from 1 to 99`);
      seen.add(no);
      if (typeof p.short !== 'string' || !p.short.trim() || p.short.length > 120) throw httpError(400, `PO ${no} needs a short name (max 120 characters)`);
      if (typeof p.text !== 'string' || !p.text.trim() || p.text.length > 2000) throw httpError(400, `PO ${no} needs its statement (max 2000 characters)`);
      const egas = Array.isArray(p.egas) ? [...new Set(p.egas.map(Number))] : [];
      if (egas.some((e) => !validEgas.has(e))) throw httpError(400, `PO ${no} maps to an EGA that does not exist in ${program.code}`);
      return [program.program_id, no, p.short.trim(), p.text.trim(), egas.sort((a, b) => a - b).join(',')];
    });

    // A PO that a CLO of this program's subjects is still tagged with cannot be removed: tags point at it by number.
    const [current] = await db.query('SELECT po_no FROM program_outcomes WHERE program_id = ?', [program.program_id]);
    const removed = current.map((p) => p.po_no).filter((n) => !seen.has(n));
    if (removed.length) {
      const blocked = inUseMessages('PO', removed, await posInUse(db, program.program_id));
      if (blocked.length) throw httpError(409, inUseError(blocked));
    }

    await inTransaction(db, async (conn) => {
      await lockAndCheck(conn, program.program_id, 'pos_version', version);
      await conn.query('DELETE FROM program_outcomes WHERE program_id = ?', [program.program_id]);
      if (rows.length) await conn.query('INSERT INTO program_outcomes (program_id, po_no, short_name, outcome_text, ega_nos) VALUES ?', [rows]);
      await conn.query('UPDATE programs SET pos_version = pos_version + 1 WHERE program_id = ?', [program.program_id]);
    });
    const fresh = await findProgram(db, program.program_id);
    res.json({ ...(await loadProgram(db, fresh)), subjects: await subjectsOf(db, program.program_id) });
  } catch (err) { sendError(res, err); }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  try { res.json(await management.rename(req.app.locals.db, catalogId(req.params.id), req.session.user.id, req.body || {})); }
  catch (error) { managementError(res, error); }
});
router.get('/:id/deletion-preview', requireAdmin, async (req, res) => {
  try { res.json(await management.preview(req.app.locals.db, catalogId(req.params.id), req.session.user.id)); }
  catch (error) { managementError(res, error); }
});
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const result = await management.remove(req.app.locals.db, catalogId(req.params.id), req.session.user.id, req.body || {});
    const cleanup = await processCleanup(req.app.locals.db).catch(() => ({ pending: 1 }));
    res.json({ ...result, fileCleanupPending: cleanup.pending > 0 });
  } catch (error) { managementError(res, error); }
});
module.exports = router;
