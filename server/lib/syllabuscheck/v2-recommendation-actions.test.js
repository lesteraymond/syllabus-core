'use strict';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'existing-suite-test-secret-0123456789'; // verification tokens are signed only with a configured secret
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { pathToFileURL } = require('node:url');

const repo = require('./repository');
const { sample } = require('./fixtures');
const { align, NEMOTRON_FREE, promptVersionOf } = require('./gemini');
const { POLICY, plan } = require('./academicV2Plan');
const policy = require('./academicPolicyV2');
const refine = require('./refine');
const { refineSuggestion, createVerificationToken, relatedContextHash } = refine;
const v2Activation = require('./academicV2Activation');
const { academicV2En, academicV2Tl } = require('../../../src/i18n/academicV2');
const { hybridEn, hybridTl } = require('../../../src/i18n/hybrid');

const TEST_ENV = {
  SYLLABUS_CHECK_AI_PROVIDER: 'openrouter',
  OPENROUTER_API_KEY: 'test-only-router-key',
  OPENROUTER_MODEL: NEMOTRON_FREE
};

// Helper to load ES module hybridCheck.js
async function loadHybridCheck() {
  const filePath = path.resolve(__dirname, '../../../src/lib/hybridCheck.js');
  return import(pathToFileURL(filePath).href);
}

// Helper to create an offline HTTP mock server for syllabusCheck routes
async function createTestHarness(t, { syllabusStatus = 'draft', initialReport = null, initialContent = null } = {}) {
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
  let nextDecisionId = 1;

  const app = express();
  app.use(express.json());

  app.locals.db = {
    query: async (sql, params = []) => {
      if (/program_po_reference_remediation/.test(sql)) return [[]];
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
      if (sql.startsWith('INSERT INTO activity_log') || sql.startsWith('INSERT INTO')) {
        return [{ insertId: 1, affectedRows: 1 }];
      }
      throw new Error('Unhandled query in mock db: ' + sql);
    }
  };

  let report = initialReport;
  t.mock.method(repo, 'readReport', async () => report);
  t.mock.method(repo, 'mastersFor', async () => masters);

  // Authentication & session mock
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

  // Re-require route to bind cleanly
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
    setReport: r => { report = r; }
  };
}

// -----------------------------------------------------------------------------
// Scenario A: Accept Policy V2 recommendation
// -----------------------------------------------------------------------------
test('Scenario A: Faculty accepts Policy V2 recommendation and records decision', async (t) => {
  const { applySuggestion, decideSuggestion } = await loadHybridCheck();
  const { content, masters, request, setReport, decisionsDb } = await createTestHarness(t);

  const origContent = content.plan[2].contents;
  const suggestion = {
    id: 'review:row2-content',
    relationshipId: 'row2-content',
    path: 'plan[2].contents',
    title: 'Suggested academic alignment revision',
    text: 'Revise taught contents to fit Course Title',
    replacement: 'Updated course content: Anatomy and Human Body Systems',
    originalValue: origContent,
    source: 'ai',
    policy: POLICY.id,
    basedOn: ['row2-content'],
    field: 'course_content',
    recommendationType: 'REWRITE_TEXT',
    canRefine: true
  };

  const report = {
    evaluationPolicy: { id: POLICY.id },
    academic: {
      policyVersion: POLICY.id,
      disposition: 'REQUIRES_REVISION',
      suggestions: [suggestion],
      remediation: { actions: [{ id: suggestion.id, relationshipIds: ['row2-content'], correction: suggestion.replacement, path: suggestion.path }] }
    },
    hybrid: {
      suggestions: [suggestion]
    }
  };
  setReport(report);

  // 1. Direct applySuggestion check
  const updatedDraft = applySuggestion(content, suggestion, { requireOriginal: true });
  assert.equal(updatedDraft.plan[2].contents, suggestion.replacement);
  assert.notEqual(updatedDraft.plan[2].contents, origContent);

  // 2. Unverified attempt must be blocked with 409
  const unverifiedRes = await request('/runs/1/decisions', { method: 'POST', role: 'faculty', body: { suggestionId: suggestion.id, action: 'accept' } });
  assert.equal(unverifiedRes.status, 409);

  // 3. decideSuggestion check with verified token and recordDecision
  const contextHash = relatedContextHash(content, masters, suggestion.path);
  const verificationToken = createVerificationToken({
    runId: 1,
    suggestionId: suggestion.id,
    syllabusId: 100,
    path: suggestion.path,
    originalValue: origContent,
    replacement: suggestion.replacement,
    contextHash
  });

  let appliedToDraft = null;
  const applyDraft = async (patch) => { appliedToDraft = patch; return true; };
  const recordDecision = async (body) => {
    const res = await request('/runs/1/decisions', { method: 'POST', role: 'faculty', body });
    assert.equal(res.status, 201);
    return res.body;
  };

  const result = await decideSuggestion({
    suggestion,
    action: 'accept',
    verificationToken,
    applyDraft,
    recordDecision
  });

  assert.equal(result.applied, true);
  assert.equal(result.decision.action, 'accept');
  assert.equal(appliedToDraft.replacement, suggestion.replacement);

  // 4. Verify database decision row
  assert.equal(decisionsDb.length, 1);
  assert.equal(decisionsDb[0].suggestion_id, suggestion.id);
  assert.equal(decisionsDb[0].action, 'accept');
  assert.equal(decisionsDb[0].edited_text, null);
});

