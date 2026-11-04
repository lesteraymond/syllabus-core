'use strict';
const test = require('node:test');
const assert = require('node:assert');
const sharp = require('sharp');
const { extractCor, normalize, parseJson } = require('./corAi');

test('normalize keeps only fields that check out', () => {
  const p = normalize({ isCor: true, studentId: '23-3389-455', studentName: 'INSULAR, RAYMOND LESTER', program: 'BS Information Technology', yearLevel: 3, term: '1st semester', schoolYear: '2025 - 2026',
    subjects: [{ code: 'it-401', title: 'Capstone', section: 'BSIT 3A' }, { code: 'nonsense words', title: 'x' }] });
  assert.strictEqual(p.studentId, '23-3389-455');
  assert.strictEqual(p.bsit, 'yes');
  assert.strictEqual(p.term, '1st Semester');
  assert.strictEqual(p.schoolYear, '2025-2026');
  assert.deepStrictEqual(p.subjects, [{ code: 'IT-401', title: 'Capstone', section: 'BSIT3A' }]);
  assert.strictEqual(p.section, 'BSIT3A');
  assert.strictEqual(normalize({ isCor: true, subjects: [{ code: 'IT-401', title: 'x', section: 'BSIT4B/TBA' }] }).subjects[0].section, 'BSIT4B');
});

test('an unreadable or invented ID is null, and another program is not BSIT', () => {
  const p = normalize({ isCor: true, studentId: 'abc', studentName: 'no comma', program: 'BS Accountancy', subjects: [] });
  assert.strictEqual(p.studentId, null);
  assert.strictEqual(p.studentName, null);
  assert.strictEqual(p.bsit, 'maybe');
});

test('parseJson accepts a fenced reply and rejects prose', () => {
  assert.deepStrictEqual(parseJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => parseJson('sorry'));
});

test('extractCor is null without a key, and sends the photo to Gemini with the key in a header', async () => {
  const img = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } }).png().toBuffer();
  assert.strictEqual(await extractCor(img, { env: {} }), null);
  let seen;
  const fetchImpl = async (url, opts) => { seen = { url, opts }; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"isCor":true,"studentId":"23-3389-455","program":"BS Information Technology"}' }] } }] }) }; };
  const p = await extractCor(img, { env: { GEMINI_API_KEY: 'k' }, fetchImpl });
  assert.strictEqual(p.studentId, '23-3389-455');
  assert.ok(!seen.url.includes('k=') && seen.opts.headers['x-goog-api-key'] === 'k');
  assert.ok(JSON.parse(seen.opts.body).contents[0].parts[1].inline_data.data.length > 10);
});

test('a reply that does not say it is a COR gives nothing, however many fields it fills in', () => {
  const p = normalize({ isCor: false, studentId: '23-3389-455', studentName: 'DELA CRUZ, JUAN' });
  assert.strictEqual(p.studentId, null);
  assert.strictEqual(p.studentName, null);
});
