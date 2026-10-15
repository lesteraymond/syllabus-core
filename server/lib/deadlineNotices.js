// Telling faculty about deadlines: the in-app notification (the bell) and an email, for the same event.
//
//   created    a deadline was set for a subject they are assigned to        updated    its date or instructions changed
//   cancelled  the deadline was cancelled                                   manual     the administrator pressed Remind
//   before     due within 3 days (automatic)    due   it is due today (automatic)    missed   the time passed with nothing submitted (automatic)
//
// Only faculty who have not submitted are told (someone who has needs no reminder). Every notice is written to deadline_notices, which is
// what stops the automatic ones from repeating and what shows the administrator when someone was last reminded. Notifications and emails
// never break the action that caused them: a failure is logged and the deadline is saved all the same, as with the password emails.
// Emails follow the administrator's "Email notifications" setting; the bell always works. DEADLINE_NOTICES=off turns all of it off.

const D = require('./deadlines');
const { httpError } = require('./http');

const DAY = 24 * 60 * 60 * 1000;
const LEAD_MS = 3 * DAY;                    // "due soon" starts this long before the due time
const COOLDOWN_MS = 6 * 60 * 60 * 1000;     // a person can be reminded by hand once in this long
const QUIET_MS = DAY;                       // no "due soon" right after they were told about the deadline
const CHECK_MS = 15 * 60 * 1000;            // how often the automatic check runs
const FIRST_CHECK_MS = 30 * 1000;           // and how long after the server starts the first one is
const SETTLED = new Set(['submitted', 'submitted_late']);

const secs = (ms) => Math.floor(ms / 1000);
const dueText = (ms) => new Date(ms).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).replace(/[  ]/g, ' ') + ' (Philippine Time)';

// The words of a notice. `deadline` has its times in milliseconds (the stored form); `previous` is the one before a change.
function compose(kind, deadline, { previous = null } = {}) {
  const code = deadline.course.code;
  const subject = code + ' · ' + deadline.course.title;
  const due = dueText(deadline.dueAt);
  const instructions = deadline.instructions ? ['Instructions: ' + deadline.instructions] : [];
  switch (kind) {
    case 'created': return { title: 'New deadline: ' + code, lines: ['An administrator set a deadline for ' + subject + ' (' + deadline.term + ').', 'Please submit your syllabus by ' + due + '.', ...instructions] };
    case 'updated': return { title: 'Deadline changed: ' + code, lines: ['The deadline for ' + subject + ' (' + deadline.term + ') was changed.', 'New due date: ' + due + '.',
      ...(previous && previous.dueAt !== deadline.dueAt ? ['It was ' + dueText(previous.dueAt) + '.'] : []), ...instructions] };
    case 'cancelled': return { title: 'Deadline cancelled: ' + code, lines: ['The deadline for ' + subject + ' (' + deadline.term + ') was cancelled. You do not need to submit by that date.'] };
    case 'before': return { title: 'Due soon: ' + code, lines: ['Your syllabus for ' + subject + ' is due ' + due + '.', 'Please submit it before then.', ...instructions] };
    case 'due': return { title: 'Due today: ' + code, lines: ['Your syllabus for ' + subject + ' is due today, ' + due + '.', ...instructions] };
    case 'missed': return { title: 'Deadline missed: ' + code, lines: ['The deadline for ' + subject + ' passed on ' + due + ' and no syllabus was submitted.', 'You can still submit it; it will be marked as late.', ...instructions] };
    case 'manual': return { title: 'Reminder: submit your syllabus for ' + code, lines: ['The administrator asks you to submit your syllabus for ' + subject + '.', 'Due: ' + due + '.', ...instructions] };
    default: throw new Error('Unknown notice: ' + kind);
  }
}

// A deadline as the routes return it (ISO dates) -> as stored (milliseconds).
const stored = (d) => (d ? { ...d, dueAt: Date.parse(d.dueAt), opensAt: Date.parse(d.opensAt) } : d);

