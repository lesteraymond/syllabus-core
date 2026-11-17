'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./rules');

test('the owner decisions of 2026-11-12 are the rule values', () => {
  assert.equal(R.CLO_COUNT, 4);
  assert.deepEqual(R.CLO_LEVELS.map(l => l.level), ['Introductory', 'Enabling', 'Demonstrating', 'Integration of Values']);
  assert.deepEqual(R.SCHEDULE, { orientationWeek: 1, firstTopicWeek: 2 });
  assert.equal(R.MIN_ACTIVITY_OPTIONS, 2);
  assert.equal(R.REFERENCE_RECENCY_YEARS, 5);
  assert.equal(R.VALUES_REQUIRED_IN, 'all');
  assert.deepEqual(R.VALUE_NAMES, ['Compassion', 'Courage', 'Community-orientedness', 'Humility', 'Interiority', 'Missionary Spirit']);
});

test('the chain is top-down: every field aligns only to fields above it; EGA and PO are never rewritten', () => {
  const layer = Object.fromEntries(R.CHAIN.map(r => [r.field, r.layer]));
  // PO -> EGA is the school's own link inside layer 0 (both fixed); every authored field aligns only upward.
  for (const row of R.CHAIN) for (const parent of row.alignsTo) if (parent in layer && row.rewritable) assert.ok(layer[parent] < row.layer, `${row.field} -> ${parent}`);
  assert.equal(R.CHAIN.find(r => r.field === 'ega').rewritable, false);
  assert.equal(R.CHAIN.find(r => r.field === 'po').rewritable, false);
  assert.ok(!R.CHAIN.find(r => r.field === 'clo').alignsTo.includes('description'), 'CLOs are never judged against the course description');
  assert.deepEqual(R.CHAIN.find(r => r.field === 'tasks').alignsTo, ['content', 'activities', 'ilo'], 'the tasks assess at the verb level of the ILO (constructive alignment, 2026-11-17)');
});

test('checklists: every relationship has a known area and field, at least one critical item, and only TASK-ILO and CONTENT-SEQUENCE are advice', () => {
  for (const [name, list] of Object.entries(R.CHECKLISTS)) {
    assert.ok(R.AREAS.includes(list.area), name);
    assert.notEqual(R.layerOf(list.from), null, name);
    assert.ok(list.items.length >= 1 && new Set(list.items.map(i => i.id)).size === list.items.length, name);
    // CLO-EVIDENCE has no critical item: a level mismatch is partly aligned (-1), the owner's choice of 2026-11-17
    assert.ok(list.items.some(i => i.critical) || !list.scored || R.isManual(name), name);
  }
  assert.deepEqual(Object.entries(R.CHECKLISTS).filter(([, l]) => !l.scored).map(([n]) => n), ['CONTENT-SEQUENCE', 'TASK-ILO']);
});

test('code sets the verdict from the checklist answers', () => {
  assert.equal(R.verdictOf('ILO-CLO', { step: 'yes', level: 'yes', student: 'yes' }), 'ALIGNED');
  assert.equal(R.verdictOf('ILO-CLO', { step: 'yes', level: 'no', student: 'yes' }), 'PARTIALLY_ALIGNED');
  assert.equal(R.verdictOf('ILO-CLO', { step: 'no', level: 'yes', student: 'yes' }), 'NOT_ALIGNED');
  assert.equal(R.verdictOf('ILO-CLO', { step: 'yes', level: 'unclear', student: 'yes' }), 'INSUFFICIENT_EVIDENCE');
  assert.equal(R.verdictOf('ILO-CLO', { step: 'yes', level: 'no', student: 'unclear' }), 'PARTIALLY_ALIGNED');
});

test('an incomplete or invalid answer is never a pass', () => {
  assert.equal(R.verdictOf('ILO-CLO', { step: 'yes', level: 'yes' }), 'INSUFFICIENT_EVIDENCE');
  assert.equal(R.verdictOf('ILO-CLO', { step: 'YES', level: 'yes', student: 'yes' }), 'INSUFFICIENT_EVIDENCE');
  assert.equal(R.verdictOf('ILO-CLO', null), 'INSUFFICIENT_EVIDENCE');
  assert.throws(() => R.verdictOf('NOPE', {}), /Unknown relationship/);
});

test('deductions: -1 partial, -3 not aligned, advice and insufficient evidence cost nothing; each area loses at most 5 points (owner, 2026-11-15)', () => {
  const results = [
    { relationship: 'ILO-CLO', verdict: 'NOT_ALIGNED' }, { relationship: 'ILO-CLO', verdict: 'PARTIALLY_ALIGNED' },
    { relationship: 'ILO-CONTENT', verdict: 'NOT_ALIGNED' }, { relationship: 'TASK-ILO', verdict: 'NOT_ALIGNED' },
    { relationship: 'VALUE-ILO', verdict: 'INSUFFICIENT_EVIDENCE' }, { relationship: 'CLO-PO', verdict: 'PARTIALLY_ALIGNED' },
  ];
  assert.ok(Object.values(R.AREA_CAPS).every(cap => cap === 5));
  const d = R.deductions(results);
  assert.equal(d.uncapped.ilo, 7);
  assert.equal(d.capped.ilo, 5);
  assert.equal(d.uncapped.tasks, 0);
  assert.equal(d.total, 6);
  const open = R.deductions(results, Object.fromEntries(R.AREAS.map(a => [a, null])));
  assert.equal(open.total, 8, 'without caps every finding costs its points');
});
