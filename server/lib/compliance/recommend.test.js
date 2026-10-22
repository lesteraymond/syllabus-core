// Run: npm test (from the project root)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { evaluate } = require('./rules');
const { recommend, validateItems, buildExcerpt, redact, ruleRecommendations, linksOf } = require('./recommend');
const { MockProvider, LlmProvider, ProviderError, PROMPT_VERSION } = require('./providers');
const { contentHash } = require('./hash');
const standard = require('./standard-v4.json');
const F = require('./fixtures');

const resultOf = (c) => evaluate(c, standard, F.ctx());
const bad = () => resultOf(F.bad());
const run = (provider, content = F.bad(), extra = {}) => recommend({ provider, result: resultOf(content), content, standard, ...extra });
const gap = (r, key) => { const a = r.areas.find((x) => x.key === key); return Math.round(((100 - a.score) / 100) * a.weight * 100) / 100; };

test('every rule has a short fix title that recommendations are worded from', () => {
  standard.rules.forEach((r) => assert.ok(typeof r.fix === 'string' && r.fix.length > 5 && r.fix.length < 100, r.id));
});

test('rule-based recommendations cite findings, link to a step, rows and CLOs, are ranked by gap x weight, and are capped at 7', () => {
  const r = bad();
  const items = ruleRecommendations(r, standard);
  assert.ok(items.length > 0 && items.length <= standard.recommendations.max);
  const ids = new Set(r.findings.map((f) => f.id));
  items.forEach((it) => {
    assert.strictEqual(it.source, 'rule');
    assert.ok(it.basedOn.length > 0 && it.basedOn.every((id) => ids.has(id)));
    assert.ok(['info', 'clos', 'plan', 'reqs', 'refs', 'grade', 'review'].includes(it.step));
    assert.ok(it.areas.length > 0 && it.areas.every((k) => standard.areas.some((a) => a.key === k)));
    assert.ok(['High', 'Medium', 'Low'].includes(it.level));
  });
  for (let i = 1; i < items.length; i++) assert.ok(items[i - 1].priority >= items[i].priority);
  assert.strictEqual(items[0].priority, Math.max(...items.map((i) => i.priority)));
  // an assessment finding is linked to its Learning Plan row and to the CLO it is about
  const a2 = items.find((i) => i.title === 'Assess every course learning outcome');
  assert.deepStrictEqual([a2.step, a2.areas, a2.clos, a2.rows], ['plan', ['assessment'], [2], []]);
  const a1 = items.find((i) => i.title === 'Add an assessment task to every lesson');
  assert.deepStrictEqual(a1.rows, [1, 2]);
});

test('a provider that works gives AI items; step, rows, CLOs and priority come from the cited findings, not from the model', async () => {
  const r = bad();
  const f = r.findings.find((x) => x.ruleId === 'A-02');
  const raw = [{ title: 'Tighten assessment', text: 'Add tasks.', basedOn: [f.id], priority: 99, level: 'High', score: 1, step: 'info', areas: ['template'], rows: [7], clos: [9] }];
  const out = await run(new MockProvider({ raw }));
  assert.strictEqual(out.source, 'ai');
  assert.strictEqual(out.ai.status, 'ok');
  assert.strictEqual(out.items.length, 1);
  const it = out.items[0];
  assert.strictEqual(it.priority, gap(r, 'assessment'));
  assert.deepStrictEqual([it.step, it.areas, it.rows, it.clos, it.source], ['plan', ['assessment'], [], [2], 'ai']);
  assert.deepStrictEqual(Object.keys(it).sort(), ['areas', 'basedOn', 'clos', 'level', 'priority', 'rows', 'source', 'step', 'steps', 'text', 'title']);
});

test('the mock writes one recommendation per failed rule, worded from the standard, each citing its findings', async () => {
  const out = await run(new MockProvider());
  assert.strictEqual(out.source, 'ai');
  assert.ok(out.items.length > 0 && out.items.length <= 7);
  const titles = standard.rules.map((r) => r.fix);
  out.items.forEach((it) => { assert.ok(titles.includes(it.title), it.title); assert.ok(it.basedOn.length > 0); });
  assert.deepStrictEqual(out, await run(new MockProvider())); // deterministic
});

