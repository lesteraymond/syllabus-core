'use strict';
// A Filipino-language subject (Dalumat sa Filipino, Panitikan ...): the generator writes it in Filipino and the checker reads it, and suggests fixes,
// in Filipino. Every other subject is handled exactly as before: same prompts, same prompt versions, same stored-answer keys, same verb reading.
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./rules');
const P = require('./prompt');
const G = require('./generate');
const J = require('./judge');
const { leadingVerbs, OUTCOME_VERBS, FILIPINO_VERBS } = require('./extract');

const FIL = { code: 'GE 12', title: 'Dalumat sa Filipino', program: 'BSCpE' };
const ENG = { code: 'CPE 201', title: 'Logic Circuits and Design', program: 'BSCpE' };

test('a Filipino subject is detected by its code or title; other subjects are not', () => {
  assert.equal(G.subjectOf({ meta: { title: 'Dalumat sa Filipino', code: 'GE 12' } }, {}, '').writeIn, 'Filipino');
  assert.equal(G.subjectOf({ meta: { title: 'Panitikan ng Pilipinas', code: 'LIT 1' } }, {}, '').writeIn, 'Filipino');
  assert.equal(G.subjectOf({ meta: { title: 'Any Title', code: 'FIL 101' } }, {}, '').writeIn, 'Filipino');
  assert.equal(G.subjectOf({ meta: { title: 'Logic Circuits and Design', code: 'CPE 201' } }, {}, '').writeIn, undefined);
  assert.equal(G.subjectOf({ meta: { title: 'Philippine History', code: 'GE 2' } }, {}, '').writeIn, undefined);
});

test('a subject taught in English is not taken for a Filipino one by three letters of its code or by the word Filipino in its title', () => {
  const english = [['FILM 101', 'Film Appreciation'], ['GE 101', 'Readings in Filipino History'], ['PSY 3', 'Filipino Psychology'], ['HUM 2', 'Filipino Culture at the Crossroads'], ['GE 2', 'READINGS IN PHILIPPINE HISTORY'], ['GE 9', 'THE LIFE AND WORKS OF RIZAL']];
  for (const [code, title] of english) assert.equal(R.isFilipinoSubject(title, code), false, `${code} ${title}`);
  const filipino = [['GE - ELECT KOMFIL', 'KONTEKSTWALISADONG KOMUNIKASYON SA FILIPINO'], ['GE - ELECT DL', 'DALUMAT SA FILIPINO'], ['GE - ELECT SOSLIT', 'SOSYEDAD AT LITERATURANG/ PANITIKANG PANLIPUNAN'], ['GE 5', 'Panimulang Linggwistika ng Filipino'], ['GE 6', 'Ang Filipino sa Agham'], ['GE 7', 'Filipino 1'], ['GE 8', 'Filipino II'], ['GE 8', 'FILIPINO']];
  for (const [code, title] of filipino) assert.equal(R.isFilipinoSubject(title, code), true, `${code} ${title}`);
  for (const code of ['FIL 101', 'FIL-101', 'fil101', ' FIL', 'FILIPINO 1']) assert.equal(R.isFilipinoSubject('Any Title', code), true, code);
  for (const code of ['FILM 101', 'FILTER 1', 'PROFIL 1', '', null, undefined]) assert.equal(R.isFilipinoSubject('Any Title', code), false, String(code));
});

