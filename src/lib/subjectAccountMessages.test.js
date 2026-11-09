// Run: npm test
// The server's subject and account messages reach the screen through tr(), which finds a translation by the exact English text. Each one must have a
// Filipino text, and the Users & Roles labels must exist in both languages.
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { dictionaries, translate, tr, setLanguage } from '../i18n/index.js';
const require = createRequire(import.meta.url);
const subject = require('../../server/lib/subjectValidation.js'), account = require('../../server/lib/accountStatus.js');

const serverMessages = [...Object.values(subject.MESSAGES.submit), ...Object.values(subject.MESSAGES.approve), account.DISABLED, account.SELF, account.LAST_ADMIN, account.NOT_INSTALLED, account.RESEND_DISABLED];

test('every subject and account message from the server has a Filipino text that tr() finds', () => {
  for (const message of serverMessages) {
    const key = Object.keys(dictionaries.en).find((k) => dictionaries.en[k] === message);
    assert.ok(key, 'no key for: ' + message);
    assert.ok(dictionaries.tl[key] && dictionaries.tl[key] !== message, 'no Filipino text for ' + key);
    setLanguage('tl'); assert.strictEqual(tr(message), dictionaries.tl[key]);
    setLanguage('en'); assert.strictEqual(tr(message), message);
  }
});

test('the Users & Roles labels exist in English and Filipino, with the name filled in', () => {
  for (const key of ['users.disable', 'users.enable', 'users.disabledChip', 'users.disabledDone', 'users.enabledDone', 'users.confirmDisable']) {
    const en = translate(key, { name: 'Ana Cruz' }, 'en'), tl = translate(key, { name: 'Ana Cruz' }, 'tl');
    assert.ok(en && tl && en !== key && tl !== key && en !== tl, key);
    assert.ok(!/\{\w+\}/.test(en + tl), key);
  }
  assert.match(translate('users.confirmDisable', { name: 'Ana Cruz' }, 'tl'), /Ana Cruz/);
});
