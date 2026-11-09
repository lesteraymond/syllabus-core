'use strict';
const express = require('express');
const { assertActiveYear } = require('../lib/activeYearGate');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { httpError, sendError } = require('../lib/http');
const repo = require('../lib/syllabuscheck/repository');
const { readReport } = repo;
const { assertRecordReview } = require('../lib/programPoReferences');
const { canView, canEdit, isOwner, lockedMessage } = require('../lib/syllabusRules');
const { providerConfig, promptVersionOf } = require('../lib/syllabuscheck/gemini');
const refine = require('../lib/syllabuscheck/refine');
const { createVerificationToken, verifyVerificationToken, getValue, relatedContextHash } = refine;
const { createLimiter } = require('../lib/rateLimit');
const { aiGate } = require('../lib/syllabuscheck/policy');
const activity = require('../lib/activity');
const router = express.Router();
router.use(requireAuth);
const wrap = fn => async (req, res) => { try { await fn(req, res); } catch (error) { sendError(res, error); } };
const id = raw => { const value = Number(raw); if (!Number.isSafeInteger(value) || value <= 0) throw httpError(400, 'Invalid id'); return value; };
router.get('/status', wrap(async (req, res) => {
  const { provider, model, configured } = providerConfig();
  res.json({ provider: configured ? provider : null, selectedProvider: provider || null, model, configured, aiGate: aiGate(), mandatory: aiGate() === 'required' });
}));
// No production setup installs this capability. The offline integration harness
// can supply static replay data; neither request bodies nor stage flags can turn
// the preview on. It is read-only and never creates a run or decision.
router.post('/syllabi/:id/academic-v2-preview', wrap(async (req,res)=>{
  const replays=req.app.locals.academicV2OfflinePreviews;
  if(!(replays instanceof Map))throw httpError(404,'Policy V2 preview is inactive.');
  const syllabusId=id(req.params.id),replay=replays.get(syllabusId);
  if(!replay)throw httpError(404,'No isolated replay is installed for this syllabus.');
  const [rows]=await req.app.locals.db.query('SELECT * FROM syllabi WHERE syllabus_id = ?',[syllabusId]);
  const syllabus=rows[0];
  if(!syllabus||!canView(req.session.user,syllabus))throw httpError(404,'Syllabus not found');
  await assertActiveYear(req.app.locals.db,syllabus);
  let content;try{content=JSON.parse(syllabus.content);}catch{throw httpError(409,'No saved structured form is available.');}
  const v2=require('../lib/syllabuscheck/academicPolicyV2');
  const report=await require('../lib/compliance/service').checkHybrid(req.app.locals.db,content,{academicPolicy:v2.POLICY.id,offlineReplay:replay,syllabusId});
  res.json(report);
}));
router.get('/references', requireAdmin, wrap(async (req, res) => {
  const [rows] = await req.app.locals.db.query('SELECT reference_id AS id, program_code AS program, curriculum_year AS curriculumYear, status, source, courses_json FROM syllabus_check_curricula ORDER BY reference_id');
  res.json(rows.map(({ courses_json, ...row }) => ({ ...row, courses: JSON.parse(courses_json) })));
}));
function curriculumInput(body) {
  if (!body || !/^[A-Za-z0-9 -]{2,40}$/.test(body.program || '') || typeof body.curriculumYear !== 'string' || !body.curriculumYear.trim() || body.curriculumYear.length > 40 || typeof body.source !== 'string' || !body.source.trim() || body.source.length > 500 || !Array.isArray(body.courses) || !body.courses.length || body.courses.length > 500) throw httpError(400, 'Supply program, curriculumYear, official source and 1–500 curriculum courses.');
  const seen = new Set();
  for (const course of body.courses) {
    if (!course || ['code', 'title', 'prereq'].some(key => typeof course[key] !== 'string' || !course[key].trim() || course[key].length > 255) || ['lecture', 'lab', 'yearLevel'].some(key => course[key] === '' || course[key] === null || course[key] === undefined || !Number.isFinite(Number(course[key])) || Number(course[key]) < 0) || !Number.isInteger(Number(course.yearLevel)) || Number(course.yearLevel) < 1 || Number(course.yearLevel) > 8) throw httpError(400, 'Every course requires code, title, explicit prerequisite, lecture/lab credit units and yearLevel.');
    const code = course.code.trim().replace(/\s+/g, ' ').toUpperCase();
    if (seen.has(code)) throw httpError(400, 'Duplicate course code: ' + code);
    seen.add(code);
  }
  if (body.synthetic) throw httpError(400, 'Synthetic test fixtures cannot be installed as official references.');
  return { ...body, program: body.program.toUpperCase() };
}
router.post('/references', requireAdmin, wrap(async (req, res) => {
  const body = curriculumInput(req.body);
  const [row] = await req.app.locals.db.query('INSERT INTO syllabus_check_curricula (program_code, curriculum_year, source, courses_json, created_by) VALUES (?, ?, ?, ?, ?)', [body.program, body.curriculumYear, body.source, JSON.stringify(body.courses), req.session.user.id]);
  res.status(201).json({ id: row.insertId, status: 'draft' });
}));
router.post('/references/:id/approve', requireAdmin, wrap(async (req, res) => {
  if (req.body?.confirmedAgainstSource !== true) throw httpError(400, 'Confirm that all entries were verified against the official source.');
  const [result] = await req.app.locals.db.query("UPDATE syllabus_check_curricula SET status = 'approved' WHERE reference_id = ? AND status = 'draft'", [id(req.params.id)]);
  if (!result.affectedRows) throw httpError(409, 'Reference is missing or already immutable.');
  res.json({ status: 'approved' });
}));
router.post('/references/:id/retire', requireAdmin, wrap(async (req, res) => {
  const [result] = await req.app.locals.db.query("UPDATE syllabus_check_curricula SET status = 'retired' WHERE reference_id = ? AND status = 'approved'", [id(req.params.id)]);
  if (!result.affectedRows) throw httpError(409, 'Only an approved reference can be retired.');
  res.json({ status: 'retired' });
}));
async function visibleRun(req) {
  const runId = id(req.params.id);
  const [rows] = await req.app.locals.db.query('SELECT s.*, r.run_id FROM ai_check_runs r JOIN syllabi s ON s.syllabus_id = r.syllabus_id WHERE r.run_id = ?', [runId]);
  if (!rows[0] || !canView(req.session.user, rows[0])) throw httpError(404, 'Check not found');
  const report = await readReport(req.app.locals.db, runId);
  if (!report) throw httpError(404, 'Hybrid report not found');
  return { runId, syllabus: rows[0], report };
}
router.get('/runs/:id/decisions', wrap(async (req, res) => {
  const { runId } = await visibleRun(req);
  const [rows] = await req.app.locals.db.query('SELECT decision_id AS id, suggestion_id AS suggestionId, action, edited_text AS editedText, user_id AS userId, created_at AS createdAt FROM syllabus_check_decisions WHERE run_id = ? ORDER BY decision_id', [runId]);
  res.json(rows);
}));
router.post('/runs/:id/decisions', wrap(async (req, res) => {
  const { runId, syllabus, report } = await visibleRun(req);
  // Only the author acts on a recommendation, and only while the syllabus can still be edited (a decision records a change the author
  // could make). The administrator reads the recommendations and the author's decisions but cannot accept, edit or reject them.
  if (!isOwner(req.session.user, syllabus)) throw httpError(403, 'Only the author can accept, edit or reject a recommendation.');
  if (!canEdit(req.session.user, syllabus)) throw httpError(409, lockedMessage(syllabus));
  const body = req.body || {};
  if (!['accept', 'edit', 'reject', 'undo'].includes(body.action)) throw httpError(400, 'Choose Accept, Edit, Reject or Undo');
  // A new decision acts on what the report said about references the faculty still has to review. Reading the report and its past decisions stays open (GET above).
  await assertRecordReview(req.app.locals.db, syllabus.syllabus_id);
  const allSuggestions = [
    ...(report.hybrid?.suggestions || []),
    ...(report.hybrid?.academicV2?.academic?.suggestions || []),
    ...(report.hybrid?.academicV2?.suggestions || []),
    ...(report.academic?.suggestions || [])
  ];
  const suggestion = allSuggestions.find(s => s.id === body.suggestionId);
  if (!suggestion) throw httpError(400, 'Unknown draft suggestion');
  if (body.action === 'edit' && (typeof body.editedText !== 'string' || !body.editedText.trim() || body.editedText.length > 10000 || typeof suggestion.replacement !== 'string')) throw httpError(400, 'Provide a draft revision of 1–10000 characters.');

  let verification = null;
  const isPolicyV2 = !!(suggestion.policy || report.evaluationPolicy || report.hybrid?.academicV2);
  if (isPolicyV2 && (body.action === 'accept' || body.action === 'edit')) {
    const textToApply = body.action === 'edit' ? body.editedText : suggestion.replacement;
    let content = null;
    try { content = JSON.parse(syllabus.content); } catch { content = null; }
    if (content && suggestion.path) {
      const current = getValue(content, suggestion.path);
      if (current !== undefined && current !== suggestion.originalValue && current !== textToApply) {
        throw httpError(409, 'This field changed in the syllabus since the recommendation was checked. Run the check again.');
      }
    }
    const masters = await repo.mastersFor(req.app.locals.db, content, { syllabusId: syllabus.syllabus_id });
    const contextHash = relatedContextHash(content, masters, suggestion.path);
    verification = verifyVerificationToken(body.verificationToken, {
      runId,
      suggestionId: suggestion.id,
      syllabusId: syllabus.syllabus_id,
      path: suggestion.path,
      originalValue: suggestion.originalValue,
      replacement: textToApply,
      contextHash
    });
    if (!verification.valid && verification.reason === 'secret_not_configured') throw httpError(503, refine.SECRET_MESSAGE);
    if (!verification.valid) {
      if (verification.reason === 'expired') {
        throw httpError(409, 'Verification token has expired. Run Check & improve again.');
      }
      if (verification.reason === 'context_drift') {
        throw httpError(409, 'Related academic content changed since this recommendation was checked. Run Check & improve again.');
      }
      throw httpError(409, 'Policy V2 recommendations must be verified with Check & Improve before being accepted or applied.');
    }
    req.app.locals.consumedVerificationTokens = req.app.locals.consumedVerificationTokens || new Set();
    if (req.app.locals.consumedVerificationTokens.has(verification.sig)) {
      throw httpError(409, 'This verification token has already been applied. Run Check & improve again.');
    }
    // Synchronously reserve token before any async operation to prevent concurrent double-consumption race
    req.app.locals.consumedVerificationTokens.add(verification.sig);
  }

  // Append-only human decision. The author explicitly applies the returned draft using the builder.
  let saved;
  try {
    [saved] = await req.app.locals.db.query('INSERT INTO syllabus_check_decisions (run_id, suggestion_id, action, edited_text, user_id) VALUES (?, ?, ?, ?, ?)', [runId, suggestion.id, body.action, body.action === 'edit' ? body.editedText : null, req.session.user.id]);
  } catch (dbErr) {
    if (verification?.sig) {
      req.app.locals.consumedVerificationTokens.delete(verification.sig);
    }
    throw dbErr;
  }
  await activity.record(req.app.locals.db, { syllabusId: syllabus.syllabus_id, userId: req.session.user.id, action: 'recommend', notes: activity.decisionNote(body.action, suggestion.path) });
  res.status(201).json({ id: saved.insertId, action: body.action, draft: (body.action === 'reject' || body.action === 'undo') ? null : { path: suggestion.path, replacement: body.action === 'edit' ? body.editedText : suggestion.replacement } });
}));
// Check and improve one AI recommendation before the author applies it (lib/syllabuscheck/refine.js). It reads the saved draft, asks the AI
// only about the relationships the rewrite touches, and returns the text to use; nothing is saved or applied here. Each call spends AI
// requests, so it is author-only, rate limited, and one at a time.
const refineLimiter = createLimiter({ max: 12, windowMs: 10 * 60 * 1000 });
const refining = new WeakSet();
router.post('/runs/:id/suggestions/:suggestionId/refine', wrap(async (req, res) => {
  const me = req.session.user;
  const { runId, syllabus, report } = await visibleRun(req);
  if (!isOwner(me, syllabus)) throw httpError(403, 'Only the author can check and improve a recommendation.');
  if (!canEdit(me, syllabus)) throw httpError(409, lockedMessage(syllabus));
  await assertActiveYear(req.app.locals.db, syllabus); // an AI request: only for the active academic year (lib/activeYearGate.js)
  const allSuggestions = [
    ...((report.hybrid && report.hybrid.suggestions) || []),
    ...(report.hybrid?.academicV2?.academic?.suggestions || []),
    ...(report.hybrid?.academicV2?.suggestions || []),
    ...(report.academic?.suggestions || [])
  ];
  const suggestion = allSuggestions.find(s => s.id === req.params.suggestionId);
  if (!suggestion) throw httpError(400, 'Unknown draft suggestion');
  // Every refinement is an AI request: none while the administrator has turned AI checking off (lib/adminSettings.js)
  if (!(await require('../lib/adminSettings').policy(req.app.locals.db)).aiChecking) throw httpError(409, require('../lib/adminSettings').AI_OFF_REFUSAL, { code: 'ai_checking_off' });
  const { model, configured } = providerConfig();
  if (!configured) throw httpError(503, 'No active AI provider is configured.');
  if (!refine.signingSecret()) throw httpError(503, refine.SECRET_MESSAGE); // before any AI request is spent
  const promptVer = report.hybrid?.alignment?.promptVersion || '';
  const expectedVer = promptVersionOf(model);
  if (promptVer && promptVer !== expectedVer && !report.evaluationPolicy && !report.hybrid?.academicV2 && !suggestion.policy) {
    throw httpError(409, 'This check was made by an older checker version. Run the check again first.');
  }
  let content = null;
  try { content = JSON.parse(syllabus.content); } catch { content = null; }
  if (!content) throw httpError(409, 'There is no saved form to check.');
  if (refining.has(req.app)) throw httpError(409, 'Another recommendation is being checked. Try again in a moment.');
  const slot = refineLimiter.take(String(me.id));
  if (!slot.ok) { res.set('Retry-After', String(slot.retryAfterSec)); throw httpError(429, 'You are checking recommendations too often. Try again in ' + slot.retryAfterSec + ' seconds.'); }
  refining.add(req.app);
  try {
    const masters = await repo.mastersFor(req.app.locals.db, content, {syllabusId:syllabus.syllabus_id});
    const editedText = typeof req.body?.editedText === 'string' && req.body.editedText.trim() && req.body.editedText.length <= 10000
      ? req.body.editedText.trim()
      : null;
    const effectiveSuggestion = editedText && typeof suggestion.replacement === 'string'
      ? { ...suggestion, replacement: editedText, userEdited: editedText !== suggestion.replacement }
      : suggestion;
    const out = await refine.refineSuggestion({ content, masters, report, suggestion: effectiveSuggestion });
    if (out && out.status === 'verified') {
      const contextHash = relatedContextHash(content, masters, suggestion.path);
      out.verificationToken = createVerificationToken({
        runId,
        suggestionId: suggestion.id,
        syllabusId: syllabus.syllabus_id,
        path: suggestion.path,
        originalValue: suggestion.originalValue,
        replacement: out.text,
        contextHash
      });
    }
    res.json(out);
  } catch (error) {
    throw error.status ? error : httpError(502, 'The AI could not check this recommendation: ' + String(error.message || error).slice(0, 200));
  } finally { refining.delete(req.app); }
}));

