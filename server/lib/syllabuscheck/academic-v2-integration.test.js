'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {sample}=require('./fixtures');
const engine=require('./engine');
const policy=require('./academicPolicyV2');
const activation=require('./academicV2Activation');
const contract=require('./cloClassification');
const {POLICY,V2_PROMPT}=require('./academicV2Plan');
const {D1}=require('./stages');
const MODEL='claude-sonnet-5-5';

function envFor(provider='off'){
 return {SYLLABUS_CHECK_ACADEMIC_V2:'on',SYLLABUS_CHECK_AI_PROVIDER:provider,
  SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL:MODEL,ANTHROPIC_MODEL:MODEL,
  ANTHROPIC_API_KEY:'sk-ant-unit-test-only-not-a-real-key',ANTHROPIC_MAX_TOKENS:'4096',ANTHROPIC_MAX_RETRIES:'0',
  SYLLABUS_CHECK_AI_BATCH:'8',SYLLABUS_CHECK_AI_CONCURRENCY:'1'};
}
function coded(content,masters){return engine.coded(content,masters);}

test('the normal application integration is explicitly off by default and records unavailable links as NOT_CHECKED',async()=>{
 assert.equal(activation.enabled({}),false);
 assert.equal(activation.enabled({SYLLABUS_CHECK_ACADEMIC_V2:'off'}),false);
 const {content,masters}=sample(),result=await policy.evaluateIntegrated(content,masters,coded,{env:envFor()});
 assert.equal(result.mode,'live-application');
 assert.equal(result.status,'not_evaluated');
 assert.equal(result.alignment.liveModelCalls,0);
 assert.ok(result.academic.relationships.length>0);
 assert.ok(result.academic.relationships.every(r=>r.status==='NOT_CHECKED'||r.status==='FACULTY_REVIEW'));
 assert.ok(result.academic.relationships.filter(r=>r.status==='NOT_CHECKED').every(r=>r.academicJudgment===null));
 for(const type of POLICY.weeklyTypes){
  const requirements=result.academic.requirements.filter(r=>r.relationshipType===type);
  assert.equal(requirements.length,content.plan.filter(row=>row.kind!=='exam').length,type);
  for(const req of requirements){
   const links=req.evidenceIds.map(id=>result.academic.relationships.find(r=>r.id===id)).filter(Boolean);
   assert.ok(links.length>0,`${req.id} has individual evidence records`);
   assert.ok(links.every(r=>r.relationshipType===type&&r.status!=='SUPPORTED_BY_SUPPLIED_EVIDENCE'),`${req.id} cannot pass without AI`);
  }
 }
 assert.ok(result.academic.requirements.some(r=>r.id==='course.CLORelevance'));
 assert.ok(result.academic.requirements.some(r=>r.id==='course.clo0.PO'));
 assert.ok(result.academic.requirements.some(r=>r.id==='course.clo0.EGA'));
 assert.ok(result.academic.requirements.some(r=>r.id==='course.descriptionTitle'));
 assert.ok(result.academic.requirements.some(r=>r.id==='course.descriptionContent'));
 const description=content.description.map(item=>item.t).join('\n');
 assert.ok(result.academic.relationships.filter(r=>['Course-CLO','CLO-PO','CLO-EGA','CLO-classification'].includes(r.relationshipType)).every(r=>!r.sourceText.includes(description)),'the allowed description checks do not bleed into CLO judgments');
 assert.ok(!result.academic.requirements.some(r=>r.id.includes('weekly:')&&/values|diverseLearners/.test(r.id)),'no eighth mandatory weekly check');
 assert.ok(!result.academic.relationships.some(r=>r.relationshipType==='Module-value'||r.relationshipType==='Value-use'||r.relationshipType==='Activity-fit'));
 assert.ok(!result.academic.relationships.some(r=>/CLO.*Description|Description.*CLO/.test(r.relationshipType)),'the excluded CLO-description relationship stays absent');
});