function createDeadlineNotifier({ db, now = Date.now, notify, mail, log = console, env = process.env }) {
  const on = () => env.DEADLINE_NOTICES !== 'off' && available;
  let available = true;
  let timer = null;
  let first = null;
  let running = false;
  const noTable = (err) => {
    if (err && err.code === 'ER_NO_SUCH_TABLE') { if (available) log.warn('DEADLINES: the deadline tables are missing. Run "npm run migrate-deadlines" in server/ to turn deadline notices on.'); available = false; return true; }
    return false;
  };

  async function emailsEnabled() {
    try {
      const [rows] = await db.query("SELECT setting_value FROM app_settings WHERE setting_key = 'administration'");
      return !rows.length || JSON.parse(rows[0].setting_value).emailNotifications !== false;
    } catch { return true; }
  }

  // Tell these people (by user id) about this deadline. Returns how many were notified and how many emails went out.
  async function send(deadline, userIds, kind, { sentBy = null, previous = null } = {}) {
    if (!on() || !userIds.length) return { notified: 0, emailed: 0 };
    const [users] = await db.query('SELECT user_id, email, first_name, last_name FROM users WHERE user_id IN (?)', [userIds]);
    const message = compose(kind, deadline, { previous });
    const mailOn = await emailsEnabled();
    let emailed = 0;
    for (const u of users) {
      await notify(db, { userId: u.user_id, type: 'deadline', title: message.title, body: message.lines.join(' ') });
      if (mailOn && u.email) {
        const result = await mail({ to: u.email, name: u.first_name, subject: message.title, lines: message.lines });
        if (result && result.sent) emailed += 1;
      }
    }
    if (users.length) await db.query('INSERT INTO deadline_notices (deadline_id, user_id, kind, sent_by) VALUES ?', [users.map((u) => [deadline.id, u.user_id, kind, sentBy])]);
    return { notified: users.length, emailed };
  }

  // Faculty assigned to the subject who have not submitted yet.
  const pending = async (deadline) => (await D.requirements(db, deadline, now())).filter((p) => !SETTLED.has(p.status)).map((p) => p.userId);

  // The hooks the routes call after they have saved. They never throw.
  const guard = (fn) => async (...args) => {
    if (!on()) return { notified: 0, emailed: 0 };        // off, or the tables are missing: no lookups at all
    try { return await fn(...args); }
    catch (err) { if (!noTable(err)) log.error('DEADLINE NOTICE ERROR:', err.message); return { notified: 0, emailed: 0, error: true }; }
  };
  const onCreated = guard(async (created) => { const d = stored(created); return send(d, await pending(d), 'created'); });
  const onCancelled = guard(async (cancelled) => { const d = stored(cancelled); return send(d, await pending(d), 'cancelled'); });
  const onUpdated = guard(async (before, after) => {
    const p = stored(before), d = stored(after);
    const dueMoved = p.dueAt !== d.dueAt;
    if (dueMoved) await db.query("DELETE FROM deadline_notices WHERE deadline_id = ? AND kind IN ('before', 'due', 'missed')", [d.id]);   // the new date starts the automatic notices over
    if (!dueMoved && p.term === d.term && (p.instructions || '') === (d.instructions || '')) return { notified: 0, emailed: 0 };
    return send(d, await pending(d), 'updated', { previous: p });
  });

  // The administrator's Remind button. userIds limits it to some people; without it, everyone who has not submitted.
  async function remind(deadlineId, userIds, sentBy) {
    if (!on()) return { sent: 0, emailed: 0, skipped: [] };
    const deadline = await D.loadDeadline(db, deadlineId);
    if (!deadline || deadline.cancelled) throw httpError(404, 'Deadline not found');
    const people = await D.requirements(db, deadline, now());
    const wanted = Array.isArray(userIds) && userIds.length ? userIds.map(Number) : people.map((p) => p.userId);
    const [recent] = await db.query("SELECT user_id FROM deadline_notices WHERE deadline_id = ? AND kind = 'manual' AND created_at >= FROM_UNIXTIME(?) GROUP BY user_id", [deadlineId, secs(now() - COOLDOWN_MS)]);
    const cooling = new Set(recent.map((r) => r.user_id));
    const targets = [];
    const skipped = [];
    for (const id of [...new Set(wanted)]) {
      const person = people.find((p) => p.userId === id);
      if (!person) skipped.push({ userId: id, reason: 'not_assigned' });
      else if (SETTLED.has(person.status)) skipped.push({ userId: id, reason: 'submitted' });
      else if (cooling.has(id)) skipped.push({ userId: id, reason: 'cooldown' });
      else targets.push(id);
    }
    const result = await send(deadline, targets, 'manual', { sentBy });
    return { sent: result.notified, emailed: result.emailed, skipped };
  }

  // The automatic notices: due soon, due today, missed. Each is sent once per person and deadline.
  async function runChecks() {
    if (!on()) return { sent: 0 };
    let sent = 0;
    for (const d of await D.activeDeadlines(db)) {
      const open = (await D.requirements(db, d, now())).filter((p) => !SETTLED.has(p.status));
      if (!open.length) continue;
      const [done] = await db.query("SELECT user_id, kind FROM deadline_notices WHERE deadline_id = ? AND kind IN ('before', 'due', 'missed')", [d.id]);
      const [fresh] = await db.query("SELECT user_id FROM deadline_notices WHERE deadline_id = ? AND kind IN ('created', 'updated', 'manual') AND created_at >= FROM_UNIXTIME(?) GROUP BY user_id", [d.id, secs(now() - QUIET_MS)]);
      const had = new Set(done.map((r) => r.user_id + ':' + r.kind));
      const justTold = new Set(fresh.map((r) => r.user_id));
      const groups = {};
      for (const p of open) {
        const kind = p.status === 'failed' ? 'missed' : p.status === 'due_today' ? 'due' : d.dueAt - now() <= LEAD_MS && !justTold.has(p.userId) ? 'before' : null;
        if (kind && !had.has(p.userId + ':' + kind)) (groups[kind] = groups[kind] || []).push(p.userId);
      }
      for (const [kind, ids] of Object.entries(groups)) sent += (await send(d, ids, kind)).notified;
    }
    return { sent };
  }

  const check = async () => {
    if (running || !on()) return;
    running = true;
    try { await runChecks(); } catch (err) { if (!noTable(err)) log.error('DEADLINE CHECK ERROR:', err.message); } finally { running = false; }
  };
  function start() {
    if (timer || env.DEADLINE_NOTICES === 'off') return;
    timer = setInterval(check, Number(env.DEADLINE_CHECK_MS) || CHECK_MS);
    first = setTimeout(check, FIRST_CHECK_MS);
    for (const t of [timer, first]) if (t.unref) t.unref();
  }
  async function stop() { clearInterval(timer); clearTimeout(first); timer = null; first = null; }

  return { onCreated, onUpdated, onCancelled, remind, runChecks, start, stop };
}

module.exports = { compose, createDeadlineNotifier, LEAD_MS, COOLDOWN_MS, QUIET_MS };
