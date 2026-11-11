'use strict';
// Daily ceilings on the AI requests a person can cause (docs/security/SECURITY-AUDIT-REPORT.md SEC-11). Every AI check and every "Check & improve" of a
// recommendation is a paid provider request. The per-minute limiters already in routes/compliance.js and routes/syllabusCheck.js stop a button from being
// hammered, but not a person who keeps going all day. These count per calendar day in the Philippines (Asia/Manila, UTC+8, no daylight saving):
//
//   AI_CHECKS_PER_USER_PER_DAY    AI checks (POST /api/syllabi/:id/compliance/recheck with AI checking on) by one person. Default 40. 1 to 10000.
//   AI_CHECKS_PER_DAY             AI checks by everyone together. Default 400. 1 to 100000, and never below one person's share.
//   AI_REFINES_PER_USER_PER_DAY   "Check & improve" requests by one person. Default 60. 1 to 10000.
//
// They cannot be turned off: 0, "off" or a value out of range stops the server at startup (index.js), naming the setting. A request refused here is answered
// 429 with Retry-After until midnight and is never sent to the provider. The per-check cost budget (lib/syllabuscheck/gemini.js) still bounds each request.
// The counts live in this process's memory: a restart starts the day's count again, and several server processes each keep their own.
const SETTINGS = Object.freeze({
  checksPerUser: { name: 'AI_CHECKS_PER_USER_PER_DAY', fallback: 40, min: 1, max: 10000 },
  checksTotal: { name: 'AI_CHECKS_PER_DAY', fallback: 400, min: 1, max: 100000 },
  refinesPerUser: { name: 'AI_REFINES_PER_USER_PER_DAY', fallback: 60, min: 1, max: 10000 },
});
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const fail = (message) => Object.assign(new Error(message), { code: 'ai_quota_invalid' });

function read(env, { name, fallback, min, max }) {
  const raw = String(env?.[name] ?? '').trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) throw fail(`${name} must be a whole number from ${min} to ${max} (the default is ${fallback}). AI request ceilings cannot be turned off.`);
  return Number(raw);
}

// -> { checksPerUser, checksTotal, refinesPerUser }. Throws an ai_quota_invalid error naming the setting.
function resolveAiQuota(env = process.env) {
  const out = { checksPerUser: read(env, SETTINGS.checksPerUser), checksTotal: read(env, SETTINGS.checksTotal), refinesPerUser: read(env, SETTINGS.refinesPerUser) };
  if (out.checksTotal < out.checksPerUser) throw fail(`AI_CHECKS_PER_DAY (${out.checksTotal}) must not be lower than AI_CHECKS_PER_USER_PER_DAY (${out.checksPerUser}).`);
  return out;
}

// take(kind, userId) -> { ok: true } | { ok: false, reason: 'user' | 'total', retryAfterSec }. kind: 'check' | 'refine'.
function createAiQuota(limits, { now = Date.now } = {}) {
  let today = null;
  let counts = new Map(); // 'check:7' | 'refine:7' | 'check:*' -> count, for today only
  const roll = () => {
    const t = now(), day = Math.floor((t + MANILA_OFFSET_MS) / DAY_MS);
    if (day !== today) { today = day; counts = new Map(); }
    return Math.max(1, Math.ceil(((day + 1) * DAY_MS - MANILA_OFFSET_MS - t) / 1000));
  };
  const get = (key) => counts.get(key) || 0;
  return {
    take(kind, userId) {
      const retryAfterSec = roll();
      const userKey = kind + ':' + userId;
      const userMax = kind === 'refine' ? limits.refinesPerUser : limits.checksPerUser;
      if (kind === 'check' && get('check:*') >= limits.checksTotal) return { ok: false, reason: 'total', retryAfterSec };
      if (get(userKey) >= userMax) return { ok: false, reason: 'user', retryAfterSec };
      counts.set(userKey, get(userKey) + 1);
      if (kind === 'check') counts.set('check:*', get('check:*') + 1);
      return { ok: true };
    },
    // A request that was counted but never reached the provider (refused or failed before it) is handed back.
    give(kind, userId) {
      roll();
      const userKey = kind + ':' + userId;
      if (get(userKey) > 0) counts.set(userKey, get(userKey) - 1);
      if (kind === 'check' && get('check:*') > 0) counts.set('check:*', get('check:*') - 1);
    },
    reset() { today = null; counts = new Map(); },
    size() { return [...counts.keys()].filter((k) => !k.endsWith(':*')).length; },
  };
}

// The server's one quota, built from the environment when first used (index.js validates the settings before it listens).
let shared = null;
const aiQuota = () => (shared ||= createAiQuota(resolveAiQuota(process.env)));
const setAiQuota = (quota) => { shared = quota; }; // tests put a small one here

const MESSAGES = {
  user: 'You have reached today\'s limit of AI requests. It starts again at midnight. You can still edit and save your syllabus.',
  total: 'The system has reached today\'s limit of AI requests. It starts again at midnight. Ask the administrator if this is urgent.',
};

module.exports = { resolveAiQuota, createAiQuota, aiQuota, setAiQuota, SETTINGS, MESSAGES };
