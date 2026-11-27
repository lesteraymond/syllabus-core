// HTTP-level tests for the public COR scan (POST /api/students/scan) and for clearing away COR photos nobody needs any more (docs/security/SECURITY-AUDIT-REPORT.md
// SEC-10, SEC-22). The upload must really be an image of a sensible size, only a few scans are read at once, a refused upload gets a JSON answer that says why, and a
// photo whose registration was never finished is removed. The Claude reader is replaced by a fake (setReader), so no paid call is made. Run: npm test (project root).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const sharp = require('sharp');
const { parseCor } = require('../lib/corParser');
const { TERMS_VERSION } = require('../../shared/corTerms.cjs'); // the registration Terms and Conditions the form agrees to

const DIR = 'private-cor-test-' + process.pid;
process.env.PRIVATE_DIR = DIR;
const ROOT = path.join(__dirname, '..', DIR);
test.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

const students = require('./students');
const { sweepCorPhotos } = require('../lib/corCleanup');

const COR_TEXT = 'Student No: 24-4233-624\nName: INSULAR, RAYMOND LESTER\nBachelor of Science in Information Technology\nFirst Semester 2026-2027';
const png = (width, height) => sharp({ create: { width, height, channels: 3, background: '#ffffff' } }).png().toBuffer();

async function withServer(fn, { reader, db } = {}) {
  students.scanLimiter.reset(); students.sessionScanLimiter.reset();
  students.setReader(reader || (async () => parseCor(COR_TEXT)));
  const app = express();
  app.use(session({ secret: 't', resave: false, saveUninitialized: false }));
  app.locals.db = db || { query: async () => [[]] };
  app.use('/api/students', students);
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const scan = async (buffer, { type = 'image/png', name = 'cor.png', consent = true, terms = TERMS_VERSION } = {}) => {
    const form = new FormData();
    if (consent) form.append('consent', 'yes');
    if (terms !== null) form.append('terms', terms);
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

test('a file that only claims to be an image is refused with 400 and a reason, before any read', () => withServer(async (scan) => {
  let read = 0;
  students.setReader(async () => { read += 1; return parseCor(COR_TEXT); });
  for (const [buffer, type] of [[Buffer.from('<html><script>alert(1)</script></html>'), 'image/png'], [Buffer.from('%PDF-1.4 x %%EOF'), 'image/jpeg'], [Buffer.from('MZ\x90\x00 an exe'), 'image/webp']]) {
    const res = await scan(buffer, { type });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /JPG, PNG or WebP/);
  }
  assert.strictEqual(read, 0);
}));

test('a scan without the privacy consent is refused with 400 before any read', () => withServer(async (scan) => {
  let read = 0;
  students.setReader(async () => { read += 1; return parseCor(COR_TEXT); });
  const res = await scan(await png(400, 500), { consent: false });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /Terms and Conditions/);
  assert.strictEqual(res.body.code, 'terms_required');
  assert.strictEqual(read, 0);
}));

test('a declared type that is not an image gets the same JSON reason, not a generic error', () => withServer(async (scan) => {
  const res = await scan(Buffer.from('hello'), { type: 'text/plain', name: 'cor.txt' });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /JPG, PNG or WebP/);
}));

test('an image with too many pixels is refused with 413 before any read', () => withServer(async (scan) => {
  let read = 0;
  students.setReader(async () => { read += 1; return parseCor(COR_TEXT); });
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
  }, { reader: async () => { started += 1; await waiting; return parseCor(COR_TEXT); } });
});

