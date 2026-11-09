'use strict';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'existing-suite-test-secret-0123456789'; // verification tokens are signed only with a configured secret
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

const repo = require('./repository');
const { sample } = require('./fixtures');
const { NEMOTRON_FREE, createRequestBudget, pairsOf } = require('./gemini');
const svc = require('../compliance/service');
const standard = require('../compliance/standard-v4.json');
const { refineSuggestion, createVerificationToken, verifyVerificationToken, relatedContextHash } = require('./refine');
const activity = require('../activity');
const academicV2Plan = require('./academicV2Plan');

// Build an integrated Express test app wiring real routes
function createTestApp(options = {}) {
  const app = express();
  app.use(express.json());

  const { content: sampleContent, masters: sampleMasters } = sample();
  const content = options.content || structuredClone(sampleContent);
  const masters = options.masters || sampleMasters;

  const runsDb = new Map();
  const reportsDb = new Map();
  const decisionsDb = [];
  const submissionLogs = [];
  let nextRunId = 100;
  let nextDecisionId = 1;

  const mockQuery = async (sql, params = []) => {
    if (sql.startsWith('SELECT 1 FROM ai_check_runs')) {
      return [[{ 1: 1 }]];
    }
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id = ?')) {
      return [[{ user_id: params[0] }]];
    }
    if (sql.startsWith('SELECT * FROM syllabi WHERE syllabus_id = ?')) {
      const id = params[0];
      if (id === 999) return [[]]; // not found
      return [[{
        syllabus_id: id,
        user_id: id === 2 ? 99 : 26, // syllabus 1 is user 26, syllabus 2 is user 99
        course_code: 'IT-202',
        title: 'Computer Programming 1',
        status: options.syllabusStatus || 'draft',
        version: 'v1.0',
        content: JSON.stringify(content)
      }]];
    }
    if (sql.startsWith('SELECT s.*, r.run_id FROM ai_check_runs r JOIN syllabi s ON s.syllabus_id = r.syllabus_id WHERE r.run_id = ?')) {
      const runId = params[0];
      const run = runsDb.get(runId);
      if (!run) return [[]];
      return [[{
        syllabus_id: run.syllabus_id,
        user_id: 26,
        status: run.status || options.syllabusStatus || 'draft',
        content: JSON.stringify(content),
        run_id: runId
      }]];
    }
    if (sql.startsWith('INSERT INTO ai_check_runs')) {
      const runId = nextRunId++;
      const row = {
        run_id: runId,
        syllabus_id: params[0],
        version_id: params[1],
        content_hash: params[2],
        standard_version: params[3],
        overall: params[4],
        status: params[5],
        passed: params[6],
        conformant: params[7],
        ai_status: params[8],
        contact: params[9],
        created_by: params[10]
      };
      runsDb.set(runId, row);
      return [{ insertId: runId, affectedRows: 1 }];
    }
    if (sql.startsWith('UPDATE ai_check_runs SET provider = ?')) {
      const run = runsDb.get(params[3]);
      if (run) {
        run.provider = params[0];
        run.model = params[1];
        run.ai_error = params[2];
      }
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('INSERT INTO ai_check_area_scores') || sql.startsWith('INSERT INTO ai_findings')) {
      return [{ insertId: 1, affectedRows: 1 }];
    }
    if (sql.startsWith('INSERT INTO syllabus_check_reports')) {
      reportsDb.set(params[0], { reference_hash: params[1], report_json: params[2] });
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('SELECT reference_hash, report_json FROM syllabus_check_reports WHERE run_id = ?')) {
      const row = reportsDb.get(params[0]);
      return [row ? [row] : []];
    }
    if (sql.startsWith('SELECT * FROM ai_check_runs WHERE run_id = ?')) {
      const run = runsDb.get(params[0]);
      return [run ? [run] : []];
    }
    if (sql.startsWith('SELECT * FROM ai_check_runs WHERE syllabus_id = ?') || sql.startsWith('SELECT r.*,') || sql.startsWith('SELECT run_id FROM ai_check_runs WHERE syllabus_id = ?')) {
      const runs = Array.from(runsDb.values()).filter(r => r.syllabus_id === params[0]);
      const latest = runs.sort((a, b) => b.run_id - a.run_id)[0];
      return [latest ? [latest] : []];
    }
    if (sql.startsWith('SELECT first_name, last_name FROM users WHERE user_id = ?')) {
      return [[{ first_name: 'Test', last_name: 'Faculty' }]];
    }
    if (sql.startsWith('SELECT run_id, area_key, name, weight, score FROM ai_check_area_scores')) {
      return [[]];
    }
    if (sql.startsWith('SELECT * FROM ai_findings WHERE run_id = ?')) {
      return [[]];
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
        action: params[2],
        edited_text: params[3],
        user_id: params[4],
        created_at: new Date().toISOString()
      };
      decisionsDb.push(row);
      return [{ insertId: id, affectedRows: 1 }];
    }
    if (sql.startsWith('INSERT INTO submission_logs')) {
      submissionLogs.push({ syllabus_id: params[0], user_id: params[1], action: params[2], notes: params[3] });
      return [{ insertId: submissionLogs.length, affectedRows: 1 }];
    }
    if (sql.startsWith('SELECT version_label FROM syllabus_versions')) {
      return [[{ version_label: 'v1.0' }]];
    }
    if (sql.includes('FROM syllabi WHERE') || sql.includes('LABEL_SQL')) {
      return [[{
        program_code: 'BSIT',
        program_name: 'Information Technology',
        subject_name: 'Computer Programming 1'
      }]];
    }
    return [[]];
  };

  const mockDb = {
    query: mockQuery,
    getConnection: async () => ({
      query: mockQuery,
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {}
    })
  };

  app.locals.db = mockDb;

  // Session middleware
  app.use((req, res, next) => {
    const authHeader = req.headers['authorization'];
    req.session = {
      destroy: fn => fn && fn()
    };
    if (authHeader === 'Bearer faculty_token') {
      req.session.user = { id: 26, role: 'faculty' };
    } else if (authHeader === 'Bearer admin_token') {
      req.session.user = { id: 1, role: 'admin' };
    } else if (authHeader === 'Bearer other_faculty_token') {
      req.session.user = { id: 99, role: 'faculty' };
    }
    next();
  });

  const complianceRouter = require('../../routes/compliance');
  const syllabusCheckRouter = require('../../routes/syllabusCheck');

  app.use('/api', complianceRouter);
  app.use('/api/compliance', syllabusCheckRouter);

  return { app, content, masters, runsDb, reportsDb, decisionsDb, submissionLogs };
}

