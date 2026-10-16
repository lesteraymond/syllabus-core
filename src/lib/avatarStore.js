// One place that knows which profile picture each user has right now, so a photo that changes shows everywhere at once.
//
// The server builds every avatar URL as /api/users/<id>/avatar?v=<upload time>, so a URL says whose picture it is and how new it is.
// Copies of those URLs sit in many lists (syllabus rows, message partners, the signed-in user). A list fetched a moment ago can hold an
// older URL than one the user just uploaded, so every source is compared by when it was known, and the newest wins:
//   record(...)  something that just happened in this browser (an upload, a removal): known now
//   seed(...)    a server payload: known as of when its request started (a payload that began before a local change never undoes it)
// Plain JS with a subscribe/getSnapshot pair for useSyncExternalStore; no React here.

const entries = new Map(); // userId -> { url: string|null, at: number }
const listeners = new Set();

export const versionOf = (url) => { const m = /[?&]v=(\d+)/.exec(url || ''); return m ? Number(m[1]) : 0; };
export const userIdOf = (url) => { const m = /\/api\/users\/(\d+)\/avatar/.exec(url || ''); return m ? Number(m[1]) : null; };
const keyOf = (userId, url) => { const id = userId ?? userIdOf(url); return id === null || id === undefined || id === '' ? null : Number(id); };

function put(userId, url, at) {
  const key = Number(userId);
  const current = entries.get(key);
  if (current && current.at > at) return false;                 // something newer is already known
  if (current && current.url === (url || null) && current.at >= at) return false;
  entries.set(key, { url: url || null, at });
  return true;
}
const emit = () => listeners.forEach((listener) => listener());

// A change made here and now. A new photo is known at least as late as its own upload time.
export function recordAvatar(userId, url, now = Date.now()) {
  if (userId === null || userId === undefined) return;
  if (put(userId, url, url ? Math.max(now, versionOf(url)) : now)) emit();
}

// pairs: [[userId, url], ...] from one server response; fetchedAt: when that request started.
export function seedAvatars(pairs, fetchedAt = Date.now()) {
  let changed = false;
  for (const [userId, url] of pairs) {
    const key = keyOf(userId, url);
    if (key === null) continue;
    if (put(key, url, Math.max(fetchedAt, versionOf(url)))) changed = true;
  }
  if (changed) emit();
}

// The picture to show: what the store knows, unless the copy the caller holds is a newer upload.
export function resolveAvatar(userId, url) {
  const key = keyOf(userId, url);
  const entry = key === null ? undefined : entries.get(key);
  if (!entry) return url || null;
  const held = versionOf(url);
  if (url && held > (entry.url ? versionOf(entry.url) : entry.at)) return url;
  return entry.url;
}

export const subscribeAvatars = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export const resetAvatars = () => { entries.clear(); emit(); };
