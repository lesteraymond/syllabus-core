// Run: npm test. The screen's password rule (src/lib/passwordRule.js) must give exactly the server's answer (server/lib/passwords.js), or a student would
// pay for a COR scan only to be refused afterwards, or be stopped on the screen by a rule the server does not have.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { passwordProblem } from './passwordRule.js';

const { validatePassword } = createRequire(import.meta.url)('../../server/lib/passwords.js');

test('the screen and the server agree on every kind of password', () => {
  const samples = ['', 'abc1', 'abcdefg', '1234567', '12345678', 'abcdefgh', 'ABCDEFGH', 'abcd1234', 'Abcd123!', 'pass word 9', 'x'.repeat(71) + '1', 'x'.repeat(72) + '1', 'ñandú2026'];
  for (const p of samples) assert.equal(passwordProblem(p), validatePassword(p), JSON.stringify(p));
});

test('a password the server would refuse is stopped with the server\'s own message', () => {
  assert.equal(passwordProblem('12345678'), 'The password needs at least one letter and one number.');
  assert.equal(passwordProblem('short1'), 'The password must be at least 8 characters.');
  assert.equal(passwordProblem('abcd1234'), '');
});
