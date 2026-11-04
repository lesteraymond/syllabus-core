const test = require('node:test');
const assert = require('node:assert/strict');
const { sample } = require('./fixtures');
const { run, coded } = require('./engine');
const { pairsOf } = require('./gemini');

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

test('each program has its own authoritative POs: the CLO is judged against the MASTER text, and a syllabus carrying another program\'s POs is blocked', async () => {
  const { content, masters } = sample();
  const other = structuredClone(masters);
  other.pos = masters.pos.map(po => ({ ...po, text: `${po.text} (the other program's wording)` }));

  const ownPairs = pairsOf(content, masters).filter(p => p.id === 'clo0-po1');
  const otherPairs = pairsOf(content, other).filter(p => p.id === 'clo0-po1');
  assert.equal(ownPairs[0].source, masters.pos.find(po => po.no === 1).text);
  assert.equal(otherPairs[0].source, other.pos.find(po => po.no === 1).text, 'the source is the master of the program being checked');
  assert.notEqual(ownPairs[0].source, otherPairs[0].source);
  assert.notEqual(otherPairs[0].source, content.outcomes.pos.find(po => po.no === 1).text, 'not the copy that came with the syllabus');

  assert.ok(!ruleIds({ findings: coded(content, masters).findings }).includes('PO-EXACT'));
  const wrong = coded(content, other).findings.find(f => f.ruleId === 'PO-EXACT');
  assert.ok(wrong, 'a syllabus whose POs differ from the program master is refused');
  assert.equal(wrong.severity, 'blocking');
  assert.deepEqual(wrong.replacement, other.pos, 'and the suggested fix is the master list, not AI text');
});

test('a program with no official POs is reported as unavailable; nothing is invented and no PO text is sent to the AI', async () => {
  const { content, masters } = sample();
  const none = structuredClone(masters);
  none.pos = [];
  assert.ok(coded(content, none).findings.some(f => f.ruleId === 'PO-MASTER' && f.severity === 'blocking'));
  const { sent, transport } = recording();
  await run(content, none, { ...options, transport });
  assert.ok(sent.length > 0, 'the AI was still asked about the other relationships');
  assert.ok(!sent.some(p => p.type === 'CLO-PO'), 'there is no PO text to compare, so no CLO-PO pair was sent');
  assert.ok(!sent.some(p => p.type === 'CLO-anyPO'), 'and no empty PO list');
});

test('a CLO tagged to a PO or EGA that does not exist is reported, and the missing text is not made up or sent', async () => {
  const { content, masters } = sample();
  content.clos[0].pos = [1, 99];
  content.clos[0].egas = [1, 77];
  const found = coded(content, masters).findings.filter(f => f.ruleId === 'CLO-MAP');
  assert.ok(found.length >= 2 && found.every(f => f.severity === 'blocking'));
  const pairs = pairsOf(content, masters);
  assert.equal(pairs.find(p => p.id === 'clo0-po99').source, '', 'no invented outcome text');
  assert.equal(pairs.find(p => p.id === 'clo0-ega77').source, '');
  const { sent, transport } = recording();
  await run(content, masters, { ...options, transport });
  assert.ok(!sent.some(p => p.id === 'clo0-po99' || p.id === 'clo0-ega77'), 'the AI is not asked to judge a tag that does not exist');
  assert.ok(sent.some(p => p.id === 'clo0-po1'), 'the valid tag still is judged');
});

test('a CLO with no PO or no EGA tag is blocked', () => {
  const { content, masters } = sample();
  content.clos[0].pos = [];
  content.clos[1].egas = [];
  const ids = coded(content, masters).findings.filter(f => f.ruleId === 'CLO-MAP').map(f => f.path);
  assert.ok(ids.includes('clos[0].pos') && ids.includes('clos[1].egas'), ids.join(','));
});

test('every ILO must be tagged to at least one EXISTING CLO; one tag that does not exist is reported and not judged', async () => {
  const { content, masters } = sample();
  content.plan[0].ilos[0].tags = [];
  content.plan[1].ilos[0].tags = ['clo:does-not-exist'];
  const found = coded(content, masters).findings.filter(f => f.ruleId === 'ILO-MAP');
  assert.equal(found.length, 2);
  assert.ok(found.every(f => f.severity === 'blocking'));
  const pair = pairsOf(content, masters).find(p => p.id === 'row1-ilo0-clo:does-not-exist');
  assert.equal(pair.source, '', 'no CLO text was invented for it');
  const { sent, transport } = recording();
  await run(content, masters, { ...options, transport });
  assert.ok(!sent.some(p => p.id === 'row1-ilo0-clo:does-not-exist'));
});

test('academic meaning is judged on top of tag existence: valid tags with the wrong meaning still get a finding and a rewrite', async () => {
  const { content, masters } = sample();
  assert.ok(!coded(content, masters).findings.some(f => ['CLO-MAP', 'ILO-MAP'].includes(f.ruleId)), 'every tag exists');
  const { transport } = recording(p => (p.type === 'CLO-PO' || p.type === 'CLO-anyPO' ? 'NOT_ALIGNED' : 'ALIGNED'));
  const result = await run(content, masters, { ...options, transport });
  assert.ok(result.findings.some(f => f.ruleId === 'SEM' && /^SEM:clo\d+-po\d+$/.test(f.id)), 'the meaning is flagged');
  assert.ok(result.hybrid.suggestions.some(s => s.source === 'ai' && /^clos\[\d+\]\.statement$/.test(s.path)), 'with a suggestion for the CLO statement');
});

test('AI suggestions can only target the text fields the author owns: never a tag, a master text or an official identifier', async () => {
  const { content, masters } = sample();
  const { transport } = recording(() => 'NOT_ALIGNED');
  const result = await run(content, masters, { ...options, transport });
  const allowed = /^(?:description|clos\[\d+\]\.statement|plan\[\d+\]\.(?:values|contents|activities|tasks)|plan\[\d+\]\.ilos\[\d+\]\.text)$/;
  const ai = result.hybrid.suggestions.filter(s => s.source === 'ai');
  assert.ok(ai.length > 0);
  for (const s of ai) assert.match(s.path, allowed, 'AI suggestion path ' + s.path);
  assert.ok(!ai.some(s => /pos|egas|tags|meta|outcomes|vision|mission/.test(s.path)));
});

test('Vision, Mission and EGAs must equal the institution\'s, and the fix offered is the institution\'s own text', () => {
  const { content, masters } = sample();
  content.outcomes.vision = 'A vision an author wrote themselves';
  const found = coded(content, masters).findings.find(f => f.ruleId === 'INST-EXACT' && f.path === 'outcomes.vision');
  assert.ok(found && found.severity === 'blocking');
  assert.equal(found.replacement, masters.institution.vision);
});
