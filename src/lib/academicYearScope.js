// The academic year a screen shows. The server decides what a person may see (an administrator all years, everyone else the current and the previous one), so the list
// of years this module works from is already the visible one. Pure functions: no React, no network.
//
// A selection is '' (follow the current academic year: the default, so a new year starts empty) or a year label. The filter offers the years themselves only: the
// current academic year and the earlier ones the person may see, never a combined "previous and current" or "all years" choice (owner's decision, 2026-11-08).
// Two groups remember their own selection: the DATA screens (Dashboard, My Syllabi, Repository, Compliance, Analytics, Reports) and the work QUEUES (Review & Approval,
// AI Checker). Both start on the current year; a submission still waiting from an earlier year is found by choosing that year. ('all' is still understood by the
// server and by yearParam/selectionLabel, for links and exports that ask for it, but it is not offered here and a stored 'all' falls back to the current year.)
export const GROUPS = { data: 'data', queue: 'queue' };
export const groupOfPage = (page) => (page === 'review' || page === 'ai' ? GROUPS.queue : GROUPS.data);
export const defaultSelection = () => '';
export const currentOf = (years) => (years || []).find((y) => y.isCurrent) || null;

// The dropdown: [{ value, label, short }], newest first: the years only. `t` translates the fixed texts; the current year is tagged in the OPEN list only: a closed filter
// shows `short`, the year alone, with no "current" text beside it. (`group` and `isAdmin` no longer change the list; they are kept so callers stay unchanged.)
export function yearOptions({ years }, t) {
  const list = (years || []).slice().sort((a, b) => b.startYear - a.startYear);
  const items = list.map((y) => ({ value: y.isCurrent ? '' : y.label, label: y.isCurrent ? `${y.label} · ${t('years.currentTag')}` : y.label, short: y.label }));
  return items;
}

// A stored or requested selection that is no longer offered (the current year moved on, the year was never visible) falls back to the group's default.
export function normalizeSelection(selection, options, group) {
  return options.some((o) => o.value === selection) ? selection : defaultSelection(group);
}

// What the API gets as ?year=: nothing for the current year (the server's own default), 'all', or the label.
export const yearParam = (selection) => (selection === '' || selection === undefined || selection === null ? undefined : selection);

// The text of the current selection for headings and exports ("AY 2026–2027", "all years").
export function selectionLabel(selection, years, t) {
  if (selection === 'all') return t('subjects.allYears');
  const year = selection === '' ? currentOf(years) : (years || []).find((y) => y.label === selection);
  return year ? year.label : '';
}

export const STORAGE_KEY = 'sms.academicYear.scope';
export function readStored(storage, userId) {
  try { const all = JSON.parse(storage.getItem(STORAGE_KEY) || '{}'); const mine = all[String(userId)]; return mine && typeof mine === 'object' ? { data: typeof mine.data === 'string' ? mine.data : '', queue: typeof mine.queue === 'string' ? mine.queue : '' } : { data: '', queue: '' }; }
  catch { return { data: '', queue: '' }; }
}
export function writeStored(storage, userId, value) {
  try { const all = JSON.parse(storage.getItem(STORAGE_KEY) || '{}'); all[String(userId)] = value; storage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch { /* a private window or blocked storage: the choice just is not remembered */ }
}
