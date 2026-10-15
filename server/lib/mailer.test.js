// Run: npm test (from the project root). A fake transport stands in for SMTP: nothing leaves the machine.
const test = require('node:test');
const assert = require('node:assert');
const mailer = require('./mailer');

const fake = (fail) => { const sent = []; return { sent, sendMail: async (m) => { if (fail) throw new Error('smtp down'); sent.push(m); } }; };
const env = (vars, fn) => async () => {
  const old = { ...process.env };
  Object.assign(process.env, vars);
  try { await fn(); } finally { mailer.setTransport(null); for (const k of Object.keys(vars)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } }
};

test('a welcome email names the username and the temporary password, the login link, and the change at first sign-in', env({ APP_URL: 'http://app.test/' }, async () => {
  const t = fake(); mailer.setTransport(t);
  const r = await mailer.sendCredentials({ to: 'ann@x.ph', name: 'Ann', password: 'Pw-Abc234xyz', reason: 'welcome' });
  assert.deepStrictEqual(r, { sent: true });
  const m = t.sent[0];
  assert.strictEqual(m.to, 'ann@x.ph');
  assert.match(m.text, /Username: ann@x\.ph/); assert.match(m.text, /Temporary password: Pw-Abc234xyz/);
  assert.match(m.text, /Sign in at http:\/\/app\.test$/m); assert.match(m.text, /choose your own password/);
  assert.match(m.html, /Pw-Abc234xyz/);
}));

test('the forgot email says it expires and that ignoring it changes nothing', env({}, async () => {
  const t = fake(); mailer.setTransport(t);
  await mailer.sendCredentials({ to: 'ann@x.ph', name: 'Ann', password: 'Pw-Abc234xyz', reason: 'forgot' });
  assert.match(t.sent[0].subject, /temporary password/i);
  assert.match(t.sent[0].text, /30 minutes/); assert.match(t.sent[0].text, /current password still works/);
}));

test('a name or address with markup cannot inject into the HTML body', env({}, async () => {
  const t = fake(); mailer.setTransport(t);
  await mailer.sendCredentials({ to: 'a@x.ph', name: '<img src=x onerror=alert(1)>', password: 'P<w>1', reason: 'welcome' });
  assert.doesNotMatch(t.sent[0].html, /<img/); assert.match(t.sent[0].html, /&lt;img/); assert.match(t.sent[0].html, /P&lt;w&gt;1/);
}));

test('with no SMTP settings nothing is sent and the result says why; a failing transport reports failed and never throws or leaks the password', env({ SMTP_HOST: '', MAIL_FROM: '' }, async () => {
  mailer.setTransport(null);
  delete process.env.SMTP_HOST; delete process.env.MAIL_FROM;
  assert.deepStrictEqual(await mailer.sendCredentials({ to: 'a@x.ph', name: 'A', password: 'Secret-9xyz' }), { sent: false, reason: 'not_configured' });
  const logged = []; const origErr = console.error; console.error = (...a) => logged.push(a.join(' '));
  try {
    mailer.setTransport(fake(true));
    assert.deepStrictEqual(await mailer.sendCredentials({ to: 'a@x.ph', name: 'A', password: 'Secret-9xyz' }), { sent: false, reason: 'failed' });
  } finally { console.error = origErr; }
  assert.ok(logged.length === 1 && !logged.join('').includes('Secret-9xyz'));
}));

test('a failure is named for what to fix: login refused, server unreachable, or something else', env({ SMTP_HOST: 'h', MAIL_FROM: 'f@x.ph' }, async () => {
  const origErr = console.error; console.error = () => {};
  try {
    for (const [code, reason] of [['EAUTH', 'auth'], ['ECONNECTION', 'unreachable'], ['ETIMEDOUT', 'unreachable'], ['ENOTFOUND', 'unreachable'], ['EENVELOPE', 'failed'], [undefined, 'failed']]) {
      mailer.setTransport({ sendMail: async () => { throw Object.assign(new Error('x'), { code }); } });
      assert.deepStrictEqual(await mailer.sendCredentials({ to: 'a@x.ph', name: 'A', password: 'Secret-9xyz' }), { sent: false, reason }, String(code));
    }
  } finally { console.error = origErr; }
}));

test('a notice email greets by name, lists its lines, links back to the app, and cannot be injected through them', env({ APP_URL: 'http://app.test/' }, async () => {
  const t = fake(); mailer.setTransport(t);
  const r = await mailer.sendNotice({ to: 'fay@x.ph', name: 'Fay', subject: 'New deadline: IT 204', lines: ['Submit by Oct 30.', 'Use <b>v4</b>.'] });
  assert.deepStrictEqual(r, { sent: true });
  const m = t.sent[0];
  assert.strictEqual(m.to, 'fay@x.ph'); assert.strictEqual(m.subject, 'New deadline: IT 204');
  assert.match(m.text, /^Hello Fay,/); assert.match(m.text, /Submit by Oct 30\./); assert.match(m.text, /Open the Syllabus Management System: http:\/\/app\.test$/m);
  assert.doesNotMatch(m.html, /<b>v4/); assert.match(m.html, /&lt;b&gt;v4&lt;\/b&gt;/); assert.match(m.html, /href="http:\/\/app\.test"/);
  assert.doesNotMatch(m.text + m.html, /password/i, 'a notice never carries a password');
}));

test('a notice email with no SMTP settings is not sent and says why, and a failing transport never throws', env({ SMTP_HOST: '', MAIL_FROM: '' }, async () => {
  mailer.setTransport(null);
  delete process.env.SMTP_HOST; delete process.env.MAIL_FROM;
  assert.deepStrictEqual(await mailer.sendNotice({ to: 'a@x.ph', name: 'A', subject: 'S', lines: ['x'] }), { sent: false, reason: 'not_configured' });
  mailer.setTransport(fake(true));
  assert.deepStrictEqual(await mailer.sendNotice({ to: 'a@x.ph', name: 'A', subject: 'S', lines: ['x'] }), { sent: false, reason: 'failed' });
}));
