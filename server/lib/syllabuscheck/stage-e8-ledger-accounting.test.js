'use strict';
// The E.8 Stage C ledger: frozen snapshots, the live file and each run's recorded usage. Read-only: nothing here writes, resets or closes a ledger.
// The live ledger may grow with later authorized runs, so it is checked by invariants and prefixes, never by its current totals.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { round } = require('./eval/providerGuard');
const { replay } = require('../../../scripts/replay-stage-e8-resources.cjs');
const docs = path.join(__dirname, '../../../docs');
const read = file => JSON.parse(fs.readFileSync(path.join(docs, file), 'utf8'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(docs, file))).digest('hex');
const LIVE = 'ai-eval-stage-e8-c-ledger.json';
// Byte snapshots, oldest first, each taken before the run that followed it: [file, requests, charged].
const SNAPSHOTS = [
  ['ai-eval-stage-e8-c-ledger-before-r8.json', 7, 0.00294347],
  ['ai-eval-stage-e8-c-ledger-before-remaining.json', 13, 0.00583426],
  ['ai-eval-stage-e8-c-ledger-before-resource-regression.json', 16, 0.00669119],
  ['ai-eval-stage-e8-c-ledger-before-resource-recovery.json', 19, 0.00733556],
  ['ai-eval-stage-e8-c-ledger-before-heldout.json', 25, 0.0095186],
];
// Every run on this ledger, in order. Its usage records the cumulative count and charge after the run.
const RUNS = ['canary', 'canary-resume', 'r8-regression', 'r8-remaining', 'resource-regression', 'resource-recovery', 'heldout'];
const sum = (entries, key) => round(entries.reduce((total, e) => total + (e[key] || 0), 0));
const near = (a, b) => Math.abs(a - b) < 1e-7;
function consistent(ledger, name) {
  assert.equal(ledger.requests, ledger.entries.length, `${name}: one entry per counted request`);
  ledger.entries.forEach((e, i) => assert.equal(e.n, i + 1, `${name}: contiguous numbering`));
  for (const e of ledger.entries) {
    assert.ok(['key-check', 'price-lookup', 'model'].includes(e.kind), `${name} n${e.n}: kind`);
    if (e.kind !== 'model') assert.equal(e.charged, undefined, `${name} n${e.n}: only a model request is charged`);
  }
  assert.ok(near(sum(ledger.entries, 'charged'), ledger.charged), `${name}: charged is the sum of its entries`);
  assert.ok(near(sum(ledger.entries, 'conservativeCharge'), ledger.conservative), `${name}: the conservative total is the sum of its entries`);
  assert.ok(ledger.transient >= ledger.entries.filter(e => e.error || e.status === 429 || e.status >= 500).length, `${name}: transient counter`);
}

test('E.8 ledger: every frozen snapshot and the live ledger are internally consistent', () => {
  for (const [file, requests, charged] of SNAPSHOTS) {
    const ledger = read(file);
    consistent(ledger, file);
    assert.deepEqual([ledger.requests, ledger.charged], [requests, charged], file);
  }
  consistent(read(LIVE), 'live ledger');
});

test('E.8 ledger: history is only appended: each snapshot is an unchanged prefix of the next and of the live ledger', () => {
  const chain = [...SNAPSHOTS.map(([file]) => read(file)), read(LIVE)];
  for (let i = 1; i < chain.length; i++) {
    assert.ok(chain[i].requests >= chain[i - 1].requests);
    assert.deepEqual(chain[i].entries.slice(0, chain[i - 1].entries.length), chain[i - 1].entries, `${SNAPSHOTS[i - 1][0]} is a prefix`);
  }
});

test('E.8 ledger: each run\'s recorded usage equals what it appended, and the cumulative totals are the prefix sums', () => {
  const live = read(LIVE);
  let previous = 0;
  for (const name of RUNS) {
    const { usage, requests = [] } = read(`ai-eval-stage-e8-c-${name}.json`), window = live.entries.slice(previous, usage.requests), prefix = live.entries.slice(0, usage.requests);
    assert.equal(usage.thisRun, window.length, `${name}: requests this run`);
    assert.deepEqual([usage.keyChecks, usage.priceLookups, usage.model], ['key-check', 'price-lookup', 'model'].map(kind => window.filter(e => e.kind === kind).length), name);
    assert.ok(near(usage.charged, sum(prefix, 'charged')), `${name}: cumulative charge`);
    assert.ok(near(usage.accounting.chargedConservatively, sum(prefix, 'conservativeCharge')), `${name}: cumulative conservative charge`);
    assert.ok(window.every(e => e.kind !== 'model' || e.accounting === 'reconciled') && near(usage.reportedCost, sum(window, 'charged')), `${name}: every model request reconciled at its reported cost`);
    for (const r of requests) {
      const entry = window.find(e => e.n === r.n);
      assert.ok(entry && entry.kind === 'model', `${name}: request ${r.n} belongs to this run`);
      assert.deepEqual(entry.ids, r.ids, `${name}: request ${r.n} asked about the same relationships`);
    }
    previous = usage.requests;
  }
  assert.equal(previous, 32);
  assert.ok(live.requests >= previous, 'a later authorized run may only append');
});

test('E.8 ledger: the resource replay reads the frozen post-r8 snapshot, byte-identical to the ledger its saved artifact recorded', () => {
  const before = sha(LIVE), artifact = read('ai-eval-stage-e8-c-resource-replay.json'), replayed = replay(), file = 'docs/ai-eval-stage-e8-c-ledger-before-resource-regression.json';
  assert.equal(replayed.historicalLedger.file, file);
  assert.equal(replayed.inputs[file], artifact.inputs['docs/ai-eval-stage-e8-c-ledger.json'], 'the same bytes as the ledger the first replay read');
  assert.deepEqual([replayed.historicalLedger.requests, replayed.historicalLedger.charged], [artifact.historicalLedger.requests, artifact.historicalLedger.charged]);
  assert.ok(!(`docs/${LIVE}` in replayed.inputs), 'the live ledger is not a replay input');
  assert.equal(replayed.summary.providerRequests, 0);
  assert.equal(sha(LIVE), before, 'the replay did not touch the live ledger');
});
