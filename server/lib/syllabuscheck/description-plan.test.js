const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { run } = require('./engine');
const { pairsOf } = require('./gemini');

// The course description must describe what the Learning Plan teaches.
const options = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }), env: { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' } };
const check = async (content, masters, label, draft) => {
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    const answer = pair => ({
      id: pair.id, label: label(pair), explanation: 'Judged.', sourceQuote: pair.source.slice(0, 12), targetQuote: pair.target.slice(0, 12),
      sourceBloom: 'Apply', targetBloom: 'Apply', draft: label(pair) === 'ALIGNED' ? '' : draft,
    });
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
  return run(content, masters, { ...options, transport });
};

test('the course description is judged against the weekly contents of the whole Learning Plan', () => {
  const { content, masters } = sample();
  const pair = pairsOf(content, masters).find(p => p.type === 'Description-plan');
  assert.ok(pair, 'there is a description relationship');
  assert.equal(pair.path, 'description');
  assert.equal(pair.targetPath, 'description');
  const weeks = content.plan.filter(r => r.kind !== 'exam' && String(r.contents || '').trim());
  assert.ok(weeks.length > 0);
  assert.ok(weeks.every(r => pair.source.includes(`Week ${r.week}: ${String(r.contents).trim()}`)), 'every taught week is in the source');
  assert.equal(pair.target, content.description.map(d => d.t.trim()).filter(Boolean).join('\n\n'));
  const empty = structuredClone(content);
  empty.description = [{ id: 'd1', t: '' }];
  assert.ok(!pairsOf(empty, masters).some(p => p.type === 'Description-plan'), 'no description, nothing to compare');
});

test('a description that does not match the plan gets a rewrite that replaces the paragraphs, as a suggestion for the Course Information step', async () => {
  const { content, masters } = sample();
  const firstId = content.description[0].id;
  const result = await check(content, masters, p => (p.type === 'Description-plan' ? 'PARTIALLY_ALIGNED' : 'ALIGNED'), 'A description that names the topics the plan teaches.');
  const suggestion = result.hybrid.suggestions.find(s => s.path === 'description');
  assert.ok(suggestion, 'the description gets a suggestion');
  assert.deepEqual(suggestion.replacement, [{ id: firstId, t: 'A description that names the topics the plan teaches.' }]);
  assert.equal(suggestion.text, 'A description that names the topics the plan teaches.');
  assert.deepEqual(suggestion.originalValue, content.description, 'the suggestion records the paragraphs it replaces');
  const finding = result.findings.find(f => f.id === 'SEM:description-plan');
  assert.equal(finding.step, 'info');
  assert.equal(finding.severity, 'minor', 'advisory');
  assert.ok(!result.hybrid.deductions.some(d => d.id === 'SEM:description-plan'), 'an advisory verdict costs no points');
});

test('a description that matches the plan is left alone', async () => {
  const { content, masters } = sample();
  const result = await check(content, masters, () => 'ALIGNED', '');
  assert.ok(!result.hybrid.suggestions.some(s => s.path === 'description'));
});
