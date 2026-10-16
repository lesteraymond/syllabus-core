// Run: npm test
import test from 'node:test';
import assert from 'node:assert';
import { createModalStack, createScrollLock, nextFocus, LAYER_BASE } from './modalStack.js';

test('the last modal opened is the top one, and each layer sits above the one beneath it', () => {
  const s = createModalStack();
  assert.strictEqual(s.top(), null);
  assert.strictEqual(s.isTop('view'), false);
  s.push('view');
  s.push('history');
  assert.strictEqual(s.top(), 'history');
  assert.strictEqual(s.isTop('history'), true);
  assert.strictEqual(s.isTop('view'), false);
  assert.deepStrictEqual(s.state(), [
    { id: 'view', depth: 0, zIndex: LAYER_BASE, inert: true },
    { id: 'history', depth: 1, zIndex: LAYER_BASE + 2, inert: false },
  ]);
});

test('closing the top modal makes the one beneath it live again; closing one in the middle keeps the order', () => {
  const s = createModalStack();
  ['a', 'b', 'c'].forEach((id) => s.push(id));
  s.remove('c');
  assert.deepStrictEqual(s.state().map((l) => [l.id, l.inert, l.zIndex]), [['a', true, LAYER_BASE], ['b', false, LAYER_BASE + 2]]);
  s.push('c');
  s.remove('b'); // not the top
  assert.deepStrictEqual(s.state().map((l) => [l.id, l.inert]), [['a', true], ['c', false]]);
  s.remove('c');
  s.remove('a');
  assert.strictEqual(s.size(), 0);
  assert.deepStrictEqual(s.state(), []);
});

test('opening the same modal twice does not duplicate it, and closing something that is not open does nothing', () => {
  const s = createModalStack();
  s.push('a');
  s.push('b');
  s.push('a'); // moves a to the top
  assert.deepStrictEqual(s.state().map((l) => l.id), ['b', 'a']);
  assert.strictEqual(s.size(), 2);
  s.remove('nope');
  assert.strictEqual(s.size(), 2);
  assert.strictEqual(s.has('a'), true);
  assert.strictEqual(s.has('nope'), false);
});

test('only the top modal may answer Esc, so Esc never closes the window under it', () => {
  const s = createModalStack();
  s.push('view');
  s.push('history');
  const answers = (id) => s.isTop(id); // the hook's Esc handler runs only when this is true
  assert.deepStrictEqual(['view', 'history'].map(answers), [false, true]);
  s.remove('history');
  assert.deepStrictEqual(['view'].map(answers), [true]);
});

test('page scroll stays locked until the last modal closes, and unlocking too often is harmless', () => {
  const body = { style: { overflow: 'auto' } };
  const l = createScrollLock();
  l.lock(body);
  l.lock(body);
  assert.strictEqual(body.style.overflow, 'hidden');
  l.unlock(body);
  assert.strictEqual(body.style.overflow, 'hidden'); // one modal is still open
  l.unlock(body);
  assert.strictEqual(body.style.overflow, 'auto'); // restored to what it was
  l.unlock(body);
  assert.strictEqual(l.count(), 0);
  assert.strictEqual(body.style.overflow, 'auto');
});

test('Tab wraps inside a dialog: last to first, first back to last, and the dialog itself counts as before the first', () => {
  const dialog = { id: 'dialog' };
  const [a, b, c] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const items = [a, b, c];
  assert.strictEqual(nextFocus(items, c, dialog, false), a);
  assert.strictEqual(nextFocus(items, a, dialog, true), c);
  assert.strictEqual(nextFocus(items, dialog, dialog, true), c);
  assert.strictEqual(nextFocus(items, b, dialog, false), null); // the browser moves on by itself
  assert.strictEqual(nextFocus(items, b, dialog, true), null);
  assert.strictEqual(nextFocus(items, { id: 'outside' }, dialog, false), a); // focus escaped: pull it back in
  assert.strictEqual(nextFocus([], dialog, dialog, false), dialog);
});
