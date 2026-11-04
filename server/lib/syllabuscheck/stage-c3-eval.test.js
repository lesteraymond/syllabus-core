'use strict';
// The Stage C3 evaluation dataset (eval/stage-c3-dataset.json), offline: its conventions (synthetic, author-written, unreviewed: no faculty judgement is
// claimed), that every item is exactly the pair lessonfit.chainPairs builds from its lesson, its coverage (each course, each link, each verdict, a
// keyword trap everywhere), that the traps and paraphrases defeat keyword matching, that no prompt wording is copied into it, its pinned labels, and that
// the evaluation script runs it (--dataset stage-c3) with nothing sent: a plan, and one paid-mode run answered by the offline replay into temporary files.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dataset = require('./eval/stage-c3-dataset.json');
const stageC = require('./eval/stage-c-dataset.json');
const { chainPairs } = require('./lessonfit');
const stages = require('./stages');
const { isNoRewrite, isAdvisory } = require('./gemini');
const { STOP: REVIEW_STOP } = require('./answerReview');
const { scoreEval } = require('./eval/metrics');

const ROOT = path.resolve(__dirname, '../../..');
const LABELS = ['ALIGNED', 'PARTIALLY_ALIGNED', 'NOT_ALIGNED', 'INSUFFICIENT_EVIDENCE'];
const TYPES = stages.C3.types; // Content-activity, Content-assessment, Activity-assessment
const SUFFIX = { 'Content-activity': 'ca', 'Content-assessment': 'ct', 'Activity-assessment': 'at' };
const COURSES = ['prog1', 'syseng', 'sensors'];
const { items, lessons } = dataset;
const clearAligned = item => item.accept.length === 1 && item.accept[0] === 'ALIGNED';
const clearPartial = item => item.accept.length === 1 && item.accept[0] === 'PARTIALLY_ALIGNED';
const flagged = item => !item.accept.includes('ALIGNED');
const sha = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('the dataset is a DRAFT of synthetic examples with author-written labels: nothing in it is presented as a faculty judgement', () => {
  assert.equal(dataset.version, 'stage-c3-1');
  assert.match(dataset.status, /^DRAFT - synthetic examples with author-written labels, NOT faculty-reviewed$/);
  assert.equal(dataset.reviewStatus, 'unreviewed');
  assert.match(dataset.provenance, /SYNTHETIC/);
  assert.match(dataset.provenance, /no faculty member has reviewed them/);
  assert.deepEqual(dataset.changeLog, [], 'version 1: a later change of a label bumps the version and is logged here');
  assert.deepEqual(Object.keys(dataset.splits), ['dev', 'heldout']);
  assert.equal(items.length, 73);
  assert.equal(new Set(items.map(item => item.id)).size, items.length, 'unique ids');
  for (const item of items) {
    assert.deepEqual([item.reviewStatus, item.facultyVerdict, item.facultyNotes, item.origin], ['unreviewed', null, '', 'stage-c3-1'], item.id);
    assert.ok(TYPES.includes(item.type), item.id);
    assert.ok(dataset.categories.includes(item.category), item.id);
    assert.ok(Array.isArray(item.accept) && item.accept.length >= 1 && new Set(item.accept).size === item.accept.length && item.accept.every(label => LABELS.includes(label)), item.id);
    assert.ok(!item.accept.includes('INSUFFICIENT_EVIDENCE'), `${item.id}: both texts are written, so the evidence is never insufficient`);
    assert.equal(item.ambiguous, undefined, `${item.id}: no item is marked ambiguous; two accepted labels both flag the problem`);
    assert.ok(item.why.length > 30, item.id);
  }
});

test('the courses are copied unchanged from the Stage C dataset, and the earlier datasets are not touched by this one', () => {
  assert.deepEqual(Object.keys(dataset.courses), COURSES);
  for (const key of COURSES) assert.deepEqual(dataset.courses[key], stageC.courses[key], key);
  assert.equal(stageC.version, 'stage-c-2');
  // No item id is shared with another evaluation dataset (stage-e6.test.js reads every dataset file together).
  const eval_ = path.join(__dirname, 'eval');
  const others = fs.readdirSync(eval_).filter(f => /dataset\.json$/.test(f) && f !== 'stage-c3-dataset.json').flatMap(f => JSON.parse(fs.readFileSync(path.join(eval_, f), 'utf8')).items.map(item => item.id));
  assert.deepEqual(items.filter(item => others.includes(item.id)).map(item => item.id), []);
});

