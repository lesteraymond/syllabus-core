import { phCompact } from './phTime.js';

export function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

// "14 Oct 2026 · 3:44 PM" in Philippine time (see phTime.js), whatever the viewer's computer is set to.
export const fmt = (d) => phCompact(d);

export function bumpVer(v) {
  const p = v.split('.');
  return `v${p[0]}.${parseInt(p[1] || 0) + 1}`;
}
