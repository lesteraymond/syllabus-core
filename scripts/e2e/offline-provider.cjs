'use strict';
// Preload for the LOCAL E2E API server only (node -r scripts/e2e/offline-provider.cjs server/index.js). It makes the server's real provider code path run
// against the SCRIPTED test double instead of the network:
//   * every request to https://api.anthropic.com/ is answered in-process by the conformance harness's scripted transport (no byte leaves this machine);
//   * every other non-loopback fetch, socket connect and DNS lookup is refused and logged, so "no unintended network request" is enforced, not assumed;
//   * E2E_PROVIDER_CONTROL names a file the test runner rewrites between scenarios: ok | down (HTTP 503) | auth (HTTP 401) | rate (HTTP 429) | invalid (bad JSON) | unauthorized-field (a valid answer naming a field its relationship does not own).
// It exists to exercise the real application offline. It proves nothing about how Claude judges text.
const fs = require('node:fs');
if (process.env.E2E_DB_PORT) require('./db-port-redirect.cjs'); // test-only: an isolated database server on another port (see db-port-redirect.cjs)
const net = require('node:net');
const dns = require('node:dns');
const path = require('node:path');
const harness = require(path.resolve(__dirname, '../../server/lib/syllabuscheck/vpaa-conformance/harness'));

const LOG = process.env.E2E_PROVIDER_LOG || '';
const log = (entry) => { if (LOG) try { fs.appendFileSync(LOG, JSON.stringify({ t: new Date().toISOString(), ...entry }) + '\n'); } catch { /* evidence only */ } };
const mode = () => { try { return fs.readFileSync(process.env.E2E_PROVIDER_CONTROL, 'utf8').trim() || 'ok'; } catch { return 'ok'; } };
const isLoopbackHost = (h) => /^(localhost|127\.0\.0\.1|::1|\[::1\]|::ffff:127\.0\.0\.1)$/i.test(String(h || ''));

// the scripted model: faithful ALIGNED answers, except two deliberate, repeatable gaps in week 1 (one correctable: the ILO-activity target is an editable field; one finding-only) (stateless, so every check of the same syllabus gets the same
// answers) so the saved report always has academic findings and one correctable recommendation to render
// text the scripted model itself proposed earlier counts as repaired: a rewrite containing this marker is judged ALIGNED, so Check & Improve can verify it
const REPAIRED = 'Scripted revised text for faculty review.';
const script = (pair) => {
  if (String(pair.source).includes(REPAIRED) || String(pair.target).includes(REPAIRED)) return undefined;
  if (pair.id === 'row0-ilo0-activity') return { label: 'PARTIALLY_ALIGNED', explanation: "Scripted: the activity does not yet practise the week's content.", recommendation: 'REWRITE_TEXT' };
  if (pair.id === 'row0-contentassessment') return { label: 'NOT_ALIGNED', explanation: "Scripted: the assessment task does not measure the week's content." };
  return undefined;
};
// The versioned recommendation contract (academicV2Recommendation.js) lets a failing answer name only a field its relationship owns; for ILO-activity that is learning_activity.
// The DEFAULT script is a valid model answer: it names that field, so a faculty-reviewable rewrite is offered. Mode 'unauthorized-field' answers the same gap with a field the
// relationship does not own (course_content): the contract must then withhold the draft, and the tests of that conservative refusal use this mode.
const scripted = (field) => harness.scriptedTransport((pair) => { const base = script(pair); return base && pair.id === 'row0-ilo0-activity' ? { ...base, correctionField: field } : base; });
const transport = scripted('learning_activity');
const transportUnauthorizedField = scripted('course_content');

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input?.url || input);
  if (/^https:\/\/api\.anthropic\.com\//i.test(url)) {
    const m = mode();
    log({ kind: 'provider', mode: m, url: 'https://api.anthropic.com/(scripted)' });
    if (m === 'down') return new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'scripted outage' } }), { status: 503, headers: { 'content-type': 'application/json' } });
    if (m === 'auth') return new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'scripted auth failure' } }), { status: 401, headers: { 'content-type': 'application/json' } });
    if (m === 'rate') return new Response(JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'scripted rate limit' } }), { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '1' } });
    if (m === 'invalid') return new Response('{"not":"a message"', { status: 200, headers: { 'content-type': 'application/json' } });
    if (m === 'unauthorized-field') return transportUnauthorizedField(url, init);
    return transport(url, init);
  }
  let host = ''; try { host = new URL(url).hostname; } catch { /* not a URL */ }
  if (isLoopbackHost(host)) return realFetch(input, init);
  log({ kind: 'blocked-fetch', host });
  throw new Error('E2E offline guard: blocked non-loopback request to ' + host);
};

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function patched(...args) {
  const first = args[0];
  const host = first && typeof first === 'object' ? first.host : typeof args[1] === 'string' ? args[1] : undefined;
  const isPipe = first && typeof first === 'object' ? !!first.path : typeof first === 'string';
  if (!isPipe && host && !isLoopbackHost(host)) {
    log({ kind: 'blocked-socket', host });
    process.nextTick(() => this.destroy(new Error('E2E offline guard: blocked connect to ' + host)));
    return this;
  }
  return connect.apply(this, args);
};
const lookup = dns.lookup;
dns.lookup = function patched(hostname, ...rest) {
  if (isLoopbackHost(hostname)) return lookup.call(dns, hostname, ...rest);
  log({ kind: 'blocked-dns', host: String(hostname) });
  const cb = rest.find((x) => typeof x === 'function');
  const error = Object.assign(new Error('E2E offline guard: blocked DNS lookup of ' + hostname), { code: 'ENOTFOUND' });
  if (cb) return process.nextTick(cb, error);
  return undefined;
};
log({ kind: 'preload', note: 'offline provider and network guard active' });
