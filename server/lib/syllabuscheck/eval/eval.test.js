const test = require('node:test');
const assert = require('node:assert/strict');
const dataset = require('./dataset.json');
const { scoreEval } = require('./metrics');
const { validate, PROMPT } = require('../gemini');
const { POLICY } = require('../policy');

const VERDICTS = ['ALIGNED', 'PARTIALLY_ALIGNED', 'NOT_ALIGNED', 'INSUFFICIENT_EVIDENCE'];

test('the dataset is well formed, says it is not faculty-reviewed, and covers every relationship type', () => {
  assert.match(dataset.status, /NOT faculty-reviewed/);
  const ids = new Set();
  for (const item of dataset.items) {
    assert.ok(!ids.has(item.id), 'unique id ' + item.id); ids.add(item.id);
    assert.ok(dataset.courses[item.course], 'known course for ' + item.id);
    assert.ok(item.source && item.target && item.why, 'texts and a reason for ' + item.id);
    assert.ok(item.accept.length > 0 && item.accept.every(v => VERDICTS.includes(v)), 'accepted verdicts of ' + item.id);
    if (item.ambiguous) assert.ok(item.accept.length > 1, 'an ambiguous item accepts more than one verdict: ' + item.id);
  }
  const types = new Set(dataset.items.map(i => i.type));
  for (const type of ['CLO-PO', 'CLO-EGA', 'CLO-anyPO', 'ILO-CLO', 'ILO-activity', 'ILO-assessment', 'ILO-content', 'Module-value', 'Description-plan', 'REF-plan']) assert.ok(types.has(type), type);
  const courses = new Set(dataset.items.map(i => i.course));
  assert.ok(courses.size >= 3, 'different disciplines and levels');
  assert.ok(dataset.items.some(i => i.ambiguous), 'ambiguous cases are marked, not hidden');
});

test('every dataset item can be sent as a pair and an answer for it passes the server validation', () => {
  for (const item of dataset.items) {
    const pair = { id: item.id, type: item.type, source: item.source, target: item.target, path: 'eval', targetPath: item.type === 'REF-plan' ? null : 'eval' };
    const label = item.accept[0];
    const answer = { id: item.id, label, explanation: 'ok', sourceQuote: item.source.slice(0, 10), targetQuote: item.target.slice(0, 10), sourceBloom: 'N/A', targetBloom: 'N/A', draft: label === 'ALIGNED' ? '' : 'A rewrite.' };
    assert.equal(validate({ judgements: [answer] }, [pair])[0].label, label, item.id);
  }
  assert.ok(PROMPT.includes('Description-plan') && PROMPT.includes('ILO-content') && PROMPT.includes('CLO-anyPO'), 'the prompt knows every type the dataset uses');
});

