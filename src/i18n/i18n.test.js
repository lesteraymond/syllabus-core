import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dictionaries, tr, t, translate, setLanguage, getLanguage, getLocale, formatNumber, subscribeLanguage } from './index.js';
import { createLanguagePreference } from './preference.js';
import { phDate } from '../lib/phTime.js';

test.afterEach(() => setLanguage('en'));
test('all interface keys have nonempty Tagalog translations and valid interpolation names', () => {
  assert.deepEqual(Object.keys(dictionaries.en).sort(), Object.keys(dictionaries.tl).sort());
  assert.ok(Object.keys(dictionaries.en).length > 1200);
  for (const [key, source] of Object.entries(dictionaries.en)) {
    const target = dictionaries.tl[key];
    assert.ok(target.trim(), key);
    const names = [...source.matchAll(/\{(\w+)\}/g)].map(match => match[1]);
    for (const match of target.matchAll(/\{(\w+)\}/g)) assert.ok(names.includes(match[1]), key + ': unexpected ' + match[1]);
  }
});

test('translations interpolate values, preserve unknown text, and fall back to English', () => {
  setLanguage('tl');
  assert.equal(tr('Settings'), 'Mga Setting');
  assert.equal(tr('Profile changes saved.'), 'Na-save ang mga pagbabago sa profile.');
  assert.equal(tr('Components total 50%, not 100%.'), '50% ang kabuuan ng mga bahagi; dapat ay 100%.');
  const text = 'Requirement "Approved" starts with its own number; the form numbers the list for you.';
  assert.ok(tr(text).includes('"Approved"')); // quoted syllabus data is unchanged
  assert.equal(tr('A custom course title'), 'A custom course title');
  const key = Object.keys(dictionaries.en).find(key => dictionaries.en[key] === 'Settings');
  assert.equal(translate(key, {}, 'unsupported'), 'Settings');
  assert.equal(t('unknown.key'), 'unknown.key');
  assert.equal(translate(key, {}, 'en'), 'Settings');
  const saved = dictionaries.tl[key]; delete dictionaries.tl[key];
  try { assert.equal(t(key), 'Settings'); } finally { dictionaries.tl[key] = saved; }
});

test('language subscription is immediate, unsubscribes correctly, and formats Philippine dates', () => {
  const seen = [];
  const unsubscribe = subscribeLanguage(() => seen.push(getLanguage()));
  setLanguage('tl');
  assert.equal(getLocale(), 'fil-PH');
  assert.equal(formatNumber(1234), new Intl.NumberFormat('fil-PH').format(1234));
  assert.equal(phDate('2026-04-01T00:00:00Z'), new Intl.DateTimeFormat('fil-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date('2026-04-01T00:00:00Z')));
  unsubscribe(); setLanguage('en');
  assert.deepEqual(seen, ['tl']);
});

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
test('language changes immediately, saves once, and rolls back visibly when persistence fails', async () => {
  const request = deferred();
  const applied = [], saved = [];
  let writes = 0;
  const preference = createLanguagePreference({ apply: value => applied.push(value), persist: () => { writes++; return request.promise; }, onSaved: (...args) => saved.push(args) });
  preference.reset(5, 'en');
  const pending = preference.change('tl');
  assert.deepEqual(applied, ['en', 'tl']);
  await preference.change('tl');
  assert.equal(writes, 1);
  request.reject(new Error('Cannot save'));
  await assert.rejects(pending, /Cannot save/);
  assert.deepEqual(applied, ['en', 'tl', 'en']);
  assert.deepEqual(saved, []);
});

test('late preference responses cannot change the language of a different signed-in account', async () => {
  const request = deferred();
  const applied = [], saved = [];
  const preference = createLanguagePreference({ apply: value => applied.push(value), persist: () => request.promise, onSaved: (...args) => saved.push(args) });
  preference.reset(5, 'en');
  const pending = preference.change('tl');
  preference.reset(6, 'en');
  request.resolve({ preferredLanguage: 'tl' });
  await pending;
  assert.deepEqual(applied, ['en', 'tl', 'en']);
  assert.deepEqual(saved, []);
});

test('saved preferences restore per account and invalid languages never reach the API', async () => {
  const applied = [], saved = [];
  const preference = createLanguagePreference({ apply: value => applied.push(value), persist: async preferredLanguage => ({ preferredLanguage }), onSaved: (...args) => saved.push(args) });
  preference.reset(1, 'tl');
  await preference.change('en');
  assert.deepEqual(saved, [[1, 'en']]);
  await assert.rejects(preference.change('de'), /English or Tagalog/);
  preference.reset(2);
  assert.equal(applied.at(-1), 'en');
});

test('rule messages and recommendation headings are covered without changing the scoring rules', async () => {
  const standard = JSON.parse(await readFile(new URL('../../server/lib/compliance/standard-v4.json', import.meta.url), 'utf8'));
  setLanguage('tl');
  for (const rule of standard.rules) {
    assert.notEqual(tr(rule.message), rule.message, rule.id + ': message');
    assert.notEqual(tr(rule.fix), rule.fix, rule.id + ': fix');
  }
  for (const area of standard.areas) assert.notEqual(tr(area.name), area.name);
  assert.equal(tr('Step 1: Course Information'), 'Hakbang 1: Impormasyon ng Kurso');
  assert.equal(tr('EGA 1 is used by Approved. Remove those tags first.'), 'Ginagamit ng Approved ang EGA 1. Alisin muna ang mga ugnayang iyon.');
});


test('native validation is localized and clears stale errors when the user edits', async () => {
  const { validationMessage, installLocalizedValidation } = await import('./validation.js');
  setLanguage('tl');
  assert.equal(validationMessage({ validity: { valueMissing: true } }), 'Punan ang field na ito.');
  assert.equal(validationMessage({ type: 'email', validity: { typeMismatch: true } }), 'Ilagay ang wastong email address.');
  assert.equal(validationMessage({ minLength: 8, validity: { tooShort: true } }), 'Gumamit ng hindi bababa sa 8 character.');
  const handlers = new Map();
  const target = { addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) };
  const cleanup = installLocalizedValidation(target);
  let error;
  const field = { validity: { valueMissing: true }, setCustomValidity: value => { error = value; } };
  handlers.get('invalid')({ target: field });
  assert.equal(error, 'Punan ang field na ito.');
  handlers.get('input')({ target: field });
  assert.equal(error, '');
  cleanup(); assert.equal(handlers.size, 0);
});

test('structured change summaries localize counts and labels without translating saved content', async () => {
  const { localizeChanges } = await import('./changes.js');
  setLanguage('tl');
  assert.equal(localizeChanges({ sections: [{ label: 'Course description', words: 3 }, { label: 'Learning plan', words: 10, rows: 2 }] }), 'Paglalarawan ng kurso (3 salita), Plano ng pagkatuto (2 linggo)');
  assert.equal(localizeChanges({ text: 'Unrecognized historical summary' }), 'Unrecognized historical summary');
  assert.equal(tr('2 subjects'), '2 asignatura');
  assert.equal(tr('3 checks'), '3 pagsusuri');
  assert.equal(tr('Course code (I) is empty. 2 more like this.'), 'Walang code ng kurso (I). May 2 pang katulad nito.');
});
