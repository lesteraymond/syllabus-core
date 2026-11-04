'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {project,manifestFor,TYPES}=require('./projection.cjs');
const {compareAll,controlled,transcript,currentReport}=require('./compare.cjs');
const standard=require('../../server/lib/compliance/standard-v4.json');
const {POLICY}=require('../../server/lib/syllabuscheck/policy');
const {stageFlags}=require('../../server/lib/syllabuscheck/stages');
let comparison;test.before(async()=>{comparison=await compareAll();});
const row=id=>comparison.results.find(r=>r.id===id).comparison;
test('all seven existing relationship factories remain available; no runtime stage is enabled',()=>{
 const {content,masters}=controlled(),manifest=manifestFor(content,masters);
 assert.equal(manifest.lessons,15);assert.equal(manifest.cells.length,105);assert.deepEqual([...new Set(manifest.cells.map(c=>c.type))],TYPES);
 assert.ok(TYPES.every(type=>manifest.pairs.some(p=>p.type===type)));
 assert.equal(comparison.networkAttempts,0);assert.deepEqual(comparison.runtimeAcademicFlagsEnabled,[]);assert.ok(Object.values(stageFlags({})).every(flag=>flag===false));
});
test('three verified source fixtures receive no invented academic score or faculty labels',()=>{
 for(const id of ['verified-it202','verified-ie402','verified-cpe304']){
  const r=row(id);assert.equal(r.weekly.coverage,0);assert.equal(r.weekly.disposition,'NOT_EVALUATED');assert.equal(r.weekly.counts.SUPPORTED,0);assert.equal(r.officialAcademicScore,null);assert.equal(r.officialPassDecision,null);assert.equal(r.facultyValidated,false);
 }
});
test('a complete off-course plan can retain a current 100-point candidate while V2 flags sixty failed cells',()=>{
 const r=row('complete-off-course-content');assert.equal(r.current.baseScore,100);assert.equal(r.current.provisionalScore,100);assert.equal(r.current.publishedScore,null,'Synthetic provenance is preserved');
 assert.equal(r.weekly.counts.NOT_SUPPORTED,60);assert.equal(r.weekly.counts.SUPPORTED,45);assert.equal(r.weekly.disposition,'REQUIRES_REVISION');assert.ok(Math.abs(r.weekly.descriptiveSupportBoundsPct.lower-300/7)<1e-9);assert.equal(r.remediation.declaredRootCount,15);
});
for(const type of TYPES)test(`${type} remains independent and cannot be compensated by the other six passing`,()=>{
 const r=row(`independent-${type}`);assert.equal(r.weekly.counts.NOT_SUPPORTED,1);assert.equal(r.weekly.counts.SUPPORTED,104);assert.equal(r.weekly.disposition,'REQUIRES_REVISION');
 assert.equal(r.current.provisionalScore,['ILO-CLO','ILO-activity'].includes(type)?97:100);assert.equal(r.weekly.typeSummary.find(t=>t.type===type).NOT_SUPPORTED,1);
 assert.ok(r.weekly.typeSummary.filter(t=>t.type!==type).every(t=>t.NOT_SUPPORTED===0));
});
test('the current policy also catches failures of its scored links: it is not assumed blind to all misalignment',()=>{
 const r=row('all-seven-misaligned');assert.equal(r.current.provisionalScore,10);assert.equal(r.weekly.counts.NOT_SUPPORTED,105);assert.equal(r.weekly.descriptiveSupportBoundsPct.lower,0);
});
test('AI unavailability and partial evidence never produce an academic pass or a new final numeric score',()=>{
 const unavailable=row('AI-unavailable');assert.equal(unavailable.current.publishedScore,null);assert.equal(unavailable.weekly.disposition,'NOT_EVALUATED');assert.equal(unavailable.weekly.coverage,0);assert.equal(unavailable.officialAcademicScore,null);
 const partial=row('partial-evidence');assert.equal(partial.weekly.complete,false);assert.ok(partial.weekly.coverage>0&&partial.weekly.coverage<1);assert.equal(partial.weekly.disposition,'PARTIALLY_EVALUATED');assert.ok(partial.weekly.descriptiveSupportBoundsPct.lower<partial.weekly.descriptiveSupportBoundsPct.upper);
 const p=row('partial-one-relationship');assert.equal(p.weekly.disposition,'FACULTY_REVIEW');assert.equal(p.weekly.counts.PARTIAL,1);assert.equal(p.officialPassDecision,null);
});
test('one declared root retains four failed judgments but creates no duplicate point deductions',()=>{
 const r=row('same-root-four-links');assert.equal(r.weekly.counts.NOT_SUPPORTED,4);assert.equal(r.remediation.declaredRootCount,1);assert.equal(r.remediation.declaredRoots[0].pairIds.length,4);assert.equal(r.remediation.deductionPoints,null);
 assert.equal(r.current.deductions.length,0);assert.equal(r.remediation.declaredRoots[0].provenance,'controlled_scenario_assumption');
});
test('grouped weeks count once, examinations are excluded, and an empty lesson is still unresolved',async()=>{
 const grouped=row('grouped-weeks');assert.equal(grouped.weekly.lessons,14);assert.equal(grouped.weekly.examRows,3);assert.equal(grouped.weekly.cells.length,98);
 const {content,masters}=controlled();Object.assign(content.plan[2],{contents:'',activities:'',tasks:'',ilos:[]});
 const manifest=manifestFor(content,masters);assert.equal(manifest.cells.filter(c=>c.row===2).length,7);
 const report=await currentReport(content,masters,undefined,{unavailable:true}),r=project({content,masters,report});assert.ok(r.weekly.cells.filter(c=>c.row===2).every(c=>c.status==='NOT_CHECKED'));
});
test('untagged ILOs are not assigned a CLO by the projection',()=>{
 const r=row('untagged-ILO');assert.equal(r.weekly.counts.NOT_CHECKED,1);assert.equal(r.weekly.complete,false);assert.deepEqual(r.weekly.cells.find(c=>c.row===2&&c.type==='ILO-CLO').groups,[[]]);
});
test('ambiguous multiple CLO tags preserve supported meaning and require mapping review',async()=>{
 const {content,masters}=controlled();content.plan[2].ilos[0].tags=['clo:c1','clo:c3'];const before=structuredClone(content);
 const manifest=manifestFor(content,masters),obs=transcript(manifest,p=>p.id==='row2-ilo0-clo:c3'?'NOT_ALIGNED':'ALIGNED');
 const report=await currentReport(content,masters),r=project({content,masters,report,observations:obs});
 const cell=r.weekly.cells.find(c=>c.row===2&&c.type==='ILO-CLO');assert.equal(cell.status,'SUPPORTED');assert.equal(cell.mappingReview,true);assert.equal(r.weekly.disposition,'FACULTY_REVIEW');assert.deepEqual(content,before);
});
test('duplicate, stale and ungrounded observations are not accepted as current evidence',async()=>{
 const {content,masters}=controlled(),manifest=manifestFor(content,masters),observations=transcript(manifest),report=await currentReport(content,masters);
 const target=observations.find(j=>j.id==='row2-contentactivity');
 const duplicate=project({content,masters,report,observations:[...observations,target]});assert.equal(duplicate.weekly.cells.find(c=>c.row===2&&c.type==='Content-activity').status,'NOT_CHECKED');
 const invalid=structuredClone(observations);invalid.find(j=>j.id===target.id).sourceQuote='INVENTED QUOTE';assert.equal(project({content,masters,report,observations:invalid}).weekly.cells.find(c=>c.row===2&&c.type==='Content-activity').status,'NOT_CHECKED');
 content.plan[2].activities+=' New authored text.';assert.equal(project({content,masters,report,observations}).weekly.cells.find(c=>c.row===2&&c.type==='Content-activity').status,'NOT_CHECKED');
});
test('root-cause grouping needs explicit provenance and cannot overlap or merge different same-field causes automatically',async()=>{
 const {content,masters}=controlled(),manifest=manifestFor(content,masters),observations=transcript(manifest,p=>p.id.startsWith('row2-')&&['Content-assessment','Activity-assessment'].includes(p.type)?'NOT_ALIGNED':'ALIGNED'),report=await currentReport(content,masters);
 const pairIds=['row2-contentassessment','row2-activityassessment'];
 assert.throws(()=>project({content,masters,report,observations,rootGroups:[{id:'guess',pairIds}]}),/provenance/);
 const root=id=>({id,pairIds,basis:'Controlled assumption',provenance:'controlled_scenario_assumption'});
 assert.throws(()=>project({content,masters,report,observations,rootGroups:[root('one'),root('two')]}),/Overlapping/);
 const separate=project({content,masters,report,observations,rootGroups:pairIds.map((p,i)=>({...root(String(i)),pairIds:[p]}))});assert.equal(separate.remediation.declaredRootCount,2);
});
test('all legacy options are compared arithmetically without changing current deductions or hiding the direct check',()=>{
 const r=row('legacy-ILO-assessment-only');assert.equal(r.current.provisionalScore,97);assert.equal(r.legacyIloAssessment.currentDeductionPoints,3);assert.deepEqual(r.legacyIloAssessment.arithmeticOnlyAlternatives,{keepScored:97,advisory:100,retired:100});assert.ok(r.legacyIloAssessment.observations.some(j=>j.label==='NOT_ALIGNED'));assert.equal(r.current.deductions[0].points,3);assert.equal(r.officialAcademicScore,null);
});
test('current duplicated value/PO charges stay visible without silently refunding or rewriting official results',()=>{
 const values=row('duplicate-value-name-and-meaning');assert.equal(values.current.provisionalScore,98);assert.equal(values.current.deductions.length,2);assert.equal(values.current.deductions.reduce((n,d)=>n+d.points,0),2);
 const pos=row('one-CLO-many-PO-links');assert.equal(pos.current.provisionalScore,94);assert.equal(pos.current.deductions.length,2);assert.ok(pos.otherOriginalRequirements.some(r=>r.requirement==='CLO_PO_alignment'&&r.status==='EXISTING_CHECK_FAILURE'));
 assert.equal(pos.weekly.disposition,'SUPPORTED_BY_SUPPLIED_EVIDENCE');assert.equal(pos.overallAcademicDisposition,'SOURCE_OR_REQUIREMENT_REVIEW_REQUIRED');assert.equal(pos.officialAcademicScore,null);
});
test('historical saved scores and input report bytes are preserved',()=>{
 const file=path.resolve(__dirname,'../../docs/sample-misaligned-report.json'),bytes=fs.readFileSync(file),report=JSON.parse(bytes),before=JSON.stringify(report),score=report.score;
 const {content,masters}=controlled();project({content,masters,report});assert.equal(report.score,score);assert.equal(JSON.stringify(report),before);assert.deepEqual(fs.readFileSync(file),bytes);
});
test('47 rules, passing mark 79, policy deductions and gate/scoring source hashes are untouched',()=>{
 assert.equal(standard.rules.length,47);assert.equal(standard.passThreshold,79);assert.equal(POLICY.alignment,3);assert.equal(POLICY.partialAlignment,1);assert.ok(!POLICY.advisoryTypes.includes('ILO-assessment'));
 const before=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/lcup-policy-v2/before.json'),'utf8'));
 for(const file of ['server/lib/compliance/standard-v4.json','server/lib/compliance/rules.js','server/lib/compliance/service.js','server/lib/syllabuscheck/engine.js','server/lib/syllabuscheck/policy.js','server/lib/syllabuscheck/scoring.js','server/.env']){
  const bytes=fs.readFileSync(path.resolve(__dirname,'../..',file)),hash=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(hash,before.files.find(x=>x.path===file).sha256,file);
 }
});
