// HTTP-level tests for the public COR scan (POST /api/students/scan) and for clearing away COR photos nobody needs any more (docs/security/SECURITY-AUDIT-REPORT.md
// SEC-10, SEC-22). The upload must really be an image of a sensible size, only a few scans are read at once, a refused upload gets a JSON answer that says why, and a
// photo whose registration was never finished is removed. The OCR is replaced by a fake (setReader), so no Tesseract worker runs. Run: npm test (project root).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const sharp = require('sharp');

const DIR = 'private-cor-test-' + process.pid;
process.env.PRIVATE_DIR = DIR;
const ROOT = path.join(__dirname, '..', DIR);
test.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

const students = require('./students');
const { sweepCorPhotos } = require('../lib/corCleanup');

const COR_TEXT = 'Student No: 24-4233-624\nName: INSULAR, RAYMOND LESTER\nBachelor of Science in Information Technology\nFirst Semester 2026-2027';
const png = (width, height) => sharp({ create: { width, height, channels: 3, background: '#ffffff' } }).png().toBuffer();

async function withServer(fn, { reader } = {}) {
  students.scanLimiter.reset();
  students.setReader(reader || (async () => COR_TEXT));
  const app = express();
  app.use(session({ secret: 't', resave: false, saveUninitialized: false }));
  app.locals.db = { query: async () => [[]] };
  app.use('/api/students', students);
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const scan = async (buffer, { type = 'image/png', name = 'cor.png' } = {}) => {
    const form = new FormData();
    form.append('cor', new Blob([buffer], { type }), name);
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/students/scan`, { method: 'POST', body: form });
    return { status: res.status, headers: res.headers, body: await res.json().catch(() => null) };
  };
  try { await fn(scan); } finally { students.setReader(null); await new Promise((r) => server.close(r)); }
}

test('a real image is read, and the photo is kept for the registration that follows', () => withServer(async (scan) => {
  const res = await scan(await png(800, 1000));
  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.studentId, '24-4233-624');
  assert.strictEqual(fs.readdirSync(path.join(ROOT, 'cor')).length >= 1, true);
}));

test('a file that only claims to be an image is refused with 400 and a reason, before any OCR', () => withServer(async (scan) => {
  let read = 0;
  students.setReader(async () => { read += 1; return COR_TEXT; });
  for (const [buffer, type] of [[Buffer.from('<html><script>alert(1)</script></html>'), 'image/png'], [Buffer.from('%PDF-1.4 x %%EOF'), 'image/jpeg'], [Buffer.from('MZ\x90\x00 an exe'), 'image/webp']]) {
    const res = await scan(buffer, { type });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /JPG, PNG or WebP/);
  }
  assert.strictEqual(read, 0);
}));

test('a declared type that is not an image gets the same JSON reason, not a generic error', () => withServer(async (scan) => {
  const res = await scan(Buffer.from('hello'), { type: 'text/plain', name: 'cor.txt' });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /JPG, PNG or WebP/);
}));

test('an image with too many pixels is refused with 413 before any OCR', () => withServer(async (scan) => {
  let read = 0;
  students.setReader(async () => { read += 1; return COR_TEXT; });
  const res = await scan(await png(9000, 9000)); // 81 million pixels: far more than any phone photo of a page
  assert.strictEqual(res.status, 413);
  assert.match(res.body.error, /too large/i);
  assert.strictEqual(read, 0);
}));

test('only a few scans are read at once: one more is answered 503 with Retry-After, and the next one after a scan ends is read', () => {
  let release; const waiting = new Promise((r) => { release = r; });
  let started = 0;
  return withServer(async (scan) => {
    const image = await png(400, 500);
    const running = Array.from({ length: students.SCAN_CONCURRENCY }, () => scan(image));
    while (started < students.SCAN_CONCURRENCY) await new Promise((r) => setTimeout(r, 10));
    const busy = await scan(image);
    assert.strictEqual(busy.status, 503);
    assert.ok(Number(busy.headers.get('retry-after')) > 0);
    release();
    for (const r of await Promise.all(running)) assert.strictEqual(r.status, 200);
    assert.strictEqual((await scan(image)).status, 200);
  }, { reader: async () => { started += 1; await waiting; return COR_TEXT; } });
});

test('scans are limited per address, with the shared limiter that cleans up after itself', () => withServer(async (scan) => {
  const image = await png(200, 200);
  for (let i = 0; i < students.SCANS_PER_HOUR; i++) assert.notStrictEqual((await scan(image)).status, 429, 'scan ' + i);
  const limited = await scan(image);
  assert.strictEqual(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
}));

test('the sweep removes COR photos no registration refers to once they are older than a scan lasts, and nothing else', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cor-sweep-'));
  try {
    const now = Date.now(), old = (now - 2 * 60 * 60 * 1000) / 1000;
    for (const name of ['abandoned.jpg', 'pending.jpg', 'fresh.jpg', 'notes.txt']) fs.writeFileSync(path.join(dir, name), 'x');
    for (const name of ['abandoned.jpg', 'pending.jpg', 'notes.txt']) fs.utimesSync(path.join(dir, name), old, old);
    const db = { query: async (sql) => { assert.match(sql, /cor_image_path/); return [[{ cor_image_path: 'cor/pending.jpg' }]]; } };
    const result = await sweepCorPhotos(db, { dir, now, maxAgeMs: 30 * 60 * 1000 });
    assert.deepStrictEqual(result, { removed: 1, kept: 2 });
    assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['fresh.jpg', 'notes.txt', 'pending.jpg']);
    assert.deepStrictEqual(await sweepCorPhotos(db, { dir: path.join(dir, 'missing'), now }), { removed: 0, kept: 0 });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the sweep removes nothing when the database cannot say which photos are in use', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cor-sweep-'));
  try {
    fs.writeFileSync(path.join(dir, 'a.jpg'), 'x');
    const old = (Date.now() - 2 * 60 * 60 * 1000) / 1000; fs.utimesSync(path.join(dir, 'a.jpg'), old, old);
    await assert.rejects(sweepCorPhotos({ query: async () => { throw new Error('db down'); } }, { dir }));
    assert.deepStrictEqual(fs.readdirSync(dir), ['a.jpg']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('server/index.js starts the COR photo sweep', () => {
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8'), /require\(['"]\.\/lib\/corCleanup['"]\)\.startCorCleanup\(pool\)/);
});