test('generator: the Filipino rule is sent for a Filipino subject only; every other subject gets the English prompt as before', () => {
  assert.doesNotMatch(G.SYSTEM, /Filipino-language|formal academic Filipino|writeIn/);
  assert.match(G.SYSTEM, /in plain English\.'?/);
  assert.ok(G.SYSTEM_FIL.startsWith(G.SYSTEM), 'the Filipino prompt is the English one with the rule added at the end');
  assert.match(G.SYSTEM_FIL, /formal academic Filipino/);
  const fil = G.subjectOf({ meta: FIL }, {}, ''), eng = G.subjectOf({ meta: ENG }, {}, '');
  assert.equal(G.closMessage({ subject: fil, standards: { pos: [], egas: [] } }).system, G.SYSTEM_FIL);
  assert.equal(G.closMessage({ subject: eng, standards: { pos: [], egas: [] } }).system, G.SYSTEM);
  assert.doesNotMatch(G.closMessage({ subject: eng, standards: { pos: [], egas: [] } }).user, /writeIn/);
});

test('checker: English prompts and versions are unchanged; a Filipino syllabus gets its own prompt and version', () => {
  assert.equal(P.PROMPT_VERSION, 'replan-prompt-7');
  assert.equal(P.REWRITE_VERSION, 'replan-rewrite-5');
  assert.doesNotMatch(P.JUDGE_SYSTEM, /FILIPINO/);
  assert.doesNotMatch(P.REWRITE_SYSTEM, /FILIPINO|Filipino/);
  assert.match(P.REWRITE_SYSTEM, /ilo: One sentence in English, starting with ONE measurable verb/);
  assert.equal(P.promptVersionFor(ENG), P.PROMPT_VERSION);
  assert.equal(P.promptVersionFor(FIL), P.PROMPT_VERSION_FIL);
  assert.notEqual(P.PROMPT_VERSION_FIL, P.PROMPT_VERSION);
  assert.ok(P.JUDGE_SYSTEM_FIL.startsWith(P.JUDGE_SYSTEM));
  assert.match(P.JUDGE_SYSTEM_FIL, /never mark a text "no" or "unclear" because it is in Filipino/);
  assert.match(P.REWRITE_SYSTEM_FIL, /formal academic Filipino, never in English/);
});

test('checker messages: the judge and the rewrite pick the prompt by the course', () => {
  const q = { id: 'q1', relationship: 'ILO-CLO', from: { field: 'ilo', label: 'W2 ILO', text: 'x' }, to: [{ field: 'clo', label: 'CLO 1', text: 'y' }] };
  const eng = P.judgeMessage({ course: ENG, questions: [q] }), fil = P.judgeMessage({ course: FIL, questions: [q] });
  assert.equal(eng.system, P.JUDGE_SYSTEM); assert.equal(eng.promptVersion, P.PROMPT_VERSION);
  assert.equal(fil.system, P.JUDGE_SYSTEM_FIL); assert.equal(fil.promptVersion, P.PROMPT_VERSION_FIL);
  const job = { course: ENG, field: 'ilo', label: 'W2 ILO', text: 'x', parents: [], failures: [], children: [] };
  assert.equal(P.rewriteMessage(job).system, P.REWRITE_SYSTEM);
  assert.equal(P.rewriteMessage({ ...job, course: FIL }).system, P.REWRITE_SYSTEM_FIL);
});

test('stored answers: an English syllabus keeps its old keys; a Filipino one gets new keys', () => {
  const q = { relationship: 'ILO-CLO', from: { text: 'x' }, to: [{ label: 'CLO 1', text: 'y' }] };
  assert.equal(J.keyOf(q, 'CPE 201 Logic Circuits and Design', 'm'), J.keyOf(q, 'CPE 201 Logic Circuits and Design', 'm', P.PROMPT_VERSION));
  assert.notEqual(J.keyOf(q, 'GE 12 Dalumat sa Filipino', 'm', P.PROMPT_VERSION_FIL), J.keyOf(q, 'GE 12 Dalumat sa Filipino', 'm'));
});

test('every Bloom level has Filipino verbs, kept apart from the English verb list', () => {
  assert.deepEqual(R.BLOOM_ORDER_FIL.map(b => b.level), R.BLOOM_ORDER.map(b => b.level));
  for (const v of ['natutukoy', 'naipaliliwanag', 'nasusuri', 'nakabubuo', 'naiisa-isa', 'napahahalagahan']) assert.ok(FILIPINO_VERBS.has(v), v);
  assert.ok(!OUTCOME_VERBS.has('natutukoy'), 'the English list is unchanged');
});

test('one verb in Filipino: a single verb passes, two verbs joined by "at" or a comma are found', () => {
  assert.deepEqual(leadingVerbs('Nasusuri ang mga konsepto ng dalumat sa wikang Filipino.'), ['nasusuri']);
  assert.deepEqual(leadingVerbs('Natutukoy at naipaliliwanag ang mga batayang konsepto.'), ['natutukoy', 'naipaliliwanag']);
  assert.deepEqual(leadingVerbs('Sa pagtatapos ng kurso, ang mga mag-aaral ay inaasahang masuri, maihambing ang mga akda.'), ['masuri', 'maihambing']);
  assert.deepEqual(leadingVerbs('Naiisa-isa ang mga uri ng dalumat.'), ['naiisa-isa']);
});

test('one verb in English is read exactly as before ("at" and "o" are not joiners in English)', () => {
  assert.deepEqual(leadingVerbs('Define and explain the basic concepts.'), ['define', 'explain']);
  assert.deepEqual(leadingVerbs('Apply truth tables at each step.'), ['apply']);
  assert.deepEqual(leadingVerbs('Students will be able to design, implement, and test a circuit.'), ['design', 'implement', 'test']);
  assert.deepEqual(leadingVerbs('Self-assess the project.'), []);
});

test('the one-verb rule ranks Filipino verbs by their Bloom level, to name the higher one to keep', () => {
  const { higherOf } = require('./fixedRules');
  assert.equal(higherOf(['natutukoy', 'nasusuri']), 'nasusuri');
  assert.equal(higherOf(['nakabubuo', 'naipaliliwanag']), 'nakabubuo');
  assert.equal(higherOf(['define', 'explain']), 'explain');
});
