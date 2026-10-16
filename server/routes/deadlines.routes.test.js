// HTTP-level tests for the deadline routes: who may call what, how ids and errors are answered, and the "not set up yet" answer before the
// migration. The queries themselves are tested in lib/deadlines.test.js, so here the library functions are replaced by recorders.
// Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const lib = require('../lib/deadlines');

const admin = { id: 1, role: 'admin', firstName: 'Diana', lastName: 'Evale' };
const fay = { id: 5, role: 'faculty', firstName: 'Fay', lastName: 'F' };

async function withServer(fn, stubs = {}, notifier = null) {
  const originals = {};
  const calls = [];
  for (const name of ['listForAdmin', 'mine', 'createDeadline', 'updateDeadline', 'cancelDeadline', 'progress']) {
    originals[name] = lib[name];
    lib[name] = stubs[name] ? async (...args) => { calls.push([name, ...args.slice(1)]); return stubs[name](...args); } : async () => { throw new Error(name + ' was not expected'); };
  }
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const h = req.headers['x-test-user']; req.session = h ? { user: JSON.parse(h) } : {}; next(); });
  if (notifier) app.locals.deadlineNotices = notifier;
  app.locals.db = { query: async (text, p = []) => { if (String(text).startsWith('SELECT user_id FROM users WHERE user_id')) return [[{ user_id: p[0] }]]; throw new Error('unexpected query'); } };
  app.use('/api/deadlines', require('./deadlines'));
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const call = async (method, path, as, body) => {
    if (method === 'GET') body = undefined;                  // a GET has no body
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/deadlines${path}`, {
      method, headers: { ...(as ? { 'x-test-user': JSON.stringify(as) } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  try { await fn({ call, calls }); } finally { await new Promise((r) => server.close(r)); Object.assign(lib, originals); }
}

test('every route needs a signed-in user, and the administrator routes refuse faculty', () => withServer(async ({ call }) => {
  for (const [method, path] of [['GET', ''], ['GET', '/mine'], ['POST', '/course/10'], ['PUT', '/3'], ['DELETE', '/3'], ['GET', '/3/progress'], ['POST', '/3/remind']]) {
    assert.strictEqual((await call(method, path)).status, 401, method + ' ' + path + ' without sign-in');
  }
  for (const [method, path] of [['GET', ''], ['POST', '/course/10'], ['PUT', '/3'], ['DELETE', '/3'], ['GET', '/3/progress'], ['POST', '/3/remind']]) {
    assert.strictEqual((await call(method, path, fay, {})).status, 403, method + ' ' + path + ' as faculty');
  }
}));

test('the administrator lists deadlines, and the answer says tracking is enabled', () => withServer(async ({ call }) => {
  const r = await call('GET', '', admin);
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body, { enabled: true, deadlines: [{ id: 3 }] });
}, { listForAdmin: async () => [{ id: 3 }] }));

test('a faculty member reads only their own deadlines, and an administrator gets an empty list there', () => withServer(async ({ call, calls }) => {
  assert.deepStrictEqual((await call('GET', '/mine', fay)).body, { enabled: true, deadlines: [{ id: 3, status: 'upcoming' }] });
  assert.deepStrictEqual(calls, [['mine', 5]], 'the signed-in user decides whose; there is no way to ask for another');
  assert.deepStrictEqual((await call('GET', '/mine?userId=6', admin)).body, { enabled: true, deadlines: [] });
}, { mine: async () => [{ id: 3, status: 'upcoming' }] }));

test('setting, changing and cancelling a deadline pass the right ids and the form to the library', () => withServer(async ({ call, calls }) => {
  const form = { term: 'T', dueAt: '2027-01-01T00:00:00Z' };
  assert.strictEqual((await call('POST', '/course/10', admin, form)).body.deadline.id, 7);
  assert.strictEqual((await call('PUT', '/7', admin, { ...form, instructions: 'x' })).body.deadline.id, 7);
  assert.strictEqual((await call('DELETE', '/7', admin)).body.message, 'Deadline cancelled');
  assert.deepStrictEqual(calls.map((c) => [c[0], c[1]]), [['createDeadline', 1], ['updateDeadline', 7], ['cancelDeadline', 7]]);
  assert.deepStrictEqual(calls[0].slice(2), [10, form], 'the administrator, the subject and the form');
}, { createDeadline: async () => ({ deadline: { id: 7 } }), updateDeadline: async () => ({ deadline: { id: 7 } }), cancelDeadline: async () => ({}) }));

test('the progress of one deadline is the administrator\'s to read', () => withServer(async ({ call }) => {
  const r = await call('GET', '/7/progress', admin);
  assert.deepStrictEqual(r.body, { enabled: true, people: [{ name: 'Fay' }], summary: { total: 1 } });
}, { progress: async () => ({ people: [{ name: 'Fay' }], summary: { total: 1 } }) }));

test('a bad id is a 404 and the library is not asked', () => withServer(async ({ call, calls }) => {
  for (const [method, path] of [['POST', '/course/abc'], ['POST', '/course/0'], ['PUT', '/-1'], ['DELETE', '/x'], ['GET', '/1.5/progress']]) {
    assert.strictEqual((await call(method, path, admin, {})).status, 404, method + ' ' + path);
  }
  assert.deepStrictEqual(calls, []);
}));

test('library errors keep their status and message: a bad form is 400, a clash is 409, a missing one is 404', () => withServer(async ({ call }) => {
  const r = await call('POST', '/course/10', admin, {});
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.body.error, 'The due date must be in the future.');
  assert.strictEqual((await call('PUT', '/9', admin, {})).status, 409);
  assert.strictEqual((await call('DELETE', '/9', admin)).status, 404);
}, {
  createDeadline: async () => { throw Object.assign(new Error('The due date must be in the future.'), { status: 400 }); },
  updateDeadline: async () => { throw Object.assign(new Error('clash'), { status: 409 }); },
  cancelDeadline: async () => { throw Object.assign(new Error('Deadline not found'), { status: 404 }); },
}));

test('before the migration has run, every route answers enabled: false instead of an error', () => withServer(async ({ call }) => {
  const missing = { enabled: false };
  assert.deepStrictEqual((await call('GET', '', admin)).body, missing);
  assert.deepStrictEqual((await call('GET', '/mine', fay)).body, missing);
  assert.deepStrictEqual((await call('GET', '/3/progress', admin)).body, missing);
  assert.deepStrictEqual((await call('POST', '/course/10', admin, {})).body, missing);
}, {
  listForAdmin: async () => { throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' }); },
  mine: async () => { throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' }); },
  progress: async () => { throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' }); },
  createDeadline: async () => { throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' }); },
}));

test('after a save, the assigned faculty are told, and the answer says how many; a notifier problem does not change the save', () => {
  const told = [];
  const notifier = {
    onCreated: async (d) => { told.push(['created', d.id]); return { notified: 3, emailed: 2 }; },
    onUpdated: async (before, after) => { told.push(['updated', before.id, after.id]); return { notified: 2, emailed: 2 }; },
    onCancelled: async (d) => { told.push(['cancelled', d.id]); return { notified: 1, emailed: 0 }; },
  };
  return withServer(async ({ call }) => {
    const form = { term: 'T', dueAt: '2027-01-01T00:00:00Z' };
    assert.deepStrictEqual((await call('POST', '/course/10', admin, form)).body.notices, { notified: 3, emailed: 2 });
    assert.deepStrictEqual((await call('PUT', '/7', admin, form)).body.notices, { notified: 2, emailed: 2 });
    assert.deepStrictEqual((await call('DELETE', '/7', admin)).body.notices, { notified: 1, emailed: 0 });
    assert.deepStrictEqual(told, [['created', 7], ['updated', 6, 7], ['cancelled', 7]]);
  }, { createDeadline: async () => ({ deadline: { id: 7 } }), updateDeadline: async () => ({ previous: { id: 6 }, deadline: { id: 7 } }), cancelDeadline: async () => ({ deadline: { id: 7 } }) }, notifier);
});

test('without a notifier a deadline is still saved, and the answer simply has no notices', () => withServer(async ({ call }) => {
  const r = await call('POST', '/course/10', admin, { term: 'T' });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.deadline.id, 7); assert.strictEqual(r.body.notices, null);
}, { createDeadline: async () => ({ deadline: { id: 7 } }) }));

test('Remind passes the deadline, the chosen people (cleaned) and the administrator to the notifier, and returns what it says', () => {
  const calls = [];
  const notifier = { remind: async (...a) => { calls.push(a); return { sent: 2, emailed: 1, skipped: [{ userId: 9, reason: 'cooldown' }] }; } };
  return withServer(async ({ call }) => {
    const r = await call('POST', '/7/remind', admin, { userIds: [5, '6', 'x', -1, 0, 7.5, 8] });
    assert.deepStrictEqual(r.body, { enabled: true, sent: 2, emailed: 1, skipped: [{ userId: 9, reason: 'cooldown' }] });
    assert.deepStrictEqual(calls[0], [7, [5, 6, 8], 1]);
    await call('POST', '/7/remind', admin, {});
    assert.deepStrictEqual(calls[1], [7, [], 1], 'no list means everyone who has not submitted');
    assert.strictEqual((await call('POST', '/abc/remind', admin, {})).status, 404);
    assert.strictEqual(calls.length, 2);
  }, {}, notifier);
});

test('Remind without a notifier answers that nothing was sent, and a 404 from the notifier stays a 404', async () => {
  await withServer(async ({ call }) => { assert.deepStrictEqual((await call('POST', '/7/remind', admin, {})).body, { enabled: true, sent: 0, emailed: 0, skipped: [] }); });
  await withServer(async ({ call }) => { assert.strictEqual((await call('POST', '/7/remind', admin, {})).status, 404); }, {},
    { remind: async () => { throw Object.assign(new Error('Deadline not found'), { status: 404 }); } });
});
