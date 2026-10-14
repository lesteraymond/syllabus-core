// Compliance checks of a syllabus against the form standard. Mounted on /api (the paths below are complete).
//   GET  /api/syllabi/:id/compliance           the latest stored run of a syllabus (its owner, or an admin once it is submitted)
//   POST /api/syllabi/:id/compliance/recheck   run the rules now: the owner on the saved draft, an admin on the latest submitted
//                                              version (stored with that version, so it is the one reviewers see). Rate limited;
//                                              the same content as an earlier run returns that run, { force: true } makes a new one
//   GET  /api/compliance?syllabus=all|<id>     stored runs: an admin sees every submitted syllabus, faculty only their own, each with
//                                              the faculty member, program and subject so the list can be grouped
//   GET  /api/compliance/history               (admin) the latest check of each submitted syllabus, one item per syllabus, newest first;
//                                              ?from=&to= (ISO instants, from inclusive, to exclusive) keep the checks stored in that range
//   GET  /api/compliance/runs/:runId           (admin) one stored run in full, whatever the syllabus's status (approved ones too)
// An approved syllabus is final: it cannot be checked again, but its stored runs stay readable.
// Runs are stored by the submit route (with the version, authoritative) and by the recheck route. Nothing here changes a syllabus.
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { inTransaction, httpError, sendError } = require('../lib/http');
const { createLimiter } = require('../lib/rateLimit');
const rules = require('../lib/syllabusRules');
const svc = require('../lib/compliance/service');
const { catalogSnapshot } = require('./syllabusContent');
const { LABEL_SQL, labelsOf } = require('../lib/syllabusLabels');
const router = express.Router();

const NOT_SET_UP = 'Compliance checks are not set up on this server yet. Ask an administrator to run the database update.';
const APPROVED = 'This syllabus is approved, so it cannot be checked again.';
const NO_FORM_ADMIN = 'This syllabus was submitted as an uploaded file, so there is no builder form to check.';
const limiter = createLimiter({ max: 10, windowMs: 60 * 1000 });

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw httpError(404, 'Syllabus not found');
  return id;
};
const parseJson = (text) => { try { return text ? JSON.parse(text) : null; } catch { return null; } };
const HISTORY_DEFAULT = 50;
const HISTORY_MAX = 200;
const fullName = (u) => [u.firstName, u.lastName].filter(Boolean).join(' ');

// A syllabus the viewer may see: its owner always, an admin once it is no longer a draft. Anyone else gets a 404, so faculty
// cannot tell that another faculty member's syllabus exists, let alone read its runs.
async function loadVisible(db, me, id) {
  const [rows] = await db.query('SELECT * FROM syllabi WHERE syllabus_id = ?', [id]);
  const syl = rows[0];
  if (!syl || !rules.canView(me, syl)) throw httpError(404, 'Syllabus not found');
  return syl;
}

// What a check reads, and what a stored run is compared with to tell whether it is out of date: the owner's saved draft, or for an
// admin the latest submitted version (so a faculty member's edits in progress do not make a reviewed run look stale).
async function subjectOf(db, me, syl) {
  if (rules.isOwner(me, syl)) return { content: parseJson(syl.content), versionId: null, owner: true };
  const v = await svc.latestVersion(db, syl.syllabus_id);
  return { content: v ? parseJson(v.content) : null, versionId: v ? v.version_id : null, owner: false };
}

// Who made a run: its author, or an administrator checking it afterwards.
const withChecker = (run, ownerId) => ({ ...run, checkedBy: run.createdBy === null || run.createdBy === undefined ? null : run.createdBy === ownerId ? 'author' : 'admin' });

