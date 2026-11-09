// Compliance checks of a syllabus against the form standard. Mounted on /api (the paths below are complete).
//   GET  /api/syllabi/:id/compliance           the latest stored run of a syllabus (its owner: their own newest; an admin: the administrator's own check)
//   POST /api/syllabi/:id/compliance/recheck   run the rules now: the owner on the saved draft, an admin on the latest submitted
//                                              version (stored with that version, so it is the one reviewers see). Rate limited;
//                                              one evaluation at a time across all users of this server
//   GET  /api/compliance?syllabus=all|<id>     stored runs: an admin sees every submitted syllabus, faculty only their own, each with
//                                              the faculty member, program and subject so the list can be grouped
//   GET  /api/compliance/history               (admin) the latest check of each submitted syllabus, one item per syllabus, newest first;
//                                              ?from=&to= (ISO instants, from inclusive, to exclusive) keep the checks stored in that range
//   GET  /api/compliance/runs/:runId           (admin) one stored run in full, whatever the syllabus's status (approved ones too)
// An approved syllabus is final: it cannot be checked again, but its stored runs stay readable.
// What counts for an administrator is the administrator's own check (svc.ADMIN_RUN_SQL). The run a faculty member's submit stores gates the
// submit and is the faculty member's alone: it is never shown to an administrator, never counts as checked, and never answers an admin's Check.
// Runs are stored by the submit route (with the version, authoritative) and by the recheck route. Nothing here changes a syllabus.
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const activity = require('../lib/activity');
const { inTransaction, httpError, sendError } = require('../lib/http');
const { createLimiter } = require('../lib/rateLimit');
const { openRecordReviews } = require('../lib/programPoReferences');
const { assertActiveYear } = require('../lib/activeYearGate');
const reviewAiChoice = require('../lib/reviewAiChoice');
const reviewStages = require('../lib/reviewStages');
const adminSettings = require('../lib/adminSettings'); // the administrator's "AI compliance checking" switch
const { finalAreas } = require('../lib/compliance/finalAreas'); // each area after the AI check's deductions (the dashboard's AI Quality Snapshot)
const { isApprover } = require('../lib/roles');
const rules = require('../lib/syllabusRules');
const svc = require('../lib/compliance/service');
const { catalogSnapshot } = require('./syllabusContent');
const { LABEL_SQL, labelsOf } = require('../lib/syllabusLabels');
const { resolveYear, yearClause } = require('../lib/academicYear');
const router = express.Router();

const NOT_SET_UP = 'Compliance checks are not set up on this server yet. Ask an administrator to run the database update.';
const APPROVED = 'This syllabus is approved, so it cannot be checked again.';
const NO_SUBJECT_ADMIN = 'This syllabus has neither a form nor an uploaded file to check.';
const limiter = createLimiter({ max: 10, windowMs: 60 * 1000 });
// Syllabi whose check is running right now. A page that was left and opened again asks (GET .../compliance `checking`) so it can show the
// check as running and pick up the result, instead of looking idle while the server is still working.
const runningChecks = new Set();
// Shared by the builder and admin routes, not scoped to a user or syllabus.
// Acquisition is synchronous so two requests cannot both enter the evaluator.
const activeChecks = new WeakSet();

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw httpError(404, 'Syllabus not found');
  return id;
};
const parseJson = (text) => { try { return text ? JSON.parse(text) : null; } catch { return null; } };
// A stored run of a syllabus under record review, as a list shows it: its score stays, but it is history, not a current result.
const withRecordReview = (run, code) => (code ? { ...run, stale: true, recordReview: { code, savedReady: true } } : run);
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
  if (rules.isOwner(me, syl)) {
    let content = parseJson(syl.content);
    if (rules.isReviewer(me) && content) content = svc.publicationContent(content, await catalogSnapshot(db,content));
    return { content, file: null, versionId: null, owner: true };
  }
  const v = await svc.latestVersion(db, syl.syllabus_id);
  const content = v ? parseJson(v.content) : null;
  // A version with no form may be an uploaded file: an administrator's check then reads the file (its rules: lib/compliance/upload.js).
  const file = v && !content ? await svc.versionFile(db, v.version_id) : null;
  return { content, file, versionId: v ? v.version_id : null, owner: false };
}
// What a run is compared with to tell whether it is out of date: the form's hash, or the uploaded file's name and size.
const hashOfSubject = (subject) => {
  if (subject.content) return svc.hashOf(subject.content);
  if (subject.file) return svc.hashOf(svc.uploadFingerprint(subject.file, { size: svc.uploadCheck.fileSize(subject.file) }));
  return null;
};

