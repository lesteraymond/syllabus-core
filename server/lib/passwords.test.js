// Run: npm test (from the project root).
const test = require('node:test');
const assert = require('node:assert');
const { generatePassword, validatePassword, LENGTH } = require('./passwords');

test('a generated password is 12 characters with a capital, a small letter, a digit and a symbol, and none of the look-alikes', () => {
  for (let i = 0; i < 300; i++) {
    const p = generatePassword();
    assert.strictEqual(p.length, LENGTH);
    assert.match(p, /[A-Z]/); assert.match(p, /[a-z]/); assert.match(p, /\d/); assert.match(p, /[!@#$%*?\-_]/);
    assert.doesNotMatch(p, /[01OIlo]/);
  }
});

test('generated passwords are not repeated and not in a fixed order', () => {
  const seen = new Set(Array.from({ length: 500 }, generatePassword));
  assert.strictEqual(seen.size, 500);
  const firstKinds = new Set(Array.from({ length: 200 }, () => (/[A-Z]/.test(generatePassword()[0]) ? 'U' : 'x')));
  assert.ok(firstKinds.size > 1, 'the first character is not always a capital');
});

test('a chosen password needs 8 to 72 characters, a letter and a number, and must not be the email', () => {
  assert.strictEqual(validatePassword('Abcdefg1'), '');
  assert.match(validatePassword('Abc1'), /at least 8/);
  assert.match(validatePassword('abcdefgh'), /letter and one number/);
  assert.match(validatePassword('12345678'), /letter and one number/);
  assert.match(validatePassword('A1' + 'x'.repeat(71)), /at most 72/);
  assert.match(validatePassword('Jane1234@x.ph', { email: 'jane1234@x.ph' }), /email address/);
  assert.match(validatePassword(null), /at least 8/);
});
