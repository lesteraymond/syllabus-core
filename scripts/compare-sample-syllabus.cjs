'use strict';
// Read-only comparison of one repository sample through the application's checker.
// Writes evidence in its own output directory; never connects to the application DB.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const retry = process.argv.includes('--retry-network');
const baseOut = path.join(root, 'docs', 'ai-checker-sample-comparison-2026-11-05');
const out = retry ? path.join(baseOut, 'attempt-2') : baseOut;
const env = { ...process.env, ...require('../server/node_modules/dotenv').parse(fs.readFileSync(path.join(root, 'server/.env'))) };
const g = require('../server/lib/syllabuscheck/gemini');
const { loadReal } = require('../server/lib/syllabuscheck/eval/realSyllabi');
const { run } = require('../server/lib/syllabuscheck/engine');
const { getValue, setValue, FIELD } = require('../server/lib/syllabuscheck/refine');
const { createGuard, openSpendRegister, loadedDataModules } = require('../server/lib/syllabuscheck/eval/providerGuard');
const registerFile = path.join(root, 'docs/ai-eval-anthropic/spend-register.json');
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
const tally = items => items.reduce((a, key) => ({ ...a, [key]: (a[key] || 0) + 1 }), {});
const summary = r => ({ publishedScore: r.score, deterministicBaseline: r.baseScore, diagnosticScore: r.hybrid.scoring?.official?.score, alignment: r.hybrid.alignment.status, coverage: r.hybrid.alignment.coverage, labels: tally(r.hybrid.alignment.judgements.map(j => j.unverified ? 'UNVERIFIED' : j.label)), deductions: r.hybrid.deductions, suggestions: r.hybrid.suggestions.length, reason: r.hybrid.alignment.reason });

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const sample = await loadReal('prog1');
  if (!sample) throw Error('Repository sample PDF is missing');
  const config = g.providerConfig(env);
  const sourceFile = path.join(root, 'reference-data', sample.pdf);
  const source = { key: sample.key, label: sample.label, pdf: sourceFile, sha256: crypto.createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex'), caveat: 'Application PDF import into a fixture-backed builder document; catalog code/year and institutional outcomes come from local reference transcriptions. Some untouched template fields may be defaults. Not an audit of the original PDF as a complete document.' };
  const metadata = { source, provider: config, stages: require('../server/lib/syllabuscheck/stages').stageFlags(env), academicV2: String(env.SYLLABUS_CHECK_ACADEMIC_V2 || 'off'), weekRows: sample.content.plan.length, clos: sample.content.clos.length, relationships: g.pairsOf(sample.content, sample.masters, []).length, register: fs.existsSync(registerFile) ? (({ cap, total }) => ({ cap, total }))(JSON.parse(fs.readFileSync(registerFile))) : null };
  if (!process.argv.includes('--live')) {
    write('original.json', sample.content);
    write('masters.json', sample.masters);
    write('metadata.json', metadata);
    console.log(JSON.stringify(metadata, null, 2));
    return;
  }
  if (config.provider !== 'anthropic' || !config.configured || !config.approved) throw Error('Expected the configured, approved Anthropic checker');
  if (metadata.academicV2.toLowerCase() === 'on') throw Error('This comparison harness supports the current legacy application path only');
  if (loadedDataModules().length) throw Error('Application database modules unexpectedly loaded');
  if (fs.existsSync(path.join(out, 'original-report.json'))) throw Error('Evidence already exists; do not repeat a paid run');
  const nativeFetch = globalThis.fetch;
  const register = openSpendRegister(registerFile, { cap: 10 });
  process.on('exit', () => register.release());
  const previous = retry ? JSON.parse(fs.readFileSync(path.join(baseOut, 'result.json'))) : null;
  if (retry && (previous.status !== 'incomplete-original' || previous.before.coverage.verified !== 0)) throw Error('Network retry requires a previous incomplete original with no verified answers');
  const maxCost = 2 - (previous?.usage?.charged || 0);
  const maxRequests = 60 - (previous?.usage?.requests || 0);
  const guard = createGuard({ fetch: nativeFetch, provider: 'anthropic', model: config.model, maxRequests, maxCost, maxTransient: 1, ledgerFile: path.join(out, 'provider-ledger.json'), register, secrets: [env.ANTHROPIC_API_KEY, env.GEMINI_API_KEY, env.OPENROUTER_API_KEY], log: line => console.log(line) });
  // Test links once through the application's public-address checks; reuse identical results.
  console.log('Checking reference-link accessibility once for both versions');
  const checkedLinks = await require('../server/lib/syllabuscheck/links').checkLinks(sample.content);
  const linksByUrl = new Map(checkedLinks.map(link => [link.url, link]));
  write('link-results.json', checkedLinks);
  globalThis.fetch = () => { throw Error('Only the guarded model transport is allowed in this comparison'); };
  // Preserve model, prompt, retry, and stage settings; serialize sends for the shared cap.
  const localEnv = { ...env, SYLLABUS_CHECK_AI_CONCURRENCY: '1' };
  const skippedLinks = [];
  const options = { env: localEnv, useAi: true, evaluationOnly: true, transport: guard.fetch, linkChecker: async url => linksByUrl.get(url) || { url, status: 'unchecked', reason: 'Not present in original reference links' } };
  try {
    write('original.json', sample.content);
    write('masters.json', sample.masters);
    write('metadata.json', { ...metadata, limits: { maxRequests, maxCostUsd: maxCost, totalComparisonCapUsd: 2 }, evaluationOnly: true, linkChecks: 'actual application checker, once and reused', previousAttempt: retry ? '../result.json' : null });
    console.log('Checking the original imported syllabus');
    const before = await run(sample.content, sample.masters, options);
    write('original-report.json', before);
    console.log(JSON.stringify({ before: summary(before), usage: guard.summary() }, null, 2));
    const suggestions = before.hybrid.suggestions;
    write('suggestions.json', suggestions);
    if (before.hybrid.alignment.status !== 'completed' || before.hybrid.alignment.judgements.some(j => j.unverified)) {
      write('result.json', { status: 'incomplete-original', before: summary(before), usage: guard.summary(), source, skippedLinks: [...new Set(skippedLinks)] });
      return;
    }
    let revised = structuredClone(sample.content);
    const edits = [], excluded = [];
    for (const s of suggestions) {
      if (s.source !== 'ai' || !FIELD.test(s.path) || typeof s.replacement !== 'string' || !s.replacement.trim()) { excluded.push({ id: s.id, path: s.path, source: s.source, reason: 'Not a direct AI text rewrite' }); continue; }
      if (edits.some(e => e.path === s.path)) { excluded.push({ id: s.id, path: s.path, reason: 'Another proposal already targets this field' }); continue; }
      edits.push({ id: s.id, path: s.path, title: s.title, reason: s.text, basedOn: s.basedOn, original: getValue(sample.content, s.path), suggested: s.replacement });
      revised = setValue(revised, s.path, s.replacement);
    }
    write('edits.json', { edits, excluded });
    write('revised.json', revised);
    if (!edits.length) { write('result.json', { status: 'no-text-rewrites', before: summary(before), usage: guard.summary(), source }); return; }
    if (guard.stopped()) { write('result.json', { status: 'stopped-before-recheck', before: summary(before), usage: guard.summary(), source }); return; }
    // Reuse unchanged relationships exactly as the application does; changed text is asked again.
    const reuse = new Map(before.hybrid.alignment.judgements.filter(j => j.key && !j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE').map(j => [j.key, j]));
    console.log(`Rechecking a local copy with ${edits.length} AI text rewrites`);
    const after = await run(revised, sample.masters, { ...options, reuse });
    write('revised-report.json', after);
    const lookup = new Map(before.hybrid.alignment.judgements.map(j => [j.id, j]));
    const changes = after.hybrid.alignment.judgements.filter(j => lookup.get(j.id)?.label !== j.label || !!lookup.get(j.id)?.unverified !== !!j.unverified).map(j => ({ id: j.id, type: j.type, original: lookup.get(j.id)?.label, revised: j.label, unverified: !!j.unverified, explanation: j.explanation }));
    const result = { status: after.hybrid.alignment.status === 'completed' ? 'completed' : 'incomplete-recheck', source, before: summary(before), after: summary(after), edits: edits.length, changedJudgments: changes, usage: guard.summary(), skippedLinks: [...new Set(skippedLinks)], caveats: ['Model self-evaluation, not independent faculty validation', 'Only current configured stages; no Policy V2 activation', 'Reference-link accessibility tested once and held constant', 'No database reads/writes or official scores saved', source.caveat] };
    write('result.json', result);
    console.log(JSON.stringify(result, null, 2));
  } finally { guard.saveLedger(); register.release(); }
}
main().catch(error => { console.error(String(error.message)); process.exitCode = 1; });