// Who made a run: its author, or an administrator checking it afterwards.
const withChecker = (run, ownerId) => ({ ...run, checkedBy: run.createdBy === null || run.createdBy === undefined ? null : run.createdBy === ownerId ? 'author' : 'admin' });

// The syllabus as a result screen names it: who wrote it, for which program and subject, its status, and whether it has a form to check.
async function baseOf(db, syl, subject) {
  const [[meta]] = await db.query('SELECT ' + LABEL_SQL + ' WHERE s.syllabus_id = ?', [syl.syllabus_id]);
  return {
    syllabusId: syl.syllabus_id, userId: syl.user_id, courseCode: syl.course_code, title: syl.title, status: syl.status, version: syl.version,
    ...labelsOf(meta || {}, subject.content), checkable: !!(subject.content || subject.file),
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
// The label ("v1.1") of the version a run was made on, for the dialogs that show one run.
async function withVersionLabel(db, run) {
  if (!run || run.versionId === null || run.versionId === undefined) return run;
  const [rows] = await db.query('SELECT version_label FROM syllabus_versions WHERE version_id = ?', [run.versionId]);
  return { ...run, versionLabel: rows[0] ? rows[0].version_label : '' };
}
const adminOnly = (me) => { if (!rules.isReviewer(me)) throw httpError(403, 'Only a reviewer can read the check history'); };

router.get('/syllabi/:id/compliance', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    const syl = await loadVisible(db, me, parseId(req.params.id));
    if (!(await svc.isInstalled(db))) return res.json({ installed: false, run: null });
    const checking = runningChecks.has(syl.syllabus_id);
    const run = await svc.latestRun(db, syl.syllabus_id, { adminOnly: !rules.isOwner(me, syl) });
    if (!run) return res.json({ installed: true, run: null, checking });
    const subject = await subjectOf(db, me, syl);
    res.json({ installed: true, checking, run: await withVersionLabel(db, withChecker(await svc.loadDetail(db, run, hashOfSubject(subject)), syl.user_id)) });
  } catch (err) { sendError(res, err); }
});

