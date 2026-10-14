// Sends the emails that carry a generated password. One function, never throws: the caller learns from the result whether it went out,
// and a mail problem never undoes the thing it was about (a user that was just registered stays registered).
// SMTP settings come from server/.env (see .env.example). With none set, nothing is sent and the result says so.
const nodemailer = require('nodemailer');

let transport = null; // built on first use; tests put a fake one here with setTransport

const configured = () => !!(process.env.SMTP_HOST && process.env.MAIL_FROM);

function getTransport() {
  if (transport) return transport;
  if (!configured()) return null;
  const port = Number(process.env.SMTP_PORT) || 587;
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined,
  });
  return transport;
}
const setTransport = (t) => { transport = t; };

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const loginUrl = () => (process.env.APP_URL || '').replace(/\/+$/, '');

// The subject, plain text and HTML of a credentials email. reason: 'welcome' (an administrator registered the account) or 'forgot'.
function compose({ to, name, password, reason }) {
  const url = loginUrl();
  const first = String(name || '').trim() || 'there';
  const forgot = reason === 'forgot';
  const subject = forgot ? 'Your temporary password for the Syllabus Management System' : 'Your Syllabus Management System account';
  const lines = forgot
    ? ['Someone asked for a new password for this account. Your temporary password is below. It works for 30 minutes.',
       'If you did not ask for it, ignore this email: your current password still works and nothing was changed.']
    : ['An administrator registered an account for you in the Syllabus Management System.'];
  const text = [
    'Hello ' + first + ',', '',
    ...lines, '',
    'Username: ' + to,
    'Temporary password: ' + password, '',
    ...(url ? ['Sign in at ' + url] : []),
    'You will be asked to choose your own password the first time you sign in.', '',
    'Syllabus Management System',
  ].join('\n');
  const html = '<p>Hello ' + esc(first) + ',</p>' + lines.map((l) => '<p>' + esc(l) + '</p>').join('')
    + '<p>Username: <strong>' + esc(to) + '</strong><br>Temporary password: <strong style="font-family:monospace;font-size:16px">' + esc(password) + '</strong></p>'
    + (url ? '<p><a href="' + esc(url) + '">Sign in to the Syllabus Management System</a></p>' : '')
    + '<p>You will be asked to choose your own password the first time you sign in.</p>';
  return { subject, text, html };
}

// Why a send failed, in words the admin can act on: the mail server refused the login ('auth'), could not be reached ('unreachable'),
// or something else ('failed'). Only the error's code is looked at; its text could repeat what was sent, so it is not passed on.
const UNREACHABLE = ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNREFUSED', 'ENOTFOUND', 'EDNS', 'EAI_AGAIN'];
const reasonOf = (err) => (err && err.code === 'EAUTH' ? 'auth' : err && UNREACHABLE.includes(err.code) ? 'unreachable' : 'failed');

// -> { sent: true } or { sent: false, reason: 'not_configured' | 'auth' | 'unreachable' | 'failed' }. The password is only ever in the message itself.
async function sendCredentials({ to, name, password, reason = 'welcome' }) {
  try {
    const t = getTransport();
    if (!t) {
      console.warn('MAIL: SMTP is not configured (SMTP_HOST, MAIL_FROM), so no email was sent to ' + to);
      return { sent: false, reason: 'not_configured' };
    }
    await t.sendMail({ from: process.env.MAIL_FROM || 'no-reply@localhost', to, ...compose({ to, name, password, reason }) });
    return { sent: true };
  } catch (err) {
    console.error('MAIL ERROR: could not send to ' + to + ' (' + ((err && err.code) || 'no code') + '): ' + (err && err.message)); // the message has no password: it is never put in an error
    return { sent: false, reason: reasonOf(err) };
  }
}

module.exports = { sendCredentials, setTransport, compose, configured };
