// Corrected-behavior regressions. Historical defect evidence remains in the
// frozen source snapshots and docs/lcup-approved-offline/REPORT.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mapPdfFields } from '../../src/lib/pdfImport.js';
const draft = (program = 'BSIT', code = 'IT 202', title = 'Computer Programming 1') => ({ meta: { program, code, title, prereq: 'CATALOG PRECONDITION' }, outcomes: { vision: '', mission: { lead: '', items: [] }, egas: [1, 2, 3, 4].map(no => ({ no, name: `EGA ${no}`, short: `EGA ${no}` })), pos: Array.from({ length: 13 }, (_, i) => ({ no: i + 1, text: `Outcome ${i + 1}`, short: `PO ${i + 1}`, egas: [] })) } });
const map = (fields, d = draft(), planRows = []) => { let n = 0; return mapPdfFields(fields, d, () => `reg_${++n}`, { planRows }); };
test('mapper preserves repeated PO labels and punctuation-separated PO labels', () => {
  const r = map({ clos: 'CLO1: Example [EGA1, PO1, PO2, PO3, PO5]\nCLO2: Another [EGA2, PO6. PO7, PO12]' });
  assert.deepEqual(r.content.clos.map(c => c.pos), [[1,2,3,5], [6,7,12]]);
});
test('mapper separates unpunctuated ILOs without inheriting preceding CLO tags', () => {
  const r = map({ clos: 'CLO1: Example [EGA1] [PO1]' }, draft(), [{ week: '4-5', ilo: 'ILO 1: First [CLO1] ILO 2 Untagged source outcome.\nILO4: Last [CLO1]', contents: 'Example', activities: '', tasks: '', values: '' }]);
  assert.equal(r.content.plan[0].ilos.length, 3);
  assert.match(r.content.plan[0].ilos[1].text, /^ILO 2 Untagged source outcome/);
  assert.deepEqual(r.content.plan[0].ilos[1].tags, []);
  assert.deepEqual(r.content.plan[0].ilos[0].tags, [`clo:${r.content.clos[0].id}`]);
});
test('mapper preserves prerequisite conflict and catalog identity until explicit choice', () => {
  const d = draft(), r = map({ code: 'IT 202', title: 'Computer Programming 1', prereq: 'PDF PRECONDITION' }, d);
  assert.equal(r.content.meta.prereq, 'CATALOG PRECONDITION');
  assert.deepEqual(r.prerequisiteConflict, { existing: 'CATALOG PRECONDITION', imported: 'PDF PRECONDITION', decision: null });
  assert.equal(d.meta.prereq, 'CATALOG PRECONDITION');
  assert.equal(r.content.meta.program, d.meta.program);
});
test('mapper rejects BSIT IT 202 for Cyber Security IT-202 instead of accepting a title warning', () => {
  const r = map({ code: 'IT 202', title: 'Computer Programming 1' }, draft('BSIT-CYBERSECURITY', 'IT-202', 'SYSTEM INTEGRATION AND ARCHITECTURE 1'));
  assert.equal(r.mismatch, true);
  assert.equal(r.content.meta.program, 'BSIT-CYBERSECURITY');
  assert.equal(r.content.meta.code, 'IT-202');
  assert.ok(r.warnings.some(w => w.key === 'pdfImport.titleMismatch'));
  assert.ok(r.warnings.some(w => w.key === 'pdfImport.identityMismatch'));
});
test('actual CpE304 snapshot preserves all eleven printed PO links', async () => {
  const s = JSON.parse(await fs.readFile(new URL('../../docs/lcup-approved-offline/cpe304.source.json', import.meta.url)));
  const r = map(s.production.fields, draft('BSCPE', 'CpE-304', 'FUNDAMENTALS OF MIXED SIGNALS AND SENSORS'), s.production.layout.planRows);
  assert.deepEqual(r.content.clos.map(c => c.pos), [[1,2,3,5], [6,7,12], [4,9], [11,13]]);
  assert.equal(r.content.clos.reduce((n, c) => n + c.pos.length, 0), 11);
});
test('actual IT202 snapshot retains the untagged week4-5 ILO separately', async () => {
  const s = JSON.parse(await fs.readFile(new URL('../../docs/lcup-approved-offline/it202.source.json', import.meta.url)));
  const r = map(s.production.fields, draft(), s.production.layout.planRows);
  const row = r.content.plan.find(r => r.week === '4-5');
  assert.equal(row.ilos.length, 3);
  assert.match(row.ilos[1].text, /^ILO 2 Acquire the necessary skills/);
  assert.deepEqual(row.ilos[1].tags, []);
});
