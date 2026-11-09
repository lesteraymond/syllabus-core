// Run: npm test
// The server's active-academic-year refusals reach the screen through tr(); the one that names the years is matched by pattern.
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { translate, tr, setLanguage } from '../i18n/index.js';
const require = createRequire(import.meta.url);
const { MESSAGES } = require('../../server/lib/activeYearGate.js');

test('every refusal is translated into Filipino, with the years kept', () => {
  setLanguage('tl');
  const inactive = tr(MESSAGES.inactive('2028–2029', '2026–2027'));
  assert.strictEqual(inactive, translate('hybrid.inactiveYearRefused', { active: '2028–2029', year: '2026–2027' }, 'tl'));
  assert.match(inactive, /2028–2029/); assert.match(inactive, /2026–2027/); assert.match(inactive, /Taong Akademiko/);
  assert.strictEqual(tr(MESSAGES.none), translate('hybrid.noActiveYearRefused', {}, 'tl'));
  assert.strictEqual(tr(MESSAGES.unset), translate('hybrid.unsetYearRefused', {}, 'tl'));
  setLanguage('en');
  assert.strictEqual(tr(MESSAGES.inactive('2028–2029', '2026–2027')), MESSAGES.inactive('2028–2029', '2026–2027'));
});

test('the notice shown before checking exists in both languages', () => {
  for (const key of ['hybrid.inactiveYearTitle', 'hybrid.inactiveYearBody']) {
    const en = translate(key, { year: '2026–2027' }, 'en'), tl = translate(key, { year: '2026–2027' }, 'tl');
    assert.ok(en && tl && en !== tl && en !== key && tl !== key && !/\{\w+\}/.test(en + tl), key);
  }
  assert.strictEqual(translate('hybrid.inactiveYearTitle', {}, 'en'), 'AI Checking is only available for the currently active Academic Year.');
});
