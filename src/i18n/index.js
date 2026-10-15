import { getLanguage, getLocale } from './store.js';
import { en as baseEn, tl as baseTl } from './messages.js';
import { extraEn, extraTl } from './extra.js';
const en = { ...baseEn, ...extraEn };
const tl = { ...baseTl, ...extraTl };
export { getLanguage, getLocale, setLanguage, subscribeLanguage, normalizeLanguage } from './store.js';
export const dictionaries = { en, tl };
export function translate(key, values = {}, language = getLanguage()) {
  const template = dictionaries[language]?.[key] ?? en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
}
export const t = translate;
export const formatNumber = (value, options) => new Intl.NumberFormat(getLocale(), options).format(value);

// This adapter is only for trusted UI labels and server-authored messages, never user content.
const messageKeys = new Map();
for (const dictionary of [en, tl]) for (const [key, text] of Object.entries(dictionary)) messageKeys.set(text.trim(), key);
const escapeRegex = text => text.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&');
const patterns = [];
for (const dictionary of [en, tl]) for (const [key, text] of Object.entries(dictionary)) {
  if (!/\{\w+\}/.test(text)) continue;
  const names = [];
  let cursor = 0;
  let expression = '^';
  for (const match of text.matchAll(/\{(\w+)\}/g)) {
    const numeric = ['count', 'number', 'total', 'score', 'words', 'rows', 'row', 'week', 'ilo'].includes(match[1]);
    expression += escapeRegex(text.slice(cursor, match.index)) + (numeric ? '([\\d.,–\\s-]+)' : '(.*?)');
    names.push(match[1]); cursor = match.index + match[0].length;
  }
  expression += escapeRegex(text.slice(cursor)) + '$';
  const specificity = text.replace(/\{\w+\}/g, '').length;
  if (specificity >= 12 || names.every(name => ['count', 'number', 'total', 'score', 'words', 'rows', 'row', 'week', 'ilo'].includes(name)) || /^(Showing|Since|Until|Step) /.test(en[key])) patterns.push({ key, names, regex: new RegExp(expression, 's'), specificity });
}
patterns.sort((a, b) => b.specificity - a.specificity);
export function tr(message) {
  if (typeof message !== 'string' || !message) return message;
  const exact = messageKeys.get(message.trim());
  if (exact) return translate(exact).trim();
  const used = /^(.*)\. Remove those tags first\.$/s.exec(message);
  if (used) return used[1].split('; ').map(tr).join('; ') + '. ' + tr('Remove those tags first.');
  const grouped = /^(.*) (\d+) more like this\.$/s.exec(message);
  if (grouped) return tr(grouped[1]) + ' ' + tr(grouped[2] + ' more like this.');
  for (const { key, names, regex } of patterns) {
    const match = regex.exec(message);
    if (match) return translate(key, Object.fromEntries(names.map((name, i) => [name, name === 'gaps' ? match[i + 1].split(', ').map(tr).join(', ') : ['where', 'which', 'missing', 'term', 'problem', 'hours', 'message', 'title', 'status'].includes(name) ? tr(match[i + 1]) : match[i + 1]])));
  }
  return message;
}

// Used only to reserve space for trusted interface labels, without changing store state.
export function labelVariants(message) {
  if (typeof message !== 'string') return [];
  const key = messageKeys.get(message.trim());
  if (!key) return [message];
  return [...new Set(['en', 'tl'].map(language => translate(key, {}, language).trim()))];
}
