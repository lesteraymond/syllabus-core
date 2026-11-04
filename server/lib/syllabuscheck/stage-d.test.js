// Stage D: D1 Marian-Augustinian values (Value-use, VAL-04) and D2 APA 7 references (deterministic format, Ref-relevance). Advisory, behind
// SYLLABUS_CHECK_STAGE_D1 / _D2, off by default. No test here reaches a real provider.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sample } = require('./fixtures');
const { run } = require('./engine');
const gemini = require('./gemini');
const { align, PROMPT, resetProviderBlock, blockedNow, aspectKeysFor, alignmentSchema, ASPECT_KEYS } = gemini;
const { promptFor } = require('./variants');
const { stageFlags, stageLabel, trimOn } = require('./stages');
const values = require('./values');
const refs = require('./references');
const aspects = require('./aspects');
const fit = require('./lessonfit');
const { buildVerdict } = require('./verdict');

test.afterEach(() => resetProviderBlock());
const KEY = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' };
const D1 = { ...KEY, SYLLABUS_CHECK_STAGE_D1: 'on' }, D2 = { ...KEY, SYLLABUS_CHECK_STAGE_D2: 'on' }, BOTH = { ...D1, SYLLABUS_CHECK_STAGE_D2: 'on' };
const noDefs = { SYLLABUS_CHECK_VALUES_FILE: path.join(os.tmpdir(), 'no-such-values-file.json') };
const base = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) };
function model(decide, env) {
  const asked = [];
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    asked.push(...batch.map(p => p.type + ':' + p.id));
    const answer = pair => { const v = decide(pair) || { label: 'ALIGNED' }; return { id: pair.id, label: v.label, explanation: v.explanation || 'Judged.', sourceQuote: pair.source.slice(0, 14), targetQuote: pair.target.slice(0, 14), sourceBloom: 'N/A', targetBloom: 'N/A', draft: v.draft || '', ...Object.fromEntries(aspectKeysFor(stageFlags(env)).map(k => [k, 'not_assessed'])), ...(v.fields || {}) }; };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
  return { transport, asked };
}
const exec = (content, masters, decide, env, extra = {}) => { const m = model(decide, env); return run(content, masters, { ...base, env: { ...noDefs, ...env }, ...extra, transport: m.transport }).then(result => ({ result, asked: m.asked })); };
const USE = { valueUse: 'integrated', carriedBy: 'activity', valueFit: 'fits', responsible: 'none' };
function lesson(valueText = 'Humility: in the peer code review each student names one thing to improve and accepts the reviewer\'s comments.') {
  const { content, masters } = sample();
  const row = content.plan[2];
  row.contents = 'Java conditional statements: if, if-else, nested if and switch';
  row.ilos[0].text = 'Develop and test Java programs that use if-else and switch statements to make decisions.';
  row.activities = '- Pair programming with a peer code review.'; row.tasks = '- Programming task: write and test an if-else program.'; row.values = valueText;
  return { content, masters };
}

