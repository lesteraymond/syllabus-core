// The six LCUP core values the "Expected Value/s to be Integrated" column draws from (txt-files/lcup_core_values.txt). The AI Checker's
// rule C-05 reads the same list from server/lib/compliance/standard-v4.json; coreValues.test.js checks the two agree.
export const CORE_VALUES = [
  { key: 'compassion', name: 'Compassion', pattern: 'compassion' },
  { key: 'courage', name: 'Courage', pattern: 'courage' },
  { key: 'community', name: 'Community-orientedness', pattern: 'community[- ]?orient' },
  { key: 'humility', name: 'Humility', pattern: 'humility' },
  { key: 'interiority', name: 'Interiority', pattern: 'interiority' },
  { key: 'missionary', name: 'Missionary Spirit', pattern: 'missionar' },
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matcher = (v) => new RegExp(v.pattern, 'i');

export const hasCoreValue = (text, v) => matcher(v).test(String(text || ''));
export const namesCoreValue = (text) => CORE_VALUES.some((v) => hasCoreValue(text, v));

// Adds the value to the cell's text ("Honesty, Courage"), or takes it out again when it is already named (whichever way it was spelled).
export function toggleCoreValue(text, v) {
  const t = String(text || '');
  if (!hasCoreValue(t, v)) return (t.trim() ? t.replace(/[\s,;]+$/, '') + ', ' : '') + v.name;
  const word = new RegExp('(\\*\\*)?\\b' + escape(v.name) + '\\b(\\*\\*)?|(\\*\\*)?\\b[\\w-]*(?:' + v.pattern + ')[\\w-]*\\b(\\*\\*)?', 'ig');
  return t.replace(word, '').replace(/\s*[,;]\s*(?=[,;]|$)/g, '').replace(/^[\s,;]+|[\s,;]+$/g, '').replace(/[ \t]{2,}/g, ' ').replace(/\n{2,}/g, '\n');
}
