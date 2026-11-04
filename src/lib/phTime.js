import { getLocale } from '../i18n/store.js';
// Every date and time the app shows is Philippine time (Asia/Manila, UTC+8, no daylight saving), whatever the viewer's computer is set to.
// One place, so a timestamp reads the same on every screen and for every user. Plain functions, tested on their own.
export const PH_TZ = 'Asia/Manila';
const PH_OFFSET = '+08:00';
const PH_OFFSET_HOURS = 8;

// A value from the server as a Date. It may be a Date, an ISO string with a zone (the API sends these), or a MySQL "YYYY-MM-DD HH:mm:ss"
// with no zone: that is the database's own clock, which is Philippine time, so it is read as such. Anything unreadable gives null.
export function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === null || value === undefined || value === '') return null;
  const s = String(value).trim();
  const bare = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/.exec(s); // no Z and no offset
  const d = new Date(bare ? bare[1] + 'T' + bare[2] + PH_OFFSET : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const formatter = (opts) => new Intl.DateTimeFormat(getLocale(), { timeZone: PH_TZ, ...opts });
const clean = (text) => text.replace(/[  ]/g, ' '); // newer ICU puts a narrow no-break space before AM/PM

// "Oct 14, 2026"
export function phDate(value) {
  const d = toDate(value);
  return d ? clean(formatter({ month: 'short', day: 'numeric', year: 'numeric' }).format(d)) : '';
}
// "3:44 PM"
export function phTime(value) {
  const d = toDate(value);
  return d ? clean(formatter({ hour: 'numeric', minute: '2-digit', hour12: true }).format(d)) : '';
}
// "Oct 14, 2026, 3:44 PM"
export function phDateTime(value) {
  const day = phDate(value);
  const time = phTime(value);
  return day && time ? day + ', ' + time : day;
}
// "14 Oct 2026 · 3:44 PM": the compact form the lists and notifications use.
export function phCompact(value) {
  const d = toDate(value);
  if (!d) return '';
  const p = Object.fromEntries(formatter({ day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(d).map((x) => [x.type, x.value]));
  return p.day + ' ' + p.month + ' ' + p.year + ' · ' + p.hour + ':' + p.minute + ' ' + String(p.dayPeriod || '').toUpperCase();
}

// The start of a Philippine calendar day ('YYYY-MM-DD') as an instant, plus a number of days. null for a date that does not exist (2026-02-31).
export function phDayStart(ymd, plusDays = 0) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return new Date(Date.UTC(y, mo - 1, d + plusDays, -PH_OFFSET_HOURS)); // midnight in Manila is 16:00 UTC the day before
}

// The hour (0-23) on the Manila clock, whatever the viewer's computer is set to.
export function phHour(now = new Date()) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: PH_TZ, hour: 'numeric', hourCycle: 'h23' }).formatToParts(now).find((x) => x.type === 'hour');
  return Number(part.value) % 24;
}
// Which greeting fits the Manila time of day: 5:00-11:59 morning, 12:00-17:59 afternoon, 18:00-4:59 evening.
export function dayPeriod(now = new Date()) {
  const hour = phHour(now);
  return hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening';
}