// ---------------- flags, wording, cache ----------------
test('with the D flags off the prompt is the alignment-10 prompt byte for byte; each D flag adds only its own wording and its own cache version', () => {
  const off = promptFor(PROMPT, 'current', stageFlags({}));
  assert.equal(crypto.createHash('sha256').update(off).digest('hex'), '81d11a069d91ee47c7171bd941f05867d73e6423eebf1ea9d8fa6c06f49d7262');
  assert.ok(!/Value-use|Ref-relevance/.test(off));
  const d1 = promptFor(PROMPT, 'current', stageFlags(D1)), d2 = promptFor(PROMPT, 'current', stageFlags(D2));
  assert.match(d1, /Value-use/); assert.ok(!/Ref-relevance/.test(d1));
  assert.match(d2, /Ref-relevance/); assert.ok(!/Value-use/.test(d2));
  assert.equal(stageLabel({}), '10'); assert.equal(stageLabel(stageFlags(D1)), '12d1-r7'); assert.equal(stageLabel(stageFlags(D2)), '12d2-r7');
  assert.deepEqual(stageFlags({}), { a: false, b: false, b3: false, b4: false, c1: false, c2: false, d1: false, d2: false });
});
test('the structured fields a request carries follow the stages that are on, and the Stage C schema is unchanged', () => {
  assert.deepEqual(aspectKeysFor({}), []);
  assert.deepEqual(aspectKeysFor({ c1: true }), ['teaching', 'learnerSupport', 'measures', 'evidence', 'level', 'responsible']);
  assert.deepEqual(aspectKeysFor({ d1: true }), ['responsible', 'valueUse', 'carriedBy', 'valueFit', 'coreValue', 'integration']);
  assert.deepEqual(aspectKeysFor({ d2: true }), ['relevance', 'basis']);
  assert.equal(alignmentSchema(false, false, false).properties.judgements.items.required.length, 8);
  assert.equal(alignmentSchema(false, false, true).properties.judgements.items.required.length, 14);
  assert.equal(alignmentSchema(false, false, aspectKeysFor({ d2: true })).properties.judgements.items.required.length, 10);
  for (const key of ['valueUse', 'carriedBy', 'valueFit', 'relevance', 'basis']) assert.ok(ASPECT_KEYS.includes(key));
});
test('the full prompt stays the baseline: the trim is off by default and does nothing unless a stage is on', () => {
  assert.equal(trimOn(BOTH), false);
  assert.equal(trimOn({ SYLLABUS_CHECK_PROMPT_TRIM: 'on' }), false);
  assert.equal(trimOn({ ...D1, SYLLABUS_CHECK_PROMPT_TRIM: 'on' }), true);
  assert.ok(!/-trim/.test(gemini.promptVersionOf('m', BOTH)));
});

// ---------------- HTTP 402 and 403 ----------------
test('HTTP 402 and 403 end the provider request at once, with no retry, no second batch and no request during the cooldown', async () => {
  for (const status of [402, 403]) {
    resetProviderBlock();
    const { content, masters } = lesson();
    let calls = 0;
    const transport = async () => { calls += 1; return { ok: false, status, json: async () => ({}) }; };
    const pair = values.valuePairs(content, [2], { status: 'not_supplied', definitions: {} });
    const first = await align(content, masters, { env: BOTH, transport, pairs: pair, concurrency: 1 });
    assert.equal(calls, 1, 'exactly one request for HTTP ' + status);
    assert.equal(first.failure.kind, 'provider_access'); assert.equal(first.failure.httpStatus, status);
    assert.equal(blockedNow().status, status);
    await align(content, masters, { env: BOTH, transport, pairs: pair, concurrency: 1 });
    assert.equal(calls, 1, 'nothing is sent during the cooldown');
  }
});

