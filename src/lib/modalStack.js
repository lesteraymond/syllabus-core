// Which modal is on top. When one window opens another (the syllabus window opens Revision History, say), only the top one should
// answer Esc and Tab, paint above the others, and be reachable; the ones under it wait. This file is the plain logic, with no DOM,
// so it can be tested; src/components/useModalLayer.js applies it to the page.

export const LAYER_BASE = 50; // the z-index of the first modal (the .overlay rule in styles.css)

export function createModalStack() {
  const layers = []; // ids, bottom to top
  return {
    // Opens a layer on top. Opening an id that is already open moves it to the top instead of duplicating it.
    push(id) {
      const i = layers.indexOf(id);
      if (i > -1) layers.splice(i, 1);
      layers.push(id);
    },
    // Closes a layer wherever it is in the stack; the ones above and below keep their order.
    remove(id) {
      const i = layers.indexOf(id);
      if (i > -1) layers.splice(i, 1);
    },
    has: (id) => layers.includes(id),
    isTop: (id) => layers.length > 0 && layers[layers.length - 1] === id,
    top: () => (layers.length ? layers[layers.length - 1] : null),
    size: () => layers.length,
    // What each open layer should look like right now: its z-index (each one above the one beneath it) and whether it must be inert
    // (not top, so it cannot be tabbed into or clicked while a modal sits above it).
    state: () => layers.map((id, depth) => ({ id, depth, zIndex: LAYER_BASE + depth * 2, inert: depth !== layers.length - 1 })),
  };
}

// One stack for the whole page.
export const modalStack = createModalStack();

// Page scroll is locked while any modal is open and restored only when the last one closes.
export function createScrollLock() {
  let count = 0;
  let saved = '';
  return {
    lock(body) { if (count === 0) { saved = body.style.overflow; body.style.overflow = 'hidden'; } count += 1; },
    unlock(body) { if (count === 0) return; count -= 1; if (count === 0) body.style.overflow = saved; },
    count: () => count,
  };
}
export const scrollLock = createScrollLock();

// Where focus goes next when Tab is pressed inside a dialog: it wraps from the last control to the first and the other way round.
// `items` are the focusable elements in order, `active` the one that has focus (or the dialog itself), `shift` whether Shift is held.
// Returns the element to focus, or null when the browser should do its normal thing.
export function nextFocus(items, active, dialog, shift) {
  if (!items.length) return dialog; // nothing to tab to: keep focus on the dialog
  const first = items[0];
  const last = items[items.length - 1];
  if (shift && (active === first || active === dialog || !items.includes(active))) return last;
  if (!shift && (active === last || !items.includes(active))) return first;
  return null;
}
