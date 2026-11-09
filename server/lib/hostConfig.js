'use strict';
// Where the server may be reached from, and how its cookies behave: CORS origins, session and remember-cookie flags, the reverse proxy, and a cross-site
// request guard. One place, validated at startup, nothing hardcoded and no deployment domain invented.
//
// WHY IT IS SHAPED THIS WAY. The browser app calls this API directly and cross-origin (VITE_API_URL) with credentials, and the API authorizes from the
// SESSION COOKIE only (middleware/auth.js requireAuth; the Bearer token is not what authorizes API calls). CORS stops a foreign page from READING a response and
// stops preflighted requests, but it does NOT stop the server from processing a cross-site "simple" request (urlencoded or multipart), and with a cookie that is
// sent cross-site the request is authenticated. So credentialed cross-origin access is protected by three things together: an explicit origin list (no wildcard),
// a SameSite policy chosen for the real topology, and the Origin check below for state-changing requests.
//
// Settings (all optional in development; the first, third and fourth are REQUIRED when NODE_ENV is staging or production):
//   CORS_ALLOWED_ORIGINS      comma-separated FRONTEND origins, each scheme://host[:port] with no path, e.g. the origin the browser shows for the app.
//                             Never "*". https only in staging and production (plain http only for localhost).
//   SESSION_COOKIE_SAMESITE   lax (default) | strict | none. lax suits a frontend and API on the same site (the same registrable domain, or localhost);
//                             none is only for a frontend on a different SITE, needs Secure cookies, and relies on the Origin check.
//   SESSION_COOKIE_SECURE     true | false. Forced true in staging and production (false is refused); false by default in development.
//   TRUST_PROXY               how many reverse-proxy hops terminate TLS in front of this server (1 to 5), or a comma-separated list of proxy addresses/CIDRs or
//                             loopback | linklocal | uniquelocal. Required in staging and production: this server speaks plain HTTP, so Secure cookies and the
//                             request protocol depend on the proxy's X-Forwarded-Proto. "true" is refused (it trusts a forgeable header).
const { hardened } = require('./sessionSecret');

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const DEV_DEFAULT_ORIGINS = Object.freeze(['http://localhost:5173']); // exactly what this server allowed before this module existed
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SAMESITE = new Set(['lax', 'strict', 'none']);
const SESSION_MS = 24 * 60 * 60 * 1000;
const MAX_ORIGINS = 10;

const fail = (message) => Object.assign(new Error(message), { code: 'host_config_invalid' });
const clean = (v) => String(v ?? '').trim();

function parseOrigins(raw) {
  const out = [];
  for (const entry of clean(raw).split(',').map((s) => s.trim()).filter(Boolean)) {
    if (entry === '*' || entry.includes('*')) throw fail('CORS_ALLOWED_ORIGINS must list explicit origins: a wildcard is never allowed with credentialed requests.');
    if (entry.toLowerCase() === 'null') throw fail('CORS_ALLOWED_ORIGINS must not contain "null".');
    let url;
    try { url = new URL(entry); } catch { throw fail(`CORS_ALLOWED_ORIGINS has an entry that is not a valid origin: "${entry}". Use scheme://host[:port].`); }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== entry) throw fail(`CORS_ALLOWED_ORIGINS entry "${entry}" must be exactly an origin (scheme://host[:port], no path, query, credentials or trailing slash); did you mean "${url.origin}"?`);
    if (!out.includes(entry)) out.push(entry);
  }
  if (out.length > MAX_ORIGINS) throw fail(`CORS_ALLOWED_ORIGINS lists more than ${MAX_ORIGINS} origins.`);
  return out;
}

function parseTrustProxy(raw) {
  const v = clean(raw);
  if (!v) return undefined;
  if (/^\d+$/.test(v)) { const n = Number(v); if (n < 1 || n > 5) throw fail('TRUST_PROXY as a hop count must be between 1 and 5.'); return n; }
  if (['true', 'false', '*'].includes(v.toLowerCase())) throw fail(`TRUST_PROXY=${v} is refused: use the number of proxy hops (for example 1) or the proxy addresses.`);
  const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
  if (!parts.length || parts.some((p) => !/^(loopback|linklocal|uniquelocal|[0-9a-fA-F:.]+(\/\d{1,3})?)$/.test(p))) throw fail('TRUST_PROXY must be a hop count, or a comma-separated list of proxy IP addresses, CIDR ranges, loopback, linklocal or uniquelocal.');
  return parts;
}

