const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { run } = require('./engine');
const { pairsOf, isAdvisory } = require('./gemini');
const { POLICY } = require('./policy');

// Academic-quality relationships advise only: the official score and the completion of a check must not depend on them.
const options = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }), env: { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' } };
const check = async (content, masters, label) => {
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    const answer = pair => ({
      id: pair.id, label: label(pair), explanation: 'Judged.', sourceQuote: pair.source.slice(0, 12), targetQuote: pair.target.slice(0, 12),
      sourceBloom: 'Apply', targetBloom: 'Apply', draft: label(pair) === 'ALIGNED' ? '' : 'A rewrite.',
    });
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
  return run(content, masters, { ...options, transport });
};

test('the policy names the advisory relationships and REF-plan is always one', () => {
  assert.deepEqual([...POLICY.advisoryTypes].sort(), ['Activity-fit', 'Assessment-fit', 'CLO-anyEGA', 'CLO-anyPO', 'CLO-coverage', 'CLO-set', 'Content-ILO', 'Content-course', 'Course-CLO', 'Description-plan', 'ILO-anyCLO', 'ILO-content', 'Plan-sequence', 'Ref-relevance', 'Value-map', 'Value-use']);
  for (const type of [...POLICY.advisoryTypes, 'REF-plan']) assert.equal(isAdvisory(type), true, type);
  for (const type of ['CLO-PO', 'CLO-EGA', 'ILO-CLO', 'ILO-activity', 'ILO-assessment', 'Module-value']) assert.equal(isAdvisory(type), false, type);
});

test('the official score and deductions are exactly what they were when every advisory relationship is NOT_ALIGNED', async () => {
  const { content, masters } = sample();
  const scored = type => !isAdvisory(type);
  const allGood = await check(content, masters, () => 'ALIGNED');
  const advisoryBad = await check(content, masters, p => (scored(p.type) ? 'ALIGNED' : 'NOT_ALIGNED'));
  // The sample catalog is a synthetic test fixture, so its final `score` is always null; `provisionalScore` is the number it would show.
  assert.equal(advisoryBad.hybrid.provisionalScore, allGood.hybrid.provisionalScore, 'the score does not move');
  assert.deepEqual(advisoryBad.hybrid.deductions, allGood.hybrid.deductions);
  assert.equal(advisoryBad.hybrid.ready, allGood.hybrid.ready);
  assert.ok(pairsOf(content, masters).some(p => isAdvisory(p.type) && p.type !== 'REF-plan'), 'the sample has advisory relationships');
  assert.ok(advisoryBad.findings.some(f => f.ruleId === 'SEM' && f.severity === 'minor'), 'they still appear as minor findings');
  assert.ok(advisoryBad.hybrid.suggestions.length > allGood.hybrid.suggestions.length, 'and still give suggestions');
});

test('a scored relationship still costs what it always did', async () => {
  const { content, masters } = sample();
  const base = await check(content, masters, () => 'ALIGNED');
  const bad = await check(content, masters, p => (p.type === 'ILO-assessment' ? 'NOT_ALIGNED' : 'ALIGNED'));
  assert.ok(bad.hybrid.provisionalScore < base.hybrid.provisionalScore);
  assert.ok(bad.hybrid.deductions.every(d => d.points === POLICY.alignment));
});

test('an advisory answer that cannot be verified does not hold the check open or block it', async () => {
  const { content, masters } = sample();
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    const answer = pair => ({
      id: pair.id, label: 'ALIGNED', explanation: 'Judged.', sourceQuote: pair.type === 'ILO-content' ? 'text that is nowhere in the source' : pair.source.slice(0, 12),
      targetQuote: pair.target.slice(0, 12), sourceBloom: 'Apply', targetBloom: 'Apply', draft: '',
    });
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
  const result = await run(content, masters, { ...options, transport });
  const unverified = result.hybrid.alignment.judgements.filter(j => j.unverified);
  assert.ok(unverified.length > 0 && unverified.every(j => j.type === 'ILO-content'));
  assert.equal(result.hybrid.alignment.status, 'completed', 'an unverified advisory answer does not make the check incomplete');
  assert.ok(!result.findings.some(f => f.severity === 'blocking' && f.ruleId === 'SEM'));
  assert.equal(result.hybrid.deductions.length, 0, 'and costs nothing');
});