// ---------------- D1: the registry and the definitions ----------------
test('the six approved values are one list, in the order the scored check has always used, and only exact names are recognised', () => {
  assert.deepEqual([...values.VALUE_NAMES], ['Compassion', 'Courage', 'Community-orientedness', 'Humility', 'Interiority', 'Missionary Spirit']);
  assert.deepEqual(require('./engine').VALUES, [...values.VALUE_NAMES]);
  assert.deepEqual(values.namedValues('Humility and community orientedness'), ['Community-orientedness', 'Humility']);
  assert.deepEqual(values.namedValues('kindness, bravery, honesty'), [], 'no synonyms are guessed');
  assert.deepEqual(values.namedValues(''), []);
});
test('definitions are never invented: absent means not_supplied; a valid file is used; an invalid file is reported and ignored', () => {
  assert.equal(values.loadDefinitions(noDefs).status, 'not_supplied');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'values-')), file = path.join(dir, 'v.json');
  fs.writeFileSync(file, JSON.stringify({ version: 'test', approval: 'approved', source: 'a test fixture, NOT institutional wording', values: [{ name: 'Humility', definition: 'TEST DEFINITION' }] }));
  const ok = values.loadDefinitions({ SYLLABUS_CHECK_VALUES_FILE: file });
  assert.equal(ok.status, 'configured'); assert.equal(ok.definitions.Humility, 'TEST DEFINITION');
  const { content } = lesson();
  assert.match(values.valuePairs(content, [2], ok)[0].source, /TEST DEFINITION/);
  assert.match(values.valuePairs(content, [2], { status: 'not_supplied', definitions: {} })[0].source, /No institutional definition/);
  fs.writeFileSync(file, JSON.stringify({ values: [{ name: 'Honesty', definition: 'x' }] }));
  const bad = values.loadDefinitions({ SYLLABUS_CHECK_VALUES_FILE: file });
  assert.equal(bad.status, 'invalid'); assert.deepEqual(bad.definitions, {});
  fs.writeFileSync(file, '{ not json'); assert.equal(values.loadDefinitions({ SYLLABUS_CHECK_VALUES_FILE: file }).status, 'invalid');
});
test('only a lesson the scored Module-value answer judged ALIGNED, with sound earlier fields, is asked; exam rows and lessons naming no value are not', () => {
  const { content } = lesson();
  const J = (id, label) => ({ id, label, unverified: false });
  const judgements = [J('row2-value', 'ALIGNED')];
  assert.ok(values.eligible(content, judgements).asked.includes(2));
  assert.ok(values.eligible(content, [J('row2-value', 'NOT_ALIGNED')]).reused.includes(2) && !values.eligible(content, [J('row2-value', 'NOT_ALIGNED')]).asked.includes(2), 'the scored finding stands, nothing more is asked');
  assert.ok(values.eligible(content, [J('row2-value', 'ALIGNED'), J('row2-ilo0-activity', 'NOT_ALIGNED')]).upstream.includes(2));
  content.plan[2].values = 'be good';
  assert.ok(values.eligible(content, judgements).noValue.includes(2));
  assert.ok(!values.eligible(content, judgements).asked.some(i => content.plan[i].kind === 'exam'));
});

// ---------------- structured answers ----------------
test('Value-use and Ref-relevance labels must agree with their own fields; absent or invalid fields are never a pass', () => {
  const j = (type, label, v, extra = {}) => ({ type, label, aspects: { values: v, invalid: [], missing: [], ...extra } });
  assert.ok(aspects.contradictory(j('Value-use', 'ALIGNED', { valueUse: 'name_only', carriedBy: 'none', valueFit: 'fits' })));
  assert.ok(aspects.contradictory(j('Value-use', 'ALIGNED', { valueUse: 'integrated', carriedBy: 'activity', valueFit: 'clashes' })));
  assert.ok(aspects.contradictory(j('Value-use', 'NOT_ALIGNED', { valueUse: 'integrated', carriedBy: 'activity', valueFit: 'fits' })));
  assert.ok(!aspects.contradictory(j('Value-use', 'ALIGNED', USE)));
  assert.ok(aspects.contradictory(j('Ref-relevance', 'ALIGNED', { relevance: 'unrelated', basis: 'title_only' })));
  assert.ok(aspects.contradictory(j('Ref-relevance', 'NOT_ALIGNED', { relevance: 'relevant', basis: 'title_only' })));
  assert.ok(!aspects.contradictory(j('Ref-relevance', 'ALIGNED', { relevance: 'relevant', basis: 'title_and_venue' })));
  assert.equal(aspects.readAspects({ type: 'Value-use', label: 'ALIGNED' }).present, false);
  assert.ok(!aspects.contradictory({ type: 'CLO-PO', label: 'ALIGNED', aspects: { values: {} } }), 'other types are untouched');
});

