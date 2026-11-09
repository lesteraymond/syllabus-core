'use strict';
// Task 5: the staging rehearsal. The full workflow under the DOCUMENTED staging environment (staging.js parses it from POLICY-V2-ACTIVATION.md), a SCRIPTED provider,
// synthetic syllabus data and an in-memory database. It dispatches no Anthropic request, uses no real credential and touches no real data: any non-loopback network
// call fails the suite. A pass is software conformance and staging configuration readiness; it is NOT a live provider test.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const h = require('./harness');
const { createMemoryDb } = require('./memdb');
const { documentedStagingEnv } = require('./staging');
const svc = require('../../compliance/service');
const repo = require('../repository');
const refine = require('../refine');
const gemini = require('../gemini');

const STAGING = documentedStagingEnv();
const LINK = async (url) => ({ url, status: 'ok', httpStatus: 200 });
const SEVEN = ['Content-course', 'Content-ILO', 'ILO-CLO', 'Content-activity', 'ILO-activity', 'Content-assessment', 'Activity-assessment'];
const ID = { 'Content-course': /^row\d+-content$/, 'Content-ILO': /^row\d+-ilo\d+-contentilo$/, 'ILO-CLO': /^row\d+-ilo\d+-(clo:.+|unassigned-clo)$/, 'Content-activity': /^row\d+-contentactivity$/, 'ILO-activity': /^row\d+-ilo\d+-activity$/, 'Content-assessment': /^row\d+-contentassessment$/, 'Activity-assessment': /^row\d+-activityassessment$/ };
const MARKER = 'REHEARSAL-DESCRIPTION-MARKER';
const FAIL = (p) => (['row0-content', 'row0-ilo0-activity'].includes(p.id) ? { label: 'NOT_ALIGNED' } : p.id === 'row0-contentassessment' ? { label: 'PARTIALLY_ALIGNED' } : undefined);
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

function world(t, { description } = {}) {
  const w = h.sample(); w.masters.synthetic = false; w.masters.fingerprint = 'rehearsal-fingerprint';
  if (description) w.content.description = [{ id: 'd1', t: description }];
  t.mock.method(repo, 'mastersFor', async () => w.masters);
  return { ...w, db: createMemoryDb({ syllabus: { content: JSON.stringify(w.content) } }) };
}
async function check(db, content, env, { script, transport } = {}) {
  gemini.resetProviderBlock();
  const tr = transport || h.scriptedTransport(script);
  const result = await svc.checkHybrid(db, structuredClone(content), { syllabusId: 100, env, transport: tr, linkChecker: LINK });
  return { result, tr };
}
const { SYLLABUS_CHECK_ACADEMIC_V2: _flag, ...V2_OFF } = STAGING; // the same environment with Policy V2 switched off (the rollback state)