// The syllabus as a result screen names it: who wrote it, for which program and subject, its status, and whether it has a form to check.
async function baseOf(db, syl, subject) {
  const [[meta]] = await db.query('SELECT ' + LABEL_SQL + ' WHERE s.syllabus_id = ?', [syl.syllabus_id]);
  return {
    syllabusId: syl.syllabus_id, userId: syl.user_id, courseCode: syl.course_code, title: syl.title, status: syl.status, version: syl.version,
    ...labelsOf(meta || {}, subject.content), checkable: !!subject.content,
  };
}
// An optional ISO instant from the query string, as whole seconds for FROM_UNIXTIME. FROM_UNIXTIME answers in the database session's
// time zone, which is how a TIMESTAMP column is read, so a day boundary is right whatever zone the server runs in.
const instantOf = (raw, name) => {
  if (raw === undefined || raw === '') return null;
  const ms = Date.parse(String(raw));
  if (Number.isNaN(ms)) throw httpError(400, name + ' must be a valid date');
  return Math.floor(ms / 1000);
};
const adminOnly = (me) => { if (!me || me.role !== 'admin') throw httpError(403, 'Only an administrator can read the check history'); };

router.get('/syllabi/:id/compliance', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    const syl = await loadVisible(db, me, parseId(req.params.id));
    if (!(await svc.isInstalled(db))) return res.json({ installed: false, run: null });
    const run = await svc.latestRun(db, syl.syllabus_id, { versionOnly: !rules.isOwner(me, syl) });
    if (!run) return res.json({ installed: true, run: null });
    const { content } = await subjectOf(db, me, syl);
    res.json({ installed: true, run: withChecker(await svc.loadDetail(db, run, content ? svc.hashOf(content) : null), syl.user_id) });
  } catch (err) { sendError(res, err); }
});

router.post('/syllabi/:id/compliance/recheck', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    const syl = await loadVisible(db, me, parseId(req.params.id));
    const owner = rules.isOwner(me, syl);
    if (!owner && me.role !== 'admin') throw httpError(403, 'Only the owner or an administrator can check a syllabus');
    if (syl.status === 'approved') throw httpError(409, APPROVED, { code: 'approved' }); // before the limiter: a refusal costs nothing
    if (!(await svc.isInstalled(db))) throw httpError(503, NOT_SET_UP);
    const subject = await subjectOf(db, me, syl);
    if (!subject.content) {
      throw httpError(409, owner ? 'There is nothing to check yet. Save some of the form first.' : NO_FORM_ADMIN, { code: 'no_form' });
    }
    const content = subject.content;
    const hash = svc.hashOf(content);

    // The same content as an earlier run is not checked again, and does not count against the limit. An admin's check is stored with
    // the version, so only a run stored with a version can answer it.
    if (!(req.body && req.body.force === true)) {
      const cached = await svc.cachedRun(db, syl.syllabus_id, hash, { versionOnly: !owner });
      if (cached) return res.json({ installed: true, cached: true, run: withChecker(await svc.loadDetail(db, cached, hash), syl.user_id) });
    }
    const slot = limiter.take('recheck:' + me.id);
    if (!slot.ok) {
      res.set('Retry-After', String(slot.retryAfterSec));
      throw httpError(429, 'You are checking too often. Try again in ' + slot.retryAfterSec + ' seconds.');
    }

    // Checked against the catalog as it is now: tags resolve against the program's current EGAs and POs, and a submitted syllabus
    // is also compared with the catalog it was submitted with.
    const result = svc.check(content, { catalog: await catalogSnapshot(db, content), preparedBy: owner ? fullName(me) : undefined });
    const runId = await inTransaction(db, (conn) => svc.storeRun(conn, { syllabusId: syl.syllabus_id, versionId: subject.versionId, content, result, createdBy: me.id }));
    if (result.status === 'scored' && result.findings.length) {
      const [people] = await db.query('SELECT first_name, last_name FROM users WHERE user_id = ?', [syl.user_id]);
      const author = people[0] ? { firstName: people[0].first_name, lastName: people[0].last_name } : null;
      svc.startAiJob(db, { runId, content, result, names: svc.namesFor(author, content) });
    }
    const [rows] = await db.query('SELECT * FROM ai_check_runs WHERE run_id = ?', [runId]);
    res.json({ installed: true, cached: false, run: withChecker(await svc.loadDetail(db, rows[0], hash), syl.user_id) });
  } catch (err) { sendError(res, err); }
});

