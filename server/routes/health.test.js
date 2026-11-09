'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const health = require('./health');

async function call(db) {
  const app = express(); app.locals.db = db; app.use('/api/health', health);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    return { status: r.status, cache: r.headers.get('cache-control'), body: await r.json() };
  } finally { server.close(); }
}

test('health: ok when the database answers, and it reveals nothing else', async () => {
  const r = await call({ query: async () => [[{ 1: 1 }]] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { status: 'ok', database: 'ok' });
  assert.equal(r.cache, 'no-store');
});

test('health: 503 when the database fails, without leaking the error text', async () => {
  const r = await call({ query: async () => { throw Object.assign(new Error('connect ECONNREFUSED 10.1.2.3:3306 user=secret_user'), { code: 'ECONNREFUSED' }); } });
  assert.equal(r.status, 503);
  assert.deepEqual(r.body, { status: 'unavailable', database: 'unreachable' });
  assert.ok(!/10\.1\.2\.3|secret_user|ECONNREFUSED/.test(JSON.stringify(r.body)));
});

test('health: 503 when there is no database handle', async () => {
  const r = await call(undefined);
  assert.equal(r.status, 503);
});
