'use strict';
// The developer rule editor: open http://<server>/dev/rules and enter the developer password. It is a page of its own, served by this
// server, not part of the app and not linked from it. The password is DEV_EDITOR_PASSWORD in server/.env (at least 8 characters, never in
// the code); with none set the whole thing is off. A correct password opens the editor for 30 minutes. Wrong passwords are counted per
// address and lock it for ten minutes after five. It edits the compliance standard through lib/compliance/overrides.js.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const store = require('../lib/compliance/overridesStore');
const o = require('../lib/compliance/overrides');

const router = express.Router();
const PAGE = path.join(__dirname, '..', 'views', 'rule-editor.html');
const UNLOCK_MS = 30 * 60 * 1000;
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;
const fails = new Map(); // address -> { count, until }

const secret = () => String(process.env.DEV_EDITOR_PASSWORD || '');
const configured = () => secret().length >= 8;
const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(digest(a), digest(b));
const who = (req) => 'developer @ ' + (req.ip || 'unknown');
const unlocked = (req) => configured() && Number(req.session && req.session.devEditorUntil) > Date.now();
const needUnlock = (req, res, next) => (unlocked(req) ? next() : res.status(403).json({ message: 'Enter the developer password first.' }));
const fail = (res, err) => { console.error(err); res.status(500).json({ message: 'Something went wrong. Please try again.' }); };

// Nothing here should be cached, indexed or passed on in a Referer header.
router.use((req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' });
  next();
});

router.get('/', (req, res) => {
  if (!configured()) return res.status(503).type('text/plain').send('The rule editor is switched off. Set DEV_EDITOR_PASSWORD (at least 8 characters) in server/.env and restart the server.');
  res.type('html').send(fs.readFileSync(PAGE, 'utf8'));
});

router.get('/api/status', (req, res) => res.json({ configured: configured(), unlocked: unlocked(req) }));

router.post('/api/unlock', (req, res) => {
  if (!configured()) return res.status(503).json({ message: 'The rule editor is switched off. Set DEV_EDITOR_PASSWORD in server/.env and restart the server.' });
  const key = req.ip || 'unknown';
  const f = fails.get(key) || { count: 0, until: 0 };
  if (f.until > Date.now()) return res.status(429).json({ message: 'Too many wrong passwords. Try again in a few minutes.' });
  const given = req.body && typeof req.body.password === 'string' ? req.body.password : '';
  if (!given || !same(given, secret())) {
    f.count += 1;
    if (f.count >= MAX_FAILS) { f.count = 0; f.until = Date.now() + LOCK_MS; }
    fails.set(key, f);
    return res.status(403).json({ message: 'That is not the developer password.' });
  }
  fails.delete(key);
  req.session.devEditorUntil = Date.now() + UNLOCK_MS;
  res.json({ unlocked: true });
});

router.post('/api/lock', (req, res) => { if (req.session) delete req.session.devEditorUntil; res.json({ unlocked: false }); });

async function view(req) {
  const { rev, doc } = store.current();
  return {
    version: o.standard.version, baseVersion: o.base.version, rev, edited: Object.keys(doc).length > 0,
    base: o.effective({}), effective: o.effective(doc), history: await store.history(req.app.locals.db),
  };
}

router.get('/api/data', needUnlock, async (req, res) => { try { res.json(await view(req)); } catch (err) { fail(res, err); } });

router.put('/api/data', needUnlock, async (req, res) => {
  try {
    const result = await store.save(req.app.locals.db, who(req), req.body && req.body.doc);
    if (result.errors) return res.status(400).json({ message: result.errors[0], errors: result.errors });
    req.session.devEditorUntil = Date.now() + UNLOCK_MS;
    res.json({ ...(await view(req)), changed: result.changes.length });
  } catch (err) { fail(res, err); }
});

router.post('/api/reset', needUnlock, async (req, res) => {
  try {
    const result = await store.reset(req.app.locals.db, who(req));
    res.json({ ...(await view(req)), changed: result.changes.length });
  } catch (err) { fail(res, err); }
});

// For the tests: forget the wrong-password counts.
router.resetFailures = () => fails.clear();

module.exports = router;
