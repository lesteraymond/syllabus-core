'use strict';
// The academic years: an administrator adds them (also from the Add subject dropdown) and says which one is CURRENT. Everyone signed in reads the list, but only the
// years they may see: an administrator sees all of them, everyone else the current year and the previous one (lib/academicYear.js). A year that
// syllabi or subjects use must not disappear, so an administrator may delete only a year that nothing uses and that is not the current one (DELETE /:label).
const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { inTransaction, httpError, sendError } = require('../lib/http');
const { labelOf } = require('../lib/subjectTerm');
const { loadYears, visibleOf, catalogCounts, isAdmin } = require('../lib/academicYear');
const { copyCatalog } = require('../lib/catalogCopy');
const router = express.Router();

// For an administrator each year also says how many programs and subjects its catalog has (0 and 0: "not used yet"), so it is never a guess which years already have one.
const shape = (years, user, counts = null) => visibleOf(years, user).map((y) => ({ label: y.label, startYear: y.startYear, isCurrent: y.isCurrent, ...(counts ? { programs: (counts[y.label] || {}).programs || 0, subjects: (counts[y.label] || {}).subjects || 0 } : {}) }));
const withCounts = async (db, years, user) => shape(years, user, isAdmin(user) ? await catalogCounts(db) : null);

router.get('/', requireAuth, async (req, res) => {
  try { const db = req.app.locals.db; res.json(await withCounts(db, await loadYears(db), req.session.user)); } catch (err) { sendError(res, err); }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const startYear = Number((req.body || {}).startYear);
    if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) throw httpError(400, 'Enter the first year of the academic year, for example 2027.');
    const label = labelOf(startYear);
    try { await req.app.locals.db.query('INSERT INTO academic_years (label, start_year) VALUES (?, ?)', [label, startYear]); }
    catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw httpError(409, `${label} already exists`);
      if (error.code === 'ER_NO_SUCH_TABLE') throw httpError(503, 'Run npm run migrate-subject-term before adding academic years.');
      throw error;
    }
    res.json({ label, startYear });
  } catch (err) { sendError(res, err); }
});

// Make an existing year the current one. From then on new syllabi are stamped with it and every list starts on it.
router.put('/current', requireAuth, requireAdmin, async (req, res) => {
  try {
    const label = String((req.body || {}).label || '').trim();
    const db = req.app.locals.db;
    await inTransaction(db, async (conn) => {
      let rows;
      try { [rows] = await conn.query('SELECT label FROM academic_years WHERE label = ? FOR UPDATE', [label]); }
      catch (error) { if (error.code === 'ER_NO_SUCH_TABLE') throw httpError(503, 'Run npm run migrate-academic-year-scope first.'); throw error; }
      if (!rows.length) throw httpError(404, 'That academic year does not exist. Add it first.');
      try { await conn.query('UPDATE academic_years SET is_current = 0'); await conn.query('UPDATE academic_years SET is_current = 1 WHERE label = ?', [label]); }
      catch (error) { if (error.code === 'ER_BAD_FIELD_ERROR') throw httpError(503, 'Run npm run migrate-academic-year-scope first.'); throw error; }
    });
    res.json(await withCounts(db, await loadYears(db), req.session.user));
  } catch (err) { sendError(res, err); }
});

// Delete an academic year, with caution. Refused (409, nothing changed) for the CURRENT year, and for a year that syllabi, programs or subjects still belong to: deleting those
// would orphan or lose real records, so an administrator removes or moves them first. Only an unused year (for example one added by mistake) can go.
async function usageOf(conn, label) {
  const count = async (table) => {
    try { const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM ${table} WHERE academic_year = ?`, [label]); return Number((rows[0] || {}).n) || 0; }
    catch (error) { if (error.code === 'ER_BAD_FIELD_ERROR' || error.code === 'ER_NO_SUCH_TABLE') return 0; throw error; } // that table is not per year yet
  };
  return { syllabi: await count('syllabi'), programs: await count('programs'), subjects: await count('courses') };
}
const usageText = (u) => [u.syllabi && `${u.syllabi} syllabus${u.syllabi === 1 ? '' : 'es'}`, u.programs && `${u.programs} program${u.programs === 1 ? '' : 's'}`, u.subjects && `${u.subjects} subject${u.subjects === 1 ? '' : 's'}`].filter(Boolean).join(', ');
router.delete('/:label', requireAuth, requireAdmin, async (req, res) => {
  try {
    const label = String(req.params.label || '').trim();
    const db = req.app.locals.db;
    await inTransaction(db, async (conn) => {
      let rows;
      try { [rows] = await conn.query('SELECT label, is_current FROM academic_years WHERE label = ? FOR UPDATE', [label]); }
      catch (error) { if (error.code === 'ER_BAD_FIELD_ERROR') [rows] = await conn.query('SELECT label FROM academic_years WHERE label = ? FOR UPDATE', [label]); else if (error.code === 'ER_NO_SUCH_TABLE') throw httpError(503, 'Run npm run migrate-subject-term first.'); else throw error; }
      if (!rows.length) throw httpError(404, 'That academic year does not exist.');
      if (Number(rows[0].is_current)) throw httpError(409, `${label} is the current academic year and cannot be deleted. Make another year current first.`, { code: 'year_is_current' });
      const usage = await usageOf(conn, label);
      if (usage.syllabi || usage.programs || usage.subjects) throw httpError(409, `${label} cannot be deleted: it still has ${usageText(usage)}. Only an academic year nothing belongs to can be deleted.`, { code: 'year_in_use', usage });
      await conn.query('DELETE FROM academic_years WHERE label = ?', [label]);
    });
    res.json(await withCounts(db, await loadYears(db), req.session.user));
  } catch (err) { sendError(res, err); }
});

// Fill the CURRENT academic year's empty catalog from an earlier year's (optional, never automatic; see lib/catalogCopy.js). Body: { from?: '2026–2027' } (default: the nearest
// earlier year that has a catalog). Refused when the current year already has programs.
router.post('/copy-catalog', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const result = await inTransaction(db, (conn) => copyCatalog(conn, { from: (req.body || {}).from, actor: req.session.user.id }));
    res.json({ ...result, years: await withCounts(db, await loadYears(db), req.session.user) });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
