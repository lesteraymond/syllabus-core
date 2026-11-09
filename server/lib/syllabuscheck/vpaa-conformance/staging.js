'use strict';
// The documented staging environment, read from docs/vpaa-conformance/POLICY-V2-ACTIVATION.md (its first fenced block), so the document and what the tests
// verify cannot drift apart. Every `<...>` placeholder is replaced by a clearly fake stand-in; no real secret exists here and none is read from any .env file.
const fs = require('node:fs');
const path = require('node:path');

const DOC = path.resolve(__dirname, '../../../../docs/vpaa-conformance/POLICY-V2-ACTIVATION.md');
const STAND_IN = {
  ANTHROPIC_API_KEY: 'sk-ant-staging-stand-in-not-a-real-key-0123456789',
  SESSION_SECRET: 'staging-stand-in-session-secret-9f3a7c1e5b2d4086',
  JWT_SECRET: 'staging-stand-in-jwt-secret-1b8d6f4a2c0e7395',
  // not secrets, but deployment facts this project must never invent: stand-ins use the reserved .invalid name (RFC 2606), which can never exist
  CORS_ALLOWED_ORIGINS: 'https://app.staging.invalid',
  TRUST_PROXY: '1',
  SESSION_COOKIE_SAMESITE: 'lax',
};

function documentedStagingEnv(file = DOC) {
  const text = fs.readFileSync(file, 'utf8');
  const block = /```\r?\n([\s\S]*?)```/.exec(text);
  if (!block) throw new Error('the staging configuration block was not found in the document');
  const env = {};
  for (const line of block[1].split(/\r?\n/)) {
    const m = /^([A-Z][A-Z0-9_]*)=([^#]*?)\s*(?:#.*)?$/.exec(line.trim());
    if (!m) continue;
    env[m[1]] = /^<.*>$/.test(m[2].trim()) ? STAND_IN[m[1]] : m[2].trim();
    if (env[m[1]] === undefined) throw new Error(`the document has a placeholder for ${m[1]} that this test has no stand-in for`);
  }
  return env;
}

module.exports = { documentedStagingEnv, STAND_IN, DOC };
