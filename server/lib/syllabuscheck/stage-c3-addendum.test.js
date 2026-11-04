'use strict';
// Pins docs/ai-checker-rules-addendum-c3.md (c3-addendum-1) to the running code. The addendum documents Stage C3 beside the generated rules document
// without editing it: docs/ai-checker-rules.md must stay byte-identical (stage-e9-phase3.test.js A8.2 pins the same hash) and still say nothing about
// C3, and every name, figure and wording the addendum gives must be what the code does. When one of these fails, update the addendum (and its version)
// with the code, or, once the base document is regenerated with C3 in it, retire the addendum. Offline: nothing is sent and nothing is written.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const realFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new TypeError('fetch failed (network blocked in stage-c3-addendum.test.js)'); };
test.after(() => { globalThis.fetch = realFetch; });
const { stageFlags, C3 } = require('./stages');
const { promptVersionOf, isAdvisory, isNoRewrite } = require('./gemini');
const fit = require('./lessonfit');
const { POLICY, aiGate } = require('./policy');
const { tierOfType } = require('./acceptance');
const { VERSION } = require('./engine');
const { chainDraftNotes, chainExplanationNotes } = require('./recommendationReview');
const standard = require('../compliance/standard-v4.json');
const dataset = require('./eval/stage-c3-dataset.json');

