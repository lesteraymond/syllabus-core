'use strict';
// CPE 101 check #461 (2026-11-18): 96%, "Nothing to improve: every check passed", and no recommendation, although five problems were left:
//   - CLO 3 had no evidence in its weeks and a reference was off-topic: both the author's to fix, but listed as draft_needs_review, which the page reads as
//     "a static review found copied wording in the proposed rewrite";
//   - Week 1 was not the orientation and a reference was not APA 7: only in hybrid.replan.plan.manual, which the page never shows;
//   - CLO 4's classification had a ready mechanical fix, dropped because only AI drafts became recommendations.
// The same five problems on the new checker's conforming syllabus, offline (scripted model).
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('./rules');
const T = require('./testSyllabus');
const O = require('./official');
const engine = require('../engine');
const { sample } = require('../fixtures');

const answer = (q, no) => ({ q: q.id, items: R.CHECKLISTS[q.relationship].items.map(i => ({ id: i.id, answer: no.includes(i.id) ? 'no' : 'yes' })), quote: String(q.field.text).split(/\s+/).slice(0, 4).join(' '), explanation: 'scripted' });

async function report() {
  const content = T.conforming(), { masters } = sample();
  content.clos[3].level = 'Introductory'; // CLO 4 must be "Integration of Values": a mechanical fix
  content.plan[0].contents = 'Chromatic numbers and planar graphs'; // Week 1 is not the orientation: the author's
  content.plan[0].ilos[0].text = 'Apply chromatic numbers to graph coloring problems';
  content.refs.books.items.push({ id: 'b2', t: 'OFFTOPIC Reinhart, P. (2023). The bread baker\'s apprentice. Ten Speed Press.' }); // off-topic reference
  content.refs.books.items.push({ id: 'b3', t: 'Lecture notes PDF downloaded from a website by John with no year or publisher' }); // not APA, not repairable
  const cloEvidence = `CLO-EVIDENCE|clo:${content.clos[2].id}`;
  const ask = T.scriptedJudge({ override: q => (q.id === cloEvidence ? answer(q, ['tasks']) : undefined) });
  const noAi = await engine.run(content, masters, { env: {}, linkChecker: async url => ({ url, status: 'ok' }) });
  const provider = { model: 'claude-sonnet-5-5', ask, rewrite: T.scriptedRewriter(), usage: () => null };
  const out = {};
  const result = await O.officialize({ noAi, content, masters, env: {}, provider, store: new Map(), year: 2026, out });
  return { content, h: result.hybrid, plan: out.plan };
}

test('a mechanical fix of the plan (the fixed CLO classification) becomes a recommendation the author can apply', async () => {
  const { h, plan } = await report();
  assert.ok(plan.changes.some(c => c.source === 'mechanical' && c.key.startsWith('clolevel:')), 'the plan made the fix');
  const s = h.suggestions.find(x => x.path === 'clos[3].level');
  assert.ok(s, JSON.stringify(h.suggestions.map(x => x.path)));
  assert.equal(s.replacement, 'Integration of Values');
  assert.equal(s.source, 'rule', 'a rule fix: never "Check & improve", never an AI rewrite');
  assert.ok(s.basedOn.some(id => id.includes('CLO-LEVEL-LABEL')), 'it says which finding it fixes');
});

test('what only the author can fix is listed with the right reason, what to do and which field: a manual relationship, a reference and the author-only rules', async () => {
  const { h } = await report();
  const by = path => h.unresolved.find(u => u.path === path);
  const clo3 = by('clos[2].statement'), offTopic = by('refs.books.items[1].t'), week1 = by('plan[0].contents'), apa = by('refs.books.items[2].t');
  for (const [name, u] of Object.entries({ clo3, offTopic, week1, apa })) {
    assert.ok(u, name + ' is listed: ' + JSON.stringify(h.unresolved.map(x => [x.path, x.reason])));
    assert.equal(u.reason, 'faculty_fix', name + ': for the author to fix');
    assert.ok(u.detail && !/^for the faculty: /.test(u.detail), name + ': says what to do');
    assert.ok(u.excerpt, name + ': names the field by its text');
  }
  assert.match(clo3.detail, /activities and tasks of the weeks mapped to this CLO/);
  assert.match(offTopic.detail, /never rewrites a reference/);
  assert.match(week1.detail, /Week 1 must be the course orientation/);
  assert.match(apa.detail, /APA/);
  assert.match(offTopic.excerpt, /bread baker/);
  assert.ok(!h.unresolved.some(u => u.reason === 'draft_needs_review'), 'never "copied wording in the proposed rewrite" for these');
});

test('the page lists them and no longer says "every check passed"; a rule fix may set a CLO classification or repair a reference', async () => {
  const fs = require('node:fs'), path = require('node:path');
  const src = path.join(__dirname, '..', '..', '..', '..', 'src');
  const panel = fs.readFileSync(path.join(src, 'components', 'HybridCheckPanel.jsx'), 'utf8');
  assert.match(panel, /const needsDecision = \(hybrid\.unresolved \|\| \[\]\)\.filter\(u => u\.reason !== 'waits_for_upstream'\);/);
  assert.match(panel, /t\('hybrid\.unresolvedTitle', \{ count: needsDecision\.length \}\)/);
  const card = fs.readFileSync(path.join(src, 'views', 'ComplianceCard.jsx'), 'utf8');
  assert.match(card, /!run\.hybrid\?\.suggestions\?\.length && !run\.hybrid\?\.deductions\?\.length && !run\.hybrid\?\.unresolved\?\.length/);
  const apply = fs.readFileSync(path.join(src, 'lib', 'hybridCheck.js'), 'utf8');
  assert.ok(apply.includes('clos\\[\\d+\\]\\.level|refs\\.[a-z]+\\.items\\[\\d+\\]\\.t|'));
  const i18n = fs.readFileSync(path.join(src, 'i18n', 'hybrid.js'), 'utf8');
  for (const key of ['faculty_fix', 'no_verified_rewrite']) assert.equal((i18n.match(new RegExp(`'hybrid\\.unresolved\\.${key}'`, 'g')) || []).length, 2, key + ': English and Filipino');
});
