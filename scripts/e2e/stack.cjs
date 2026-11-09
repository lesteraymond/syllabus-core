'use strict';
// LOCAL E2E stack with a STAGING-LIKE topology, all on this machine:
//   browser --https--> static frontend  https://localhost:FRONT   (the production build, with VITE_API_URL baked in)
//   browser --https--> TLS proxy        https://localhost:PROXY   --http--> API 127.0.0.1:API   (adds X-Forwarded-Proto/For, like a real reverse proxy)
// The API runs the REAL server/index.js with NODE_ENV=staging (so secrets, origins, Secure cookies and proxy trust are enforced exactly as on a staging host),
// against an isolated scratch MySQL database, with the scripted provider preload (scripts/e2e/offline-provider.cjs). It is labeled LOCAL E2E, never STAGING E2E.
// Nothing is read from server/.env or the root .env: the API runs from an empty working directory with an explicit environment.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const DB_NAME = process.env.E2E_DB_NAME || 'syllabus_e2e_local'; // another session or developer may run the suite at the same time: give each its own database and ports
// Throwaway values for this scratch stack only. They are not credentials of any real system and are never reused anywhere else.
const E2E_SESSION_SECRET = 'local-e2e-session-secret-7d41c9a05be2f386';
const E2E_JWT_SECRET = 'local-e2e-jwt-secret-3a9f60d1c8e4b257';
const E2E_ANTHROPIC_STAND_IN = 'sk-ant-local-e2e-stand-in-not-a-real-key-0123456789';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain', '.webp': 'image/webp', '.map': 'application/json' };

function makeCert(dir) {
  const key = path.join(dir, 'e2e-key.pem'), cert = path.join(dir, 'e2e-cert.pem');
  const r = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '2', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('openssl could not create the throwaway local certificate: ' + (r.stderr || '').split('\n')[0]);
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
}

function build({ outDir, apiUrl, log }) {
  const env = { ...process.env, VITE_API_URL: apiUrl, VITE_GOOGLE_CLIENT_ID: '' };
  const r = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', outDir, '--emptyOutDir'], { cwd: ROOT, env, encoding: 'utf8' });
  fs.writeFileSync(log, (r.stdout || '') + (r.stderr || ''));
  if (r.status !== 0) throw new Error('the frontend build failed (see ' + log + ')');
}