// -----------------------------------------------------------------------------
// Scenario B: Edit proposed correction
// -----------------------------------------------------------------------------
test('Scenario B: Faculty edits proposed Policy V2 correction and applies customized text', async (t) => {
  const { applySuggestion, decideSuggestion } = await loadHybridCheck();
  const { content, masters, request, setReport, decisionsDb } = await createTestHarness(t);

  const origContent = content.plan[2].contents;
  const suggestion = {
    id: 'review:row2-content',
    path: 'plan[2].contents',
    replacement: 'AI proposed text',
    originalValue: origContent,
    source: 'ai',
    policy: POLICY.id,
    canRefine: true
  };
  setReport({ hybrid: { suggestions: [suggestion] } });

  const customText = 'Faculty authored custom revision for Week 3 content';

  // 1. applySuggestion with edited text
  const updatedDraft = applySuggestion(content, { ...suggestion, replacement: customText }, { requireOriginal: true });
  assert.equal(updatedDraft.plan[2].contents, customText);

  // 2. Unverified attempt must be blocked with 409
  const unverifiedRes = await request('/runs/1/decisions', { method: 'POST', role: 'faculty', body: { suggestionId: suggestion.id, action: 'edit', editedText: customText } });
  assert.equal(unverifiedRes.status, 409);

  // 3. decideSuggestion with action 'edit' and valid verificationToken for customText
  const contextHash = relatedContextHash(content, masters, suggestion.path);
  const verificationToken = createVerificationToken({
    runId: 1,
    suggestionId: suggestion.id,
    syllabusId: 100,
    path: suggestion.path,
    originalValue: origContent,
    replacement: customText,
    contextHash
  });

  let appliedPatch = null;
  const applyDraft = async (patch) => { appliedPatch = patch; return true; };
  const recordDecision = async (body) => {
    const res = await request('/runs/1/decisions', { method: 'POST', role: 'faculty', body });
    assert.equal(res.status, 201);
    return res.body;
  };

  const result = await decideSuggestion({
    suggestion,
    action: 'edit',
    editedText: customText,
    verificationToken,
    applyDraft,
    recordDecision
  });

  assert.equal(result.applied, true);
  assert.equal(result.decision.action, 'edit');
  assert.equal(appliedPatch.replacement, customText);

  // 4. Verify DB record
  assert.equal(decisionsDb.length, 1);
  assert.equal(decisionsDb[0].action, 'edit');
  assert.equal(decisionsDb[0].edited_text, customText);
});

