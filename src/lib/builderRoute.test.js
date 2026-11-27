import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { builderHash, builderState, newImportJobId, pageOfHash, readHash, routeOnLoad } from './builderRoute.js';

test('the page is the hash before any "?", with or without a leading slash; a malformed hash is no page', () => {
  assert.equal(pageOfHash('#reports'), 'reports');
  assert.equal(pageOfHash('#/my-syllabi'), 'my-syllabi');
  assert.equal(pageOfHash('#builder?id=3&mode=upload'), 'builder');
  assert.equal(pageOfHash(''), '');
  assert.equal(pageOfHash('#%E0%A4%A'), '');
  assert.equal(readHash('#builder?id=3').params.get('id'), '3');
});

test('builder hash round-trips the draft, the open PDF import and its scan', () => {
  const hash = builderHash({ id: 12, mode: 'upload', job: 'jabc12345678' });
  assert.equal(hash, '#builder?id=12&mode=upload&job=jabc12345678');
  assert.deepEqual(builderState(hash), { id: 12, mode: 'upload', job: 'jabc12345678' });
  assert.equal(builderHash({}), '#builder');
  assert.equal(builderHash({ id: 12, mode: 'form', job: 'jabc12345678' }), '#builder?id=12', 'a scan belongs to the upload tab only');
  assert.equal(builderHash({ mode: 'upload', job: 'bad id!' }), '#builder?mode=upload', 'an unusable job id is left out');
});

test('builder state drops anything unusable', () => {
  assert.equal(builderState('#reports'), null);
  assert.deepEqual(builderState('#builder'), { id: null, mode: null, job: null });
  assert.deepEqual(builderState('#builder?id=-4&mode=weird&job=jabc12345678'), { id: null, mode: null, job: null });
  assert.deepEqual(builderState('#builder?id=1.5&mode=upload&job=x'), { id: null, mode: 'upload', job: null });
});

test('a page load reopens the builder on a saved draft or an open PDF import, and a bare #builder opens My Syllabi as before', () => {
  assert.deepEqual(routeOnLoad('#builder'), { page: 'my-syllabi', editing: null, restore: null });
  assert.deepEqual(routeOnLoad('#builder?mode=upload&job=jabc12345678'), { page: 'builder', editing: null, restore: { mode: 'upload', job: 'jabc12345678' } });
  assert.deepEqual(routeOnLoad('#builder?id=7&mode=upload&job=jabc12345678'), { page: 'builder', editing: { syllabusId: 7 }, restore: { mode: 'upload', job: 'jabc12345678' } });
  assert.deepEqual(routeOnLoad('#builder?id=7'), { page: 'builder', editing: { syllabusId: 7 }, restore: { mode: 'form', job: null } });
  assert.deepEqual(routeOnLoad('#my-syllabi'), { page: 'my-syllabi', editing: null, restore: null });
  assert.deepEqual(routeOnLoad('#reports'), { page: 'reports', editing: null, restore: null });
  assert.deepEqual(routeOnLoad(''), { page: '', editing: null, restore: null });
});

test('scan ids are valid in the URL and differ each time, with or without crypto.randomUUID', () => {
  const a = newImportJobId(), b = newImportJobId();
  assert.notEqual(a, b);
  for (const id of [a, b]) assert.match(id, /^[A-Za-z0-9_-]{8,64}$/);
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
  try { assert.match(newImportJobId(), /^[A-Za-z0-9_-]{8,64}$/); }
  finally { Object.defineProperty(globalThis, 'crypto', saved); }
});

test('the rebuilt builder is the default: only VITE_NEW_BUILDER=false goes back, so a build without any .env ships the rebuilt one', () => {
  const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(app, /const NEW_BUILDER = import.meta.env.VITE_NEW_BUILDER !== 'false';/);
});
