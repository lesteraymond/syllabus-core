'use strict';
// READ-ONLY credential readiness report for a staging evaluation.
//   node scripts/credential-readiness.cjs                       inspects server/.env
//   node scripts/credential-readiness.cjs --env-file path/.env  inspects another file (parsed only; nothing is loaded into the process or changed)
//
// It prints variable NAMES, status words and the manual action each needs. It NEVER prints a value, a prefix, a suffix or an exact length (only a bucket),
// makes no network or model request, rotates nothing, and exits 0 only when no manual action is blocking. A non-zero exit on a development .env is the
// expected, correct answer: this tells you what to do BEFORE staging.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const dotenv = require(path.join(root, 'server/node_modules/dotenv'));
const { weaknessOf } = require(path.join(root, 'server/lib/sessionSecret'));

const argIndex = process.argv.indexOf('--env-file');
const file = path.resolve(argIndex > 0 ? process.argv[argIndex + 1] || '' : path.join(root, 'server/.env'));
if (!fs.existsSync(file)) { console.error('env file not found'); process.exit(2); }
const raw = fs.readFileSync(file, 'utf8');
const env = dotenv.parse(raw);

// kind: generated (we create it) | credential (issued by a provider) | database | identifier (not secret). exposure: what the project notes record.
const REGISTRY = [
  { name: 'SESSION_SECRET', kind: 'generated', needed: 'required', use: 'signs session cookies and recommendation verification tokens', staging: 'Generate a NEW random value for staging (32+ random characters). Never reuse the development value.' },
  { name: 'JWT_SECRET', kind: 'generated', needed: 'required', use: 'signs login tokens', staging: 'Generate a NEW random value for staging. Never reuse the development value.' },
  { name: 'DB_PASS', kind: 'database', needed: 'required', use: 'the staging database password', staging: 'Create a dedicated staging database user with its own password and least privilege. An empty password (local development) must never be used.' },
  { name: 'ANTHROPIC_API_KEY', kind: 'credential', format: /^sk-ant-/, needed: 'required', use: 'Claude requests for Policy V2', staging: 'Create a SEPARATE staging key in its own Anthropic workspace with a hard monthly spend limit. Do not reuse the development key.' },
  { name: 'SMTP_PASS', kind: 'credential', needed: 'optional', exposure: 'pasted into a chat (project notes)', use: 'sending password emails', staging: 'Revoke the Gmail app password and create a new one, or leave mail unconfigured in staging.' },
  { name: 'OPENROUTER_API_KEY', kind: 'credential', format: /^sk-or-/, needed: 'unused-by-v2', use: 'the OpenRouter provider, not used while the provider is anthropic', staging: 'Do not put it in the staging environment (least privilege). Revoke it if it was ever shared.' },
  { name: 'GEMINI_API_KEY', kind: 'credential', needed: 'unused-by-v2', exposure: 'pasted into a chat (project notes)', use: 'the Gemini provider, not used', staging: 'Revoke it, and delete the commented-out line that still holds it.' },
];
const IDENTIFIERS = ['GOOGLE_CLIENT_ID', 'VITE_GOOGLE_CLIENT_ID', 'DB_HOST', 'DB_NAME', 'SMTP_HOST', 'SMTP_USER', 'MAIL_FROM'];

const bucket = (v) => (v.length < 16 ? 'under 16' : v.length < 32 ? '16 to 31' : '32 or more');
const digest = (v) => crypto.createHash('sha256').update(v).digest('hex');
const defs = (name) => (raw.match(new RegExp('^\\s*' + name + '\\s*=', 'gm')) || []).length;
const commented = (name) => new RegExp('^\\s*#\\s*' + name + '\\s*=\\s*\\S', 'm').test(raw);
const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });

const seen = new Map();
for (const r of REGISTRY) { const v = String(env[r.name] ?? '').trim(); if (v) seen.set(digest(v), [...(seen.get(digest(v)) || []), r.name]); }