test('items that cite no finding, an unknown finding, or are badly shaped are dropped', () => {
  const r = bad();
  const real = r.findings[0].id;
  const raw = [
    { title: 'ok', text: 'fine', basedOn: [real] },
    { title: 'no basedOn', text: 'x' },
    { title: 'empty basedOn', text: 'x', basedOn: [] },
    { title: 'made-up finding', text: 'x', basedOn: ['T-99:nowhere'] },
    { title: '', text: 'x', basedOn: [real] },
    { title: 'no text', basedOn: [real] },
    { title: 'OK', text: 'duplicate title', basedOn: [real] },
    'a string', null, 7, [],
  ];
  const { items, dropped } = validateItems(raw, r, standard);
  assert.deepStrictEqual(items.map((i) => i.title), ['ok']);
  assert.strictEqual(dropped, raw.length - 1);
  assert.deepStrictEqual(validateItems('nope', r, standard).items, []);
  assert.deepStrictEqual(validateItems([{ title: 't', text: 'x', basedOn: [real, 'bogus', real] }], r, standard).items[0].basedOn, [real]);
});

test('no more than seven recommendations are kept, lowest priority first to go', async () => {
  const r = bad();
  const raw = r.findings.slice(0, 14).map((f, i) => ({ title: 'Item ' + i, text: 't', basedOn: [f.id] }));
  const out = await run(new MockProvider({ raw }));
  assert.strictEqual(out.items.length, standard.recommendations.max);
  for (let i = 1; i < out.items.length; i++) assert.ok(out.items[i - 1].priority >= out.items[i].priority);
});

test('priority levels follow the thresholds in the standard', () => {
  const lvl = (p) => (p >= standard.recommendations.highAt ? 'High' : p >= standard.recommendations.mediumAt ? 'Medium' : 'Low');
  ruleRecommendations(bad(), standard).forEach((it) => assert.strictEqual(it.level, lvl(it.priority)));
});

test('when the provider throws, times out, or returns nothing usable, rule-based recommendations are used', async () => {
  const throwing = await run(new MockProvider({ fail: new ProviderError('boom', 'service down') }));
  assert.strictEqual(throwing.source, 'rule');
  assert.strictEqual(throwing.ai.status, 'failed');
  assert.strictEqual(throwing.ai.reason, 'boom');
  assert.ok(throwing.items.length > 0 && throwing.items.every((i) => i.source === 'rule'));

  const hung = await run(new MockProvider({ raw: () => new Promise(() => {}) }), F.bad(), { timeoutMs: 20 });
  assert.strictEqual(hung.ai.reason, 'timeout');
  assert.strictEqual(hung.source, 'rule');

  const junk = await run(new MockProvider({ raw: [{ title: 'x' }, 5] }));
  assert.strictEqual(junk.ai.reason, 'empty');
  assert.ok(junk.items.length > 0);

  const none = await run(null);
  assert.strictEqual(none.ai.reason, 'not_configured');
  assert.ok(none.items.length > 0);
});

test('the LLM stub fails closed without a client; with one it is parsed and validated like any provider', async () => {
  const off = await run(new LlmProvider());
  assert.strictEqual(off.ai.status, 'failed');
  assert.strictEqual(off.ai.reason, 'not_configured');
  assert.strictEqual(off.source, 'rule');

  const id = bad().findings[0].id;
  const seen = [];
  const reply = '```json\n' + JSON.stringify({ items: [{ title: 'Do it', text: 'Now.', basedOn: [id] }] }) + '\n```';
  const on = await run(new LlmProvider({ client: { complete: async (prompt) => { seen.push(prompt); return reply; } }, model: 'm-1' }));
  assert.strictEqual(on.source, 'ai');
  assert.deepStrictEqual([on.ai.provider, on.ai.model, on.ai.promptVersion], ['llm', 'm-1', PROMPT_VERSION]);
  assert.match(seen[0], new RegExp('Prompt version: ' + PROMPT_VERSION));
  assert.match(seen[0], /Do not give a priority, a score, a step or an area/);

  const garbage = await run(new LlmProvider({ client: { complete: async () => 'sure! here are some ideas' } }));
  assert.strictEqual(garbage.ai.reason, 'bad_output');
  assert.strictEqual(garbage.source, 'rule');
});

