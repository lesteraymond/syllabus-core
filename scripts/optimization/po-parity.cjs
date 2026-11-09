'use strict';
// Corrected-PO parity: for BSIT, BSIE, BSCpE and BSIT-Cyber Security, resolve the program's masters from the DEVELOPMENT database (SELECT only; nothing is written),
// then run the comprehensive check twice over a SYNTHETIC syllabus (scripted provider, in-memory database; no network, no cost): baseline and the recommended
// optimization flags. Reports PO counts, whether the corrected PO text reaches the requests, coverage, verdict and official-score parity, and request counts.
//   node scripts/optimization/po-parity.cjs [--json out.json]
const path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..');
process.chdir(ROOT);
const mysql = require(path.join(ROOT, 'server/node_modules/mysql2/promise'));
const L = require(path.join(ROOT, 'scripts/live-claude/lib.cjs')), F = require(path.join(ROOT, 'scripts/live-claude/fixtures.cjs'));
const gemini = require(path.join(ROOT, 'server/lib/syllabuscheck/gemini')), svc = require(path.join(ROOT, 'server/lib/compliance/service')), repo = require(path.join(ROOT, 'server/lib/syllabuscheck/repository'));
const { createMemoryDb } = require(path.join(ROOT, 'server/lib/syllabuscheck/vpaa-conformance/memdb'));
const RECOMMENDED = { SYLLABUS_CHECK_CACHE_WARMUP: 'on', SYLLABUS_CHECK_OUTPUT_PLAN: 'on', SYLLABUS_CHECK_OUTPUT_FIELDS: 'scoped' };
const VPAA = ['Content-course', 'Content-ILO', 'ILO-CLO', 'Content-activity', 'ILO-activity', 'Content-assessment', 'Activity-assessment'];
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : '';