router.get('/compliance', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    const which = String(req.query.syllabus || 'all');
    if (which !== 'all' && !/^\d+$/.test(which)) throw httpError(400, 'syllabus must be "all" or a syllabus id');
    const installed = await svc.isInstalled(db);

    if (which !== 'all') {
      const syl = await loadVisible(db, me, parseId(which));
      const subject = await subjectOf(db, me, syl);
      const base = await baseOf(db, syl, subject);
      if (!installed) return res.json({ installed: false, syllabus: base, run: null });
      const run = await svc.latestRun(db, syl.syllabus_id, { versionOnly: !rules.isOwner(me, syl) });
      return res.json({ installed: true, syllabus: base, run: run ? withChecker(await svc.loadDetail(db, run, subject.content ? svc.hashOf(subject.content) : null), syl.user_id) : null });
    }

    const select = 'SELECT s.syllabus_id, s.user_id, s.course_code, s.title, s.status, s.version, ' + (me.role === 'admin' ? '' : 's.content, ') + LABEL_SQL;
    const [syls] = me.role === 'admin'
      ? await db.query(select + " WHERE s.status <> 'draft' ORDER BY u.last_name, u.first_name, s.syllabus_id DESC LIMIT 500")
      : await db.query(select + ' WHERE s.user_id = ? ORDER BY s.syllabus_id DESC LIMIT 500', [me.id]);

    // What each syllabus is checked on: an admin reads the latest submitted version, a faculty member their own saved form.
    const formOf = new Map();
    if (syls.length) {
      if (me.role === 'admin') {
        const [vs] = await db.query(
          'SELECT v.syllabus_id, v.content FROM syllabus_versions v JOIN (SELECT MAX(version_id) AS version_id FROM syllabus_versions WHERE syllabus_id IN (?) GROUP BY syllabus_id) m ON m.version_id = v.version_id',
          [syls.map((s) => s.syllabus_id)]
        );
        vs.forEach((v) => formOf.set(v.syllabus_id, parseJson(v.content)));
      } else {
        syls.forEach((s) => formOf.set(s.syllabus_id, parseJson(s.content)));
      }
    }

    const latest = new Map();
    let areasByRun = new Map();
    if (installed && syls.length) {
      const [runs] = await db.query(
        // An admin sees the run stored with each submitted version; a faculty member sees their own newest run, re-checks included.
        'SELECT r.* FROM ai_check_runs r JOIN (SELECT MAX(run_id) AS run_id FROM ai_check_runs WHERE syllabus_id IN (?)' + (me.role === 'admin' ? ' AND version_id IS NOT NULL' : '') + ' GROUP BY syllabus_id) m ON m.run_id = r.run_id',
        [syls.map((s) => s.syllabus_id)]
      );
      runs.forEach((r) => latest.set(r.syllabus_id, r));
      areasByRun = await svc.loadAreas(db, runs.map((r) => r.run_id));
    }
    const list = syls.map((s) => {
      const run = latest.get(s.syllabus_id);
      const content = formOf.get(s.syllabus_id) || null;
      return {
        syllabusId: s.syllabus_id, userId: s.user_id, courseCode: s.course_code, title: s.title, status: s.status, version: s.version,
        ...labelsOf(s, content), checkable: !!content,
        run: run ? withChecker(svc.summarize(run, areasByRun.get(run.run_id) || [], content ? svc.hashOf(content) : null), s.user_id) : null,
      };
    });

    // Averages over the syllabi that have a score (a run with "not enough content", or a file upload, has none).
    const scored = list.filter((x) => x.run && x.run.overall !== null);
    const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    res.json({
      installed,
      syllabi: list,
      summary: {
        count: list.length,
        scored: scored.length,
        unchecked: list.filter((x) => x.checkable && !x.run).length,
        uploaded: list.filter((x) => !x.checkable).length,
        average: avg(scored.map((x) => x.run.overall)),
        passed: scored.filter((x) => x.run.passed).length,
        areas: svc.standard.areas.map((a) => ({
          key: a.key, name: a.name, weight: a.weight,
          average: avg(scored.map((x) => (x.run.areas.find((y) => y.key === a.key) || {}).score).filter((v) => typeof v === 'number')),
        })),
      },
    });
  } catch (err) { sendError(res, err); }
});

