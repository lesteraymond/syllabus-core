// A small in-memory fixed-window limiter, keyed by anything (a user id and an action). It resets when the server restarts and is
// per process, which is enough to stop a button or a script from hammering an expensive route.
function createLimiter({ max, windowMs, now = Date.now }) {
  const hits = new Map();
  return {
    // { ok: true } or { ok: false, retryAfterSec }
    take(key) {
      const t = now();
      const h = hits.get(key);
      if (!h || t - h.start >= windowMs) {
        hits.set(key, { start: t, count: 1 });
        if (hits.size > 5000) for (const [k, v] of hits) if (t - v.start >= windowMs) hits.delete(k);
        return { ok: true };
      }
      if (h.count >= max) return { ok: false, retryAfterSec: Math.max(1, Math.ceil((h.start + windowMs - t) / 1000)) };
      h.count += 1;
      return { ok: true };
    },
    // Hands back one slot taken in the current window: for a limiter that counts only failures, where a slot is taken before the outcome is
    // known (so two requests at once cannot both slip past the limit) and returned when the attempt turns out to be a success.
    give(key) {
      const h = hits.get(key);
      if (h && now() - h.start < windowMs && h.count > 0) h.count -= 1;
    },
    reset() { hits.clear(); },
  };
}

module.exports = { createLimiter };
