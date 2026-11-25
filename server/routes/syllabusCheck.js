'use strict';
const express = require('express');
const { assertActiveYear } = require('../lib/activeYearGate');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { httpError, sendError } = require('../lib/http');
const repo = require('../lib/syllabuscheck/repository');
const { readReport } = repo;
const { assertRecordReview } = require('../lib/programPoReferences');
const { canView, canEdit, isOwner, lockedMessage } = require('../lib/syllabusRules');
const { providerConfig } = require('../lib/syllabuscheck/aiConfig');
const refine = require('../lib/syllabuscheck/refine');
const replanRefine = require('../lib/syllabuscheck/pipeline/refine'); // Check & improve for the re-planned checker's drafts
const replanPrompt = require('../lib/syllabuscheck/pipeline/prompt');
const { createVerificationToken, relatedContextHash } = refine;
const { createLimiter } = require('../lib/rateLimit'); const { aiQuota, MESSAGES: AI_LIMIT } = require('../lib/aiQuota'); // the daily ceilings on AI requests
const { aiGate } = require('../lib/syllabuscheck/policy');
const activity = require('../lib/activity');
const { canonical } = require('../lib/compliance/hash');
const router = express.Router();
router.use(requireAuth);
// Step 1 fields the administrator sets on the subject (lib/subjectTerm.js, applyCatalog)
const ADMIN_FIELD = /^meta\.(title|prereq|yearLevel)$/;
const ADMIN_FIELD_MESSAGE = 'The administrator sets this field on the subject, so it was not changed in the syllabus. Ask the administrator to correct the subject, then save the syllabus and check it again.';
const OLD_CHECKER_RETIRED = 'This check was made by the old AI Checker, which is no longer used. Run Check with AI again to get the new AI Checker\'s drafts.';
const wrap = fn => async (req, res) => { try { await fn(req, res); } catch (error) { sendError(res, error); } };
const id = raw => { const value = Number(raw); if (!Number.isSafeInteger(value) || value <= 0) throw httpError(400, 'Invalid id'); return value; };
router.get('/status', wrap(async (req, res) => {
  const { provider, model, configured } = providerConfig();
  res.json({ provider: configured ? provider : null, selectedProvider: provider || null, model, configured, aiGate: aiGate(), mandatory: aiGate() === 'required', generator: (() => { const g = generator.generateLimits(process.env); return g.ok ? { available: true } : { available: false, reason: g.reason }; })() });
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
  const [rows] = await req.app.locals.db.query('SELECT s.*, r.run_id, r.created_by AS run_created_by FROM ai_check_runs r JOIN syllabi s ON s.syllabus_id = r.syllabus_id WHERE r.run_id = ?', [runId]);
  const me = req.session.user;
  if (!rows[0] || !canView(me, rows[0])) throw httpError(404, 'Check not found');
  // An author's own check of their draft is theirs alone, as in routes/compliance.js GET /compliance/runs/:runId (E2E report 2026-11-23, BUG-011);
  // and a reviewer reaches a check only on a syllabus the lists show them (lib/reviewStages.js).
  const author = rows[0].user_id;
  if (author !== me.id && rows[0].run_created_by === author) throw httpError(404, 'Check not found');
  // Nobody reads another person's check (2026-11-24): faculty, dean, Asst. VPAA, LIC Director and VPAA each reach only the checks they ran.
  // A run stored before checks had an owner (created_by NULL) stays the author's.
  if (rows[0].run_created_by == null ? author !== me.id : rows[0].run_created_by !== me.id) throw httpError(404, 'Check not found');
  await require('../lib/reviewStages').assertReviewerMayOpen(req.app.locals.db, rows[0], me);
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
  // a draft of the old AI Checker is not recorded any more: the author runs the check again (the old checker was removed)
  if (!replanRefine.isReplanned(report)) throw httpError(409, OLD_CHECKER_RETIRED, { code: 'old_checker_retired' });
  const allSuggestions = report.hybrid?.suggestions || [];
  const suggestion = allSuggestions.find(s => s.id === body.suggestionId);
  if (!suggestion) throw httpError(400, 'Unknown draft suggestion');
  if (body.action === 'edit' && (typeof body.editedText !== 'string' || !body.editedText.trim() || body.editedText.length > 10000 || typeof suggestion.replacement !== 'string')) throw httpError(400, 'Provide a draft revision of 1–10000 characters.');

  // The author's save comes first, then this decision. A field the administrator sets on the subject is restored by every save (routes/syllabusContent.js), so it would be
  // recorded as applied while nothing changed: it is refused, and the author is told who can change it. (A new check does not offer such a change at all: engine.js.)
  if (['accept', 'edit'].includes(body.action) && ADMIN_FIELD.test(suggestion.path)) {
    const wanted = body.action === 'edit' ? body.editedText : suggestion.replacement;
    let stored; try { stored = suggestion.path.split('.').reduce((value, key) => value?.[key], JSON.parse(syllabus.content || '{}')); } catch { stored = undefined; }
    if (canonical(stored) !== canonical(wanted)) throw httpError(409, ADMIN_FIELD_MESSAGE, { code: 'admin_field' });
  }
  // Append-only human decision. The author explicitly applies the returned draft using the builder.
  const [saved] = await req.app.locals.db.query('INSERT INTO syllabus_check_decisions (run_id, suggestion_id, action, edited_text, user_id) VALUES (?, ?, ?, ?, ?)', [runId, suggestion.id, body.action, body.action === 'edit' ? body.editedText : null, req.session.user.id]);
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
  const allSuggestions = report.hybrid?.suggestions || [];
  const suggestion = allSuggestions.find(s => s.id === req.params.suggestionId);
  if (!suggestion) throw httpError(400, 'Unknown draft suggestion');
  // Every refinement is an AI request: none while the administrator has turned AI checking off (lib/adminSettings.js)
  if (!(await require('../lib/adminSettings').policy(req.app.locals.db)).aiChecking) throw httpError(409, require('../lib/adminSettings').AI_OFF_REFUSAL, { code: 'ai_checking_off' });
  const { configured } = providerConfig();
  if (!configured) throw httpError(503, 'No active AI provider is configured.');
  if (!refine.signingSecret()) throw httpError(503, refine.SECRET_MESSAGE); // before any AI request is spent
  // Only a draft of the new AI Checker is checked, by that checker (pipeline/refine.js) against its own prompt version. The old checker's Check & improve
  // (refine.js refineSuggestion) was removed with the old AI Checker: its drafts are refused.
  if (!replanRefine.isReplanned(report)) throw httpError(409, OLD_CHECKER_RETIRED, { code: 'old_checker_retired' });
  const limits = replanRefine.refineLimits(process.env);
  if (!limits.ok) throw httpError(409, 'This check was made by the new AI Checker, which is not active on this server now. Run the check again first.');
  if ((report.hybrid.alignment.promptVersion || '') !== replanPrompt.PROMPT_VERSION) throw httpError(409, 'This check was made by an older checker version. Run the check again first.');
  let content = null;
  try { content = JSON.parse(syllabus.content); } catch { content = null; }
  if (!content) throw httpError(409, 'There is no saved form to check.');
  if (refining.has(req.app)) throw httpError(409, 'Another recommendation is being checked. Try again in a moment.');
  const slot = refineLimiter.take(String(me.id));
  if (!slot.ok) { res.set('Retry-After', String(slot.retryAfterSec)); throw httpError(429, 'You are checking recommendations too often. Try again in ' + slot.retryAfterSec + ' seconds.'); }
  const quota = aiQuota().take('refine', me.id); if (!quota.ok) { res.set('Retry-After', String(quota.retryAfterSec)); throw httpError(429, AI_LIMIT[quota.reason], { code: 'ai_daily_limit', scope: quota.reason }); } // a paid request: counted for today (lib/aiQuota.js)
  refining.add(req.app);
  try {
    const masters = await repo.mastersFor(req.app.locals.db, content, {syllabusId:syllabus.syllabus_id});
    const editedText = typeof req.body?.editedText === 'string' && req.body.editedText.trim() && req.body.editedText.length <= 10000
      ? req.body.editedText.trim()
      : null;
    const effectiveSuggestion = editedText && typeof suggestion.replacement === 'string'
      ? { ...suggestion, replacement: editedText, userEdited: editedText !== suggestion.replacement }
      : suggestion;
    const out = await replanRefine.refineDraft({ content, masters, suggestion: effectiveSuggestion, env: process.env, db: req.app.locals.db });
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


// AI Syllabus Generator (lib/syllabuscheck/pipeline/generate.js): writes a first draft of the whole syllabus for the author's subject, checks it with the AI Checker's own rules
// and makes one repair plan. It takes several minutes, so it runs as a background job (pipeline/generateJobs.js): POST starts it and answers 202 at once, GET reads its progress and,
// when done, its result, DELETE removes a finished job once the screen has applied it. NOTHING is saved here: the sections come back and the screen puts them into the author's
// syllabus, where the author reviews, edits and saves them like any other change. Author-only, an active academic year, AI checking on, its own switch and cost cap, one generation at
// a time PER SYLLABUS (everyone else generates at the same time), and an optional per-person daily limit. Every generation is paid.
const generator = require('../lib/syllabuscheck/pipeline/generate');
const generateJobs = require('../lib/syllabuscheck/pipeline/generateJobs').createJobs();
// No daily limit per person unless SYLLABUS_CHECK_GENERATE_PER_USER_PER_DAY is set (owner decision 2026-11-18). When it is, it is counted from the jobs table, so a restart does not reset it.
// What still bounds the spend: the cost cap and the request cap of every run, one generation at a time per syllabus, and the administrator's AI switch.
const generatePerDay = () => { const n = Number.parseInt(process.env.SYLLABUS_CHECK_GENERATE_PER_USER_PER_DAY, 10); return Number.isInteger(n) && n >= 1 ? n : null; };
async function ownDraft(req) {
  const me = req.session.user, db = req.app.locals.db;
  const [rows] = await db.query('SELECT * FROM syllabi WHERE syllabus_id = ?', [id(req.params.id)]);
  const syllabus = rows[0];
  if (!syllabus || !canView(me, syllabus)) throw httpError(404, 'Syllabus not found');
  if (!isOwner(me, syllabus)) throw httpError(403, 'Only the author can generate a draft for this syllabus.');
  return { me, db, syllabus };
}
router.post('/syllabi/:id/generate', wrap(async (req, res) => {
  const { me, db, syllabus } = await ownDraft(req);
  if (!canEdit(me, syllabus)) throw httpError(409, lockedMessage(syllabus));
  await assertActiveYear(db, syllabus);
  if (!(await require('../lib/adminSettings').policy(db)).aiChecking) throw httpError(409, require('../lib/adminSettings').AI_OFF_REFUSAL, { code: 'ai_checking_off' });
  const limits = generator.generateLimits(process.env);
  if (!limits.ok) throw httpError(503, 'The AI Syllabus Generator is not available on this server: ' + limits.reason, { code: 'generator_unavailable' });
  let content = null;
  try { content = JSON.parse(syllabus.content); } catch { content = null; }
  if (!content || !content.meta || !content.meta.courseId) throw httpError(409, 'Choose a subject for this syllabus first. The generator writes from the subject.', { code: 'subject_required' });
  const body = req.body || {};
  if (body.guidance !== undefined && (typeof body.guidance !== 'string' || body.guidance.length > 1500)) throw httpError(400, 'Your notes for the AI can be up to 1500 characters.');
  if (generateJobs.isRunning(syllabus.syllabus_id)) throw httpError(409, 'This syllabus is already being generated. Wait until it finishes.', { code: 'generate_busy' }); // only the same syllabus: others generate at the same time
  const perDay = generatePerDay();
  const slot = perDay ? await generateJobs.allowance(db, me.id, perDay) : { ok: true };
  if (!slot.ok) { res.set('Retry-After', String(slot.retryAfterSec)); throw httpError(429, 'You have generated the most syllabi allowed today. Try again tomorrow, or write this one yourself.', { code: 'generate_daily_limit' }); }
  const job = await generateJobs.start({ db, syllabusId: syllabus.syllabus_id, userId: me.id, run: async (onProgress) => {
    const masters = await repo.mastersFor(db, content, { syllabusId: syllabus.syllabus_id });
    let out;
    try { out = await generator.generateSyllabus({ content, masters, env: process.env, store: require('../lib/syllabuscheck/pipeline/shadow').storeFor(db), guidance: body.guidance || '', onProgress }); } catch (error) {
      const spent = error && error.usage ? error.usage : {}; // a run that stopped still spent what its requests cost: one line for the cost register
      console.log(`AI Syllabus Generator STOPPED: syllabus ${syllabus.syllabus_id}, user ${me.id}, ${spent.budget ? spent.budget.requests : '?'} requests, estimated $${spent.estimatedUsd}, ${String(error && error.message).slice(0, 120)}`);
      throw error;
    }
    const u = out.usage || {}; // one line for the cost register: what this run estimated it spent
    console.log(`AI Syllabus Generator: syllabus ${syllabus.syllabus_id}, user ${me.id}, ${out.check && out.check.status}, ${u.budget ? u.budget.requests : '?'} requests, estimated $${u.estimatedUsd}`);
    await require('../lib/accountActivity').record(db, { userId: me.id, action: 'generate', syllabusId: syllabus.syllabus_id, subject: require('../lib/accountActivity').subjectLine(content.meta.code, content.meta.title), notes: (out.check && out.check.status) || null });
    return out;
  } });
  res.status(202).json(job);
}));
router.get('/syllabi/:id/generate', wrap(async (req, res) => {
  const { me, db, syllabus } = await ownDraft(req);
  res.json(await generateJobs.get(db, syllabus.syllabus_id, me.id));
}));
router.delete('/syllabi/:id/generate', wrap(async (req, res) => {
  const { me, db, syllabus } = await ownDraft(req);
  res.json({ cleared: await generateJobs.clear(db, syllabus.syllabus_id, me.id) });
}));

module.exports = router;
module.exports.curriculumInput = curriculumInput;
