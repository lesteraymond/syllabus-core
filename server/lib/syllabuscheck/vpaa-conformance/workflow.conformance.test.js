'use strict';
// VPAA conformance, Tasks 5 and 8C: the whole Hybrid checking workflow in route order with the PRODUCTION service and routes and an in-memory
// database:   submit gate → Re-Check → shared hybrid service → coded rules → (scripted) Claude evaluation → saved report → what the UI reads →
//             recommendation actions → corrective re-check → stale detection → administrator approval gates.
// This is a workflow-level integration test, not a browser test: nothing is rendered here (see tests/vpaa-conformance-ui.test.jsx) and no model
// or network is involved.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const h = require('./harness');
const { createMemoryDb } = require('./memdb');
const svc = require('../../compliance/service');
const repo = require('../repository');

const LINK = async (url) => ({ url, status: 'ok', httpStatus: 200 });
const ENV = h.envFor({ SYLLABUS_CHECK_ACADEMIC_V2: 'off', SYLLABUS_CHECK_STAGE_B: 'on', SYLLABUS_CHECK_STAGE_C3: 'on' });
const ROUTE = require.resolve('../../../routes/syllabusCheck');

// `synthetic: false` lets the full pipeline run to an official-looking result; the shared fixture's masters are flagged synthetic, which by design can
// never produce an official score (proved by [VPAA-T5-SYNTHETIC-GUARD]). The data itself is still controlled synthetic test data.
function world(t, { synthetic = false } = {}) {
  const { content, masters } = h.sample();
  masters.synthetic = synthetic;
  masters.fingerprint = 'conformance-reference-fingerprint';
  t.mock.method(repo, 'mastersFor', async () => masters);
  const db = createMemoryDb({ syllabus: { content: JSON.stringify(content) } });
  return { content, masters, db };
}
// One Re-Check exactly as POST /compliance/:id/recheck does it: shared hybrid service, then storeRun, then what the UI reads back.
async function recheck(db, content, { script, createdBy = 26, env = ENV, transport } = {}) {
  const tr = transport || h.scriptedTransport(script);
  const result = await svc.checkHybrid(db, content, { syllabusId: 100, env, transport: tr, linkChecker: LINK });
  const runId = await svc.storeRun(db, { syllabusId: 100, versionId: null, content, result, createdBy, ai: true });
  const [[row]] = [await db.query('SELECT * FROM ai_check_runs WHERE run_id = ?', [runId])];
  const run = await svc.loadDetail(db, row[0] || row, svc.hashOf(content));
  return { result, runId, run, transport: tr };
}
const scored = (run) => Math.max(0, run.hybrid.baseScore - run.hybrid.deductions.reduce((s, d) => s + d.points, 0));

test('[VPAA-T5-SUBMIT-GATE] the coded hard gates always stop a submit; with them clear, the gate is advisory unless AI is made mandatory', async (t) => {
  h.liveGuard(t);
  const { content, db } = world(t);
  const broken = structuredClone(content); broken.grading.rows[1].pct = 30; // totals 90
  await assert.rejects(() => svc.requireHybrid(db, 100, broken), (e) => e.status === 409 && e.body?.code === 'syllabus_hard_gate' && e.body.failed.some((f) => f.ruleId === 'GRADE-100'), 'a grading total of 90 blocks the submit');
  const wrongCode = structuredClone(content); wrongCode.meta.code = 'ZZ 999';
  await assert.rejects(() => svc.requireHybrid(db, 100, wrongCode), (e) => e.status === 409 && e.body.score === 0, 'a course code outside the approved curriculum is critical: score 0');
  assert.equal(await svc.requireHybrid(db, 100, content), undefined, 'advisory gate: clear hard gates are enough, no AI check needed');
});