// --- Coordinated Improvement Plan Routes ---
const coordinatedPlanEngine = require('../lib/syllabuscheck/coordinatedPlanEngine');
const contentRevision = require('../lib/contentRevision');
const compliance = require('../lib/compliance/service');
const { applyCatalog, MAX_CONTENT_BYTES } = require('./syllabusContent');
const subjectLock = require('../lib/subjectLock');
const assignments = require('../lib/assignments');
const accountActivity = require('../lib/accountActivity');
const { inTransaction } = require('../lib/http');

router.get('/runs/:id/improvement-plan', wrap(async (req, res) => {
  const { runId, syllabus, report } = await visibleRun(req);
  let plan = report.hybrid?.improvementPlan || null;
  if (!plan && coordinatedPlanEngine.enabled(process.env)) {
    try {
      let content = null;
      try { content = JSON.parse(syllabus.content); } catch { content = null; }
      if (content) {
        const masters = await repo.mastersFor(req.app.locals.db, content, { syllabusId: syllabus.syllabus_id });
        plan = coordinatedPlanEngine.buildPlan({
          content,
          masters,
          syllabusId: syllabus.syllabus_id,
          result: report,
          env: process.env,
        });
      }
    } catch {
      plan = null;
    }
  }
  res.json({ plan });
}));

