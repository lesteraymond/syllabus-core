const test = require('node:test');
const assert = require('node:assert/strict');
const { isTrivialRewrite, assessCorrections, summarize, textOf } = require('./stewardship');
const { correctionHistory } = require('./repository');
const { CRITERIA, tierOfType } = require('./acceptance');
const { POLICY } = require('./policy');
const { pairsOf, align, NEMOTRON_FREE } = require('./gemini');
const { refineSuggestion, getValue } = require('./refine');
const { sample } = require('./fixtures');

test('isTrivialRewrite: the same text, other case or punctuation, reordered words, or function words only change nothing; a content word does', () => {
  const t = 'Students design and test a program that solves the given problem.';
  assert.deepEqual(isTrivialRewrite(t, t), { trivial: true, reason: 'identical' });
  assert.equal(isTrivialRewrite(t, 'students design, and test a program that solves the given problem').reason, 'case_or_punctuation');
  assert.equal(isTrivialRewrite(t, 'Test and design a given problem that solves the program students.').reason, 'reordered');
  assert.equal(isTrivialRewrite(t, 'Students design and test their program that solves the given problem.').reason, 'function_words_only');
  assert.equal(isTrivialRewrite(t, t + ' Students justify the design.').trivial, false, 'new content');
  assert.equal(isTrivialRewrite('Design a system.', 'Design and test a system.').trivial, false, 'one new content word can be the missing piece');
  assert.equal(isTrivialRewrite('', 'Something new.').trivial, false);
  assert.equal(isTrivialRewrite('Explain recursion.', 'Explain recursion and give an example.').trivial, false);
});

test('isTrivialRewrite reads the description as one text', () => {
  const paragraphs = [{ id: 'd1', t: 'Limits and derivatives.' }, { id: 'd2', t: 'Applications.' }];
  assert.equal(textOf(paragraphs), 'Limits and derivatives.\n\nApplications.');
  assert.equal(isTrivialRewrite(paragraphs, 'Limits and derivatives.\n\nApplications.').trivial, true);
  assert.equal(isTrivialRewrite(paragraphs, 'Limits, derivatives, integrals and their applications.').trivial, false);
});

test('assessCorrections: resolved, improved, unresolved, regressed and unknown', () => {
  const j = (id, label, extra = {}) => ({ id, label, path: 'a', targetPath: 'a', ...extra });
  const last = (before) => ({ a: { runId: 4, basedOn: Object.keys(before), before } });
  const status = (before, judgements, previous = {}) => assessCorrections({ history: { attempts: { a: 1 }, last: last(before), previous }, judgements })[0].status;
  assert.equal(status({ x: 'PARTIALLY_ALIGNED' }, [j('x', 'ALIGNED')]), 'resolved');
  assert.equal(status({ x: 'NOT_ALIGNED', y: 'NOT_ALIGNED' }, [j('x', 'PARTIALLY_ALIGNED'), j('y', 'NOT_ALIGNED')]), 'improved');
  assert.equal(status({ x: 'PARTIALLY_ALIGNED' }, [j('x', 'PARTIALLY_ALIGNED')]), 'unresolved');
  assert.equal(status({ x: 'PARTIALLY_ALIGNED' }, [j('x', 'NOT_ALIGNED')]), 'regressed', 'the original got worse');
  assert.equal(status({ x: 'PARTIALLY_ALIGNED' }, [j('x', 'ALIGNED'), j('z', 'PARTIALLY_ALIGNED')], { z: 'ALIGNED' }), 'regressed', 'another relationship of the field newly fails');
  assert.equal(status({ x: 'PARTIALLY_ALIGNED' }, [j('x', 'ALIGNED'), j('z', 'PARTIALLY_ALIGNED')], { z: 'PARTIALLY_ALIGNED' }), 'resolved', 'one that was already flagged is not blamed on the correction');
  assert.equal(status({ x: 'PARTIALLY_ALIGNED' }, []), 'unknown');
  assert.equal(status({ x: 'PARTIALLY_ALIGNED' }, [j('x', 'ALIGNED', { unverified: true })]), 'unknown', 'an unverified answer proves nothing');
  assert.deepEqual(assessCorrections({ history: null, judgements: [] }), []);
});

