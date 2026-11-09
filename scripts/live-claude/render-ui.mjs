// Phase 7 of the live-test plan, offline: show a stored run (from a dry run, or from an authorized real run's stored-run.json) exactly as the faculty AI Checker renders it, in
// English and Filipino, and check what the page says. No network, no database, no model, and no way to change a syllabus.
//   node scripts/live-claude/render-ui.mjs <path to stored-run.json> [--out <prefix>]
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'rolldown';

const root = path.resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const input = args[0] && !args[0].startsWith('--') ? path.resolve(args[0]) : null;
if (!input) { console.error('usage: node scripts/live-claude/render-ui.mjs <stored-run.json> [--out <prefix>]'); process.exit(2); }
const outIndex = args.indexOf('--out');
const out = outIndex >= 0 ? path.resolve(args[outIndex + 1]) : path.join(path.dirname(input), 'faculty-ui');
const bundle = path.join(root, 'scripts/live-claude/.render-ui.tmp.mjs');
try {
  await build({ input: path.join(root, 'scripts/live-claude/render-ui.entry.jsx'), platform: 'node', external: ['react-dom', 'react', 'react-dom/server', 'react/jsx-runtime', 'node:fs'], transform: { define: { 'import.meta.env': '{}' }, jsx: { runtime: 'automatic' } }, output: { file: bundle }, logLevel: 'silent' });
  const r = spawnSync(process.execPath, [bundle], { cwd: root, stdio: 'inherit', env: { ...process.env, LIVE_UI_RUN: input, LIVE_UI_OUT: out } });
  if (r.status !== 0) process.exit(r.status ?? 1);
  const text = JSON.parse(await fs.readFile(`${out}.text.json`, 'utf8'));
  const run = JSON.parse(await fs.readFile(input, 'utf8'));
  const en = text.en;
  const checks = [
    ['the official score and the 79 pass line are shown', run.overall == null || (en.includes(`${run.overall}%`) && /pass line 79%/.test(en))],
    ['the seven weekly relationships are listed', ['Content-course', 'Content-ILO', 'ILO-CLO', 'Content-activity', 'ILO-activity', 'Content-assessment', 'Activity-assessment'].every((t) => en.includes(':' + t))],
    ['the four CLO classifications are listed', [0, 1, 2, 3].every((i) => en.includes(`clo${i}-classification`))],
    ['the coverage summary is present', /Check coverage: \d+ of \d+ catalogue entries verified/.test(en)],
    ['the eleven reserved rules are never shown as supported', !/(STR-07|ADM-04|ADM-05|CUR-10|CLO-05|CLO-10|PLAN-05|PLAN-06|ALN-03|ALN-04|ALN-10) · Evaluated: supported/.test(en)],
    ['the advisory statement is shown (no score, deductions, passing mark or gate effect)', /no effect on the official score, deductions, passing mark or submission gate/.test(en)],
    ['Filipino renders the same panels without leaking translation keys', !/hybrid\.|academicV2\./.test(text.tl) && /Akademikong|Patakaran/.test(text.tl)],
  ].map(([name, ok]) => ({ name, ok: !!ok }));
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  console.log(`wrote ${path.relative(root, out)}.en.html, .tl.html, .text.json`);
  process.exitCode = checks.every((c) => c.ok) ? 0 : 1;
} finally { await fs.unlink(bundle).catch(() => {}); }
