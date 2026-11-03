#!/usr/bin/env node
'use strict';
// Offline what-if for the scored ILO-assessment relationship (docs/ilo-assessment-scoring-review.md). It shows what a check of the synthetic fixture
// would score under the current policy and under the policies proposed there. Every policy is applied IN MEMORY, in this process only: no file is
// edited, nothing is written, and nothing is sent (fetch is blocked and the model is a scripted transport, so there is no provider and no cost).
//
//   node scripts/whatif-ilo-assessment.cjs --mode current            the code as it is: ILO-assessment is scored
//   node scripts/whatif-ilo-assessment.cjs --mode advisory           'ILO-assessment' added to POLICY.advisoryTypes only
//   node scripts/whatif-ilo-assessment.cjs --mode advisory-verdict   the same, and added to verdict.js's own advisory list
//   node scripts/whatif-ilo-assessment.cjs --mode removed            the ILO-assessment pair is no longer built (gemini.js pairsOf)
//   add --c2 to switch Stage C2 on (its deeper Assessment-fit question is asked only after an ALIGNED scored ILO-assessment answer)
//
// Prints one JSON line per scenario. The scripted model answers every other relationship ALIGNED, with quotes from that pair's own texts.
globalThis.fetch = async () => { throw new Error('network blocked: this what-if is offline'); };
const path = require('node:path');
const Module = require('node:module');

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
const mode = flag('mode') || 'current', c2 = args.includes('--c2');
const MODES = ['current', 'advisory', 'advisory-verdict', 'removed'];
if (!MODES.includes(mode)) { console.error(`--mode must be one of: ${MODES.join(', ')}`); process.exit(2); }
const lib = path.join(__dirname, '..', 'server', 'lib', 'syllabuscheck');

// Source edits made as each module is compiled, in memory; each anchor must occur exactly once or the run stops.
const PATCHES = {
  'advisory-verdict': [['verdict.js', '/^(ILO-content|', '/^(ILO-assessment|ILO-content|']],
  removed: [['gemini.js', "add(`row${i}-ilo${j}-assessment`, 'ILO-assessment', ilo.text, row.tasks, path, `${prefix}.tasks`);", '']],
};
const applied = [];
const compile = Module.prototype._compile;
Module.prototype._compile = function (source, filename) {
  for (const [file, from, to] of PATCHES[mode] || []) {
    if (!filename.split('\\').join('/').endsWith(`/syllabuscheck/${file}`)) continue;
    if (source.split(from).length !== 2) throw new Error(`--mode ${mode}: the code this what-if edits has changed (${file}); update the anchor`);
    source = source.replace(from, () => to);
    applied.push(file);
  }
  return compile.call(this, source, filename);
};
// POLICY is frozen, but its advisoryTypes array is not: this is the one list the proposed policy would change. It must be edited before gemini.js
// reads it (gemini.js ADVISORY_TYPES is built when the module loads).
if (mode === 'advisory' || mode === 'advisory-verdict') require(path.join(lib, 'policy.js')).POLICY.advisoryTypes.push('ILO-assessment');
const { run } = require(path.join(lib, 'engine.js'));
const { sample } = require(path.join(lib, 'fixtures.js'));
const { resetProviderBlock } = require(path.join(lib, 'gemini.js'));
const { buildVerdict } = require(path.join(lib, 'verdict.js'));
const isIloAssessment = id => /^row\d+-ilo\d+-assessment$/.test(id);

// scenario(nth) -> the label of the nth ILO-assessment pair (in request order), or null to leave it unanswered.
const SCENARIOS = {
  'all aligned': () => 'ALIGNED',
  'one NOT_ALIGNED': n => (n === 1 ? 'NOT_ALIGNED' : 'ALIGNED'),
  'three NOT_ALIGNED': n => (n <= 3 ? 'NOT_ALIGNED' : 'ALIGNED'),
  'all NOT_ALIGNED': () => 'NOT_ALIGNED',
  'all PARTIALLY_ALIGNED': () => 'PARTIALLY_ALIGNED',
  'one unanswered': n => (n === 1 ? null : 'ALIGNED'),
};
const tally = list => list.reduce((m, k) => ({ ...m, [k]: (m[k] || 0) + 1 }), {});

(async () => {
  for (const [scenario, pick] of Object.entries(SCENARIOS)) {
    resetProviderBlock();
    const { content, masters } = sample();
    const order = new Map(), sent = {};
    const transport = async (url, req) => {
      const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
      const judgements = batch.flatMap(p => {
        sent[p.type] = (sent[p.type] || 0) + 1;
        if (isIloAssessment(p.id) && !order.has(p.id)) order.set(p.id, order.size + 1);
        const label = isIloAssessment(p.id) ? pick(order.get(p.id)) : 'ALIGNED';
        if (label === null) return [];
        return [{ id: p.id, label, explanation: 'Judged on the two texts.', sourceQuote: p.source.slice(0, 12), targetQuote: p.target.slice(0, 12), sourceBloom: 'N/A', targetBloom: 'N/A', draft: label === 'ALIGNED' ? '' : 'Revise the task so that it collects evidence of the ILO.' }];
      });
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements }) }] } }] }) };
    };
    const env = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'offline-what-if', ...(c2 ? { SYLLABUS_CHECK_STAGE_C2: 'on' } : {}) };
    const r = await run(content, masters, { useAi: true, env, transport, linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) });
    const blocking = r.findings.filter(f => f.severity === 'blocking').map(f => f.ruleId);
    const deducted = r.hybrid.deductions.reduce((s, d) => s + d.points, 0);
    const aln07 = buildVerdict(r, content, { all: true }).all.filter(f => f.ruleId === 'ALN-07');
    const status = r.hybrid.alignment.status, score = r.hybrid.provisionalScore;
    console.log(JSON.stringify({
      mode, c2, scenario,
      pairsSent: Object.values(sent).reduce((a, b) => a + b, 0), iloAssessmentPairsSent: sent['ILO-assessment'] || 0, assessmentFitPairsSent: sent['Assessment-fit'] || 0,
      base: score + deducted, deducted, iloAssessmentDeducted: r.hybrid.deductions.filter(d => isIloAssessment(String(d.id).replace(/^SEM:/, ''))).reduce((s, d) => s + d.points, 0),
      provisionalScore: score, alignmentStatus: status, blocking: tally(blocking),
      // The fixture's masters are synthetic, so its own `ready` is always false; these are what a real syllabus would get (engine.js ready, passThreshold 79).
      readyIfReal: !blocking.length && status === 'completed', passIfReal: !blocking.length && status === 'completed' && score >= 79,
      aln07: { status: tally(aln07.map(f => f.status)), severity: tally(aln07.map(f => f.severity)) },
    }));
  }
  if ((PATCHES[mode] || []).length !== applied.length) throw new Error(`--mode ${mode}: a patch was not applied`);
})().catch(e => { console.error(e); process.exit(1); });