// ---------------- D1 through the engine ----------------
test('D1 off: the engine asks no Value-use question and the report has no D1 output', async () => {
  const { content, masters } = lesson();
  const { result, asked } = await exec(content, masters, () => ({ label: 'ALIGNED' }), KEY);
  assert.ok(!asked.some(a => a.startsWith('Value-use:')));
  assert.equal(result.hybrid.valuesProfile, null);
});
test('D1 on: the scored Module-value answer is reused, the structured question is asked once for the lesson, and it is advisory (the official score does not move)', async () => {
  const { content, masters } = lesson();
  const off = await exec(structuredClone(content), masters, () => ({ label: 'ALIGNED' }), KEY);
  const on = await exec(content, masters, p => (p.type === 'Value-use' ? { label: 'ALIGNED', fields: USE } : { label: 'ALIGNED' }), D1);
  assert.equal(on.asked.filter(a => a === 'Module-value:row2-value').length, 1, 'the scored pair is not asked again');
  assert.equal(on.asked.filter(a => a === 'Value-use:row2-valueuse').length, 1);
  assert.equal(on.result.score, off.result.score); assert.equal(on.result.passed, off.result.passed);
  assert.equal(on.result.hybrid.stageD.d1.definitions, 'not_supplied');
  assert.ok(on.result.hybrid.verdict.counts.PASS >= off.result.hybrid.verdict.counts.PASS, 'a passing answer is counted, never listed');
});
test('D1: a value that is only named is not a pass, and the rewrite keeps the faculty text out of the model-written draft unless upstream is sound', async () => {
  const { content, masters } = lesson('Humility');
  const { result } = await exec(content, masters, p => (p.type === 'Value-use' ? { label: 'PARTIALLY_ALIGNED', explanation: 'Only the name is given.', fields: { valueUse: 'name_only', carriedBy: 'none', valueFit: 'partly', responsible: 'values' } } : { label: 'ALIGNED' }), D1);
  const f = result.hybrid.verdict.findings.filter(x => x.ruleId === 'VAL-03');
  assert.ok(f.length && f.every(x => x.status !== 'PASS'));
  assert.equal(content.plan[2].values, 'Humility', 'faculty content is never modified');
});
test('D1: a lesson whose assessment is not aligned gets no values rewrite', () => {
  const { content } = lesson();
  const j = [{ id: 'row2-value', label: 'ALIGNED', unverified: false }, { id: 'row2-content', label: 'ALIGNED', unverified: false }, { id: 'row2-ilo0-contentilo', label: 'ALIGNED', unverified: false }, { id: 'row2-ilo0-assessment', label: 'NOT_ALIGNED', unverified: false }];
  assert.equal(fit.draftWithheld('Module-value', 'row2-value', content, j, { d1: true }), 'assessment_invalid');
  assert.equal(fit.draftWithheld('Module-value', 'row2-value', content, j, {}), null, 'unchanged while D1 is off');
});
test('D1 profile: a copied statement is flagged; not every value is required; thresholds are labelled as proposals', () => {
  const { content } = lesson();
  const copied = 'Humility: students will practise humility.';
  content.plan.forEach(row => { if (row.kind !== 'exam') row.values = copied; });
  const profile = values.valuesProfile(content, []);
  assert.ok(profile.copied); assert.equal(profile.policy.approved, false);
  const v = buildVerdict({ hybrid: { valuesProfile: profile, alignment: { status: 'not_evaluated' } } }, content).findings.find(x => x.ruleId === 'VAL-04');
  assert.equal(v.status, 'NEEDS_REVIEW'); assert.ok(profile.valuesUsed.Humility > 0 && profile.valuesUsed.Courage === 0);
  const distinct = { plan: ['Humility: peer review of code', 'Courage: presenting unfinished work', 'Compassion: helping a struggling teammate'].map((v, i) => ({ kind: 'lesson', week: String(i + 1), contents: 'Topic ' + i, ilos: [{ text: 'Do thing ' + i, tags: [] }], values: v })) };
  const none = buildVerdict({ hybrid: { valuesProfile: values.valuesProfile(distinct, []), alignment: { status: 'not_evaluated' } } }, distinct).findings.find(x => x.ruleId === 'VAL-04');
  assert.equal(none.status, 'NOT_CHECKED', 'no verified lesson answer, no claim');
});

