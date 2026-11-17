'use strict';
// Preload for the LOCAL E2E API server only (node -r scripts/e2e/offline-provider.cjs server/index.js). It makes the server's real provider code path
// (the new AI Checker: pipeline/provider.js -> anthropicClient.js -> the Anthropic SDK) run against an OFFLINE stand-in instead of the network:
//   * every request to https://api.anthropic.com/ is answered in-process by scripts/e2e/fake-anthropic.cjs, which answers the checker's judge and
//     rewrite requests in their own format (no byte leaves this machine);
//   * every other non-loopback fetch, socket connect and DNS lookup is refused and logged, so "no unintended network request" is enforced, not assumed;
//   * E2E_PROVIDER_CONTROL names a file the test runner rewrites between scenarios: ok | down (HTTP 503) | auth (HTTP 401) | rate (HTTP 429) |
//     invalid (an HTTP 200 body that is not a message) | garbage (a message whose text is not the JSON the checker asked for).
// It exists to exercise the real application offline. It proves nothing about how Claude judges text.
const fs = require('node:fs');
if (process.env.E2E_DB_PORT) require('./db-port-redirect.cjs'); // test-only: an isolated database server on another port (see db-port-redirect.cjs)
const net = require('node:net');
const dns = require('node:dns');
const fake = require('./fake-anthropic.cjs');

const LOG = process.env.E2E_PROVIDER_LOG || '';
const log = (entry) => { if (LOG) try { fs.appendFileSync(LOG, JSON.stringify({ t: new Date().toISOString(), ...entry }) + '\n'); } catch { /* evidence only */ } };
const mode = () => { try { return fs.readFileSync(process.env.E2E_PROVIDER_CONTROL, 'utf8').trim() || 'ok'; } catch { return 'ok'; } };
const isLoopbackHost = (h) => /^(localhost|127\.0\.0\.1|::1|\[::1\]|::ffff:127\.0\.0\.1)$/i.test(String(h || ''));

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input?.url || input);
  if (/^https:\/\/api\.anthropic\.com\//i.test(url)) {
    const m = mode();
    let request = 'unknown'; try { request = fake.kindOf(JSON.parse(String(init && init.body))); } catch { /* not JSON */ }
    log({ kind: 'provider', mode: m, request, url: 'https://api.anthropic.com/(offline stand-in)' });
    return fake.answer(init, m);
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
