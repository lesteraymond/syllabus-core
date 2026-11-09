'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const h=require('./harness'),svc=require('../../compliance/service'),repo=require('../repository');
const {createMemoryDb}=require('./memdb');
const {catalog,replaced,qualityIds}=require('../ruleCatalog');
const profile=require('../checkingProfile'),pending=require('../pendingRules');
const {coverageOf}=require('../ruleCoverage');
const {referenceReport}=require('../references');
const {qualityOf}=require('../quality');
const {buildVerdict}=require('../verdict');
const {POLICY}=require('../policy');
const standard=require('../../compliance/standard-v4.json');
const COMP={[profile.FLAG]:profile.NAME};
const link=async url=>({url,status:'ok',httpStatus:200});
async function world(t,over={},script){
 h.liveGuard(t);const {content,masters}=h.sample(); masters.synthetic=false;masters.fingerprint='comprehensive-synthetic';
 t.mock.method(repo,'mastersFor',async()=>masters);
 const db=createMemoryDb({syllabus:{content:JSON.stringify(content)}}),transport=h.scriptedTransport(script);
 const result=await svc.checkHybrid(db,content,{syllabusId:100,env:h.envFor({...COMP,...over}),transport,linkChecker:link});
 return {content,masters,db,transport,result};
}
const row=(r,id)=>r.hybrid.ruleCoverage.rules.find(r=>r.ruleId===id);
test('[VPAA-COMP-CONFIG] comprehensive scope cannot authorize a provider, external lookup, budget increase, or gate change',()=>{
 const input={...COMP,SYLLABUS_CHECK_STAGE_B:'off',SYLLABUS_CHECK_AI_MAX_REQUESTS:'1',SYLLABUS_CHECK_AI_GATE:'required'};
 const out=profile.resolve(input);
 assert.equal(out.SYLLABUS_CHECK_ACADEMIC_V2,'on'); for(const s of profile.STAGES)assert.equal(out[`SYLLABUS_CHECK_STAGE_${s}`],'on');
 assert.equal(out.SYLLABUS_CHECK_AI_MAX_REQUESTS,'1');assert.equal(out.SYLLABUS_CHECK_AI_GATE,'required');
 assert.equal(out.SYLLABUS_CHECK_REF_VERIFY,undefined);assert.equal(out.ANTHROPIC_API_KEY,undefined);assert.equal(input.SYLLABUS_CHECK_STAGE_B,'off');
 assert.deepEqual(profile.resolve({}),{});assert.equal(catalog.filter(r=>r.namespace==='registered_standard').length,47);
 const unavailable=coverageOf({}, {plan:{}});assert.equal(unavailable.unavailable,true);assert.equal(unavailable.counts.verified,0);assert.equal(unavailable.relationshipInstances.expected,null,'a failed coverage planner must not invent a zero denominator');
 assert.equal(new Set(catalog.map(r=>r.ruleId)).size,catalog.length);assert.deepEqual(replaced,['C-04','R-02','R-03']);
});
test('[VPAA-COMP-SCOPE] comprehensive service retains Plan-sequence, every distinct stage, seven VPAA links, and four classifications',async t=>{
 const {result,transport}=await world(t);const types=new Set(transport.pairs().map(p=>p.type));
 for(const type of ['CLO-set','Plan-sequence','CLO-coverage','Activity-fit','Assessment-fit','Value-use','Ref-relevance','Week1-introduction',...h.POLICY.weeklyTypes,'CLO-classification'])assert.ok(types.has(type),`${type} must be executable`);
 for(const type of profile.V2_ADVISORY)for(const id of new Set(transport.pairs().filter(p=>p.type===type).map(p=>p.id)))assert.equal(transport.pairs().filter(p=>p.type===type&&p.id===id).length,1,`${id} is evaluated once`);
 assert.equal(result.hybrid.ruleCoverage.profile,profile.NAME);
 for(let i=1;i<=7;i++)assert.equal(row(result,`VPAA-0${i}`).verified,true);
 for(let i=1;i<=4;i++){assert.equal(row(result,`CLO${i}:semantic`).verified,true);assert.equal(row(result,`CLO${i}:structure`).verified,true);}
 for(const record of result.hybrid.academicV2.academic.relationships.filter(r=>r.relationshipId)){assert.ok(record.week);assert.ok(record.sourceField);assert.ok(record.targetField);}
 assert.equal(result.hybrid.ruleCoverage.registeredStandard,47);assert.equal(result.hybrid.ruleCoverage.directHybridRules,44);
 for(const id of replaced){assert.equal(row(result,id).enabled,false);assert.equal(result.hybrid.deductions.some(d=>d.id.startsWith(id)),false);}
});
test('[VPAA-COMP-OFF] useAi false suppresses both legacy and Policy V2 provider requests',async t=>{
 h.liveGuard(t);const {content,masters}=h.sample();t.mock.method(repo,'mastersFor',async()=>masters);
 const tr=h.scriptedTransport(); const result=await svc.checkHybrid({},content,{useAi:false,env:h.envFor(COMP),transport:tr,linkChecker:link});
 assert.equal(tr.sent.length,0);assert.equal(result.hybrid.academicV2.status,'not_evaluated');
 for(const rule of result.hybrid.ruleCoverage.rules.filter(r=>r.ruleId.startsWith('VPAA-'))){assert.equal(rule.attempted,false);assert.equal(rule.verified,false);assert.equal(rule.status,'NOT_CHECKED');assert.ok(rule.instances.length>0);}
 assert.ok(result.hybrid.ruleCoverage.relationshipInstances.expected>0);assert.equal(result.hybrid.ruleCoverage.relationshipInstances.verified,0);
 assert.equal(row(result,'REF-02').enabled,true);assert.equal(row(result,'REF:authenticity').enabled,false);
 const legacy=await svc.checkHybrid({},content,{useAi:false,env:h.envFor({SYLLABUS_CHECK_ACADEMIC_V2:'off'}),transport:tr,linkChecker:link});
 assert.ok(legacy.hybrid.ruleCoverage.relationshipInstances.expected>0,'an AI-disabled legacy run retains the unasked relationship denominator');assert.equal(legacy.hybrid.ruleCoverage.relationshipInstances.verified,0);assert.equal(tr.sent.length,0);
});
test('[VPAA-COMP-UNAVAILABLE] unavailable provider leaves academic checks not verified, while deterministic/APA checks execute',async t=>{
 const {result}=await world(t,{ANTHROPIC_API_KEY:''});
 assert.equal(result.overall,null);for(let i=1;i<=7;i++)assert.equal(row(result,`VPAA-0${i}`).status,'NOT_CHECKED');
 assert.equal(row(result,'T-01').verified,true);assert.ok(result.hybrid.references.length>0);
 assert.equal(row(result,'REF:authenticity').verified,false);
});
test('[VPAA-COMP-RESERVED] every reserved ID stays NOT_CHECKED with its exact missing decision',async t=>{
 const {result}=await world(t,{ANTHROPIC_API_KEY:''});
 const verdict=buildVerdict(result,h.sample().content,{all:true}).all;
 assert.equal(Object.keys(pending).length,11);
 for(const [id,p]of Object.entries(pending)){const r=row(result,id);assert.equal(r.implemented,false);assert.equal(r.status,'NOT_CHECKED');assert.equal(r.activationState,p.state);assert.match(r.reason,/VPAA|Registrar/);assert.ok(verdict.some(f=>f.ruleId===id&&f.status==='NOT_CHECKED'&&f.explanation===p.reason));}
});
test('[VPAA-COMP-CROSSWALK] absent PO-EGA data cannot be reported as verified P-03; legacy scoring is preserved',async t=>{
 h.liveGuard(t);const {content,masters}=h.sample();content.outcomes.pos.forEach(p=>p.egas=[]);
 const r=await h.engine.run(content,masters,{useAi:false,linkChecker:link,env:{}});
 const p=row(r,'P-03');assert.equal(p.status,'NOT_CHECKED');assert.equal(p.verified,false);assert.match(p.reason,/crosswalk/);
 assert.equal(r.ruleChecks.find(r=>r.ruleId==='P-03').status,'PASS','old numeric score was not silently changed');
});
test('[VPAA-COMP-QUALITY] all twelve quality predicates have explicit execution and applicability receipts',()=>{
 const c=h.sample().content,full=qualityOf(c);assert.deepEqual(full.checks.map(r=>r.ruleId).sort(),[...qualityIds].sort());assert.ok(full.checks.every(r=>r.executed));
 assert.ok(qualityOf({}).checks.every(r=>r.status==='NOT_APPLICABLE'));assert.ok(full.findings.every(f=>f.advisory));
});
test('[VPAA-COMP-APA] APA receipts distinguish unrun type-specific predicates from a successful format predicate',()=>{
 const entries=referenceReport({refs:{books:{items:[{t:'Smith, A. (2024). Computing foundations (2nd ed.). Pearson.'}]}}},{year:2026});
 assert.ok(entries[0].checkedCodes.includes('BOOK_PUBLISHER'));assert.ok(!entries[0].checkedCodes.includes('JOURNAL_PAGES'));assert.equal(entries[0].authenticity.status,'not_verified');
});
test('[VPAA-COMP-STRUCTURE] swapped but valid CLO labels fail the required per-CLO structure without changing faculty data',()=>{
 const {content}=h.sample();content.clos.forEach((c,i)=>c.level=h.POLICY.classifications[i]);[content.clos[0].level,content.clos[1].level]=[content.clos[1].level,content.clos[0].level];const before=structuredClone(content);
 const v=buildVerdict({hybrid:{}},content,{all:true});assert.ok(v.all.some(r=>r.ruleId==='CLO-08'&&r.path==='clos[0].level'&&r.status==='FAIL'));assert.deepEqual(content,before);
});
test('[VPAA-COMP-PERSISTENCE] complete manifest and V2 reuse receipts survive saved report storage',async t=>{
 const {result,db,content}=await world(t);const id=await svc.storeRun(db,{syllabusId:100,content,result,createdBy:26});
 const saved=await repo.readReport(db,id);assert.deepEqual(saved.hybrid.ruleCoverage,result.hybrid.ruleCoverage);
 const cached=await repo.reusableJudgements(db,100);for(const j of result.hybrid.academicV2.alignment.judgements.filter(j=>!j.unverified&&j.key))assert.ok(cached.has(j.key));
 const tr=h.scriptedTransport();const again=await svc.checkHybrid(db,content,{syllabusId:100,env:h.envFor(COMP),transport:tr,linkChecker:link});
 assert.ok(again.hybrid.academicV2.alignment.judgements.some(j=>j.reused));assert.equal(tr.pairs().filter(p=>p.type==='CLO-classification').length,0);
});
for(const label of ['ALIGNED','PARTIALLY_ALIGNED','NOT_ALIGNED','INSUFFICIENT_EVIDENCE'])test(`[VPAA-COMP-PARITY-${label}] comprehensive advice preserves official score, deductions and gate policy`,async t=>{
 const w=await world(t,{},p=>p.id==='row0-ilo0-activity'?{label}:undefined);
 const other=await svc.checkHybrid(w.db,w.content,{env:h.envFor({SYLLABUS_CHECK_ACADEMIC_V2:'off'}),transport:h.scriptedTransport(p=>p.id==='row0-ilo0-activity'?{label}:undefined),linkChecker:link});
 for(const key of ['overall','passed','passThreshold','baseScore'])assert.equal(w.result[key],other[key],key);
 assert.deepEqual(w.result.hybrid.deductions,other.hybrid.deductions);assert.equal(standard.passThreshold,79);assert.deepEqual(standard.areas.map(a=>a.weight),[20,20,20,15,10,15]);assert.equal(POLICY.alignment,3);assert.equal(POLICY.partialAlignment,1);
});
test('[VPAA-COMP-PARTIAL] one unverified weekly instance prevents full verification of its relationship type',async t=>{
 const {result,content,masters}=await world(t);
 const r=result.hybrid.academicV2.academic.relationships.find(r=>r.relationshipType==='Content-activity');r.verification='unverified';r.academicJudgment=null;r.status='NOT_CHECKED';
 const coverage=coverageOf(result,content,masters,profile.resolve(h.envFor(COMP)));const rel=coverage.rules.find(r=>r.ruleId==='VPAA-04');
 assert.equal(rel.verified,false);assert.equal(rel.status,'PARTIALLY_EVALUATED');assert.ok(coverage.relationshipInstances.notChecked>0);
});
test('[VPAA-COMP-BUDGET] a one-request shared budget bounds legacy plus V2 and leaves unasked instances not attempted',async t=>{
 const {result,transport}=await world(t,{SYLLABUS_CHECK_AI_MAX_REQUESTS:'1'});
 assert.ok(transport.sent.length<=1);assert.ok(result.hybrid.ruleCoverage.relationshipInstances.rows.some(r=>!r.attempted&&!r.verified));
 assert.equal(result.hybrid.ruleCoverage.rules.filter(r=>r.ruleId.startsWith('VPAA-')).some(r=>r.verified),false);
});
test('[VPAA-COMP-B3] incorrect existing mappings invoke the conditional any-CLO fallback through the existing stage',async t=>{
 const {result,transport}=await world(t,{},p=>p.type==='ILO-CLO'?{label:'NOT_ALIGNED'}:undefined);
 assert.ok(transport.pairs().some(p=>p.type==='ILO-anyCLO'));assert.equal(row(result,'ALN-02').enabled,true);
});
const {CASES,F}=require('./coded-rules.cases');
const {evaluate}=require('../../compliance/rules');
for(const rule of standard.rules)test(`[VPAA-COMP-RECEIPT-${rule.id}] execution receipts match valid, invalid, missing and declared boundary scopes`,()=>{
 const cases=CASES[rule.id];for(const mutate of [undefined,cases.invalid[1],cases.missing[1],...(cases.valid||[]).map(c=>c[1]),...(cases.invalidBoundary?[cases.invalidBoundary[1]]:[])]){
  const c=F.good(),ctx=F.ctx();mutate?.(c,ctx);const r=evaluate(c,{...standard,rules:[rule]},{...ctx,coverage:true});
  assert.equal(r.ruleChecks.length,1);const receipt=r.ruleChecks[0];assert.equal(receipt.ruleId,rule.id);
  assert.equal(receipt.status,receipt.items===0?'NOT_APPLICABLE':r.findings.length?'FAIL':'PASS');
  const legacy=evaluate(c,{...standard,rules:[rule]},ctx);delete r.ruleChecks;assert.deepEqual(r,legacy,'instrumentation must not change any score or finding');
 }
});
