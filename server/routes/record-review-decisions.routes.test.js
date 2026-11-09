'use strict';
// A recommendation decision acts on a report: while the syllabus waits for its record review none can be recorded, by the author, who otherwise may. Reading stays open. This is not syllabus approval.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const repo = require('../lib/syllabuscheck/repository');
const suggestion = { id: 'SEM:pair1', path: 'plan[0].tasks', replacement: 'Design and demonstrate a tested program.' };
async function start(t, reviews) {
  t.mock.method(repo, 'readReport', async () => ({ hybrid: { suggestions: [suggestion] } }));
  delete require.cache[require.resolve('./syllabusCheck')];
  const writes = [], app = express(); app.use(express.json());
  app.locals.db = { query: async (sql, params) => {
    if (sql.startsWith('SELECT user_id FROM users')) return [[{ user_id: params[0] }]];
    if (sql.startsWith('SELECT s.*, r.run_id')) return [[{ syllabus_id: 100, user_id: 26, status: 'draft', content: JSON.stringify({ meta: { program: 'BSIE' }, plan: [{ tasks: 'Old quiz' }] }) }]];
    if (sql.startsWith('SELECT decision_id')) return [[{ id: 1, action: 'reject' }]];
    if (/program_po_reference_remediation/.test(sql)) return [reviews];
    if (sql.startsWith('INSERT INTO')) { writes.push(sql); return [{ insertId: writes.length }]; }
    throw Error('Unexpected query: ' + sql);
  } };
  app.use((req, res, next) => { req.session = { user: { id: 26, role: 'faculty', firstName: 'A', lastName: 'B' } }; next(); });
  app.use('/api/syllabus-check', require('./syllabusCheck'));
  const server = app.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r)); t.after(() => new Promise((r) => server.close(r)));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/syllabus-check/runs/1/decisions';
  return { writes, get: async () => { const r = await fetch(base); return { status: r.status, body: await r.json() }; }, post: async (action) => { const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suggestionId: suggestion.id, action }) }); return { status: r.status, body: await r.json() }; } };
}
const PO = [{ migration_id: 'm', details_json: '{}' }], CURRICULUM = [{ migration_id: 'm', details_json: JSON.stringify({ curriculumReview: { program: 'BSIT' } }) }];
test('the author cannot record any decision while a PO mapping review is open, and nothing is written', async (t) => {
  const s = await start(t, PO);
  for (const action of ['accept', 'reject', 'undo', 'edit']) { const r = await s.post(action); assert.equal(r.status, 409, action); assert.equal(r.body.code, 'po_mapping_remediation_required'); }
  assert.deepEqual(s.writes, []);
});
test('nor while a curriculum review is open', async (t) => { const s = await start(t, CURRICULUM), r = await s.post('accept'); assert.equal(r.status, 409); assert.equal(r.body.code, 'curriculum_reference_review_required'); assert.deepEqual(s.writes, []); });
test('past decisions stay readable while the review is open', async (t) => { const s = await start(t, PO), r = await s.get(); assert.equal(r.status, 200); assert.equal(r.body.length, 1); assert.deepEqual(s.writes, []); });
test('with no open review the author decides as before', async (t) => { const s = await start(t, []), r = await s.post('accept'); assert.equal(r.status, 201, JSON.stringify(r.body)); assert.equal(s.writes.filter((w) => /syllabus_check_decisions/.test(w)).length, 1); });