test('summarize: required rules first, an unfinished AI check is never "no changes needed", optional advice never blocks that answer', () => {
  const f = (severity, ruleId = 'X') => ({ severity, ruleId });
  const base = { quality: { counts: { total: 3 } }, semanticCompleted: true };
  assert.equal(summarize({ ...base, findings: [] }).status, 'no_changes_needed');
  assert.equal(summarize({ ...base, findings: [f('minor')] }).status, 'no_changes_needed');
  assert.equal(summarize({ ...base, findings: [f('major')] }).status, 'material_open');
  assert.equal(summarize({ ...base, findings: [], missingValues: 2 }).status, 'material_open', 'a lesson with no core value costs points');
  assert.equal(summarize({ ...base, findings: [f('blocking')] }).status, 'mandatory_open');
  assert.equal(summarize({ ...base, findings: [f('blocking'), f('major')] }).status, 'mandatory_open');
  assert.equal(summarize({ ...base, semanticCompleted: false, findings: [f('blocking', 'AI-REQUIRED')] }).status, 'incomplete');
  assert.equal(summarize({ ...base, semanticCompleted: false, findings: [] }).status, 'incomplete');
  assert.equal(summarize({ ...base, semanticCompleted: false, findings: [f('blocking')] }).status, 'mandatory_open');
  assert.equal(summarize({ ...base, findings: [f('blocking', 'SEM')], semanticCompleted: false }).status, 'incomplete', 'an unverifiable AI answer is incomplete, not a failed required rule');
  const counts = summarize({ ...base, findings: [f('minor'), f('minor', 'SEM-TAG'), f('major')], unresolved: [{}], corrections: [{ status: 'regressed' }, { status: 'resolved' }] }).counts;
  assert.deepEqual(counts, { mandatory: 0, material: 1, optional: 4, unresolved: 1, regressed: 1 });
});

// ---- the history the engine reads, built from stored reports and decisions ----
const report = (id, labels, suggestions = []) => ({ run_id: id, report_json: JSON.stringify({ hybrid: { alignment: { judgements: Object.entries(labels).map(([jid, label]) => ({ id: jid, label })) }, suggestions } }) });
const fakeDb = ({ reports, decisions }) => ({ query: async (sql) => [sql.includes('syllabus_check_reports') ? reports : decisions] });
const sug = (id, path, basedOn) => ({ id: 'SEM:' + id, path, source: 'ai', basedOn: basedOn.map(b => 'SEM:' + b), replacement: 'x' });

test('correctionHistory counts the corrections the author applied, and an Undo takes one back', async () => {
  const s = sug('r0-act', 'plan[0].activities', ['r0-act']);
  const db = fakeDb({
    reports: [report(12, { 'r0-act': 'PARTIALLY_ALIGNED' }, [s]), report(11, { 'r0-act': 'PARTIALLY_ALIGNED' }, [s])], // newest first, as the query returns them
    decisions: [{ run_id: 11, suggestion_id: 'SEM:r0-act', action: 'accept' }, { run_id: 12, suggestion_id: 'SEM:r0-act', action: 'accept' }, { run_id: 12, suggestion_id: 'SEM:r0-act', action: 'reject' }],
  });
  const h = await correctionHistory(db, 1);
  assert.deepEqual(h.attempts, { 'plan[0].activities': 1 }, 'run 11 applied it; run 12 accepted and then undid it');
  assert.deepEqual(h.last['plan[0].activities'], { runId: 11, basedOn: ['r0-act'], before: { 'r0-act': 'PARTIALLY_ALIGNED' } });
  assert.deepEqual(h.previous, { 'r0-act': 'PARTIALLY_ALIGNED' });
});

