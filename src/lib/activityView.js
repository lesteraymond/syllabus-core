// The dashboard's Recent Activity: each log row from the server ({ action, user, courseCode, title, actionDate }) as a sentence ("Diana Evale
// approved FM 202"), with the icon and tone that say what kind of event it is, grouped under Today / Yesterday / a date. Times are Philippine
// time (phTime.js). Plain functions, tested on their own.
import { phDate, phTime, toDate } from './phTime.js';

// What each action looks like. Decisions carry a color; routine events stay quiet so the decisions stand out.
export const KINDS = {
  approve: { icon: 'sealCheck', tone: 'good', verb: 'approved' },
  revision: { icon: 'arrowUUpLeft', tone: 'warn', verb: 'returned for revision' },
  reject: { icon: 'xCircle', tone: 'bad', verb: 'rejected' },
  submit: { icon: 'paperPlaneTilt', tone: 'info', verb: 'submitted' },
  upload: { icon: 'uploadSimple', tone: 'info', verb: 'uploaded' },
  update: { icon: 'notePencil', tone: 'quiet', verb: 'updated' },
  delete: { icon: 'trash', tone: 'quiet', verb: 'deleted' },
};
const FALLBACK = { icon: 'notePencil', tone: 'quiet', verb: 'made a change to' };

// -> { key, icon, tone, who, verb, subject, detail, time, iso, when }
export function describeActivity(log, index = 0) {
  const kind = KINDS[log && log.action] || FALLBACK;
  const code = String((log && log.courseCode) || '').trim();
  const title = String((log && log.title) || '').trim();
  const d = toDate(log && log.actionDate);
  return {
    key: (log && log.id) || 'row-' + index,
    icon: kind.icon,
    tone: kind.tone,
    who: String((log && log.user) || '').trim() || 'Someone',
    verb: kind.verb,
    subject: code || title || 'a syllabus',
    detail: code && title ? title : '', // the course title under the code, when there is both
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
