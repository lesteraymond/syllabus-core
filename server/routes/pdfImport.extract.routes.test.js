const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const importer = require('../lib/pdfImport');
const identity = require('../lib/pdfImportIdentity');
const assignments = require('../lib/assignments');
const academicYear = require('../lib/academicYear');
const router = require('./pdfImport');
const courses = [
  { course_id: 25, code: 'MA 7', title: 'Differential Calculus', program_code: 'BSIE' },
  { course_id: 26, code: 'IT 204', title: 'Programming 2', program_code: 'BSIT' },
  { course_id: 27, code: 'IT 204', title: 'Programming 2', program_code: 'BSCS' },
  { course_id: 28, code: 'OLD 1', title: 'Past subject', program_code: 'BSIT' },
];
async function withServer(t, { fields, assigned = [25, 26, 27, 28], past = [28] }, fn) {
  t.mock.method(importer, 'extractPdf', async () => ({ fields, pages: [] }));
  t.mock.method(assignments, 'loadAssignments', async () => ({ programIds: [], courseIds: assigned }));
  t.mock.method(assignments, 'requireCourseAccess', async () => {});
  t.mock.method(academicYear, 'pastCourseIds', async () => new Set(past));
  t.mock.method(identity, 'contextFor', async (db, id) => ({ selected: { id }, curricula: [] }));
  const app = express();
  app.locals.db = { query: async () => [courses] };
  app.use((req, res, next) => { req.session = req.headers['x-test-user'] ? { user: JSON.parse(req.headers['x-test-user']) } : {}; next(); });
  app.use('/api/syllabi', router);
  router.limiter.reset();
  const server = app.listen(0);
  await new Promise(resolve => server.on('listening', resolve));
  const call = async (user = { id: 5, role: 'faculty' }) => {
    const body = new FormData();
    body.append('file', new Blob([Buffer.from('%PDF-1.7\n%%EOF')], { type: 'application/pdf' }), 'syllabus.pdf');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/syllabi/pdf-import/extract`, { method: 'POST', headers: user ? { 'x-test-user': JSON.stringify(user) } : {}, body });
    return { status: response.status, body: await response.json() };
  };
  try { await fn(call); } finally { await new Promise(resolve => server.close(resolve)); }
}
test('extract without a subject returns the one assigned subject the PDF code names', t => withServer(t, { fields: { code: 'ma7', title: 'differential calculus' } }, async call => {
  const r = await call();
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.subject, { id: 25, code: 'MA 7', title: 'Differential Calculus', program: 'BSIE' });
  assert.equal(r.body.identityContext.selected.id, 25);
}));
test('extract requires authentication', t => withServer(t, { fields: { code: 'MA 7', title: 'Differential Calculus' } }, async call => {
  assert.equal((await call(null)).status, 401);
}));
test('extract refuses a subject that is not assigned, is from a past year, or is unknown', async t => {
  await withServer(t, { fields: { code: 'MA 7', title: 'Differential Calculus' }, assigned: [26] }, async call => assert.equal((await call()).status, 409));
  await withServer(t, { fields: { code: 'OLD 1', title: 'Past subject' } }, async call => assert.equal((await call()).status, 409));
  await withServer(t, { fields: { code: '', title: '' } }, async call => assert.equal((await call()).body.error, 'pdfImport.subjectNotFound'));
});
test('extract uses the PDF program to tell apart a code shared by two programs, and refuses an ambiguous one', async t => {
  await withServer(t, { fields: { code: 'IT 204', title: 'Programming 2', program: 'bscs' } }, async call => assert.equal((await call()).body.subject.id, 27));
  await withServer(t, { fields: { code: 'IT 204', title: 'Programming 2' } }, async call => assert.equal((await call()).body.error, 'pdfImport.chooseSubject'));
});
test('extract does not pick a subject that only shares the code: the title must match too', async t => {
  await withServer(t, { fields: { code: 'MA 7', title: 'Quantitative Methods' } }, async call => assert.equal((await call()).body.error, 'pdfImport.subjectNotFound'));
  await withServer(t, { fields: { code: 'MA 7', title: '' } }, async call => assert.equal((await call()).body.error, 'pdfImport.subjectNotFound'));
  await withServer(t, { fields: { code: 'IT 204', title: 'Programming 3' } }, async call => assert.equal((await call()).body.error, 'pdfImport.subjectNotFound'));
});
