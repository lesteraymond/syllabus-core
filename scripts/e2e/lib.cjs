'use strict';
// Shared helpers for the LOCAL E2E run: a real Edge/Chromium browser (playwright-core), one isolated browser context per user, evidence capture, and a
// guard that records every console error, page error, failed API response and blocked non-loopback request.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.resolve(__dirname, '../../node_modules/playwright-core'));
const { PASSWORD } = require('./seed-e2e.cjs');

const squash = (t) => String(t).split(/\s+/).join(' ').trim();
const VIEWPORTS = { phone: { width: 375, height: 812 }, tablet: { width: 768, height: 1024 }, laptop: { width: 1024, height: 768 }, desktop: { width: 1440, height: 900 } };

// Microsoft Edge by default (installed on the development machine). E2E_BROWSER_PATH points at any Chromium/Chrome executable instead (for example in CI); E2E_BROWSER_CHANNEL
// selects another installed channel such as 'chrome'.
async function launch() {
  if (process.env.E2E_BROWSER_PATH) return chromium.launch({ executablePath: process.env.E2E_BROWSER_PATH, headless: true });
  return chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || 'msedge', headless: true });
}

// A signed-out or signed-in browser session. `issues` collects anything a reviewer would want to see.
async function session(browser, stack, { viewport = VIEWPORTS.desktop, locale = 'en-US' } = {}) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport, locale });
  const page = await ctx.newPage();
  page.setDefaultTimeout(12000);
  const issues = { console: [], pageErrors: [], badResponses: [], blocked: [], apiCalls: [] };
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return route.continue();
    issues.blocked.push(u.hostname); return route.abort();
  });
  page.on('console', (m) => { if (m.type() === 'error') issues.console.push(squash(m.text()).slice(0, 200)); });
  page.on('pageerror', (e) => issues.pageErrors.push(squash(e.message).slice(0, 200)));
  page.on('response', (r) => {
    const url = r.url();
    if (!url.startsWith(stack.PROXY + '/api/')) return;
    const entry = `${r.request().method()} ${url.slice(stack.PROXY.length)} ${r.status()}`;
    issues.apiCalls.push(entry);
    if (url.endsWith('/api/auth/me') && !issues.cors) issues.cors = { origin: r.headers()['access-control-allow-origin'], credentials: r.headers()['access-control-allow-credentials'], vary: r.headers().vary };
    if (url.includes('/api/syllabus-check/') && r.request().method() !== 'GET') r.text().then((t) => { issues.checkBodies = issues.checkBodies || []; issues.checkBodies.push(entry + ' :: ' + squash(t).replace(/"verificationToken":"[^"]*"/g, '"verificationToken":"<redacted>"').slice(0, 700)); }).catch(() => {});
    if (r.status() >= 400) { issues.badResponses.push(entry); r.text().then((t) => { issues.failedBodies = issues.failedBodies || []; issues.failedBodies.push(entry + ' :: ' + squash(t).slice(0, 220)); }).catch(() => {}); }
  });
  const s = {
    ctx, page, issues, stack,
    async login(who, password = PASSWORD) {
      await page.goto(stack.FRONT);
      await page.getByLabel('Username or Email').fill(`e2e.${who}@e2e.invalid`);
      await page.fill('input[type=password]', password);
      await page.click('button[type=submit]');
    },
    async loginOk(who) { await s.login(who); await page.getByText(/Good (morning|afternoon|evening)|Magandang/).first().waitFor({ timeout: 15000 }); await page.waitForTimeout(800); },
    // on a phone the menu sits behind a collapsed card (.mnav-card, aria-expanded): open it first
    nav: async (name) => { const card = page.locator('.mnav-card[aria-expanded="false"]'); if (await card.count()) { await card.first().click(); await page.waitForTimeout(400); } await page.getByRole('button', { name: new RegExp('^' + name + '[ 0-9]*$', 'i') }).first().click(); await page.waitForTimeout(1200); }, // a menu item may carry a pending-count badge
    text: async () => squash(await page.innerText('body')),
    // call the API from the page, exactly as the frontend does (same origin header, cookies included)
    // `raw` is the plain call. `api` also behaves like a real client for saving content: PUT /syllabi/:id/content must carry the revisions the caller last read (the server refuses
    // a save without them), so this helper reads the current ones first and sends them. { raw: true } sends exactly what it is given, for tests of the refusals themselves.
    raw: (method, url, body) => page.evaluate(async ({ base, method, url, body }) => {
      const r = await fetch(base + url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      let j = null; try { j = await r.json(); } catch { /* not json */ }
      return { status: r.status, body: j };
    }, { base: stack.PROXY + '/api', method, url, body }),
    async api(method, url, body, options = {}) {
      if (method === 'PUT' && /\/syllabi\/\d+\/content$/.test(url) && body && body.sections && !body.baseRevisions && !options.raw) {
        const current = await s.raw('GET', url);
        if (current.status === 200 && current.body && current.body.revisions) body = { ...body, baseRevisions: Object.fromEntries(Object.keys(body.sections).map((k) => [k, current.body.revisions[k]])) };
      }
      return s.raw(method, url, body);
    },
    async pick(label, option) { // the app's own dropdown (a select-only combobox)
      await page.locator('.select-trigger').filter({ hasText: label }).first().click();
      await page.getByRole('option', { name: option }).first().click();
      await page.waitForTimeout(400);
    },
    shot: async (file) => { fs.mkdirSync(path.dirname(file), { recursive: true }); await page.screenshot({ path: file }); },
    close: () => ctx.close(),
  };
  return s;
}

module.exports = { launch, session, squash, VIEWPORTS, PASSWORD };