function staticServer({ dir, tls, port }) {
  const server = https.createServer(tls, (req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'https://localhost').pathname);
    let file = path.join(dir, urlPath);
    if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html'); // single-page app fallback
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

function tlsProxy({ tls, port, target }) {
  const server = https.createServer(tls, (req, res) => {
    const headers = { ...req.headers, 'x-forwarded-proto': 'https', 'x-forwarded-for': req.socket.remoteAddress, 'x-forwarded-host': req.headers.host };
    const up = http.request({ host: '127.0.0.1', port: target, method: req.method, path: req.url, headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on('error', () => { res.writeHead(502); res.end('bad gateway'); });
    req.pipe(up);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

const portFree = (port) => new Promise((resolve) => { const probe = require('node:net').createServer(); probe.once('error', () => resolve(false)); probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true))); });

async function waitFor(url, ms = 30000, init) {
  const end = Date.now() + ms;
  for (;;) {
    try { const r = await fetch(url, init); if (r.status < 500) return r; } catch { /* not up yet */ }
    if (Date.now() > end) throw new Error('timed out waiting for ' + url);
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function startStack({ ports = { front: Number(process.env.E2E_FRONT_PORT) || 3644, proxy: Number(process.env.E2E_PROXY_PORT) || 3643, api: Number(process.env.E2E_API_PORT) || 3201 }, outDir, workDir, extraEnv = {} } = {}) {
  const work = workDir || fs.mkdtempSync(path.join(os.tmpdir(), 'lcup-e2e-'));
  const empty = path.join(work, 'empty-cwd'); fs.mkdirSync(empty, { recursive: true });
  const dist = outDir || path.join(work, 'dist-e2e');
  const control = path.join(work, 'provider-mode.txt'), providerLog = path.join(work, 'provider-log.jsonl'), serverLog = path.join(work, 'api.log');
  fs.writeFileSync(control, 'ok'); fs.writeFileSync(providerLog, '');
  const FRONT = `https://localhost:${ports.front}`, PROXY = `https://localhost:${ports.proxy}`;
  build({ outDir: dist, apiUrl: `${PROXY}/api`, log: path.join(work, 'build.log') });
  const tls = makeCert(work);

  // a stale process on one of these ports would answer the health check with ITS database and provider mode and make every result meaningless: refuse to start instead
  for (const port of [ports.api, ports.proxy, ports.front]) if (!(await portFree(port))) throw new Error('port ' + port + ' is already in use: stop the process holding it (a previous E2E run may have left its server running) or set E2E_API_PORT / E2E_PROXY_PORT / E2E_FRONT_PORT');
  const api = startApi({ port: ports.api, work, front: FRONT, control, providerLog, serverLog, extraEnv });
  for (const event of ['exit', 'SIGINT', 'SIGTERM']) process.once(event, () => { api.kill(); if (event !== 'exit') process.exit(1); }); // never leave the API behind, even when a run crashes
  const front = await staticServer({ dir: dist, tls, port: ports.front });
  const proxy = await tlsProxy({ tls, port: ports.proxy, target: ports.api });
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // this process only talks to its own throwaway certificate
  try { await waitFor(`http://127.0.0.1:${ports.api}/api/health`); } catch (e) { throw new Error(e.message + (api.exited() !== null ? ` (the API exited with code ${api.exited()}; see ${serverLog})` : '')); }

  return {
    work, serverLog, providerLog, control, FRONT, PROXY, API: `http://127.0.0.1:${ports.api}`, tls,
    setProvider: (mode) => fs.writeFileSync(control, mode),
    providerEvents: () => fs.readFileSync(providerLog, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)),
    stop: async () => { for (const x of [front, proxy]) x.close(); api.kill(); await new Promise((r) => setTimeout(r, 300)); },
  };
}

// The REAL server/index.js as NODE_ENV=staging against the isolated scratch database, with the scripted provider preload. Used for the main stack and, with
// different flags (for example Policy V2 off), for a second API instance that proves official-score parity.
function startApi({ port, work, front, control, providerLog, serverLog, extraEnv = {} }) {
  const empty = path.join(work, 'empty-cwd'); fs.mkdirSync(empty, { recursive: true });
  const env = {
    PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP,
    NODE_ENV: 'staging', PORT: String(port),
    SESSION_SECRET: E2E_SESSION_SECRET, JWT_SECRET: E2E_JWT_SECRET,
    DB_HOST: 'localhost', DB_USER: 'root', DB_PASS: '', DB_NAME,
    CORS_ALLOWED_ORIGINS: front, TRUST_PROXY: '1', SESSION_COOKIE_SAMESITE: 'lax',
    SMTP_HOST: '', MAIL_FROM: '', APP_URL: front, GOOGLE_CLIENT_ID: '',
    SYLLABUS_CHECK_ACADEMIC_V2: 'on', SYLLABUS_CHECK_AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: E2E_ANTHROPIC_STAND_IN,
    ANTHROPIC_MODEL: 'claude-sonnet-5-5', SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: 'claude-sonnet-5-5', SYLLABUS_CHECK_AI_GATE: 'advisory',
    SYLLABUS_CHECK_AI_MAX_REQUESTS: '120', SYLLABUS_CHECK_AI_MAX_COST_USD: '10', ANTHROPIC_MAX_RETRIES: '0',
    E2E_PROVIDER_CONTROL: control, E2E_PROVIDER_LOG: providerLog,
    ...extraEnv,
  };
  if (!/e2e/i.test(env.DB_NAME)) throw new Error('refusing to start: the E2E stack only runs against an isolated e2e database');
  if(process.env.E2E_NO_DDL==='1'){
    env.E2E_SKIP_BOOTSTRAP='1';
    env.NODE_OPTIONS='--require "'+path.join(ROOT,'scripts/e2e/stability-no-ddl.cjs').replaceAll('\\','/')+'"';
  }
  const out = fs.openSync(serverLog, 'a');
  const child = spawn(process.execPath, ['-r', path.join(ROOT, 'scripts/e2e/offline-provider.cjs'), path.join(ROOT, 'server/index.js')], { cwd: empty, env, stdio: ['ignore', out, out] });
  let exited = null; child.on('exit', (code) => { exited = code; });
  return { kill: () => child.kill(), exited: () => exited };
}

module.exports = { startStack, startApi, waitFor, DB_NAME };
