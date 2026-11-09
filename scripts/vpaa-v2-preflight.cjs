'use strict';
// READ-ONLY readiness check for an AUTHORIZED Policy V2 staging test (docs/vpaa-conformance/POLICY-V2-ACTIVATION.md).
//   node scripts/vpaa-v2-preflight.cjs                        checks the current process environment
//   node scripts/vpaa-v2-preflight.cjs --env-file path/.env   checks a .env file (parsed only: nothing is loaded into the process or changed)
// It prints which settings are present and valid, NEVER a secret or key value, makes no network or model request, and exits 0 only when every REQUIRED
// item is satisfied. A non-zero exit on the production .env is the expected, correct answer: Policy V2 is off there on purpose.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dotenv = require(path.join(root, 'server/node_modules/dotenv'));
const { providerConfig } = require(path.join(root, 'server/lib/syllabuscheck/gemini'));
const v2 = require(path.join(root, 'server/lib/syllabuscheck/academicV2Activation'));
const { signingSecret } = require(path.join(root, 'server/lib/syllabuscheck/refine'));
const { isStrongSecret } = require(path.join(root, 'server/lib/sessionSecret'));
const { aiGate } = require(path.join(root, 'server/lib/syllabuscheck/policy'));
const { resolveHostConfig } = require(path.join(root, 'server/lib/hostConfig'));

const argIndex = process.argv.indexOf('--env-file');
const file = argIndex > 0 ? path.resolve(process.argv[argIndex + 1] || '') : null;
if (argIndex > 0 && (!file || !fs.existsSync(file))) { console.error('env file not found'); process.exit(2); }
const text = file ? fs.readFileSync(file, 'utf8') : '';
const env = file ? dotenv.parse(text) : process.env;
const occurrences = (key) => (text.match(new RegExp('^\\s*' + key + '\\s*=', 'gm')) || []).length;
const num = (v) => { const n = Number.parseFloat(v); return Number.isFinite(n) ? n : null; };

