// HTTP-level tests for reading an uploaded syllabus file (GET /api/syllabi/:id/file). Uploaded files are private: they are served only by this route,
// to the owner and to a reviewer of a syllabus that is not a draft, and never by a public /uploads folder (SEC-01, SEC-03 in
// docs/security/SECURITY-AUDIT-REPORT.md). In-memory fake database and real files in a folder of their own. Run: npm test (project root).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const DIR = 'uploads-file-test-' + process.pid;
process.env.UPLOAD_DIR = DIR;
const ROOT = path.join(__dirname, '..', DIR);
fs.mkdirSync(path.join(ROOT, 'avatars'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'syllabi'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '1791000000000-1.pdf'), '%PDF-1.4 current %%EOF');
fs.writeFileSync(path.join(ROOT, '1791000000000-2.pdf'), '%PDF-1.4 older %%EOF');
fs.writeFileSync(path.join(ROOT, 'syllabi', 'data-analytics.pdf'), '%PDF-1.4 legacy %%EOF');
fs.writeFileSync(path.join(ROOT, 'avatars', 'u1.pdf'), 'not for anyone');
fs.writeFileSync(path.join(ROOT, 'notes.html'), '<script>alert(1)</script>');
fs.writeFileSync(path.join(__dirname, '..', DIR + '-outside.pdf'), 'outside the upload folder');
test.after(() => { fs.rmSync(ROOT, { recursive: true, force: true }); fs.rmSync(path.join(__dirname, '..', DIR + '-outside.pdf'), { force: true }); });

const dean = { id: 1, role: 'admin' }, fay = { id: 5, role: 'faculty' }, gus = { id: 6, role: 'faculty' }, vpaa = { id: 7, role: 'vpaa' }, student = { id: 8, role: 'student' };

function makeDb() {
  const syllabi = {
    10: { syllabus_id: 10, user_id: 5, status: 'submitted', file_path: '/uploads/1791000000000-1.pdf' },
    11: { syllabus_id: 11, user_id: 5, status: 'draft', file_path: '/uploads/syllabi/data-analytics.pdf' },
    12: { syllabus_id: 12, user_id: 5, status: 'submitted', file_path: null },
    13: { syllabus_id: 13, user_id: 5, status: 'submitted', file_path: '/uploads/../' + DIR + '-outside.pdf' },
    14: { syllabus_id: 14, user_id: 5, status: 'submitted', file_path: '/uploads/avatars/u1.pdf' },
    15: { syllabus_id: 15, user_id: 5, status: 'submitted', file_path: '/uploads/notes.html' },
    16: { syllabus_id: 16, user_id: 5, status: 'submitted', file_path: '/uploads/gone.pdf' },
    17: { syllabus_id: 17, user_id: 5, status: 'submitted', file_path: '/uploads/%61vatars/u1.pdf' },
  };
  const versions = [{ version_id: 100, syllabus_id: 10, file_path: '/uploads/1791000000000-2.pdf' }, { version_id: 101, syllabus_id: 11, file_path: '/uploads/syllabi/data-analytics.pdf' }];
  const handle = (sql, p = []) => {
    if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: p[0] }]];
    if (sql.startsWith('SELECT syllabus_id, user_id, status, file_path FROM syllabi WHERE syllabus_id')) return [syllabi[p[0]] ? [{ ...syllabi[p[0]] }] : []];
    if (sql.startsWith('SELECT file_path FROM syllabus_versions WHERE version_id = ? AND syllabus_id = ?')) return [versions.filter((v) => v.version_id === p[0] && v.syllabus_id === p[1]).map((v) => ({ file_path: v.file_path }))];
    throw new Error('unexpected query: ' + sql);
  };
  return { query: async (q, p) => handle(q, p) };
}