test('[VPAA-T5-WORKFLOW] Re-Check → saved report → what the UI reads: data, relationships, findings, score and recommendations agree', async (t) => {
  h.liveGuard(t);
  const { content, masters, db } = world(t);
  const before = structuredClone(content);
  // The model says: week 1 activities do not practise the ILO (a SCORED relationship) and week 1 assessment only partly fits the content (an advisory C3 link).
  const { result, runId, run, transport } = await recheck(db, content, { script: (p) => (p.id === 'row0-ilo0-activity' ? { label: 'NOT_ALIGNED' } : p.id === 'row0-contentassessment' ? { label: 'PARTIALLY_ALIGNED' } : undefined) });
  assert.deepEqual(content, before, 'the check never changes faculty content');
  // 1-2. Extraction and relationship construction: every instructional week asked all seven relationships (Stage B + C3 on).
  const types = new Set(transport.pairs().map((p) => p.type));
  for (const type of ['Content-course', 'Content-ILO', 'ILO-CLO', 'Content-activity', 'ILO-activity', 'Content-assessment', 'Activity-assessment']) assert.ok(types.has(type), type);
  const ids = result.hybrid.alignment.judgements.map((j) => j.id);
  assert.equal(new Set(ids).size, ids.length, 'no relationship is judged twice');
  // 3-4. Structured parsing: every judgement verified, both quotes inside the pair text.
  assert.equal(result.hybrid.alignment.status, 'completed');
  assert.ok(result.hybrid.alignment.judgements.every((j) => !j.unverified && j.sourceQuote && j.targetQuote));
  // 10. Persistence: the stored report and run row carry the provider, model and judgements; reading them back is lossless.
  assert.equal(run.id, runId); assert.equal(run.provider, 'anthropic'); assert.equal(run.model, h.MODEL); assert.equal(run.aiStatus, 'ok');
  const saved = JSON.parse(db.state.reports.get(runId).report_json);
  assert.equal(saved.hybrid.alignment.judgements.length, result.hybrid.alignment.judgements.length);
  assert.deepEqual(run.hybrid.suggestions.map((s) => s.id), result.hybrid.suggestions.map((s) => s.id), 'suggestions survive storage unchanged');
  // THE SCORE IS THE FINDINGS: baseScore − Σ deductions, each deduction backed by a finding, each AI suggestion backed by a finding.
  assert.equal(run.overall, scored(run), 'the stored score equals 100-point base minus the listed deductions');
  const findingIds = new Set(run.findings.map((f) => f.id));
  assert.ok(run.hybrid.deductions.length >= 1 && run.hybrid.deductions.every((d) => findingIds.has(d.id)), 'every deduction is explained by a finding');
  assert.ok(run.hybrid.suggestions.every((s) => (s.basedOn || []).every((b) => findingIds.has(b))), 'every suggestion is based on a finding');
  assert.ok(run.hybrid.deductions.some((d) => d.id === 'SEM:row0-ilo0-activity' && d.points === 3), 'the NOT_ALIGNED scored relationship cost 3');
  assert.ok(!run.hybrid.deductions.some((d) => /contentassessment/.test(d.id)), 'the advisory C3 link cost nothing');
  assert.ok(run.findings.some((f) => /contentassessment/.test(f.id)), 'but it is still reported as a finding');
  assert.equal(run.stale, false);
  assert.ok(run.hybrid.suggestions.every((s) => s.source === 'ai' || s.source === 'rule'));
  // Reading it again (a second visitor) gives the same stored answer.
  const again = await svc.loadDetail(db, db.state.runs[0], svc.hashOf(content));
  assert.equal(again.overall, run.overall);
  assert.equal(masters.fingerprint, db.state.reports.get(runId) && JSON.parse(db.state.reports.get(runId).report_json).referenceHash, 'the reference fingerprint is saved with the report');
});

