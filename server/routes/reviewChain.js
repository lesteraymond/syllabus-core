// The review chain: the dean (admin), the Asst. VPAA and the LIC Director each check and review a submitted syllabus and clear their own
// stage; once all three are cleared on its newest version the VPAA can approve it (routes/syllabi.js, PUT /:id). Mounted on /api/syllabi.
//   POST /:id/stage-clear   a reviewer clears their own stage on the newest version ({ note? }); the AI check must have been made first
//   GET  /:id/stages        who cleared which stage, and who approved it (what the printed form's sign-off block shows)
// A reviewer who finds a problem returns the syllabus for revision with the status route; that is not recorded here, and the new version
// the faculty member then submits starts the three checks again. Nothing here approves anything.
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { httpError, sendError, inTransaction } = require('../lib/http');
const { notifyRoles } = require('../lib/notify');
const rules = require('../lib/syllabusRules');
const roles = require('../lib/roles');
const compliance = require('../lib/compliance/service');
const reviewStages = require('../lib/reviewStages');
const router = express.Router();

const NOT_SET_UP = 'The review chain is not set up on this server yet. Ask an administrator to run the database update.';
const CHECK_FIRST = 'Check this syllabus in the AI Checker before you clear your review.';
const STAGE_NAME = { dean: 'dean', asst_vpaa: 'Asst. VPAA', lic_director: 'LIC Director' };

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw httpError(404, 'Syllabus not found');
  return id;
};

router.post('/:id/stage-clear', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    const id = parseId(req.params.id);
    const stage = roles.stageOf(me);
    if (!stage) throw httpError(403, 'Only the dean, the Asst. VPAA and the LIC Director clear a review stage');
    if (!(await reviewStages.isInstalled(db))) throw httpError(503, NOT_SET_UP);
    const note = String((req.body || {}).note || '').trim().slice(0, 1000);

    const outcome = await inTransaction(db, async (conn) => {
      const [rows] = await conn.query('SELECT syllabus_id, user_id, status, title, course_code, archived_at FROM syllabi WHERE syllabus_id = ? FOR UPDATE', [id]);
      const syl = rows[0];
      if (!syl || !rules.canView(me, syl)) throw httpError(404, 'Syllabus not found'); // never reveal it to non-participants
      if (rules.isOwner(me, syl)) throw httpError(409, 'You cannot clear a review stage on your own syllabus.');
      if (rules.isArchived(syl)) throw httpError(409, rules.ARCHIVED_MESSAGE);
      if (!['submitted', 'under_review'].includes(syl.status)) throw httpError(409, 'This syllabus is not waiting for review.');
      if (await compliance.isInstalled(db)) { // the AI check comes first, then the reviewers sign
        const state = (await compliance.adminCheckStates(conn, [id])).get(id);
        if (state && state.checkable && !state.checked) throw httpError(409, CHECK_FIRST);
      }
      const version = await compliance.latestVersion(conn, id);
      if (!version) throw httpError(409, 'This syllabus has no submitted version to review.');
      const before = (await reviewStages.stagesOf(conn, [id])).get(id);
      await reviewStages.clear(conn, { syllabusId: id, versionId: version.version_id, stage, reviewerId: me.id, note });
      await conn.query('INSERT INTO submission_logs (syllabus_id, user_id, action, notes) VALUES (?, ?, ?, ?)',
        [id, me.id, 'check', (`Cleared the ${STAGE_NAME[stage]} review` + (note ? ': ' + note : '')).slice(0, 500)]);
      if (syl.status === 'submitted') await conn.query("UPDATE syllabi SET status = 'under_review' WHERE syllabus_id = ?", [id]);
      const after = (await reviewStages.stagesOf(conn, [id])).get(id);
      return { syl, stages: after, status: syl.status === 'submitted' ? 'under_review' : syl.status, completedNow: !!(after.allCleared && !(before && before.allCleared)) };
    });

    // After the commit: a notification never affects the result. The VPAA hears about it when the third stage clears.
    if (outcome.completedNow) {
      await notifyRoles(db, ['vpaa'], {
        type: 'chain', syllabusId: id,
        title: `Ready for approval: ${outcome.syl.course_code || outcome.syl.title || 'a syllabus'}`,
        body: 'The dean, the Asst. VPAA and the LIC Director have cleared it.',
      });
    }
    res.json({ stages: outcome.stages, status: outcome.status });
  } catch (err) { sendError(res, err); }
});

router.get('/:id/stages', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    const id = parseId(req.params.id);
    const [rows] = await db.query('SELECT syllabus_id, user_id, status FROM syllabi WHERE syllabus_id = ?', [id]);
    const syl = rows[0];
    if (!syl || !rules.canView(me, syl)) throw httpError(404, 'Syllabus not found');
    if (!(await reviewStages.isInstalled(db))) return res.json({ enabled: false });
    const stages = (await reviewStages.stagesOf(db, [id])).get(id);
    res.json({ enabled: true, stages, approved: syl.status === 'approved' ? await reviewStages.approvalOf(db, id) : null });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
