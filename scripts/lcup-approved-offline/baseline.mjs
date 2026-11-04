// Deterministic entry point only. Engine.run invokes AI/link checks and is not used.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { out, write, sha } from './extract.mjs';
const require = createRequire(import.meta.url);
// Fail closed if a future dependency attempts network access during this run.
globalThis.fetch = () => { throw Error('Offline baseline forbids fetch'); };
for (const mod of ['node:http', 'node:https']) {
  const api = require(mod); api.request = api.get = () => { throw Error('Offline baseline forbids HTTP'); };
}
const net = require('node:net'); net.connect = net.createConnection = () => { throw Error('Offline baseline forbids sockets'); };
const { coded, VERSION } = require('../../server/lib/syllabuscheck/engine');
const standard = require('../../server/lib/compliance/standard-v4.json');
const read = async f => JSON.parse(await fs.readFile(`${out}/${f}`, 'utf8'));
const norm = s => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
export function classify(f) {
  const id = f.ruleId || f.id.split(':')[0];
  if (id === 'PO-EXACT' || id === 'INST-EXACT' || id === 'T-21') return { category: 'Institutional reference conflict', also: id === 'INST-EXACT' && f.path === 'outcomes.egas' ? ['Possible software defect'] : [], decision: id === 'PO-EXACT' ? 'L1/L2' : id === 'T-21' ? 'L16' : 'L15/display metadata' };
  if (id === 'VALUE') return { category: 'Academic-policy question', also: [], decision: 'L17; absence of one of the six names is objective, requirement is institutional' };
  if (id === 'CUR-REF' || id === 'CUR-FIELD' && /prereq|title/.test(f.path)) return { category: 'Institutional reference conflict', also: [], decision: 'L19/L20' };
  if (id === 'T-20') return { category: 'Possible software defect', also: [], decision: 'Adapter retains authored numbered requirement strings; builder expects automatic numbering' };
  if (id === 'CUR-CODE' || id === 'CUR-FIELD' || id === 'T-06' || id === 'H-01') return { category: 'Possible software defect', also: [], decision: 'Source/builder representation; compare builder-context scenario' };
  return { category: 'Confirmed objective discrepancy', also: /^(?:T-13|ILO-MAP|ILO-MISSING|P-05|A-02)$/.test(id) ? ['Academic-policy question'] : [], decision: /^(?:T-13|ILO-MAP|ILO-MISSING|P-05|A-02)$/.test(id) ? 'L18/F1-F10; missing tags/coverage are observable, enforcement needs confirmation' : null };
}
export async function runBaselines() {
  const snapshot = await read('masters.json'), results = [];
  for (const key of ['it202', 'ie402', 'cpe304']) {
    const fixture = await read(`${key}.fixture.json`), source = fixture.content;
    const bundle = snapshot.programs[source.meta.program], masters = bundle.masters;
    const matches = masters.curricula.flatMap(c => c.courses.map(course => ({ curriculum: c, course }))).filter(r => norm(r.course.code) === norm(source.meta.code));
    if (matches.length !== 1) throw Error(`Ambiguous program-scoped course ${key}`);
    const { course, curriculum } = matches[0];
    for (const scenario of ['source', 'builder-context']) {
      const content = structuredClone(source), adaptations = [];
      if (scenario === 'builder-context') {
        // Catalog-managed identity, plus explicitly chosen reference context for fields
        // the PDF does not provide. Never replace authored prerequisite/outcomes.
        for (const name of ['code', 'title', 'yearLevel']) { content.meta[name] = String(course[name]); adaptations.push(`meta.${name} from frozen catalog/reference`); }
        if (key === 'ie402') for (const name of ['lecture', 'lab']) { content.meta[name] = String(course[name]); adaptations.push(`meta.${name} from reference; PDF says only 3 units`); }
        adaptations.push(`Curriculum year left blank; engine selects sole approved ${curriculum.curriculumYear} reference (cohort confirmation pending).`);
      }
      const report = coded(content, masters, { titleComparison: 'exact' });
      results.push({ key, scenario, adaptations, referenceFingerprint: masters.fingerprint, critical: report.critical, baseScore: report.base.overall,
        officialScore: null, passed: null, aiStatus: 'NOT_EVALUATED', findings: report.findings.map(f => ({ ...f, classification: classify(f) })), checks: report.checks,
        pending: [{ category: 'AI-dependent judgment requiring faculty validation', items: ['CLO–PO suitability (IT202 numbering unresolved)', 'CLO–EGA suitability', 'ILO–CLO suitability', 'Activity and assessment alignment', 'Value integration and reference relevance/authenticity'] }] });
    }
  }
  const result = { engineVersion: VERSION, entryPoint: 'engine.coded', deterministicRulesInStandard: standard.rules.length, passThreshold: standard.passThreshold,
    masterExportSha256: sha(await fs.readFile(`${out}/masters.json`)), aiRequests: 0, networkRequests: 0, databaseWrites: 0, officialScoreReason: 'Coded component only; no complete Hybrid-2 evaluation. No official pass/fail issued.', results };
  await write('deterministic-baseline.json', result); return result;
}
if (process.argv[1] === import.meta.filename) {
  const r = await runBaselines();
  for (const x of r.results) console.log(JSON.stringify({ key: x.key, scenario: x.scenario, critical: x.critical, baseScore: x.baseScore, findings: x.findings.map(f => [f.ruleId || f.id, f.path, f.severity]) }));
}
