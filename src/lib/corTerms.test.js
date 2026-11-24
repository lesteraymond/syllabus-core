// The student registration Terms and Conditions (src/lib/corTerms.js): both languages say the same things, and the version is the one the server checks.
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { TERMS_SECTIONS, TERMS_VERSION, termsIn } from './corTerms.js';

const require = createRequire(import.meta.url);

test('the version is the one the server checks (shared/corTerms.cjs), and is a date', () => {
  assert.strictEqual(TERMS_VERSION, require('../../shared/corTerms.cjs').TERMS_VERSION);
  assert.match(TERMS_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});

test('English and Tagalog have the same sections and paragraphs, none empty, nothing left to fill in', () => {
  for (const s of TERMS_SECTIONS) {
    assert.strictEqual(s.title.length, 2);
    for (const b of s.body) { assert.strictEqual(b.length, 2); assert.ok(b[0].trim() && b[1].trim()); }
  }
  const en = termsIn('en');
  const tl = termsIn('tl');
  assert.strictEqual(en.sections.length, tl.sections.length);
  en.sections.forEach((s, i) => assert.strictEqual(s.body.length, tl.sections[i].body.length, s.title));
  for (const t of [en, tl]) assert.ok(!JSON.stringify(t).includes('{dpo}'), 'the contact is filled in');
  assert.notStrictEqual(en.title, tl.title);
  assert.strictEqual(termsIn('xx').title, en.title, 'any other language reads English');
});

test('the terms cite the Philippine laws they rest on and say where the COR photo goes', () => {
  const text = JSON.stringify(termsIn('en'));
  for (const law of ['RA 10173', 'RA 8792', 'RA 10175', 'National Privacy Commission']) assert.ok(text.includes(law), law);
  assert.match(text, /Anthropic/);
  assert.match(text, /within about one hour/);
  for (const program of ['BSIT', 'BSCPE', 'BSIE']) assert.ok(text.includes(program), program + ': the programs that may register (server/lib/corPrograms.js)');
});