test('every item is exactly the pair lessonfit.chainPairs builds from its lesson: one link, judged on its own, with no ILO in either text', () => {
  assert.equal(Object.keys(lessons).length, 30);
  for (const [id, l] of Object.entries(lessons)) {
    assert.ok(COURSES.includes(l.course) && ['dev', 'heldout'].includes(l.split) && /^\d+(-\d+)?$/.test(l.week), id);
    assert.equal(l.ilos, undefined, `${id}: the three links never involve the ILO`);
    for (const text of [l.contents, l.activities, l.tasks]) assert.ok(String(text).trim(), `${id}: every text of the lesson is written`);
    const pairs = chainPairs({ plan: [{ kind: 'lesson', week: l.week, contents: l.contents, activities: l.activities, tasks: l.tasks }] }, [0]);
    const mine = items.filter(item => item.lesson === id);
    assert.ok(mine.length >= 1 && mine.length <= 3, id);
    assert.equal(new Set(mine.map(item => item.type)).size, mine.length, `${id}: at most one item per link`);
    for (const item of mine) {
      const pair = pairs.find(p => p.type === item.type);
      assert.equal(item.id, `c3-${id}-${SUFFIX[item.type]}`);
      assert.deepEqual([item.source, item.target, item.course, item.split], [pair.source, pair.target, l.course, l.split], item.id);
      assert.equal(pair.targetPath, null, 'advice only');
      assert.match(item.source, item.type === 'Activity-assessment' ? /^Week [\d-]+ learning activities: - / : /^Week [\d-]+ course content: /);
    }
  }
  // The runner's pair (scripts/eval-alignment.cjs pairOf) has no target to rewrite either, and the three links cost no points.
  for (const type of TYPES) assert.deepEqual([isNoRewrite(type), isAdvisory(type)], [true, true], type);
  // A grouped lesson is headed by its range, as the engine heads it.
  assert.match(items.find(item => item.id === 'c3-syseng-requirements-grouped-ca').source, /^Week 4-5 course content: /);
});

test('coverage: each course and each link has an aligned, a partially aligned and a misaligned item, and a keyword trap; both splits cover every link', () => {
  for (const course of COURSES) for (const type of TYPES) {
    const mine = items.filter(item => item.course === course && item.type === type);
    const label = `${course} ${type}`;
    assert.ok(mine.some(clearAligned), `${label}: aligned`);
    assert.ok(mine.some(clearPartial), `${label}: partially aligned`);
    assert.ok(mine.some(item => item.accept.length === 1 && item.accept[0] === 'NOT_ALIGNED'), `${label}: misaligned`);
    assert.ok(mine.some(item => item.category === 'keyword-trap'), `${label}: keyword trap`);
  }
  for (const split of ['dev', 'heldout']) for (const type of TYPES) {
    const mine = items.filter(item => item.split === split && item.type === type);
    assert.ok(mine.some(clearAligned) && mine.some(flagged), `${split} ${type}`);
  }
  assert.deepEqual([items.filter(item => item.split === 'dev').length, items.filter(item => item.split === 'heldout').length], [51, 22]);
  const count = key => Object.fromEntries([...new Set(items.map(key))].sort().map(k => [k, items.filter(item => key(item) === k).length]));
  assert.deepEqual(count(item => item.type), { 'Activity-assessment': 29, 'Content-activity': 21, 'Content-assessment': 23 });
  assert.deepEqual(count(item => item.course), { prog1: 25, sensors: 21, syseng: 27 });
  assert.deepEqual(count(item => item.category), { aligned: 17, 'bare-name': 6, 'beyond-practice': 4, 'grouped-weeks': 3, 'keyword-trap': 21, 'off-topic': 6, 'paraphrase-aligned': 6, 'partial-coverage': 5, 'shallow-depth': 2, 'week-one-orientation': 3 });
});

test('the label rules of each category: a trap or an off-topic link is never ALIGNED, a paraphrase is, a bare task name is partial', () => {
  for (const item of items) {
    if (['keyword-trap', 'off-topic', 'shallow-depth', 'beyond-practice', 'partial-coverage', 'bare-name'].includes(item.category)) assert.ok(flagged(item), item.id);
    if (['aligned', 'paraphrase-aligned', 'week-one-orientation', 'grouped-weeks'].includes(item.category)) assert.ok(clearAligned(item), item.id);
    if (item.category === 'bare-name') { assert.ok(clearPartial(item), item.id); assert.match(item.target, /^- (Quiz|Seatwork|Laboratory exercise)$/, item.id); }
    if (item.category === 'off-topic') assert.deepEqual(item.accept, ['NOT_ALIGNED'], item.id);
  }
});

