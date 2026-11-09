'use strict';
// A saved AI Checker report stays readable while its syllabus waits for a record review, and nothing that makes a new judgment gets past that review.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const repo = require('./repository');
const refs = require('../programPoReferences');
const svc = require('../compliance/service');

const SERVER = path.resolve(__dirname, '../..');
const PO_MESSAGE = 'This historical syllabus has unresolved PO mapping remediation. Replacing only the PO text cannot confirm old CLO mappings. Faculty must review them; saved content and reports remain unchanged.';
const CURRICULUM_MESSAGE = 'This historical syllabus uses a previous curriculum reference. Review its course identity and approved BSIT curriculum selection before checking. No saved content was changed.';
const open = (details = '{}') => [[{ migration_id: 'mig-1', details_json: details }]];
const none = [[]];
// A database that answers the review query, and fails the test if anything tries to write.
function reader(reviewRows) {
  const writes = [];
  return { writes, query: async (sql) => { if (!/^\s*(SELECT|SHOW)/i.test(sql)) writes.push(sql); return /program_po_reference_remediation/.test(sql) ? reviewRows : [[]]; } };
}
const saved = (over = {}) => ({ score: 92, fingerprint: 'then', findings: [{ id: 'F1', ruleId: 'R', severity: 'warning', message: 'saved finding' }], hybrid: { ready: true, critical: false, score: 92, checkedAt: new Date().toISOString(), checkedMeta: { program: 'BSIT' }, alignment: { status: 'completed', provider: 'p', model: 'm' }, referenceContext: { po: { reference: { version: 'lcup-po-2026-10-29' } } }, ...over.hybrid }, ...over.top });
const row = (over = {}) => ({ run_id: 7, syllabus_id: 101, standard_version: svc.standard.version, overall: 92, band: 'Excellent', status: 'scored', passed: 1, created_at: '2026-10-01 10:00:00', ...over });
const load = async (t, { report = saved(), masters = {}, runRow = row() } = {}) => {
  t.mock.method(repo, 'readReport', async () => structuredClone(report));
  const calls = []; t.mock.method(repo, 'mastersFor', async (db, content, options) => { calls.push(options); return { fingerprint: 'then', ...masters }; });
  const db = reader(none);
  return { result: await svc.loadDetail(db, runRow, null), calls, db };
};