// ---------------- D2: format ----------------
const fixtures = require('./eval/reference-format-fixtures.json');
test('every deterministic APA 7 fixture gets the expected kind, status and issues (synthetic fixtures, not librarian-reviewed)', () => {
  for (const item of fixtures.items) {
    const r = refs.parseReference(item.text, { year: 2026 });
    assert.equal(r.type.kind, item.expectedKind, item.id); assert.equal(r.format.status, item.expectedStatus, item.id);
    assert.deepEqual(r.issues.map(i => i.code), item.expectedIssues, item.id);
  }
});
test('suggested repairs are mechanical: only characters already in the reference are used, and no bibliographic data is invented', () => {
  const doi = refs.parseReference('Doe, J., & Lee, K. (2020). A study of loops. Journal of Example Computing, 12(3), 45-67. doi:10.1234/example.2020.45');
  assert.match(doi.suggestedText, /https:\/\/doi\.org\/10\.1234\/example\.2020\.45$/);
  const and = refs.parseReference('Doe, J. and Lee, K. (2020). A study of loops. Journal of Example Computing, 12(3), 45-67.');
  assert.match(and.suggestedText, /^Doe, J\., & Lee, K\. \(2020\)/);
  const noDate = refs.parseReference('Doe, J. Title here. Example Press.');
  assert.equal(noDate.suggestedText, null, 'a missing date is never filled in');
  assert.equal(refs.parseReference('Doe, J. (2020). T. Journal of Example Computing, 12(3).').suggestedText, null, 'missing pages are never invented');
});
test('what cannot be decided is not passed: an unclear kind needs review, a blank entry is not checked, authenticity is never claimed without a check', () => {
  const unclear = refs.parseReference('Smith (2020) some web page http://example.com');
  assert.notEqual(unclear.format.status, 'PASS');
  assert.equal(refs.parseReference('   ').format.status, 'NOT_CHECKED');
  const good = refs.parseReference(fixtures.items[0].text, { year: 2026 });
  assert.equal(good.format.status, 'PASS'); assert.equal(good.authenticity.status, 'not_verified', 'a correct format is not authenticity');
});
test('the report covers books, program, online and electronic lists, skips N/A groups, and keeps a path per reference', () => {
  const { content } = sample();
  content.refs = { books: { na: false, items: [{ id: 1, t: fixtures.items[0].text }] }, program: { na: true, items: [{ id: 2, t: 'ignored' }] }, online: { na: false, items: [{ id: 3, t: fixtures.items[9].text }, { id: 4, t: '' }] }, electronics: { na: false, items: [] } };
  const report = refs.referenceReport(content, { year: 2026 });
  assert.deepEqual(report.map(r => r.path), ['refs.books.items[0]', 'refs.online.items[0]']);
});

// ---------------- D2: authenticity is a separate, opt-in, external question ----------------
test('authenticity: verified only when an external source agrees; unavailable leaves the reference not verified; nothing is fetched by default', async () => {
  const mk = () => refs.referenceReport({ refs: { books: { items: [{ t: 'Doe, J., & Lee, K. (2020). A study of loops. Journal of Example Computing, 12(3), 45-67. https://doi.org/10.1234/example.2020.45' }] } } }, { year: 2026 });
  const agree = await refs.verifyDois(mk(), async () => ({ message: { title: ['A study of loops'], issued: { 'date-parts': [[2020]] } } }));
  assert.equal(agree[0].authenticity.status, 'verified');
  const wrong = await refs.verifyDois(mk(), async () => ({ message: { title: ['Quantum cooking for beginners'], issued: { 'date-parts': [[1999]] } } }));
  assert.equal(wrong[0].authenticity.status, 'mismatch');
  const missing = await refs.verifyDois(mk(), async () => null);
  assert.equal(missing[0].authenticity.status, 'not_found');
  const down = await refs.verifyDois(mk(), async () => { throw new Error('offline'); });
  assert.equal(down[0].authenticity.status, 'unavailable');
  await assert.rejects(refs.crossrefFetch('https://evil.example/x'), /only Crossref/);
  let fetched = 0;
  const { content, masters } = sample(); content.refs = { books: { items: [{ t: 'Doe, J. (2020). A study. Example Press.' }] } };
  await exec(content, masters, () => ({ label: 'ALIGNED' }), D2, { refFetch: async () => { fetched += 1; return null; } });
  assert.equal(fetched, 0, 'no external lookup unless SYLLABUS_CHECK_REF_VERIFY=crossref');
});