test('masking lessons: an aligned activities -> tasks link sits next to failing content links, so one passing link cannot stand in for the others', () => {
  const masking = Object.entries(lessons).filter(([, l]) => /^masking/.test(l.purpose || ''));
  assert.deepEqual(masking.map(([id]) => id), ['prog1-arrays-masked', 'syseng-reliability-masked', 'sensors-adc-masked']);
  assert.deepEqual([...new Set(masking.map(([, l]) => l.course))], COURSES);
  for (const [id] of masking) {
    const of = type => items.find(item => item.id === `c3-${id}-${SUFFIX[type]}`);
    assert.deepEqual([of('Content-activity').accept, of('Content-assessment').accept, of('Activity-assessment').accept], [['NOT_ALIGNED'], ['NOT_ALIGNED'], ['ALIGNED']], id);
  }
  // The other way round: tasks that assess the content well, after activities that never practised what they ask.
  for (const id of ['prog1-methods', 'sensors-dac-partial']) {
    assert.deepEqual([items.find(i => i.id === `c3-${id}-ct`).accept, flagged(items.find(i => i.id === `c3-${id}-at`))], [['ALIGNED'], true], id);
  }
});

// A keyword matcher: the five-letter stems of the content words two texts share (the lesson heading and generic classroom words left out).
const GENERIC = new Set([...REVIEW_STOP, ...'students student teams team write writes given using three each then their them short with from that this what work works week course content learning activities'.split(' ')]);
const keyOf = word => (word.length > 4 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word).slice(0, 5);
const keysOf = text => new Set((String(text).toLowerCase().replace(/^week [^:]*:/, ' ').match(/[a-z0-9]+/g) || []).filter(w => w.length >= 4 && !GENERIC.has(w)).map(keyOf));
const sharedKeys = item => { const target = keysOf(item.target); return [...keysOf(item.source)].filter(k => target.has(k)); };

test('the traps and the paraphrases defeat keyword matching: no overlap threshold approves the paraphrases without approving every trap', () => {
  const traps = items.filter(item => item.category === 'keyword-trap'), paraphrases = items.filter(item => item.category === 'paraphrase-aligned');
  for (const item of traps) assert.ok(sharedKeys(item).length >= 2, `${item.id}: a trap shares technical words with its source (${sharedKeys(item)})`);
  for (const item of paraphrases) assert.ok(sharedKeys(item).length <= 1, `${item.id}: a paraphrase says it in other words (${sharedKeys(item)})`);
  for (const item of items.filter(i => i.category === 'off-topic')) assert.ok(sharedKeys(item).length <= 1, item.id);
  assert.ok(Math.max(...paraphrases.map(i => sharedKeys(i).length)) < Math.min(...traps.map(i => sharedKeys(i).length)));
  // The matcher as a judge (ALIGNED when two keywords are shared): wrong on every trap and every paraphrase, under half right overall.
  const runs = [new Map(items.map(item => [item.id, sharedKeys(item).length >= 2 ? 'ALIGNED' : 'NOT_ALIGNED']))];
  const r = scoreEval(items, runs);
  assert.deepEqual([r.byCategory['keyword-trap'].agree, r.byCategory['paraphrase-aligned'].agree], [0, 0]);
  assert.equal(r.agreement, 0.438, '32 of 73');
  // A spot check of what is shared: the same words with another academic meaning.
  assert.deepEqual(sharedKeys(items.find(i => i.id === 'c3-syseng-integration-trap-ct')).sort(), ['integ', 'strat']);
  assert.deepEqual(sharedKeys(items.find(i => i.id === 'c3-prog1-variables-trap-ct')).sort(), ['data', 'type', 'varia']);
});