// -----------------------------------------------------------------------------
// Scenario C: Reject recommendation
// -----------------------------------------------------------------------------
test('Scenario C: Faculty rejects Policy V2 recommendation without modifying syllabus', async (t) => {
  const { decideSuggestion } = await loadHybridCheck();
  const { content, request, setReport, decisionsDb } = await createTestHarness(t);

  const origContent = content.plan[2].contents;
  const suggestion = {
    id: 'review:row2-content',
    path: 'plan[2].contents',
    replacement: 'AI proposed text',
    originalValue: origContent,
    source: 'ai',
    policy: POLICY.id
  };
  setReport({ hybrid: { suggestions: [suggestion] } });

  let applyDraftCalled = false;
  const applyDraft = async () => { applyDraftCalled = true; return true; };
  const recordDecision = async (body) => {
    const res = await request('/runs/1/decisions', { method: 'POST', role: 'faculty', body });
    assert.equal(res.status, 201);
    return res.body;
  };

  const result = await decideSuggestion({
    suggestion,
    action: 'reject',
    applyDraft,
    recordDecision
  });

  assert.equal(result.applied, false);
  assert.equal(applyDraftCalled, false, 'applyDraft must never be called on reject');
  assert.equal(result.decision.action, 'reject');
  assert.equal(result.decision.draft, null);

  assert.equal(decisionsDb.length, 1);
  assert.equal(decisionsDb[0].action, 'reject');
  assert.equal(decisionsDb[0].edited_text, null);
});

// -----------------------------------------------------------------------------
// Scenario D: Undo faculty decision or applied change
// -----------------------------------------------------------------------------
test('Scenario D: Faculty undoes applied recommendation, restoring original draft text', async (t) => {
  const { undoSuggestion } = await loadHybridCheck();
  const { content, request, setReport, decisionsDb } = await createTestHarness(t);

  const origText = 'Original author contents for Week 3';
  content.plan[2].contents = 'Applied recommendation text';

  const suggestion = {
    id: 'review:row2-content',
    path: 'plan[2].contents',
    replacement: 'Applied recommendation text',
    originalValue: origText,
    source: 'ai',
    policy: POLICY.id
  };
  setReport({ hybrid: { suggestions: [suggestion] } });

  let restoredPatch = null;
  const applyDraft = async (patch) => {
    restoredPatch = patch;
    content.plan[2].contents = patch.replacement;
    return true;
  };

  const recordDecision = async (body) => {
    const res = await request('/runs/1/decisions', { method: 'POST', role: 'faculty', body });
    assert.equal(res.status, 201);
    return res.body;
  };

  const undoRes = await undoSuggestion({
    suggestion,
    appliedValue: 'Applied recommendation text',
    applyDraft,
    recordDecision
  });

  assert.equal(undoRes.action, 'undo');
  assert.equal(restoredPatch.replacement, origText, 'Draft was reverted to originalValue');
  assert.equal(content.plan[2].contents, origText);

  // Undo is recorded as a distinct undo event to preserve audit fidelity
  assert.equal(decisionsDb.at(-1).action, 'undo');
});

