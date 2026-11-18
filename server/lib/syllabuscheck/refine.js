'use strict';
// Shared helpers of "Check & improve" and of recording a decision on a draft (routes/syllabusCheck.js): field paths, the related-context hash and the signed
// verification token. The rewriting itself is the new AI Checker's (pipeline/refine.js); the old checker's Check & improve (its own judge, rewrite prompt and
// model client) was removed with the old AI Checker.
const crypto = require('crypto');
const { extract } = require('./pipeline/extract');
const { questionsOf } = require('./pipeline/judge');
const { keyOfPath } = require('./pipeline/official');

// Only the fields an AI rewrite can target, and only as text.
const FIELD = /^(?:clos\[\d+\]\.statement|plan\[\d+\]\.(?:values|contents|activities|tasks)|plan\[\d+\]\.ilos\[\d+\]\.text)$/;

const segments = (path) => path.replace(/\[(\d+)\]/g, '.$1').split('.');
function getValue(content, path) { return segments(path).reduce((value, key) => (value === undefined || value === null ? undefined : value[key]), content); }
function setValue(content, path, value) {
  const copy = structuredClone(content);
  const parts = segments(path);
  const last = parts.pop();
  const parent = parts.reduce((node, key) => (node === undefined || node === null ? undefined : node[key]), copy);
  if (parent === undefined || parent === null) throw Object.assign(new Error('The field does not exist in this syllabus.'), { status: 409 });
  parent[last] = value;
  return copy;
}

// What a draft was checked against: for every question of the new AI Checker that involves the field, the texts on its other sides. A verification token
// carries this hash, so a draft is not recorded as accepted after a related field changed (the decision route compares it with the saved syllabus).
function relatedContextHash(content, masters, path) {
  if (!content || !path) return '';
  try {
    const key = keyOfPath(content, path);
    if (!key) return '';
    const related = [];
    for (const q of questionsOf(extract(content, masters || {}))) {
      const sides = [q.from, ...(q.to || [])];
      if (!sides.some(side => side && side.key === key) && !(q.parents || []).includes(key)) continue;
      related.push({ id: q.id, otherSides: sides.filter(side => side && side.key !== key).map(side => String(side.text || '').trim()) });
    }
    related.sort((a, b) => a.id.localeCompare(b.id));
    return crypto.createHash('sha256').update(JSON.stringify(related)).digest('hex');
  } catch {
    return '';
  }
}

// The signing secret of a Check & Improve token (DEF-04). Only a configured SESSION_SECRET of at least 16 characters counts: there is no built-in fallback,
// and the constant this file used to fall back to is public, so it is refused even when supplied. Without a secret nothing is signed or accepted.
const { isStrongSecret } = require('../sessionSecret'); // one rule for every signing secret: at least 16 varied characters, not a publicly known default
// (the former built-in constant is in that list of publicly known defaults, so it is refused even when supplied)
const SECRET_MESSAGE = 'Verification signing is not configured on this server: set SESSION_SECRET (at least 16 characters). Check & Improve is unavailable until it is.';
function signingSecret(secret = process.env.SESSION_SECRET) {
  const value = String(secret ?? '').trim();
  return isStrongSecret(value) ? value : null;
}
function createVerificationToken({ runId, suggestionId, syllabusId, path, originalValue, replacement, contextHash, ttlMs = 15 * 60 * 1000 }, secret) {
  const now = Date.now();
  const payload = {
    runId: Number(runId),
    suggestionId: String(suggestionId),
    syllabusId: Number(syllabusId),
    path: String(path),
    originalValue: String(originalValue ?? ''),
    replacement: String(replacement ?? '').trim(),
    contextHash: String(contextHash ?? ''),
    issuedAt: now,
    expiresAt: now + ttlMs
  };
  const key = signingSecret(secret);
  if (!key) throw Object.assign(Error(SECRET_MESSAGE), { status: 503, code: 'verification_secret_not_configured' });
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(JSON.stringify(payload));
  const sig = hmac.digest('hex');
  return Buffer.from(JSON.stringify({ payload, sig })).toString('base64url');
}

function verifyVerificationToken(token, expected = {}, secret) {
  if (!token || typeof token !== 'string') return { valid: false, reason: 'missing_token' };
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const { payload, sig } = JSON.parse(raw);
    const key = signingSecret(secret);
    if (!key) return { valid: false, reason: 'secret_not_configured' };
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(JSON.stringify(payload));
    const expectedSig = hmac.digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      return { valid: false, reason: 'invalid_signature' };
    }

    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return { valid: false, reason: 'expired', sig, payload };
    }
    if (expected.runId !== undefined && Number(payload.runId) !== Number(expected.runId)) {
      return { valid: false, reason: 'run_mismatch', sig, payload };
    }
    if (expected.suggestionId !== undefined && String(payload.suggestionId) !== String(expected.suggestionId)) {
      return { valid: false, reason: 'suggestion_mismatch', sig, payload };
    }
    if (expected.syllabusId !== undefined && Number(payload.syllabusId) !== Number(expected.syllabusId)) {
      return { valid: false, reason: 'syllabus_mismatch', sig, payload };
    }
    if (expected.path !== undefined && String(payload.path) !== String(expected.path)) {
      return { valid: false, reason: 'path_mismatch', sig, payload };
    }
    if (expected.originalValue !== undefined && String(payload.originalValue) !== String(expected.originalValue ?? '')) {
      return { valid: false, reason: 'original_value_mismatch', sig, payload };
    }
    if (expected.replacement !== undefined && String(payload.replacement).trim() !== String(expected.replacement ?? '').trim()) {
      return { valid: false, reason: 'replacement_mismatch', sig, payload };
    }
    if (expected.contextHash !== undefined && String(payload.contextHash || '') !== String(expected.contextHash)) {
      return { valid: false, reason: 'context_drift', sig, payload };
    }
    return { valid: true, payload, sig };
  } catch {
    return { valid: false, reason: 'malformed_token' };
  }
}

module.exports = { getValue, setValue, FIELD, createVerificationToken, verifyVerificationToken, relatedContextHash, signingSecret, SECRET_MESSAGE };