router.post('/syllabi/:id/compliance/recheck', requireAuth, async (req, res) => {
  let releaseCheck, runningId, removeAbortListeners = () => {};
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    const syl = await loadVisible(db, me, parseId(req.params.id));
    const owner = rules.isOwner(me, syl);
    if (rules.isReviewer(me) && syl.status === 'draft') throw httpError(409,'Drafts stay in My Syllabi. Complete the form and send it to AI Checker first.');
    if (!owner && !rules.isReviewer(me)) throw httpError(403, 'Only the owner or a reviewer can check a syllabus');
    if (syl.status === 'approved') throw httpError(409, APPROVED, { code: 'approved' }); // before the limiter: a refusal costs nothing
    if (isApprover(me)) await reviewStages.assertReadyForApprover(db, syl); // the VPAA checks what has reached them, after the three stages
    if (!owner) await reviewStages.assertSentForReview(db, syl, me); // the dean's own syllabus: only once the dean has sent it for review
    if (!(await svc.isInstalled(db))) throw httpError(503, NOT_SET_UP);
    await assertActiveYear(db, syl); // before the limiter, the AI and the run: a syllabus of another academic year is never checked anew (lib/activeYearGate.js)
    const subject = await subjectOf(db, me, syl);
    // A form is checked by the owner (their draft) or the administrator (the submitted version). Only the administrator checks an uploaded file.
    const isUpload = !subject.content && !owner && !!subject.file;
    if (!subject.content && !isUpload) {
      throw httpError(409, owner ? 'There is nothing to check yet. Save some of the form first.' : NO_SUBJECT_ADMIN, { code: 'no_form' });
    }
    const scope = req.app;
    if (activeChecks.has(scope)) {
      throw httpError(409, 'An AI check is already running. Wait until it finishes before starting another.', { code: 'ai_check_in_progress' });
    }
    activeChecks.add(scope);
    runningId = syl.syllabus_id;
    runningChecks.add(runningId);
    releaseCheck = () => activeChecks.delete(scope);

    const facts = isUpload ? svc.uploadCheck.readFacts(subject.file) : null;
    const content = isUpload ? svc.uploadFingerprint(subject.file, facts) : subject.content; // what the run's hash is made from
    const hash = svc.hashOf(content);

    // Explicit checks re-verify mutable external links and current official references.
    const slot = limiter.take('recheck:' + me.id);
    if (!slot.ok) {
      res.set('Retry-After', String(slot.retryAfterSec));
      throw httpError(429, 'You are checking too often. Try again in ' + slot.retryAfterSec + ' seconds.');
    }

    // A form is checked against the catalog as it is now: tags resolve against the program's current EGAs and POs, and a submitted syllabus
    // is also compared with the catalog it was submitted with. An uploaded file is checked for the file and its course details.
    const details = isUpload ? await baseOf(db, syl, subject) : null;
    const checkController = new AbortController();
    const abortIfDisconnected = () => { if (!res.writableEnded) checkController.abort(new Error('The Re-Check client disconnected.')); };
    req.once('aborted', abortIfDisconnected);
    res.once('close', abortIfDisconnected);
    removeAbortListeners = () => { req.removeListener('aborted', abortIfDisconnected); res.removeListener('close', abortIfDisconnected); };
    if (req.aborted) abortIfDisconnected();
    const result = isUpload
      ? svc.uploadCheck.checkUpload(facts, { courseCode: syl.course_code, title: syl.title, programCode: details.programCode })
      // With "AI compliance checking" off in Settings the check runs the coded format rules only: no provider is asked, and the report says why.
      : await svc.checkHybrid(db, content, { syllabusId: syl.syllabus_id, signal: checkController.signal, ...((await adminSettings.policy(db)).aiChecking ? {} : { env: adminSettings.aiOffEnv() }) });
    // Again on the active year, locked, in the transaction that stores the run: if the Admin switched years while the check ran, nothing is stored.
    const runId = await inTransaction(db, async (conn) => { await assertActiveYear(conn, syl, { lock: true }); return svc.storeRun(conn, { syllabusId: syl.syllabus_id, versionId: subject.versionId, content, result, createdBy: me.id, ai: !isUpload }); });
    // The person who ran the check sees it in their Recent Activity (the same record that an administrator's check and an author's check share).
    await activity.record(db, { syllabusId: syl.syllabus_id, userId: me.id, action: 'check', notes: activity.checkNote(result) });
    if (isUpload) {
      // No AI step for a file; say what was not checked, so the administrator reads it against the template.
      await svc.attachRecommendations(db, runId, { items: [svc.uploadCheck.PENDING_NOTE], ai: { status: 'failed', reason: 'not_configured' } });
    } else if (!result.hybrid && result.status === 'scored' && result.findings.length) {
      const [people] = await db.query('SELECT first_name, last_name FROM users WHERE user_id = ?', [syl.user_id]);
      const author = people[0] ? { firstName: people[0].first_name, lastName: people[0].last_name } : null;
      const job = svc.startAiJob(db, { runId, content, result, names: svc.namesFor(author, content) });
      // Legacy reports can finish in the background. Keep their slot until the
      // provider settles even if the HTTP response has already been sent.
      const releaseJob = releaseCheck;
      Promise.resolve(job).then(releaseJob, releaseJob);
      releaseCheck = null;
    }
    const [rows] = await db.query('SELECT * FROM ai_check_runs WHERE run_id = ?', [runId]);
    res.json({ installed: true, cached: false, run: await withVersionLabel(db, withChecker(await svc.loadDetail(db, rows[0], hash), syl.user_id)) });
  } catch (err) { sendError(res, err); }
  finally { removeAbortListeners(); if (runningId !== undefined) runningChecks.delete(runningId); if (releaseCheck) releaseCheck(); }
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
      const run = await svc.latestRun(db, syl.syllabus_id, { adminOnly: !rules.isOwner(me, syl) });
      return res.json({ installed: true, syllabus: base, run: run ? withChecker(await svc.loadDetail(db, run, hashOfSubject(subject)), syl.user_id) : null });
    }

    const select = 'SELECT s.syllabus_id, s.user_id, s.course_code, s.title, s.status, s.version, ' + 's.content, ' + LABEL_SQL;
    // ?year= scopes the list (and so every number computed from it) to one academic year or, with all, to every year the person may see; no year means the current one
    const inYear = yearClause(await resolveYear(db, me, req.query.year));
    let [syls] = rules.isReviewer(me)
      ? await db.query(select + " WHERE s.status <> 'draft'" + inYear.sql + ' ORDER BY u.last_name, u.first_name, s.syllabus_id DESC LIMIT 500', inYear.params)
      : await db.query(select + ' WHERE s.user_id = ?' + inYear.sql + ' ORDER BY s.syllabus_id DESC LIMIT 500', [me.id, ...inYear.params]);

    // The VPAA's queue holds only what has reached the VPAA: the three stages cleared on the newest version, or approved (lib/reviewStages.js).
    if (isApprover(me) && syls.length) { const seen = await reviewStages.approverVisible(db, syls); syls = syls.filter((s) => seen.has(s.syllabus_id)); }
    // A syllabus the dean wrote is in another reviewer's queue only once the dean has sent it for review (lib/reviewStages.js)
    if (rules.isReviewer(me) && syls.length) { const notSent = await reviewStages.hiddenFromReviewers(db, syls, me.id); if (notSent.size) syls = syls.filter((s) => !notSent.has(s.syllabus_id)); }
    // What each syllabus is checked on: an admin reads the latest submitted version, a faculty member their own saved form.
    const formOf = new Map();
    const fileOf = new Set(); // syllabi whose newest version is an uploaded file (no form)
    const versionOf = new Map(); // syllabus id -> its newest version id
    if (syls.length) {
      if (rules.isReviewer(me)) {
        const [vs] = await db.query(
          'SELECT v.syllabus_id, v.version_id, v.content, v.file_path FROM syllabus_versions v JOIN (SELECT MAX(version_id) AS version_id FROM syllabus_versions WHERE syllabus_id IN (?) GROUP BY syllabus_id) m ON m.version_id = v.version_id',
          [syls.map((s) => s.syllabus_id)]
        );
        vs.forEach((v) => { formOf.set(v.syllabus_id, parseJson(v.content)); versionOf.set(v.syllabus_id, v.version_id); if (!v.content && v.file_path) fileOf.add(v.syllabus_id); });
      } else {
        syls.forEach((s) => formOf.set(s.syllabus_id, parseJson(s.content)));
      }
    }

    if (rules.isReviewer(me)) {
      for (const syl of syls.filter(s => s.user_id === me.id)) {
        const own=await subjectOf(db,me,syl);
        formOf.set(syl.syllabus_id,own.content);
        versionOf.delete(syl.syllabus_id);
      }
    }
    const latest = new Map();
    let areasByRun = new Map();
    let deductionsByRun = new Map(); // run id -> its AI deductions
    if (installed && syls.length) {
      const [runs] = await db.query(
        // An admin sees the administrator's own check of each submitted syllabus; a faculty member sees their own newest run, re-checks included.
        'SELECT r.* FROM ai_check_runs r JOIN (SELECT MAX(run_id) AS run_id FROM ai_check_runs WHERE syllabus_id IN (?)' + (rules.isReviewer(me) ? ' AND ' + svc.ADMIN_RUN_SQL : '') + ' GROUP BY syllabus_id) m ON m.run_id = r.run_id',
        [syls.map((s) => s.syllabus_id)]
      );
      runs.forEach((r) => latest.set(r.syllabus_id, r));
      areasByRun = await svc.loadAreas(db, runs.map((r) => r.run_id));
      // The AI deductions of these runs, from their stored reports (only that part of each report is read). Without them the areas after AI are the rules'.
      try {
        const [stored] = await db.query("SELECT run_id, JSON_EXTRACT(report_json, '$.hybrid.deductions') AS deductions FROM syllabus_check_reports WHERE run_id IN (?)", [runs.map((r) => r.run_id)]);
        stored.forEach((r) => { let d = r.deductions; if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = null; } } if (Array.isArray(d)) deductionsByRun.set(r.run_id, d); });
      } catch { deductionsByRun = new Map(); }
    }
    if (installed && rules.isReviewer(me)) {
      for (const syl of syls.filter(s=>s.user_id===me.id)) {
        const ownRun=await svc.latestRun(db,syl.syllabus_id);
        if(ownRun) latest.set(syl.syllabus_id,ownRun);
      }
    }
    const reviews = await openRecordReviews(db, syls.map((s) => s.syllabus_id));
    // This reviewer's own choices to review a version without an AI check: the picker says so (the check itself stays available)
    let withoutAi = new Set();
    if (rules.isReviewer(me) && syls.length && reviewAiChoice.allowed()) { try { withoutAi = await reviewAiChoice.choicesOf(db, syls.map((s) => s.syllabus_id), me.id); } catch { withoutAi = new Set(); } }
    // Each syllabus's academic year, so the picker can say when a new check is not available (display only: the recheck route enforces it).
    const yearsOf = new Map(); if (syls.length) { try { const [ys] = await db.query('SELECT syllabus_id, academic_year FROM syllabi WHERE syllabus_id IN (?)', [syls.map((s) => s.syllabus_id)]); ys.forEach((y) => yearsOf.set(y.syllabus_id, y.academic_year)); } catch { /* a database before the year scope */ } }
    const list = syls.map((s) => {
      let run = latest.get(s.syllabus_id);
      // The administrator's check counts for the version that was checked: after a new version is submitted the old check is history, not "checked".
      if (run && rules.isReviewer(me) && versionOf.has(s.syllabus_id) && run.version_id !== versionOf.get(s.syllabus_id)) run = null;
      const content = formOf.get(s.syllabus_id) || null;
      return {
        syllabusId: s.syllabus_id, userId: s.user_id, courseCode: s.course_code, title: s.title, status: s.status, version: s.version,
        ...labelsOf(s, content), checkable: !!content || fileOf.has(s.syllabus_id), upload: fileOf.has(s.syllabus_id), checking: runningChecks.has(s.syllabus_id),
        run: run ? { ...withRecordReview(withChecker(svc.summarize(run, areasByRun.get(run.run_id) || [], content ? svc.hashOf(content) : null), s.user_id), reviews.get(s.syllabus_id)),
          areasFinal: finalAreas(areasByRun.get(run.run_id) || [], deductionsByRun.get(run.run_id) || []) } : null, // each area after the AI deductions
        recordReview: reviews.get(s.syllabus_id) || null,
        academicYear: yearsOf.get(s.syllabus_id) || null,
        ...(versionOf.has(s.syllabus_id) && withoutAi.has(s.syllabus_id + ':' + versionOf.get(s.syllabus_id)) ? { reviewedWithoutAi: true } : {}),
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
        passed: scored.filter((x) => x.run.passed && !x.run.recordReview).length,
        areas: svc.standard.areas.map((a) => ({
          key: a.key, name: a.name, weight: a.weight,
          average: avg(scored.map((x) => (x.run.areas.find((y) => y.key === a.key) || {}).score).filter((v) => typeof v === 'number')),
          // the same area after the AI check's deductions: where the final score was lost (lib/compliance/finalAreas.js)
          final: avg(scored.map((x) => ((x.run.areasFinal || []).find((y) => y.key === a.key) || {}).score).filter((v) => typeof v === 'number')),
        })),
      },
    });
  } catch (err) { sendError(res, err); }
});