test('[VPAA-STG-REHEARSAL-SEVEN] under the staging configuration all seven relationships are evaluated, with correct identifiers, context and recommendations, inside the limits', async (t) => {
  h.liveGuard(t);
  const { content, db } = world(t, { description: MARKER + ' course description' });
  const { result, tr } = await check(db, content, STAGING, { script: FAIL });
  const v2 = result.hybrid.academicV2, rels = v2.academic.relationships, lessons = content.plan.map((row, i) => ({ row, i })).filter(({ row }) => row.kind !== 'exam');
  // seven relationships, every lesson, correct identifiers
  assert.equal(v2.mode, 'live-application'); assert.equal(v2.alignment.status, 'completed');
  for (const type of SEVEN) { for (const { i } of lessons) assert.ok(rels.some((r) => r.relationshipType === type && r.id.startsWith(`row${i}-`)), `${type} week ${content.plan[i].week}`); assert.ok(rels.filter((r) => r.relationshipType === type).every((r) => ID[type].test(r.id)), `${type}: identifier format`); }
  assert.equal(new Set(rels.map((r) => r.id)).size, rels.length, 'unique identifiers');
  assert.equal(result.hybrid.semanticCoverage.complete, true); assert.equal(result.hybrid.semanticCoverage.evaluated, 7);
  // academic context
  const v2Pairs = tr.sent.filter((q) => /academic-evaluation-v2/.test(q.system)).flatMap((q) => q.user.document_data);
  const title = v2Pairs.find((p) => p.id === 'row0-content');
  assert.ok(norm(title.source).includes(content.meta.title) && /Program: BSIT/.test(title.source) && /Year level: 2/.test(title.source) && /Next week - Week 2/.test(title.source), 'Title ↔ Content carries the course identity and the adjacent week');
  assert.ok(!JSON.stringify(v2Pairs.filter((p) => /CLO/.test(p.type))).includes(MARKER), 'no CLO relationship carries the description');
  assert.ok(tr.sent.filter((q) => q.user.document_data.some((p) => /CLO/.test(p.type))).every((q) => q.user.course.description === ''), 'no request with a CLO relationship carries the shared description (V2 on)');
  assert.ok(v2Pairs.filter((p) => p.type === 'ILO-CLO').every((p) => p.classificationContext && ['Introductory', 'Enabling', 'Demonstrating', 'Integration of Values'].includes(p.classificationContext.classification)), 'ILO ↔ CLO carries the fixed LCUP classification');
  // recommendations: advisory, one per relationship, none auto-applied
  const actions = v2.academic.remediation.actions;
  assert.ok(actions.some((a) => a.relationshipIds.includes('row0-content')) && actions.some((a) => a.relationshipIds.includes('row0-contentassessment')), 'a recommendation action for each failed V2 relationship');
  assert.ok(actions.every((a) => a.canAutoApply === false && a.requiresHumanReview === true));
  assert.ok(!result.hybrid.suggestions.some((s) => /contentassessment/.test(s.id)), 'the advice-only link offers no field rewrite');
  const by = new Map(); for (const s of result.hybrid.suggestions) for (const id of (s.basedOn || [s.id]).map((x) => String(x).replace(/^SEM:/, ''))) by.set(id, (by.get(id) || 0) + 1);
  assert.ok([...by.values()].every((n) => n === 1), 'one recommendation per relationship (no duplicates)');
  // Owner policy 2026-11-09: a lesson Policy V2 finds off-topic (this script fails week 1's Title <-> Content) offers no rewrites that would keep its topic.
  // The scored legacy relationship's draft is therefore withheld for week 1 and recorded with the reason, not offered and not lost silently.
  assert.ok(!result.hybrid.suggestions.some((s) => s.basedOn?.includes('SEM:row0-ilo0-activity')), 'the off-topic lesson offers no rewrite that keeps its topic');
  assert.ok((result.hybrid.suggestionsWithheld || []).some((w) => w.basedOn.includes('SEM:row0-ilo0-activity') && w.reason === 'off_topic_lesson' && w.offTopicRelationship === 'row0-content'), 'the scored legacy relationship\'s draft is recorded as withheld');
  // limits and honesty
  const b = v2.alignment.requestBudget, v2Requests = tr.sent.filter((q) => /academic-evaluation-v2/.test(q.system)).length;
  assert.ok(b.requests <= 120 && b.reservedCostUsd <= 10 && !b.exhausted, `within the documented caps: ${b.requests} requests, $${b.reservedCostUsd} reserved`);
  assert.equal(v2.alignment.liveModelCalls, v2Requests, 'V2 reports exactly its own requests');
  assert.equal(v2.academic.provenance.facultyValidated, false); assert.equal(result.hybrid.semanticCoverage.advisoryOnly, true);
  assert.ok(!tr.sent.some((q) => q.body.model !== 'claude-sonnet-5-5'), 'every request names the approved model');
});

test('[VPAA-STG-REHEARSAL-PARITY] the official result under the staging configuration is identical with Policy V2 on and off', async (t) => {
  h.liveGuard(t);
  const a = world(t), b = world(t);
  const on = (await check(a.db, a.content, STAGING, { script: FAIL })).result, off = (await check(b.db, b.content, V2_OFF, { script: FAIL })).result;
  const shape = (r) => ({ score: r.score, overall: r.overall, status: r.status, passed: r.passed, threshold: r.passThreshold, base: r.hybrid.baseScore, deductions: r.hybrid.deductions.map((d) => [d.id, d.points]), ready: r.hybrid.ready, conformance: r.conformance.ok, areas: r.areas.map((x) => [x.key, x.score]) });
  assert.deepEqual(shape(on), shape(off));
  assert.equal(on.passThreshold, 79); assert.ok(on.hybrid.deductions.length > 0, 'real deductions were exercised, so parity is not vacuous');
  assert.equal(h.engine.coded(structuredClone(a.content), a.masters).base.findings.length, h.engine.coded(structuredClone(b.content), b.masters).base.findings.length, 'the 47 coded rules are unaffected');
});

