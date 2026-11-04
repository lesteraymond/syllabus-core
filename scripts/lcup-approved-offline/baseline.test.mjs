import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build } from './generate.mjs';
import { out } from './extract.mjs';
import { runBaselines } from './baseline.mjs';
const require = createRequire(import.meta.url);
const { coded } = require('../../server/lib/syllabuscheck/engine');
const read = async f => JSON.parse(await fs.readFile(`${out}/${f}`, 'utf8'));
test('incomplete source extraction fails closed instead of becoming valid fixture data', async () => {
  const source = await read('cpe304.source.json');
  source.tables = source.tables.filter(t=>!(t.page===3 && t.cells.length===3));
  assert.throws(()=>build(source), /Incomplete|Invalid learning outcomes/);
});
test('all six deterministic scenarios use frozen masters, issue no official score, and are repeatable', async () => {
  const a = await runBaselines(), b = await runBaselines();
  assert.deepEqual(a,b); assert.equal(a.results.length,6);
  assert.equal(a.engineVersion,'hybrid-2'); assert.equal(a.deterministicRulesInStandard,47); assert.equal(a.passThreshold,79);
  assert.equal(a.aiRequests,0); assert.equal(a.networkRequests,0); assert.equal(a.databaseWrites,0);
  for (const r of a.results) {
    assert.equal(r.officialScore,null); assert.equal(r.passed,null);
    assert.ok(r.findings.every(f=>f.classification.category));
    assert.ok(r.findings.some(f=>f.severity==='blocking'));
    assert.ok(r.checks.filter(c=>c.ruleId==='ILO-MISSING'&&c.status==='NOT_APPLICABLE').length===3);
    assert.ok(!r.findings.some(f=>f.ruleId==='VALUE' && /plan\[(4|7|12)\]/.test(f.path) && r.key==='it202'));
  }
  const it = a.results.find(r=>r.key==='it202'&&r.scenario==='builder-context');
  assert.equal(it.findings.filter(f=>f.ruleId==='ILO-MAP').length,4);
  const ieSource=a.results.find(r=>r.key==='ie402'&&r.scenario==='source');
  assert.equal(ieSource.findings.find(f=>f.ruleId==='H-01').classification.category,'Possible software defect');
  const cpe = a.results.find(r=>r.key==='cpe304'&&r.scenario==='builder-context');
  assert.equal(cpe.critical,false); assert.equal(cpe.findings.filter(f=>f.ruleId==='ILO-MAP').length,11);
  assert.ok(cpe.findings.some(f=>f.ruleId==='ILO-MISSING'));
});
test('checker keeps BSIT and Cyber Security curricula distinct, independently of shared POs', async () => {
  const snapshot = await read('masters.json'), f = await read('it202.fixture.json');
  const c = structuredClone(f.content);
  c.meta.program = 'BSIT-CYBERSECURITY'; c.meta.curriculumYear='2025-2026';
  const masters = snapshot.programs[c.meta.program].masters;
  assert.deepEqual(masters.pos,snapshot.programs.BSIT.masters.pos);
  assert.equal(coded(c,masters).critical,true);
  c.meta.code='IT-202';
  const r = coded(c,masters);
  assert.equal(r.critical,false);
  const title = r.checks.find(x=>x.ruleId==='CUR-FIELD'&&x.path==='meta.title');
  assert.equal(title.status,'FAIL'); assert.equal(title.evidence.expected,'SYSTEM INTEGRATION AND ARCHITECTURE 1');
  c.meta.curriculumYear='2022-2023';
  assert.equal(coded(c,masters).checks.find(x=>x.ruleId==='CUR-REF').status,'NOT_EVALUATED');
});
test('school-year and curriculum-year formats are distinct under current production selection', async () => {
  const snapshot=await read('masters.json'), f=await read('it202.fixture.json');
  for (const year of ['2025-2026','2022 - 2023','2022–2023']) {
    const c=structuredClone(f.content); c.meta.curriculumYear=year;
    assert.equal(coded(c,snapshot.programs.BSIT.masters).checks.find(x=>x.ruleId==='CUR-REF').status,'NOT_EVALUATED');
  }
  assert.equal(coded(f.content,snapshot.programs.BSIT.masters).checks.find(x=>x.ruleId==='CUR-REF').status,'PASS');
});
test('all thirteen engineering POs compare exactly, with only evidenced wording/punctuation differences', async () => {
  const rows=await read('engineering-pos.json'), data=Object.fromEntries(rows.map(r=>[r.key,r.pos]));
  for (const [a,b,expected] of [['ie402','ie403',[2,4,5,7,10,11,12]],['cpe304','cpe404',[4,7,12]],['ie402','cpe304',[11]],['ie403','cpe404',[2,5,7,10]]]) {
    const changed=data[a].filter((p,i)=>p.text!==data[b][i].text).map(p=>p.no);
    assert.deepEqual(changed,expected);
    for(let i=0;i<13;i++) if(i!==11) assert.equal(data[a][i].text.replace(/[^\p{L}\p{N}]/gu,''),data[b][i].text.replace(/[^\p{L}\p{N}]/gu,''));
  }
  for(const key of ['ie403','cpe404']) {
    assert.equal(data[key][11].text,'Knowledge and understanding of engineering and management principles as a member and leader in a team, to manage projects and in multidisciplinary environments.');
    assert.deepEqual(data[key][11].pages,[3]);
  }
});
