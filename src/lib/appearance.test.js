import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppearance, resolveAppearance } from './appearance.js';

test('unknown values fall back to system', () => {
  assert.equal(normalizeAppearance('purple'), 'system');
  assert.equal(normalizeAppearance(null), 'system');
  assert.equal(normalizeAppearance('amoled'), 'amoled');
});
test('system follows the OS, the others are fixed', () => {
  assert.equal(resolveAppearance('system', true), 'dark');
  assert.equal(resolveAppearance('system', false), 'light');
  assert.equal(resolveAppearance('light', true), 'light');
  assert.equal(resolveAppearance('amoled', false), 'amoled');
});