test('[VPAA-STG-REHEARSAL-PERSISTENCE] the report is saved, read back whole, goes stale when the syllabus changes, and survives a rollback', async (t) => {
  h.liveGuard(t);
  const { content, db } = world(t);
  const { result } = await check(db, content, STAGING, { script: FAIL });
  const runId = await svc.storeRun(db, { syllabusId: 100, versionId: null, content, result, createdBy: 26, ai: true });
  const stored = JSON.parse(db.state.reports.get(runId).report_json);
  assert.ok(stored.hybrid.academicV2 && stored.hybrid.semanticCoverage && stored.hybrid.alignment.provider === 'anthropic' && stored.hybrid.alignment.model === 'claude-sonnet-5-5');
  const run = await svc.loadDetail(db, db.state.runs[0], svc.hashOf(content));
  assert.deepEqual(run.hybrid.academicV2.academic.relationships.map((r) => r.id), result.hybrid.academicV2.academic.relationships.map((r) => r.id));
  assert.equal(run.overall, result.score); assert.equal(run.provider, 'anthropic'); assert.equal(run.aiStatus, 'ok'); assert.equal(run.stale, false);
  const changed = structuredClone(content); changed.plan[0].contents = 'Edited after the check';
  assert.equal((await svc.loadDetail(db, db.state.runs[0], svc.hashOf(changed))).stale, true, 'a changed syllabus makes the saved check stale');
});

test('[VPAA-STG-REHEARSAL-OFFLINE] with the AI unavailable the staging configuration reports an incomplete check, keeps the coded checks, and issues no official score', async (t) => {
  h.liveGuard(t);
  // A connection failure is retried with a real 1 s / 2 s / 4 s backoff by default; that behavior is verified, fast, in VPAA-STG-RETRY. Here retries are 0 so the rehearsal stays quick.
  const NO_BACKOFF = { ...STAGING, ANTHROPIC_MAX_RETRIES: '0' };
  const down = async () => { throw new TypeError('fetch failed'); };
  const refused = async () => new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401, headers: { 'content-type': 'application/json' } });
  for (const [name, env, transport, reason] of [['connection fails', NO_BACKOFF, down, 'v2_not_evaluated'], ['provider refuses (401)', STAGING, refused, 'v2_not_evaluated'], ['provider switched off', { ...STAGING, SYLLABUS_CHECK_AI_PROVIDER: 'off' }, undefined, 'v2_not_evaluated'], ['approval removed', { ...STAGING, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: '' }, undefined, 'v2_not_evaluated'], ['V2 off and the AI down', { ...V2_OFF, ANTHROPIC_MAX_RETRIES: '0' }, down, 'policy_v2_off']]) {
    const { content, db } = world(t), baseline = world(t);
    const noAi = await svc.checkHybrid(baseline.db, structuredClone(content), { syllabusId: 100, env: { ...STAGING, SYLLABUS_CHECK_AI_PROVIDER: 'off', SYLLABUS_CHECK_ACADEMIC_V2: 'off' }, linkChecker: LINK });
    const tr = transport || h.scriptedTransport();
    const { result } = await check(db, content, env, { transport: tr });
    const cov = result.hybrid.semanticCoverage;
    assert.equal(cov.complete, false, name); assert.equal(cov.reason, reason, name); assert.equal(cov.evaluated, 0, name);
    assert.equal(result.status, 'incomplete', name); assert.equal(result.score, null, `${name}: no official score`);
    assert.deepEqual(result.findings.map((f) => f.id), noAi.findings.map((f) => f.id), `${name}: the coded findings are exactly those of a no-AI check`);
    assert.ok(result.hybrid.alignment.judgements.every((j) => j.unverified), `${name}: no verified judgment`);
    if (!transport) assert.equal(tr.sent.length, 0, `${name}: no request is sent when the provider is not usable`);
  }
});