// Program compliance over time (the dashboard's "View analytics"): when each subject's syllabus was approved, for the academic year on screen. One row per subject:
// the first VPAA approval of its approved, non-archived syllabus (its 'approve' log; a syllabus approved before the log existed: when it was last changed).
// The dashboard turns these into each program's share of subjects approved, week by week. Reviewers only; the same year rules as the other lists.
router.get('/compliance/program-approvals', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const me = req.session.user;
    if (!rules.isReviewer(me)) throw httpError(403, 'Only a reviewer can read program compliance.');
    const inYear = yearClause(await resolveYear(db, me, req.query.year));
    const [rows] = await db.query(
      "SELECT s.course_id, MIN(UNIX_TIMESTAMP(l.action_date)) AS approved_at, MIN(UNIX_TIMESTAMP(s.updated_at)) AS changed_at FROM syllabi s LEFT JOIN submission_logs l ON l.syllabus_id = s.syllabus_id AND l.action = 'approve' "
      + "WHERE s.status = 'approved' AND s.archived_at IS NULL AND s.course_id IS NOT NULL" + inYear.sql + ' GROUP BY s.course_id', inYear.params);
    const at = (secs) => (secs === null || secs === undefined ? null : new Date(Number(secs) * 1000).toISOString());
    res.json({ approvals: rows.map((r) => ({ courseId: r.course_id, approvedAt: at(r.approved_at) || at(r.changed_at) })).filter((r) => r.approvedAt) });
  } catch (err) { sendError(res, err); }
});

