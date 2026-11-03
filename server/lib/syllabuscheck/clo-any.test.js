const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { run } = require('./engine');
const { pairsOf } = require('./gemini');

// A CLO only has to align to ANY one PO and ANY one EGA of the whole lists. CLO-anyPO / CLO-anyEGA ask exactly that.
const options = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }), env: { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' } };
const reply = (pair, label, draft) => ({
  id: pair.id, label, explanation: 'Judged.', sourceQuote: pair.source.slice(0, 12), targetQuote: pair.target.slice(0, 12),
  sourceBloom: 'Apply', targetBloom: 'Apply', draft: label === 'ALIGNED' ? '' : draft(pair),
});
// `label(pair)` and `draft(pair)` decide the answer for one relationship; every other relationship is ALIGNED.
const check = async (content, masters, label, draft = () => 'a rewrite') => {
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(p => reply(p, label(p), draft)) }) }] } }] }) };
  };
  return run(content, masters, { ...options, transport });
};
const ofClo0 = pair => /^clo0-/.test(pair.id);

test('every CLO is also asked against the whole PO list and the whole EGA list', () => {
  const { content, masters } = sample();
  const pairs = pairsOf(content, masters).filter(p => /^clo\d+-any/.test(p.id));
  assert.equal(pairs.filter(p => p.type === 'CLO-anyPO').length, content.clos.length);
  assert.equal(pairs.filter(p => p.type === 'CLO-anyEGA').length, content.clos.length);
  const anyPo = pairs.find(p => p.id === 'clo0-anypo');
  assert.ok(masters.pos.every(po => anyPo.source.includes(po.text)), 'the source lists every PO of the program');
  assert.equal(anyPo.targetPath, 'clos[0].statement');
  assert.ok(masters.institution.egas.every(ega => pairs.find(p => p.id === 'clo0-anyega').source.includes(ega.name)), 'and every EGA');
});

test('a CLO that fits no PO or EGA gets one rewrite aimed at the best-fitting one, and the whole-list question costs no points of its own', async () => {
  const { content, masters } = sample();
  const result = await check(content, masters, p => (ofClo0(p) ? 'NOT_ALIGNED' : 'ALIGNED'), p => (/any(po|ega)$/.test(p.id) ? 'toward the best fit' : 'toward one tag'));
  const suggestion = result.hybrid.suggestions.find(s => s.path === 'clos[0].statement');
  assert.ok(suggestion, 'the CLO is given a suggestion');
  assert.equal(suggestion.replacement, 'toward the best fit', 'the rewrite aimed at the whole list wins over one written for a tag');
  assert.ok(!result.hybrid.deductions.some(d => /^SEM:clo0-any/.test(d.id)), 'the whole-list question deducts nothing');
  assert.ok(result.hybrid.deductions.some(d => /^SEM:clo0-(po|ega)\d/.test(d.id)), 'the tags it overlaps still cost their points');
});

test('a CLO that fits ANY PO and ANY EGA of the lists is accepted even if its own tags do not match: no points, no rewrite', async () => {
  const { content, masters } = sample();
  const result = await check(content, masters, p => (ofClo0(p) && !/any|course/.test(p.id) ? 'NOT_ALIGNED' : 'ALIGNED'));
  assert.ok(!result.hybrid.suggestions.some(s => s.path === 'clos[0].statement'), 'nothing is rewritten');
  assert.ok(!result.hybrid.deductions.some(d => /^SEM:clo0-/.test(d.id)), 'nothing is deducted');
});
