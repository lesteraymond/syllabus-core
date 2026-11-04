'use strict';
// The bounded corrective retry after an empty answer, on temporary COPIES of ledgers. The injected fetch is never called and no real ledger is
// touched. Guard semantics only: nothing here changes a limit, the provider routing, the schema or the prompt.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createGuard } = require('./eval/providerGuard');
const docs = path.join(__dirname, '../../../docs');
const LIVE = path.join(docs, 'ai-eval-stage-e8-c-ledger.json');
const SNAPSHOT = path.join(docs, 'ai-eval-stage-e8-c-ledger-before-resource-recovery.json');
const HELDOUT_SNAPSHOT = path.join(docs, 'ai-eval-stage-e8-c-ledger-before-heldout.json');
const dataset = require('./eval/stage-c-dataset.json');
const recovery = require('../../../docs/ai-eval-stage-e8-c-resource-recovery.json');
const heldout = require('../../../docs/ai-eval-stage-e8-c-heldout.json');
const EMPTY = 'empty_answer: AI omitted alignment judgements';
// answers: 'empty', or the number of relationships an answer verified, noted after each answer as eval-alignment.cjs does.
function simulate({ maxInvalid, maxUnproductive, answers, ledger = null, source = SNAPSHOT, maxRequests = 27, maxCost = 0.03733556, warnInvalid = 2 }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e8-retry-')), copy = path.join(dir, 'ledger.json');
  try {
    if (ledger) fs.writeFileSync(copy, JSON.stringify(ledger)); else fs.copyFileSync(source, copy);
    const guard = createGuard({ fetch: () => assert.fail('no request is sent'), maxRequests, maxCost, maxInvalid, maxUnproductive, warnInvalid, ledgerFile: copy });
    const carried = { invalid: guard.state.invalid, unproductive: guard.state.unproductive }, received = [];
    for (const answer of answers) {
      if (guard.stopped()) break; // the next request is refused locally
      guard.noteAnswer(answer === 'empty' ? { verified: 0, invalid: EMPTY } : { verified: answer });
      received.push(answer);
    }
    return { carried, received, stopped: guard.stopped(), invalid: guard.state.invalid, unproductive: guard.state.unproductive, warnings: guard.state.warnings.length };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('E.8 retry budget: the recovery started from carried counters, so 2/2 would have refused the corrective retry', () => {
  const run = simulate({ maxInvalid: 2, maxUnproductive: 2, answers: ['empty', 4] });
  assert.deepEqual(run.carried, { invalid: 1, unproductive: 1 });
  assert.deepEqual(run.received, ['empty']);
  assert.match(run.stopped, /^2 answer\(s\) failed validation/);
});

test('E.8 retry budget: 3/3 allowed exactly the one corrective retry, and reproduces the counters the recovery recorded', () => {
  const run = simulate({ maxInvalid: 3, maxUnproductive: 3, answers: ['empty', 4, 1, 1] });
  assert.deepEqual(run.received, ['empty', 4, 1, 1]); assert.equal(run.stopped, null); assert.equal(run.warnings, 1);
  assert.deepEqual([run.invalid, run.unproductive], [recovery.usage.invalidAnswers, recovery.usage.unproductiveInARow]);
  const twice = simulate({ maxInvalid: 3, maxUnproductive: 3, answers: ['empty', 'empty', 4] });
  assert.deepEqual(twice.received, ['empty', 'empty'], 'a second empty answer stops the run: the retry stays bounded');
  assert.ok(twice.stopped);
});

test('E.8 retry budget: one corrective retry needs both limits at the carried count plus two, whatever the carried count', () => {
  for (const carried of [0, 1, 2, 3]) {
    const ledger = { requests: 0, charged: 0, entries: [], transient: 0, invalid: carried, unproductive: carried };
    const short = simulate({ maxInvalid: carried + 1, maxUnproductive: carried + 2, answers: ['empty', 4], ledger });
    assert.deepEqual(short.received, ['empty'], `carried ${carried}: an invalid limit of carried + 1 refuses the retry`);
    const shortRun = simulate({ maxInvalid: carried + 2, maxUnproductive: carried + 1, answers: ['empty', 4], ledger });
    assert.deepEqual(shortRun.received, ['empty'], `carried ${carried}: an unproductive limit of carried + 1 refuses the retry`);
    const enough = simulate({ maxInvalid: carried + 2, maxUnproductive: carried + 2, answers: ['empty', 4], ledger });
    assert.deepEqual(enough.received, ['empty', 4], `carried ${carried}`); assert.equal(enough.stopped, null);
    assert.equal(enough.unproductive, 0, 'a verified answer resets the unproductive count');
  }
});

test('E.8 retry budget: offline simulation of the 12-item, 4-batch Stage C heldout evaluation on a copy of the pre-heldout ledger', () => {
  const beforeLive = fs.readFileSync(LIVE, 'utf8'), before = fs.readFileSync(HELDOUT_SNAPSHOT, 'utf8'), pre = JSON.parse(before);
  assert.deepEqual([pre.requests, pre.charged, pre.invalid, pre.unproductive, pre.transient], [25, 0.0095186, 2, 0, 1]);
  const evaluated = new Set(pre.entries.filter(e => e.n >= 10 && e.kind === 'model').flatMap(e => e.ids || []));
  const unseen = dataset.items.filter(item => !evaluated.has(item.id)).map(item => item.id);
  assert.deepEqual(unseen, [
    'af-syseng-good', 'af-syseng-irrelevant', 'as-prog1-essay', 'as-prog1-bare-name',
    'as-prog1-keywords', 'as-prog1-accessible', 'as-prog1-week1', 'as-syseng-good',
    'as-sensors-quiz', 'af-prog1-multiweek', 'as-prog1-vague-evidence', 'as-prog1-multiweek',
  ]);
  const proposed = { source: HELDOUT_SNAPSHOT, maxRequests: 33, maxCost: 0.0395186, maxInvalid: 4, maxUnproductive: 2, warnInvalid: 3 };
  const clean = simulate({ ...proposed, answers: [4, 4, 3, 1] });
  assert.deepEqual(clean.carried, { invalid: 2, unproductive: 0 });
  assert.deepEqual([clean.received, clean.stopped, clean.invalid, clean.unproductive, clean.warnings], [[4, 4, 3, 1], null, 2, 0, 0]);
  const oneRetry = simulate({ ...proposed, answers: [4, 'empty', 4, 3, 1] });
  assert.deepEqual([oneRetry.received, oneRetry.stopped, oneRetry.invalid, oneRetry.unproductive, oneRetry.warnings], [[4, 'empty', 4, 3, 1], null, 3, 0, 1]);
  assert.deepEqual([oneRetry.invalid, oneRetry.unproductive, oneRetry.warnings], [heldout.usage.invalidAnswers, heldout.usage.unproductiveInARow, heldout.usage.warnings.length]);
  const twoEmpties = simulate({ ...proposed, answers: [4, 'empty', 'empty', 4, 3, 1] });
  assert.deepEqual(twoEmpties.received, [4, 'empty', 'empty'], 'a second invalid/empty answer stops the run');
  assert.match(twoEmpties.stopped, /failed validation|verified no relationship/);
  const tooTight = simulate({ ...proposed, maxInvalid: 3, answers: ['empty', 4] });
  assert.deepEqual(tooTight.received, ['empty'], 'maxInvalid 3 would refuse the corrective retry because the ledger already carries 2');
  assert.equal(fs.readFileSync(HELDOUT_SNAPSHOT, 'utf8'), before, 'the pre-heldout snapshot is untouched');
  assert.equal(fs.readFileSync(LIVE, 'utf8'), beforeLive, 'the live ledger is untouched');
});