test('classification-3 and r2 run together over separate weekly ILO-CLO pairs through the integrated Claude adapter',async()=>{
 assert.match(V2_PROMPT,/CLO4's fixed label alone is never evidence that a value is meaningfully integrated/);
 assert.match(D1.tests,/valueUse is integrated/);
 assert.match(D1.tests,/name_only/);
 const {content,masters}=sample();
 const row=content.plan.find(r=>r.kind!=='exam'),[clo1,clo2]=content.clos;
 row.ilos=[
  {id:'multi-a',text:'Identify core programming structures',tags:[`clo:${clo1.id}`,`clo:${clo2.id}`]},
  {id:'multi-b',text:'Apply programming structures to solve a course problem',tags:[`clo:${clo2.id}`]},
 ];
 const before=structuredClone(content);
 const sent=[];
 const transport=async(_url,init)=>{
  const body=JSON.parse(init.body),message=JSON.parse(body.messages[0].content);sent.push(body);
  const judgements=message.document_data.map(pair=>({id:pair.id,label:'ALIGNED',explanation:'Mocked evidence supports this relationship.',
   sourceQuote:pair.source.trim().slice(0,18),targetQuote:pair.target.trim().slice(0,18),sourceBloom:'N/A',targetBloom:'N/A',draft:'',
   recommendation:'NO_CHANGE',correctionField:'none',correctionReason:''}));
  return new Response(JSON.stringify({id:'msg_mock_only',type:'message',role:'assistant',model:MODEL,
   content:[{type:'text',text:JSON.stringify({judgements})}],stop_reason:'end_turn',usage:{input_tokens:100,output_tokens:100}}),
   {status:200,headers:{'content-type':'application/json'}});
 };
 const result=await policy.evaluateIntegrated(content,masters,coded,{env:envFor('anthropic'),transport});
 assert.equal(result.alignment.status,'completed');
 assert.ok(result.alignment.liveModelCalls>0);
 assert.equal(result.contracts.cloClassification,contract.VERSION);
 assert.ok(result.contracts.recommendation);
 const byType=Object.fromEntries(POLICY.weeklyTypes.map(type=>[type,result.academic.relationships.filter(r=>r.relationshipType===type)]));
 for(const type of POLICY.weeklyTypes)assert.ok(byType[type].length>0,`${type} reached the integrated evaluator`);
 const multi=row.ilos;
 for(const ilo of multi){
  const mapped=ilo.tags.map(tag=>result.academic.relationships.find(r=>r.id.startsWith(`row${content.plan.indexOf(row)}-`)&&r.id.includes(`-ilo${multi.indexOf(ilo)}-${tag}`)));
  assert.ok(mapped.every(Boolean),`${ilo.id} has one record per assigned CLO`);
  assert.ok(mapped.every(r=>r.cloClassification?.status==='evaluated'&&r.classificationContext),`${ilo.id} carries its fixed classification and cross-week context`);
  assert.ok(mapped.every(r=>r.correction?.canAutoApply===false),`${ilo.id} recommendations remain faculty-reviewed`);
 }
 assert.ok(sent.every(body=>JSON.parse(body.messages[0].content).course.description===''),'Course Description is absent from shared context in every Policy V2 request');
 const classificationRequests=sent.filter(body=>JSON.parse(body.messages[0].content).document_data.some(pair=>pair.type==='ILO-CLO'));
 assert.ok(classificationRequests.length>0);
 assert.ok(classificationRequests.every(body=>{
  const user=JSON.parse(body.messages[0].content),system=Array.isArray(body.system)?body.system.map(x=>x.text).join('\n'):body.system;
  return !!user.recommendation_context&&user.document_data.filter(pair=>pair.type==='ILO-CLO').every(pair=>!!pair.classificationContext)&&system.includes('classificationContext')&&system.includes('correctionField');
 }));
 assert.deepEqual(content,before,'evaluation never overwrites the faculty text or mappings');
});

test('normal shared checking service adds the advisory profile only behind the flag and saves it in the existing report JSON',async t=>{
 const service=require('../compliance/service'),repo=require('./repository');
 const {content,masters}=sample();
 const base={status:'scored',score:91,overall:91,passed:true,band:'Meets the standard',conformance:{ok:true,failed:[]},findings:[],areas:[],contact:null,
  hybrid:{version:'hybrid-2',ready:true,score:91,deductions:[],suggestions:[],alignment:{status:'completed',provider:'gemini',model:'offline-test'}}};
 t.mock.method(repo,'mastersFor',async()=>masters);
 t.mock.method(engine,'run',async()=>structuredClone(base));
 const off=await service.checkHybrid({},content,{env:{...envFor(),SYLLABUS_CHECK_ACADEMIC_V2:'off'}});
 assert.equal(off.hybrid.academicV2,undefined);
 assert.equal(off.score,base.score);
 const on=await service.checkHybrid({},content,{env:{...envFor(),SYLLABUS_CHECK_AI_PROVIDER:'off'}});
 assert.equal(on.hybrid.academicV2.mode,'live-application');
 assert.equal(on.hybrid.academicV2.status,'not_evaluated');
 assert.equal(on.score,base.score);
 assert.deepEqual(on.hybrid.deductions,base.hybrid.deductions);
 let saved=null;
 const conn={query:async(sql,values)=>{
  if(sql.startsWith('INSERT INTO ai_check_runs'))return [{insertId:812}];
  if(sql.startsWith('INSERT INTO syllabus_check_reports')){saved=JSON.parse(values[2]);return [[]];}
  return [[]];
 }};
 await service.storeRun(conn,{syllabusId:7,content,result:on,ai:true});
 assert.equal(saved.hybrid.academicV2.status,'not_evaluated');
 assert.equal(saved.hybrid.academicV2.academic.relationships.length,on.hybrid.academicV2.academic.relationships.length);
});
