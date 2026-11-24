// The rule for a password a person chooses, checked on the screen BEFORE anything is sent: the same rule and the same English messages as the server
// (server/lib/passwords.js validatePassword), so tr() translates them like the server's answer. The server still decides; this only saves a round trip,
// and on student registration it saves a paid COR scan that would otherwise end with "the password needs a number" (passwordRule.test.js keeps the two in step).
export const MIN_LENGTH = 8;
export const MAX_LENGTH = 72; // bcrypt ignores everything after 72 bytes

// -> '' when the password is fine, else the server's message for what is wrong.
export function passwordProblem(password) {
  const p = String(password == null ? '' : password);
  if (p.length < MIN_LENGTH) return 'The password must be at least ' + MIN_LENGTH + ' characters.';
  if (p.length > MAX_LENGTH) return 'The password must be at most 72 characters.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'The password needs at least one letter and one number.';
  return '';
}
