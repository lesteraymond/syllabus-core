// Replay of the one recorded REAL model run (IT 202 Computer Programming 1, Claude Sonnet 5.5, every stage off, 2026-11-05;
// docs/ai-checker-sample-comparison-2026-11-05/attempt-2/). The model's own answers are fed back, by relationship id, through today's engine.
// No provider, no network, no cost. It pins what a refactor of the pipeline must not move:
//   - the same relationships are asked, and every one is answered;
//   - the findings, deductions and points are exactly the recorded ones (85 deductions, 118 points);
//   - content first (VR-14, owner decision 2026-11-12): no ILO-content answer rewrites a week's course contents (the run proposed 10);
//   - every other rewrite the run proposed is still either offered or listed as waiting for the field above it (suggestion order).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { run } = require('./engine');
const { neutralCheckerEnv } = require('./eval/neutralCheckerEnv');

const DIR = path.join(__dirname, '..', '..', '..', 'docs', 'ai-checker-sample-comparison-2026-11-05', 'attempt-2');
const recorded = require(path.join(DIR, 'original-report.json')).hybrid;
const content = require(path.join(DIR, 'original.json'));
const masters = require(path.join(DIR, 'masters.json'));
const links = new Map(require(path.join(DIR, 'link-results.json')).map((l) => [l.url, l]));
const answers = new Map(recorded.alignment.judgements.map((j) => [j.id, j]));

async function replay(extraEnv = {}) {
  const asked = [];
  const unknown = [];
  const transport = async (url, req) => {
    const message = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text);
    const judgements = message.document_data.map((p) => {
      asked.push(p.id);
      const j = answers.get(p.id);
      if (!j) { unknown.push(`${p.id} (${p.type})`); return { id: p.id, label: 'ALIGNED', explanation: '', sourceQuote: '', targetQuote: '', sourceBloom: '', targetBloom: '', draft: '' }; }
      return { id: p.id, label: j.label, explanation: j.explanation, sourceQuote: j.sourceQuote, targetQuote: j.targetQuote, sourceBloom: j.sourceBloom, targetBloom: j.targetBloom, draft: j.draft || '' };
    });
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements }) }] } }] }) };
  };
  // Every SYLLABUS_CHECK_* switch blank (as in the recorded run: all stages off), whatever the developer's shell has set.
  const env = { ...neutralCheckerEnv(), SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only', ...extraEnv };
  const result = await run(content, masters, { env, useAi: true, evaluationOnly: true, transport, linkChecker: async (url) => links.get(url) || { url, status: 'unchecked' } });
  return { result, asked, unknown };
}

const key = (d) => `${d.id}:${d.points}:${d.reason}`;
const total = (ds) => ds.reduce((s, d) => s + d.points, 0);
const CONTENTS = /^plan\[\d+\]\.contents$/;

test('the same relationships are asked as in the real run, and every one is answered', async () => {
  const { result, asked, unknown } = await replay();
  assert.deepEqual(unknown, [], 'a relationship the real run never asked');
  assert.deepEqual(asked.slice().sort(), [...answers.keys()].sort());
  assert.equal(result.hybrid.alignment.status, 'completed');
  assert.equal(result.hybrid.alignment.judgements.length, recorded.alignment.judgements.length);
  for (const j of result.hybrid.alignment.judgements) assert.equal(j.label, answers.get(j.id).label, j.id);
});

test('the findings and points are exactly the recorded ones (85 deductions, 118 points)', async () => {
  const { result } = await replay();
  assert.equal(recorded.deductions.length, 85);
  assert.equal(total(recorded.deductions), 118);
  assert.deepEqual(result.hybrid.deductions.map(key).sort(), recorded.deductions.map(key).sort());
  assert.equal(result.hybrid.score, recorded.score);
  assert.equal(result.overall, require(path.join(DIR, 'original-report.json')).overall);
});

test('content first: no ILO-content answer rewrites the course contents, and those answers still stand as advisory findings', async () => {
  const { result } = await replay();
  const proposedBefore = recorded.suggestions.filter((s) => CONTENTS.test(s.path));
  assert.equal(proposedBefore.length, 10, 'the real run rewrote 10 weeks of contents from ILO-content answers');
  assert.deepEqual(result.hybrid.suggestions.filter((s) => CONTENTS.test(s.path)).map((s) => s.id), []);
  const iloContent = result.hybrid.alignment.judgements.filter((j) => j.type === 'ILO-content');
  assert.equal(iloContent.length, 20);
  assert.ok(iloContent.every((j) => !result.hybrid.deductions.some((d) => d.id === `SEM:${j.id}`)), 'ILO-content costs no points');
});

test('every other rewrite the run proposed is still offered, or listed as waiting for the field above it', async () => {
  const { result } = await replay();
  const offered = new Set(result.hybrid.suggestions.map((s) => s.path));
  const waiting = new Set(result.hybrid.unresolved.filter((u) => u.reason === 'waits_for_upstream').map((u) => u.path));
  const lost = recorded.suggestions.filter((s) => !CONTENTS.test(s.path) && !offered.has(s.path) && !waiting.has(s.path)).map((s) => s.path);
  assert.deepEqual(lost, []);
  // With the order switched off, the rewrites offered are the recorded ones without the contents.
  const { result: unordered } = await replay({ SYLLABUS_CHECK_SUGGESTION_ORDER: 'off' });
  const want = recorded.suggestions.filter((s) => !CONTENTS.test(s.path)).map((s) => s.path).sort();
  assert.deepEqual(unordered.hybrid.suggestions.map((s) => s.path).sort(), want);
});