async function request(app, method, url, { headers = {}, body } = {}) {
  const req = {
    method,
    url,
    headers: { 'content-type': 'application/json', ...headers },
    body
  };
  return new Promise(resolve => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const http = require('node:http');
      const clientReq = http.request(`http://127.0.0.1:${port}${url}`, {
        method,
        headers: req.headers
      }, res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          server.close(() => {
            let parsed = null;
            try { parsed = JSON.parse(data); } catch { parsed = data; }
            resolve({ status: res.statusCode, headers: res.headers, body: parsed });
          });
        });
      });
      if (body) clientReq.write(JSON.stringify(body));
      clientReq.end();
    });
  });
}

test('E2E Flow 1: Complete lifecycle Re-Check API -> Hybrid Service -> 47 Rules -> Report Persistence', async t => {
  const { app, content, masters } = createTestApp();

  const coded = require('./engine').coded(content, masters);
  const cleanResult = {
    ...coded.base,
    standard: require('./engine').VERSION,
    status: 'scored',
    overall: 100,
    score: 100,
    baseScore: 100,
    passed: true,
    band: 'Excellent',
    conformance: { ok: true, failed: [] },
    findings: [],
    hybrid: {
      version: require('./engine').VERSION,
      ready: true,
      score: 100,
      provisionalScore: 100,
      deductions: [],
      suggestions: [],
      checkedAt: new Date().toISOString(),
      checkedMeta: content.meta,
      alignment: { status: 'completed', provider: 'test', model: 'test' }
    }
  };
  t.mock.method(require('./engine'), 'run', async () => structuredClone(cleanResult));
  t.mock.method(repo, 'mastersFor', async () => masters);

  // Faculty triggers Re-Check on Syllabus 1
  const res = await request(app, 'POST', '/api/syllabi/1/compliance/recheck', {
    headers: { authorization: 'Bearer faculty_token' }
  });

  assert.strictEqual(res.status, 200, 'Recheck API should succeed with 200');
  assert.ok(res.body.run, 'Response must include stored run');
  assert.strictEqual(res.body.run.overall, 100, 'Clean syllabus meets all 47 deterministic rules');
  assert.strictEqual(res.body.run.status, 'scored', 'Run status must be scored');
  assert.strictEqual(res.body.run.checkedBy, 'author', 'Run must be attributed to author');

  // Read back via Faculty Compliance endpoint
  const getRes = await request(app, 'GET', '/api/syllabi/1/compliance', {
    headers: { authorization: 'Bearer faculty_token' }
  });
  assert.strictEqual(getRes.status, 200);
  assert.strictEqual(getRes.body.run.overall, 100);
});

