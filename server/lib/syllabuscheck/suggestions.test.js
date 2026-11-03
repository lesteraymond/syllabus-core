'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { bindSuggestions } = require('./suggestions');
test('recommendations retain original values and stable nested row IDs without changing the source', () => {
  const content = { clos: [{ id: 'clo1', statement: 'Original CLO' }], plan: [{ id: 'week1', ilos: [{ id: 'ilo1', text: 'Original ILO' }] }], outcomes: { pos: [{ no: 1, text: 'Official PO' }] }, meta: {} };
  const proposals = ['clos[0].statement', 'plan[0].ilos[0].text', 'outcomes.pos', 'meta.prereq'].map(path => ({ path, replacement: 'Proposed' }));
  const result = JSON.parse(JSON.stringify(bindSuggestions(content, proposals)));
  assert.equal(result[0].originalValue, 'Original CLO');
  assert.deepEqual(result[0].targetIds, { row: 'clo1' });
  assert.deepEqual(result[1].targetIds, { row: 'week1', ilo: 'ilo1' });
  assert.deepEqual(result[2].originalValue, content.outcomes.pos);
  assert.equal(result[3].originalMissing, true);
  result[2].originalValue[0].text = 'Mutated test';
  assert.equal(content.outcomes.pos[0].text, 'Official PO');
  assert.equal(content.clos[0].statement, 'Original CLO');
});
