'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {run}=require('../../server/lib/syllabuscheck/engine');
const {fixture,replay,POLICY}=require('./fixtures.cjs');
const {plan,aggregate}=require('../../server/lib/syllabuscheck/academicPolicyV2');
const {resetProviderBlock}=require('../../server/lib/syllabuscheck/gemini');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/lcup-policy-v2-implementation');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const contentLinks=['Content-course','Content-ILO','Content-activity','Content-assessment'];
const cases=[{id:'controlled-supported-assumption'},
 {id:'complete-off-course-content',edit:c=>c.plan.forEach(r=>{if(r.kind!=='exam')r.contents='Folk dance choreography and costume design';}),decide:p=>[...contentLinks,'ILO-content'].includes(p.type)?'NOT_ALIGNED':'ALIGNED',rootAll:true},
 {id:'all-seven-misaligned',edit:c=>c.plan.forEach(r=>{if(r.kind!=='exam')Object.assign(r,{contents:'Geography of island climates',ilos:[{...r.ilos[0],text:'Perform a violin concerto.'}],activities:'Bake and decorate a pastry.',tasks:'Perform the violin concerto for assessment.'});}),decide:p=>[...POLICY.weeklyTypes,'ILO-content'].includes(p.type)?'NOT_ALIGNED':'ALIGNED'},
 ...POLICY.weeklyTypes.map(type=>({id:`independent-${type}`,decide:p=>p.type===type&&p.id.startsWith('row2-')?'NOT_ALIGNED':'ALIGNED'})),
 {id:'same-root-four-links',edit:c=>{c.plan[2].contents='Folk dance choreography and costume design';},decide:p=>p.id.startsWith('row2-')&&[...contentLinks,'ILO-content'].includes(p.type)?'NOT_ALIGNED':'ALIGNED',rootOne:true},
 {id:'partial-evidence',omitHalf:true},{id:'AI-unavailable',unavailable:true},
 {id:'partial-one-relationship',decide:p=>p.id==='row2-contentactivity'?'PARTIALLY_ALIGNED':'ALIGNED'},
 {id:'untagged-ILO',edit:c=>{c.plan[2].ilos[0].tags=[];}},
 {id:'grouped-weeks',edit:c=>{c.plan[2].week='3-4';c.plan.splice(3,1);}},
 {id:'legacy-ILO-assessment-only',decide:p=>p.id==='row2-ilo0-assessment'?'NOT_ALIGNED':'ALIGNED'},
 {id:'duplicate-value-name-and-meaning',edit:c=>{c.plan[2].values='Respect: listen to the group.';},decide:p=>p.id==='row2-value'?'PARTIALLY_ALIGNED':'ALIGNED'},
 {id:'one-CLO-many-PO-links',decide:p=>p.id.startsWith('clo0-')&&['CLO-PO','CLO-anyPO'].includes(p.type)?'NOT_ALIGNED':'ALIGNED'}];