// The cookie flags only (also used by the remember-me cookie in middleware/auth.js). Validates its own inputs.
function cookieSettingsOf(env = process.env) {
  const strict = hardened(env);
  const secureEnv = clean(env.SESSION_COOKIE_SECURE).toLowerCase();
  if (secureEnv && !['true', 'false'].includes(secureEnv)) throw fail('SESSION_COOKIE_SECURE must be true or false.');
  if (strict && secureEnv === 'false') throw fail(`SESSION_COOKIE_SECURE=false is refused with NODE_ENV=${clean(env.NODE_ENV).toLowerCase()}: cookies must be Secure.`);
  const secure = strict ? true : secureEnv === 'true';
  const sameSite = clean(env.SESSION_COOKIE_SAMESITE).toLowerCase() || 'lax';
  if (!SAMESITE.has(sameSite)) throw fail('SESSION_COOKIE_SAMESITE must be lax, strict or none.');
  if (sameSite === 'none' && !secure) throw fail('SESSION_COOKIE_SAMESITE=none requires Secure cookies (HTTPS); browsers reject it otherwise.');
  return { httpOnly: true, secure, sameSite, path: '/' };
}

// Everything, validated. Throws a host_config_invalid error naming the setting. Nothing here prints or returns a secret.
function resolveHostConfig(env = process.env) {
  const strict = hardened(env), mode = clean(env.NODE_ENV).toLowerCase() || 'development';
  const configured = parseOrigins(env.CORS_ALLOWED_ORIGINS);
  if (strict && !configured.length) throw fail(`CORS_ALLOWED_ORIGINS is required with NODE_ENV=${mode}: list the frontend origin(s) explicitly. Nothing is assumed.`);
  if (strict) for (const origin of configured) { if (new URL(origin).protocol !== 'https:' && !LOOPBACK.has(new URL(origin).hostname)) throw fail(`CORS_ALLOWED_ORIGINS entry "${origin}" must use https with NODE_ENV=${mode} (plain http is only accepted for localhost).`); }
  const cookie = cookieSettingsOf(env);
  const trustProxy = parseTrustProxy(env.TRUST_PROXY);
  if (strict && trustProxy === undefined) throw fail(`TRUST_PROXY is required with NODE_ENV=${mode}: this server speaks plain HTTP behind a TLS-terminating reverse proxy, so say how many proxy hops to trust (for example 1).`);
  return { mode, strict, origins: configured.length ? configured : [...DEV_DEFAULT_ORIGINS], originSource: configured.length ? 'configured' : 'development default', cookie, sessionCookie: { ...cookie, maxAge: SESSION_MS }, trustProxy };
}

const corsOptions = (config) => { const allowed = new Set(config.origins); return { origin: (origin, cb) => cb(null, !origin || allowed.has(origin)), credentials: true }; };

// A state-changing request from a browser must come from an allowed origin (or this server's own). A request with no Origin (a non-browser client, or a
// same-origin navigation) is allowed unless the browser itself says it is cross-site (Sec-Fetch-Site).
function originGuard(config) {
  const allowed = new Set(config.origins);
  const refuse = (res) => res.status(403).json({ error: 'Request refused: it did not come from an allowed origin.', code: 'origin_not_allowed' });
  return function crossSiteGuard(req, res, next) {
    if (!UNSAFE_METHODS.has(req.method)) return next();
    const origin = req.headers.origin;
    if (origin !== undefined) return allowed.has(origin) || origin === `${req.protocol}://${req.get('host')}` ? next() : refuse(res);
    if (clean(req.headers['sec-fetch-site']).toLowerCase() === 'cross-site') return refuse(res);
    return next();
  };
}

// Order matters and is the same everywhere: proxy trust first (so req.protocol and Secure cookies are right), then CORS, then the guard, before the session
// and the body parsers run. index.js and the tests both call this one function.
function applyHostSecurity(app, config) {
  const cors = require('cors');
  if (config.trustProxy !== undefined) app.set('trust proxy', config.trustProxy);
  app.use(cors(corsOptions(config)));
  app.use(originGuard(config));
  return config;
}
const sessionOptions = (secret, config) => ({ secret, resave: false, saveUninitialized: false, cookie: config.sessionCookie });

module.exports = { resolveHostConfig, cookieSettingsOf, parseOrigins, parseTrustProxy, corsOptions, originGuard, applyHostSecurity, sessionOptions, DEV_DEFAULT_ORIGINS, LOOPBACK };
