// The dashboard's Recent Activity: each log row from the server ({ action, user, courseCode, title, actionDate }) as a sentence ("Diana Evale
// approved FM 202"), with the icon and tone that say what kind of event it is, grouped under Today / Yesterday / a date. Times are Philippine
// time (phTime.js). Plain functions, tested on their own. Two kinds of row: what the person did to a syllabus in the review (submit, check,
// approve, ...) and their account activity (sign-in, sign-out, password, name, photo, language, drafts, edits, deletions; server/lib/accountActivity.js).
import { phDate, phTime, toDate } from './phTime.js';
import { ROLE_LABELS } from './roles.js';

// What each action looks like. Decisions carry a color; routine events stay quiet so the decisions stand out.
export const KINDS = {
  approve: { icon: 'approved', tone: 'good', verb: 'approved' },
  revision: { icon: 'revise', tone: 'warn', verb: 'returned for revision' },
  reject: { icon: 'denied', tone: 'bad', verb: 'rejected' },
  submit: { icon: 'paperPlaneTilt', tone: 'info', verb: 'submitted' },
  upload: { icon: 'uploadSimple', tone: 'info', verb: 'uploaded' },
  update: { icon: 'notePencil', tone: 'quiet', verb: 'updated' },
  delete: { icon: 'bin', tone: 'quiet', verb: 'deleted' },
  check: { icon: 'sparkle', tone: 'info', verb: 'ran an AI check on' },
  recommend: { icon: 'checkCircle', tone: 'quiet', verb: 'answered a recommendation on' },
  // the account's own activity; `account: true` rows are about the account, not a syllabus, so they name no syllabus
  login: { icon: 'signIn', tone: 'quiet', verb: 'signed in', account: true },
  logout: { icon: 'signOut', tone: 'quiet', verb: 'signed out', account: true },
  password_change: { icon: 'key', tone: 'info', verb: 'changed the password', account: true },
  name_change: { icon: 'identificationCard', tone: 'info', verb: 'changed the name', account: true },
  photo_change: { icon: 'userCircle', tone: 'quiet', verb: 'changed the profile photo', account: true },
  language_change: { icon: 'translate', tone: 'quiet', verb: 'changed the language', account: true },
  draft_create: { icon: 'filePlus', tone: 'info', verb: 'started a new draft' },
  content_edit: { icon: 'pencilSquare', tone: 'quiet', verb: 'edited' },
  syllabus_delete: { icon: 'trash', tone: 'warn', verb: 'deleted' },
  // a sign-in that was refused, recorded on the account it was for
  login_failed: { icon: 'warning', tone: 'bad', verb: 'failed to sign in', account: true },
  // the administrator's management of accounts: the subject is the account acted on
  user_create: { icon: 'usersThree', tone: 'info', verb: 'registered the account of', manages: true },
  user_credentials: { icon: 'envelope', tone: 'info', verb: 'sent new sign-in details to', manages: true },
  user_disable: { icon: 'xCircle', tone: 'bad', verb: 'disabled the account of', manages: true },
  user_enable: { icon: 'sealCheck', tone: 'good', verb: 'enabled the account of', manages: true },
  user_delete: { icon: 'eyeSlash', tone: 'bad', verb: 'removed the account of', manages: true },
  user_assignments: { icon: 'graduationCap', tone: 'quiet', verb: 'changed the assignments of', manages: true },
};
// The note under an account row, from what the server stored (never a password): how the person signed in, which language, ...
const NOTES = {
  login: { password: 'with a password', google: 'with Google', temporary: 'with a temporary password', remembered: 'on a remembered device' },
  login_failed: { password: 'wrong password', disabled: 'the account is disabled', disabled_remembered: 'the account is disabled (remembered device)' },
  password_change: { required: 'after a generated password, as required', self: '' },
  language_change: { en: 'English', tl: 'Tagalog' },
};
const PHOTO_VERBS = { upload: 'changed the profile photo', google: 'used the Google photo as the profile photo', remove: 'removed the profile photo', remove_other: 'removed the profile photo of' };
// An edit or a deletion says what it was: a draft, or a syllabus in another status.
const ON_DRAFT = { draft_create: 'started a new draft of', content_edit: 'edited the draft of', syllabus_delete: 'deleted the draft of' };
const ON_SYLLABUS = { content_edit: 'edited', syllabus_delete: 'deleted' };
// What a person did with a recommendation, from the first word of the note the server wrote ("Accepted recommendation: plan[3].tasks").
const RECOMMEND_VERBS = { Accepted: 'accepted a recommendation on', Edited: 'edited and applied a recommendation on', Rejected: 'rejected a recommendation on', Undid: 'undid a recommendation on' };
const FALLBACK = { icon: 'notePencil', tone: 'quiet', verb: 'made a change to' };

// -> { key, icon, tone, who, verb, subject, detail, time, iso, when }. `viewerId` is the signed-in user: their own actions read "You".
export function describeActivity(log, index = 0, viewerId = null) {
  // Older rows logged the first submission from the builder as an "upload"; its note says what it really was.
  const submittedFromBuilder = log && log.action === 'upload' && /^Syllabus submitted from the builder/.test(String(log.notes || ''));
  const kind = KINDS[submittedFromBuilder ? 'submit' : log && log.action] || FALLBACK;
  const code = String((log && log.courseCode) || '').trim();
  const title = String((log && log.title) || '').trim();
  const d = toDate(log && log.actionDate);
  const action = log && log.action;
  const notes = String((log && log.notes) || '').trim();
  let verb = (action === 'recommend' && RECOMMEND_VERBS[notes.split(' ')[0]]) || kind.verb;
  let subject = code || title || 'a syllabus';
  let detail = code && title ? title : ''; // the course title under the code, when there is both
  let note = '';
  if (kind.account) {
    subject = ''; detail = '';
    note = (NOTES[action] && NOTES[action][notes]) || '';
    if (action === 'name_change') detail = notes; // "Old Name → New Name": names, not translated
    if (action === 'photo_change') { verb = PHOTO_VERBS[notes] || verb; if (notes === 'remove_other') subject = String((log && log.courseCode) || '').trim() || 'another account'; }
  } else if (kind.manages) {
    subject = code || 'an account'; detail = ''; // the account's name, recorded at the time
    if (action === 'user_create') note = ROLE_LABELS[notes] || '';
    if (action === 'user_assignments' && /^\d+$/.test(notes)) note = 'Subjects assigned: ' + notes;
  } else if (action === 'draft_create') {
    if (code || title) verb = ON_DRAFT.draft_create; else { subject = ''; detail = ''; } // a new draft has no subject until one is chosen
  } else if (ON_SYLLABUS[action]) {
    verb = notes === 'draft' ? ON_DRAFT[action] : ON_SYLLABUS[action];
  }
  return {
    key: (log && log.id) || 'row-' + index,
    icon: kind.icon,
    tone: kind.tone,
    who: viewerId !== null && log && log.userId === viewerId ? 'You' : String((log && log.user) || '').trim() || 'Someone',
    verb,
    subject,
    detail, // shown as it is: a course title, or names
    note, // an interface phrase, translated where it is shown
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