router.post('/runs/:id/improvement-plan/apply', wrap(async (req, res) => {
  const me = req.session.user;
  const { runId, syllabus, report } = await visibleRun(req);

  // Author and editable state checks
  if (!isOwner(me, syllabus)) throw httpError(403, 'Only the author can apply an improvement plan.');
  if (!canEdit(me, syllabus)) throw httpError(409, lockedMessage(syllabus));
  if (syllabus.status === 'approved') throw httpError(409, 'Approved syllabi are immutable and cannot be modified.');

  await assertActiveYear(req.app.locals.db, syllabus);
  await assertRecordReview(req.app.locals.db, syllabus.syllabus_id);

  let plan = report.hybrid?.improvementPlan || null;
  if (!plan && coordinatedPlanEngine.enabled(process.env)) {
    let content = null;
    try { content = JSON.parse(syllabus.content); } catch { content = null; }
    if (content) {
      const masters = await repo.mastersFor(req.app.locals.db, content, { syllabusId: syllabus.syllabus_id });
      plan = coordinatedPlanEngine.buildPlan({
        content,
        masters,
        syllabusId: syllabus.syllabus_id,
        result: report,
        env: process.env,
      });
    }
  }

  if (!plan) throw httpError(404, 'No coordinated improvement plan is available for this check.');
  if (req.body?.planId && req.body.planId !== plan.planId) {
    throw httpError(400, 'The specified planId does not match this check run.');
  }

  const result = await inTransaction(req.app.locals.db, async (conn) => {
    const [rows] = await conn.query(
      'SELECT syllabus_id, user_id, status, title, course_code, content, course_id, archived_at, content_schema_version FROM syllabi WHERE syllabus_id = ? FOR UPDATE',
      [syllabus.syllabus_id]
    );
    const syl = rows[0];
    if (!syl || !canView(me, syl)) throw httpError(404, 'Syllabus not found');
    if (!isOwner(me, syl)) throw httpError(403, 'Only the author can edit syllabus content');
    if (!canEdit(me, syl)) throw httpError(409, lockedMessage(syl));
    if (syl.status === 'approved') throw httpError(409, 'Approved syllabi are immutable and cannot be modified.');

    await assignments.requireCourseAccess(conn, me, syl.course_id);

    let current = {};
    if (syl.content) { try { current = JSON.parse(syl.content); } catch { current = {}; } }

    const clientHash = req.body?.sourceHash;
    if (clientHash && clientHash !== plan.sourceHash) {
      throw httpError(409, 'The improvement plan source version does not match the client version. Run Check with AI again.', {
        code: 'stale_syllabus_version',
        clientHash,
        planHash: plan.sourceHash,
      });
    }

    const currentHash = compliance.hashOf(current);
    if (currentHash !== plan.sourceHash) {
      throw httpError(409, 'Syllabus content has changed since this improvement plan was generated. Run Check with AI again.', {
        code: 'stale_syllabus_version',
        currentHash,
        expectedHash: plan.sourceHash,
      });
    }

    const approvedIds = Array.isArray(req.body?.approvedChangeIds) && req.body.approvedChangeIds.length > 0
      ? req.body.approvedChangeIds
      : null;

    const candidateContent = coordinatedPlanEngine.applyChanges(current, plan.changes, approvedIds);

    if (candidateContent.meta && Number.isInteger(candidateContent.meta.courseId)) {
      await assignments.requireCourseAccess(conn, me, candidateContent.meta.courseId);
    }
    const course = await applyCatalog(conn, candidateContent, me, current);
    if (course && course.id !== syl.course_id) {
      await subjectLock.assertSubjectFree(conn, me, course.id, syl.syllabus_id);
    }

    const json = JSON.stringify(candidateContent);
    const maxBytes = MAX_CONTENT_BYTES || (512 * 1024);
    if (Buffer.byteLength(json, 'utf8') > maxBytes) {
      throw httpError(413, `This syllabus is too large to save (limit ${maxBytes / 1024} KB)`);
    }

    const title = candidateContent.meta && typeof candidateContent.meta.title === 'string' ? candidateContent.meta.title : syl.title;
    const code = candidateContent.meta && typeof candidateContent.meta.code === 'string' ? candidateContent.meta.code : syl.course_code;
    const version = syl.content_schema_version || 2;

    await conn.query(
      'UPDATE syllabi SET content = ?, content_schema_version = ?, content_updated_at = NOW(), title = ?, course_code = ?, course_id = ? WHERE syllabus_id = ?',
      [json, version, title, code, course ? course.id : null, syl.syllabus_id]
    );

    const toApply = Array.isArray(approvedIds)
      ? plan.changes.filter(c => approvedIds.includes(c.changeId) || approvedIds.includes(c.id))
      : plan.changes;

    for (const c of toApply) {
      const suggestionId = c.sourceSuggestionId || c.changeId;
      await conn.query(
        'INSERT INTO syllabus_check_decisions (run_id, suggestion_id, action, edited_text, user_id) VALUES (?, ?, ?, ?, ?)',
        [runId, suggestionId, 'accept', null, me.id]
      );
    }

    await activity.record(conn, {
      syllabusId: syl.syllabus_id,
      userId: me.id,
      action: 'recommend',
      notes: `Applied whole-syllabus improvement plan (${toApply.length} coordinated changes applied).`,
    });

    return {
      applied: true,
      planId: plan.planId,
      appliedCount: toApply.length,
      appliedChanges: toApply.map(c => c.changeId),
      revisions: contentRevision.revisionsOf(candidateContent),
      subject: accountActivity.subjectLine(code, title),
      status: syl.status,
    };
  });

  await accountActivity.recordEdit(req.app.locals.db, {
    userId: me.id,
    syllabusId: syllabus.syllabus_id,
    subject: result.subject,
    notes: result.status,
  });

  res.json({
    applied: true,
    planId: result.planId,
    appliedCount: result.appliedCount,
    appliedChanges: result.appliedChanges,
    revisions: result.revisions,
  });
}));


module.exports = router;
module.exports.curriculumInput = curriculumInput;
