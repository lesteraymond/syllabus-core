// HTTP-level tests of POST /api/syllabi/format-reference (routes/syllabusContent.js): who may use it, and the limit on how many links one person may have looked
// up. Only text that is not a link is sent, so nothing is fetched. Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

async function withServer(fn) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  app.locals.db = { query: async (sql) => { if (sql.startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: 1 }]]; throw new Error('unexpected query: ' + sql); } };
  app.use('/api/syllabi', require('./syllabusContent'));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const post = async (as, body) => {
    const headers = { 'Content-Type': 'application/json', ...(as ? { 'x-test-user': JSON.stringify(as) } : {}) };
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/syllabi/format-reference`, { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: res.status, retryAfter: res.headers.get('retry-after'), body: await res.json().catch(() => ({})) };
  };
  try { await fn(post); } finally { await new Promise((r) => server.close(r)); }
}
const user = (id, role) => ({ id, role, firstName: 'T', lastName: 'U' });

test('only the people who write syllabi may have a link formatted', () => withServer(async (post) => {
  assert.equal((await post(null, { url: 'not a link' })).status, 401);
  for (const role of ['student', 'asst_vpaa', 'lic_director', 'vpaa']) assert.equal((await post(user(900, role), { url: 'not a link' })).status, 403, role);
  for (const [id, role] of [[901, 'faculty'], [902, 'admin']]) assert.equal((await post(user(id, role), { url: 'not a link' })).status, 400, role);
}));

test('a value that is not a link of at most 2,048 characters is refused and nothing is fetched', () => withServer(async (post) => {
  for (const url of [undefined, null, 5, {}, [], '', '   ', 'x'.repeat(2049), 'file:///etc/passwd', 'data:text/html,x', 'two https://a.example links', 'javascript:alert(1)']) {
    assert.equal((await post(user(903, 'faculty'), { url })).status, 400, String(url).slice(0, 30));
  }
}));

test('one person is limited to 30 links a minute; another person is not affected', () => withServer(async (post) => {
  for (let i = 0; i < 30; i += 1) assert.equal((await post(user(904, 'faculty'), { url: 'not a link' })).status, 400, `request ${i + 1}`);
  const over = await post(user(904, 'faculty'), { url: 'not a link' });
  assert.equal(over.status, 429);
  assert.ok(Number(over.retryAfter) >= 1 && Number(over.retryAfter) <= 60, String(over.retryAfter));
  assert.equal((await post(user(905, 'faculty'), { url: 'not a link' })).status, 400);
}));
