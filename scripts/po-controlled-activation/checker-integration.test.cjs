'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {OUT,CODES}=require('./checker-integration-audit.cjs');
const snapshot=JSON.parse(fs.readFileSync(path.join(OUT,'references.json'),'utf8'));
const h=require('../../server/lib/syllabuscheck/vpaa-conformance/harness');
const svc=require('../../server/lib/compliance/service'),repo=require('../../server/lib/syllabuscheck/repository');
const {createMemoryDb}=require('../../server/lib/syllabuscheck/vpaa-conformance/memdb');
const {sameBasis,assertContentBasis}=require('../../server/lib/programPoReferences');
const standard=require('../../server/lib/compliance/standard-v4.json'),rules=require('../../server/lib/compliance/rules');
const profile=require('../../server/lib/syllabuscheck/checkingProfile');
const TYPES=h.POLICY.weeklyTypes,LEVELS=h.POLICY.classifications;
const recommended={SYLLABUS_CHECK_CACHE_WARMUP:'on',SYLLABUS_CHECK_OUTPUT_PLAN:'on',SYLLABUS_CHECK_OUTPUT_FIELDS:'scoped'};
const evidence=[];const originalMasters=repo.mastersFor;
function fixture(code){const r=snapshot.references.find(r=>r.code===code),selection=snapshot.subjects.find(s=>s.code===code),c=selection.course,{content}=h.sample(),masters=structuredClone(r.masters);
 content.meta={...content.meta,program:code,courseId:null,code:c.code,title:c.title,prereq:c.prereq,lecture:String(c.lecture),lab:String(c.lab),yearLevel:String(c.yearLevel),curriculumYear:selection.curriculumYear};
 content.outcomes={...masters.institution,egas:r.program.egas,pos:r.program.pos,poReference:r.program.poReference};
 // Deliberate SYNTHETIC faculty choices; these are not approved course mappings.
 content.clos.forEach((clo,i)=>{clo.pos=[1];clo.egas=[1];clo.level=LEVELS[i];});
 masters.fingerprint=r.masters.fingerprint;return {content,masters};
}
async function check(content,masters,{script,extra={},useAi=true}={}){
 const env=h.envFor({SYLLABUS_CHECK_ACADEMIC_V2:'off',SYLLABUS_CHECK_PROFILE:'comprehensive-testing',...extra});
 const transport=h.scriptedTransport(script),db=createMemoryDb({syllabus:{content:JSON.stringify(content)}});
 repo.mastersFor=async()=>structuredClone(masters);
 try{return {result:await svc.checkHybrid(db,content,{env,transport,useAi,linkChecker:async url=>({url,status:'ok',httpStatus:200})}),transport,db,env};}finally{repo.mastersFor=originalMasters;}
}
const signature=r=>({overall:r.overall,passed:r.passed,passThreshold:r.passThreshold,areas:r.areas,deductions:r.hybrid.deductions,judgments:[...r.hybrid.alignment.judgements,...(r.hybrid.academicV2?.alignment.judgements||[])].map(j=>[j.id,j.label,j.unverified||false]).sort((a,b)=>a[0].localeCompare(b[0]))});
for(const code of CODES){
 test(code+': official reference, invalid/missing/obsolete mappings and missing crosswalk are distinct',async t=>{
  h.liveGuard(t);const {content,masters}=fixture(code),catalog={institution:masters.institution,program:{pos:masters.pos,egas:content.outcomes.egas}};
  const evaluate=c=>rules.evaluate({...c,catalog:{institution:catalog.institution,program:{...catalog.program,pos:c.outcomes.pos}}},{...standard,rules:standard.rules.filter(r=>['T-12','P-01','P-02','P-03'].includes(r.id))},{catalog,year:2026});
  assert.equal(evaluate(content).findings.length,0);assert.equal(h.coded(content,masters).checks.find(c=>c.ruleId==='PO-EXACT').status,'PASS');
  for(const [kind,change,ids]of [['wrong wording',c=>c.outcomes.pos[0].text+=' wrong',['T-12','PO-EXACT']],['missing PO list',c=>c.outcomes.pos=[],['T-12','PO-EXACT']],['unknown PO number',c=>c.clos[0].pos=[999],['P-02','CLO-MAP']],['unknown EGA number',c=>c.clos[0].egas=[999],['P-01','CLO-MAP']]]){
   const bad=structuredClone(content);change(bad);const findings=[...evaluate(bad).findings,...h.coded(bad,masters).findings];for(const id of ids)assert.ok(findings.some(f=>f.ruleId===id),kind+' '+id);
  }
  const absent={...masters,pos:[]};assert.equal(h.coded(content,absent).checks.find(c=>c.ruleId==='PO-MASTER').status,'NOT_EVALUATED');
  const historical=structuredClone(content);historical.outcomes.pos[0].text='Previous reference wording';assert.throws(()=>assertContentBasis(historical,masters.poReference),e=>e.body?.code==='po_reference_review_required');
  if(code.startsWith('BSIT')){const old=structuredClone(content);old.clos[0].pos=[10];assert.ok(evaluate(old).findings.some(f=>f.ruleId==='P-02'));assert.deepEqual(old.clos[0].pos,[10]);}
  const {result}=await check(content,masters);const p03=result.hybrid.ruleCoverage.rules.find(r=>r.ruleId==='P-03');assert.equal(p03.status,'NOT_CHECKED');assert.equal(p03.verified,false);assert.match(p03.reason,/crosswalk/);
  evidence.push({code,phase:'deterministic',valid:'PASS',invalidMissingObsolete:'detected',P03:p03.status,noOfficialCrosswalkInvented:true});
 });
 test(code+': semantic prompts use exact masters and a valid PO number can be academically wrong',async t=>{
  h.liveGuard(t);const {content,masters}=fixture(code),before=JSON.stringify(content);
  const {result,transport}=await check(content,masters,{script:p=>p.type==='CLO-PO'?{label:'NOT_ALIGNED',explanation:'Scripted mismatch: the CLO performance does not establish the specific competency of the quoted PO.',recommendation:'RETAG_OUTCOME',draft:''}:undefined});
  for(const type of ['CLO-PO','CLO-anyPO','CLO-EGA','CLO-anyEGA']){const pairs=transport.pairs().filter(p=>p.type===type);assert.ok(pairs.length,type);for(const p of pairs){assert.ok(content.clos.some(c=>p.target.includes(c.statement)));if(type==='CLO-PO')assert.equal(p.source,masters.pos[0].text);if(type==='CLO-anyPO')for(const po of masters.pos)assert.ok(p.source.includes(po.text));if(type==='CLO-EGA')assert.equal(p.source,masters.institution.egas[0].name);}}
  const judgments=result.hybrid.alignment.judgements.filter(j=>j.type==='CLO-PO');assert.ok(judgments.length);assert.ok(judgments.every(j=>j.label==='NOT_ALIGNED'&&!j.unverified&&j.evidenceMatching));
  assert.ok(result.findings.some(f=>f.ruleId==='SEM-TAG'),'An aligned whole-list answer preserves the authorized secondary-tag advisory treatment');
  const unsupported=await check(content,masters,{script:p=>['CLO-PO','CLO-anyPO'].includes(p.type)?{label:'NOT_ALIGNED',explanation:'Scripted: neither the selected tag nor the supplied whole list supports this CLO.'}:undefined});
  const unsupportedOptimized=await check(content,masters,{extra:recommended,script:p=>['CLO-PO','CLO-anyPO'].includes(p.type)?{label:'NOT_ALIGNED',explanation:'Scripted: neither the selected tag nor the supplied whole list supports this CLO.'}:undefined});assert.deepEqual(signature(unsupportedOptimized.result),signature(unsupported.result));
  assert.ok(unsupported.result.hybrid.deductions.length>0,JSON.stringify({deductions:unsupported.result.hybrid.deductions,po:unsupported.result.hybrid.alignment.judgements.filter(j=>['CLO-PO','CLO-anyPO'].includes(j.type)).map(j=>({id:j.id,label:j.label,unverified:j.unverified,reason:j.failureKind}))}));assert.equal(JSON.stringify(content),before);assert.ok(sameBasis(masters.pos,snapshot.references.find(r=>r.code===code).program.pos));
  evidence.push({code,phase:'semantic',wrongButExistingPo:'NOT_ALIGNED',sourceQuotesVerified:true,facultyContentUnchanged:true,mappingsAreSyntheticChoices:true,liveModelCalls:0});
 });
 test(code+': all seven VPAA records and four classifications survive optimization and saved report reload',async t=>{
  h.liveGuard(t);const {content,masters}=fixture(code),before=JSON.stringify(content),baseline=await check(content,masters);
  const optimized=await check(content,masters,{extra:recommended}),scoped=await check(content,masters,{extra:{...recommended,SYLLABUS_CHECK_COURSE_CONTEXT:'scoped'}});
  assert.deepEqual(signature(optimized.result),signature(baseline.result));assert.deepEqual(signature(scoped.result),signature(baseline.result));
  assert.equal(baseline.result.hybrid.semanticCoverage.evaluated,7);assert.equal(profile.resolve(baseline.env).SYLLABUS_CHECK_ACADEMIC_V2,'on');
  const planned=h.policy?require('../../server/lib/syllabuscheck/academicV2Plan').plan(content,masters):null;
  for(const r of optimized.result.hybrid.academicV2.academic.relationships){const p=planned.pairs.find(p=>p.id===r.id);if(!p)continue;assert.equal(r.sourceText,p.source);assert.equal(r.targetText,p.target);if(TYPES.includes(r.relationshipType)){assert.equal(r.relationshipId,'VPAA-'+String(TYPES.indexOf(r.relationshipType)+1).padStart(2,'0'));assert.ok(r.week);assert.equal(r.verification,'quotes_verified');assert.equal(r.academicJudgment,'ALIGNED');}}
  const classifications=optimized.result.hybrid.academicV2.academic.relationships.filter(r=>r.relationshipType==='CLO-classification');assert.equal(classifications.length,4);assert.ok(classifications.every(r=>r.verification==='quotes_verified'));
  for(const {transport}of [baseline,optimized,scoped]){const classes=transport.pairs().filter(p=>p.type==='CLO-classification');assert.equal(classes.length,4);classes.forEach((p,i)=>{assert.ok(p.source.includes(content.meta.program));assert.ok(p.source.includes(content.meta.title));assert.ok(p.source.includes(LEVELS[i]));assert.equal(p.target,content.clos[i].statement);});assert.ok(transport.pairs().some(p=>p.type==='CLO-PO'&&p.source===masters.pos[0].text));}
  const runId=await svc.storeRun(optimized.db,{syllabusId:100,content,result:optimized.result,createdBy:26});const stored=await repo.readReport(optimized.db,runId);assert.deepEqual(stored.hybrid.referenceContext,optimized.result.hybrid.referenceContext);assert.deepEqual(stored.hybrid.academicV2.academic.relationships,optimized.result.hybrid.academicV2.academic.relationships);
  assert.equal(JSON.stringify(content),before);
  const off=await check(content,masters,{useAi:false});assert.equal(off.result.hybrid.semanticCoverage.evaluated,0);
  evidence.push({code,phase:'profile/optimization/storage',sevenVpaa:7,fourClassifications:4,baselineRequests:baseline.transport.sent.length,recommendedRequests:optimized.transport.sent.length,optionalScopedRequests:scoped.transport.sent.length,officialScore:optimized.result.overall,threshold:optimized.result.passThreshold,scoringAndJudgmentParity:true,inMemoryReportReload:true,providerOffVerified:0});
 });
}
test('seven independent VPAA judgments include partial, insufficient and keyword-overlap adversarial answers',async t=>{
 h.liveGuard(t);const {content,masters}=fixture('BSIT'),labels=['NOT_ALIGNED','PARTIALLY_ALIGNED','ALIGNED','NOT_ALIGNED','PARTIALLY_ALIGNED','INSUFFICIENT_EVIDENCE','ALIGNED'];
 const row=content.plan.find(r=>r.kind!=='exam');row.contents=content.meta.title+': identify vocabulary only.';row.ilos[0].text=content.meta.title+': design and demonstrate a working system.';row.activities=content.meta.title+': copy a glossary without practising the required performance.';row.tasks=content.meta.title+': attendance only.';
 const spec=p=>{const index=TYPES.indexOf(p.type);if(index<0)return;return {label:labels[index],explanation:'Scripted independent judgment: matching words do not establish the required performance relationship.',recommendation:['ALIGNED','INSUFFICIENT_EVIDENCE'].includes(labels[index])?'NO_CHANGE':'REVIEW_REQUIRED',correctionField:'undetermined',draft:''};};
 const {result}=await check(content,masters,{script:spec});
 for(const [i,type]of TYPES.entries()){const rows=result.hybrid.academicV2.academic.relationships.filter(r=>r.relationshipType===type);assert.ok(rows.length);for(const r of rows){assert.equal(r.academicJudgment,labels[i]==='INSUFFICIENT_EVIDENCE'?null:labels[i]);assert.notEqual(r.status,labels[i]==='ALIGNED'?'REQUIRES_REVISION':'SUPPORTED_BY_SUPPLIED_EVIDENCE');}}
 evidence.push({phase:'vpaa-adversarial',types:TYPES,scriptedLabels:labels,independent:true});
});
test('all four classification labels are structural only; incorrect, ambiguous and missing classifications stay distinct',async t=>{
 h.liveGuard(t);for(const [index,level]of LEVELS.entries()){
  const {content,masters}=fixture('BSIT');
  content.clos[index].statement=[
   'Independently design, deploy and defend a complete production system without introductory instruction.',
   'List the classroom number and timetable without developing any subject competency.',
   'Recognize the names of concepts without applying or demonstrating an acquired competency.',
   'Optimize execution speed while disregarding ethical responsibility and institutional values.'
  ][index];
  const before=JSON.stringify(content);const evaluated=await check(content,masters,{script:p=>p.id===`clo${index}-classification`?{label:'NOT_ALIGNED',explanation:'Scripted: the stated competency is inappropriate for the assigned classification.',recommendation:'REVIEW_REQUIRED',draft:''}:undefined});
  assert.equal(evaluated.result.hybrid.academicV2.academic.relationships.find(r=>r.id===`clo${index}-classification`).academicJudgment,'NOT_ALIGNED');assert.equal(JSON.stringify(content),before);
  content.clos[index].level=LEVELS[(index+1)%4];const wrongLabel=await check(content,masters);assert.equal(wrongLabel.result.hybrid.ruleCoverage.rules.find(r=>r.ruleId===`CLO${index+1}:structure`).status,'FAIL');
  content.clos[index].level='';const missing=await check(content,masters);const row=missing.result.hybrid.academicV2.academic.relationships.find(r=>r.id===`clo${index}-classification`);assert.equal(row.academicJudgment,null);assert.equal(row.verification,'not_checked');assert.ok(!missing.transport.pairs().some(p=>p.id===row.id));assert.equal(missing.result.hybrid.ruleCoverage.rules.find(r=>r.ruleId===`CLO${index+1}:structure`).status,'FAIL');
  content.clos[index].level=level;content.clos[index].statement='Develop an appropriate understanding of relevant practices.';const ambiguous=await check(content,masters,{script:p=>p.id===`clo${index}-classification`?{label:'PARTIALLY_ALIGNED',explanation:'Scripted ambiguous performance expectation.',recommendation:'REVIEW_REQUIRED',draft:''}:undefined});assert.equal(ambiguous.result.hybrid.academicV2.academic.relationships.find(r=>r.id===row.id).academicJudgment,'PARTIALLY_ALIGNED');
 }evidence.push({phase:'classification-variants',levels:LEVELS,wrongSemantics:'detected despite valid label',missing:'not assumed/not asked',ambiguous:'faculty review',automaticReclassification:false});
});
test('an invented official PO or fabricated evidence quote is refused by the existing response validator',async t=>{
 h.liveGuard(t);const {content,masters}=fixture('BSIT');const transport=h.scriptedTransport(()=>({sourceQuote:'INVENTED OFFICIAL PO999'}));
 const r=await h.evaluateV2(content,masters,{transport});assert.ok(r.result.academic.relationships.every(row=>row.academicJudgment===null));assert.ok(r.result.academic.relationships.every(row=>row.verification!=='quotes_verified'));
 assert.equal(masters.pos.length,9);assert.ok(!masters.pos.some(p=>p.no===999));
});
test.after(()=>{repo.mastersFor=originalMasters;fs.writeFileSync(path.join(OUT,'focused-evidence.json'),JSON.stringify({kind:'Scripted software conformance using read-only actual development references; no live Claude accuracy claim',recommendedOptimization:recommended,optionalCourseContext:'scoped',records:evidence,liveModelCalls:0},null,2));});