test('scans are limited per address, with a limiter that cleans up after itself', () => withServer(async (scan) => {
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

// ---- registration: the scan decides, with no administrator review (owner decision 2026-11-23) ----
// A scan that cannot confirm the program, the name, or the school year and term creates no account and keeps no photo; a clear one makes a verified account.
async function withRegistration(corText, fn, { years } = {}) {
  students.scanLimiter.reset(); students.sessionScanLimiter.reset(); students.registerLimiter.reset();
  students.setReader(async () => parseCor(corText));
  const writes = [];
  const conn = {
    query: async (sql) => { writes.push(sql); if (sql.startsWith('SELECT user_id FROM users')) return [[]]; if (sql.startsWith('INSERT INTO users')) return [{ insertId: 90 }]; return [{}]; },
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
  };
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 't', resave: false, saveUninitialized: false }));
  let yearReads = 0; // years: the active year at each read (the scan reads it first, the registration next)
  app.locals.db = { query: async (sql, params) => sql.startsWith('INSERT INTO account_activity') ? (writes.push(sql + ' ' + JSON.stringify(params)), [{}]) : (years && sql.startsWith('SELECT label FROM academic_years') ? [[{ label: years[Math.min(yearReads++, years.length - 1)] }]] : [[]]), getConnection: async () => conn };
  app.use('/api/students', students);
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const base = `http://127.0.0.1:${server.address().port}/api/students`;
  try {
    const form = new FormData();
    form.append('consent', 'yes');
    form.append('terms', TERMS_VERSION);
    form.append('cor', new Blob([await png(800, 1000)], { type: 'image/png' }), 'cor.png');
    const before = new Set(fs.existsSync(path.join(ROOT, 'cor')) ? fs.readdirSync(path.join(ROOT, 'cor')) : []);
    const scanned = await fetch(base + '/scan', { method: 'POST', body: form });
    const scanBody = await scanned.json();
    const photo = fs.readdirSync(path.join(ROOT, 'cor')).find((n) => !before.has(n));
    const cookie = (scanned.headers.get('set-cookie') || '').split(';')[0];
    const reg = await fetch(base + '/register', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ password: 'abcd1234' }) });
    await fn({ scanBody, register: { status: reg.status, body: await reg.json().catch(() => null) }, writes, photoKept: !!photo && fs.existsSync(path.join(ROOT, 'cor', photo)) });
  } finally { students.setReader(null); await new Promise((r) => server.close(r)); }
}

test('an unclear COR scan is flagged with the scan, and registering it is refused with 422: no account, no photo kept', () => withRegistration(
  'Student No: 24-4233-624\nName: INSULAR, RAYMOND LESTER\nBachelor of Science in Information Technology', // no school year or term
  async ({ scanBody, register, writes, photoKept }) => {
    assert.deepStrictEqual(scanBody.unclear, ['term'], 'the registration screen is told before it offers to register');
    assert.strictEqual(register.status, 422);
    assert.strictEqual(register.body.code, 'cor_unclear');
    assert.deepStrictEqual(register.body.unclear, ['term']);
    assert.ok(!writes.some((sql) => sql.startsWith('INSERT')), 'no account, profile or enrollment was written');
    assert.strictEqual(photoKept, false, 'the COR photo was deleted');
  }));

test('a clear COR scan registers a verified account straight away and keeps no photo', () => withRegistration('Student No: 24-4233-624\nName: INSULAR, RAYMOND LESTER\nBachelor of Science in Information Technology\n1st Semester AY 2026-2027', async ({ scanBody, register, writes, photoKept }) => {
  assert.deepStrictEqual(scanBody.unclear, []);
  assert.strictEqual(register.status, 200, JSON.stringify(register.body));
  assert.strictEqual(register.body.status, 'verified');
  assert.ok(writes.some((sql) => sql.startsWith('INSERT INTO student_profiles')));
  assert.strictEqual(photoKept, false);
  // the consent is on the new account's record: the version of the Terms and Conditions agreed to (RA 10173)
  const consent = writes.find((sql) => sql.startsWith('INSERT INTO account_activity'));
  assert.ok(consent, 'the agreement to the terms was recorded');
  assert.ok(consent.includes('"terms_accept"') && consent.includes(TERMS_VERSION + ' at '), consent);
  assert.ok(consent.includes('[90,'), 'on the new account');
}));

