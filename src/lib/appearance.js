// Appearance preference: system | light | dark | amoled. Kept in this browser (localStorage) and applied as data-theme on <html>;
// "system" follows the operating system and updates live when it changes.
export const APPEARANCES = ['system', 'light', 'dark', 'amoled'];
const KEY = 'syllabus-appearance';

export function normalizeAppearance(value) {
  return APPEARANCES.includes(value) ? value : 'system';
}
export function resolveAppearance(preference, systemDark) {
  const p = normalizeAppearance(preference);
  return p === 'system' ? (systemDark ? 'dark' : 'light') : p;
}
export function getAppearance() {
  try { return normalizeAppearance(localStorage.getItem(KEY)); } catch { return 'system'; }
}
const systemQuery = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);

export function applyAppearance(preference = getAppearance()) {
  if (typeof document === 'undefined') return 'light';
  const q = systemQuery();
  const theme = resolveAppearance(preference, !!(q && q.matches));
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  return theme;
}
export function setAppearance(preference) {
  const value = normalizeAppearance(preference);
  try { localStorage.setItem(KEY, value); } catch { /* private mode: the choice lasts until reload */ }
  applyAppearance(value);
  return value;
}
// Call once at start-up: applies the saved choice and keeps "system" in step with the OS.
export function initAppearance() {
  applyAppearance();
  const q = systemQuery();
  if (q && q.addEventListener) q.addEventListener('change', () => { if (getAppearance() === 'system') applyAppearance('system'); });
}
