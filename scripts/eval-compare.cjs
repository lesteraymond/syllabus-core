#!/usr/bin/env node
'use strict';
// Compares prompt variants on the SAME labelled examples, side by side, using scripts/eval-alignment.cjs for every run.
//
//   node scripts/eval-compare.cjs --confirm-paid [--variants current,calibrated,rubric,rubric-ordered] [--runs 3] [--dataset alignment] [--split dev]
//                                 [--budget N] [--max-cost D] [--max-invalid N] [--max-transient N] [--ledger <file>]
//
// Every variant run is PAID and goes through the provider guard of scripts/eval-alignment.cjs, which gets the limits given here. With --ledger they are
// shared by every variant, so --budget and --max-cost hold for the whole comparison; without it each variant run has its own. Once a run stops (a cap,
// HTTP 401/402/403, too many errors) no further variant is started.
//
// Use it on the development split. Look at the held-out split ONLY for the one variant you have already decided on (and for `current`, as the
// reference), once: every held-out run is logged in docs/ai-eval-heldout-log.jsonl. A variant is worth adopting only if it helps the clear
// cases without hurting the others, by relationship type, and the difference is larger than the run-to-run variation shown here.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback; };
const variants = flag('variants', 'current,calibrated,rubric,rubric-ordered').split(',');
const runs = flag('runs', '3'), dataset = flag('dataset', 'alignment'), split = flag('split', 'dev');
if (!args.includes('--confirm-paid')) { console.error('Every variant run makes PAID provider calls. Add --confirm-paid to confirm, after approval.'); process.exit(2); }
const limits = ['budget', 'max-cost', 'max-invalid', 'max-transient', 'ledger'].flatMap((name) => (flag(name, null) === null ? [] : ['--' + name, flag(name, null)]));
const harness = path.join(__dirname, 'eval-alignment.cjs');
const results = {};
let partial = null;
for (const variant of variants) {
  const out = path.join(os.tmpdir(), `eval-${variant}-${Date.now()}.json`);
  console.log(`\n=== ${variant} ===`);
  let stopped = null;
  try {
    execFileSync(process.execPath, [harness, '--confirm-paid', ...limits, '--dataset', dataset, '--split', split, '--variant', variant, '--runs', runs, '--out', out], { stdio: ['ignore', 'inherit', 'inherit'] });
    const result = JSON.parse(fs.readFileSync(out, 'utf8'));
    stopped = result.stopped || null;
    if (result.agreement !== undefined) results[variant] = result; // a run stopped before its first question has nothing to compare
  } catch (error) { console.error(`${variant}: the run failed (${error.message.split('\n')[0]})`); }
  finally { try { fs.unlinkSync(out); } catch { /* nothing to remove */ } }
  if (stopped) { partial = `${variant} stopped (${stopped})`; console.error(`${partial}: no further variant is run.`); break; }
}
const pct = (v) => (v === null || v === undefined ? 'n/a' : (v * 100).toFixed(1) + '%');
const names = Object.keys(results);
if (!names.length) process.exit(1);
console.log('\n=== side by side (' + dataset + ', ' + split + ', ' + runs + ' runs each; UNREVIEWED labels) ===');
if (partial) console.log(`PARTIAL: ${partial}, so its numbers cover only what completed and the variants after it were not run.`);
const rows = {
  'agreement': (r) => pct(r.agreement), 'false approvals': (r) => pct(r.falseNegativeRate), 'false rejections': (r) => pct(r.falsePositiveRate),
  'partial accuracy': (r) => pct(r.partialAccuracy), 'never verified': (r) => pct(r.invalidRate), 'retry rate': (r) => pct(r.retries.retryRate), 'repeatability': (r) => pct(r.stability),
};
for (const type of ['CLO-PO', 'CLO-EGA', 'ILO-CLO', 'CLO-anyPO', 'CLO-anyEGA']) rows['  ' + type] = (r) => pct(r.byType[type] && r.byType[type].agreement);
console.table(Object.fromEntries(Object.entries(rows).map(([label, fn]) => [label, Object.fromEntries(names.map((n) => [n, fn(results[n])]))])));
