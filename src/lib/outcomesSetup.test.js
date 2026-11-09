import test from 'node:test';
import assert from 'node:assert/strict';
import { needsSetup, programsNeedingSetup, nextNo, egaRows, poRows, blankEga, blankPo, egaPayload, poPayload, checkEgas, checkPos, sameRows } from './outcomesSetup.js';

test('a program needs setup when it has no EGAs or no outcomes of its own; a specialization is set up in the program it inherits from', () => {
  assert.equal(needsSetup({ egaCount: 0, outcomeCount: 0 }), true);
  assert.equal(needsSetup({ egaCount: 3, outcomeCount: 0 }), true);
  assert.equal(needsSetup({ egaCount: 0, outcomeCount: 5 }), true);
  assert.equal(needsSetup({ egaCount: 3, outcomeCount: 5 }), false);
  assert.equal(needsSetup({ egaCount: 0, outcomeCount: 0, inheritedFrom: 'BSIT' }), false);
  assert.equal(needsSetup({}), true, 'a list from an older server (no counts) is shown as needing setup rather than hidden');
  assert.equal(needsSetup(null), false);
  assert.deepEqual(programsNeedingSetup([{ code: 'A', egaCount: 1, outcomeCount: 1 }, { code: 'B', egaCount: 0, outcomeCount: 0 }]).map((p) => p.code), ['B']);
  assert.deepEqual(programsNeedingSetup(undefined), []);
});

test('rows are built from server data and back to the exact payload; new rows take the next free number', () => {
  const egas = egaRows([{ no: 1, name: ' Critical ', short: 'CT' }, { no: 3, name: 'Service', short: 'SV' }]);
  assert.deepEqual(egas[0], { no: '1', name: ' Critical ', short: 'CT' });
  assert.equal(nextNo(egas), '4');
  assert.equal(nextNo([]), '1');
  assert.deepEqual(blankEga(egas), { no: '4', name: '', short: '' });
  assert.deepEqual(blankPo([]), { no: '1', short: '', text: '', egas: [] });
  assert.deepEqual(egaPayload(egas), [{ no: 1, name: 'Critical', short: 'CT' }, { no: 3, name: 'Service', short: 'SV' }]);
  const pos = poRows([{ no: 2, short: 'PO2', text: 'Design', egas: [3, 1] }]);
  assert.deepEqual(poPayload([{ ...pos[0], egas: [3, 1, 3] }]), [{ no: 2, short: 'PO2', text: 'Design', egas: [1, 3] }], 'EGA numbers are unique and sorted');
  assert.equal(sameRows(egas, egaRows([{ no: 1, name: ' Critical ', short: 'CT' }, { no: 3, name: 'Service', short: 'SV' }])), true);
  assert.equal(sameRows(egas, []), false);
});

test('EGA rows are checked like the server: at least one, unique numbers 1 to 99, name and short name within the limits', () => {
  const ok = [{ no: '1', name: 'Critical thinking', short: 'CT' }];
  assert.equal(checkEgas(ok), null);
  assert.equal(checkEgas([]).key, 'outcomes.err.noEgas');
  assert.equal(checkEgas(Array.from({ length: 21 }, (_, i) => ({ no: String(i + 1), name: 'n', short: 's' }))).key, 'outcomes.err.tooManyEgas');
  for (const no of ['', '0', '100', 'x', '1.5']) assert.equal(checkEgas([{ ...ok[0], no }]).key, 'outcomes.err.number', 'number ' + JSON.stringify(no));
  assert.deepEqual(checkEgas([ok[0], { ...ok[0] }]), { key: 'outcomes.err.number', params: { row: 2 } }, 'a repeated number names the row');
  assert.equal(checkEgas([{ no: '1', name: '  ', short: 'CT' }]).key, 'outcomes.err.egaText');
  assert.equal(checkEgas([{ no: '1', name: 'x'.repeat(256), short: 'CT' }]).key, 'outcomes.err.egaLong');
  assert.equal(checkEgas([{ no: '1', name: 'n', short: 'x'.repeat(121) }]).key, 'outcomes.err.egaLong');
});

test('outcome rows may only map to the program\'s saved EGAs and respect the text limits; none at all is allowed', () => {
  const egas = [{ no: 1 }, { no: 2 }];
  const ok = [{ no: '1', short: 'PO1', text: 'Apply knowledge', egas: [1, 2] }];
  assert.equal(checkPos(ok, egas), null);
  assert.equal(checkPos([], egas), null);
  assert.equal(checkPos([{ ...ok[0], egas: [3] }], egas).key, 'outcomes.err.poEga');
  assert.equal(checkPos([{ ...ok[0], text: ' ' }], egas).key, 'outcomes.err.poText');
  assert.equal(checkPos([{ ...ok[0], short: '' }], egas).key, 'outcomes.err.poText');
  assert.equal(checkPos([{ ...ok[0], text: 'x'.repeat(2001) }], egas).key, 'outcomes.err.poLong');
  assert.equal(checkPos([ok[0], { ...ok[0] }], egas).key, 'outcomes.err.number');
  assert.equal(checkPos(Array.from({ length: 51 }, (_, i) => ({ no: String(i + 1), short: 's', text: 't', egas: [] })), egas).key, 'outcomes.err.tooManyPos');
  assert.equal(checkPos(ok, []).key, 'outcomes.err.poEga', 'with no saved EGAs a mapped outcome is refused');
});