const ROOT = path.join(__dirname, '..', '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const ADDENDUM = read('docs/ai-checker-rules-addendum-c3.md').split('\r\n').join('\n');
const BASE_SHA = 'e378baecca3c7655e8fa8d210ea9e3ff550f94dccc9872e39d66b4c12db9a00e';
const MODEL = 'claude-sonnet-5-5';
const says = text => assert.ok(ADDENDUM.includes(text), `the addendum should say: ${text}`);
const i18n = () => import(pathToFileURL(path.join(ROOT, 'src', 'i18n', 'hybrid.js')).href);
const lesson = { week: '3', contents: 'Variables, data types and arithmetic operators', activities: 'Students trace short programs that declare variables and evaluate arithmetic expressions.', tasks: 'Quiz on loops and arrays' };
const pairsOf = row => fit.chainPairs({ plan: [row] }, [0]);

test('the base rules document is byte-identical and says nothing about C3; the addendum is versioned and names the base by its hash', () => {
  const base = fs.readFileSync(path.join(ROOT, 'docs', 'ai-checker-rules.md'));
  assert.equal(crypto.createHash('sha256').update(base).digest('hex'), BASE_SHA, 'docs/ai-checker-rules.md is generated: never edit it by hand');
  assert.doesNotMatch(base.toString('utf8'), /STAGE_C3|Content-activity|Content-assessment|Activity-assessment/, 'the base now documents C3: retire the addendum');
  says('`c3-addendum-1`');
  says(BASE_SHA);
  // The base's own header (engine, prompt, policy) is still the running code's, and the addendum repeats it.
  const header = base.toString('utf8').split('\n')[4];
  for (const value of [VERSION, promptVersionOf(MODEL, {}), POLICY.version]) {
    assert.ok(header.includes(`\`${value}\``), value);
    says(`\`${value}\``);
  }
});

test('the switch is off unless set to "on", and the prompt versions are the ones the addendum gives', () => {
  for (const value of [undefined, '', 'off', 'true', '1']) assert.equal(stageFlags({ SYLLABUS_CHECK_STAGE_C3: value }).c3, undefined, String(value));
  assert.equal(stageFlags({ SYLLABUS_CHECK_STAGE_C3: 'on' }).c3, true);
  says('| `SYLLABUS_CHECK_STAGE_C3` |');
  const on = (...names) => Object.fromEntries(names.map(name => [`SYLLABUS_CHECK_STAGE_${name}`, 'on']));
  const versions = { 'alignment-10': {}, 'alignment-12c3-r8': on('C3'), 'alignment-12c1c2c3-r8': on('C1', 'C2', 'C3'), 'alignment-12ab34c1c2c3d1d2-r8-a8': on('A', 'B', 'B3', 'B4', 'C1', 'C2', 'C3', 'D1', 'D2') };
  for (const [version, env] of Object.entries(versions)) {
    assert.equal(promptVersionOf(MODEL, env), version);
    says(`\`${version}\``);
  }
});

test('the three relationships: their rules, pair ids, headings, no rewrite target, and the lesson and text limits', () => {
  assert.deepEqual(C3.types, ['Content-activity', 'Content-assessment', 'Activity-assessment']);
  const chain = /const CHAIN = \{([^}]*)\}/.exec(read('server/lib/syllabuscheck/verdict.js'))[1];
  const rules = Object.fromEntries([...chain.matchAll(/'([^']+)': \['(ALN-\d+)', '(\w+)'\]/g)].map(m => [m[1], [m[2], m[3]]]));
  assert.deepEqual(rules, { 'Content-activity': ['ALN-11', 'activitiesAssessments'], 'Content-assessment': ['ALN-12', 'activitiesAssessments'], 'Activity-assessment': ['ALN-13', 'activitiesAssessments'] });
  says('category `activitiesAssessments`');
  const pairs = pairsOf({ ...lesson, activities: 'x'.repeat(2500) });
  C3.types.forEach((type, k) => {
    const pair = pairs[k], suffix = pair.id.replace(/^row0-/, '');
    assert.equal(pair.type, type);
    assert.equal(pair.targetPath, null, `${type}: no rewrite target`);
    assert.equal(isNoRewrite(type), true, type);
    assert.match(ADDENDUM, new RegExp(`^\\| ${type} \\|.*\\| ${rules[type][0]} \\| \`row<i>-${suffix}\` \\|$`, 'm'), `the table row of ${type}`);
  });
  assert.match(pairs[0].source, /^Week 3 course content: /);
  says('`Week <n> course content:`');
  assert.match(pairs[2].source, /^Week 3 learning activities: /);
  says('`Week <n> learning activities:`');
  assert.equal(pairs[0].target.length, 2000);
  says('cut at 2,000 characters');
  says(`At most ${fit.MAX_LESSON_PAIRS} lessons (\`MAX_LESSON_PAIRS\`), so at most ${fit.MAX_LESSON_PAIRS * C3.types.length} links per check`);
  // An examination row and a lesson with none of the three texts are not asked about.
  assert.deepEqual(fit.chainRows({ plan: [lesson, { week: '9', kind: 'exam', contents: 'Midterm examination' }, { week: '10' }] }).map(r => r.i), [0]);
});

test('advice only: advisory where answers are scored, absent from the scoring policy, an optional tier, and the gate is advisory by default', () => {
  for (const type of C3.types) {
    assert.equal(isAdvisory(type), true, type);
    assert.ok(!POLICY.advisoryTypes.includes(type), `${type} must not be in the scoring policy`);
    assert.equal(tierOfType(type), 'optional', type);
  }
  assert.equal(POLICY.version, 'syllabus-policy-2');
  says('`POLICY` stays `syllabus-policy-2`');
  assert.equal(standard.passThreshold, 79);
  says('pass mark 79');
  says('Acceptance tier | `optional`');
  assert.equal(aiGate({}), 'advisory');
  says('By default (`SYLLABUS_CHECK_AI_GATE` unset) the gate is `advisory`');
});

test('review notes: each code the addendum names is produced by the review and worded in English and Tagalog, with the effect it states', async () => {
  const review = read('server/lib/syllabuscheck/recommendationReview.js');
  const { hybridEn, hybridTl } = await i18n();
  for (const code of ['cites_outcome', 'asks_for_outcome', 'adds_scope', 'not_one_sentence', 'assumes_resource', 'proposed_resource', 'conditional_resource', 'resource_needs_confirmation']) {
    assert.ok(review.includes(`code: '${code}'`), code);
    for (const [lang, words] of [['en', hybridEn], ['tl', hybridTl]]) assert.ok(String(words[`verdict.review.code.${code}`] || '').trim(), `${code} (${lang})`);
    says(`\`${code}\``);
  }
  // Held (withheld recommendation) or advisory (kept with a caution), as the table says; the explanation note never touches the recommendation.
  const [, tasks] = pairsOf(lesson);
  const notes = draft => chainDraftNotes({ label: 'NOT_ALIGNED', draft }, tasks).map(n => [n.code, !!n.advisory]);
  assert.deepEqual(notes('Revise the tasks so that they assess ILO 1 on data types. Then grade them.'), [['asks_for_outcome', false], ['not_one_sentence', true]]);
  assert.deepEqual(notes('Revise the tasks so that students deploy a database of data types.'), [['adds_scope', false]]);
  assert.deepEqual(notes('Revise the quiz so that it asks about variables, data types and arithmetic operators.'), []);
  assert.deepEqual(chainExplanationNotes({ label: 'NOT_ALIGNED', explanation: 'The quiz is about loops, so it misses CLO 2.' }, tasks).map(n => n.code), ['cites_outcome']);
  // The known limit of section 9: an outcome next to a negation is read as set aside.
  assert.deepEqual(chainExplanationNotes({ label: 'NOT_ALIGNED', explanation: 'The quiz is about loops, so the CLO is not met.' }, tasks), []);
  says('("so the CLO is not met")');
  says('("so it misses CLO 2")');
});

test('the wording the addendum quotes is the code\'s: the unanswered-link explanation and the advisory labels in both languages', async () => {
  const { hybridEn, hybridTl } = await i18n();
  says(fit.chainNotChecked(pairsOf(lesson)[0], 'provider_overloaded').explanation);
  for (const key of ['verdict.title', 'hybrid.advisory']) {
    says(`EN "${hybridEn[key]}"`);
    says(`TL "${hybridTl[key]}"`);
  }
});

test('the dataset figures the addendum gives, and that no faculty judgement is claimed', () => {
  const count = of => dataset.items.reduce((m, item) => { const k = of(item); m[k] = (m[k] || 0) + 1; return m; }, {});
  const types = count(item => item.type), split = count(item => item.split), category = count(item => item.category);
  assert.ok(dataset.items.filter(item => item.accept.length > 1).every(item => [...item.accept].sort().join() === 'NOT_ALIGNED,PARTIALLY_ALIGNED'), 'a two-label item accepts the two failing labels');
  const expected = count(item => (item.accept.length > 1 ? 'either' : item.accept[0]));
  says(`version \`${dataset.version}\`, holds ${dataset.items.length} items from ${Object.keys(dataset.lessons).length} lessons of three courses (${Object.values(dataset.courses).map(c => c.code).join(', ')})`);
  says(`${types['Content-activity']} Content-activity, ${types['Content-assessment']} Content-assessment, ${types['Activity-assessment']} Activity-assessment`);
  says(`${expected.ALIGNED} ALIGNED, ${expected.PARTIALLY_ALIGNED} PARTIALLY_ALIGNED, ${expected.NOT_ALIGNED} NOT_ALIGNED, and ${expected.either} that accept either failing label`);
  says(`${category['keyword-trap']} items are keyword traps`);
  says(`${split.dev} development, ${split.heldout} held-out`);
  assert.equal(dataset.reviewStatus, 'unreviewed');
  says('`reviewStatus: unreviewed`');
  assert.ok(dataset.items.every(item => item.reviewStatus === 'unreviewed' && !item.facultyVerdict), 'no item carries a faculty verdict');
});

test('every file, symbol and test the addendum names exists, and the known limits it lists still hold', () => {
  const cited = {
    'server/lib/syllabuscheck/stages.js': ['const C3 =', 'const stageFlags'],
    'server/lib/syllabuscheck/lessonfit.js': ['const chainRows', 'function chainPairs', 'const chainNotChecked', 'function assessmentInvalid', 'MAX_LESSON_PAIRS = 36'],
    'server/lib/syllabuscheck/verdict.js': ['const CHAIN =', "'REVIEW_REQUIRED'"],
    'server/lib/syllabuscheck/gemini.js': ['const ADVISORY_TYPES', 'const isAdvisory', 'const NO_REWRITE', 'function verifiedAlignment', 'function refreshLessonDraftReview'],
    'server/lib/syllabuscheck/acceptance.js': ['const tierOfType'],
    'server/lib/syllabuscheck/values.js': ['assessmentInvalid'],
    'server/lib/syllabuscheck/valueClassification.js': ['assessmentInvalid'],
    'server/lib/syllabuscheck/answerReview.js': ['C3.types'],
    'server/lib/syllabuscheck/recommendationReview.js': ['function chainDraftNotes', 'function chainExplanationNotes'],
    'server/lib/compliance/service.js': ['requireHybrid'],
    'scripts/eval-alignment.cjs': ["'stage-c3'"],
    'scripts/export-checker-rules.cjs': [],
    'docs/ilo-assessment-scoring-review.md': ['## 8. Decisions needed'],
  };
  for (const [file, symbols] of Object.entries(cited)) {
    const text = read(file);
    for (const symbol of symbols) assert.ok(text.includes(symbol), `${file}: ${symbol}`);
  }
  for (const file of ['stage-c3.test.js', 'stage-c3-independence.test.js', 'stage-c3-safety.test.js', 'stage-c3-eval.test.js', 'stage-c3-addendum.test.js', 'stage-e9-phase3.test.js']) {
    assert.ok(fs.existsSync(path.join(__dirname, file)), file);
    says(`\`${file}\``);
  }
  // Section 9. If one of these stops being true, the addendum is out of date.
  assert.match(read('server/lib/syllabuscheck/gemini.js'), /flags\.c1 && pair\.type === 'Activity-fit' \|\| flags\.c2 && pair\.type === 'Assessment-fit' \? refreshLessonDraftReview\(/, 'stored answers: only C1 and C2 drafts are reviewed again');
  const engine = read('server/lib/syllabuscheck/engine.js');
  assert.match(engine, /\['c2', 'assessment', fit\.assessmentPairs\]\]\) \{\s*if \(!flags\[flag\] \|\| identityStop \|\| !semantic\.judgements\?\.length \|\| \(semantic\.failure && semantic\.failure\.kind !== 'invalid_output'\)/, 'C1 and C2 still skip when a scored field is empty');
  assert.match(engine, /!\(semantic\.failure && !\['invalid_output', 'insufficient_text'\]\.includes\(semantic\.failure\.kind\)\)/, 'C3 is asked when only text is missing (section 6)');
});
