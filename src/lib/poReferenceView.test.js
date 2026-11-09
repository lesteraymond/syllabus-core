import test from 'node:test';
import assert from 'node:assert/strict';
import { changeLine, diffLines, shortHash } from './poReferenceView.js';
import { poReferenceEn, poReferenceTl } from '../i18n/poReference.js';

test('a comparison reads as plain lines in PO order', () => {
  const lines = diffLines({ added: [{ no: 3 }], removed: [{ no: 1 }], changed: [{ no: 2, fields: ['text', 'egas'] }] });
  assert.deepEqual(lines.map((l) => [l.kind, l.no]), [['removed', 1], ['changed', 2], ['added', 3]]);
  assert.deepEqual(lines[1].fields, ['text', 'egas']);
  assert.deepEqual(diffLines(null), []);
});
test('a change-log line names the change, the date, who made it, and the previous and new version', () => {
  const line = changeLine({ action: 'saved', at: '2026-11-06T01:00:00Z', by: 'Test Administrator', previous: { id: 'po-7-v1', version: 'ZZ-v1' }, next: { id: 'po-7-v2', version: 'ZZ-v2' } });
  assert.deepEqual(line, { key: 'poRef.change.saved', date: '2026-11-06', by: 'Test Administrator', from: 'ZZ-v1', to: 'ZZ-v2' });
  const first = changeLine({ action: 'recorded', at: null, by: null, previous: null, next: { id: 'po-7-v1' } });
  assert.equal(first.from, null); assert.equal(first.to, 'po-7-v1', 'a version without a label is named by its id'); assert.equal(first.date, '—');
});
test('every action the server records has a line in both languages, and no text speaks of a VPAA approval step', () => {
  for (const action of ['saved', 'recorded', 'adopted', 'copied', 'ega_saved', 'faculty_adopted']) { assert.ok(poReferenceEn['poRef.change.' + action], action); assert.ok(poReferenceTl['poRef.change.' + action], action); }
  assert.deepEqual(Object.keys(poReferenceTl).sort(), Object.keys(poReferenceEn).sort(), 'English and Filipino have the same keys');
  assert.ok(!/VPAA|approv|publish/i.test(Object.values(poReferenceEn).join(' ')), 'the panel has no approval or publication wording');
  assert.equal(shortHash('ab'.repeat(32)), 'abababababab');
});
