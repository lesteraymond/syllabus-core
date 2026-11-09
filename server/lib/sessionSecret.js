'use strict';
// One rule for every server-side signing secret (session cookies, recommendation verification tokens).
//
//   An ACCEPTABLE secret is at least 16 characters, uses at least 6 different characters, and is not a publicly known default.
//   NODE_ENV=production or staging ("hardened"): a missing or unacceptable secret STOPS the server from starting; nothing is guessed or defaulted.
//   Any other mode (local development, tests): a missing or unacceptable secret is replaced by a RANDOM per-process secret, never a constant. Sessions
//   already live in memory, so they end when the process restarts either way; a warning says so. No secret value is ever logged or returned in a message.
const crypto = require('node:crypto');

const MIN_LENGTH = 16;
const MIN_DISTINCT = 6;
// Strings that appear in source code, documentation, examples or tutorials. A value equal to one of these is public whatever its length.
const KNOWN_PUBLIC = new Set(['capstone-secret', 'syllabus-academic-verification-secret', 'secret', 'changeme', 'change-me', 'change_me', 'password', 'session-secret', 'session_secret', 'your-secret-here', 'your_secret_here', 'keyboard cat', 'supersecret', 'super-secret', 'default', 'development', 'dev-secret', 'test-secret']);
const HARDENED = new Set(['production', 'staging']);

const hardened = (env = process.env) => HARDENED.has(String(env?.NODE_ENV ?? '').trim().toLowerCase());

function isStrongSecret(value) {
  const s = String(value ?? '').trim();
  return s.length >= MIN_LENGTH && new Set(s).size >= MIN_DISTINCT && !KNOWN_PUBLIC.has(s.toLowerCase());
}
// Why a configured value was refused, without revealing it.
function weaknessOf(value) {
  const s = String(value ?? '').trim();
  if (!s) return 'missing';
  if (KNOWN_PUBLIC.has(s.toLowerCase())) return 'a publicly known default';
  if (s.length < MIN_LENGTH) return `shorter than ${MIN_LENGTH} characters`;
  if (new Set(s).size < MIN_DISTINCT) return 'too repetitive';
  return null;
}

function secretError(name, why, mode) {
  return Object.assign(new Error(`${name} is ${why}. The server will not start with NODE_ENV=${mode} until it is set to a random value of at least ${MIN_LENGTH} characters.`), { code: 'secret_required', variable: name });
}

// Hardened modes only: every secret the running server needs must be acceptable before it listens. Throws on the first problem; returns the list of
// variables checked otherwise. Other modes are left alone (JWT_SECRET missing there already fails when a token is first needed).
function assertHardenedSecrets(env = process.env, names = ['SESSION_SECRET', 'JWT_SECRET']) {
  if (!hardened(env)) return [];
  const mode = String(env.NODE_ENV).trim().toLowerCase();
  for (const name of names) {
    const why = weaknessOf(env[name]);
    if (why) throw secretError(name, why, mode);
  }
  return names;
}

// The secret the session middleware signs cookies with. Never a constant: configured, or (outside hardened modes) random for this process.
function resolveSessionSecret(env = process.env, { randomBytes = crypto.randomBytes, warn = (m) => console.warn(m) } = {}) {
  const why = weaknessOf(env?.SESSION_SECRET);
  if (!why) return { secret: String(env.SESSION_SECRET).trim(), source: 'configured' };
  if (hardened(env)) throw secretError('SESSION_SECRET', why, String(env.NODE_ENV).trim().toLowerCase());
  warn(`SESSION: SESSION_SECRET is ${why}; using a random secret for this process only. Sessions end when the server restarts. Set SESSION_SECRET in server/.env to keep them stable.`);
  return { secret: randomBytes(32).toString('hex'), source: 'ephemeral' };
}

module.exports = { isStrongSecret, weaknessOf, resolveSessionSecret, assertHardenedSecrets, hardened, MIN_LENGTH, MIN_DISTINCT, KNOWN_PUBLIC };