test('a scan that agrees to another version of the terms, or to none, is refused with 409 before any read: the page must show the current terms', () => withServer(async (scan) => {
  let read = 0;
  students.setReader(async () => { read += 1; return parseCor(COR_TEXT); });
  for (const terms of ['2020-01-01', '', null]) {
    const res = await scan(await png(400, 500), { terms });
    assert.strictEqual(res.status, 409, String(terms));
    assert.strictEqual(res.body.code, 'terms_outdated');
    assert.strictEqual(res.body.termsVersion, TERMS_VERSION);
  }
  assert.strictEqual(read, 0);
}));

// BSCPE and BSIE students register too (2026-11-24; lib/corPrograms.js); a COR of another program makes no account.
test('a clear BSCPE or BSIE COR registers a verified account under its own program', async () => {
  for (const [course, code, name] of [['Bachelor of Science in Computer Engineering', 'BSCPE', 'BACHELOR OF SCIENCE IN COMPUTER ENGINEERING'], ['Bachelor of Science in Industrial Engineering', 'BSIE', 'BACHELOR OF SCIENCE IN INDUSTRIAL ENGINEERING']]) {
    await withRegistration(['Student No: 24-4233-624', 'Name: INSULAR, RAYMOND LESTER', course, '1st Semester AY 2026-2027'].join('\n'), async ({ scanBody, register, writes }) => {
      assert.deepStrictEqual([scanBody.programCode, scanBody.programOk, scanBody.program, scanBody.unclear], [code, 'yes', name, []], code);
      assert.strictEqual(register.status, 200, code + ' ' + JSON.stringify(register.body));
      assert.ok(writes.some((sql) => sql.startsWith('INSERT INTO student_profiles')), code);
    });
  }
});

test('a COR of another program is flagged and makes no account', () => withRegistration(['Student No: 24-4233-624', 'Name: INSULAR, RAYMOND LESTER', 'Bachelor of Science in Nursing', '1st Semester AY 2026-2027'].join('\n'), async ({ scanBody, register, writes }) => {
  assert.deepStrictEqual(scanBody.unclear, ['program']);
  assert.strictEqual(register.status, 422);
  assert.ok(!writes.some((sql) => sql.startsWith('INSERT')), 'nothing was written');
}));

