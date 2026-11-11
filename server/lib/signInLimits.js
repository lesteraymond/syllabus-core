'use strict';
// How many FAILED sign-ins are allowed before the server answers 429 (routes/auth.js: password and Google sign-in). A correct sign-in is never counted.
//
//   SIGNIN_MAX_FAILURES_PER_ACCOUNT   failed password sign-ins for one account (however the email is typed) in one window. Default 10. 3 to 100.
//   SIGNIN_MAX_FAILURES_PER_IP        failed password sign-ins, and separately failed Google sign-ins, from one address in one window. Default 50. 5 to 10000.
//   SIGNIN_WINDOW_MINUTES             the length of the window. Default 15. 1 to 1440.
//
// The limits cannot be turned off: 0, "off" or anything out of range is refused, in every mode, and the server does not start (index.js checks this before it
// listens, like the secrets and the host settings). The address is req.ip, so behind a reverse proxy TRUST_PROXY must be right (lib/hostConfig.js), or every
// visitor shares the proxy's address. The counters live in this process's memory (lib/rateLimit.js): a restart clears them, and several server processes each
// keep their own, so a proxy-level limit in front of /api/auth is still worth having.
const SETTINGS = Object.freeze({
  perAccount: { name: 'SIGNIN_MAX_FAILURES_PER_ACCOUNT', fallback: 10, min: 3, max: 100 },
  perIp: { name: 'SIGNIN_MAX_FAILURES_PER_IP', fallback: 50, min: 5, max: 10000 },
  windowMinutes: { name: 'SIGNIN_WINDOW_MINUTES', fallback: 15, min: 1, max: 1440 },
});

const fail = (message) => Object.assign(new Error(message), { code: 'signin_limits_invalid' });

function read(env, { name, fallback, min, max }) {
  const raw = String(env?.[name] ?? '').trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) throw fail(`${name} must be a whole number from ${min} to ${max} (the default is ${fallback}). Sign-in limits cannot be turned off.`);
  return Number(raw);
}

// -> { perAccount, perIp, windowMs }. Throws a signin_limits_invalid error naming the setting.
function resolveSignInLimits(env = process.env) {
  return { perAccount: read(env, SETTINGS.perAccount), perIp: read(env, SETTINGS.perIp), windowMs: read(env, SETTINGS.windowMinutes) * 60 * 1000 };
}

module.exports = { resolveSignInLimits, SETTINGS };
