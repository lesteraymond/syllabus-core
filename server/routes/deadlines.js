const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendError } = require('../lib/http');
const deadlines = require('../lib/deadlines');
const router = express.Router();

// Submission deadlines for subjects. Administrators set, change and cancel them and see who has submitted; a faculty member reads only
// the deadlines of the subjects assigned to them. Nothing here changes who may submit (late submissions stay allowed): a deadline only
// tracks whether and when each assigned faculty member submitted. All answers carry enabled: false until `npm run migrate-deadlines`
// has created the tables, so the rest of the app is unaffected before then.
//   GET    /api/deadlines                       administrator: every active deadline with its numbers
//   POST   /api/deadlines/course/:courseId      administrator: set a deadline for a subject and term
//   PUT    /api/deadlines/:id                   administrator: change it
//   DELETE /api/deadlines/:id                   administrator: cancel it
//   GET    /api/deadlines/:id/progress          administrator: each assigned faculty member's status
//   POST   /api/deadlines/:id/remind            administrator: remind faculty who have not submitted ({ userIds } limits it to some)
//   GET    /api/deadlines/mine                  the signed-in faculty member's own deadlines and statuses
// Setting, changing and cancelling a deadline also tells the assigned faculty who have not submitted (the bell and an email), after the save:
// see lib/deadlineNotices.js. A failure there never undoes the save.

const positive = (raw) => { const n = Number(raw); return Number.isInteger(n) && n > 0 ? n : null; };
const notFound = (what) => Object.assign(new Error(what + ' not found'), { status: 404 });
const notifier = (req) => req.app.locals.deadlineNotices || null;
const answer = (res, work) => work().then((body) => res.json({ enabled: true, ...body }))
  .catch((err) => (err && err.code === 'ER_NO_SUCH_TABLE' ? res.json({ enabled: false }) : sendError(res, err)));

router.get('/', requireAdmin, (req, res) => answer(res, async () => ({ deadlines: await deadlines.listForAdmin(req.app.locals.db) })));

router.get('/mine', requireAuth, (req, res) => answer(res, async () => ({
  deadlines: req.session.user.role === 'faculty' ? await deadlines.mine(req.app.locals.db, req.session.user.id) : [],
})));

router.post('/course/:courseId', requireAdmin, (req, res) => answer(res, async () => {
  const courseId = positive(req.params.courseId);
  if (!courseId) throw notFound('Subject');
  const { deadline } = await deadlines.createDeadline(req.app.locals.db, req.session.user.id, courseId, req.body);
  return { deadline, notices: notifier(req) ? await notifier(req).onCreated(deadline) : null };
}));

router.put('/:id', requireAdmin, (req, res) => answer(res, async () => {
  const id = positive(req.params.id);
  if (!id) throw notFound('Deadline');
  const { deadline, previous } = await deadlines.updateDeadline(req.app.locals.db, id, req.body);
  return { deadline, notices: notifier(req) ? await notifier(req).onUpdated(previous, deadline) : null };
}));

router.delete('/:id', requireAdmin, (req, res) => answer(res, async () => {
  const id = positive(req.params.id);
  if (!id) throw notFound('Deadline');
  const { deadline } = await deadlines.cancelDeadline(req.app.locals.db, id);
  return { message: 'Deadline cancelled', notices: notifier(req) ? await notifier(req).onCancelled(deadline) : null };
}));

router.get('/:id/progress', requireAdmin, (req, res) => answer(res, async () => {
  const id = positive(req.params.id);
  if (!id) throw notFound('Deadline');
  return deadlines.progress(req.app.locals.db, id);
}));

router.post('/:id/remind', requireAdmin, (req, res) => answer(res, async () => {
  const id = positive(req.params.id);
  if (!id) throw notFound('Deadline');
  const userIds = req.body && Array.isArray(req.body.userIds) ? req.body.userIds.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200) : [];
  if (!notifier(req)) return { sent: 0, emailed: 0, skipped: [] };
  return notifier(req).remind(id, userIds, req.session.user.id);
}));

module.exports = router;
