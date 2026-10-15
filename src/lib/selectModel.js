// The rules of the dropdown (components/Select.jsx) that need no browser: which option the arrow keys land on, what typing does, and how
// a list is filtered. Items are { value, label, disabled }; "position" is an index into the list that is shown.

export const TYPE_RESET_MS = 700;   // typing pauses longer than this start a new search
export const FILTER_ABOVE = 10;     // a list longer than this filters as you type; a shorter one jumps to the match
export const PAGE_STEP = 8;

const enabled = (item) => !!item && !item.disabled;
const lower = (text) => String(text || '').toLowerCase();

export const firstEnabled = (items) => items.findIndex(enabled);
export const lastEnabled = (items) => { for (let i = items.length - 1; i >= 0; i--) if (enabled(items[i])) return i; return -1; };

// Where an arrow or Home/End/Page key lands. Disabled options are skipped and the list does not wrap, as in a native dropdown.
export function moveActive(items, position, key) {
  if (!items.some(enabled)) return -1;
  if (key === 'Home') return firstEnabled(items);
  if (key === 'End') return lastEnabled(items);
  const step = key === 'ArrowUp' ? -1 : key === 'PageUp' ? -PAGE_STEP : key === 'PageDown' ? PAGE_STEP : 1;
  const direction = step < 0 ? -1 : 1;
  let at = position < 0 ? (direction > 0 ? -1 : items.length) : position;
  let target = Math.min(items.length - 1, Math.max(0, at + step));
  if (Math.abs(step) === 1 && (at + step < 0 || at + step > items.length - 1)) return position < 0 ? firstEnabled(items) : position;
  while (target >= 0 && target < items.length && !enabled(items[target])) target += direction;
  if (target < 0 || target >= items.length) return position >= 0 && enabled(items[position]) ? position : (direction > 0 ? lastEnabled(items) : firstEnabled(items));
  return target;
}

// Short lists: typing "b" moves to the next option that starts with "b" (and to the one after that if "b" is pressed again).
export function jumpIndex(items, position, query) {
  const q = lower(query);
  if (!q) return position;
  const starts = (item) => enabled(item) && lower(item.label).startsWith(q);
  const sameLetter = q.length > 1 && [...q].every((c) => c === q[0]);
  const word = sameLetter ? q[0] : q;
  const at = (item) => enabled(item) && lower(item.label).startsWith(word);
  const from = sameLetter || q.length === 1 ? position + 1 : 0;
  for (let n = 0; n < items.length; n++) {
    const i = (from + n) % items.length;
    if ((sameLetter || q.length === 1 ? at : starts)(items[i])) return i;
  }
  return position;
}

// Long lists: only the options that contain what was typed, each remembering its place in the full list.
export function filterItems(items, query) {
  const q = lower(query).trim();
  const all = items.map((item, index) => ({ ...item, index }));
  return q ? all.filter((item) => lower(item.label).includes(q)) : all;
}

// What the typed text becomes after a key. Printable keys add to it (or start over after a pause); Backspace removes one letter.
export function nextQuery(query, key, { now = 0, lastAt = 0 } = {}) {
  if (key === 'Backspace') return query.slice(0, -1);
  const printable = typeof key === 'string' && key.length === 1;
  if (!printable) return query;
  return (now - lastAt > TYPE_RESET_MS ? '' : query) + key;
}
