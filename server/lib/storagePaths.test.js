// UPLOAD_DIR and PRIVATE_DIR: a relative folder is under server/, an absolute one is used as it is, and whatever writes agrees with whatever reads.
// Run: npm test (project root).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const express = require('express');
const { uploadRoot, privateRoot } = require('./storagePaths');

const SERVER = path.join(__dirname, '..');
async function withEnv(values, fn) {
  const old = Object.fromEntries(Object.keys(values).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(values)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  try { return await fn(); } finally { for (const [k, v] of Object.entries(old)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}

test('the default and a relative folder are under server/; an absolute folder is used as it is', async () => {
  await withEnv({ UPLOAD_DIR: undefined, PRIVATE_DIR: undefined }, () => {
    assert.strictEqual(uploadRoot(), path.join(SERVER, 'uploads'));
    assert.strictEqual(privateRoot(), path.join(SERVER, 'private'));
  });
  await withEnv({ UPLOAD_DIR: 'data/up', PRIVATE_DIR: 'data/priv' }, () => {
    assert.strictEqual(uploadRoot(), path.join(SERVER, 'data', 'up'));
    assert.strictEqual(privateRoot(), path.join(SERVER, 'data', 'priv'));
  });
  const abs = path.join(os.tmpdir(), 'lcup-storage');
  await withEnv({ UPLOAD_DIR: abs, PRIVATE_DIR: abs }, () => {
    assert.strictEqual(uploadRoot(), abs);
    assert.strictEqual(privateRoot(), abs);
  });
});

test('an absolute PRIVATE_DIR is where profile photos and COR photos are kept', () => {
  const abs = path.join(os.tmpdir(), 'lcup-private');
  const script = "const a = require('./lib/avatar'); console.log(JSON.stringify([a.PRIVATE_ROOT, a.avatarFile('avatars/u1-1.webp')]))"; // a fresh process: the folder is read when the module loads
  const r = spawnSync(process.execPath, ['-e', script], { cwd: SERVER, env: { ...process.env, PRIVATE_DIR: abs }, encoding: 'utf8' });
  assert.deepStrictEqual(JSON.parse(r.stdout), [abs, path.join(abs, 'avatars', 'u1-1.webp')]);
});

test('an uploaded file is received in the same absolute UPLOAD_DIR that the readers use', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'lcup-up-')), abs = path.join(base, 'files'); // does not exist yet: the route creates it
  await withEnv({ UPLOAD_DIR: abs }, async () => {
    const app = express();
    app.use((req, res, next) => { req.session = { user: { id: 1, role: 'admin' } }; next(); });
    app.locals.db = { query: async () => [[{ user_id: 1 }]] }; // requireAuth: the signed-in account still exists
    app.use('/syllabi', require('../routes/syllabi'));
    const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    try {
      const form = new FormData();
      form.append('file', new Blob(['%PDF-1.4 %%EOF'], { type: 'application/pdf' }), 'a.pdf');
      const res = await fetch('http://127.0.0.1:' + server.address().port + '/syllabi', { method: 'POST', body: form });
      assert.strictEqual(res.status, 403); // a file alone is refused (the builder is the only way to submit), after it was received
      assert.deepStrictEqual(fs.readdirSync(abs), [], 'received in the configured folder, then discarded');
      fs.writeFileSync(path.join(abs, 'a-1.pdf'), '%PDF-1.4 %%EOF');
      assert.strictEqual(require('./compliance/upload').readFacts('/uploads/a-1.pdf').exists, true, 'the checker looks in the same folder');
      assert.strictEqual(require('./catalogFileCleanup').uploadFile('/uploads/a-1.pdf'), path.join(abs, 'a-1.pdf'), 'and so does the cleanup');
    } finally { server.close(); fs.rmSync(base, { recursive: true, force: true }); }
  });
});

test('no other server file reads UPLOAD_DIR or PRIVATE_DIR', () => {
  const found = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, e.name);
      if (e.isDirectory()) { if (!['node_modules', 'uploads', 'private'].includes(e.name)) walk(file); continue; }
      if (!/\.c?js$/.test(e.name) || /\.test\.c?js$/.test(e.name)) continue;
      if (/process\.env\.(UPLOAD_DIR|PRIVATE_DIR)/.test(fs.readFileSync(file, 'utf8'))) found.push(path.relative(SERVER, file).split(path.sep).join('/'));
    }
  };
  walk(SERVER);
  assert.deepStrictEqual(found, ['lib/storagePaths.js']);
});
