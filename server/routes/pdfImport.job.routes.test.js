// A PDF scan started with ?job=... is kept on the server, so the builder can pick it up again after a browser refresh (lib/pdfImportJobs.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const importer = require('../lib/pdfImport');
const identity = require('../lib/pdfImportIdentity');
const assignments = require('../lib/assignments');
const academicYear = require('../lib/academicYear');
const router = require('./pdfImport');
const courses = [{ course_id: 25, code: 'MA 7', title: 'Differential Calculus', program_code: 'BSIE' }];
const fields = { code: 'MA 7', title: 'Differential Calculus' };
const PDF = Buffer.from('%PDF-1.7\n%%EOF');
const faculty = { id: 5, role: 'faculty' };

async function withServer(t, fn) {
  const state = { existing: [], extract: async () => ({ fields, pages: [{ page: 1, method: 'text' }] }) };
  const syl = { syllabus_id: 1, user_id: 5, status: 'draft', course_id: 25, archived_at: null };
  t.mock.method(importer, 'extractPdf', (...args) => state.extract(...args));
  t.mock.method(assignments, 'loadAssignments', async () => ({ programIds: [], courseIds: [25] }));
  t.mock.method(assignments, 'requireCourseAccess', async () => {});
  t.mock.method(academicYear, 'pastCourseIds', async () => new Set());
  t.mock.method(academicYear, 'queryInSameYear', async () => [state.existing]);
  t.mock.method(identity, 'contextFor', async (db, id) => ({ selected: { id }, curricula: [] }));
  const app = express();
  app.locals.db = { query: async sql => (/FROM courses/.test(sql) ? [courses] : [[syl]]) };
  app.use((req, res, next) => { req.session = req.headers['x-test-user'] ? { user: JSON.parse(req.headers['x-test-user']) } : {}; next(); });
  app.use('/api/syllabi', router);
  router.limiter.reset();
  const server = app.listen(0);
  await new Promise(resolve => server.on('listening', resolve));
  const base = () => `http://127.0.0.1:${server.address().port}/api/syllabi`;
  const headers = user => (user ? { 'x-test-user': JSON.stringify(user) } : {});
  const upload = async (path, user = faculty) => {
    const body = new FormData();
    body.append('file', new Blob([PDF], { type: 'application/pdf' }), 'Calculus syllabus.pdf');
    const response = await fetch(base() + path, { method: 'POST', headers: headers(user), body });
    return { status: response.status, body: await response.json() };
  };
  const job = async (id, user = faculty) => {
    const response = await fetch(`${base()}/pdf-import/job/${id}`, { headers: headers(user) });
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  };
  const jobFile = async (id, user = faculty) => {
    const response = await fetch(`${base()}/pdf-import/job/${id}/file`, { headers: headers(user) });
    return { status: response.status, type: response.headers.get('content-type'), bytes: Buffer.from(await response.arrayBuffer()) };
  };
  try { await fn({ state, syl, upload, job, jobFile }); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('a scan named with ?job= can be read while it runs and after it ends, by its owner only, without scanning again', t => withServer(t, async ({ state, upload, job, jobFile }) => {
  let finish, scans = 0;
  state.extract = () => { scans++; return new Promise(resolve => { finish = resolve; }); };
  const posting = upload('/pdf-import/extract?job=jabc12345678');
  let running;
  for (let i = 0; i < 100 && !(running && running.status === 200); i++) { running = await job('jabc12345678'); if (running.status !== 200) await new Promise(r => setTimeout(r, 10)); }
  assert.equal(running.status, 200);
  assert.deepEqual(running.body, { state: 'running', kind: 'extract', file: { name: 'Calculus syllabus.pdf', size: PDF.length } });
  assert.match(running.cache, /no-store/);
  finish({ fields, pages: [{ page: 1, method: 'text' }] });
  const posted = await posting;
  assert.equal(posted.status, 200);
  const done = await job('jabc12345678');
  assert.equal(done.body.state, 'done');
  assert.deepEqual(done.body.result, posted.body, 'the same preview the upload answered');
  assert.equal(scans, 1);
  assert.equal((await job('jabc12345678', { id: 6, role: 'faculty' })).status, 404, 'another person never sees it');
  assert.equal((await job('jabc12345678', null)).status, 401);
  assert.equal((await job('jnotthis1234')).status, 404);
  const pdf = await jobFile('jabc12345678');
  assert.equal(pdf.status, 200);
  assert.equal(pdf.type, 'application/pdf');
  assert.deepEqual(pdf.bytes, PDF);
  assert.equal((await jobFile('jabc12345678', { id: 6, role: 'faculty' })).status, 404);
}));

test('a finished scan is checked against the syllabus as it is now: a draft created since is attached, a locked one refused', t => withServer(t, async ({ state, upload, job }) => {
  assert.equal((await upload('/pdf-import/extract?job=jabc12345678')).status, 200);
  assert.equal((await job('jabc12345678')).body.result.existingSyllabus, undefined);
  state.existing = [{ syllabus_id: 121, user_id: 5, status: 'draft' }];
  assert.deepEqual((await job('jabc12345678')).body.result.existingSyllabus, { id: 121, status: 'draft' });
  state.existing = [{ syllabus_id: 121, user_id: 5, status: 'submitted' }];
  const locked = await job('jabc12345678');
  assert.equal(locked.status, 409);
  assert.equal(locked.body.code, 'syllabus_exists');
}));

test('a failed scan keeps the answer the upload gave', t => withServer(t, async ({ state, upload, job }) => {
  state.extract = async () => ({ fields: { code: 'XX 1', title: 'Nothing' }, pages: [] });
  const posted = await upload('/pdf-import/extract?job=jabc12345678');
  assert.equal(posted.status, 409);
  const failed = await job('jabc12345678');
  assert.deepEqual(failed.body, { state: 'failed', kind: 'extract', file: { name: 'Calculus syllabus.pdf', size: PDF.length }, status: 409, error: posted.body });
}));

test('a scan of an existing draft is kept too, and is refused once that draft is locked', t => withServer(t, async ({ syl, upload, job }) => {
  const posted = await upload('/1/import-pdf?job=jdraft123456');
  assert.equal(posted.status, 200);
  const done = await job('jdraft123456');
  assert.equal(done.body.kind, 'syllabus');
  assert.deepEqual(done.body.result, posted.body);
  syl.status = 'submitted';
  assert.equal((await job('jdraft123456')).status, 409);
}));

test('without ?job= nothing is kept; a malformed job id is refused before the upload is read', t => withServer(t, async ({ upload, job }) => {
  assert.equal((await upload('/pdf-import/extract')).status, 200);
  const bad = await upload('/pdf-import/extract?job=bad');
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error, 'pdfImport.invalid');
  assert.equal((await job('bad')).status, 404);
}));