async function main() {
  const dev = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'syllabus_cms_plus' });
  const out = [];
  try {
    for (const code of ['BSIT', 'BSIE', 'BSCPE', 'BSIT-CYBERSECURITY']) {
      const fx = F.load('a'), content = structuredClone(fx.content);
      const real = await repo.mastersFor(dev, { meta: { program: code } }, {}); // read-only
      // A REAL course identity from the program's approved curriculum with SYNTHETIC content: a made-up course would correctly be reported NOT_CHECKED
      // (course_identity_reference_review). Cyber Security resolves BSIT's curriculum, so it gets one of BSIT's courses.
      const course = real.curricula[0].courses.find((c) => !/^(GE|NSTP|PE|PATH)/i.test(c.code) && c.yearLevel >= 2) || real.curricula[0].courses[0];
      Object.assign(content.meta, { program: code, code: course.code, title: course.title, yearLevel: String(course.yearLevel), lecture: String(course.lecture), lab: String(course.lab), prereq: course.prereq, curriculumYear: real.curricula[0].curriculumYear });
      const masters = structuredClone(real); masters.synthetic = false; masters.fingerprint = 'po-parity-' + code;
      // the synthetic syllabus is authored against exactly the corrected references; CLO-PO mappings stay inside the program's range
      content.outcomes = { vision: masters.institution.vision, mission: masters.institution.mission, egas: masters.institution.egas, pos: masters.pos.map((p) => ({ ...p })) };
      content.clos.forEach((clo) => { clo.egas = (clo.egas || []).filter((n) => n <= masters.institution.egas.length); });
      for (const clo of content.clos) clo.pos = (clo.pos || []).filter((n) => n <= masters.pos.length);
      const row = { program: code, courseUsed: course.code + ' ' + course.title, curriculum: real.curricula[0].program + ' ' + real.curricula[0].curriculumYear, posResolved: masters.pos.length, inheritedFrom: real.outcomeSource || null, firstPo: String(masters.pos[0].text).slice(0, 60), lastPoNo: masters.pos[masters.pos.length - 1].no, runs: {} };
      for (const [name, extra] of [['baseline', {}], ['optimized', RECOMMENDED]]) {
        const original = repo.mastersFor; repo.mastersFor = async () => masters;
        try {
          const env = L.anthropicEnv({ key: L.STAND_IN_KEY, cap: 1000, maxRequests: 500, mode: 'comprehensive', extra });
          const inner = L.harness.scriptedTransport(() => undefined), bodies = [];
          const transport = async (u, i) => { bodies.push(String(i.body)); return inner(u, i); };
          const budget = gemini.createRequestBudget(env), db = createMemoryDb({ syllabus: { content: JSON.stringify(content) } });
          const t0 = Date.now();
          const r = await svc.checkHybrid(db, content, { syllabusId: 100, env, transport, requestBudget: budget, linkChecker: async (url) => ({ url, status: 'ok', httpStatus: 200 }) });
          const rel = r.hybrid.academicV2.academic.relationships, s = budget.summary();
          const verdicts = {};
          for (const j of r.hybrid.alignment.judgements) if (!j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE') verdicts['L:' + j.id] = j.label;
          for (const x of rel) if (x.status !== 'NOT_CHECKED') verdicts['V:' + x.id] = x.academicJudgment;
          const poTextInRequests = bodies.some((b) => b.includes(JSON.stringify(masters.pos[0].text).slice(1, 60)));
          row.runs[name] = { requests: bodies.length, bytes: bodies.reduce((a, b) => a + Buffer.byteLength(b), 0), reservedUsd: s.reservedCostUsd, official: [r.overall, r.status, r.passed, r.passThreshold],
            vpaa: Object.fromEntries(VPAA.map((t) => [t, { total: rel.filter((x) => x.relationshipType === t).length, notChecked: rel.filter((x) => x.relationshipType === t && x.status === 'NOT_CHECKED').length }])),
            cloClassifications: { total: rel.filter((x) => x.relationshipType === 'CLO-classification').length, notChecked: rel.filter((x) => x.relationshipType === 'CLO-classification' && x.status === 'NOT_CHECKED').length },
            verdictsHash: crypto.createHash('sha256').update(JSON.stringify(Object.entries(verdicts).sort())).digest('hex').slice(0, 12), checked: Object.keys(verdicts).length, correctedPoTextSent: poTextInRequests,
            areas: crypto.createHash('sha256').update(JSON.stringify(r.areas)).digest('hex').slice(0, 12), ruleChecks: r.ruleChecks.length, ms: Date.now() - t0 };
        } finally { repo.mastersFor = original; }
      }
      const b = row.runs.baseline, o = row.runs.optimized;
      row.parity = { official: JSON.stringify(b.official) === JSON.stringify(o.official), verdicts: b.verdictsHash === o.verdictsHash, areas: b.areas === o.areas, vpaaIdentical: JSON.stringify(b.vpaa) === JSON.stringify(o.vpaa), classificationsIdentical: JSON.stringify(b.cloClassifications) === JSON.stringify(o.cloClassifications) };
      out.push(row);
      console.log(code.padEnd(20), row.courseUsed.slice(0, 30).padEnd(30), 'curr', row.curriculum, '| POs', row.posResolved, row.inheritedFrom ? '(inherited from ' + row.inheritedFrom + ')' : '', '| req', b.requests, '->', o.requests, '| bytes', b.bytes, '->', o.bytes, '| reserved $', b.reservedUsd, '->', o.reservedUsd, '| official', JSON.stringify(b.official), '| PO text sent', b.correctedPoTextSent + '/' + o.correctedPoTextSent, '| VPAA not-checked', VPAA.reduce((a, t) => a + o.vpaa[t].notChecked, 0), '| CLO classes', o.cloClassifications.total + '(nc ' + o.cloClassifications.notChecked + ')', '| parity', JSON.stringify(row.parity));
    }
  } finally { await dev.end(); }
  if (jsonOut) require('node:fs').writeFileSync(jsonOut, JSON.stringify({ kind: 'MODELED/scripted; reads the development database SELECT-only; no writes, no provider call', recommended: RECOMMENDED, programs: out }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