test('E2E Flow 2: Seven VPAA Academic Relationships are evaluated with independent findings', () => {
  const { content, masters } = sample();

  // 1. Stage B pairs via pairsOf
  const pairs = pairsOf(content, masters, [], { stageA: true, stageB: true, stageB4: true });
  const types = new Set(pairs.map(p => p.type));

  assert.ok(types.has('Content-course'), '1. Content-course present');
  assert.ok(types.has('Content-ILO'), '2. Content-ILO present');
  assert.ok(types.has('ILO-CLO'), '3. ILO-CLO present');
  assert.ok(types.has('ILO-activity'), '5. ILO-activity present');
  assert.ok(types.has('ILO-assessment'), '6. ILO-assessment present');

  // 2. Policy V2 plan encompasses all seven relationships
  const v2Plan = academicV2Plan.plan(content, masters);
  const v2Types = new Set(v2Plan.pairs.map(p => p.type));

  assert.ok(v2Types.has('Content-course'), 'V2 1. Course Title <-> Course Content');
  assert.ok(v2Types.has('Content-ILO'), 'V2 2. Course Content <-> ILO');
  assert.ok(v2Types.has('ILO-CLO'), 'V2 3. ILO <-> CLO');
  assert.ok(v2Types.has('Content-activity'), 'V2 4. Course Content <-> Learning Activities');
  assert.ok(v2Types.has('ILO-activity'), 'V2 5. ILO <-> Learning Activities');
  assert.ok(v2Types.has('Content-assessment'), 'V2 6. Course Content <-> Assessment');
  assert.ok(v2Types.has('Activity-assessment'), 'V2 7. Learning Activities <-> Assessment');

  // Verify multiple CLO mappings for one ILO produce independent relationship IDs
  const iloClos = pairs.filter(p => p.type === 'ILO-CLO');
  assert.ok(iloClos.length >= 2, 'Should have multiple ILO-CLO mappings');
  const ids = new Set(iloClos.map(p => p.id));
  assert.strictEqual(ids.size, iloClos.length, 'Every ILO-CLO mapping must have a unique relationship ID');
});

