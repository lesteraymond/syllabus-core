// What the Admin sees of a program's Program Outcome reference (lib/programPoReferences.js). A version is made by saving the outcomes (PUT /api/programs/:id/outcomes); there is no draft, approval or
// publication step, because what an authorized Admin saves is the reference. Admin only; mounted next to routes/programs.js under /api/programs.
//   GET  /:id/po-reference            the version in force, the version history, the change log, and whether the live rows are covered by a version
//   GET  /:id/po-reference/compare    ?from=&to=  what differs between 'active', 'live' or a version id of the same program code
//   GET  /:id/po-reference/candidates versions of the same program in other academic years that this one could use
//   POST /:id/po-reference/adopt      { referenceId, note? } uses such a version for this program year (no copy)
//   POST /:id/po-reference/record     records the saved rows of a program that predates versioning as its first version
const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendError } = require('../lib/http');
const { findProgram, requireOwnOutcomes } = require('../lib/programs');
const { assertCatalogEditable } = require('../lib/academicYear');
const refs = require('../lib/programPoReferences');
const router = express.Router();
async function target(req) {
  const db = req.app.locals.db, program = await findProgram(db, req.params.id);
  return { db, program, year: await refs.academicYearOf(db, program.program_id) };
}
router.get('/:id/po-reference', requireAuth, requireAdmin, async (req, res) => {
  try { const { db, program, year } = await target(req); res.json({ program: { id: program.program_id, code: program.code, academicYear: year }, ...(await refs.overview(db, program.program_id)) }); } catch (err) { sendError(res, err); }
});
router.post('/:id/po-reference/record', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { db, program, year } = await target(req);
    await assertCatalogEditable(db, program.program_id); // a past academic year's catalog is view only
    await requireOwnOutcomes(db, program);               // a program that inherits its outcomes uses its source program's version
    res.status(201).json(await refs.recordLive(db, program, { actorId: req.session.user.id, academicYear: year }));
  } catch (err) { sendError(res, err); }
});
router.get('/:id/po-reference/compare', requireAuth, requireAdmin, async (req, res) => {
  try { const { db, program } = await target(req); res.json(await refs.compare(db, program, String(req.query.from || 'active'), String(req.query.to || 'live'))); } catch (err) { sendError(res, err); }
});
router.get('/:id/po-reference/candidates', requireAuth, requireAdmin, async (req, res) => {
  try { const { db, program } = await target(req); res.json({ candidates: await refs.candidates(db, program) }); } catch (err) { sendError(res, err); }
});
router.post('/:id/po-reference/adopt', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { db, program } = await target(req);
    await assertCatalogEditable(db, program.program_id);
    await requireOwnOutcomes(db, program); // a specialization uses its source program's outcomes and version
    const body = req.body || {};
    res.status(201).json(await refs.adopt(db, program, { actorId: req.session.user.id, referenceId: body.referenceId, note: body.note }));
  } catch (err) { sendError(res, err); }
});
module.exports = router;