test('correctionHistory starts counting again once the field has passed, and ignores rule suggestions and unverified answers', async () => {
  const s = sug('r0-act', 'plan[0].activities', ['r0-act']);
  const rule = { id: 'CUR-FIELD:meta.title', path: 'meta.title', source: 'rule', replacement: 'x' };
  const db = fakeDb({
    reports: [report(13, { 'r0-act': 'PARTIALLY_ALIGNED' }, [s, rule]), report(12, { 'r0-act': 'ALIGNED' }), report(11, { 'r0-act': 'PARTIALLY_ALIGNED' }, [s, rule])],
    decisions: [{ run_id: 11, suggestion_id: 'SEM:r0-act', action: 'accept' }, { run_id: 11, suggestion_id: 'CUR-FIELD:meta.title', action: 'accept' }, { run_id: 13, suggestion_id: 'SEM:r0-act', action: 'edit' }],
  });
  const h = await correctionHistory(db, 1);
  assert.deepEqual(h.attempts, { 'plan[0].activities': 1 }, 'the correction of run 11 passed at run 12, so only the one of run 13 counts');
  assert.ok(!h.attempts['meta.title'], 'a rule suggestion is the exact official value and has no attempt limit');
});

test('correctionHistory with no stored checks, or a database problem, is simply no history', async () => {
  const none = { attempts: {}, last: {}, previous: {} };
  assert.deepEqual(await correctionHistory(fakeDb({ reports: [], decisions: [] }), 1), none);
  assert.deepEqual(await correctionHistory({ query: async () => { throw new Error('ER_NO_SUCH_TABLE'); } }, 1), none);
  assert.deepEqual(await correctionHistory(fakeDb({ reports: [{ run_id: 1, report_json: 'not json' }], decisions: [] }), 1), none);
});

test('acceptance criteria exist for every relationship the checker judges, and the tier follows the policy', () => {
  const { content, masters } = sample();
  const link = { url: 'https://example.org/b', status: 'ok', page: { title: 'Notes', text: 'Limits.' } };
  const types = [...new Set(pairsOf(content, masters, [link]).map(p => p.type))];
  for (const type of types) {
    assert.ok(CRITERIA[type] && CRITERIA[type].criteria.length > 0 && CRITERIA[type].resolvedWhen, 'criteria for ' + type);
    assert.equal(CRITERIA[type].tier, tierOfType(type), type);
  }
  for (const type of POLICY.advisoryTypes) assert.equal(tierOfType(type), 'optional', type);
  assert.equal(tierOfType('REF-plan'), 'optional');
  for (const type of ['CLO-PO', 'CLO-EGA', 'ILO-CLO', 'ILO-activity', 'ILO-assessment', 'Module-value']) { assert.equal(tierOfType(type), 'material', type); assert.equal(CRITERIA[type].resolvedWhen, 'ALIGNED'); }
  for (const type of ['CLO-PO', 'CLO-EGA', 'ILO-CLO']) assert.match(CRITERIA[type].group, /ONE/, 'the "one is enough" rule is part of the criteria: ' + type);
});

// ---- "Check & improve" must not call a no-op an improvement ----
const env = { SYLLABUS_CHECK_AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'test-only-router-key', OPENROUTER_MODEL: NEMOTRON_FREE };
const reply = (content) => ({ ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }) });
test('Check & improve refuses a proposal that changes nothing, does not count it as an improvement, and says so', async () => {
  const { content, masters } = sample();
  const verdict = (p) => ({ id: p.id, label: 'PARTIALLY_ALIGNED', explanation: 'Partly.', sourceQuote: p.source.slice(0, 6), targetQuote: p.target.slice(0, 6), sourceBloom: 'Apply', targetBloom: 'Apply', draft: 'A fuller CLO.' });
  const asked = { judge: 0, rewrite: 0 };
  const transport = async (url, request) => {
    const payload = JSON.parse(JSON.parse(request.body).messages[1].content).document_data;
    if (Array.isArray(payload)) { asked.judge += payload.length; return reply({ judgements: payload.map(verdict) }); }
    asked.rewrite += 1;
    return reply({ text: getValue(content, 'clos[0].statement') }); // the model "rewrites" it to the very same text
  };
  const report = { hybrid: { alignment: await align(content, masters, { env, transport }) } };
  asked.judge = 0;
  const original = getValue(content, 'clos[0].statement');
  const out = await refineSuggestion({ content, masters, report, suggestion: { id: 'SEM:x', path: 'clos[0].statement', source: 'ai', originalValue: original, replacement: original }, options: { env, transport } });
  assert.equal(out.status, 'blocked');
  assert.equal(out.reason, 'no_meaningful_change');
  assert.equal(out.usedRewrite, false);
  assert.equal(out.stats.improved, 0);
});