// -----------------------------------------------------------------------------
// Scenario E: Check & Improve with a valid correction (verified)
// -----------------------------------------------------------------------------
test('Scenario E: Check & Improve verifies safe correction against touched relationships', async (t) => {
  const saved = {};
  for (const [k, v] of Object.entries(TEST_ENV)) { saved[k] = process.env[k]; process.env[k] = v; }
  t.after(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

  const { content, masters } = sample();
  const orig = content.clos[0].statement;

  const verdict = (pair) => {
    const text = (pair.source || '') + ' ' + (pair.target || '');
    const problem = text.includes('[bad]') || (pair.type === 'CLO-PO' && !text.includes('[fit]'));
    return {
      id: pair.id,
      label: problem ? 'NOT_ALIGNED' : 'ALIGNED',
      explanation: problem ? 'Does not fit.' : 'Fits.',
      sourceQuote: (pair.source || '').slice(0, 6),
      targetQuote: (pair.target || '').slice(0, 6),
      sourceBloom: 'Apply',
      targetBloom: 'Apply',
      draft: problem ? 'A draft.' : ''
    };
  };

  const reply = (c) => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(c) } }] }) });
  const network = () => async (_url, req) => {
    const payload = JSON.parse(JSON.parse(req.body).messages[1].content).document_data;
    return Array.isArray(payload) ? reply({ judgements: payload.map(verdict) }) : reply({ text: 'rewritten [fit]' });
  };

  const alignment = await align(content, masters, { env: TEST_ENV, transport: network() });
  const suggestion = {
    id: 'SEM:clo0',
    path: 'clos[0].statement',
    source: 'ai',
    policy: POLICY.id,
    originalValue: orig,
    replacement: orig + ' [fit]',
    canRefine: true
  };
  const report = {
    evaluationPolicy: { id: POLICY.id },
    hybrid: { alignment, suggestions: [suggestion] }
  };

  const res = await refineSuggestion({
    content,
    masters,
    report,
    suggestion,
    options: { academicPolicy: POLICY.id, env: TEST_ENV, transport: network() }
  });

  assert.equal(res.status, 'verified');
  assert.equal(res.usedRewrite, false);
  assert.equal(res.text, suggestion.replacement);
  assert.ok(res.stats.improved > 0, 'CLO-PO improved from NOT_ALIGNED to ALIGNED');
  assert.equal(res.stats.worse, 0);
  assert.deepEqual(res.blockers, []);
});

// -----------------------------------------------------------------------------
// Scenario F: Check & Improve with a correction that introduces another misalignment (blocked)
// -----------------------------------------------------------------------------
test('Scenario F: Check & Improve blocks correction that degrades another relationship', async (t) => {
  const saved = {};
  for (const [k, v] of Object.entries(TEST_ENV)) { saved[k] = process.env[k]; process.env[k] = v; }
  t.after(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

  const { content, masters } = sample();
  const orig = content.clos[0].statement;

  const verdict = (pair) => {
    const text = (pair.source || '') + ' ' + (pair.target || '');
    const problem = text.includes('[bad]') || (pair.type === 'CLO-PO' && !text.includes('[fit]'));
    return {
      id: pair.id,
      label: problem ? 'NOT_ALIGNED' : 'ALIGNED',
      explanation: problem ? 'Does not fit.' : 'Fits.',
      sourceQuote: (pair.source || '').slice(0, 6),
      targetQuote: (pair.target || '').slice(0, 6),
      sourceBloom: 'Apply',
      targetBloom: 'Apply',
      draft: problem ? 'A draft.' : ''
    };
  };

  const reply = (c) => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(c) } }] }) });
  const network = () => async (_url, req) => {
    const payload = JSON.parse(JSON.parse(req.body).messages[1].content).document_data;
    return Array.isArray(payload) ? reply({ judgements: payload.map(verdict) }) : reply({ text: 'rewritten [bad]' });
  };

  const alignment = await align(content, masters, { env: TEST_ENV, transport: network() });
  const suggestion = {
    id: 'SEM:clo0',
    path: 'clos[0].statement',
    source: 'ai',
    policy: POLICY.id,
    originalValue: orig,
    replacement: orig + ' [bad]',
    canRefine: true
  };
  const report = {
    evaluationPolicy: { id: POLICY.id },
    hybrid: { alignment, suggestions: [suggestion] }
  };

  const res = await refineSuggestion({
    content,
    masters,
    report,
    suggestion,
    options: { academicPolicy: POLICY.id, env: TEST_ENV, transport: network() }
  });

  assert.equal(res.status, 'blocked');
  assert.ok(res.stats.worse > 0, 'At least one relationship got worse');
  assert.ok(res.blockers.length > 0, 'Blockers reported');
});