const rows = [];
for (const r of REGISTRY) {
  const v = String(env[r.name] ?? '').trim(), present = v.length > 0, problems = [];
  if (!present && r.needed === 'required' && r.name !== 'DB_PASS') problems.push('MISSING');
  if (present && (r.kind === 'generated') && weaknessOf(v)) problems.push('WEAK: ' + weaknessOf(v));
  if (!present && r.name === 'DB_PASS') problems.push('EMPTY: an empty database password');
  if (present && r.format && !r.format.test(v)) problems.push('unexpected key format');
  if (present && (seen.get(digest(v)) || []).length > 1) problems.push('SAME VALUE reused in ' + seen.get(digest(v)).filter((n) => n !== r.name).join(', '));
  if (defs(r.name) > 1) problems.push(defs(r.name) + ' definitions (the last silently wins)');
  if (commented(r.name)) problems.push('a COMMENTED-OUT line still holds a value');
  if (r.exposure && (present || commented(r.name))) problems.push('EXPOSED: ' + r.exposure);
  if (present && r.needed === 'unused-by-v2') problems.push('present but not needed');
  const blocking = problems.some((p) => /^(MISSING|WEAK|EMPTY|SAME VALUE|EXPOSED|unexpected key format|a COMMENTED)/.test(p));
  rows.push({ ...r, present, bucket: present ? bucket(v) : '-', problems, blocking });
}
// secret-like variables the registry does not know about
const unknownSecrets = Object.keys(env).filter((k) => /(SECRET|KEY|PASS|TOKEN)/i.test(k) && !REGISTRY.some((r) => r.name === k) && !IDENTIFIERS.includes(k));

const files = [['server/.env', 'server/.env'], ['.env', '.env']].filter(([, f]) => fs.existsSync(path.join(root, f)));
const hygiene = files.map(([label, f]) => ({ label, tracked: git(['ls-files', '--error-unmatch', f]).status === 0, ignored: git(['check-ignore', '-q', f]).status === 0 }));
const PATTERN = 'sk-ant-[A-Za-z0-9_-]{30,}|sk-or-v1-[A-Za-z0-9]{30,}|AIza[0-9A-Za-z_-]{35}|ghp_[A-Za-z0-9]{36}';
const tracked = git(['grep', '-IoE', PATTERN, 'HEAD']);
const PLACEHOLDER = /not-a-real-key|placeholder|test-only|unit-test|offline-replay|example|fake|dummy|xxxx/i;
const realLooking = (tracked.stdout || '').split(/\r?\n/).filter(Boolean).filter((l) => !PLACEHOLDER.test(l)).map((l) => l.split(':').slice(1, 2).join(''));

console.log(`Credential readiness for a staging evaluation, from: ${path.relative(root, file) || file}`);
console.log('(names, statuses and actions only: no value, prefix, suffix or exact length is ever printed)\n');
for (const r of rows) {
  console.log(`${(r.blocking ? '[ACTION]' : r.problems.length ? '[note]  ' : '[ok]    ')} ${r.name.padEnd(20)} ${r.present ? 'present, ' + r.bucket : 'not set'}  (${r.needed}; ${r.use})`);
  for (const p of r.problems) console.log(`           - ${p}`);
  if (r.blocking || r.kind !== 'identifier') console.log(`           > staging: ${r.staging}`);
}
console.log('\nNot secrets (identifiers): ' + IDENTIFIERS.filter((k) => env[k]).join(', '));
if (env.DB_USER && String(env.DB_USER).toLowerCase() === 'root') console.log('[note]   DB_USER is the administrative account: staging should use a least-privilege database user.');
if (unknownSecrets.length) console.log('[note]   secret-like variables this report does not know: ' + unknownSecrets.join(', '));
console.log('\nRepository hygiene:');
for (const f of hygiene) console.log(`  ${f.ignored && !f.tracked ? '[ok]    ' : '[ACTION]'} ${f.label}: ${f.tracked ? 'TRACKED by git' : 'not tracked'}, ${f.ignored ? 'ignored by git' : 'NOT ignored by git'}`);
console.log(`  ${realLooking.length ? '[ACTION]' : '[ok]    '} real-looking provider keys in the committed tree (test placeholders excluded): ${realLooking.length}${realLooking.length ? ' in ' + [...new Set(realLooking)].join(', ') : ''}`);

const actions = rows.filter((r) => r.blocking).length + hygiene.filter((f) => f.tracked || !f.ignored).length + (realLooking.length ? 1 : 0);
console.log(`\n${actions ? `${actions} MANUAL ACTION(S) are needed before a staging evaluation. Nothing was rotated, changed or sent.` : 'No blocking credential action found in this file. Staging still needs its OWN values for every secret above.'}`);
process.exitCode = actions ? 1 : 0;
