const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { run, coded } = require('./engine');

// The institutional alignment model must stay intact next to the AI work:
//  - Vision, Mission and EGAs are the institution's; the POs are the PROGRAM's. Neither is created or edited by an author.
//  - Each CLO is tagged to existing EGAs and POs of its program; each ILO is tagged to at least one existing CLO.
//  - An identifier that does not exist is reported, never invented, and the AI is not asked to judge text that is not there.
//  - Academic meaning is judged IN ADDITION to the tag being valid.
const options = { useAi: true, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }), env: { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only' } };
const recording = (label = () => 'ALIGNED') => {
  const sent = [];
  const transport = async (url, req) => {
    const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
    sent.push(...batch);
    const answer = p => ({ id: p.id, label: label(p), explanation: 'Judged.', sourceQuote: p.source.slice(0, 12), targetQuote: p.target.slice(0, 12), sourceBloom: 'Apply', targetBloom: 'Apply', draft: label(p) === 'ALIGNED' ? '' : 'A rewrite.' });
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
  };
  return { sent, transport };
};
const ruleIds = result => result.findings.map(f => f.ruleId);

test('a CLO with no PO or no EGA tag is blocked', () => {
  const { content, masters } = sample();
  content.clos[0].pos = [];
  content.clos[1].egas = [];
  const ids = coded(content, masters).findings.filter(f => f.ruleId === 'CLO-MAP').map(f => f.path);
  assert.ok(ids.includes('clos[0].pos') && ids.includes('clos[1].egas'), ids.join(','));
});

test('Vision, Mission and EGAs must equal the institution\'s, and the fix offered is the institution\'s own text', () => {
  const { content, masters } = sample();
  content.outcomes.vision = 'A vision an author wrote themselves';
  const found = coded(content, masters).findings.find(f => f.ruleId === 'INST-EXACT' && f.path === 'outcomes.vision');
  assert.ok(found && found.severity === 'blocking');
  assert.equal(found.replacement, masters.institution.vision);
});
