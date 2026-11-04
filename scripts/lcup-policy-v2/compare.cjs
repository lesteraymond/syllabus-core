'use strict';
// Isolated comparison. Uses current engine output and existing pair/answer
// verification only. No production policy edits, monkeypatches, DB or live AI.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {run,coded}=require('../../server/lib/syllabuscheck/engine');
const {sample}=require('../../server/lib/syllabuscheck/fixtures');
const {validate,isNoRewrite,resetProviderBlock}=require('../../server/lib/syllabuscheck/gemini');
const {project,manifestFor,contextKey,TYPES}=require('./projection.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/lcup-policy-v2');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function answer(pair,label='ALIGNED'){
 const empty=!pair.source.trim()||!pair.target.trim();if(empty)label='INSUFFICIENT_EVIDENCE';
 return {id:pair.id,label,explanation:empty?'The supplied side is missing.':label==='ALIGNED'?'Controlled assumption: the two supplied texts support this relationship.':'Controlled assumption: the two supplied texts concern different academic content; review the responsible field.',sourceQuote:empty?'':pair.source.slice(0,18),targetQuote:empty?'':pair.target.slice(0,18),sourceBloom:'N/A',targetBloom:'N/A',draft:label==='ALIGNED'||empty?'':isNoRewrite(pair.type)?'Review the responsible field against the stated source with faculty.':`${pair.target} Revise the stated performance for the supplied subject.`};
}
function transcript(manifest,decide=()=> 'ALIGNED'){
 const accepted=validate({judgements:manifest.pairs.map(p=>answer(p,decide(p)))},manifest.pairs);
 return accepted.map(j=>({...j,contextHash:contextKey(manifest.pairs.find(p=>p.id===j.id))}));
}
function controlled(){
 const {content,masters}=sample();
 content.clos.forEach((c,i)=>{c.level=['Introductory','Enabling','Demonstrating','Integration of Values'][i];c.statement=['Explain object-oriented programming concepts.','Implement and test Java methods.','Develop and evaluate a Java application.','Demonstrate honest and responsible teamwork in programming.'][i];});
 content.description=[{id:'description',t:'This course develops object-oriented programming knowledge and skills through Java. Students explain classes, objects and methods, implement reusable components, test program behavior and develop applications. They analyze requirements and evaluate solutions through guided practice, collaborative programming and individual projects. Ethical teamwork, attribution and responsible use of computing resources support the technical learning objectives of the course.'}];
 content.plan.forEach((row,i)=>{if(row.kind==='exam')return;row.contents=i===0?'Introduction to Computer Programming 2 and its course objectives':'Java classes, methods and object-oriented program design';row.ilos[0].text='Implement and test Java methods for the stated program requirements.';row.activities='Guided explanation with annotated examples followed by programming practice.';row.tasks='Implement and test the stated Java method, then explain the results.';row.values='Courage: explain a programming decision and revise it after feedback.';});
 return {content,masters};
}
async function currentReport(content,masters,decide=()=> 'ALIGNED',{unavailable=false}={}){
 resetProviderBlock();
 const transport=async(url,req)=>{const pairs=JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({judgements:pairs.map(p=>answer(p,decide(p)))})}]}}]})};};
 return run(content,masters,{useAi:!unavailable,env:{SYLLABUS_CHECK_AI_PROVIDER:unavailable?'off':'gemini',GEMINI_API_KEY:'test-only-not-a-real-key'},transport,linkChecker:async url=>({url,status:'ok',httpStatus:200})});
}
async function compareAll(){
 const priorFetch=globalThis.fetch;let networkAttempts=0;
 globalThis.fetch=async()=>{networkAttempts++;throw Error('Policy V2 comparison is offline');};
 const results=[],inputs=[];
 try{
  const mastersBytes=fs.readFileSync(path.join(root,'docs/lcup-approved-offline/masters.json')),snapshot=JSON.parse(mastersBytes);
  inputs.push({file:'docs/lcup-approved-offline/masters.json',sha256:hash(mastersBytes)});
  for(const key of ['it202','ie402','cpe304']){
   const file=`docs/lcup-approved-offline/${key}.fixture.json`,bytes=fs.readFileSync(path.join(root,file)),fixture=JSON.parse(bytes),content=fixture.content,masters=snapshot.programs[content.meta.program].masters;
   const deterministic=coded(content,masters,{titleComparison:'exact'});
   const report={score:deterministic.critical?0:null,findings:deterministic.findings,baseScore:deterministic.base.overall,hybrid:{baseScore:deterministic.base.overall,identity:deterministic.identity,codedChecks:deterministic.checks,critical:deterministic.critical,alignment:{status:'not_evaluated',judgements:[]},deductions:[],ready:false,stages:{}}};
   inputs.push({file,sha256:hash(bytes)});
   results.push({id:`verified-${key}`,kind:'verified_source_no_semantic_judgments',sourceSha256:hash(bytes),note:'Source content and frozen historical masters unchanged. Objective discrepancies/reference conflicts do not supply faculty semantic labels.',comparison:project({content,masters,report,provenance:'verified_PDF_content_with_no_academic_judgments'})});
  }
  const scenarios=[{id:'controlled-supported-assumption'},
   {id:'complete-off-course-content',edit:content=>content.plan.forEach(row=>{if(row.kind!=='exam')row.contents='Folk dance choreography and costume design';}),decide:p=>['Content-course','Content-ILO','ILO-content','Content-activity','Content-assessment'].includes(p.type)?'NOT_ALIGNED':'ALIGNED',rootAllContent:true},
   {id:'all-seven-misaligned',edit:content=>content.plan.forEach(row=>{if(row.kind!=='exam')Object.assign(row,{contents:'Geography of island climates',ilos:[{...row.ilos[0],text:'Perform a violin concerto.'}],activities:'Bake and decorate a pastry.',tasks:'Perform the violin concerto for assessment.'});}),decide:p=>TYPES.includes(p.type)||p.type==='ILO-content'?'NOT_ALIGNED':'ALIGNED'},
   ...TYPES.map(type=>({id:`independent-${type}`,decide:p=>p.type===type&&p.id.startsWith('row2-')?'NOT_ALIGNED':'ALIGNED'})),
   {id:'same-root-four-links',edit:content=>{content.plan[2].contents='Folk dance choreography and costume design';},decide:p=>p.id.startsWith('row2-')&&['Content-course','Content-ILO','ILO-content','Content-activity','Content-assessment'].includes(p.type)?'NOT_ALIGNED':'ALIGNED',rootOne:true},
   {id:'partial-evidence',omitHalf:true},{id:'AI-unavailable',unavailable:true},
   {id:'partial-one-relationship',decide:p=>p.type==='Content-activity'&&p.id.startsWith('row2-')?'PARTIALLY_ALIGNED':'ALIGNED'},
   {id:'untagged-ILO',edit:c=>{c.plan[2].ilos[0].tags=[];}},
   {id:'grouped-weeks',edit:c=>{c.plan[2].week='3-4';c.plan.splice(3,1);}},
   {id:'legacy-ILO-assessment-only',decide:p=>p.type==='ILO-assessment'&&p.id.startsWith('row2-')?'NOT_ALIGNED':'ALIGNED'},
   {id:'duplicate-value-name-and-meaning',edit:c=>{c.plan[2].values='Respect: listen to the group.';},decide:p=>p.type==='Module-value'&&p.id==='row2-value'?'PARTIALLY_ALIGNED':'ALIGNED'},
   {id:'one-CLO-many-PO-links',decide:p=>p.id.startsWith('clo0-')&&['CLO-PO','CLO-anyPO'].includes(p.type)?'NOT_ALIGNED':'ALIGNED'},
  ];
  for(const scenario of scenarios){
   const {content,masters}=controlled();scenario.edit?.(content);const inputBefore=JSON.stringify({content,masters});
   const decide=scenario.decide||(()=> 'ALIGNED'),report=await currentReport(content,masters,decide,{unavailable:scenario.unavailable});
   const reportBefore=JSON.stringify(report),manifest=manifestFor(content,masters);
   let observations=scenario.unavailable?[]:transcript(manifest,decide);
   if(scenario.omitHalf)observations=observations.filter((j,i)=>i%2===0);
   const rootGroups=[];
   if(scenario.rootOne||scenario.rootAllContent){
    const rows=scenario.rootOne?[2]:content.plan.map((row,i)=>row.kind!=='exam'?i:null).filter(i=>i!==null);
    for(const row of rows)rootGroups.push({id:`controlled-content-root-${row}`,pairIds:manifest.pairs.filter(p=>p.id.startsWith(`row${row}-`)&&['Content-course','Content-ILO','Content-activity','Content-assessment'].includes(p.type)).map(p=>p.id),basis:'The controlled scenario declares one off-course content field as the shared cause; this is not a faculty-confirmed cause.',provenance:'controlled_scenario_assumption'});
   }
   const comparison=project({content,masters,report,observations,rootGroups,provenance:'author_scripted_hypothesis_not_faculty_judgment'});
   if(JSON.stringify(report)!==reportBefore||JSON.stringify({content,masters})!==inputBefore)throw Error('Comparison mutated current results or inputs');
   results.push({id:scenario.id,kind:'controlled_synthetic_case',note:'The current policy candidate is provisional: synthetic masters remain marked synthetic, so no official grade is published. All optional runtime flags remain off.',currentAiStatus:report.hybrid.alignment.status,currentFindings:report.findings.map(f=>({id:f.id,ruleId:f.ruleId,severity:f.severity})),comparison});
  }
  return {version:'policy-v2-shadow-comparison-1',officialPolicyChanged:false,paidAiCalls:0,databaseWrites:0,networkAttempts,runtimeAcademicFlagsEnabled:[],inputs,results};
 }finally{globalThis.fetch=priorFetch;resetProviderBlock();}
}
module.exports={compareAll,controlled,transcript,currentReport};
if(require.main===module)compareAll().then(result=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'shadow-comparison.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({cases:result.results.length,networkAttempts:result.networkAttempts,rows:result.results.map(r=>({id:r.id,currentProvisional:r.comparison.current.provisionalScore,base:r.comparison.current.baseScore,weekly:r.comparison.weekly.disposition,counts:r.comparison.weekly.counts,coverage:r.comparison.weekly.coverage,bounds:r.comparison.weekly.descriptiveSupportBoundsPct,roots:r.comparison.remediation.declaredRootCount}))},null,2));}).catch(error=>{console.error(error);process.exitCode=1;});
