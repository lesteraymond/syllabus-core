process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret-coordinated-plan-0123456789';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const repo = require('../lib/syllabuscheck/repository');
const { contentHash } = require('../lib/compliance/hash');
const coordinatedPlanEngine = require('../lib/syllabuscheck/coordinatedPlanEngine');
const activeYearGate = require('../lib/activeYearGate');
const programPoReferences = require('../lib/programPoReferences');
const assignments = require('../lib/assignments');
const courses = require('../lib/courses');

function sampleSyllabus() {
  return {
    schemaVersion: 2,
    meta: {
      courseId: 101,
      code: 'CpE 301',
      title: 'Logic Circuits and Design',
      program: 'BSCPE',
      curriculumYear: '2026-2027',
    },
    description: [{ t: 'Introduction to Logic Circuits' }],
    clos: [{ id: 'c1', text: 'CLO 1' }, { id: 'c2', text: 'CLO 2' }],
    plan: [
      {
        week: 1,
        contents: 'Basic Logic Principles',
        ilos: [{ text: 'Understand logic concepts', tags: ['clo:c1'] }],
        activities: 'Lecture',
        tasks: 'Quiz',
        values: 'Courage',
      },
    ],
  };
}

async function createHarness(t, { status = 'draft', ownerId = 26, role = 'faculty', userId = 26 } = {}) {
  const content = sampleSyllabus();
  const masters = {
    institution: { values: ['Courage'] },
    pos: [{ no: 1, text: 'PO 1' }],
    fingerprint: 'test_hash_fingerprint',
  };

  const plan = coordinatedPlanEngine.buildPlan({
    content,
    masters,
    syllabusId: 100,
    result: { standard: { version: 'hybrid-2' } },
    env: { SYLLABUS_CHECK_COORDINATED_PLAN: 'on' },
  });

  const report = {
    standard: { version: 'hybrid-2' },
    hybrid: {
      improvementPlan: plan,
      alignment: { status: 'completed' },
      suggestions: [],
    },
  };

  t.mock.method(repo, 'readReport', async () => report);
  t.mock.method(repo, 'mastersFor', async () => masters);
  t.mock.method(activeYearGate, 'assertActiveYear', async () => {});
  t.mock.method(programPoReferences, 'assertRecordReview', async () => {});
  t.mock.method(assignments, 'requireCourseAccess', async () => {});
  t.mock.method(courses, 'loadCourse', async () => ({
    id: 101,
    code: 'CpE 301',
    title: 'Logic Circuits and Design',
    program: { code: 'BSCPE', name: 'Computer Engineering' },
    standards: {},
    clos: [{ id: 'c1', text: 'CLO 1' }],
  }));

  let dbContent = JSON.stringify(content);
  const executedQueries = [];

  const handleQuery = async (sql, params) => {
    executedQueries.push({ sql, params });
    if (sql.includes('FROM users')) {
      return [[{ user_id: 26, is_active: 1 }]];
    }
    if (sql.includes('SELECT') && sql.includes('FOR UPDATE')) {
      return [[{ syllabus_id: 100, user_id: ownerId, status, course_id: 101, content: dbContent, content_schema_version: 2 }]];
    }
    if (sql.includes('UPDATE syllabi SET content =')) {
      dbContent = params[0];
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('INSERT INTO syllabus_check_decisions')) {
      return [{ insertId: 501 }];
    }
    if (sql.includes('INSERT INTO activity_logs')) {
      return [{ insertId: 601 }];
    }
    if (sql.startsWith('SELECT s.*, r.run_id')) {
      return [[{ syllabus_id: 100, user_id: ownerId, status, content: dbContent }]];
    }
    return [[]];
  };

  const app = express();
  app.use(express.json());
  app.locals.db = {
    query: handleQuery,
    getConnection: async () => ({
      query: handleQuery,
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
    }),
  };

  app.use((req, res, next) => {
    req.session = {
      user: { id: userId, role },
      destroy: (cb) => { if (cb) cb(); },
    };
    next();
  });

  delete require.cache[require.resolve('./syllabusCheck')];
  app.use('/api/syllabus-check', require('./syllabusCheck'));

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const base = `http://127.0.0.1:${server.address().port}/api/syllabus-check/runs/1/improvement-plan`;
  const realHttp = require('node:http');

  const requestApi = (path, method = 'GET', body = null) =>
    new Promise((resolve, reject) => {
      const req = realHttp.request(
        base + path,
        {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : {},
        },
        (res) => {
          let data = '';
          res.on('data', (c) => { data += c; });
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
            } catch {
              resolve({ status: res.statusCode, raw: data });
            }
          });
        }
      );
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });

  return { requestApi, plan, content, getDbContent: () => JSON.parse(dbContent), executedQueries };
}

test('Route GET /runs/:id/improvement-plan returns the stored coordinated improvement plan', async (t) => {
  const { requestApi, plan } = await createHarness(t);
  const res = await requestApi('');
  assert.equal(res.status, 200);
  assert.ok(res.body.plan);
  assert.equal(res.body.plan.planId, plan.planId);
  assert.equal(res.body.plan.sourceHash, plan.sourceHash);
});

test('Route POST /runs/:id/improvement-plan/apply rejects non-owner with 403', async (t) => {
  const { requestApi, plan } = await createHarness(t, { ownerId: 99, userId: 1, role: 'admin', status: 'for_revision' });
  const res = await requestApi('/apply', 'POST', {
    planId: plan.planId,
    sourceHash: plan.sourceHash,
  });
  assert.equal(res.status, 403);
});

test('Route POST /runs/:id/improvement-plan/apply rejects approved syllabus with 409', async (t) => {
  const { requestApi, plan } = await createHarness(t, { status: 'approved' });
  const res = await requestApi('/apply', 'POST', {
    planId: plan.planId,
    sourceHash: plan.sourceHash,
  });
  assert.equal(res.status, 409);
});

test('Route POST /runs/:id/improvement-plan/apply rejects stale/drifted version with 409', async (t) => {
  const { requestApi, plan } = await createHarness(t);
  const res = await requestApi('/apply', 'POST', {
    planId: plan.planId,
    sourceHash: 'stale_hash_from_older_version_1234567890',
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'stale_syllabus_version');
});

test('Route POST /runs/:id/improvement-plan/apply successfully applies package atomically', async (t) => {
  const { requestApi, plan, getDbContent, executedQueries } = await createHarness(t);

  // Add a sample change to the plan to verify DB write
  plan.changes.push({
    changeId: 'chg_test_1',
    path: 'plan[0].activities',
    proposedValue: 'Updated coordinated activity laboratory session',
  });

  const res = await requestApi('/apply', 'POST', {
    planId: plan.planId,
    sourceHash: plan.sourceHash,
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.applied, true);
  assert.equal(res.body.planId, plan.planId);
  assert.ok(res.body.revisions);

  // Verify that the updated content in the database holds the proposed value
  const saved = getDbContent();
  assert.equal(saved.plan[0].activities, 'Updated coordinated activity laboratory session');

  // Verify that syllabus_check_decisions was inserted
  const decisionInserts = executedQueries.filter((q) => q.sql.includes('INSERT INTO syllabus_check_decisions'));
  assert.ok(decisionInserts.length >= 1, 'At least one decision inserted');
});