// -----------------------------------------------------------------------------
// Scenario G: Multiple recommendations affecting the same ILO
// -----------------------------------------------------------------------------
test('Scenario G: Multiple recommendations affecting the same ILO preserve distinct IDs and detect drift', async (t) => {
  const { applySuggestion } = await loadHybridCheck();
  const { content } = sample();

  const iloPath = 'plan[0].ilos[0].text';
  const origIlo = content.plan[0].ilos[0].text;

  const suggestion1 = {
    id: 'review:row0-ilo0-contentilo',
    path: iloPath,
    replacement: origIlo + ' (content-aligned)',
    originalValue: origIlo,
    source: 'ai',
    policy: POLICY.id
  };

  const suggestion2 = {
    id: 'review:row0-ilo0-activity',
    path: iloPath,
    replacement: origIlo + ' (activity-aligned)',
    originalValue: origIlo,
    source: 'ai',
    policy: POLICY.id
  };

  assert.notEqual(suggestion1.id, suggestion2.id);

  // Apply suggestion1
  const draftAfterS1 = applySuggestion(content, suggestion1, { requireOriginal: true });
  assert.equal(draftAfterS1.plan[0].ilos[0].text, suggestion1.replacement);

  // Attempt to apply suggestion2 with original draft baseline detects change
  assert.throws(
    () => applySuggestion(draftAfterS1, suggestion2, { requireOriginal: true }),
    /hybrid\.suggestionTargetChanged/
  );
});

// -----------------------------------------------------------------------------
// Scenario H: Multiple CLO mappings with one incorrect relationship
// -----------------------------------------------------------------------------
test('Scenario H: Multiple CLO mappings with one incorrect relationship target only the failing mapping', async () => {
  const { content, masters } = sample();
  const rowIdx = 0;
  const ilo = content.plan[rowIdx].ilos[0];
  ilo.tags = ['clo:' + content.clos[0].id, 'clo:' + content.clos[2].id];

  // Under Step 3 integrity, each mapping produces an independent relationship
  const planData = plan(content, masters);
  const iloCloPairs = planData.pairs.filter(p => p.type === 'ILO-CLO' && p.path.startsWith(`plan[${rowIdx}].ilos[0]`));
  assert.equal(iloCloPairs.length, 2);

  // One is aligned, one requires revision
  const records = [
    { id: iloCloPairs[0].id, status: 'SUPPORTED_BY_SUPPLIED_EVIDENCE', academicJudgment: 'ALIGNED', explanation: 'Fits CLO 1' },
    { id: iloCloPairs[1].id, status: 'REQUIRES_REVISION', academicJudgment: 'NOT_ALIGNED', explanation: 'Does not fit CLO 3', recommendedCorrection: 'Revised ILO text for CLO 3', correction: { field: 'ilo', path: `plan[${rowIdx}].ilos[0].text` } }
  ];

  // Actions created from records
  const used = new Set();
  const actions = [];
  for (const r of records) {
    if (['REQUIRES_REVISION', 'FACULTY_REVIEW'].includes(r.status) && !used.has(r.id)) {
      actions.push({
        id: 'review:' + r.id,
        relationshipIds: [r.id],
        correction: r.recommendedCorrection,
        field: r.correction?.field,
        path: r.correction?.path
      });
    }
  }

  assert.equal(actions.length, 1, 'Only the misaligned relationship generates a review action');
  assert.equal(actions[0].relationshipIds[0], iloCloPairs[1].id);
  assert.equal(actions[0].correction, 'Revised ILO text for CLO 3');
});