// Word 3-grams with at least two content words (stage-e6.test.js #11): what a prompt example would share with an evaluation item.
const STOP3 = new Set('a an the of to in on for and or by with is are be as at it its this that these those from into each one their his her they them students student lesson course text value values when not no only what which who how than then any all'.split(' '));
const words = text => String(text).toLowerCase().replace(/[^a-z0-9'-]+/g, ' ').split(/\s+/).filter(Boolean);
const trigrams = text => { const w = words(text), out = new Set(); for (let i = 0; i + 3 <= w.length; i += 1) { const g = w.slice(i, i + 3); if (g.filter(x => !STOP3.has(x)).length >= 2) out.add(g.join(' ')); } return out; };

test('no prompt wording is copied into the items: the only phrase any staged segment (C3 included) shares with them is the Week 1 heading a rule names', () => {
  const corpus = new Set(items.flatMap(item => [...trigrams(item.source), ...trigrams(item.target)]));
  const segments = Object.entries(stages).filter(([name, v]) => /^(A|B|B3|B4|C1|C2|C3|D1|D2|R|RETRY|Q)$/.test(name) && v && typeof v === 'object')
    .flatMap(([name, v]) => Object.entries(v).filter(([, text]) => typeof text === 'string').map(([part, text]) => [`${name}.${part}`, text]));
  assert.ok(segments.some(([name]) => name === 'C3.tests'));
  const shared = segments.flatMap(([name, text]) => [...trigrams(text)].filter(g => corpus.has(g)).map(g => `${name}: ${g}`));
  assert.deepEqual(shared, ['C1.tests: week 1 course', 'C3.tests: week 1 course'], 'the heading of the Week 1 orientation lesson, reviewed in Stage E.6 as rule wording');
});

test('the labels are pinned: changing one is a deliberate act that bumps the version and adds a changeLog entry', () => {
  assert.equal(sha(items.map(item => [item.id, item.accept, item.split])), 'c9dccc3cb5a0d27838a330bc54361f39d87080ce21810efb5eec4bf66da553db');
  assert.equal(sha(Object.entries(lessons).map(([id, l]) => [id, l.week, l.contents, l.activities, l.tasks])), '0ce6d5f937af0f52c794866399f5d6ab24e7dda78f676c00bcb2689fd5ed048d');
});

// ---- the evaluation script, offline: every socket refused in the child, every setting it reads stated (server/.env is read, never written) ----
const temps = [];
const tempDir = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'c3-eval-')); temps.push(dir); return dir; };
test.after(() => { for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true }); });
const NO_SOCKETS = path.join(tempDir(), 'no-sockets.cjs');
fs.writeFileSync(NO_SOCKETS, "'use strict';\nconst net = require('node:net');\nnet.Socket.prototype.connect = function () { throw new Error('offline test: no socket may be opened'); };\n");
const KEY = 'sk-ant-test-only-c3-eval-not-a-real-key';
const STAGES_OFF = Object.fromEntries(['A', 'B', 'B3', 'B4', 'C1', 'C2', 'C3', 'D1', 'D2'].map(stage => [`SYLLABUS_CHECK_STAGE_${stage}`, 'off']));
const childEnv = () => ({ ...process.env, ...STAGES_OFF, NODE_OPTIONS: '', SYLLABUS_CHECK_AI_PROVIDER: 'off', ANTHROPIC_API_KEY: KEY, ANTHROPIC_MODEL: 'claude-sonnet-4-6', SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL: '',
  ANTHROPIC_THINKING: '', ANTHROPIC_EFFORT: '', ANTHROPIC_MAX_TOKENS: '', ANTHROPIC_TIMEOUT_SEC: '', ANTHROPIC_MAX_RETRIES: '', ANTHROPIC_PROMPT_CACHE: '', ANTHROPIC_CUSTOM_HEADERS: '',
  OPENROUTER_API_KEY: '', GEMINI_API_KEY: '', SYLLABUS_CHECK_PROMPT_TRIM: 'off', SYLLABUS_CHECK_PROMPT_VARIANT: 'current', SYLLABUS_CHECK_AI_BATCH: '', SYLLABUS_CHECK_REF_VERIFY: 'off',
  SYLLABUS_CHECK_OFFLINE_REPLAY: 'test', SYLLABUS_CHECK_REPLAY_FAULTS: '', SYLLABUS_CHECK_REPLAY_THINKING: '', SYLLABUS_CHECK_REPLAY_MODEL: '' });
function runScript(args, { replay = false } = {}) {
  const preload = replay ? ['--require', path.join(__dirname, 'eval', 'anthropicReplayPreload.js')] : [];
  const r = spawnSync(process.execPath, ['--require', NO_SOCKETS, ...preload, path.join('scripts', 'eval-alignment.cjs'), ...args], { cwd: ROOT, env: childEnv(), encoding: 'utf8', timeout: 180000 });
  assert.equal(r.error, undefined, String(r.error));
  return { status: r.status, stdout: r.stdout, all: `${r.stdout}\n${r.stderr}` };
}
const REGISTER = path.join(ROOT, 'docs', 'ai-eval-anthropic', 'spend-register.json');
const fileHash = file => (fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : 'absent');

