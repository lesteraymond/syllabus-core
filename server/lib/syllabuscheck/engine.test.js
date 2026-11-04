const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { run, coded } = require('./engine');
const { pairsOf, validate, align } = require('./gemini');
const { publicAddress, urlsOf, checkUrl } = require('./links');
const options = { useAi: false, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) };
test('unknown official course is a hard gate and caps the final score at zero', async () => {
  const { content, masters } = sample('invalid-course');
  let calls = 0;
  content.refs.online.items.push({ t: 'https://example.org/missing' });
  const report = await run(content, masters, { ...options, linkChecker: () => { throw Error('Critical mismatch must return before network calls'); }, transport: () => { calls++; throw Error('Must not call AI'); } });
  assert.equal(report.score, 0);
  assert.equal(report.hybrid.ready, false);
  assert.equal(calls, 0);
  assert.match(report.findings.find(f => f.ruleId === 'CUR-CODE').message, /CRITICAL MISMATCH: Course Code IE 204 does not exist in the official BSIE curriculum/);
});
test('missing/ambiguous curriculum is incomplete verification, not invented membership', () => {
  const { content, masters } = sample();
  const ref = masters.curricula[0];
  masters.curricula = [];
  assert.ok(coded(content, masters).findings.some(f => f.ruleId === 'CUR-REF'));
  masters.curricula = [ref, { ...ref, curriculumYear: 'another' }];
  delete content.meta.curriculumYear;
  assert.ok(coded(content, masters).findings.some(f => f.ruleId === 'CUR-REF'));
});
test('all official identity fields are enforced; code punctuation remains significant', () => {
  const { content, masters } = sample();
  for (const key of ['title', 'prereq', 'lecture', 'lab', 'yearLevel']) {
    const copy = structuredClone(content); copy.meta[key] = '999';
    assert.ok(coded(copy, masters).findings.some(f => f.path === `meta.${key}` && f.ruleId === 'CUR-FIELD'), key);
  }
  content.meta.code = 'IT 204-';
  assert.equal(coded(content, masters).critical, true);
});
test('institutional constants use exact text and provide exact master replacements', () => {
  const { content, masters } = sample();
  content.outcomes.vision += ' ';
  content.outcomes.mission.items[0] = 'Changed';
  content.outcomes.egas[0].name = 'Modified';
  const result = coded(content, masters);
  for (const key of ['vision', 'mission', 'egas']) {
    const suggestion = result.suggestions.find(s => s.path === `outcomes.${key}`);
    assert.deepEqual(suggestion.replacement, masters.institution[key]);
  }
});
test('missing headers, duplicate weeks, ILO numbering gaps and invalid grading hard-block', () => {
  const { content, masters } = sample();
  content.headers = [];
  content.plan[1].week = content.plan[0].week;
  content.plan[0].ilos.unshift({ text: '', tags: [] });
  content.grading.rows[0].pct = 55;
  const rules = coded(content, masters).findings.map(f => f.ruleId);
  for (const rule of ['HEADER', 'WEEK-DUP', 'ILO-GAP', 'GRADE-100']) assert.ok(rules.includes(rule), rule);
});
test('broken and redirected links reduce the actual final score by direct points', async () => {
  for (const status of ['broken', 'redirected']) {
    const { content, masters } = sample('broken-link');
    const result = await run(content, masters, { ...options, linkChecker: async url => ({ url, status }) });
    assert.equal(result.hybrid.deductions.find(d => d.id.startsWith('LINK:')).points, 2);
    assert.equal(result.hybrid.provisionalScore, result.baseScore - 2);
    assert.equal(result.score, null, 'No verified score before AI evaluation');
  }
});
test('unverifiable links block completion without calling them broken', async () => {
  const { content, masters } = sample('broken-link');
  const result = await run(content, masters, { ...options, linkChecker: async url => ({ url, status: 'unverifiable', reason: 'HTTP 403' }) });
  assert.equal(result.hybrid.ready, false);
  assert.ok(result.conformance.failed.some(f => f.ruleId === 'LINK'));
  assert.equal(result.hybrid.deductions.length, 0);
});
test('missing core value keeps its point deduction, but no value is chosen blindly: the field waits for the author (NEEDS_REVIEW)', async () => {
  const { content, masters } = sample(); content.plan[0].values = '';
  const result = await run(content, masters, options);
  assert.ok(result.hybrid.deductions.some(d => d.id === 'VALUE:plan[0].values' && d.points === 1));
  assert.ok(!result.hybrid.suggestions.some(s => s.path === 'plan[0].values'), 'no template value is offered');
  const open = result.hybrid.unresolved.find(u => u.path === 'plan[0].values');
  assert.equal(open.reason, 'value_needs_review'); assert.equal(open.status, 'NEEDS_REVIEW');
  // rollback switch: the old template comes back, and nothing official differs
  const legacy = await run(structuredClone(content), masters, { ...options, env: { SYLLABUS_CHECK_VALUE_SUGGESTION: 'legacy' } });
  assert.ok(legacy.hybrid.suggestions.some(s => s.path === 'plan[0].values' && s.replacement.includes('Compassion')));
  assert.deepEqual([legacy.score, legacy.passed, legacy.hybrid.ready, legacy.hybrid.deductions, legacy.conformance.failed.map(f => f.id), legacy.hybrid.summary.status], [result.score, result.passed, result.hybrid.ready, result.hybrid.deductions, result.conformance.failed.map(f => f.id), result.hybrid.summary.status]);
});
test('no Gemini or disabled Gemini can never enable submission, even for complete content', async () => {
  const { content, masters } = sample();
  const result = await run(content, masters, { ...options, env: {} });
  assert.equal(result.hybrid.alignment.status, 'not_evaluated');
  assert.equal(result.hybrid.ready, false);
  assert.ok(result.conformance.failed.some(f => f.ruleId === 'AI-REQUIRED'));
  assert.equal(result.status, 'incomplete');
  assert.equal(result.overall, null);
  assert.equal(result.band, null);
});
const answer = pair => ({ id: pair.id, label: 'NOT_ALIGNED', explanation: 'Assessment requires recall instead of creating a computing solution.', sourceQuote: pair.source.slice(0, 12), targetQuote: pair.target.slice(0, 12), sourceBloom: 'Create', targetBloom: 'Remember', draft: 'Construct a computing solution and demonstrate it using documented test cases.' });
test('Gemini cannot invent pair IDs, evidence or omit relationships', () => {
  const { content, masters } = sample('misaligned');
  const pairs = pairsOf(content, masters).slice(0, 2);
  assert.equal(validate({ judgements: pairs.map(answer) }, pairs).length, 2);
  assert.throws(() => validate({ judgements: [answer(pairs[0])] }, pairs));
  assert.throws(() => validate({ judgements: pairs.map(p => ({ ...answer(p), sourceQuote: 'fabricated evidence' })) }, pairs));
  assert.throws(() => validate({ judgements: pairs.map(p => ({ ...answer(p), id: 'invented' })) }, pairs));
});
test('semantic misalignment deductions change final payload and simulated evaluations never authorize submission', async () => {
  const { content, masters } = sample();
  const transport = async (url, req) => {
    const pairs = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: pairs.map(answer) }) }] } }] }) };
  };
  const result = await run(content, masters, { ...options, useAi: true, env: { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' }, transport, simulated: true });
  assert.ok(result.hybrid.deductions.some(d => d.id.startsWith('SEM:') && d.points === 3));
  assert.ok(result.hybrid.provisionalScore < result.baseScore);
  assert.equal(result.score, null);
  assert.equal(result.hybrid.ready, false);
});
const runWith = async (verdictOf) => {
  const { content, masters } = sample();
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    const reply = pair => { const v = verdictOf(pair); return { ...answer(pair), label: v.label, draft: v.draft || '' }; };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(reply) }) }] } }] }) };
  };
  return run(content, masters, { ...options, useAi: true, env: { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' }, transport });
};
const forField = (result, path) => result.hybrid.suggestions.filter(s => s.path === path);
test('relationships of DIFFERENT kinds that target the same field give one recommendation: the more serious kind supplies the draft, every finding is listed', async () => {
  // clos[0].statement is judged against POs and against EGAs. The POs are only partly aligned, the EGAs not at all.
  const result = await runWith(p => (/^clo0-(ega|anyega)/.test(p.id) ? { label: 'NOT_ALIGNED', draft: 'The draft for the graduate attributes.' } : /^clo0-(po|anypo)/.test(p.id) ? { label: 'PARTIALLY_ALIGNED', draft: 'The draft for the POs.' } : { label: 'ALIGNED' }));
  const one = forField(result, 'clos[0].statement');
  assert.equal(one.length, 1, 'one recommendation for the shared field');
  assert.equal(one[0].replacement, 'The draft for the graduate attributes.');
  assert.ok(['clo0-po1', 'clo0-po2', 'clo0-ega1', 'clo0-ega2'].every(id => one[0].basedOn.includes('SEM:' + id)), 'every flagged relationship is listed');
  const paths = result.hybrid.suggestions.map(s => s.path);
  assert.equal(new Set(paths).size, paths.length, 'no field has two recommendations');
  assert.ok(result.hybrid.deductions.filter(d => /^SEM:clo0-(po|ega)\d/.test(d.id)).length === 4, 'every relationship still counts toward the score');
});
test('within ONE group of tags (only one has to pass) the draft is written from the tag CLOSEST to aligned, not from the worst', async () => {
  // None of the CLO's PO tags is aligned. One is far (NOT_ALIGNED), one is close (PARTIALLY_ALIGNED). Only one has to pass, so the close one is the target.
  // (The whole-list question is not aligned either: if the CLO fitted ANY PO of the program, the group would already be satisfied and nothing would be asked.)
  const result = await runWith(p => (p.id === 'clo0-po1' ? { label: 'NOT_ALIGNED', draft: 'Rewrite toward the far PO.' } : p.id === 'clo0-po2' ? { label: 'PARTIALLY_ALIGNED', draft: 'Rewrite toward the close PO.' } : p.id === 'clo0-anypo' ? { label: 'NOT_ALIGNED', draft: 'Rewrite toward the best fit.' } : { label: 'ALIGNED' }));
  const one = forField(result, 'clos[0].statement');
  assert.equal(one.length, 1);
  assert.equal(one[0].replacement, 'Rewrite toward the close PO.');
  assert.ok(one[0].basedOn.includes('SEM:clo0-po1') && one[0].basedOn.includes('SEM:clo0-po2'), 'the far tag is still listed and still costs its points');
  assert.ok(result.hybrid.deductions.some(d => d.id === 'SEM:clo0-po1') && result.hybrid.deductions.some(d => d.id === 'SEM:clo0-po2'));
});
test('provider errors and invalid Gemini replies remain not evaluated', async () => {
  const { content, masters } = sample();
  const result = await align(content, masters, { env: { GEMINI_API_KEY: 'test-only' }, transport: async () => ({ ok: false, status: 429 }) });
  assert.equal(result.status, 'not_evaluated');
  assert.match(result.reason, /429/);
});
test('reference fetcher refuses private/encoded local destinations and extracts all unique URLs', async () => {
  for (const address of ['127.0.0.1', '10.1.1.1', '169.254.169.254', '::1', '::ffff:127.0.0.1', 'fc00::1']) assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress('8.8.8.8'), true);
  assert.equal((await checkUrl('http://2130706433/')).status, 'unverifiable');
  assert.deepEqual(urlsOf({ refs: { online: { items: [{ t: 'https://example.org/a. https://example.org/a.' }] } } }), ['https://example.org/a']);
});

// --- Advisory check: does a reference page fit the learning plan ---
const page = { title: 'Introduction to Calculus', text: 'Limits, continuity and derivatives explained with worked engineering examples.' };
const refLinker = async url => ({ url, status: 'ok', httpStatus: 200, page });
const refEnv = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' };
const refTransport = label => async (url, req) => {
  const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
  const reply = pair => ({ id: pair.id, label: pair.type === 'REF-plan' ? label : 'ALIGNED', explanation: 'Judged.', sourceQuote: pair.source.slice(0, 12), targetQuote: pair.target.slice(0, 12), sourceBloom: 'N/A', targetBloom: 'N/A', draft: '' });
  return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(reply) }) }] } }] }) };
};
const withLink = () => {
  const { content, masters } = sample();
  content.refs.online.items.push({ t: 'https://example.org/calculus' });
  return { content, masters };
};
test('only a reference page that was read becomes a relationship to judge, at most ten, with the course topics as the target', () => {
  const { content, masters } = withLink();
  const base = pairsOf(content, masters).length;
  const many = Array.from({ length: 14 }, (_, i) => ({ url: `https://example.org/${i}`, status: 'ok', page }));
  const refs = pairsOf(content, masters, [...many, { url: 'https://example.org/dead', status: 'broken' }, { url: 'https://example.org/unread', status: 'ok' }]).filter(p => p.type === 'REF-plan');
  assert.equal(refs.length, 10);
  assert.equal(pairsOf(content, masters, []).length, base, 'no links, no new relationships');
  assert.match(refs[0].source, /Introduction to Calculus/);
  assert.match(refs[0].target, new RegExp(content.meta.title.slice(0, 8)));
  assert.equal(refs[0].targetPath, null, 'there is no field to rewrite');
  assert.match(refs[0].path, /^refs:https:\/\/example\.org\//);
});
test('a reference that does not fit the plan is advice only: no points, no block, no rewrite, and the check still completes', async () => {
  const { content, masters } = withLink();
  const result = await run(content, masters, { useAi: true, env: refEnv, linkChecker: refLinker, transport: refTransport('NOT_ALIGNED') });
  assert.equal(result.hybrid.alignment.status, 'completed');
  assert.ok(result.hybrid.alignment.judgements.some(j => j.type === 'REF-plan' && j.label === 'NOT_ALIGNED'));
  assert.ok(!result.hybrid.deductions.some(d => d.id.includes('ref')), 'no points for a reference');
  const advice = result.findings.find(f => f.ruleId === 'REF-PLAN');
  assert.ok(advice);
  assert.equal(advice.severity, 'minor');
  assert.ok(!result.findings.some(f => f.ruleId === 'AI-REQUIRED'));
  assert.ok(!result.hybrid.suggestions.some(s => /refs/.test(s.path)));
});
test('a reference the AI cannot judge does not hold the check open', async () => {
  const { content, masters } = withLink();
  const result = await run(content, masters, { useAi: true, env: refEnv, linkChecker: refLinker, transport: refTransport('INSUFFICIENT_EVIDENCE') });
  assert.equal(result.hybrid.alignment.status, 'completed');
  assert.ok(!result.findings.some(f => f.severity === 'blocking' && f.ruleId === 'SEM'));
});
test('a page summary keeps the title and readable text and drops scripts, styles and markup', () => {
  const { pageSummary } = require('./links');
  const s = pageSummary('<html><head><title>Limits &amp; Continuity</title><script>var x=1;</script></head><body><style>p{}</style><h1>Welcome</h1><p>Derivatives&nbsp;explained.</p><script>alert(1)</script></body></html>');
  assert.equal(s.title, 'Limits & Continuity');
  assert.equal(s.text, 'Welcome Derivatives explained.');
  assert.ok(pageSummary('<p>' + 'a'.repeat(5000) + '</p>').text.length <= 1500);
});

test('a CLO needs one aligned PO and one aligned EGA: its other tags are advice only, with no points and no rewrite', async () => {
  const { content, masters } = sample();
  const clo = content.clos[0];
  clo.pos = [1, 2, 3]; clo.egas = [1, 2];
  masters.pos = content.outcomes.pos; // the sample catalog already carries these POs
  const pairs = pairsOf(content, masters).filter(p => /^clo0-(po|ega)/.test(p.id));
  assert.ok(pairs.length >= 4, 'the CLO is tagged to several POs and EGAs');
  const aligned = new Set([pairs.find(p => p.type === 'CLO-PO').id, pairs.find(p => p.type === 'CLO-EGA').id]);
  const reply = pair => ({ ...answer(pair), label: aligned.has(pair.id) || pair.type === 'Course-CLO' || pair.type === 'CLO-set' ? 'ALIGNED' : 'NOT_ALIGNED', draft: aligned.has(pair.id) ? '' : 'Rewrite for a loose tag.' });
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(reply) }) }] } }] }) };
  };
  const result = await run(content, masters, { ...options, useAi: true, env: { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' }, transport });
  const loose = pairs.filter(p => !aligned.has(p.id)).map(p => p.id);
  assert.ok(loose.length >= 2);
  assert.ok(!result.hybrid.deductions.some(d => loose.some(id => d.id === 'SEM:' + id)), 'a loose tag costs nothing');
  assert.ok(!result.hybrid.suggestions.some(s => s.path === 'clos[0].statement'), 'a loose tag does not rewrite the CLO');
  assert.equal(result.findings.filter(f => f.ruleId === 'SEM-TAG' && f.severity === 'minor').length, loose.length, 'each loose tag is shown as advice');
});

test('an ILO that builds one of its CLOs is accepted: its other CLO tags are advice only, with no points and no rewrite of the ILO', async () => {
  const { content, masters } = sample();
  assert.ok(content.clos.length >= 2);
  const row = content.plan.findIndex(r => r.kind !== 'exam' && (r.ilos || []).length);
  const ilo = content.plan[row].ilos[0];
  ilo.tags = content.clos.slice(0, 2).map(c => 'clo:' + c.id);
  const path = `plan[${row}].ilos[0].text`;
  const mine = pairsOf(content, masters).filter(p => p.type === 'ILO-CLO' && p.path === path);
  assert.equal(mine.length, 2, 'the ILO is tagged to two CLOs');
  const loose = mine[1].id;
  const reply = pair => ({ ...answer(pair), label: pair.id === loose ? 'NOT_ALIGNED' : 'ALIGNED', draft: pair.id === loose ? 'Rewrite for a loose tag.' : '' });
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(reply) }) }] } }] }) };
  };
  const result = await run(content, masters, { ...options, useAi: true, env: { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' }, transport });
  assert.ok(!result.hybrid.deductions.some(d => d.id === 'SEM:' + loose), 'a loose CLO tag costs nothing');
  assert.ok(!result.hybrid.suggestions.some(s => s.path === path), 'a loose CLO tag does not rewrite the ILO');
  assert.equal(result.findings.filter(f => f.ruleId === 'SEM-TAG' && f.id === 'TAG:' + loose).length, 1, 'it is shown as advice');
});

test('the course contents are judged against each ILO, and the Marian value against the lesson ILOs as well', () => {
  const { content, masters } = sample();
  const row = content.plan.findIndex(r => r.kind !== 'exam' && (r.ilos || []).some(i => String(i.text || '').trim()));
  const pairs = pairsOf(content, masters);
  const ilos = content.plan[row].ilos.filter(i => String(i.text || '').trim());
  const mine = pairs.filter(p => p.type === 'ILO-content' && p.path.startsWith(`plan[${row}].ilos[`));
  assert.equal(mine.length, content.plan[row].ilos.length, 'one content relationship per ILO');
  assert.ok(mine.every(p => p.targetPath === `plan[${row}].contents` && p.target === content.plan[row].contents));
  const value = pairs.find(p => p.id === `row${row}-value`);
  assert.ok(ilos.every(i => value.source.includes(i.text)), 'the value is judged against the lesson ILOs');
  assert.equal(value.targetPath, `plan[${row}].values`);
});
