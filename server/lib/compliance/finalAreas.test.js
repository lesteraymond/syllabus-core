// Where a check's final score was lost, area by area (lib/compliance/finalAreas.js). Run: npm test.
const test = require('node:test');
const assert = require('node:assert/strict');
const { finalAreas, areaOf } = require('./finalAreas');

// the six areas of standard-v4, all at 100 from the coded rules
const AREAS = [['template', 20], ['completeness', 20], ['co_po', 20], ['assessment', 15], ['contact_hours', 10], ['reference_currency', 15]].map(([key, weight]) => ({ key, weight, score: 100 }));
const weighted = (list) => Math.round(list.filter((a) => a.score !== null).reduce((s, a) => s + a.score * a.weight, 0) / list.filter((a) => a.score !== null).reduce((s, a) => s + a.weight, 0));

test('each AI deduction is charged to the area it is about', () => {
  assert.equal(areaOf({ kind: 'alignment', path: 'clos[0].pos' }), 'co_po');
  assert.equal(areaOf({ kind: 'alignment', path: 'plan[2].ilos[0].text' }), 'co_po');
  assert.equal(areaOf({ kind: 'alignment', path: 'plan[2].tasks' }), 'assessment');
  assert.equal(areaOf({ kind: 'alignment', path: 'plan[2].activities' }), 'assessment');
  assert.equal(areaOf({ kind: 'link', path: 'refs:https://x' }), 'reference_currency');
  assert.equal(areaOf({ kind: 'value', path: 'plan[1].values' }), 'completeness');
  assert.equal(areaOf({ kind: 'alignment', path: 'description' }), 'completeness');
});

test('the areas after AI add back up to the final score: rules 100, minus 6 points of CO-PO and 3 of assessment, is 91', () => {
  const deductions = [{ kind: 'alignment', path: 'clos[0].pos', points: 3 }, { kind: 'alignment', path: 'plan[1].ilos[0]', points: 3 }, { kind: 'alignment', path: 'plan[1].tasks', points: 3 }];
  const out = finalAreas(AREAS, deductions);
  const by = Object.fromEntries(out.map((a) => [a.key, a]));
  assert.equal(by.co_po.score, 70, 'CO-PO: 100 - 6 x 100 / 20');
  assert.equal(by.co_po.rules, 100, 'the rules score is kept');
  assert.equal(by.assessment.score, 80, 'assessment: 100 - 3 x 100 / 15');
  assert.equal(by.template.score, 100);
  assert.equal(weighted(out), 91, 'the weighted mean after AI is the final score');
});

test('no deductions: the rule scores; an unscored area stays unscored; an area never goes below 0', () => {
  assert.deepEqual(finalAreas(AREAS, []).map((a) => a.score), [100, 100, 100, 100, 100, 100]);
  const partial = AREAS.map((a) => (a.key === 'contact_hours' ? { ...a, score: null } : a));
  assert.equal(finalAreas(partial, []).find((a) => a.key === 'contact_hours').score, null);
  assert.equal(finalAreas(AREAS, [{ kind: 'alignment', path: 'clos[0].pos', points: 40 }]).find((a) => a.key === 'co_po').score, 0);
  assert.deepEqual(finalAreas([], [{ kind: 'link', points: 2 }]), []);
});