async function withServer(fn) {
  const app = express();
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = makeDb();
  app.use('/api/syllabi', require('./syllabusFiles'));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const get = async (as, route) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/syllabi${route}`, { headers: as ? { 'x-test-user': JSON.stringify(as) } : {} });
    return { status: res.status, headers: res.headers, text: await res.text() };
  };
  try { await fn(get); } finally { await new Promise((r) => server.close(r)); }
}

test('a signed-out caller gets 401 on an uploaded file', () => withServer(async (get) => {
  assert.strictEqual((await get(null, '/10/file')).status, 401);
  assert.strictEqual((await get(null, '/10/file?version=100')).status, 401);
}));

test('the owner and a reviewer read the file; another faculty member gets 404, and a reviewer never reads a draft', () => withServer(async (get) => {
  const mine = await get(fay, '/10/file');
  assert.strictEqual(mine.status, 200);
  assert.match(mine.text, /current/);
  for (const reviewer of [dean, vpaa]) assert.strictEqual((await get(reviewer, '/10/file')).status, 200);
  assert.strictEqual((await get(gus, '/10/file')).status, 404);       // a colleague's submitted syllabus
  assert.strictEqual((await get(fay, '/11/file')).status, 200);       // the owner's own draft, in a subfolder of the upload folder
  assert.strictEqual((await get(dean, '/11/file')).status, 404);      // a draft is the author's alone
  assert.strictEqual((await get(fay, '/999/file')).status, 404);
  assert.strictEqual((await get(fay, '/abc/file')).status, 404);
  assert.strictEqual((await get(fay, '/12/file')).status, 404);       // no file on this syllabus
}));

test('the file is sent as a private PDF that the browser may not sniff or cache', () => withServer(async (get) => {
  const res = await get(fay, '/10/file');
  assert.match(res.headers.get('content-type'), /^application\/pdf/);
  assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
  assert.strictEqual(res.headers.get('cache-control'), 'private, no-store');
  assert.match(res.headers.get('content-disposition'), /^inline; filename="1791000000000-1\.pdf"/);
  assert.match((await get(fay, '/10/file?download=1')).headers.get('content-disposition'), /^attachment; filename="1791000000000-1\.pdf"/);
}));

test('?version= reads the file of one of this syllabus\'s versions, and only of this syllabus', () => withServer(async (get) => {
  const older = await get(dean, '/10/file?version=100');
  assert.strictEqual(older.status, 200);
  assert.match(older.text, /older/);
  assert.strictEqual((await get(dean, '/10/file?version=101')).status, 404); // a version of another syllabus
  assert.strictEqual((await get(dean, '/10/file?version=x')).status, 404);
  assert.strictEqual((await get(gus, '/10/file?version=100')).status, 404);
}));

test('a stored path never leaves the upload folder, never reaches the old avatars folder, and is only ever a PDF', () => withServer(async (get) => {
  for (const id of [13, 14, 15, 17]) assert.strictEqual((await get(fay, `/${id}/file`)).status, 404, 'syllabus ' + id);
  assert.strictEqual((await get(fay, '/16/file')).status, 404); // the file is missing on disk
}));

test('the resolver accepts only /uploads/<name>.pdf paths inside the folder', () => {
  const { storedFile } = require('./syllabusFiles');
  assert.strictEqual(storedFile('/uploads/a-1.pdf', ROOT), path.join(ROOT, 'a-1.pdf'));
  assert.strictEqual(storedFile('/uploads/syllabi/data analytics.PDF', ROOT), path.join(ROOT, 'syllabi', 'data analytics.PDF'));
  for (const bad of [null, '', 'a.pdf', '/uploads/', '/uploads/a.exe', '/uploads/../a.pdf', '/uploads/x/../../a.pdf', '/uploads/avatars/a.pdf', '/uploads/AVATARS/a.pdf', '/uploads//a.pdf', '/uploads/.hidden.pdf', '/uploads/a\\..\\b.pdf', '/uploads/%2e%2e/a.pdf', '/etc/passwd', 'C:\\x\\a.pdf', '/uploads/a.pdf\0.png', {}]) {
    assert.strictEqual(storedFile(bad, ROOT), null, String(bad));
  }
});

test('server/index.js serves no public folder: uploaded files are reachable only through the authorized route', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  assert.doesNotMatch(source, /express\.static/);
  assert.match(source, /require\(["']\.\/routes\/syllabusFiles["']\)/);
});

test('a student account is not served a file by this route on its own merits (it owns no syllabus)', () => withServer(async (get) => {
  assert.strictEqual((await get(student, '/10/file')).status, 404);
}));