test('[VPAA-T5-RECOMMEND-FLOW] Accept / Edit / Reject / Undo are recorded over HTTP, then a corrective re-check improves the score and re-asks only what changed', async (t) => {
  h.liveGuard(t);
  const { content, db } = world(t);
  const first = await recheck(db, content, { script: (p) => (p.id === 'row0-ilo0-activity' ? { label: 'NOT_ALIGNED' } : undefined) });
  const suggestion = first.run.hybrid.suggestions.find((s) => s.basedOn?.includes('SEM:row0-ilo0-activity') || /row0-ilo0-activity/.test(s.id));
  assert.ok(suggestion, 'the NOT_ALIGNED relationship produced a rewrite suggestion');
  assert.equal(suggestion.path, 'plan[0].activities');

  delete require.cache[ROUTE];
  const app = express(); app.use(express.json()); app.locals.db = db;
  app.use((req, res, next) => { const who = req.headers['x-test-role']; req.session = who ? { user: { id: who === 'admin' ? 1 : 26, role: who === 'admin' ? 'admin' : 'faculty' } } : {}; next(); });
  app.use('/api/syllabus-check', require(ROUTE));
  const server = app.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r)); t.after(() => new Promise((r) => server.close(r)));
  const call = async (role, body, method = 'POST') => { const r = await fetch(`http://127.0.0.1:${server.address().port}/api/syllabus-check/runs/${first.runId}/decisions`, { method, headers: { 'Content-Type': 'application/json', 'x-test-role': role }, body: method === 'GET' ? undefined : JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };

  const accepted = await call('faculty', { suggestionId: suggestion.id, action: 'accept' });
  assert.equal(accepted.status, 201);
  assert.equal(accepted.body.draft.path, 'plan[0].activities');
  assert.equal((await call('faculty', { suggestionId: suggestion.id, action: 'reject' })).status, 201);
  assert.equal((await call('faculty', { suggestionId: suggestion.id, action: 'undo' })).status, 201);
  assert.equal((await call('admin', { suggestionId: suggestion.id, action: 'accept' })).status, 404, 'the administrator cannot act on a draft');
  const log = (await call('faculty', null, 'GET')).body;
  assert.deepEqual(log.map((d) => d.action), ['accept', 'reject', 'undo'], 'every action is in the audit trail, in order');
  assert.equal(JSON.parse(db.state.runs[0].content_hash ? JSON.stringify({ ok: 1 }) : '{}').ok, 1);
  assert.equal(db.state.logs.filter((l) => l.action === 'recommend').length, 3, 'and in the activity log');

  // The author applies the accepted draft in the builder, then re-checks.
  const fixed = structuredClone(content);
  fixed.plan[0].activities = accepted.body.draft.replacement;
  const second = await recheck(db, fixed, { script: () => undefined });
  assert.ok(second.run.overall > first.run.overall, `the score improves after the correction (${first.run.overall} → ${second.run.overall})`);
  assert.ok(second.transport.sent.length < first.transport.sent.length, `the second check re-asks only what changed (${first.transport.sent.length} → ${second.transport.sent.length} requests)`);
  assert.ok(second.result.hybrid.alignment.judgements.some((j) => j.reused), 'unchanged relationships are reused, not re-asked');
  assert.ok(second.run.hybrid.deductions.every((d) => d.id !== 'SEM:row0-ilo0-activity'), 'the corrected relationship no longer costs points');
});

test('[VPAA-T5-STALE] a saved check goes stale when the syllabus changes afterwards, and a stale check can neither be approved nor satisfy a mandatory gate', async (t) => {
  h.liveGuard(t);
  const { content, db } = world(t);
  const { run } = await recheck(db, content, { createdBy: 1 });
  const changed = structuredClone(content); changed.plan[0].contents = 'Edited after the check';
  const stale = await svc.loadDetail(db, db.state.runs[0], svc.hashOf(changed));
  assert.equal(run.stale, false); assert.equal(stale.stale, true);
  const { canApproveAdminDraft } = await import('../../../../src/lib/syllabusRules.js');
  const admin = { id: 1, role: 'admin' }, syllabus = { syllabusId: 100, userId: 1, status: 'under_review' };
  assert.equal(canApproveAdminDraft(admin, syllabus, { ...run, syllabusId: 100, createdBy: 1 }, true, 'advisory'), true, 'a current check allows the administrator to decide');
  assert.equal(canApproveAdminDraft(admin, syllabus, { ...stale, syllabusId: 100, createdBy: 1 }, true, 'advisory'), false, 'a stale check does not');
  assert.equal(canApproveAdminDraft(admin, syllabus, { ...run, syllabusId: 100, createdBy: 1 }, false, 'advisory'), false, 'nor an earlier run');
  assert.equal(canApproveAdminDraft({ id: 2, role: 'admin' }, syllabus, { ...run, syllabusId: 100, createdBy: 1 }, true, 'advisory'), false, 'nor another administrator\'s check of someone else\'s draft');
  assert.equal(canApproveAdminDraft({ id: 1, role: 'faculty' }, syllabus, { ...run, syllabusId: 100, createdBy: 1 }, true, 'advisory'), false, 'the AI never approves: only an administrator, on an under-review draft');
});