// The history: one item per syllabus, the administrator's latest check of its submitted version, newest first. A subject is checked
// once and appears once; older runs of it are not listed. What the faculty member's own submit or drafts stored is not part of it.
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
    const inYear = yearClause(await resolveYear(db, req.session.user, req.query.year), '(SELECT s2.academic_year FROM syllabi s2 WHERE s2.syllabus_id = r.syllabus_id)');
    const [rows] = await db.query(
      'SELECT r.run_id, r.syllabus_id, r.version_id, (SELECT sv.version_label FROM syllabus_versions sv WHERE sv.version_id = r.version_id) AS version_label, r.overall, r.status, r.passed, r.ai_status, r.created_by, r.created_at, l.user_id, l.course_code, l.title, l.syllabus_status, l.first_name, l.last_name, l.course_title, l.program_code, l.program_name, l.curriculum_program '
      + 'FROM ai_check_runs r JOIN (SELECT s.syllabus_id, s.user_id, s.course_code, s.title, s.status AS syllabus_status, ' + LABEL_SQL + ") l ON l.syllabus_id = r.syllabus_id "
      // An approved syllabus has left the AI Checker for the Repository: it is not in the history (its runs stay stored and readable with /compliance/runs/:id).
      + "WHERE r.version_id IS NOT NULL AND r.created_by IS NOT NULL AND r.created_by <> l.user_id AND l.syllabus_status NOT IN ('draft', 'approved') "
      + 'AND r.run_id = (SELECT MAX(r2.run_id) FROM ai_check_runs r2 WHERE r2.syllabus_id = r.syllabus_id AND r2.version_id IS NOT NULL AND r2.created_by IS NOT NULL AND r2.created_by <> l.user_id)'
      + (from !== null ? ' AND r.created_at >= FROM_UNIXTIME(?)' : '') + (to !== null ? ' AND r.created_at < FROM_UNIXTIME(?)' : '') + inYear.sql
      + ' ORDER BY r.run_id DESC LIMIT ?',
      [...(from !== null ? [from] : []), ...(to !== null ? [to] : []), ...inYear.params, limit]
    );
    // The VPAA's history: only syllabi that have reached the VPAA (lib/reviewStages.js)
    const seen = isApprover(req.session.user) ? await reviewStages.approverVisible(db, rows.map((r) => ({ syllabus_id: r.syllabus_id, status: r.syllabus_status }))) : null;
    const notSent = await reviewStages.hiddenFromReviewers(db, rows.map((r) => ({ syllabus_id: r.syllabus_id, user_id: r.user_id, status: r.syllabus_status })), req.session.user.id); // the dean's own, not sent yet
    const shown = (seen ? rows.filter((r) => seen.has(r.syllabus_id)) : rows).filter((r) => !notSent.has(r.syllabus_id));
    const reviews = await openRecordReviews(db, shown.map((r) => r.syllabus_id));
    res.json({
      installed: true,
      runs: shown.map((r) => ({
        runId: r.run_id, syllabusId: r.syllabus_id, courseCode: r.course_code, status: r.syllabus_status, versionLabel: r.version_label || '',
        ...labelsOf(r, null),
        overall: r.overall === null || r.overall === undefined ? null : Number(r.overall), passed: !!r.passed, scored: r.status === 'scored',
        aiStatus: r.ai_status, checkedBy: r.created_by === null || r.created_by === undefined ? null : r.created_by === r.user_id ? 'author' : 'admin',
        createdAt: r.created_at || null, recordReview: reviews.get(r.syllabus_id) || null,
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
    if (!stored || stored.version_id === null || stored.version_id === undefined || stored.created_by === null || stored.created_by === undefined) throw httpError(404, 'Check not found');
    const syl = await loadVisible(db, me, stored.syllabus_id);
    if (stored.created_by === syl.user_id) throw httpError(404, 'Check not found'); // the faculty member's own run is not the administrator's to read
    const subject = await subjectOf(db, me, syl);
    const latest = await svc.latestRun(db, syl.syllabus_id, { adminOnly: true });
    res.json({
      installed: true,
      syllabus: await baseOf(db, syl, subject),
      run: await withVersionLabel(db, withChecker(await svc.loadDetail(db, stored, hashOfSubject(subject)), syl.user_id)),
      isLatest: !!latest && latest.run_id === stored.run_id,
    });
  } catch (err) { sendError(res, err); }
});

module.exports = router;
module.exports.limiter = limiter;