test('scoreEval: agreement, false positives, false negatives, invalid answers, stability and per-type results', () => {
  const items = [
    { id: 'a', type: 'CLO-PO', accept: ['ALIGNED'] },
    { id: 'b', type: 'CLO-PO', accept: ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'] },
    { id: 'c', type: 'ILO-CLO', accept: ['ALIGNED'] },
    { id: 'd', type: 'ILO-CLO', accept: ['ALIGNED', 'PARTIALLY_ALIGNED'], ambiguous: true },
  ];
  const run1 = new Map([['a', 'ALIGNED'], ['b', 'ALIGNED'], ['c', 'PARTIALLY_ALIGNED'], ['d', 'NOT_ALIGNED']]);
  const run2 = new Map([['a', 'ALIGNED'], ['b', 'NOT_ALIGNED'], ['c', null]]);
  const r = scoreEval(items, [run1, run2]);
  assert.deepEqual([r.answered, r.invalid, r.invalidRate], [6, 2, 0.25]);
  assert.equal(r.agreement, 0.5, 'a:2 + b:1 of 6 answered (c and the ambiguous d did not agree)');
  assert.deepEqual(r.counts, { clearAligned: 3, falsePositive: 1, clearNot: 2, falseNegative: 1 });
  assert.equal(r.falsePositiveRate, 0.333);
  assert.equal(r.falseNegativeRate, 0.5);
  assert.equal(r.stability, 0.5, 'a steady, b changed');
  assert.deepEqual(Object.keys(r.byType).sort(), ['CLO-PO', 'ILO-CLO']);
  assert.equal(r.byType['CLO-PO'].agreement, 0.75);
  assert.deepEqual(r.disagreements.map(d => d.id), ['b', 'c', 'd']);
});

test('scoreEval on nothing is all null, not a crash or a fake perfect score', () => {
  const r = scoreEval([{ id: 'a', type: 'CLO-PO', accept: ['ALIGNED'] }], [new Map()]);
  assert.deepEqual([r.answered, r.invalid, r.agreement, r.stability], [0, 1, null, null]);
});

test('the advisory types in the policy are all in the dataset, so a change to them is evaluated', () => {
  const types = new Set(dataset.items.map(i => i.type));
  const staged = new Set([...require('./stage-a-dataset.json').items, ...require('./stage-b-dataset.json').items, ...require('./stage-b3-dataset.json').items, ...require('./stage-b4-dataset.json').items, ...require('./stage-c-dataset.json').items, ...require('./stage-d1-dataset.json').items, ...require('./stage-d2-dataset.json').items].map(i => i.type));
  for (const type of POLICY.advisoryTypes) assert.ok(types.has(type) || staged.has(type) || type === 'CLO-anyEGA', type);
});

test('no expected verdict has been changed silently: the labels match the pinned eval-1 labels', () => {
  const crypto = require('node:crypto');
  const hash = crypto.createHash('sha256').update(JSON.stringify(dataset.items.map(i => [i.id, i.accept, !!i.ambiguous]))).digest('hex');
  // If this fails you changed an expected verdict or added/removed an item. That is allowed only as a deliberate, logged decision:
  // add an entry to dataset.changeLog explaining it (and who reviewed it), then update this hash.
  assert.equal(hash, '49af23d6b1e7a8c1d8e2314b57eff72ad9b8172420762cc75d5d0d88195a4d3a');
});

test('the dataset says it is unreviewed, every item has its review fields, and a disputed label is a proposal, not a change', () => {
  assert.equal(dataset.reviewStatus, 'unreviewed');
  assert.ok(dataset.gaps.length > 0 && dataset.changeLog.length > 0);
  for (const item of dataset.items) {
    assert.equal(item.reviewStatus, 'unreviewed', item.id);
    assert.ok(Object.hasOwn(item, 'facultyVerdict') && item.facultyVerdict === null, item.id);
    assert.ok(Object.hasOwn(item, 'facultyNotes'), item.id);
  }
  const disputed = dataset.items.filter(i => i.diagnosis);
  assert.ok(disputed.length >= 1);
  for (const item of disputed) {
    assert.match(item.diagnosis.status, /awaiting faculty/);
    assert.equal(item.ambiguous, undefined, 'the proposal to call it ambiguous has not been applied: ' + item.id);
  }
});

test('scoreEval: confusion matrix, partial accuracy, and results by discipline and category', () => {
  const items = [
    { id: 'a', type: 'CLO-PO', accept: ['ALIGNED'], category: 'clear-positive' },
    { id: 'b', type: 'CLO-PO', accept: ['PARTIALLY_ALIGNED'], category: 'partial' },
    { id: 'c', type: 'ILO-CLO', accept: ['PARTIALLY_ALIGNED'], category: 'partial' },
    { id: 'd', type: 'ILO-CLO', accept: ['NOT_ALIGNED', 'PARTIALLY_ALIGNED'], category: 'clear-negative' },
    { id: 'e', type: 'ILO-CLO', accept: ['ALIGNED', 'PARTIALLY_ALIGNED'], ambiguous: true, category: 'x' },
  ];
  const disciplineOf = item => (item.id < 'c' ? 'engineering' : 'nursing');
  const r = scoreEval(items, [new Map([['a', 'PARTIALLY_ALIGNED'], ['b', 'PARTIALLY_ALIGNED'], ['c', 'ALIGNED'], ['d', 'ALIGNED'], ['e', 'ALIGNED']])], { disciplineOf });
  assert.deepEqual(r.confusion.ALIGNED, { ALIGNED: 0, PARTIALLY_ALIGNED: 1, NOT_ALIGNED: 0, INSUFFICIENT_EVIDENCE: 0, invalid: 0 });
  assert.equal(r.confusion.PARTIAL.PARTIALLY_ALIGNED, 1);
  assert.equal(r.confusion.PARTIAL.ALIGNED, 1);
  assert.equal(r.confusion.FLAGGED.ALIGNED, 1, 'a clear not-aligned item judged ALIGNED is a false approval');
  assert.equal(r.partialAccuracy, 0.5, 'one of the two PARTIAL items was judged PARTIAL');
  assert.equal(r.approvalAccuracy, 0);
  assert.deepEqual(Object.keys(r.byDiscipline).sort(), ['engineering', 'nursing']);
  assert.equal(r.byDiscipline.engineering.agreement, 0.5);
  assert.equal(r.byCategory.partial.items, 2);
  const unknown = scoreEval(items, [new Map()]);
  assert.deepEqual(Object.keys(unknown.byDiscipline), ['unknown']);
  assert.equal(unknown.partialAccuracy, null);
});

test('the alignment dataset keeps development and held-out items apart, keeps the original items unchanged, and covers every discipline in both splits', () => {
  const align = require('./alignment-dataset.json');
  assert.equal(align.reviewStatus, 'unreviewed');
  const ids = align.items.map(i => i.id);
  assert.equal(new Set(ids).size, ids.length, 'unique ids');
  assert.ok(align.items.every(i => ['dev', 'heldout'].includes(i.split) && align.courses[i.course] && i.source && i.target && i.why && i.accept.length));
  const dev = align.items.filter(i => i.split === 'dev'), held = align.items.filter(i => i.split === 'heldout');
  assert.ok(dev.length >= 50 && held.length >= 40);
  assert.ok(!held.some(i => i.origin), 'a held-out item is never one of the older items that prompts were already tuned on');
  for (const original of align.items.filter(i => i.origin)) {
    const source = dataset.items.find(i => i.id === original.id);
    assert.deepEqual([original.accept, original.source, original.target, original.type], [source.accept, source.source, source.target, source.type], original.id + ' differs from eval-1.1');
  }
  const disciplines = split => new Set(split.map(i => align.courses[i.course].discipline));
  assert.ok(disciplines(dev).size >= 6 && disciplines(held).size >= 6);
  for (const type of ['ILO-CLO', 'CLO-EGA', 'CLO-PO']) assert.ok(dev.some(i => i.type === type) && held.some(i => i.type === type), type);
  assert.ok(align.items.filter(i => i.accept.length === 1 && i.accept[0] === 'PARTIALLY_ALIGNED').length >= 8, 'clear partial examples exist');
  for (const category of ['different-wording', 'keyword-overlap', 'broad-clo-narrow-ilo', 'specific-clo-broad-po', 'interdisciplinary', 'wrong-program', 'contradictory', 'level-gap', 'partial']) assert.ok(align.items.some(i => i.category === category), category);
});

test('every alignment item can be sent as a pair and an answer for it passes the server validation', () => {
  const align = require('./alignment-dataset.json');
  for (const item of align.items) {
    const pair = { id: item.id, type: item.type, source: item.source, target: item.target, path: 'eval', targetPath: 'eval' };
    const label = item.accept[0];
    const answer = { id: item.id, label, explanation: 'ok', sourceQuote: item.source.slice(0, 10), targetQuote: item.target.slice(0, 10), sourceBloom: 'N/A', targetBloom: 'N/A', draft: label === 'ALIGNED' ? '' : 'A rewrite.' };
    assert.equal(validate({ judgements: [answer] }, [pair])[0].label, label, item.id);
  }
});