// ---------------- D2 through the engine, offline and online ----------------
test('D2 offline: with no provider the deterministic format findings still exist, relevance and authenticity are honestly not checked', async () => {
  const { content, masters } = sample();
  content.refs = { books: { na: false, items: [{ id: 1, t: 'Doe, J. and Lee, K. (2020). A study of loops. Journal of Example Computing, 12(3), 45-67.' }] }, program: { na: true, items: [] }, online: { na: true, items: [] }, electronics: { na: true, items: [] } };
  const result = await run(content, masters, { ...base, useAi: false, env: { SYLLABUS_CHECK_STAGE_D2: 'on' } });
  const f = result.hybrid.verdict.findings;
  assert.ok(f.some(x => x.ruleId === 'REF-02' && x.status === 'FAIL'), 'the "and" between authors is found without a model');
  assert.ok(f.some(x => x.ruleId === 'REF-04' && x.status === 'NOT_CHECKED' && x.authenticity === 'not_verified'));
  assert.ok(!f.some(x => x.ruleId === 'REF-05' && x.status === 'PASS'));
});
test('D2 on: one relevance question per reference not already judged by a page; the answer is advice only and carries no draft', async () => {
  const { content, masters } = sample();
  content.refs = { books: { na: false, items: [{ id: 1, t: 'Rivera, M. A., & Santos, J. B. (2021). Fundamentals of Java programming (2nd ed.). Example University Press.' }, { id: 2, t: 'Reyes, L. (2018). Principles of marketing management. Example Press.' }] }, program: { na: true, items: [] }, online: { na: true, items: [] }, electronics: { na: true, items: [] } };
  const { result, asked } = await exec(content, masters, p => (p.type === 'Ref-relevance' ? (/marketing/.test(p.target) ? { label: 'NOT_ALIGNED', fields: { relevance: 'unrelated', basis: 'title_only' } } : { label: 'ALIGNED', fields: { relevance: 'relevant', basis: 'title_and_venue' } }) : { label: 'ALIGNED' }), D2);
  assert.equal(asked.filter(a => a.startsWith('Ref-relevance:')).length, 2);
  const rel = result.hybrid.verdict.findings.filter(x => x.ruleId === 'REF-05' && /refs\./.test(x.path || ''));
  assert.equal(rel.length, 2, 'the relevant source is also displayed when its evidence basis has an advisory warning');
  const failed = rel.find(x => x.status === 'FAIL'), reviewed = rel.find(x => x.status === 'PASS');
  assert.equal(failed.path, 'refs.books.items[1]');
  assert.deepEqual(reviewed.explanationReview, ['basis_overstated']);
  assert.ok(rel.every(x => !x.recommendation || !/Mechanical correction|Use:/.test(x.recommendation)), 'relevance never rewrites a reference');
  assert.ok(gemini.isNoRewrite('Ref-relevance'));
});
test('a provider refusal during D leaves the deterministic reference findings and sends no further request', async () => {
  const { content, masters } = lesson();
  content.refs = { books: { na: false, items: [{ id: 1, t: 'Doe, J. Title here. Example Press.' }] }, program: { na: true, items: [] }, online: { na: true, items: [] }, electronics: { na: true, items: [] } };
  let calls = 0;
  const transport = async () => { calls += 1; return { ok: false, status: 402, json: async () => ({}) }; };
  const result = await run(content, masters, { ...base, env: { ...noDefs, ...BOTH }, transport });
  const used = calls;
  assert.ok(result.hybrid.verdict.findings.some(x => x.ruleId === 'REF-03' && x.status === 'FAIL'));
  assert.equal(result.hybrid.stageD.d1, null); assert.equal(result.hybrid.stageD.d2, null);
  await run(structuredClone(content), masters, { ...base, env: { ...noDefs, ...BOTH }, transport });
  assert.equal(calls, used, 'nothing is sent during the cooldown');
});