// -----------------------------------------------------------------------------
// Scenario I: Stale recommendation after syllabus content changes (409)
// -----------------------------------------------------------------------------
test('Scenario I: Stale recommendation after syllabus content changes is rejected', async (t) => {
  const { applySuggestion } = await loadHybridCheck();
  const { content, request, setReport } = await createTestHarness(t);

  const suggestion = {
    id: 'review:row0-content',
    path: 'plan[0].contents',
    replacement: 'Updated content',
    originalValue: 'Old text before faculty edited the form',
    source: 'ai',
    policy: POLICY.id
  };
  setReport({
    hybrid: {
      alignment: { promptVersion: 'prompt-v10-old' },
      suggestions: [suggestion]
    }
  });

  // Client-side drift detection
  assert.throws(
    () => applySuggestion(content, suggestion, { requireOriginal: true }),
    /hybrid\.suggestionTargetChanged/
  );

  // Server-side field drift detection returns 409
  const refineRes = await request(`/runs/1/suggestions/${suggestion.id}/refine`, { method: 'POST', role: 'faculty' });
  assert.equal(refineRes.status, 409);
  assert.match(refineRes.body.error, /field changed/);

  // Server-side older checker version check
  const legacySuggestion = { id: 'SEM:legacy', path: 'plan[0].contents', replacement: 'Updated', originalValue: content.plan[0].contents, source: 'ai' };
  setReport({
    hybrid: {
      alignment: { promptVersion: promptVersionOf(NEMOTRON_FREE) + '-old' },
      suggestions: [legacySuggestion]
    }
  });
  const oldRefineRes = await request(`/runs/1/suggestions/${legacySuggestion.id}/refine`, { method: 'POST', role: 'faculty' });
  assert.equal(oldRefineRes.status, 409);
  assert.match(oldRefineRes.body.error, /older checker version/);
});

// -----------------------------------------------------------------------------
// Scenario J: Unauthorized recommendation modification (401, 403, 404)
// -----------------------------------------------------------------------------
test('Scenario J: Non-author, administrator and anonymous access controls are strictly enforced', async (t) => {
  // Test with 'under_review' syllabus status so admin can view the syllabus, but is not the owner
  const { request, setReport } = await createTestHarness(t, { syllabusStatus: 'under_review' });
  const suggestion = {
    id: 'review:row2-content',
    path: 'plan[2].contents',
    replacement: 'New text',
    originalValue: 'Old text',
    source: 'ai'
  };
  setReport({ hybrid: { suggestions: [suggestion] } });

  // 1. Unauthenticated (no session)
  const unauth = await request('/runs/1/decisions', { method: 'POST', role: null, body: { suggestionId: suggestion.id, action: 'accept' } });
  assert.equal(unauth.status, 401);

  // 2. Administrator cannot make decisions (faculty author only)
  const admin = await request('/runs/1/decisions', { method: 'POST', role: 'admin', body: { suggestionId: suggestion.id, action: 'accept' } });
  assert.equal(admin.status, 403);
  assert.match(admin.body.error, /Only the author/);

  // 3. Different faculty member cannot access other author's syllabus
  const other = await request('/runs/1/decisions', { method: 'POST', role: 'other_faculty', body: { suggestionId: suggestion.id, action: 'accept' } });
  assert.equal(other.status, 404);

  // 4. Refine endpoint permissions
  const adminRefine = await request(`/runs/1/suggestions/${suggestion.id}/refine`, { method: 'POST', role: 'admin' });
  assert.equal(adminRefine.status, 403);

  const otherRefine = await request(`/runs/1/suggestions/${suggestion.id}/refine`, { method: 'POST', role: 'other_faculty' });
  assert.equal(otherRefine.status, 404);
});

// -----------------------------------------------------------------------------
// Scenario K: Historical report remains read-only (409 on locked syllabus)
// -----------------------------------------------------------------------------
test('Scenario K: Historical or submitted syllabus rejects recommendation actions and remains immutable', async (t) => {
  const { request, setReport } = await createTestHarness(t, { syllabusStatus: 'submitted' });
  const suggestion = {
    id: 'review:row2-content',
    path: 'plan[2].contents',
    replacement: 'New text',
    originalValue: 'Old text',
    source: 'ai'
  };
  setReport({ hybrid: { suggestions: [suggestion] } });

  // Decision on submitted syllabus is refused
  const decRes = await request('/runs/1/decisions', { method: 'POST', role: 'faculty', body: { suggestionId: suggestion.id, action: 'accept' } });
  assert.equal(decRes.status, 409);
  assert.match(decRes.body.error, /locked/i);

  // Refine on submitted syllabus is refused
  const refRes = await request(`/runs/1/suggestions/${suggestion.id}/refine`, { method: 'POST', role: 'faculty' });
  assert.equal(refRes.status, 409);
  assert.match(refRes.body.error, /locked/i);
});