test('[VPAA-T5-APPROVAL-GATES] administrator approval: advisory gate needs a current check and clear hard gates; the mandatory gate also needs a completed verified AI check', async (t) => {
  h.liveGuard(t);
  const { canApproveAdminDraft } = await import('../../../../src/lib/syllabusRules.js');
  const admin = { id: 1, role: 'admin' }, syllabus = { syllabusId: 100, userId: 1, status: 'under_review' };
  const { content, db } = world(t);
  const complete = (await recheck(db, content, { createdBy: 1 })).run;
  gemini().resetProviderBlock();
  const failedAi = (await recheck(db, structuredClone(content), { createdBy: 1, env: h.envFor({ ...ENV, SYLLABUS_CHECK_AI_PROVIDER: 'off' }) })).run;
  const as = (run, gate) => canApproveAdminDraft(admin, syllabus, { ...run, syllabusId: 100, createdBy: 1 }, true, gate);
  assert.equal(complete.aiStatus, 'ok'); assert.equal(failedAi.aiStatus, 'failed');
  assert.equal(as(complete, 'advisory'), true);
  assert.equal(as(failedAi, 'advisory'), true, 'advisory: the administrator may decide after reading an incomplete AI check');
  assert.equal(as(failedAi, 'required'), false, 'mandatory: an incomplete AI check blocks approval');
  assert.equal(as(complete, 'required'), complete.status === 'scored' && complete.conformant && complete.hybrid.ready && complete.hybrid.alignment.status === 'completed', 'mandatory: only a scored, conformant, ready and completed check');
  // The server-side publish/submit gate behaves the same way under the mandatory policy (it reads the process environment).
  // The server-level approval of the model is part of what makes an AI result count as verified (gemini.js verifiedAlignment reads process.env).
  const keep = { gate: process.env.SYLLABUS_CHECK_AI_GATE, approved: process.env.SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL };
  process.env.SYLLABUS_CHECK_AI_GATE = 'required'; process.env.SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL = h.MODEL;
  const realNow = Date.now;
  t.after(() => { Date.now = realNow; for (const [k, v] of [['SYLLABUS_CHECK_AI_GATE', keep.gate], ['SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL', keep.approved]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  const fresh = world(t);
  await recheck(fresh.db, fresh.content, { createdBy: 26 });
  const report = await svc.requireHybrid(fresh.db, 100, fresh.content);
  assert.ok(report && report.hybrid.alignment.status === 'completed', 'mandatory gate: a fresh completed check passes');
  const edited = structuredClone(fresh.content); edited.plan[0].contents = 'Edited after the check';
  await assert.rejects(() => svc.requireHybrid(fresh.db, 100, edited), (e) => e.body?.code === 'alignment_required', 'mandatory gate: changed content needs a new check');
  Date.now = () => realNow() + 31 * 60 * 1000;
  await assert.rejects(() => svc.requireHybrid(fresh.db, 100, fresh.content), (e) => e.body?.code === 'alignment_required', 'mandatory gate: a check expires after 30 minutes');
});

const gemini = () => require('../gemini');

test('[VPAA-T5-SYNTHETIC-GUARD] a check made against synthetic reference data never yields an official score or satisfies a mandatory gate', async (t) => {
  h.liveGuard(t);
  const { content, db } = world(t, { synthetic: true });
  const { result, run } = await recheck(db, content, {});
  assert.equal(result.hybrid.alignment.status, 'completed', 'the AI part can complete');
  assert.equal(run.status, 'incomplete'); assert.equal(run.overall, null); assert.equal(run.passed, false);
  assert.equal(run.hybrid.ready, false);
  const saved = process.env.SYLLABUS_CHECK_AI_GATE; process.env.SYLLABUS_CHECK_AI_GATE = 'required';
  t.after(() => { if (saved === undefined) delete process.env.SYLLABUS_CHECK_AI_GATE; else process.env.SYLLABUS_CHECK_AI_GATE = saved; });
  await assert.rejects(() => svc.requireHybrid(db, 100, content), (e) => e.body?.code === 'alignment_required', 'the mandatory gate refuses synthetic reference data');
});

test('[VPAA-T5-STAGES-VIA-SERVICE] regression for DEF-05: every Stage flag still lets the shared service complete the AI evaluation', async (t) => {
  h.liveGuard(t);
  for (const flag of ['A', 'B', 'B3', 'B4', 'C1', 'C2', 'C3', 'D1', 'D2']) {
    gemini().resetProviderBlock();
    const { content, db } = world(t);
    const transport = h.scriptedTransport();
    const result = await svc.checkHybrid(db, content, { syllabusId: 100, env: h.envFor({ SYLLABUS_CHECK_ACADEMIC_V2: 'off', ['SYLLABUS_CHECK_STAGE_' + flag]: 'on' }), transport, linkChecker: LINK });
    assert.equal(result.hybrid.alignment.status, 'completed', `STAGE_${flag}: ${result.hybrid.alignment.reason}`);
    assert.ok(transport.sent.length > 0, `STAGE_${flag}: the model was asked`);
  }
});