const provider = providerConfig(env);
const rows = [];
const add = (level, ok, name, detail) => rows.push({ level, ok, name, detail });
// The server resolves the checking profile before it reads any flag (server/lib/compliance/service.js), so the flag is judged as the server will see it: the comprehensive profile turns Policy V2 on itself.
const resolvedEnv = require(path.join(root, 'server/lib/syllabuscheck/checkingProfile')).resolve(env);
add('required', v2.enabled(resolvedEnv), 'SYLLABUS_CHECK_ACADEMIC_V2 = on (directly, or through SYLLABUS_CHECK_PROFILE=comprehensive-testing)', v2.enabled(resolvedEnv) ? (v2.enabled(env) ? 'on' : 'on, switched on by SYLLABUS_CHECK_PROFILE') : `currently "${String(env.SYLLABUS_CHECK_ACADEMIC_V2 ?? '(unset)')}": Policy V2 is OFF (the production-safe default)`);
add('required', provider.provider === 'anthropic', 'SYLLABUS_CHECK_AI_PROVIDER = anthropic', `provider resolves to "${provider.provider || 'none'}"`);
add('required', !!(env.ANTHROPIC_API_KEY && String(env.ANTHROPIC_API_KEY).trim()), 'ANTHROPIC_API_KEY present', env.ANTHROPIC_API_KEY ? 'present (value not shown)' : 'missing');
add('required', provider.provider === 'anthropic' && !!provider.model, 'ANTHROPIC_MODEL is a verified Claude model', `model "${provider.model || '(none)'}"`);
add('required', provider.configured === true && provider.approved === true, 'SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL equals ANTHROPIC_MODEL, and the provider is configured', `configured=${provider.configured} approved=${provider.approved}`);
add('required', !!signingSecret(env.SESSION_SECRET), 'SESSION_SECRET configured (at least 16 characters, not the retired public constant)', signingSecret(env.SESSION_SECRET) ? 'valid (value not shown)' : 'missing or too short: Check & Improve and Policy V2 acceptance fail closed (503)');
add('required', isStrongSecret(env.JWT_SECRET), 'JWT_SECRET configured (login needs it; at least 16 varied characters, not a known default)', isStrongSecret(env.JWT_SECRET) ? 'valid (value not shown)' : 'missing or not acceptable');
add('required', aiGate(env) === 'advisory', 'SYLLABUS_CHECK_AI_GATE is advisory (the default)', `gate is "${aiGate(env)}"`);
// NODE_ENV=staging is what makes the server refuse to start with a missing or publicly known secret. A staging evaluation must never run as production.
const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
add('required', nodeEnv === 'staging', 'NODE_ENV = staging (a missing or known-default secret then stops the server instead of being replaced)', nodeEnv === 'production' ? 'NODE_ENV is "production": a staging evaluation must not run as production' : `NODE_ENV is "${env.NODE_ENV || '(unset)'}"`);
// The host layer (CORS origins, cookies, proxy trust) is validated by the same function the server runs at startup, in its hardened (staging) mode. Only counts and
// names are printed: an origin is a deployment fact, not a secret, but nothing here needs it echoed.
let host = null, hostError = null;
try { host = resolveHostConfig({ ...env, NODE_ENV: 'staging' }); } catch (e) { hostError = String(e && e.message || e).split(/\r?\n/)[0]; }
add('required', !!host, 'CORS_ALLOWED_ORIGINS, TRUST_PROXY and cookie settings are valid for staging (the server refuses to start otherwise)', host ? `${host.origins.length} frontend origin(s) (https), trust proxy ${JSON.stringify(host.trustProxy)}, cookies Secure=${host.cookie.secure} SameSite=${host.cookie.sameSite} HttpOnly=${host.cookie.httpOnly}` : hostError);
const maxRequests = num(env.SYLLABUS_CHECK_AI_MAX_REQUESTS), maxCost = num(env.SYLLABUS_CHECK_AI_MAX_COST_USD);
add('recommended', maxRequests !== null && maxRequests > 0 && maxRequests <= 200, 'SYLLABUS_CHECK_AI_MAX_REQUESTS set and at most 200 (default 512)', maxRequests === null ? 'unset: the default of 512 applies' : String(maxRequests));
// The in-app cost cap is a RESERVATION guard: before each request it reserves the input size plus the MAXIMUM output at the output price, and never releases it.
// A full Policy V2 check of the 18-week synthetic sample (20 requests) reserved about $4.5 at the default 16,000 output tokens (measured), far above what is really
// spent, so a smaller cap makes the check stop early and the report say it is incomplete (1.50 stops after 7 requests). The authoritative spending limit is the one set in the Anthropic workspace.
// The comprehensive profile reserves about $13.3 per check (measured offline, docs/checker-comprehensive/live/estimates.json), so its cap must be at least 17; Policy V2 alone about $4.6.
const comprehensive = String(env.SYLLABUS_CHECK_PROFILE || '').trim() === 'comprehensive-testing', needCost = comprehensive ? 17 : 5;
add('recommended', maxCost !== null && maxCost >= needCost, `SYLLABUS_CHECK_AI_MAX_COST_USD set to at least ${needCost}${comprehensive ? ' (the comprehensive profile reserves about 13.3 per check)' : '; 10 is documented'} (it is a reservation guard, not actual spend; a lower cap makes the check stop early and report incomplete)`, maxCost === null ? 'unset: no in-app cost cap (set the hard limit in the Anthropic workspace)' : maxCost < needCost ? `${maxCost} is below the reservation a full check needs (about 4.5 measured on the synthetic sample)` : String(maxCost));
if (file) for (const key of ['SYLLABUS_CHECK_AI_PROVIDER', 'SYLLABUS_CHECK_ACADEMIC_V2', 'ANTHROPIC_MODEL']) add('recommended', occurrences(key) <= 1, `${key} defined once`, `${occurrences(key)} definition(s); with more than one, the LAST wins silently`);
add('info', true, 'Stage B / Stage C3 flags', ['SYLLABUS_CHECK_STAGE_B', 'SYLLABUS_CHECK_STAGE_C3'].some((k) => String(env[k] || '').toLowerCase() === 'on') ? 'set to on: they are held off for a check while Policy V2 is on (no duplicate evaluation)' : 'unset (nothing to hold off)');
add('info', true, 'SYLLABUS_CHECK_CLO_DESCRIPTION', 'set to "off" automatically for the legacy run while Policy V2 is on; set it yourself only for a legacy-only configuration');

const mark = (r) => (r.ok ? 'PASS' : r.level === 'required' ? 'FAIL' : r.level === 'recommended' ? 'warn' : 'info');
for (const r of rows) console.log(`[${mark(r)}] ${r.name}${r.detail ? ' : ' + r.detail : ''}`);
const failed = rows.filter((r) => r.level === 'required' && !r.ok);
console.log('\n' + (failed.length ? `NOT READY for a Policy V2 staging test: ${failed.length} required item(s) missing.` : 'READY for an authorized Policy V2 staging test (every required item is satisfied).'));
console.log('This check is read-only: it changed nothing and sent no request.');
process.exitCode = failed.length ? 1 : 0;