async function legacy(f,data){
 resetProviderBlock();
 const transport=async(_url,req)=>{const pairs=JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data,byId=new Map(pairs.map(p=>[p.id,p]));const judgements=data.judgements.filter(j=>byId.has(j.id)).map(j=>({...Object.fromEntries(['id','label','explanation','sourceBloom','targetBloom','draft'].map(k=>[k,j[k]])),sourceQuote:byId.get(j.id).source.slice(0,18),targetQuote:byId.get(j.id).target.slice(0,18)}));return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({judgements})}]}}]})};};
 return run(f.content,f.masters,{useAi:data.availability!=='unavailable',env:{SYLLABUS_CHECK_AI_PROVIDER:'gemini',GEMINI_API_KEY:'offline-comparison-not-a-key'},transport,linkChecker:async url=>({url,status:'ok',httpStatus:200})});
}
async function compare(){
 const network=globalThis.fetch;let attempts=0;globalThis.fetch=async()=>{attempts++;throw Error('Network forbidden in offline comparison');};
 const results=[],inputs=[];
 try{
  const snapshotFile='docs/lcup-approved-offline/masters.json',snapshotBytes=fs.readFileSync(path.join(root,snapshotFile)),snapshot=JSON.parse(snapshotBytes);inputs.push({file:snapshotFile,sha256:sha(snapshotBytes)});
  for(const id of ['it202','ie402','cpe304']){
   const file=`docs/lcup-approved-offline/${id}.fixture.json`,bytes=fs.readFileSync(path.join(root,file)),content=JSON.parse(bytes).content,masters=snapshot.programs[content.meta.program].masters;
   inputs.push({file,sha256:sha(bytes)});const f={content,masters};
   const data=replay(content,masters,()=>({}),{judgements:[],availability:'unavailable'});
   const old=await legacy(f,data),v2=await run(content,masters,{academicPolicy:POLICY.id,offlineReplay:data});
   results.push({id:'verified-'+id,kind:'verified-source-no-semantic-judgments',legacy:{policy:old.hybrid.policy?.version||'syllabus-policy-2',officialScore:old.score,candidate:old.hybrid.provisionalScore,base:old.hybrid.baseScore,ready:old.hybrid.ready},v2:{policy:POLICY.id,officialScore:v2.score,compliance:v2.compliance.score,academic:v2.academic.disposition,weeklyDisposition:aggregate(v2.academic.requirements.filter(r=>POLICY.weeklyTypes.includes(r.relationshipType))),objectiveRevisionCriteria:v2.academic.requirements.filter(r=>r.status==='REQUIRES_REVISION').map(r=>({id:r.id,findings:r.findings})),coverage:v2.academic.coverage,referenceIssues:v2.academic.references.issues},note:'Original source and frozen masters retained. No new semantic or faculty judgments supplied. Overall revision flags here arise only from identified objective criteria; weekly alignment remains NOT_EVALUATED.'});
  }
  for(const scenario of cases){
   const f=fixture();scenario.edit?.(f.content);const before=JSON.stringify(f),decide=scenario.decide||(()=> 'ALIGNED');
   const data=replay(f.content,f.masters,p=>({label:decide(p)}),scenario.unavailable?{judgements:[],availability:'unavailable'}:{});
   if(scenario.omitHalf)data.judgements=data.judgements.filter((_,i)=>i%2===0);
   if(scenario.rootOne||scenario.rootAll){const context=plan(f.content,f.masters);data.confirmedRoots=(scenario.rootOne?[2]:context.rows.map(r=>r.i)).map(i=>({id:'content-root-'+i,relationshipIds:context.pairs.filter(p=>p.id.startsWith(`row${i}-`)&&contentLinks.includes(p.type)).map(p=>p.id),correction:'Review the off-course content before revising dependent fields.',confirmation:{receiptId:'synthetic-root-'+i,reviewer:'Scripted mock reviewer',provenance:'offline-mock',inputHash:data.inputHash,referenceHash:data.referenceHash,basis:'Scenario assumption only; no faculty confirmed causality.'}}));}
   const old=await legacy(f,data),oldBefore=JSON.stringify(old),v2=await run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:data});
   if(before!==JSON.stringify(f)||oldBefore!==JSON.stringify(old))throw Error('Comparison changed its input or legacy report');
   results.push({id:scenario.id,kind:'controlled-synthetic-case',legacy:{policy:old.hybrid.scoring.official.policy,officialScore:old.score,candidate:old.hybrid.provisionalScore,base:old.hybrid.baseScore,ready:old.hybrid.ready,deductions:old.hybrid.deductions.map(d=>({id:d.id,points:d.points}))},v2:{policy:POLICY.id,officialScore:v2.score,compliance:v2.compliance.score,academic:v2.academic.disposition,coverage:v2.academic.coverage,weeklyFailed:v2.academic.requirements.filter(r=>POLICY.weeklyTypes.includes(r.relationshipType)&&r.status==='REQUIRES_REVISION').map(r=>r.id),actions:v2.academic.remediation.actions.length,groupedRoots:v2.academic.remediation.actions.filter(a=>a.confirmation).length,academicDeductions:v2.hybrid.deductions},note:'Both engines consume the same scripted answer data. Canonical synthetic PO basis and explicitly mock value definitions allow a complete-scope software test; neither is a faculty judgment.'});
  }
  const oldFile='docs/lcup-policy-v2/shadow-comparison.json',oldBytes=fs.readFileSync(path.join(root,oldFile)),previous=JSON.parse(oldBytes);inputs.push({file:oldFile,sha256:sha(oldBytes)});
  if(JSON.stringify(results.map(r=>r.id).sort())!==JSON.stringify(previous.results.map(r=>r.id).sort()))throw Error('Comparison scenarios differ from the existing shadow cases');
  return {version:POLICY.id,paidAiCalls:0,databaseWrites:0,networkAttempts:attempts,inputs,results};
 }finally{globalThis.fetch=network;resetProviderBlock();}
}
module.exports={compare};
if(require.main===module)compare().then(result=>{
 fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(result,null,2)+'\n');
 const rows=result.results.map(r=>`| ${r.id} | ${r.legacy.base??'—'} | ${r.legacy.candidate??'—'} | ${r.v2.compliance} | ${r.v2.academic} |`);
 fs.writeFileSync(path.join(out,'comparison.md'),`# Actual legacy/V2 policy comparison\n\nOffline mocked responses only; no academic-accuracy claim. Existing historical comparison is unchanged. V2 has no academic points, official grade or submission authority. Synthetic cases use a consistent nine-PO reference and explicitly mock value definitions; verified-source cases retain their frozen masters.\n\n| Existing shadow case | Legacy deterministic base | Legacy provisional candidate | V2 compliance | V2 academic disposition |\n|---|---:|---:|---:|---|\n${rows.join('\n')}\n\nA candidate is provisional, not an official grade. In the off-course case legacy flags leave sixty required weekly links outside its scoring authority; V2 independently retains them and requires revision. Provider-unavailable results remain not evaluated. Optional direct ILO–Assessment changes legacy deductions but cannot independently change V2 disposition. All judgments and shared roots in controlled cases are scripted hypotheses, not faculty confirmations.\n\nThe three verified-source rows have no semantic judgments: their required weekly disposition is NOT_EVALUATED. Their overall REQUIRES_REVISION comes from existing objective identity/reference, classification-label, schedule and APA-text criteria where applicable, not a Claude judgment or a new faculty assessment. The JSON lists those criteria and frozen-reference conflicts separately; source approval does not authorize silent source corrections.\n`);
 console.log(JSON.stringify({cases:result.results.length,networkAttempts:result.networkAttempts,rows:result.results.map(r=>({id:r.id,legacyCandidate:r.legacy.candidate,compliance:r.v2.compliance,academic:r.v2.academic}))},null,2));
}).catch(error=>{console.error(error);process.exitCode=1;});
