'use strict';
// The five prompt fixes of replan-prompt-4: values in orientation and examination weeks, Bloom levels, answer calibration, rewrite format rules,
// worked examples. Offline: the prompt texts and the rewrite checks only.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('./prompt');
const R = require('./rules');
const S = require('./eval/synthetic');

test('the prompt version records the change', () => {
  assert.equal(P.PROMPT_VERSION, 'replan-prompt-6');
});

test('1. the values question accepts the orientation or the examination itself', () => {
  const ask = R.CHECKLISTS['VALUE-ILO'].items[0].ask;
  assert.match(ask, /orientation week or an examination week/);
  assert.match(P.JUDGE_SYSTEM, /including the orientation week and examination weeks/);
  assert.match(P.JUDGE_SYSTEM, /E\. VALUE-ILO in an examination week/);
});

test('2. Bloom levels are given for every CLO classification and as an ordered scale; the mapping is the owner-confirmed one', () => {
  // CLO 4 also lists its affective levels (2026-11-17)
  for (const l of R.CLO_LEVELS) assert.ok(P.JUDGE_SYSTEM.includes(`CLO ${l.no}: ${l.level} (${l.focus}); Bloom levels: ${l.bloom.join(', ')}${l.affective ? `; or the affective levels: ${l.affective.join(', ')}` : ''}.`), l.level);
  assert.deepEqual(R.BLOOM_ORDER.map(b => b.level), ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']);
  for (const b of R.BLOOM_ORDER) assert.match(P.JUDGE_SYSTEM, new RegExp(`\\d\\. ${b.level}: `));
  assert.match(R.BLOOM_SOURCE, /confirmed by the owner on 2026-11-12; apply added to CLO 1 by the owner on 2026-11-15/);
  // CLO 3 takes analyze and evaluate too (owner, 2026-11-17, after the CHED Implementation Handbook for OBE and ISA)
  assert.deepEqual(R.CLO_LEVELS.map(l => l.bloom), [['remember', 'understand', 'apply'], ['apply', 'analyze', 'evaluate'], ['apply', 'analyze', 'evaluate', 'create'], ['evaluate', 'create']]);
  assert.match(R.BLOOM_SOURCE, /analyze and evaluate added to CLO 3 by the owner on 2026-11-17/);
  assert.match(P.JUDGE_SYSTEM, /CLO 3: Demonstrating \(Application \/ Create\); Bloom levels: apply, analyze, evaluate, create\. CHED meaning: students demonstrate the outcome independently, without supervision, in a product, performance or solution\./);
  assert.match(P.JUDGE_SYSTEM, /CLO 2: Enabling [^\n]*CHED meaning: the course strengthens the outcome through practice with supervision\./);
  assert.doesNotMatch(P.JUDGE_SYSTEM.split('\n').find(l => l.startsWith('   CLO 4:')), /CHED meaning/, 'Integration of Values is LCUP\'s own classification, not a CHED stage');
});

test('3. "no" and "unclear" are told apart: unclear only for a missing, cut-short or ambiguous text', () => {
  assert.match(P.JUDGE_SYSTEM, /"no": the texts are there and do not show it/);
  assert.match(P.JUDGE_SYSTEM, /A short or plain text is not a reason for "unclear"/);
  assert.match(P.JUDGE_SYSTEM, /"unclear": only when the text you need is missing, cut short, or ambiguous/);
});

test('4. the rewrite prompt carries the checklists and a format for every rewritable field, and forbids copying a parent', () => {
  for (const field of R.CHAIN.filter(r => r.rewritable).map(r => r.field)) assert.match(P.REWRITE_SYSTEM, new RegExp(`\\n  ${field}: `), field);
  assert.match(P.REWRITE_SYSTEM, /never "the teacher will"/);
  assert.match(P.REWRITE_SYSTEM, /Do not copy a parent's wording/);
  assert.match(P.REWRITE_SYSTEM, /CHECKLISTS/);
});

test('4. a rewrite is refused when an outcome is several lines, written for the teacher, or a word-for-word copy of its parent', () => {
  const clo = { field: 'clo', label: 'CLO 3', text: 'Design and implement Python programs that meet given requirements.' };
  const job = { field: 'ilo', text: 'WEAK old ILO', parents: [clo, { field: 'content', text: 'Loops' }] };
  const reply = text => JSON.stringify({ text, explanation: 'x' });
  assert.equal(P.validateRewrite(job, reply('Write Python loops that stop on a condition.')).text, 'Write Python loops that stop on a condition.');
  assert.match(P.validateRewrite(job, reply('Write loops.\nTrace loops.')).rejected, /more than one line/);
  assert.match(P.validateRewrite(job, reply('The teacher will demonstrate loops.')).rejected, /teacher/);
  assert.match(P.validateRewrite(job, reply('Instructors explain loops.')).rejected, /teacher/);
  assert.match(P.validateRewrite(job, reply('design and implement Python programs that meet given requirements.')).rejected, /copies a parent/);
});

test('5. worked examples are present, cover the hard cases, show the answer format, and contain no syllabus text', () => {
  for (const label of ['A. ILO-CLO', 'B. ILO-CLO', 'C. ILO-CONTENT', 'D. "no" versus "unclear"', 'E. VALUE-ILO']) assert.ok(P.JUDGE_SYSTEM.includes(label), label);
  assert.match(P.JUDGE_SYSTEM, /Answer format example: \{"answers":\[\{"q":/);
  const example = JSON.parse(P.JUDGE_SYSTEM.split('Answer format example: ')[1].split('\n')[0]);
  assert.deepEqual(example.answers[0].items.map(i => i.id), R.CHECKLISTS['ILO-CLO'].items.map(i => i.id));
  // invented: none of the synthetic evaluation syllabus's own outcomes or weekly ILOs appear in the examples
  const examples = P.JUDGE_SYSTEM.split('WORKED EXAMPLES')[1].split('YOUR TASK')[0];
  const synthetic = S.syntheticSyllabus();
  for (const t of [...synthetic.clos.map(c => c.statement), ...synthetic.plan.flatMap(r => r.ilos.map(i => i.text)).filter(Boolean)]) assert.ok(!examples.includes(t), t);
});

test('near copies: the DSP twins are caught, genuinely different ILOs of the same topic are not', () => {
  assert.equal(P.nearCopy('Compare FIR and IIR filters by explaining their advantages and disadvantages and citing a simple application of each in digital signal processing.',
    'Compare FIR and IIR filters and explain how their advantages and disadvantages affect the choice of a DSP design for a given application, and present the reason'), true);
  assert.equal(P.nearCopy('Explain how FIR filters work using their difference equation', 'Design an FIR filter for a given cutoff frequency in MATLAB'), false);
  assert.equal(P.nearCopy('Compute the z-transform of discrete-time signals', 'Analyze system stability using the poles of the z-transform'), false);
  assert.equal(P.nearCopy('Write loops', 'Write loops'), false, 'too short to judge');
  assert.equal(P.nearCopy('Explain folk dance outcome two', 'Explain and apply Java programming outcome one'), false, 'the same first verb alone is not a copy');
  assert.match(P.REWRITE_SYSTEM, /keepDistinctFrom/);
  assert.equal(P.PROMPT_VERSION, 'replan-prompt-6', 'the near-copy rule did not change the judge prompt (6 is constructive alignment)');
  assert.match(P.REWRITE_VERSION, /^replan-rewrite-\d+$/);
});

test('the system prompts stay identical across calls (cacheable) and fit comfortably above the 512-token cache minimum', () => {
  assert.equal(require('./prompt').JUDGE_SYSTEM, P.JUDGE_SYSTEM);
  assert.ok(P.JUDGE_SYSTEM.length / 4 > 1024);
  assert.ok(P.REWRITE_SYSTEM.length / 4 > 1024);
});
