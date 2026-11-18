const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { run, coded } = require('./engine');
const { publicAddress, urlsOf, checkUrl } = require('./links');
const options = { useAi: false, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) };
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
test('a page summary keeps the title and readable text and drops scripts, styles and markup', () => {
  const { pageSummary } = require('./links');
  const s = pageSummary('<html><head><title>Limits &amp; Continuity</title><script>var x=1;</script></head><body><style>p{}</style><h1>Welcome</h1><p>Derivatives&nbsp;explained.</p><script>alert(1)</script></body></html>');
  assert.equal(s.title, 'Limits & Continuity');
  assert.equal(s.text, 'Welcome Derivatives explained.');
  assert.ok(pageSummary('<p>' + 'a'.repeat(5000) + '</p>').text.length <= 1500);
});