test('E2E Flow 3: Recommendation Workflow (Refine -> Token Verification -> Accept -> Undo -> Invalidate)', async t => {
  const { app, content, masters, runsDb, reportsDb } = createTestApp();

  const runId = 101;
  const suggestionId = 'sug-1';
  const path = 'plan[0].ilos[0].text';
  const originalValue = content.plan[0].ilos[0].text;
  const replacement = 'Apply basic algorithms to solve structured computing problems.';

  runsDb.set(runId, { run_id: runId, syllabus_id: 1, user_id: 26, status: 'draft', content: JSON.stringify(content) });

  const mockReport = {
    fingerprint: masters.fingerprint,
    hybrid: {
      alignment: { status: 'completed', promptVersion: 'alignment-baseline' },
      academicV2: {
        academic: {
          suggestions: [{
            id: suggestionId,
            path,
            originalValue,
            replacement,
            policy: 'academic-policy-v2'
          }]
        }
      }
    }
  };
  reportsDb.set(runId, { reference_hash: masters.fingerprint, report_json: JSON.stringify(mockReport) });
  t.mock.method(repo, 'mastersFor', async () => masters);

  // 1. Attempt Accept without verification token -> BLOCKED (HTTP 409)
  const unverifiedRes = await request(app, 'POST', `/api/compliance/runs/${runId}/decisions`, {
    headers: { authorization: 'Bearer faculty_token' },
    body: { suggestionId, action: 'accept' }
  });
  assert.strictEqual(unverifiedRes.status, 409);
  assert.match(unverifiedRes.body.error, /must be verified with Check & Improve/);

  // 2. Generate valid verification token via Check & Improve helper
  const contextHash = relatedContextHash(content, masters, path);
  const token = createVerificationToken({
    runId,
    suggestionId,
    syllabusId: 1,
    path,
    originalValue,
    replacement,
    contextHash
  });

  // 3. Apply with valid token -> ACCEPTED (HTTP 201)
  const acceptRes = await request(app, 'POST', `/api/compliance/runs/${runId}/decisions`, {
    headers: { authorization: 'Bearer faculty_token' },
    body: { suggestionId, action: 'accept', verificationToken: token }
  });
  assert.strictEqual(acceptRes.status, 201);
  assert.strictEqual(acceptRes.body.action, 'accept');

  // 4. Immediate Replay of the same token -> BLOCKED (HTTP 409)
  const replayRes = await request(app, 'POST', `/api/compliance/runs/${runId}/decisions`, {
    headers: { authorization: 'Bearer faculty_token' },
    body: { suggestionId, action: 'accept', verificationToken: token }
  });
  assert.strictEqual(replayRes.status, 409);
  assert.match(replayRes.body.error, /has already been applied/);

  // 5. Faculty performs Undo
  const undoRes = await request(app, 'POST', `/api/compliance/runs/${runId}/decisions`, {
    headers: { authorization: 'Bearer faculty_token' },
    body: { suggestionId, action: 'undo' }
  });
  assert.strictEqual(undoRes.status, 201);
  assert.strictEqual(undoRes.body.action, 'undo');

  // 6. Attempting to re-apply the old token after undo -> STILL BLOCKED (HTTP 409)
  const reapplyRes = await request(app, 'POST', `/api/compliance/runs/${runId}/decisions`, {
    headers: { authorization: 'Bearer faculty_token' },
    body: { suggestionId, action: 'accept', verificationToken: token }
  });
  assert.strictEqual(reapplyRes.status, 409);
  assert.match(reapplyRes.body.error, /has already been applied/);
});

test('E2E Flow 4: Authorization boundaries: Administrator is read-only on faculty recommendations', async t => {
  const { app, runsDb, reportsDb, content, masters } = createTestApp({ syllabusStatus: 'submitted' });
  const runId = 102;
  runsDb.set(runId, { run_id: runId, syllabus_id: 1, user_id: 26, status: 'submitted', content: JSON.stringify(content) });

  const mockReport = {
    fingerprint: masters.fingerprint,
    hybrid: {
      alignment: { status: 'completed' },
      suggestions: [{ id: 's1', path: 'plan[0].activities', replacement: 'Lab' }]
    }
  };
  reportsDb.set(runId, { reference_hash: masters.fingerprint, report_json: JSON.stringify(mockReport) });

  // 1. Admin CAN view decisions on a submitted syllabus (HTTP 200)
  const adminGet = await request(app, 'GET', `/api/compliance/runs/${runId}/decisions`, {
    headers: { authorization: 'Bearer admin_token' }
  });
  assert.strictEqual(adminGet.status, 200);

  // 2. Admin CANNOT record decision on faculty syllabus -> BLOCKED (HTTP 403)
  const adminPost = await request(app, 'POST', `/api/compliance/runs/${runId}/decisions`, {
    headers: { authorization: 'Bearer admin_token' },
    body: { suggestionId: 's1', action: 'accept' }
  });
  assert.strictEqual(adminPost.status, 403);
  assert.match(adminPost.body.error, /Only the author can/);

  // 3. Other faculty attempts to access -> BLOCKED (HTTP 404, isolated)
  const otherRes = await request(app, 'POST', `/api/compliance/runs/${runId}/decisions`, {
    headers: { authorization: 'Bearer other_faculty_token' },
    body: { suggestionId: 's1', action: 'accept' }
  });
  assert.strictEqual(otherRes.status, 404);
});

test('E2E Flow 5: Scoring rules and threshold integrity', () => {
  assert.strictEqual(standard.passThreshold, 79, 'Authoritative passing mark must be exactly 79');
  assert.strictEqual(standard.rules.length, 47, 'Exactly 47 deterministic compliance rules must exist');

  const v2 = require('../../../src/data/academicPolicyV2.json');
  assert.strictEqual(v2.id, 'academic-evaluation-v2-preview-1', 'Policy V2 preview identity');
  assert.strictEqual(v2.official, false, 'Policy V2 is strictly nonofficial/advisory');
});
