import { PH_TZ } from './phTime.js';
// The rules of the date picker (components/DatePicker.jsx) that need no browser: reading and writing the same strings a native
// <input type="date"> and <input type="datetime-local"> use, building a month, moving with the keys, and the limits (min / max).
// A day is { y, m, d } (month 1-12). All arithmetic is in UTC so the viewer's own time zone can never shift a date.

export const DEFAULT_TIME = { hh: 17, mm: 0 }; // when a day is chosen before any time: the end of a working day

export const pad = (n) => String(n).padStart(2, '0');
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const weekdayOf = ({ y, m, d }) => new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
export const dateKey = ({ y, m, d }) => y + '-' + pad(m) + '-' + pad(d);

// "2026-10-16" or "2026-10-16T17:30" -> { y, m, d, hh, mm } (hh and mm are null without a time). Anything that is not a real day gives null.
export function parseValue(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(value == null ? '' : value));
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  const hh = m[4] === undefined ? null : Number(m[4]);
  const mm = m[5] === undefined ? null : Number(m[5]);
  if (hh !== null && (hh > 23 || mm > 59)) return null;
  return { y, m: mo, d, hh, mm };
}

// The string the form holds: the day, plus "THH:mm" when the picker also asks for a time.
export function formatValue(day, time, withTime) {
  return withTime ? dateKey(day) + 'T' + pad(time.hh) + ':' + pad(time.mm) : dateKey(day);
}
export const timeValue = (time) => (time && time.hh !== null && time.hh !== undefined ? pad(time.hh) + ':' + pad(time.mm) : '');
export function parseTime(text) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(text || ''));
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? { hh: Number(m[1]), mm: Number(m[2]) } : null;
}

export function addDays(day, n) {
  const dt = new Date(Date.UTC(day.y, day.m - 1, day.d + n));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
// Jan 31 + 1 month is Feb 28 (or 29), never March 3.
export function addMonths(day, n) {
  const total = day.y * 12 + (day.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  return { y, m, d: Math.min(day.d, daysInMonth(y, m)) };
}

// Six weeks, Sunday first, always six so the panel never changes height from one month to the next.
export function monthGrid(y, m) {
  const start = addDays({ y, m, d: 1 }, -weekdayOf({ y, m, d: 1 }));
  return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, week * 7 + i);
    return { ...day, key: dateKey(day), outside: day.m !== m };
  }));
}

// min / max are the strings an input takes (a day, or a day and a time); only the day counts here.
const dayOf = (value) => { const p = parseValue(value); return p ? { y: p.y, m: p.m, d: p.d } : null; };
export function isOutOfRange(day, min, max) {
  const key = dateKey(day);
  const lo = dayOf(min); const hi = dayOf(max);
  return (lo && key < dateKey(lo)) || (hi && key > dateKey(hi)) || false;
}
export function clampDay(day, min, max) {
  const lo = dayOf(min); const hi = dayOf(max);
  if (lo && dateKey(day) < dateKey(lo)) return lo;
  if (hi && dateKey(day) > dateKey(hi)) return hi;
  return day;
}

// Where a key moves the highlighted day, as in a native calendar. Anything else gives null.
export function moveDay(day, key) {
  const wd = weekdayOf(day);
  switch (key) {
    case 'ArrowLeft': return addDays(day, -1);
    case 'ArrowRight': return addDays(day, 1);
    case 'ArrowUp': return addDays(day, -7);
    case 'ArrowDown': return addDays(day, 7);
    case 'Home': return addDays(day, -wd);
    case 'End': return addDays(day, 6 - wd);
    case 'PageUp': return addMonths(day, -1);
    case 'PageDown': return addMonths(day, 1);
    default: return null;
  }
}

// Today in the Philippines (the app shows Philippine time everywhere), whatever the computer's own clock zone is.
export function todayPH(now = new Date()) {
  return parseValue(new Intl.DateTimeFormat('en-CA', { timeZone: PH_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now));
}
