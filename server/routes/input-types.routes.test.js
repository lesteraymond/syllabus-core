// HTTP-level tests for request values that must have the right type before they reach a query (docs/security/SECURITY-AUDIT-REPORT.md SEC-14).
// A reviewer's comment on a status change is text: an object or a list is refused with 400 before anything is read or written. In-memory fake database
// that fails the test if the route gets as far as the syllabus. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');

const vpaa = { id: 7, role: 'vpaa', firstName: 'V', lastName: 'P' };
const dean = { id: 1, role: 'admin', firstName: 'D', lastName: 'N' };

async function withServer(fn) {
  const reached = [];
  const db = {
    query: async (sql) => { if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: 1 }]]; reached.push(sql); throw new Error('the route went past the type check: ' + sql); },
    getConnection: async () => { reached.push('transaction'); throw new Error('the route opened a transaction'); },
  };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = db;
  app.use('/api/syllabi', require('./syllabi'));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const put = async (as, body) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/syllabi/5`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-test-user': JSON.stringify(as) }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  const quiet = console.error; console.error = () => {};
  try { await fn(put, reached); } finally { console.error = quiet; await new Promise((r) => server.close(r)); }
}

test('a status change whose comment is not text is refused with 400, before the syllabus is read', () => withServer(async (put, reached) => {
  for (const adminComment of [{ status: 'approved' }, ['a', 'b'], 42, true, null]) {
    for (const [as, status] of [[vpaa, 'approved'], [vpaa, 'under_review'], [dean, 'for_revision']]) {
      const res = await put(as, { status, adminComment });
      assert.strictEqual(res.status, 400, JSON.stringify({ status, adminComment }));
      assert.match(res.body.error, /comment must be text/i);
    }
  }
  assert.deepStrictEqual(reached, []);
}));

test('the title and course code of a content edit must be text too', () => withServer(async (put, reached) => {
  for (const body of [{ title: { a: 1 } }, { courseCode: ['IT', '101'] }, { note: { x: 1 } }, { curriculumId: { id: 1 } }]) {
    assert.strictEqual((await put(dean, body)).status, 400, JSON.stringify(body));
  }
  assert.deepStrictEqual(reached, []);
}));
