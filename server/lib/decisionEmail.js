'use strict';
// The email a faculty member gets when a decision is made on their syllabus: approved (by the VPAA), returned for revision (by a reviewer), or
// rejected (by the VPAA). Sent only while the administrator's "Email notifications" switch is on (lib/adminSettings.js); the in-app notification
// is sent either way (routes/syllabi.js). In the background: the reviewer's answer never waits for the mail server, and a mail problem never
// undoes the decision (lib/mailer.js never throws). settled() lets tests wait for the sends in flight.
const mailer = require('./mailer');
const adminSettings = require('./adminSettings');

const BY = { admin: 'the dean', asst_vpaa: 'the Asst. VPAA', lic_director: 'the LIC Director', vpaa: 'the VPAA' };
const pending = new Set();
const settled = () => Promise.all([...pending]);

// -> { subject, lines } for one decision, or null for anything that is not a decision.
function compose({ status, code, title, comment, decidedBy }) {
  const name = [code, title].filter(Boolean).join(' — ') || 'your syllabus';
  const who = decidedBy && decidedBy.name ? `${BY[decidedBy.role] || 'a reviewer'} (${decidedBy.name})` : BY[decidedBy && decidedBy.role] || 'a reviewer';
  const reason = comment && String(comment).trim() ? ['Reason: ' + String(comment).trim().slice(0, 1000)] : [];
  if (status === 'approved') return { subject: 'Your syllabus was approved: ' + (code || title || 'syllabus'), lines: [`Your syllabus ${name} was approved by ${who}.`, 'It is now in the Repository.'] };
  if (status === 'for_revision') return { subject: 'Revision requested: ' + (code || title || 'syllabus'), lines: [`Your syllabus ${name} was returned for revision by ${who}.`, ...reason, 'Open My Syllabi to read the comments and submit a new version.'] };
  if (status === 'rejected') return { subject: 'Your syllabus was rejected: ' + (code || title || 'syllabus'), lines: [`Your syllabus ${name} was rejected by ${who}.`, ...reason] };
  return null;
}

// Starts the send and returns at once. ownerId: the faculty member to tell. Nothing is sent when the switch is off, the account has no email, or
// it is not a decision.
function send(db, { ownerId, status, code, title, comment, decidedBy }) {
  const message = compose({ status, code, title, comment, decidedBy });
  if (!message || !Number.isInteger(ownerId)) return null;
  const job = (async () => {
    if (!(await adminSettings.policy(db)).emailNotifications) return { sent: false, reason: 'turned_off' };
    const [rows] = await db.query('SELECT email, first_name FROM users WHERE user_id = ?', [ownerId]);
    const owner = rows[0];
    if (!owner || !owner.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(owner.email)) return { sent: false, reason: 'no_email' };
    return mailer.sendNotice({ to: owner.email, name: owner.first_name, subject: message.subject, lines: message.lines, linkText: 'Open the Syllabus Management System' });
  })().catch((err) => { console.error('DECISION EMAIL ERROR:', err && err.message); return { sent: false, reason: 'failed' }; });
  pending.add(job);
  job.finally(() => pending.delete(job));
  return job;
}

module.exports = { compose, send, settled };
