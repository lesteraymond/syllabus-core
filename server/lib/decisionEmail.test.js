// The email a faculty member gets about a decision on their syllabus (lib/decisionEmail.js): what it says, and that it goes out only while the
// administrator's "Email notifications" switch is on. A fake mail transport only: no real email is ever sent here. Run: npm test.
const test = require('node:test');
const assert = require('node:assert/strict');
const mailer = require('./mailer');
const decisionEmail = require('./decisionEmail');

const fakeDb = ({ email = true, owner = { email: 'fay@x.ph', first_name: 'Fay' } } = {}) => ({ query: async (sql, p) => {
  if (sql.includes("setting_key = 'administration'")) return [[{ setting_value: JSON.stringify({ emailNotifications: email }) }]];
  if (sql.startsWith('SELECT email, first_name FROM users WHERE user_id')) { assert.deepEqual(p, [5]); return [owner ? [owner] : []]; }
  throw new Error('unexpected query: ' + sql);
} });
const withOutbox = async (fn) => {
  const sent = []; const smtp = { SMTP_HOST: process.env.SMTP_HOST, MAIL_FROM: process.env.MAIL_FROM };
  mailer.setTransport({ sendMail: async (m) => { sent.push(m); } });
  try { await fn(sent); } finally {
    mailer.setTransport(null);
    for (const [key, value] of Object.entries(smtp)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } // put back exactly what was there
  }
};
const vpaa = { role: 'vpaa', name: 'Vee Paa' };

test('approved, returned for revision and rejected each read as a short email; anything else is not a decision', () => {
  assert.deepEqual(decisionEmail.compose({ status: 'approved', code: 'FM 202', title: 'Fundamentals of Mathematics', decidedBy: vpaa }),
    { subject: 'Your syllabus was approved: FM 202', lines: ['Your syllabus FM 202 — Fundamentals of Mathematics was approved by the VPAA (Vee Paa).', 'It is now in the Repository.'] });
  const back = decisionEmail.compose({ status: 'for_revision', code: 'FM 202', title: 'Math', comment: '  Fix the grading.  ', decidedBy: { role: 'lic_director', name: 'Lee D' } });
  assert.equal(back.subject, 'Revision requested: FM 202');
  assert.deepEqual(back.lines, ['Your syllabus FM 202 — Math was returned for revision by the LIC Director (Lee D).', 'Reason: Fix the grading.', 'Open My Syllabi to read the comments and submit a new version.']);
  assert.deepEqual(decisionEmail.compose({ status: 'rejected', code: 'FM 202', decidedBy: vpaa }).lines, ['Your syllabus FM 202 was rejected by the VPAA (Vee Paa).']);
  for (const status of ['submitted', 'under_review', 'draft']) assert.equal(decisionEmail.compose({ status, code: 'X' }), null, status);
});

test('with Email notifications on, the faculty member gets the email', () => withOutbox(async (sent) => {
  process.env.SMTP_HOST = 'smtp.test.invalid'; process.env.MAIL_FROM = 'noreply@x.ph';
  const result = await decisionEmail.send(fakeDb(), { ownerId: 5, status: 'approved', code: 'FM 202', title: 'Math', decidedBy: vpaa });
  assert.deepEqual(result, { sent: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'fay@x.ph');
  assert.equal(sent[0].subject, 'Your syllabus was approved: FM 202');
  assert.match(sent[0].text, /^Hello Fay,/);
  assert.match(sent[0].text, /approved by the VPAA \(Vee Paa\)/);
}));

test('with Email notifications off, or no email on the account, nothing is sent; a status that is not a decision sends nothing', () => withOutbox(async (sent) => {
  process.env.SMTP_HOST = 'smtp.test.invalid'; process.env.MAIL_FROM = 'noreply@x.ph';
  assert.deepEqual(await decisionEmail.send(fakeDb({ email: false }), { ownerId: 5, status: 'rejected', code: 'FM 202', decidedBy: vpaa }), { sent: false, reason: 'turned_off' });
  assert.deepEqual(await decisionEmail.send(fakeDb({ owner: { email: '24-4233-624', first_name: 'Sam' } }), { ownerId: 5, status: 'approved', code: 'FM 202' }), { sent: false, reason: 'no_email' });
  assert.deepEqual(await decisionEmail.send(fakeDb({ owner: null }), { ownerId: 5, status: 'approved', code: 'FM 202' }), { sent: false, reason: 'no_email' });
  assert.equal(decisionEmail.send(fakeDb(), { ownerId: 5, status: 'under_review', code: 'FM 202' }), null);
  await decisionEmail.settled();
  assert.equal(sent.length, 0);
}));

test('a mail or database problem never throws out of the send', async () => {
  const quiet = console.error; console.error = () => {};
  try {
    const broken = { query: async (sql) => { if (sql.includes('app_settings')) return [[]]; throw new Error('db down'); } };
    assert.deepEqual(await decisionEmail.send(broken, { ownerId: 5, status: 'approved', code: 'FM 202' }), { sent: false, reason: 'failed' });
  } finally { console.error = quiet; }
});