test('[VPAA-STG-REHEARSAL-AUTHORIZATION] Check & Improve and recommendation actions: only the author acts, an unverified or forged recommendation is never recorded, the administrator reads', async (t) => {
  h.liveGuard(t);
  const saved = { ...process.env };
  Object.assign(process.env, STAGING); // the routes read the server environment; this is the documented staging environment with stand-in secrets
  t.after(() => { for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); });
  const { content, db } = world(t);
  const { result } = await check(db, content, STAGING, { script: FAIL });
  const runId = await svc.storeRun(db, { syllabusId: 100, versionId: null, content, result, createdBy: 26, ai: true });
  const v2Suggestion = result.hybrid.suggestions.find((s) => s.policy && /row0-content/.test((s.basedOn || []).join()));
  assert.ok(v2Suggestion, 'a Policy V2 recommendation exists to act on');
  t.mock.method(refine, 'refineSuggestion', async () => ({ status: 'verified', text: v2Suggestion.replacement }));
  const ROUTE = require.resolve('../../../routes/syllabusCheck');
  delete require.cache[ROUTE];
  const app = express(); app.use(express.json()); app.locals.db = db;
  app.use((req, res, next) => { const who = req.headers['x-test-role']; req.session = who ? { user: { id: who === 'admin' ? 1 : who === 'other' ? 27 : 26, role: who === 'admin' ? 'admin' : 'faculty' } } : {}; next(); });
  app.use('/api/syllabus-check', require(ROUTE));
  const server = app.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r)); t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}/api/syllabus-check/runs/${runId}`;
  const call = async (role, p, body, method = 'POST') => { const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  const decide = (role, body) => call(role, '/decisions', body), improve = (role) => call(role, `/suggestions/${encodeURIComponent(v2Suggestion.id)}/refine`, {});
  // a V2 recommendation cannot be recorded without a verified token (this includes the scored one while V2 is on)
  const sid = v2Suggestion.id;
  assert.equal((await decide('faculty', { suggestionId: sid, action: 'accept' })).status, 409, 'unverified: refused');
  assert.equal((await decide('faculty', { suggestionId: sid, action: 'accept', verificationToken: 'forged' })).status, 409, 'forged token: refused');
  assert.equal(db.state.decisions.length, 0);
  // the author checks and improves, receives a token, accepts; the token works once
  const checked = await improve('faculty'); assert.equal(checked.status, 200); assert.ok(checked.body.verificationToken);
  assert.equal((await decide('faculty', { suggestionId: sid, action: 'accept', verificationToken: checked.body.verificationToken })).status, 201);
  assert.equal((await decide('faculty', { suggestionId: sid, action: 'accept', verificationToken: checked.body.verificationToken })).status, 409, 'replay refused');
  // everyone else
  assert.equal((await decide('other', { suggestionId: sid, action: 'reject' })).status, 404, 'another faculty member cannot see the run');
  assert.equal((await decide(null, { suggestionId: sid, action: 'reject' })).status, 401, 'anonymous');
  assert.equal((await decide('admin', { suggestionId: sid, action: 'reject' })).status, 404, 'a draft is not visible to the administrator');
  db.state.syllabus.status = 'under_review';
  assert.equal((await decide('admin', { suggestionId: sid, action: 'reject' })).status, 403, 'under review the administrator can read but never decide');
  assert.equal((await improve('admin')).status, 403, 'Check & Improve is author-only');
  assert.equal((await call('admin', '/decisions', null, 'GET')).status, 200);
  assert.equal((await decide('faculty', { suggestionId: sid, action: 'reject' })).status, 409, 'locked once under review');
  assert.deepEqual(db.state.decisions.map((d) => d.action), ['accept'], 'exactly the one verified decision was recorded');
  // without the signing secret the same actions fail closed
  delete process.env.SESSION_SECRET; db.state.syllabus.status = 'draft';
  assert.equal((await improve('faculty')).status, 503, 'no secret: Check & Improve fails closed');
  assert.equal((await decide('faculty', { suggestionId: sid, action: 'accept', verificationToken: checked.body.verificationToken })).status, 503);
});

test('[VPAA-STG-REHEARSAL-NO-LIVE-CALL] the rehearsal cannot reach the network: any real call is blocked and the staging environment carries only stand-in credentials', async (t) => {
  h.liveGuard(t);
  await assert.rejects(() => fetch('https://api.anthropic.com/v1/messages', { method: 'POST' }), /LIVE NETWORK CALL BLOCKED/);
  for (const k of ['ANTHROPIC_API_KEY', 'SESSION_SECRET', 'JWT_SECRET']) assert.match(STAGING[k], /stand-in/);
  assert.ok(!Object.values(STAGING).some((v) => /^sk-ant-(?!staging-stand-in)/.test(v)), 'no key shaped like a real one');
});
