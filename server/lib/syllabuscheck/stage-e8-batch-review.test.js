'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const { decisionOf, reviewBatch } = require('./eval/batchReview');
test('E.8 batch review permits continuation only on an explicit continue', () => {
  assert.deepEqual(decisionOf(' continue '), { proceed: true, reason: null });
  for (const value of ['', null, 'yes', 'continue please', 'stop']) assert.equal(decisionOf(value).proceed, false);
  assert.deepEqual(decisionOf('stop Conceptual failure persists.'), { proceed: false, reason: 'Conceptual failure persists.' });
});
test('E.8 a batch checkpoint waits for input without making provider requests', async () => {
  const input = new PassThrough(), output = new PassThrough();
  let settled = false;
  const result = reviewBatch({ input, output }).then(v => { settled = true; return v; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  input.write('continue\n');
  assert.deepEqual(await result, { proceed: true, reason: null });
  input.end(); output.end();
});
test('E.8 closing operator input stops instead of proceeding to another paid batch', async () => {
  const input = new PassThrough(), output = new PassThrough();
  const result = reviewBatch({ input, output });
  input.end();
  const decision = await result;
  assert.equal(decision.proceed, false); assert.match(decision.reason, /Input closed/);
  output.end();
});
