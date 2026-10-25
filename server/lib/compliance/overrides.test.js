'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const o = require('./overrides');

test.afterEach(() => o.apply({}, 0)); // the standard is shared: put it back

test('with no edits the effective standard is the file, and apply leaves it as it was', () => {
  const before = JSON.stringify(o.standard);
  o.apply({}, 0);
  assert.equal(JSON.stringify(o.standard), before);
  assert.equal(o.standard.version, o.base.version);
  assert.equal(o.effective({}).rules.length, o.base.rules.length);
});

test('validate keeps only what differs from the file', () => {
  const r = o.validate({ passThreshold: 79, rules: { 'T-24': { weight: 3, severity: 'blocking' }, 'T-01': { weight: 5 } } });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.doc, { rules: { 'T-01': { weight: 5 } } });
});

test('validate refuses what is unknown or out of range', () => {
  const r = o.validate({ passThreshold: 120, areas: { nope: { weight: 5 } }, constants: { weeksPerTerm: -1, other: 1 }, rules: { 'X-99': {}, 'T-01': { weight: 99, severity: 'huge' } } });
  assert.ok(r.errors.length >= 6, r.errors.join(' | '));
});

test('a message may only use the placeholders its rule provides', () => {
  assert.deepEqual(o.validate({ rules: { 'T-13': { message: '{where} has no outcome tag.' } } }).errors, []);
  assert.equal(o.validate({ rules: { 'T-13': { message: '{where} is missing {nothing}.' } } }).errors.length, 1);
  assert.equal(o.validate({ rules: { 'T-01': { message: '   ' } } }).errors.length, 1);
});

test('numeric parameters are editable only where the rule has that number', () => {
  assert.deepEqual(o.validate({ rules: { 'C-01': { params: { minWords: 40 } } } }).doc, { rules: { 'C-01': { params: { minWords: 40 } } } });
  assert.equal(o.validate({ rules: { 'C-01': { params: { target: 5 } } } }).errors.length, 1);
});

test('apply changes the live standard: points, pass mark, a disabled rule, a new version', () => {
  const { doc } = o.validate({ passThreshold: 85, rules: { 'T-01': { weight: 7 }, 'T-02': { enabled: false } } });
  o.apply(doc, 3);
  assert.equal(o.standard.passThreshold, 85);
  assert.equal(o.standard.rules.find((r) => r.id === 'T-01').weight, 7);
  assert.equal(o.standard.rules.some((r) => r.id === 'T-02'), false);
  assert.equal(o.standard.version, o.base.version + '.3');
  o.apply({}, 4);
  assert.equal(o.standard.passThreshold, 79);
  assert.equal(o.standard.rules.some((r) => r.id === 'T-02'), true);
});

test('the checker really scores with the edited rules', () => {
  const { evaluate } = require('./rules');
  const content = require('./fixtures').good();
  const plain = evaluate(content, o.standard, { year: 2026 });
  const { doc } = o.validate({ passThreshold: 100 });
  o.apply(doc, 1);
  const strict = evaluate(content, o.standard, { year: 2026 });
  assert.equal(strict.passThreshold, 100);
  assert.equal(plain.passThreshold, 79);
});

test('describe lists each change once', () => {
  const after = o.validate({ passThreshold: 80, rules: { 'T-01': { weight: 5 } } }).doc;
  assert.deepEqual(o.describe({}, after).map((c) => c.target + ':' + c.field), ['standard:passThreshold', 'T-01:weight']);
  assert.deepEqual(o.describe(after, after), []);
});