// The history: one item per syllabus, its latest check stored with a submitted version (the one a reviewer sees), newest first. A
// subject is checked once and appears once; older runs of it are not listed. A draft check an owner ran afterwards is not part of it.
// Each item is a summary; the full run is read with /compliance/runs/:runId.
router.get('/compliance/history', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    adminOnly(req.session.user);
    const asked = Number(req.query.limit);
    const limit = Number.isInteger(asked) && asked > 0 ? Math.min(asked, HISTORY_MAX) : HISTORY_DEFAULT;
    const from = instantOf(req.query.from, 'from');
    const to = instantOf(req.query.to, 'to');
    if (from !== null && to !== null && from > to) throw httpError(400, 'from must not be after to');
    if (!(await svc.isInstalled(db))) return res.json({ installed: false, runs: [] });
    const [rows] = await db.query(
      'SELECT r.run_id, r.syllabus_id, r.overall, r.status, r.passed, r.ai_status, r.created_by, r.created_at, l.user_id, l.course_code, l.title, l.syllabus_status, l.first_name, l.last_name, l.course_title, l.program_code, l.program_name, l.curriculum_program '
      + 'FROM ai_check_runs r JOIN (SELECT s.syllabus_id, s.user_id, s.course_code, s.title, s.status AS syllabus_status, ' + LABEL_SQL + ") l ON l.syllabus_id = r.syllabus_id "
      + "WHERE r.version_id IS NOT NULL AND l.syllabus_status <> 'draft' "
      + 'AND r.run_id = (SELECT MAX(r2.run_id) FROM ai_check_runs r2 WHERE r2.syllabus_id = r.syllabus_id AND r2.version_id IS NOT NULL)'
      + (from !== null ? ' AND r.created_at >= FROM_UNIXTIME(?)' : '') + (to !== null ? ' AND r.created_at < FROM_UNIXTIME(?)' : '')
      + ' ORDER BY r.run_id DESC LIMIT ?',
      [...(from !== null ? [from] : []), ...(to !== null ? [to] : []), limit]
    );
    res.json({
      installed: true,
      runs: rows.map((r) => ({
        runId: r.run_id, syllabusId: r.syllabus_id, courseCode: r.course_code, status: r.syllabus_status,
        ...labelsOf(r, null),
        overall: r.overall === null || r.overall === undefined ? null : Number(r.overall), passed: !!r.passed, scored: r.status === 'scored',
        aiStatus: r.ai_status, checkedBy: r.created_by === null || r.created_by === undefined ? null : r.created_by === r.user_id ? 'author' : 'admin',
        createdAt: r.created_at || null,
      })),
    });
  } catch (err) { sendError(res, err); }
});

// One stored run in full, in the shape of GET /compliance?syllabus=<id> (plus isLatest: is it the check a reviewer sees now?).
// Read-only, and open for every non-draft syllabus whatever its status.
router.get('/compliance/runs/:runId', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    adminOnly(me);
    const runId = Number(req.params.runId);
    if (!Number.isInteger(runId) || runId <= 0) throw httpError(404, 'Check not found');
    if (!(await svc.isInstalled(db))) return res.json({ installed: false, syllabus: null, run: null, isLatest: false });
    const [found] = await db.query('SELECT * FROM ai_check_runs WHERE run_id = ?', [runId]);
    const stored = found[0];
    if (!stored || stored.version_id === null || stored.version_id === undefined) throw httpError(404, 'Check not found');
    const syl = await loadVisible(db, me, stored.syllabus_id);
    const subject = await subjectOf(db, me, syl);
    const latest = await svc.latestRun(db, syl.syllabus_id, { versionOnly: true });
    res.json({
      installed: true,
      syllabus: await baseOf(db, syl, subject),
      run: withChecker(await svc.loadDetail(db, stored, subject.content ? svc.hashOf(subject.content) : null), syl.user_id),
      isLatest: !!latest && latest.run_id === stored.run_id,
    });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
module.exports.limiter = limiter;
