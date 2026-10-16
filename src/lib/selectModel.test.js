import test from 'node:test';
import assert from 'node:assert/strict';
import { moveActive, jumpIndex, filterItems, nextQuery, firstEnabled, lastEnabled, TYPE_RESET_MS } from './selectModel.js';

const item = (label, disabled = false) => ({ value: label, label, disabled });
const list = [item('Apple'), item('Banana'), item('Blueberry'), item('Cherry', true), item('Date')];

test('arrow keys move one option and stop at the ends, as a native dropdown does', () => {
  assert.equal(moveActive(list, 0, 'ArrowDown'), 1);
  assert.equal(moveActive(list, 1, 'ArrowUp'), 0);
  assert.equal(moveActive(list, 0, 'ArrowUp'), 0);
  assert.equal(moveActive(list, 4, 'ArrowDown'), 4);
});

test('disabled options are skipped in both directions', () => {
  assert.equal(moveActive(list, 2, 'ArrowDown'), 4);
  assert.equal(moveActive(list, 4, 'ArrowUp'), 2);
});

test('Home and End go to the first and last option you can choose', () => {
  assert.equal(moveActive(list, 2, 'Home'), 0);
  assert.equal(moveActive(list, 0, 'End'), 4);
  const edge = [item('x', true), item('a'), item('b'), item('y', true)];
  assert.equal(firstEnabled(edge), 1);
  assert.equal(lastEnabled(edge), 2);
  assert.equal(moveActive(edge, 2, 'Home'), 1);
  assert.equal(moveActive(edge, 1, 'End'), 2);
});

test('from nothing highlighted, Down finds the first option and Up the last', () => {
  assert.equal(moveActive(list, -1, 'ArrowDown'), 0);
  assert.equal(moveActive(list, -1, 'ArrowUp'), 4);
});

test('nothing can be chosen when every option is disabled', () => {
  assert.equal(moveActive([item('a', true)], 0, 'ArrowDown'), -1);
});

test('typing a letter jumps to the next option that starts with it, and again to the one after', () => {
  assert.equal(jumpIndex(list, 0, 'b'), 1);
  assert.equal(jumpIndex(list, 1, 'b'), 2);
  assert.equal(jumpIndex(list, 2, 'b'), 1);
  assert.equal(jumpIndex(list, 0, 'bl'), 2);
  assert.equal(jumpIndex(list, 0, 'z'), 0);
  assert.equal(jumpIndex(list, 0, 'c'), 0, 'a disabled option is never the target');
});

test('long lists filter by what was typed anywhere in the label, keeping each option\'s place', () => {
  const found = filterItems(list, 'ber');
  assert.deepEqual(found.map((x) => [x.label, x.index]), [['Blueberry', 2]]);
  assert.equal(filterItems(list, '').length, 5);
  assert.deepEqual(filterItems(list, '  ').length, 5);
  assert.equal(filterItems(list, 'nothing').length, 0);
});

test('typed text grows, restarts after a pause, and Backspace removes a letter', () => {
  assert.equal(nextQuery('', 'b', { now: 1000, lastAt: 0 }), 'b');
  assert.equal(nextQuery('b', 'l', { now: 1100, lastAt: 1000 }), 'bl');
  assert.equal(nextQuery('bl', 'a', { now: 1000 + TYPE_RESET_MS + 1, lastAt: 1000 }), 'a');
  assert.equal(nextQuery('bl', 'Backspace', { now: 5, lastAt: 5 }), 'b');
  assert.equal(nextQuery('bl', 'Shift', { now: 5, lastAt: 5 }), 'bl');
  assert.equal(nextQuery('bl', 'ArrowDown', { now: 5, lastAt: 5 }), 'bl');
});