test('the administrator review queue for registrations is gone', () => {
  const source = fs.readFileSync(path.join(__dirname, 'students.js'), 'utf8');
  assert.doesNotMatch(source, /router\.(get|post)\('\/(pending|:id\/cor|:id\/verify)'/);
});

// ---- limits and model (2026-11-23): a campus shares one address, so one browser is held to a few scans and registering has its own limit ----
test('one browser is held to a few scans an hour, and its refusal does not use up the address\'s allowance', async () => {
  students.scanLimiter.reset(); students.sessionScanLimiter.reset();
  students.setReader(async () => parseCor(COR_TEXT));
  const app = express();
  app.use(session({ secret: 't', resave: false, saveUninitialized: false }));
  app.locals.db = { query: async () => [[]] };
  app.use('/api/students', students);
  const server = await new Promise((resolve) => { const sv = app.listen(0, () => resolve(sv)); });
  const url = `http://127.0.0.1:${server.address().port}/api/students/scan`;
  try {
    const image = await png(200, 200);
    let cookie = '';
    const scanAs = async (withCookie) => {
      const form = new FormData(); form.append('consent', 'yes'); form.append('terms', TERMS_VERSION); form.append('cor', new Blob([image], { type: 'image/png' }), 'cor.png');
      const res = await fetch(url, { method: 'POST', body: form, headers: withCookie && cookie ? { cookie } : {} });
      const set = res.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
      return res.status;
    };
    for (let i = 0; i < students.SCANS_PER_SESSION; i++) assert.strictEqual(await scanAs(true), 200, 'scan ' + i);
    assert.strictEqual(await scanAs(true), 429, 'the same browser is stopped');
    assert.strictEqual(await scanAs(false), 200, 'another student on the same network still scans');
  } finally { students.setReader(null); await new Promise((r) => server.close(r)); }
});

test('registering has its own limit: it never uses up the scans of the students who share the address', () => {
  const src = fs.readFileSync(path.join(__dirname, 'students.js'), 'utf8');
  assert.match(src, /router\.post\('\/register', registerRate,/);
  assert.match(src, /router\.post\('\/scan', scanRate,/);
  assert.ok(students.SCANS_PER_HOUR >= 100, 'a campus behind one address can register a class in an hour');
});

test('an ID that already has an account is refused when the scan comes back, before the student confirms', () => withServer(async (scan) => {
  const res = await scan(await png(400, 500));
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.body.code, 'already_registered');
}, { db: { query: async (sql) => (sql.startsWith('SELECT user_id FROM users WHERE LOWER(email)') ? [[{ user_id: 3 }]] : [[]]) } }));

test('the COR scan has its own model setting and does not follow the AI Checker\'s ANTHROPIC_MODEL', () => {
  const { MODEL } = require('../lib/corClaude');
  const saved = { a: process.env.ANTHROPIC_MODEL, c: process.env.COR_SCAN_MODEL };
  try {
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-5-5'; delete process.env.COR_SCAN_MODEL;
    assert.strictEqual(MODEL(), 'claude-haiku-5-5');
    process.env.COR_SCAN_MODEL = 'claude-opus-5-5';
    assert.strictEqual(MODEL(), 'claude-opus-5-5');
  } finally {
    for (const [k, v] of [['ANTHROPIC_MODEL', saved.a], ['COR_SCAN_MODEL', saved.c]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

// ---- only a COR of the active academic year registers (owner decision 2026-11-23) ----
const CURRENT_COR = 'Student No: 24-4233-624\nName: INSULAR, RAYMOND LESTER\nBachelor of Science in Information Technology\n1st Semester AY 2026-2027';
const yearsDb = (labels) => { let n = 0; return { query: async (sql) => (sql.startsWith('SELECT label FROM academic_years') ? [[{ label: labels[Math.min(n++, labels.length - 1)] }]] : [[]]) }; };

test('a COR of another school year is refused when the scan comes back, naming both years, and its photo is not stored', () => withServer(async (scan) => {
  const before = fs.existsSync(path.join(ROOT, 'cor')) ? fs.readdirSync(path.join(ROOT, 'cor')).length : 0;
  const res = await scan(await png(400, 500));
  assert.strictEqual(res.status, 422);
  assert.strictEqual(res.body.code, 'cor_wrong_year');
  assert.strictEqual(res.body.corYear, '2024-2025');
  assert.strictEqual(res.body.activeYear, '2026–2027');
  assert.match(res.body.error || res.body.message, /This COR is for the 2024-2025 school year\. Register with your COR for the current academic year, 2026–2027\./);
  const after = fs.existsSync(path.join(ROOT, 'cor')) ? fs.readdirSync(path.join(ROOT, 'cor')).length : 0;
  assert.strictEqual(after, before, 'no photo was stored');
}, { reader: async () => parseCor(CURRENT_COR.replace('2026-2027', '2024-2025')), db: yearsDb(['2026–2027']) }));

test('a COR of the active academic year scans as usual (a dash and an en dash are the same year)', () => withServer(async (scan) => {
  const res = await scan(await png(400, 500));
  assert.strictEqual(res.status, 200, JSON.stringify(res.body));
  assert.strictEqual(res.body.schoolYear, '2026-2027');
}, { reader: async () => parseCor(CURRENT_COR), db: yearsDb(['2026–2027']) }));

test('registering checks the year again: if the active year changed since the scan, nothing is created and the photo is deleted', () => withRegistration(CURRENT_COR,
  async ({ register, writes, photoKept }) => {
    assert.strictEqual(register.status, 422);
    assert.strictEqual(register.body.code, 'cor_wrong_year');
    assert.ok(!writes.some((sql) => sql.startsWith('INSERT')), 'no account was written');
    assert.strictEqual(photoKept, false);
  }, { years: ['2026–2027', '2027–2028'] }));
