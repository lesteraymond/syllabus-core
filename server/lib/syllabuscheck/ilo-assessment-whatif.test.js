'use strict';
// Pins the offline what-if behind docs/ilo-assessment-scoring-review.md (scripts/whatif-ilo-assessment.cjs): what the scored ILO-assessment relationship
// does to a check today, and what the proposed policies would do instead. The proposals are applied in the script's own process, in memory; this
// test changes no policy. If the "current" figures change, the official scoring changed and the review document must be revisited.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', '..', '..', 'scripts', 'whatif-ilo-assessment.cjs');
const env = { ...process.env };
for (const key of Object.keys(env)) if (/_API_KEY$|^SYLLABUS_CHECK_/.test(key)) delete env[key];
function whatIf(mode, c2 = false) {
  const r = spawnSync(process.execPath, [SCRIPT, '--mode', mode, ...(c2 ? ['--c2'] : [])], { env, encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  return Object.fromEntries(r.stdout.trim().split('\n').map(line => JSON.parse(line)).map(row => [row.scenario, row]));
}
const view = row => [row.deducted, row.provisionalScore, row.alignmentStatus, row.blocking, row.passIfReal];

test('today: ILO-assessment costs 3 points per NOT_ALIGNED pair and 1 per PARTIALLY_ALIGNED one, and one unanswered pair leaves the check without a score', () => {
  const s = whatIf('current');
  assert.equal(s['all aligned'].iloAssessmentPairsSent, 15, 'one pair per ILO of the fixture');
  assert.deepEqual(view(s['all aligned']), [0, 100, 'completed', {}, true]);
  assert.deepEqual(view(s['one NOT_ALIGNED']), [3, 97, 'completed', {}, true]);
  assert.deepEqual(view(s['three NOT_ALIGNED']), [9, 91, 'completed', {}, true]);
  assert.deepEqual(view(s['all NOT_ALIGNED']), [45, 55, 'completed', {}, false], 'this relationship alone can take a syllabus below the pass mark of 79');
  assert.deepEqual(view(s['all PARTIALLY_ALIGNED']), [15, 85, 'completed', {}, true]);
  assert.deepEqual(view(s['one unanswered']), [0, 100, 'not_evaluated', { SEM: 1, 'AI-REQUIRED': 1 }, false], 'blocking: no official score');
  assert.deepEqual(s['three NOT_ALIGNED'].aln07.severity, { MAJOR: 3, INFO: 12 });
});

test('advisory in the policy alone: no points and never blocking, but the verdict still marks a failure MAJOR, because verdict.js keeps its own advisory list', () => {
  const s = whatIf('advisory');
  for (const scenario of Object.keys(s)) assert.deepEqual(view(s[scenario]), [0, 100, 'completed', {}, true], scenario);
  assert.deepEqual(s['three NOT_ALIGNED'].aln07.severity, { MAJOR: 3, INFO: 12 });
  const both = whatIf('advisory-verdict');
  assert.deepEqual(both['three NOT_ALIGNED'].aln07, { status: { FAIL: 3, PASS: 12 }, severity: { MINOR: 3, INFO: 12 } }, 'the finding stays visible, as advice');
  assert.deepEqual(both['one unanswered'].aln07.status, { NOT_CHECKED: 1, PASS: 14 });
  // The answers are still there, so Stage C2 still asks its deeper question after an ALIGNED one.
  assert.equal(whatIf('advisory-verdict', true)['all aligned'].assessmentFitPairsSent, 15);
});

test('removed: 15 fewer pairs, ALN-07 left without an answer, and Stage C2 never asks its question, because it waits for an ALIGNED scored answer', () => {
  const now = whatIf('current', true), removed = whatIf('removed', true);
  assert.deepEqual([now['all aligned'].pairsSent, removed['all aligned'].pairsSent], [115, 85]);
  assert.deepEqual([now['all aligned'].assessmentFitPairsSent, removed['all aligned'].assessmentFitPairsSent], [15, 0]);
  for (const scenario of Object.keys(removed)) assert.deepEqual(view(removed[scenario]), [0, 100, 'completed', {}, true], scenario);
  assert.deepEqual(removed['all aligned'].aln07, { status: { NOT_CHECKED: 1 }, severity: { INFO: 1 } });
});
