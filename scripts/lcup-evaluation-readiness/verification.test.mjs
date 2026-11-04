import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setLanguage, t } from '../../src/i18n/index.js';
const out=path.join(process.cwd(),'docs/lcup-evaluation-readiness');
const read=async name=>JSON.parse(await fs.readFile(path.join(out,name),'utf8'));
test('current PO verification uses read-only session and no faculty records/writes',async()=>{
  const a=await read('current-pos.json');
  assert.equal(a.server.readOnly,1);assert.equal(a.databaseWrites,0);assert.equal(a.facultyRecordsRead,0);
  assert.ok(a.queries.every(sql=>/^SELECT\b/.test(sql)));
  assert.deepEqual(Object.fromEntries(Object.entries(a.programs).map(([k,v])=>[k,v.resolvedPos.length])),{BSIT:10,'BSIT-CYBERSECURITY':10,BSIE:13,BSCPE:13});
  assert.equal(a.inheritanceTableExists,false);assert.equal(a.cyberOwnMatchesBsit,true);
  assert.deepEqual(a.completeEngineeringPO12,{BSIE:false,BSCPE:false});
  assert.equal(a.comparisons.find(c=>c.key==='it202').numbered.filter(p=>p.exactTextMatch).length,0);
});
test('readiness holds conflicting PO relationships without fabricating judgments or tags',async()=>{
  const a=await read('academic-readiness.json');
  assert.equal(a.aiRequests,0);assert.equal(a.facultyJudgments,0);assert.ok(Object.values(a.stageFlags).every(v=>v===false));
  const counts=a.results.map(r=>({key:r.key,po:r.counts['CLO-PO'],ilo:r.counts['ILO-CLO'],untagged:r.untagged.length}));
  assert.deepEqual(counts.map(r=>r.po),[{total:19,ready:0,blocked:19},{total:13,ready:13,blocked:0},{total:11,ready:9,blocked:2}]);
  assert.deepEqual(counts.map(r=>r.ilo.total),[30,29,6]);
  assert.deepEqual(counts.map(r=>r.untagged),[4,0,11]);
  assert.ok(a.results.flatMap(r=>r.candidates).every(p=>p.expectedLabel===null));
  assert.ok(a.results.flatMap(r=>r.untagged).every(p=>p.expectedTarget===null&&!p.tags.length));
});
test('database workflow evidence includes both languages/choices, all relationships and untouched sentinel',async()=>{
  const r=await read('workflow-results.json');
  assert.equal(r.results.length,16);assert.equal(r.paidAiCalls,0);assert.equal(r.mockedAiCalls,12);assert.equal(r.productionDatabaseWrites,0);assert.equal(r.syntheticSentinelUnchanged,true);
  for(const language of ['en','tl'])for(const action of ['keep','replace'])for(const [key,po,ega,ilo] of [['it202',19,11,30],['ie402',13,5,29],['cpe304',11,4,6]]){
    const row=r.results.find(v=>v.key===key&&v.language===language&&v.action===action);assert.ok(row?.roundTrip);assert.deepEqual([row.cloPo,row.cloEga,row.iloClo],[po,ega,ilo]);
  }
  assert.ok(r.results.filter(v=>!v.roundTrip).every(v=>v.blockedBeforeSave));
});
test('workflow review and prerequisite choices use distinct English and Filipino UI wording',()=>{
  try {
    setLanguage('en');assert.equal(t('pdfImport.reviewTitle'),'Review extracted content');assert.equal(t('pdfImport.apply'),'Apply and AI CHECK');
    assert.equal(t('pdfImport.prereqKeep'),'Keep the current prerequisite');
    setLanguage('tl');assert.equal(t('pdfImport.reviewTitle'),'Suriin ang nakuhang nilalaman');assert.equal(t('pdfImport.apply'),'Ilapat at AI CHECK');
    assert.equal(t('pdfImport.prereqKeep'),'Panatilihin ang kasalukuyang prerequisite');assert.equal(t('pdfImport.prereqReplace'),'Palitan ng prerequisite mula sa PDF');
  }finally{setLanguage('en');}
});
