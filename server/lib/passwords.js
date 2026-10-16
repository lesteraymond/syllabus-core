// Passwords the system makes for people, and the one rule for passwords people choose. No database and no network: tested on its own.
const crypto = require('crypto');

const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // no I, L, O: they read as 1 and 0
const LOWER = 'abcdefghijkmnpqrstuvwxyz'; // no l, o
const DIGIT = '23456789'; // no 0, 1
const SYMBOL = '!@#$%*?-_';
const ALL = UPPER + LOWER + DIGIT + SYMBOL;
const LENGTH = 12;
const MIN_LENGTH = 8;

const pick = (set) => set[crypto.randomInt(set.length)];

// A temporary password: 12 characters, at least one of each kind, in an unpredictable order.
function generatePassword() {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SYMBOL)];
  while (chars.length < LENGTH) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i--) { // Fisher-Yates with a secure source
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// The rule for a password a person chooses. Returns an error message, or '' when it is fine.
function validatePassword(password, { email = '' } = {}) {
  const p = String(password == null ? '' : password);
  if (p.length < MIN_LENGTH) return 'The password must be at least ' + MIN_LENGTH + ' characters.';
  if (p.length > 72) return 'The password must be at most 72 characters.'; // bcrypt ignores everything after 72 bytes
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'The password needs at least one letter and one number.';
  if (email && p.toLowerCase() === String(email).toLowerCase()) return 'The password must not be your email address.';
  return '';
}

module.exports = { generatePassword, validatePassword, LENGTH, MIN_LENGTH };
