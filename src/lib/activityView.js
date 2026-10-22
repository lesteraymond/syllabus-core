// The dashboard's Recent Activity: each log row from the server ({ action, user, courseCode, title, actionDate }) as a sentence ("Diana Evale
// approved FM 202"), with the icon and tone that say what kind of event it is, grouped under Today / Yesterday / a date. Times are Philippine
// time (phTime.js). Plain functions, tested on their own.
import { phDate, phTime, toDate } from './phTime.js';

// What each action looks like. Decisions carry a color; routine events stay quiet so the decisions stand out.
export const KINDS = {
  approve: { icon: 'approved', tone: 'good', verb: 'approved' },
  revision: { icon: 'revise', tone: 'warn', verb: 'returned for revision' },
  reject: { icon: 'denied', tone: 'bad', verb: 'rejected' },
  submit: { icon: 'paperPlaneTilt', tone: 'info', verb: 'submitted' },
  upload: { icon: 'uploadSimple', tone: 'info', verb: 'uploaded' },
  update: { icon: 'notePencil', tone: 'quiet', verb: 'updated' },
  delete: { icon: 'bin', tone: 'quiet', verb: 'deleted' },
  aiCheck: { icon: 'sparkle', tone: 'info', verb: 'ran an AI check on' },
};
const FALLBACK = { icon: 'notePencil', tone: 'quiet', verb: 'made a change to' };

// -> { key, icon, tone, who, verb, subject, detail, time, iso, when }. `viewerId` is the signed-in user: their own actions read "You".
export function describeActivity(log, index = 0, viewerId = null) {
  // Older rows logged the first submission from the builder as an "upload"; its note says what it really was.
  const submittedFromBuilder = log && log.action === 'upload' && /^Syllabus submitted from the builder/.test(String(log.notes || ''));
  // An AI check is stored as an 'update' whose note starts with "AI check:" (so the log table's action list stays as it is).
  const aiCheck = log && log.action === 'update' && /^AI check:/.test(String(log.notes || ''));
  const kind = KINDS[aiCheck ? 'aiCheck' : submittedFromBuilder ? 'submit' : log && log.action] || FALLBACK;
  const score = aiCheck ? (String(log.notes).match(/(\d{1,3})%/) || [])[1] : null;
  const code = String((log && log.courseCode) || '').trim();
  const title = String((log && log.title) || '').trim();
  const d = toDate(log && log.actionDate);
  return {
    key: (log && log.id) || 'row-' + index,
    icon: kind.icon,
    tone: kind.tone,
    who: viewerId !== null && log && log.userId === viewerId ? 'You' : String((log && log.user) || '').trim() || 'Someone',
    verb: kind.verb,
    subject: code || title || 'a syllabus',
    detail: (code && title ? title : '') + (score ? (code && title ? ' · ' : '') + 'AI check score ' + score + '%' : ''), // the course title under the code, when there is both; an AI check adds its score
    time: phTime(d),
    iso: d ? d.toISOString() : '',
    when: d,
  };
}

// "Today", "Yesterday", or the date ("Oct 12, 2026"), by the Philippine calendar day. Manila has no daylight saving, so a day is 24 hours.
export function dayLabel(value, now = new Date()) {
  const day = phDate(value);
  if (!day) return '';
  if (day === phDate(now)) return 'Today';
  if (day === phDate(new Date(toDate(now).getTime() - 24 * 3600 * 1000))) return 'Yesterday';
  return day;
}

// Items in the order given (newest first), gathered under their day. A run of the same day is one group.
export function groupByDay(items, now = new Date()) {
  const groups = [];
  items.forEach((it) => {
    const label = dayLabel(it.when, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(it);
    else groups.push({ label, items: [it] });
  });
  return groups;
}

// "Clear Logs" hides what was done up to now from this account's list, in this browser (nothing is deleted: the history stays for every other
// screen). Kept per account, so it holds after a refresh.
const clearedKey = (userId) => 'sms.activityClearedAt.' + userId;
export function readClearedAt(userId, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { return (storage && storage.getItem(clearedKey(userId))) || ''; } catch { return ''; }
}
export function writeClearedAt(userId, at = new Date(), storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  const iso = at.toISOString();
  try { if (storage) storage.setItem(clearedKey(userId), iso); } catch { /* storage blocked: it clears for this visit only */ }
  return iso;
}
// The rows done after the clear; with no clear (or an unreadable date) all of them.
export function afterCleared(logs, clearedAt) {
  const t = clearedAt ? new Date(clearedAt).getTime() : NaN;
  return Number.isNaN(t) ? logs : logs.filter((l) => { const d = toDate(l.actionDate); return d && d.getTime() > t; });
}
