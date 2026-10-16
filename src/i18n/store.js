const listeners = new Set();
let language = 'en';
export const normalizeLanguage = value => value === 'tl' ? 'tl' : 'en';
export const getLanguage = () => language;
export const getLocale = () => language === 'tl' ? 'fil-PH' : 'en-US';
export function setLanguage(value) {
  const next = normalizeLanguage(value);
  if (next === language) return;
  language = next;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  listeners.forEach(listener => listener());
}
export function subscribeLanguage(listener) { listeners.add(listener); return () => listeners.delete(listener); }