test('the guard still refuses anything that judges, with the same status, code, details and message', async () => {
  await assert.rejects(refs.assertRecordReview(reader(open()), 101), (e) => { assert.equal(e.status, 409); assert.equal(e.message, PO_MESSAGE); assert.deepEqual(e.body, { code: 'po_mapping_remediation_required', syllabusId: 101, migrationId: 'mig-1' }); return true; });
  await assert.rejects(refs.assertRecordReview(reader(open(JSON.stringify({ curriculumReview: { program: 'BSIT' } }))), 110), (e) => { assert.equal(e.status, 409); assert.equal(e.message, CURRICULUM_MESSAGE); assert.deepEqual(e.body, { code: 'curriculum_reference_review_required', syllabusId: 110, migrationId: 'mig-1', reviewRequirements: { program: 'BSIT' } }); return true; });
  await assert.rejects(refs.assertRecordReview(reader(open(JSON.stringify({ curriculumReview: { program: 'BSIT' }, cloMappings: [1] }))), 110), (e) => e.body.code === 'po_mapping_remediation_required');
  await assert.rejects(refs.assertRecordReview(reader(open('not json')), 1), (e) => e.body.code === 'po_mapping_remediation_required');
  await refs.assertRecordReview(reader(none), 1); await refs.assertRecordReview(reader(open()), null);
  await refs.assertRecordReview({ query: async () => { throw Object.assign(new Error('x'), { code: 'ER_NO_SUCH_TABLE' }); } }, 1);
  await assert.rejects(refs.assertRecordReview({ query: async () => { throw Object.assign(new Error('down'), { code: 'ECONNRESET' }); } }, 1), /down/);
});
test('recordReviewOf only reports: it names the review, and never refuses', async () => {
  assert.equal((await refs.recordReviewOf(reader(open()), 101)).code, 'po_mapping_remediation_required');
  assert.equal((await refs.recordReviewOf(reader(open(JSON.stringify({ curriculumReview: {} }))), 110)).code, 'curriculum_reference_review_required');
  assert.equal(await refs.recordReviewOf(reader(none), 1), null); assert.equal(await refs.recordReviewOf(reader(open()), null), null);
  assert.equal(await refs.recordReviewOf({ query: async () => { throw Object.assign(new Error('x'), { code: 'ER_NO_SUCH_TABLE' }); } }, 1), null);
});
test('mastersFor refuses by default: a caller must ask for a historical read', async () => {
  const db = reader(open());
  await assert.rejects(repo.mastersFor(db, { meta: {} }, { syllabusId: 101 }), (e) => e.body.code === 'po_mapping_remediation_required');
  await assert.rejects(repo.mastersFor(db, { meta: {} }, { syllabusId: 101, historicalRead: false }), (e) => e.body.code === 'po_mapping_remediation_required');
});
test('only the saved-report read may pass the review: every other mastersFor call keeps the guard', () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.name === 'node_modules' || e.name === 'uploads' ? [] : e.isDirectory() ? walk(path.join(dir, e.name)) : /\.c?js$/.test(e.name) && !/\.test\.js$/.test(e.name) ? [path.join(dir, e.name)] : []));
  const users = walk(SERVER).filter((f) => /historicalRead\s*:\s*true/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(SERVER, f).replace(/\\/g, '/'));
  assert.deepEqual(users, ['lib/compliance/service.js']);
  assert.equal((fs.readFileSync(path.join(SERVER, 'lib/compliance/service.js'), 'utf8').match(/historicalRead\s*:\s*true/g) || []).length, 1, 'one call site, in loadDetail');
  for (const file of ['lib/compliance/service.js', 'routes/syllabusCheck.js']) { const source = fs.readFileSync(path.join(SERVER, file), 'utf8'); for (const line of source.split('\n').filter((l) => /mastersFor\(/.test(l) && !/historicalRead/.test(l) && !/^\s*\/\//.test(l))) assert.match(line, /syllabusId/, 'a check path names its syllabus, so the guard runs: ' + line.trim()); }
});
test('checkHybrid and the submit gate still pass through the guard', async () => {
  const db = reader(open());
  await assert.rejects(svc.checkHybrid(db, { meta: {} }, { syllabusId: 101 }), (e) => e.body.code === 'po_mapping_remediation_required');
  const installed = { query: async (sql) => (/program_po_reference_remediation/.test(sql) ? open() : [[{ n: 1 }]]) };
  await assert.rejects(svc.requireHybrid(installed, 101, { meta: {} }), (e) => e.body.code === 'po_mapping_remediation_required');
});
test('a saved report asks for a historical read, and is told about the review', async (t) => {
  const { calls } = await load(t);
  assert.deepEqual(calls, [{ syllabusId: 101, historicalRead: true }]);
});
test('a saved report under review keeps its score, findings, references and timestamps', async (t) => {
  const report = saved();
  const { result, db } = await load(t, { report, masters: { recordReview: { code: 'po_mapping_remediation_required', syllabusId: 101, migrationId: 'mig-1' } } });
  assert.equal(result.overall, 92); assert.equal(result.score, 92); assert.equal(result.passed, true); assert.equal(result.status, 'scored');
  assert.deepEqual(result.findings, report.findings); assert.deepEqual(result.hybrid.referenceContext, report.hybrid.referenceContext); assert.deepEqual(result.hybrid.alignment, report.hybrid.alignment);
  assert.equal(result.hybrid.checkedAt, report.hybrid.checkedAt); assert.equal(result.referenceHash, 'then'); assert.ok(result.createdAt);
  assert.deepEqual(db.writes, [], 'reading writes nothing');
});
test('a saved report under review can never count as a current check', async (t) => {
  const { result } = await load(t, { masters: { recordReview: { code: 'po_mapping_remediation_required' } } });
  assert.equal(result.stale, true); assert.equal(result.hybrid.ready, false);
  assert.deepEqual(result.recordReview, { code: 'po_mapping_remediation_required', savedReady: true }, 'no migration id or other internals reach the browser');
});
test('a report that was incomplete when saved stays incomplete: the review shows no score it never had', async (t) => {
  const { result } = await load(t, { report: saved({ hybrid: { ready: false, critical: false } }), masters: { recordReview: { code: 'po_mapping_remediation_required' } } });
  assert.equal(result.overall, null); assert.equal(result.status, 'incomplete'); assert.equal(result.recordReview.savedReady, false);
});
test('a normal syllabus is unchanged: no marker, and current while its fingerprint matches', async (t) => {
  const { result } = await load(t, {});
  assert.equal(result.recordReview, undefined); assert.equal(result.hybrid.ready, true); assert.ok(!result.stale);
});
test('a normal report still goes out of date when the references change', async (t) => {
  t.mock.method(repo, 'readReport', async () => saved());
  t.mock.method(repo, 'mastersFor', async () => ({ fingerprint: 'now' }));
  const result = await svc.loadDetail(reader(none), row(), null);
  assert.equal(result.stale, true); assert.equal(result.hybrid.ready, false); assert.equal(result.recordReview, undefined);
});
test('a run with no saved report needs no references, and carries no marker on a normal syllabus', async (t) => {
  const mastersFor = t.mock.method(repo, 'mastersFor', async () => ({ fingerprint: 'x' }));
  const result = await svc.loadDetail(reader(none), row({ standard_version: 'legacy-1' }), null);
  assert.equal(mastersFor.mock.callCount(), 0); assert.equal(result.recordReview, undefined); assert.ok(!result.stale);
});
test('a run with no saved report is still marked while its syllabus is under review, with its stored score', async (t) => {
  t.mock.method(repo, 'mastersFor', async () => { throw Error('references are not needed to read a stored run'); });
  const db = reader(open()), result = await svc.loadDetail(db, row({ standard_version: 'legacy-1' }), null);
  assert.deepEqual(result.recordReview, { code: 'po_mapping_remediation_required', savedReady: true }); assert.equal(result.stale, true); assert.equal(result.overall, 92); assert.equal(result.passed, true); assert.deepEqual(db.writes, []);
});
test('openRecordReviews reads many syllabi at once, and never refuses', async () => {
  const seen = [], db = { query: async (sql, params) => { seen.push(sql); assert.ok(/^SELECT/.test(sql)); return [[{ entity_id: 1, details_json: '{}' }, { entity_id: 2, details_json: JSON.stringify({ curriculumReview: {} }) }, { entity_id: 3, details_json: 'not json' }]]; } };
  const out = await refs.openRecordReviews(db, [1, 2, 3, 4]);
  assert.deepEqual([...out], [[1, 'po_mapping_remediation_required'], [2, 'curriculum_reference_review_required'], [3, 'po_mapping_remediation_required']]); assert.equal(seen.length, 1);
  assert.equal((await refs.openRecordReviews({ query: async () => { throw Error('no call for an empty list'); } }, [])).size, 0);
  assert.equal((await refs.openRecordReviews({ query: async () => { throw Object.assign(new Error('x'), { code: 'ER_NO_SUCH_TABLE' }); } }, [1])).size, 0);
  await assert.rejects(refs.openRecordReviews({ query: async () => { throw Object.assign(new Error('down'), { code: 'ECONNRESET' }); } }, [1]), /down/);
});
