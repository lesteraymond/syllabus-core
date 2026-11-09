'use strict';
// VPAA conformance, Task 7: Check & Improve, Accept, Edit, Reject, Undo, through the REAL route code (server/routes/syllabusCheck.js) with an in-memory
// database. Verifies authorization, stale-context protection, verification, replay protection and the audit trail. The model is never called:
// Check & Improve's refinement step is replaced by a test double, and no network call is possible (liveGuard).
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const h = require('./harness');
const repo = require('../repository');
const refine = require('../refine');
const { POLICY } = require('../academicV2Plan');

const ROUTE = require.resolve('../../../routes/syllabusCheck');
const V2 = POLICY.id;
// The server signs verification tokens only with a configured secret (DEF-04); the tests configure one exactly as the server does.
process.env.SESSION_SECRET = 'conformance-test-secret-0123456789';

// Boots the real router on an ephemeral loopback port. `state` is read on every request so a test can change the syllabus between calls.
async function boot(t, { report, state }) {
  t.mock.method(repo, 'readReport', async () => report);
  t.mock.method(repo, 'mastersFor', async () => state.masters);
  delete require.cache[ROUTE]; // the route binds readReport when it loads
  const log = { decisions: [], activity: [], unexpected: [] };
  const app = express(); app.use(express.json());
  app.locals.db = { query: async (sql, params) => {
    if (sql.startsWith('SELECT user_id FROM users')) return [[{ user_id: params[0] }]];
    if (sql.startsWith('SELECT s.*, r.run_id')) return [[{ syllabus_id: 100, user_id: 26, status: state.status, content: JSON.stringify(state.content) }]];
    if (sql.startsWith('SELECT decision_id')) return [[]];
    if (sql.startsWith('INSERT INTO submission_logs')) { log.activity.push({ action: params[2], notes: params[3], userId: params[1] }); return [{ insertId: log.activity.length }]; }
    if (sql.startsWith('INSERT INTO syllabus_check_decisions')) { log.decisions.push({ runId: params[0], suggestionId: params[1], action: params[2], editedText: params[3], userId: params[4] }); return [{ insertId: log.decisions.length }]; }
    if (/^SELECT migration_id, details_json FROM program_po_reference_remediation/.test(sql)) return [[]]; // the read of the record review guard
    log.unexpected.push(sql); // any UPDATE of the syllabus would land here: the route must never write faculty content
    throw Error('Unexpected query: ' + sql);
  } };
  app.use((req, res, next) => { const who = req.headers['x-test-role']; req.session = who ? { user: { id: who === 'admin' ? 1 : who === 'other' ? 27 : 26, role: who === 'admin' ? 'admin' : 'faculty' } } : {}; next(); });
  app.use('/api/syllabus-check', require(ROUTE));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/syllabus-check`;
  const call = async (role, path, body, method = 'POST') => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  };
  return { log, call, decide: (role, body) => call(role, '/runs/1/decisions', body), refine: (role, id, body) => call(role, `/runs/1/suggestions/${encodeURIComponent(id)}/refine`, body) };
}

// A Policy V2 suggestion for the course content of week 1, and the syllabus it was made for.
function v2Fixture() {
  const { content, masters } = h.sample();
  const original = content.plan[0].contents;
  const suggestion = { id: 'v2-s1', relationshipId: 'row0-content', path: 'plan[0].contents', title: 'Suggested academic alignment revision', text: 'Why', replacement: 'Variables, data types and arithmetic expressions', originalValue: original, source: 'ai', policy: V2, basedOn: ['row0-content'], recommendationType: 'REWRITE_TEXT', canRefine: true };
  return { content, masters, suggestion, report: { hybrid: { academicV2: { academic: { suggestions: [suggestion] } } } } };
}
const legacySuggestion = { id: 'SEM:pair1', path: 'plan[0].tasks', replacement: 'Design and demonstrate a tested program.' };
const tokenFor = ({ content, masters, suggestion }, over = {}, secret) => refine.createVerificationToken({
  runId: 1, suggestionId: suggestion.id, syllabusId: 100, path: suggestion.path, originalValue: suggestion.originalValue, replacement: suggestion.replacement,
  contextHash: refine.relatedContextHash(content, masters, suggestion.path), ...over }, secret);

test('[VPAA-R13-AUTHORIZATION] only the author can accept, edit, reject or undo; the administrator, another faculty member and an anonymous caller cannot', async (t) => {
  h.liveGuard(t);
  const state = { status: 'draft', content: { plan: [{ tasks: 'Old quiz' }] }, masters: {} };
  const api = await boot(t, { report: { hybrid: { suggestions: [legacySuggestion] } }, state });
  for (const action of ['accept', 'reject', 'undo']) assert.equal((await api.decide('faculty', { suggestionId: legacySuggestion.id, action })).status, 201, `author ${action}`);
  assert.equal((await api.decide('faculty', { suggestionId: legacySuggestion.id, action: 'edit', editedText: 'My own wording of the task.' })).status, 201, 'author edit');
  // A draft is not visible to the administrator at all (drafts stay in My Syllabi): 404, not 403.
  for (const action of ['accept', 'reject', 'undo']) assert.equal((await api.decide('admin', { suggestionId: legacySuggestion.id, action })).status, 404, `admin ${action} on a draft`);
  assert.equal((await api.decide('other', { suggestionId: legacySuggestion.id, action: 'accept' })).status, 404, 'another faculty member cannot even see the run');
  assert.equal((await api.decide(null, { suggestionId: legacySuggestion.id, action: 'accept' })).status, 401, 'anonymous');
  assert.equal(api.log.decisions.length, 4, 'only the four author decisions were recorded');
  // Once submitted for review the administrator can READ the run but never act on a recommendation.
  state.status = 'under_review';
  for (const action of ['accept', 'reject', 'undo']) assert.equal((await api.decide('admin', { suggestionId: legacySuggestion.id, action })).status, 403, `admin ${action} refused`);
  assert.equal((await api.decide('admin', { suggestionId: legacySuggestion.id, action: 'edit', editedText: 'An admin rewrite.' })).status, 403);
  assert.equal((await api.call('admin', '/runs/1/decisions', null, 'GET')).status, 200, 'the administrator can still READ the decisions');
  // And the author is locked out of changing anything once the syllabus is under review or approved.
  for (const status of ['under_review', 'approved']) {
    state.status = status;
    assert.equal((await api.decide('faculty', { suggestionId: legacySuggestion.id, action: 'accept' })).status, 409, `a decision on a ${status} syllabus is refused`);
  }
  assert.equal(api.log.decisions.length, 4, 'nothing recorded once the syllabus is locked or by anyone but the author');
  state.status = 'under_review';
  assert.equal((await api.refine('admin', legacySuggestion.id)).status, 403, 'Check & Improve is author-only');
});

test('[VPAA-R13-VALIDATION] unknown suggestions, unknown actions and bad edits are refused and nothing is recorded', async (t) => {
  h.liveGuard(t);
  const api = await boot(t, { report: { hybrid: { suggestions: [legacySuggestion] } }, state: { status: 'draft', content: {}, masters: {} } });
  assert.equal((await api.decide('faculty', { suggestionId: 'SEM:not-in-this-run', action: 'accept' })).status, 400, 'a suggestion that is not in the saved report cannot be accepted');
  assert.equal((await api.decide('faculty', { suggestionId: legacySuggestion.id, action: 'approve' })).status, 400);
  assert.equal((await api.decide('faculty', { suggestionId: legacySuggestion.id, action: 'edit' })).status, 400, 'an edit needs text');
  assert.equal((await api.decide('faculty', { suggestionId: legacySuggestion.id, action: 'edit', editedText: '   ' })).status, 400);
  assert.equal((await api.decide('faculty', { suggestionId: legacySuggestion.id, action: 'edit', editedText: 'x'.repeat(10001) })).status, 400);
  assert.equal(api.log.decisions.length, 0);
});

test('[VPAA-R13-V2-TOKEN] a Policy V2 recommendation can be accepted or edited only with a valid Check & Improve token; reject and undo need none', async (t) => {
  h.liveGuard(t);
  const fx = v2Fixture();
  const state = { status: 'draft', content: fx.content, masters: fx.masters };
  const api = await boot(t, { report: fx.report, state });
  const id = fx.suggestion.id;
  const noToken = await api.decide('faculty', { suggestionId: id, action: 'accept' });
  assert.equal(noToken.status, 409); assert.match(noToken.body.error, /verified with Check & Improve/);
  assert.equal((await api.decide('faculty', { suggestionId: id, action: 'edit', editedText: 'Faculty wording for the content.' })).status, 409, 'an edit also needs verification');
  assert.equal(api.log.decisions.length, 0, 'an unverified suggestion is never recorded as accepted');
  for (const action of ['reject', 'undo']) assert.equal((await api.decide('faculty', { suggestionId: id, action })).status, 201, `${action} needs no token`);
  const good = await api.decide('faculty', { suggestionId: id, action: 'accept', verificationToken: tokenFor(fx) });
  assert.equal(good.status, 201);
  assert.deepEqual(good.body.draft, { path: 'plan[0].contents', replacement: fx.suggestion.replacement }, 'the server returns the draft; the author applies it in the builder');
  assert.equal(api.log.decisions.map((d) => d.action).join(','), 'reject,undo,accept');
});

test('[VPAA-R13-V2-STALE] a token is refused when the text, the related context, the run, the suggestion or the signature does not match', async (t) => {
  h.liveGuard(t);
  const fx = v2Fixture(), state = { status: 'draft', content: fx.content, masters: fx.masters };
  const api = await boot(t, { report: fx.report, state });
  const id = fx.suggestion.id, accept = (token, extra) => api.decide('faculty', { suggestionId: id, action: 'accept', verificationToken: token, ...extra });
  const refused = async (label, token, extra) => { const r = await accept(token, extra); assert.equal(r.status, 409, `${label}: ${JSON.stringify(r.body)}`); };
  await refused('expired', tokenFor(fx, { ttlMs: -1 }));
  await refused('token for another run', tokenFor(fx, { runId: 2 }));
  await refused('token for another suggestion', tokenFor(fx, { suggestionId: 'v2-other' }));
  await refused('token for another path', tokenFor(fx, { path: 'plan[1].contents' }));
  await refused('token for other replacement text', tokenFor(fx, { replacement: 'Different text than the suggestion' }));
  await refused('signed with a different secret', tokenFor(fx, {}, 'not-the-server-secret'));
  await refused('malformed', 'not-a-token');
  const tampered = JSON.parse(Buffer.from(tokenFor(fx), 'base64url').toString()); tampered.payload.replacement = 'Tampered text';
  await refused('payload tampered after signing', Buffer.from(JSON.stringify(tampered)).toString('base64url'));
  // Stale CONTEXT: the content the token was issued for changes before it is used.
  const token = tokenFor(fx);
  state.content = structuredClone(fx.content); state.content.plan[0].contents = 'Someone edited this field after the check';
  await refused('the field itself changed since the check', token);
  state.content = structuredClone(fx.content); state.content.plan[0].ilos[0].text = 'A different ILO that the content must still support';
  await refused('a related field (the ILO) changed since the check', token);
  assert.equal(api.log.decisions.length, 0, 'no stale or forged token was recorded as an acceptance');
  state.content = fx.content;
  assert.equal((await accept(token)).status, 201, 'the same token is accepted once the context is as it was checked');
});

test('[VPAA-R13-V2-REPLAY] a verification token can be used once', async (t) => {
  h.liveGuard(t);
  const fx = v2Fixture();
  const api = await boot(t, { report: fx.report, state: { status: 'draft', content: fx.content, masters: fx.masters } });
  const token = tokenFor(fx), body = { suggestionId: fx.suggestion.id, action: 'accept', verificationToken: token };
  assert.equal((await api.decide('faculty', body)).status, 201);
  const again = await api.decide('faculty', body);
  assert.equal(again.status, 409); assert.match(again.body.error, /already been applied/);
  assert.equal(api.log.decisions.length, 1);
});

test('[VPAA-R13-AUDIT] every decision leaves an audit row and an activity note, stores edited text only for an edit, and never writes faculty content', async (t) => {
  h.liveGuard(t);
  const fx = v2Fixture();
  const api = await boot(t, { report: fx.report, state: { status: 'draft', content: fx.content, masters: fx.masters } });
  const id = fx.suggestion.id;
  await api.decide('faculty', { suggestionId: id, action: 'reject' });
  const edited = 'Arithmetic expressions and the data types they use';
  await api.decide('faculty', { suggestionId: id, action: 'edit', editedText: edited, verificationToken: tokenFor(fx, { replacement: edited }) });
  await api.decide('faculty', { suggestionId: id, action: 'undo' });
  assert.deepEqual(api.log.decisions.map((d) => [d.action, d.editedText, d.userId, d.suggestionId]), [['reject', null, 26, id], ['edit', edited, 26, id], ['undo', null, 26, id]]);
  assert.equal(api.log.activity.length, 3);
  assert.ok(api.log.activity.every((a) => a.action === 'recommend' && a.userId === 26));
  assert.deepEqual(api.log.unexpected, [], 'the route issued no query that could change the syllabus');
});

test('[VPAA-R13-CHECK-IMPROVE] Check & Improve returns a token only for a verified refinement; an unverified refinement cannot then be accepted', async (t) => {
  h.liveGuard(t);
  const fx = v2Fixture();
  const state = { status: 'draft', content: fx.content, masters: fx.masters };
  const api = await boot(t, { report: fx.report, state });
  const saved = { ...process.env }; Object.assign(process.env, { SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_MODEL: h.MODEL, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: h.MODEL, ANTHROPIC_API_KEY: 'sk-ant-conformance-test-only-not-a-real-key' });
  t.after(() => { for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); });
  const outcomes = [{ status: 'verified', text: 'Variables, data types and arithmetic expressions' }, { status: 'needs_revision', text: 'Not good enough' }];
  t.mock.method(refine, 'refineSuggestion', async () => outcomes.shift());
  const verified = await api.refine('faculty', fx.suggestion.id);
  assert.equal(verified.status, 200); assert.equal(verified.body.status, 'verified'); assert.ok(verified.body.verificationToken, 'a verified refinement carries a token');
  const unverified = await api.refine('faculty', fx.suggestion.id);
  assert.equal(unverified.status, 200); assert.equal(unverified.body.verificationToken, undefined, 'an unverified refinement carries NO token');
  assert.equal((await api.decide('faculty', { suggestionId: fx.suggestion.id, action: 'accept' })).status, 409, 'so it cannot be recorded as accepted');
  assert.equal((await api.decide('faculty', { suggestionId: fx.suggestion.id, action: 'accept', verificationToken: verified.body.verificationToken })).status, 201, 'while the verified one can');
  assert.equal((await api.refine('faculty', 'v2-unknown')).status, 400);
  state.status = 'under_review';
  assert.equal((await api.refine('faculty', fx.suggestion.id)).status, 409, 'no refinement on a locked syllabus');
});

// VR-13 CLARIFICATION (characterization, not a defect): a suggestion that does NOT carry the Policy V2 marker is recorded on Accept without a
// Check & Improve token. Such suggestions exist only for verified judgments (see the next test), but whether Accept should also require a token
// outside Policy V2 is an institutional decision.
test('[VPAA-R13-LEGACY-ACCEPT] CLARIFICATION: outside Policy V2 an Accept is recorded without a verification token', async (t) => {
  h.liveGuard(t);
  const api = await boot(t, { report: { hybrid: { suggestions: [legacySuggestion] } }, state: { status: 'draft', content: {}, masters: {} } });
  const r = await api.decide('faculty', { suggestionId: legacySuggestion.id, action: 'accept' });
  assert.equal(r.status, 201, 'current behaviour: recorded');
  t.diagnostic('requires institutional clarification: should a non-V2 Accept also require Check & Improve?');
});

test('[VPAA-R13-NO-UNVERIFIED-SUGGESTION] a suggestion is only ever created from a verified judgment (Policy V2 and Hybrid-2), so none can be accepted from an unverified one', async (t) => {
  h.liveGuard(t);
  // Policy V2: every answer has a fabricated quotation → nothing verified → no suggestion and no remediation draft.
  const fx = h.sample();
  const v2 = await h.evaluateV2(fx.content, fx.masters, { script: () => ({ label: 'NOT_ALIGNED', sourceQuote: 'NOT IN THE SYLLABUS', targetQuote: 'NOT IN THE SYLLABUS' }) });
  assert.equal(v2.result.academic.suggestions.length, 0, 'V2: no suggestion from unverified answers');
  assert.ok(v2.result.academic.relationships.every((r) => r.recommendedCorrection === null), 'V2: no draft correction either');
  // Hybrid-2: same.
  const hy = h.sample();
  const damaged = h.scriptedTransport(() => ({ label: 'NOT_ALIGNED', sourceQuote: 'NOT IN THE SYLLABUS', targetQuote: 'NOT IN THE SYLLABUS' }));
  const result = await h.engine.run(hy.content, hy.masters, { useAi: true, env: h.envFor({ SYLLABUS_CHECK_ACADEMIC_V2: 'off' }), transport: damaged, linkChecker: async (url) => ({ url, status: 'ok', httpStatus: 200 }) });
  const verifiedIds = new Set(result.hybrid.alignment.judgements.filter((j) => !j.unverified).map((j) => j.id));
  assert.ok(result.hybrid.suggestions.every((s) => s.source === 'rule' || (s.basedOn || []).every((b) => verifiedIds.has(String(b).replace(/^SEM:/, '')))), 'Hybrid-2: every AI suggestion is based on a verified judgment');
  assert.equal(result.hybrid.suggestions.filter((s) => s.source === 'ai').length, 0, 'Hybrid-2: no AI suggestion from unverified answers');
});

// DEF-04 (fixed): the verification token is signed only with a configured SESSION_SECRET of at least 16 characters. There is no fallback, the old public constant is refused
// even when supplied, and without a secret nothing is signed or accepted (fail closed).
test('[VPAA-R13-SECRET] DEF-04 regression: with no configured secret nothing is signed or accepted, and the old public constant is refused even when supplied', () => {
  const crypto = require('node:crypto'), saved = process.env.SESSION_SECRET;
  const payload = { runId: 1, suggestionId: 'x', syllabusId: 1, path: 'p', originalValue: 'a', replacement: 'b', contextHash: '' };
  try {
    delete process.env.SESSION_SECRET;
    assert.throws(() => refine.createVerificationToken(payload), (e) => e.status === 503 && e.code === 'verification_secret_not_configured', 'cannot sign without a secret');
    assert.throws(() => refine.createVerificationToken(payload, 'syllabus-academic-verification-secret'), (e) => e.status === 503, 'the old public constant is refused when supplied');
    assert.throws(() => refine.createVerificationToken(payload, 'too-short'), (e) => e.status === 503, 'a short secret is refused');
    process.env.SESSION_SECRET = 'a-configured-secret-0123456789';
    const token = refine.createVerificationToken(payload);
    assert.equal(refine.verifyVerificationToken(token, { runId: 1 }).valid, true, 'works with a configured secret');
    const body = JSON.parse(Buffer.from(token, 'base64url').toString());
    const forged = Buffer.from(JSON.stringify({ payload: body.payload, sig: crypto.createHmac('sha256', 'syllabus-academic-verification-secret').update(JSON.stringify(body.payload)).digest('hex') })).toString('base64url');
    assert.equal(refine.verifyVerificationToken(forged, { runId: 1 }).valid, false, 'a token forged with the old public constant is refused even when the server has its own secret');
    delete process.env.SESSION_SECRET;
    assert.deepEqual(refine.verifyVerificationToken(token, { runId: 1 }), { valid: false, reason: 'secret_not_configured' }, 'and with no secret on the server even a genuine-looking token is refused');
  } finally { if (saved === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = saved; }
});

test('[VPAA-R13-SECRET-ROUTES] DEF-04 regression: with no secret configured, Check & Improve and a Policy V2 acceptance fail closed (503) and spend nothing; reject and undo still work', async (t) => {
  h.liveGuard(t);
  const fx = v2Fixture();
  const token = tokenFor(fx); // signed while a secret exists
  const api = await boot(t, { report: fx.report, state: { status: 'draft', content: fx.content, masters: fx.masters } });
  const saved = { ...process.env };
  Object.assign(process.env, { SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_MODEL: h.MODEL, SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: h.MODEL, ANTHROPIC_API_KEY: 'sk-ant-conformance-test-only-not-a-real-key' });
  t.after(() => { for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); });
  const refineCalls = t.mock.method(refine, 'refineSuggestion', async () => ({ status: 'verified', text: 'x' }));
  delete process.env.SESSION_SECRET;
  const checked = await api.refine('faculty', fx.suggestion.id);
  assert.equal(checked.status, 503); assert.match(checked.body.error, /SESSION_SECRET/);
  assert.equal(refineCalls.mock.callCount(), 0, 'no AI request is spent when verification cannot be signed');
  const accepted = await api.decide('faculty', { suggestionId: fx.suggestion.id, action: 'accept', verificationToken: token });
  assert.equal(accepted.status, 503); assert.match(accepted.body.error, /SESSION_SECRET/);
  assert.equal(api.log.decisions.length, 0, 'nothing is recorded as accepted');
  for (const action of ['reject', 'undo']) assert.equal((await api.decide('faculty', { suggestionId: fx.suggestion.id, action })).status, 201, `${action} needs no token and still works`);
  process.env.SESSION_SECRET = 'conformance-test-secret-0123456789';
  assert.equal((await api.decide('faculty', { suggestionId: fx.suggestion.id, action: 'accept', verificationToken: token })).status, 201, 'with the secret restored the same token is accepted');
});