test('--dataset stage-c3 plans the development split by default, switches Stage C3 on (and only C3), and sends nothing', () => {
  const dev = runScript(['--provider', 'anthropic', '--plan', '--dataset', 'stage-c3']);
  assert.equal(dev.status, 0, dev.all);
  assert.match(dev.stdout, /^Dataset stage-c3-1 \(stage-c3\): 51 items, 2 run\(s\), 14 batches per run \(batch size 4\); stages on: \{"a":false,"b":false,"b3":false,"b4":false,"c1":false,"c2":false,"d1":false,"d2":false,"c3":true\}$/m);
  assert.match(dev.stdout, /^Prompt alignment-12c3-r8$/m);
  assert.doesNotMatch(dev.stdout, /Held-out items/);
  const held = runScript(['--provider', 'anthropic', '--plan', '--dataset', 'stage-c3', '--split', 'heldout']);
  assert.equal(held.status, 0, held.all);
  assert.match(held.stdout, /^Dataset stage-c3-1 \(stage-c3\): 22 items, /m);
  assert.match(held.stdout, /^Held-out items: 22\. A paid run needs --confirm-heldout/m);
  assert.match(held.stdout, /--confirm-heldout$/m);
  // --legacy measures the wording the application uses today: C3 off, whatever the dataset.
  const legacy = runScript(['--provider', 'anthropic', '--plan', '--dataset', 'stage-c3', '--legacy']);
  assert.equal(legacy.status, 0, legacy.all);
  assert.match(legacy.stdout, /^Dataset stage-c3-1 \(stage-c3\): 51 items, .*stages on: \{"a":false,"b":false,"b3":false,"b4":false,"c1":false,"c2":false,"d1":false,"d2":false\}$/m);
  assert.match(legacy.stdout, /^Prompt alignment-10 \(no stage on\)$/m);
  for (const r of [dev, held, legacy]) assert.ok(!r.all.includes(KEY), 'the key appears nowhere');
});

test('a paid-mode run of four C3 items, answered by the offline replay, is scored against the dataset; temporary files only, the spend register untouched', () => {
  const dir = tempDir(), before = fileHash(REGISTER);
  const ids = ['c3-prog1-loops-paraphrase-ca', 'c3-prog1-variables-trap-ct', 'c3-prog1-strings-bare-ct', 'c3-prog1-arrays-masked-at'];
  const out = path.join(dir, 'result.json');
  const r = runScript(['--provider', 'anthropic', '--confirm-paid', '--model', 'claude-sonnet-5-5', '--thinking', 'adaptive', '--effort', 'high', '--dataset', 'stage-c3', '--ids', ids.join(','), '--runs', '1',
    '--budget', '3', '--max-cost', '0.5', '--ledger', path.join(dir, 'ledger.json'), '--out', out, '--spend-register', path.join(dir, 'register.json')], { replay: true });
  assert.equal(r.status, 0, r.all);
  assert.match(r.stdout, /UNREVIEWED BASELINE/);
  assert.match(r.stdout, /^Model anthropic\/claude-sonnet-5-5; prompt alignment-12c3-r8; retry policy staged/m);
  const result = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.deepEqual([result.dataset.name, result.dataset.version, result.dataset.split, result.dataset.reviewStatus, result.evaluationOnly], ['stage-c3', 'stage-c3-1', 'dev', 'unreviewed', true]);
  assert.equal(result.configuration.stageFlags.c3, true);
  assert.deepEqual([...result.dataset.selection.selectedIds].sort(), [...ids].sort());
  // The replay approves everything: the paraphrase and the aligned link agree; the trap and the bare task name are false approvals.
  assert.deepEqual([result.agreement, result.falsePositiveRate, result.falseNegativeRate, result.counts], [0.5, 0, 1, { clearAligned: 2, falsePositive: 0, clearNot: 2, falseNegative: 2 }]);
  assert.equal(result.relationshipMetrics.verified, 4);
  assert.equal(fileHash(REGISTER), before, 'the real spend register is not touched');
  assert.ok(!r.all.includes(KEY) && !fs.readFileSync(out, 'utf8').includes(KEY), 'the key appears nowhere');
});
