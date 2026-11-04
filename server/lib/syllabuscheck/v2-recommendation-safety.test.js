'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { pathToFileURL } = require('node:url');

const repo = require('./repository');
const { sample } = require('./fixtures');
const { NEMOTRON_FREE } = require('./gemini');
const { POLICY } = require('./academicV2Plan');
const refine = require('./refine');
const { refineSuggestion, createVerificationToken, verifyVerificationToken, relatedContextHash } = refine;
const activity = require('../activity');
const { hybridEn, hybridTl } = require('../../../src/i18n/hybrid');
const { academicV2En, academicV2Tl } = require('../../../src/i18n/academicV2');

const TEST_ENV = {
  SYLLABUS_CHECK_AI_PROVIDER: 'openrouter',
  OPENROUTER_API_KEY: 'test-only-router-key',
  OPENROUTER_MODEL: NEMOTRON_FREE
};

async function loadHybridCheck() {
  const filePath = path.resolve(__dirname, '../../../src/lib/hybridCheck.js');
  return import(pathToFileURL(filePath).href);
}

async function createSafetyHarness(t, { syllabusStatus = 'draft', initialReport = null, initialContent = null } = {}) {
  const savedEnv = {};
  for (const [k, v] of Object.entries(TEST_ENV)) {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  }
  t.after(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  const { content: defaultContent, masters } = sample();
  const content = initialContent || structuredClone(defaultContent);

  const decisionsDb = [];
  const activityLogs = [];
  let nextDecisionId = 1;

  const app = express();
  app.use(express.json());

  app.locals.db = {
    query: async (sql, params = []) => {
      if (sql.startsWith('SELECT user_id FROM users')) {
        return [[{ user_id: params[0] }]];
      }
      if (sql.startsWith('SELECT s.*, r.run_id')) {
        return [[{
          syllabus_id: 100,
          user_id: 26,
          status: syllabusStatus,
          content: JSON.stringify(content)
        }]];
      }
      if (sql.startsWith('SELECT decision_id AS id')) {
        return [decisionsDb.filter(d => d.run_id === params[0])];
      }
      if (sql.startsWith('INSERT INTO syllabus_check_decisions')) {
        const id = nextDecisionId++;
        const row = {
          decision_id: id,
          id,
          run_id: params[0],
          suggestion_id: params[1],
          suggestionId: params[1],
          action: params[2],
          edited_text: params[3],
          editedText: params[3],
          user_id: params[4],
          userId: params[4],
          created_at: new Date().toISOString()
        };
        decisionsDb.push(row);
        return [{ insertId: id, affectedRows: 1 }];
      }
      if (sql.startsWith('INSERT INTO submission_logs')) {
        activityLogs.push({
          syllabus_id: params[0],
          user_id: params[1],
          action: params[2],
          notes: params[3]
        });
        return [{ insertId: activityLogs.length, affectedRows: 1 }];
      }
      if (sql.startsWith('INSERT INTO')) {
        return [{ insertId: 1, affectedRows: 1 }];
      }
      throw new Error('Unhandled query in mock db: ' + sql);
    }
  };

  let report = initialReport;
  t.mock.method(repo, 'readReport', async () => report);
  t.mock.method(repo, 'mastersFor', async () => masters);

  app.use((req, res, next) => {
    const roleHeader = req.headers['x-test-role'];
    if (roleHeader === 'admin') {
      req.session = { user: { id: 1, role: 'admin' } };
    } else if (roleHeader === 'faculty') {
      req.session = { user: { id: 26, role: 'faculty' } };
    } else if (roleHeader === 'other_faculty') {
      req.session = { user: { id: 99, role: 'faculty' } };
    } else {
      req.session = {};
    }
    next();
  });

  delete require.cache[require.resolve('../../routes/syllabusCheck')];
  app.use('/api/syllabus-check', require('../../routes/syllabusCheck'));

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const base = `http://127.0.0.1:${server.address().port}/api/syllabus-check`;

  const request = (pathStr, { method = 'GET', role = 'faculty', body = null } = {}) => new Promise((resolve, reject) => {
    const headers = {};
    if (role) headers['x-test-role'] = role;
    let payload = null;
    if (body) {
      payload = JSON.stringify(body);
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(payload);
    }
    const req = http.request(base + pathStr, { method, headers }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = data ? JSON.parse(data) : null; } catch { json = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

  return {
    content,
    masters,
    request,
    decisionsDb,
    activityLogs,
    setReport: (r) => { report = r; }
  };
}

// -----------------------------------------------------------------------------
// 1. Apply without verification -> Blocked (409)
// -----------------------------------------------------------------------------
test('Requirement 1: Apply without verification is blocked with 409', async (t) => {
  const { content, request, setReport } = await createSafetyHarness(t);
  const suggestion = {
    id: 'v2:test-sugg',
    path: 'plan[2].contents',
    originalValue: content.plan[2].contents,
    replacement: 'New verified content',
    source: 'ai',
    policy: POLICY.id
  };
  setReport({ hybrid: { suggestions: [suggestion] } });

  // Direct decision call without verificationToken
  const res = await request('/runs/1/decisions', {
    method: 'POST',
    role: 'faculty',
    body: { suggestionId: suggestion.id, action: 'accept' }
  });
  assert.equal(res.status, 409);
  assert.match(res.body.error, /verified with Check & Improve/);
});

// -----------------------------------------------------------------------------
// 2. Apply after verified Check & Improve -> Allowed (201)
// -----------------------------------------------------------------------------
test('Requirement 2: Apply after verified Check & Improve is allowed with 201', async (t) => {
  const { content, masters, request, setReport, decisionsDb } = await createSafetyHarness(t);
  const orig = content.plan[2].contents;
  const suggestion = {
    id: 'v2:test-sugg',
    path: 'plan[2].contents',
    originalValue: orig,
    replacement: 'Verified improvement text',
    source: 'ai',
    policy: POLICY.id
  };
  setReport({ hybrid: { suggestions: [suggestion] } });

  const contextHash = relatedContextHash(content, masters, suggestion.path);
  const verificationToken = createVerificationToken({
    runId: 1,
    suggestionId: suggestion.id,
    syllabusId: 100,
    path: suggestion.path,
    originalValue: orig,
    replacement: suggestion.replacement,
    contextHash
  });

  const res = await request('/runs/1/decisions', {
    method: 'POST',
    role: 'faculty',
    body: { suggestionId: suggestion.id, action: 'accept', verificationToken }
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.action, 'accept');
  assert.equal(decisionsDb.length, 1);
  assert.equal(decisionsDb[0].action, 'accept');
});

// -----------------------------------------------------------------------------
// 3. Apply after blocked Check & Improve -> Blocked
// -----------------------------------------------------------------------------
test('Requirement 3: Apply after blocked Check & Improve produces no token and is blocked', async (t) => {
  const { content, request, setReport } = await createSafetyHarness(t);
  const orig = content.plan[2].contents;
  const suggestion = {
    id: 'v2:test-sugg',
    path: 'plan[2].contents',
    originalValue: orig,
    replacement: 'Worsening candidate text',
    source: 'ai',
    policy: POLICY.id
  };
  setReport({ hybrid: { suggestions: [suggestion] } });

  // Mock refine to return blocked
  t.mock.method(refine, 'refineSuggestion', async () => ({
    status: 'blocked',
    usedRewrite: false,
    text: suggestion.replacement,
    stats: { checked: 3, improved: 0, worse: 1, same: 2 },
    blockers: [{ id: 'pair-1', type: 'CONTENT_COURSE', from: 'ALIGNED', to: 'NOT_ALIGNED' }]
  }));

  const refineRes = await request(`/runs/1/suggestions/${suggestion.id}/refine`, {
    method: 'POST',
    role: 'faculty'
  });
  assert.equal(refineRes.status, 200);
  assert.equal(refineRes.body.status, 'blocked');
  assert.equal(refineRes.body.verificationToken, undefined, 'Blocked check must never yield a verification token');

  // Attempting to accept with undefined or empty token must fail
  const acceptRes = await request('/runs/1/decisions', {
    method: 'POST',
    role: 'faculty',
    body: { suggestionId: suggestion.id, action: 'accept', verificationToken: refineRes.body.verificationToken }
  });
  assert.equal(acceptRes.status, 409);
});

// -----------------------------------------------------------------------------
// 4. Edit correction after verification -> Requires re-verification
// -----------------------------------------------------------------------------
test('Requirement 4: Editing text after verification invalidates token and requires re-verification', async (t) => {
  const { content, masters, request, setReport } = await createSafetyHarness(t);
  const orig = content.plan[2].contents;
  const suggestion = {
    id: 'v2:test-sugg',
    path: 'plan[2].contents',
    originalValue: orig,
    replacement: 'Verified text A',
    source: 'ai',
    policy: POLICY.id
  };
  setReport({ hybrid: { suggestions: [suggestion] } });

  // Token was issued for "Verified text A"
  const contextHashA = relatedContextHash(content, masters, suggestion.path);
  const tokenForA = createVerificationToken({
    runId: 1,
    suggestionId: suggestion.id,
    syllabusId: 100,
    path: suggestion.path,
    originalValue: orig,
    replacement: 'Verified text A',
    contextHash: contextHashA
  });

  // Faculty modifies text to "Custom text B" but submits with token for A
  const editRes = await request('/runs/1/decisions', {
    method: 'POST',
    role: 'faculty',
    body: { suggestionId: suggestion.id, action: 'edit', editedText: 'Custom text B', verificationToken: tokenForA }
  });
  assert.equal(editRes.status, 409);
  assert.match(editRes.body.error, /verified with Check & Improve/);
});

// -----------------------------------------------------------------------------
// 5. Change underlying syllabus after verification -> Old verification invalid
// -----------------------------------------------------------------------------
test('Requirement 5: Modifying underlying syllabus after check invalidates verification', async (t) => {
  const { content, masters, request, setReport } = await createSafetyHarness(t);
  const orig = content.plan[2].contents;
  const suggestion = {
    id: 'v2:test-sugg',
    path: 'plan[2].contents',
    originalValue: orig,
    replacement: 'Verified text',
    source: 'ai',
    policy: POLICY.id
  };
  setReport({ hybrid: { suggestions: [suggestion] } });

  const contextHash = relatedContextHash(content, masters, suggestion.path);
  const token = createVerificationToken({
    runId: 1,
    suggestionId: suggestion.id,
    syllabusId: 100,
    path: suggestion.path,
    originalValue: orig,
    replacement: 'Verified text',
    contextHash
  });

  // Change underlying syllabus content to something else before applying
  content.plan[2].contents = 'External manual author modification';

  const res = await request('/runs/1/decisions', {
    method: 'POST',
    role: 'faculty',
    body: { suggestionId: suggestion.id, action: 'accept', verificationToken: token }
  });
  assert.equal(res.status, 409);
  assert.match(res.body.error, /changed in the syllabus/);
});

// -----------------------------------------------------------------------------
// 6. Direct API attempts cannot bypass applicable server protections
// -----------------------------------------------------------------------------
test('Requirement 6: Direct API calls with forged or cross-suggestion tokens are rejected', async (t) => {
  const { content, masters, request, setReport } = await createSafetyHarness(t);
  const orig = content.plan[2].contents;
  const suggestion1 = { id: 'v2:sugg-1', path: 'plan[2].contents', originalValue: orig, replacement: 'Text 1', source: 'ai', policy: POLICY.id };
  const suggestion2 = { id: 'v2:sugg-2', path: 'plan[2].contents', originalValue: orig, replacement: 'Text 2', source: 'ai', policy: POLICY.id };
  setReport({ hybrid: { suggestions: [suggestion1, suggestion2] } });

  const contextHash1 = relatedContextHash(content, masters, suggestion1.path);
  const token1 = createVerificationToken({
    runId: 1,
    suggestionId: suggestion1.id,
    syllabusId: 100,
    path: suggestion1.path,
    originalValue: orig,
    replacement: suggestion1.replacement,
    contextHash: contextHash1
  });

  // Attempt to use token1 on suggestion2
  const bypassRes = await request('/runs/1/decisions', {
    method: 'POST',
    role: 'faculty',
    body: { suggestionId: suggestion2.id, action: 'accept', verificationToken: token1 }
  });
  assert.equal(bypassRes.status, 409);

  // Attempt with forged token
  const forgedRes = await request('/runs/1/decisions', {
    method: 'POST',
    role: 'faculty',
    body: { suggestionId: suggestion1.id, action: 'accept', verificationToken: 'eyJhbGciOiJIUzI1NiJ9.forged.signature' }
  });
  assert.equal(forgedRes.status, 409);
});

// -----------------------------------------------------------------------------
// 7. Provider unavailable -> No false academic verification
// -----------------------------------------------------------------------------
test('Requirement 7: Provider failure during refine returns 502 with no verification', async (t) => {
  const { content, request, setReport } = await createSafetyHarness(t);
  const suggestion = { id: 'v2:sugg-fail', path: 'plan[2].contents', originalValue: content.plan[2].contents, replacement: 'Some text', source: 'ai', policy: POLICY.id };
  setReport({ hybrid: { suggestions: [suggestion] } });

  t.mock.method(refine, 'refineSuggestion', async () => {
    throw Object.assign(new Error('AI transport connection failed'), { status: 502 });
  });

  const refineRes = await request(`/runs/1/suggestions/${suggestion.id}/refine`, {
    method: 'POST',
    role: 'faculty'
  });
  assert.equal(refineRes.status, 502);
  assert.equal(refineRes.body.verificationToken, undefined);
});

// -----------------------------------------------------------------------------
// 8. Reject without verification -> Allowed
// -----------------------------------------------------------------------------
test('Requirement 8: Reject without AI verification is immediately allowed', async (t) => {
  const { content, request, setReport, decisionsDb, activityLogs } = await createSafetyHarness(t);
  const suggestion = { id: 'v2:sugg-reject', path: 'plan[2].contents', originalValue: content.plan[2].contents, replacement: 'Unwanted text', source: 'ai', policy: POLICY.id };
  setReport({ hybrid: { suggestions: [suggestion] } });

  const res = await request('/runs/1/decisions', {
    method: 'POST',
    role: 'faculty',
    body: { suggestionId: suggestion.id, action: 'reject' }
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.action, 'reject');
  assert.equal(res.body.draft, null);
  assert.equal(decisionsDb.at(-1).action, 'reject');
  assert.equal(activityLogs.at(-1).notes, 'Rejected recommendation: plan[2].contents');
});

// -----------------------------------------------------------------------------
// 9. Undo after Accept -> Correct restoration and audit event
// -----------------------------------------------------------------------------
test('Requirement 9: Undo after Accept restores original draft and logs distinct undo event', async (t) => {
  const { undoSuggestion } = await loadHybridCheck();
  const { content, request, setReport, decisionsDb, activityLogs } = await createSafetyHarness(t);
  const origText = 'Original author syllabus text';
  content.plan[2].contents = 'Applied accepted rewrite';

  const suggestion = {
    id: 'v2:sugg-undo',
    path: 'plan[2].contents',
    originalValue: origText,
    replacement: 'Applied accepted rewrite',
    source: 'ai',
    policy: POLICY.id
  };
  setReport({ hybrid: { suggestions: [suggestion] } });

  let appliedPatch = null;
  const applyDraft = async (patch) => {
    appliedPatch = patch;
    content.plan[2].contents = patch.replacement;
    return true;
  };

  const recordDecision = async (body) => {
    const res = await request('/runs/1/decisions', { method: 'POST', role: 'faculty', body });
    assert.equal(res.status, 201);
    return res.body;
  };

  const undoResult = await undoSuggestion({
    suggestion,
    appliedValue: 'Applied accepted rewrite',
    applyDraft,
    recordDecision
  });

  assert.equal(undoResult.action, 'undo');
  assert.equal(appliedPatch.replacement, origText);
  assert.equal(content.plan[2].contents, origText);
  assert.equal(decisionsDb.at(-1).action, 'undo');
  assert.equal(activityLogs.at(-1).notes, 'Undid recommendation: plan[2].contents');
});

// -----------------------------------------------------------------------------
// 10. Undo after Edit -> Correct restoration and audit event
// -----------------------------------------------------------------------------
test('Requirement 10: Undo after Edit restores original draft and logs distinct undo event', async (t) => {
  const { undoSuggestion } = await loadHybridCheck();
  const { content, request, setReport, decisionsDb, activityLogs } = await createSafetyHarness(t);
  const origText = 'Original author syllabus text';
  const customEdit = 'Custom faculty edit text';
  content.plan[2].contents = customEdit;

  const suggestion = {
    id: 'v2:sugg-undo-edit',
    path: 'plan[2].contents',
    originalValue: origText,
    replacement: 'Original AI proposal',
    source: 'ai',
    policy: POLICY.id
  };
  setReport({ hybrid: { suggestions: [suggestion] } });

  let appliedPatch = null;
  const applyDraft = async (patch) => {
    appliedPatch = patch;
    content.plan[2].contents = patch.replacement;
    return true;
  };

  const recordDecision = async (body) => {
    const res = await request('/runs/1/decisions', { method: 'POST', role: 'faculty', body });
    assert.equal(res.status, 201);
    return res.body;
  };

  const undoResult = await undoSuggestion({
    suggestion,
    appliedValue: customEdit,
    applyDraft,
    recordDecision
  });

  assert.equal(undoResult.action, 'undo');
  assert.equal(appliedPatch.replacement, origText);
  assert.equal(content.plan[2].contents, origText);
  assert.equal(decisionsDb.at(-1).action, 'undo');
  assert.equal(activityLogs.at(-1).notes, 'Undid recommendation: plan[2].contents');
});

// -----------------------------------------------------------------------------
// 11. Existing historical Reject decisions remain compatible
// -----------------------------------------------------------------------------
test('Requirement 11: Historical reject decisions in DB are returned and remain readable', async (t) => {
  const { request, setReport, decisionsDb } = await createSafetyHarness(t);
  const suggestion = { id: 'v2:sugg-hist', path: 'plan[2].contents', source: 'ai' };
  setReport({ hybrid: { suggestions: [suggestion] } });

  decisionsDb.push({
    decision_id: 10,
    run_id: 1,
    suggestion_id: suggestion.id,
    suggestionId: suggestion.id,
    action: 'reject',
    edited_text: null,
    user_id: 26,
    created_at: new Date('2026-10-15T10:00:00.000Z').toISOString()
  });

  const getRes = await request('/runs/1/decisions', { method: 'GET', role: 'faculty' });
  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.length, 1);
  assert.equal(getRes.body[0].action, 'reject');
  assert.equal(getRes.body[0].suggestionId, suggestion.id);
});

// -----------------------------------------------------------------------------
// 12. Duplicate submission or retry -> No duplicate application
// -----------------------------------------------------------------------------
test('Requirement 12: Idempotent applySuggestion prevents duplicate application on retry', async (t) => {
  const { applySuggestion } = await loadHybridCheck();
  const { content } = await createSafetyHarness(t);
  const orig = content.plan[2].contents;
  const suggestion = {
    id: 'v2:sugg-idem',
    path: 'plan[2].contents',
    originalValue: orig,
    replacement: 'Applied target text'
  };

  // First apply: updates draft
  const draft1 = applySuggestion(content, suggestion, { requireOriginal: true });
  assert.equal(draft1.plan[2].contents, 'Applied target text');

  // Second apply on already-updated draft (retry): succeeds idempotently
  const draft2 = applySuggestion(draft1, suggestion, { requireOriginal: true });
  assert.equal(draft2.plan[2].contents, 'Applied target text');
});

// -----------------------------------------------------------------------------
// 13. Legacy recommendation behavior remains unchanged
// -----------------------------------------------------------------------------
test('Requirement 13: Legacy recommendations allow direct accept without verification token', async (t) => {
  const { content, request, setReport, decisionsDb } = await createSafetyHarness(t);
  const legacySuggestion = {
    id: 'SEM:legacy-pair',
    path: 'plan[2].contents',
    originalValue: content.plan[2].contents,
    replacement: 'Legacy improved content',
    source: 'ai'
    // Note: No policy flag and report has no academicV2
  };
  setReport({ hybrid: { suggestions: [legacySuggestion] } });

  // Direct accept without verificationToken succeeds for legacy
  const res = await request('/runs/1/decisions', {
    method: 'POST',
    role: 'faculty',
    body: { suggestionId: legacySuggestion.id, action: 'accept' }
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.action, 'accept');
  assert.equal(decisionsDb.at(-1).action, 'accept');
});

// -----------------------------------------------------------------------------
// 14. English/Tagalog UI remains functional
// -----------------------------------------------------------------------------
test('Requirement 14: English and Tagalog UI keys are fully defined for undo and verify', () => {
  assert.equal(hybridEn['hybrid.decision.undo'], 'Undone');
  assert.equal(hybridTl['hybrid.decision.undo'], 'Pinawalang-bisa');
  assert.ok(academicV2En['academicV2.verifyFirst']);
  assert.ok(academicV2Tl['academicV2.verifyFirst']);

  const verbEn = activity.decisionNote('undo', 'plan[0].ilo');
  assert.equal(verbEn, 'Undid recommendation: plan[0].ilo');

  const rejectEn = activity.decisionNote('reject', 'plan[0].ilo');
  assert.equal(rejectEn, 'Rejected recommendation: plan[0].ilo');
});

// -----------------------------------------------------------------------------
// Targeted Check 1A: Modifying a related Learning Activity invalidates prior ILO verification
// -----------------------------------------------------------------------------
test('Targeted Check 1A: Modifying a related Learning Activity invalidates prior ILO verification', async (t) => {
  const { content, masters, request, setReport } = await createSafetyHarness(t);
  const iloPath = 'plan[2].ilos[0].text';
  const origIlo = content.plan[2].ilos[0].text;
  const suggestion = {
    id: 'v2:ilo-w3-sugg',
    path: iloPath,
    originalValue: origIlo,
    replacement: 'Demonstrate advanced programming concepts in clinical software',
    source: 'ai',
    policy: POLICY.id
  };
  setReport({ hybrid: { suggestions: [suggestion] } });

  // 1. Compute contextHash before modifying Learning Activity
  const initialContextHash = relatedContextHash(content, masters, iloPath);
  const verificationToken = createVerificationToken({
    runId: 1,
    suggestionId: suggestion.id,
    syllabusId: 100,
    path: iloPath,
    originalValue: origIlo,
    replacement: suggestion.replacement,
    contextHash: initialContextHash
  });

  // 2. Faculty modifies related Learning Activity without touching the target ILO
  content.plan[2].activities = 'Write a comprehensive unit test suite and refactor codebase';

  // 3. Faculty attempts to apply the previously verified ILO correction
  const res = await request('/runs/1/decisions', {
    method: 'POST',
    role: 'faculty',
    body: { suggestionId: suggestion.id, action: 'accept', verificationToken }
  });

  // Must be rejected with 409 because related academic context has changed
  assert.equal(res.status, 409);
  assert.match(res.body.error, /Related academic content changed/);
});

// -----------------------------------------------------------------------------
// Targeted Check 1B: Modifying an UNRELATED field does NOT invalidate verification
// -----------------------------------------------------------------------------
test('Targeted Check 1B: Modifying an UNRELATED field does NOT invalidate verification', async (t) => {
  const { content, masters, request, setReport, decisionsDb } = await createSafetyHarness(t);
  const iloPath = 'plan[2].ilos[0].text';
  const origIlo = content.plan[2].ilos[0].text;
  const suggestion = {
    id: 'v2:ilo-w3-sugg-unrelated',
    path: iloPath,
    originalValue: origIlo,
    replacement: 'Demonstrate advanced programming concepts in clinical software',
    source: 'ai',
    policy: POLICY.id
  };
  setReport({ hybrid: { suggestions: [suggestion] } });

  const initialContextHash = relatedContextHash(content, masters, iloPath);
  const verificationToken = createVerificationToken({
    runId: 1,
    suggestionId: suggestion.id,
    syllabusId: 100,
    path: iloPath,
    originalValue: origIlo,
    replacement: suggestion.replacement,
    contextHash: initialContextHash
  });

  // Faculty modifies an UNRELATED field: meta.title and plan[0].activities in Week 1
  content.meta.title = 'Updated Title That Does Not Affect Week 3 ILO';
  content.plan[0].activities = 'Orientation and syllabus review in Week 1';

  // Attempt to apply the verified correction
  const res = await request('/runs/1/decisions', {
    method: 'POST',
    role: 'faculty',
    body: { suggestionId: suggestion.id, action: 'accept', verificationToken }
  });

  // Must succeed because Week 3 ILO relationships are completely unaffected
  assert.equal(res.status, 201);
  assert.equal(res.body.action, 'accept');
  assert.equal(decisionsDb.length, 1);
});

// -----------------------------------------------------------------------------
// Targeted Check 1C: Token expiration enforces 15-minute TTL
// -----------------------------------------------------------------------------
test('Targeted Check 1C: Token expiration enforces 15-minute TTL', async (t) => {
  const { content, masters, request, setReport } = await createSafetyHarness(t);
  const orig = content.plan[2].contents;
  const suggestion = {
    id: 'v2:expired-sugg',
    path: 'plan[2].contents',
    originalValue: orig,
    replacement: 'Verified text with expired token',
    source: 'ai',
    policy: POLICY.id
  };
  setReport({ hybrid: { suggestions: [suggestion] } });

  const contextHash = relatedContextHash(content, masters, suggestion.path);
  // Create an expired token (ttlMs: -1000)
  const expiredToken = createVerificationToken({
    runId: 1,
    suggestionId: suggestion.id,
    syllabusId: 100,
    path: suggestion.path,
    originalValue: orig,
    replacement: suggestion.replacement,
    contextHash,
    ttlMs: -1000
  });

  const res = await request('/runs/1/decisions', {
    method: 'POST',
    role: 'faculty',
    body: { suggestionId: suggestion.id, action: 'accept', verificationToken: expiredToken }
  });

  assert.equal(res.status, 409);
  assert.match(res.body.error, /Verification token has expired/);
});

// -----------------------------------------------------------------------------
// Targeted Check 1D: Replay protection prevents token reuse
// -----------------------------------------------------------------------------
test('Targeted Check 1D: Replay protection prevents token reuse', async (t) => {
  const { content, masters, request, setReport, decisionsDb } = await createSafetyHarness(t);
  const orig = content.plan[2].contents;
  const suggestion = {
    id: 'v2:replay-sugg',
    path: 'plan[2].contents',
    originalValue: orig,
    replacement: 'Verified text for replay test',
    source: 'ai',
    policy: POLICY.id
  };
  setReport({ hybrid: { suggestions: [suggestion] } });

  const contextHash = relatedContextHash(content, masters, suggestion.path);
  const token = createVerificationToken({
    runId: 1,
    suggestionId: suggestion.id,
    syllabusId: 100,
    path: suggestion.path,
    originalValue: orig,
    replacement: suggestion.replacement,
    contextHash
  });

  // 1. First acceptance succeeds
  const firstRes = await request('/runs/1/decisions', {
    method: 'POST',
    role: 'faculty',
    body: { suggestionId: suggestion.id, action: 'accept', verificationToken: token }
  });
  assert.equal(firstRes.status, 201);
  assert.equal(decisionsDb.length, 1);

  // 2. Faculty undoes the recommendation
  const undoRes = await request('/runs/1/decisions', {
    method: 'POST',
    role: 'faculty',
    body: { suggestionId: suggestion.id, action: 'undo' }
  });
  assert.equal(undoRes.status, 201);
  assert.equal(decisionsDb.length, 2);

  // 3. Faculty attempts to re-apply using the exact same consumed verification token
  const replayRes = await request('/runs/1/decisions', {
    method: 'POST',
    role: 'faculty',
    body: { suggestionId: suggestion.id, action: 'accept', verificationToken: token }
  });
  assert.equal(replayRes.status, 409);
  assert.match(replayRes.body.error, /already been applied/);
});

// -----------------------------------------------------------------------------
// Targeted Check 2: Undo removes recommendation from active applied corrections in correctionHistory
// -----------------------------------------------------------------------------
test('Targeted Check 2: Undo removes recommendation from active applied corrections in correctionHistory', async () => {
  const { correctionHistory } = repo;
  const s = { id: 'SEM:r0-act', path: 'plan[0].activities', source: 'ai', basedOn: ['SEM:r0-act'], replacement: 'Improved activity' };
  
  // Fake DB with run 11 and run 12
  const fakeDbWithDecisions = (decisions) => ({
    query: async (sql, params) => {
      if (sql.startsWith('SELECT r.run_id')) {
        return [[
          { run_id: 12, report_json: JSON.stringify({ hybrid: { alignment: { judgements: [{ id: 'r0-act', label: 'PARTIALLY_ALIGNED' }] }, suggestions: [s] } }) },
          { run_id: 11, report_json: JSON.stringify({ hybrid: { alignment: { judgements: [{ id: 'r0-act', label: 'PARTIALLY_ALIGNED' }] }, suggestions: [s] } }) }
        ]];
      }
      if (sql.startsWith('SELECT run_id, suggestion_id')) {
        return [decisions];
      }
      return [[]];
    }
  });

  // State 1: Run 11 accepted, Run 12 accepted -> attempts = 2
  const dbBeforeUndo = fakeDbWithDecisions([
    { decision_id: 1, run_id: 11, suggestion_id: 'SEM:r0-act', action: 'accept' },
    { decision_id: 2, run_id: 12, suggestion_id: 'SEM:r0-act', action: 'accept' }
  ]);
  const hBefore = await correctionHistory(dbBeforeUndo, 1);
  assert.equal(hBefore.attempts['plan[0].activities'], 2);

  // State 2: Run 12 is undid with action: 'undo' -> attempts drops to 1 (only run 11 counts)
  const dbAfterUndo = fakeDbWithDecisions([
    { decision_id: 1, run_id: 11, suggestion_id: 'SEM:r0-act', action: 'accept' },
    { decision_id: 2, run_id: 12, suggestion_id: 'SEM:r0-act', action: 'accept' },
    { decision_id: 3, run_id: 12, suggestion_id: 'SEM:r0-act', action: 'undo' }
  ]);
  const hAfter = await correctionHistory(dbAfterUndo, 1);
  assert.equal(hAfter.attempts['plan[0].activities'], 1, 'Run 12 was undone, so only run 11 remains an active applied correction');
  assert.deepEqual(hAfter.last['plan[0].activities'].runId, 11);

  // State 3: Both run 11 and run 12 are undone -> attempts is 0 / empty
  const dbAllUndone = fakeDbWithDecisions([
    { decision_id: 1, run_id: 11, suggestion_id: 'SEM:r0-act', action: 'accept' },
    { decision_id: 2, run_id: 12, suggestion_id: 'SEM:r0-act', action: 'accept' },
    { decision_id: 3, run_id: 12, suggestion_id: 'SEM:r0-act', action: 'undo' },
    { decision_id: 4, run_id: 11, suggestion_id: 'SEM:r0-act', action: 'undo' }
  ]);
  const hAllUndone = await correctionHistory(dbAllUndone, 1);
  assert.equal(hAllUndone.attempts['plan[0].activities'], undefined, 'All corrections were undone; zero active applied corrections remain');
});