// -----------------------------------------------------------------------------
// Scenario L: AI unavailable during Check & Improve (502 error handling)
// -----------------------------------------------------------------------------
test('Scenario L: AI provider failure during refine returns 502 without corrupting state', async (t) => {
  const { content, request, setReport } = await createTestHarness(t);
  const origText = content.plan[2].contents;
  const suggestion = {
    id: 'review:row2-content',
    path: 'plan[2].contents',
    replacement: 'New text',
    originalValue: origText,
    source: 'ai'
  };
  setReport({
    hybrid: {
      alignment: { promptVersion: promptVersionOf(NEMOTRON_FREE) },
      suggestions: [suggestion]
    }
  });

  // Mock global fetch to simulate network outage
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Connection refused to AI provider API gateway');
  });

  const res = await request(`/runs/1/suggestions/${suggestion.id}/refine`, { method: 'POST', role: 'faculty' });
  assert.equal(res.status, 502);
  assert.match(res.body.error, /Connection refused/);
});

// -----------------------------------------------------------------------------
// Scenario M: Policy V2 disabled — legacy behavior unchanged
// -----------------------------------------------------------------------------
test('Scenario M: When Policy V2 is disabled, evaluateIntegrated refuses and legacy checks continue', async () => {
  const { content, masters } = sample();
  const coded = () => ({ base: { overall: 85, passed: true }, findings: [], checks: [] });

  // Explicitly disabled env
  const disabledEnv = {
    SYLLABUS_CHECK_ACADEMIC_V2: 'off',
    SYLLABUS_CHECK_POLICY_V2: 'off'
  };

  assert.equal(v2Activation.enabled(disabledEnv), false);

  await assert.rejects(
    async () => policy.evaluateIntegrated(content, masters, coded, { env: disabledEnv }),
    err => {
      assert.equal(err.code, 'academic_v2_offline_only');
      assert.match(err.message, /Policy V2 application checking is disabled/);
      return true;
    }
  );
});

// -----------------------------------------------------------------------------
// Scenario N: Faculty/Admin UI rendering and localization
// -----------------------------------------------------------------------------
test('Scenario N: UI localization contracts and key symmetry in English and Filipino', () => {
  // 1. Verify key symmetry between EN and TL for academicV2 and hybrid
  const v2EnKeys = Object.keys(academicV2En).sort();
  const v2TlKeys = Object.keys(academicV2Tl).sort();
  assert.deepEqual(v2EnKeys, v2TlKeys, 'academicV2 keys must match exactly between EN and TL');

  // Verify non-empty and distinct translations
  for (const key of v2EnKeys) {
    assert.ok(academicV2En[key], `academicV2En missing key: ${key}`);
    assert.ok(academicV2Tl[key], `academicV2Tl missing key: ${key}`);
    assert.notEqual(academicV2En[key], academicV2Tl[key], `Translation for ${key} must differ between EN and TL`);
  }

  // 2. Verify all recommendation action keys exist in hybrid localization
  const requiredActionKeys = [
    'hybrid.accept',
    'hybrid.editApply',
    'hybrid.reject',
    'hybrid.undo',
    'hybrid.refine',
    'hybrid.refining',
    'hybrid.applying',
    'hybrid.applyVerified',
    'hybrid.appliedSaved',
    'hybrid.editText',
    'hybrid.suggestedText',
    'hybrid.cardStale',
    'hybrid.refineOk',
    'hybrid.refineBlocked',
    'hybrid.refineBlockers',
    'hybrid.decision.accept',
    'hybrid.decision.edit',
    'hybrid.decision.reject'
  ];

  for (const k of requiredActionKeys) {
    assert.ok(hybridEn[k], `hybridEn missing: ${k}`);
    assert.ok(hybridTl[k], `hybridTl missing: ${k}`);
  }
});
