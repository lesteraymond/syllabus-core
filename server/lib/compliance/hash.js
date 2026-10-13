'use strict';
// A fingerprint of what the checks read, so a stored run can be reused when the content is the same and marked stale when it is
// not. The catalog snapshot (added at submit) and the sign-off are left out: they are not something the author edits, and they
// would make a draft look "changed" the moment it is submitted.
const crypto = require('crypto');

const IGNORED = new Set(['catalog', 'signoff']);

// JSON with object keys in sorted order, so key order never changes the hash.
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}

function contentHash(content, standardVersion) {
  const c = content && typeof content === 'object' && !Array.isArray(content) ? Object.fromEntries(Object.entries(content).filter(([k]) => !IGNORED.has(k))) : content;
  return crypto.createHash('sha256').update(String(standardVersion || '') + '\n' + canonical(c)).digest('hex');
}

module.exports = { contentHash, canonical };
