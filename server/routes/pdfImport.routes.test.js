const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const importer = require('../lib/pdfImport');
const identity = require('../lib/pdfImportIdentity');
const assignments = require('../lib/assignments');
const router = require('./pdfImport');
async function withServer(t, fn) {
  const syl = { syllabus_id: 1, user_id: 5, status: 'draft', course_id: 25, archived_at: null };
  const queries = [], accesses = [];
  t.mock.method(assignments, 'requireCourseAccess', async (db, me, course) => { accesses.push({ me, course }); });
  const identityContext = { selected: { id: 25, program: 'BSIE', code: 'MA 7', title: 'Differential Calculus' }, curricula: [] };
  t.mock.method(identity, 'contextFor', async () => identityContext);
  const app = express();
  app.locals.db = { query: async sql => { queries.push(sql); return [[syl]]; } };
  app.use((req, res, next) => { req.session = req.headers['x-test-user'] ? { user: JSON.parse(req.headers['x-test-user']) } : {}; next(); });
  app.use('/api/syllabi', router);
  router.limiter.reset();
  const server = app.listen(0);
  await new Promise(resolve => server.on('listening', resolve));
  const call = async (user = { id: 5, role: 'faculty' }, file = true, endpoint = '/1/import-pdf') => {
    const body = new FormData();
    if (file) body.append('file', new Blob([Buffer.from('%PDF-1.7\n%%EOF')], { type: 'application/pdf' }), 'syllabus.pdf');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/syllabi${endpoint}`, { method: 'POST', headers: user ? { 'x-test-user': JSON.stringify(user) } : {}, body });
    return { status: response.status, body: await response.json() };
  };
  try { await fn({ call, syl, queries, accesses }); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('PDF extraction requires authentication, ownership, editable status and an assigned subject', t => withServer(t, async ({ call, syl, accesses }) => {
  let extracts = 0;
  t.mock.method(importer, 'extractPdf', async () => { extracts++; return {}; });
  assert.equal((await call(null)).status, 401);
  assert.equal((await call({ id: 6, role: 'faculty' })).status, 404);
  syl.status = 'approved'; assert.equal((await call()).status, 409);
  syl.status = 'draft'; syl.course_id = null; assert.equal((await call()).status, 409);
  assert.equal(extracts, 0);
  assert.equal(accesses.length, 0);
}));
test('successful extraction is a private preview, with no draft, submission or AI writes', t => withServer(t, async ({ call, queries, accesses }) => {
  const preview = { fields: { code: 'MA 7' }, pages: [{ page: 1, method: 'text' }], requiresReview: true, aiCheckTriggered: false };
  t.mock.method(importer, 'extractPdf', async () => preview);
  const response = await call();
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ...preview, identityContext: { selected: { id: 25, program: 'BSIE', code: 'MA 7', title: 'Differential Calculus' }, curricula: [] } });
  assert.equal(accesses.length, 2);
  assert.ok(queries.every(query => query.startsWith('SELECT')));
}));
test('missing uploads are rejected before starting extraction', t => withServer(t, async ({ call }) => {
  let calls = 0;
  t.mock.method(importer, 'extractPdf', async () => { calls++; return {}; });
  assert.equal((await call(undefined, false)).status, 400);
  assert.equal(calls, 0);
}));
test('concurrent import is rejected and failure releases the active slot', t => withServer(t, async ({ call }) => {
  let enter, release, attempts = 0;
  const entered = new Promise(resolve => { enter = resolve; });
  const waiting = new Promise(resolve => { release = resolve; });
  t.mock.method(importer, 'extractPdf', async () => {
    if (++attempts === 1) { enter(); await waiting; throw Object.assign(new Error('pdfImport.unreadable'), { status: 422 }); }
    return { requiresReview: true };
  });
  const first = call();
  try {
    await entered;
    const second = await call();
    assert.equal(second.status, 409);
    assert.equal(second.body.error, 'pdfImport.busy');
    assert.equal(attempts, 1);
  } finally { release(); assert.equal((await first).status, 422); }
  assert.equal((await call()).status, 200);
  assert.equal(attempts, 2);
}));
test('a changed status during extraction invalidates the preview', t => withServer(t, async ({ call, syl }) => {
  t.mock.method(importer, 'extractPdf', async () => { syl.status = 'approved'; return {}; });
  const result = await call();
  assert.equal(result.status, 409);
  assert.equal(result.body.error, 'pdfImport.draftChanged');
}));
test('feature switch, assignment refusal and per-user import limits are enforced', t => withServer(t, async ({ call }) => {
  const old = process.env.SYLLABUS_PDF_IMPORT;
  try {
    process.env.SYLLABUS_PDF_IMPORT = 'off';
    assert.equal((await call()).status, 503);
  } finally { if (old === undefined) delete process.env.SYLLABUS_PDF_IMPORT; else process.env.SYLLABUS_PDF_IMPORT = old; }
  t.mock.method(assignments, 'requireCourseAccess', async () => { throw Object.assign(new Error('Unassigned'), { status: 403 }); });
  assert.equal((await call()).status, 403);
  t.mock.method(assignments, 'requireCourseAccess', async () => {});
  t.mock.method(importer, 'extractPdf', async () => ({}));
  for (let i = 0; i < 5; i++) assert.equal((await call()).status, 200);
  assert.equal((await call()).status, 429);
}));