test('a provider never sees names, emails, phone numbers or the sign-off', async () => {
  const c = F.bad();
  c.description[0].t = 'Contact Prof. Juan Dela Cruz at juan.delacruz@school.edu or +63 917 123 4567 for details. Thanks to Fay Faculty and Maria.';
  c.signoff = { preparedBy: 'JUAN DELA CRUZ', checkedBy: 'MARIA SANTOS', approvedBy: 'PEDRO REYES' };
  c.refs.books.items.push({ id: 'z', t: 'Write to author@mail.com (2005). Book.' });
  let sent;
  await run(new MockProvider({ raw: (findings, excerpt) => { sent = JSON.stringify({ findings, excerpt }); return []; } }), c, { names: ['Fay Faculty', 'Maria Santos'] });
  assert.ok(sent);
  assert.doesNotMatch(sent, /juan\.delacruz@school\.edu|author@mail\.com/);
  assert.doesNotMatch(sent, /917 123 4567/);
  assert.doesNotMatch(sent, /JUAN DELA CRUZ|MARIA SANTOS|PEDRO REYES/i); // sign-off values never leave; only the field names appear in the sign-off finding
  assert.doesNotMatch(sent, /Dela Cruz|Fay|Faculty|Maria|Juan/); // titled names and the names the server lists are masked
  assert.match(sent, /\[name\]/);
  assert.match(sent, /\[email\]/);
  assert.strictEqual(redact('Revised 2026 and 2019'), 'Revised 2026 and 2019'); // years survive
  assert.ok(!('catalog' in buildExcerpt(F.good(), standard)));
});

test('an insufficient syllabus, or one with nothing to fix, does not call the provider', async () => {
  const p = new MockProvider();
  const out = await run(p, F.empty());
  assert.strictEqual(p.calls, 0);
  assert.deepStrictEqual(out.items, []);
  assert.strictEqual(out.ai.status, 'skipped');
  assert.strictEqual((await run(p, F.good())).ai.reason, 'no_findings');
  assert.strictEqual(p.calls, 0);
});

test('links read from the cited findings: step, rows, and CLOs numbered as printed', () => {
  const l = linksOf([
    { step: 'plan', area: 'assessment', path: 'plan[3].tasks' }, { step: 'plan', area: 'assessment', path: 'plan[1]' },
    { step: 'clos', area: 'co_po', path: 'clos[0].egas' }, { step: 'clos', area: 'co_po', path: 'refs' },
  ]);
  assert.deepStrictEqual(l, { step: 'plan', steps: ['plan', 'clos'], areas: ['assessment', 'co_po'], rows: [1, 3], clos: [1] });
});

test('content hash: stable, ignores key order, the snapshot and the sign-off, and changes when the content does', () => {
  const c = F.good();
  const h = contentHash(c, 'v4');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.strictEqual(contentHash(JSON.parse(JSON.stringify(c)), 'v4'), h);
  const reordered = { signoff: { x: 1 }, grading: c.grading, plan: c.plan, meta: c.meta, description: c.description, clos: c.clos, reqs: c.reqs, refs: c.refs, schemaVersion: 2, catalog: { y: 2 } };
  assert.strictEqual(contentHash(reordered, 'v4'), h);
  const edited = F.good();
  edited.plan[0].contents = 'Changed';
  assert.notStrictEqual(contentHash(edited, 'v4'), h);
  assert.notStrictEqual(contentHash(c, 'v5'), h);
});

test('schema.sql and the migration define the same compliance tables, with the columns the plan names', () => {
  const ddl = require('../../db/compliance-ddl');
  const sql = fs.readFileSync(path.join(__dirname, '../../db/schema.sql'), 'utf8').replace(/\s+/g, ' ');
  assert.strictEqual(ddl.length, 3);
  ddl.forEach((stmt) => {
    assert.ok(stmt.includes('CREATE TABLE IF NOT EXISTS'), 'idempotent');
    assert.ok(sql.includes(stmt.replace(/\s+/g, ' ').trim()), 'schema.sql differs from compliance-ddl.js');
  });
  ['syllabus_id', 'version_id', 'content_hash', 'standard_version', 'overall', 'status', 'provider', 'model', 'prompt_version'].forEach((col) => assert.ok(ddl[0].includes(col + ' '), col));
  assert.ok(ddl[0].includes('FOREIGN KEY (syllabus_id)') && ddl[0].includes('FOREIGN KEY (version_id)'));
  assert.ok(ddl[1].includes('area_key') && ddl[2].includes('rule_id') && ddl[2].includes('step'));
});

test('the prompt carries the LCUP rules and the six core values, and still cites findings only', () => {
  const { buildPrompt } = require('./providers');
  const prompt = buildPrompt([{ id: 'C-05:plan[0].values', ruleId: 'C-05' }], {}, standard);
  ['Compassion', 'Courage', 'Community-orientedness', 'Humility', 'Interiority', 'Missionary Spirit'].forEach((v) => assert.ok(prompt.includes(v), v));
  assert.match(prompt, /EGA/);
  assert.match(prompt, /basedOn/);
  assert.ok(prompt.length < 4000, 'the shared part stays short');
});
