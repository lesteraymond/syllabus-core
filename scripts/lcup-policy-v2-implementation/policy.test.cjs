'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const {fixture,replay,POLICY}=require('./fixtures.cjs');
const {run,coded}=require('../../server/lib/syllabuscheck/engine');
const v2=require('../../server/lib/syllabuscheck/academicPolicyV2');
const {POLICY:legacyPolicy}=require('../../server/lib/syllabuscheck/policy');
const {stageFlags}=require('../../server/lib/syllabuscheck/stages');
const {systemPromptOf,PROMPT}=require('../../server/lib/syllabuscheck/gemini');
const {promptFor}=require('../../server/lib/syllabuscheck/variants');
const service=require('../../server/lib/compliance/service'),repo=require('../../server/lib/syllabuscheck/repository');
const realFetch=globalThis.fetch;let attempted=0;
globalThis.fetch=async()=>{attempted++;throw Error('Network prohibited during V2 offline tests');};
test.after(()=>{globalThis.fetch=realFetch;assert.equal(attempted,0);});
const S='SUPPORTED_BY_SUPPLIED_EVIDENCE',R='REQUIRES_REVISION',F='FACULTY_REVIEW',N='NOT_EVALUATED',P='PARTIALLY_EVALUATED';
const ids={'Content-course':'row2-content','Content-ILO':'row2-ilo0-contentilo','ILO-CLO':'row2-ilo0-clo:c3','Content-activity':'row2-contentactivity','ILO-activity':'row2-ilo0-activity','Content-assessment':'row2-contentassessment','Activity-assessment':'row2-activityassessment'};
const exec=async(f,decide,extra={})=>run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:replay(f.content,f.masters,decide,extra)});
const criterion=(r,id)=>r.academic.requirements.find(c=>c.id===id);
const relation=(r,id)=>r.academic.relationships.find(c=>c.id===id);
function fail(p){return {label:'NOT_ALIGNED',recommendation:p.type==='ILO-CLO'?'RETAG_OUTCOME':undefined,draft:p.type==='ILO-CLO'?'':'Review the stated mismatch against the supplied source with faculty.'};}
test('V2 is an actual replacement branch: 47-rule compliance remains 100 and academic output has no grade/deductions',async()=>{
 const f=fixture(),original=structuredClone(f),result=await exec(f);
 assert.equal(result.compliance.ruleCount,47);assert.equal(result.compliance.score,coded(f.content,f.masters).base.overall);assert.equal(result.compliance.score,100);assert.equal(result.compliance.passThreshold,79);
 assert.equal(result.academic.disposition,S);assert.equal(result.score,null);assert.equal(result.overall,null);assert.equal(result.passed,false);assert.equal(result.hybrid.ready,false);assert.deepEqual(result.hybrid.deductions,[]);
 assert.equal(result.academic.score,undefined);assert.equal(result.academic.percent,undefined);assert.equal(result.academic.passThreshold,undefined);assert.equal(result.hybrid.scoring,undefined);assert.equal(result.evaluationPolicy.active,false);assert.deepEqual(f,original);
});
test('V2 CLO relevance and classification use title/context without description evidence; description checks remain intact',async()=>{
 const f=fixture(),marker='Description-only evidence must not enter CLO judgments.';f.content.description=[{id:'d-only',t:marker}];
 const context=v2.plan(f.content,f.masters),coursePairs=context.pairs.filter(p=>['Course-CLO','CLO-set','CLO-classification'].includes(p.type));
 assert.ok(coursePairs.some(p=>p.type==='Course-CLO'));assert.ok(coursePairs.some(p=>p.type==='CLO-set'));assert.ok(coursePairs.some(p=>p.type==='CLO-classification'));
 for(const pair of coursePairs){assert.ok(pair.source.includes('Computer Programming 2'),pair.type);assert.ok(!pair.source.includes(marker),pair.type);}
 assert.ok(context.pairs.some(p=>p.type==='CLO-PO'));assert.ok(context.pairs.some(p=>p.type==='CLO-EGA'));assert.ok(context.pairs.some(p=>p.type==='ILO-CLO'));
 assert.ok(context.pairs.find(p=>p.type==='Title-description').target.includes(marker));assert.ok(context.pairs.find(p=>p.type==='Description-plan').target.includes(marker));
 assert.match(require('../../server/lib/syllabuscheck/academicV2Plan').V2_PROMPT,/Ignore the course description for all CLO-related judgments/);
 const result=await exec(f,p=>p.id==='clo0-course'?{label:'NOT_ALIGNED',draft:'Review this CLO against the course title.'}:{});
 const checked=relation(result,'clo0-course');assert.equal(criterion(result,'course.CLORelevance').status,R);assert.equal(checked.status,R);assert.ok(!checked.sourceText.includes(marker));assert.equal(checked.recommendedCorrection,'Review this CLO against the course title.');
 assert.ok(result.academic.remediation.actions.some(action=>action.relationshipIds.includes('clo0-course')));
 assert.equal(criterion(result,'course.CLOClassificationMeaning').status,S);assert.equal(result.compliance.ruleCount,47);assert.deepEqual(result.hybrid.deductions,[]);
});
for(const [type,id] of Object.entries(ids))test(`required ${type} fails independently without lowering compliance or being cancelled by other links`,async()=>{
 const result=await exec(fixture(),p=>p.id===id?fail(p):{});
 assert.equal(result.compliance.score,100);assert.equal(result.academic.disposition,R);
 assert.equal(relation(result,id).academicJudgment,'NOT_ALIGNED');assert.equal(relation(result,id).status,R);
 for(const [other,otherId] of Object.entries(ids))if(other!==type)assert.equal(relation(result,otherId).status,S,other);
 assert.deepEqual(result.hybrid.deductions,[]);
});
test('complete Computer Programming syllabus with anatomy content cannot receive academic support',async()=>{
 const f=fixture();Object.assign(f.content.plan[2],{contents:'Computer Programming: Human Anatomy',activities:'Computer Programming: identify human organs',tasks:'Computer Programming: human anatomy examination'});f.content.plan[2].ilos[0].text='Explain the digestive system';
 const result=await exec(f,p=>p.id==='row2-content'?fail(p):{});
 assert.equal(result.compliance.score,100);assert.equal(criterion(result,'course.identity').status,S);assert.equal(result.academic.disposition,R);assert.ok(relation(result,'row2-content').targetText.includes('Human Anatomy'));
 assert.ok(relation(result,'row2-content').evidence.sourceQuote);assert.ok(relation(result,'row2-content').evidence.targetQuote);assert.equal(relation(result,'row2-content').provenance.liveModelCall,false);
});
test('all seven failures remain independent evidence with source, target, judgment, explanation, correction and provenance',async()=>{
 const result=await exec(fixture(),p=>Object.values(ids).includes(p.id)?fail(p):{});
 for(const id of Object.values(ids)){const r=relation(result,id);assert.equal(r.status,R);for(const key of ['sourceText','targetText','academicJudgment','explanation','contextHash'])assert.ok(r[key],id+key);assert.ok(r.evidence.sourceQuote&&r.evidence.targetQuote);assert.ok(r.recommendedCorrection||r.recommendationType==='RETAG_OUTCOME');assert.equal(r.provenance.policyVersion,POLICY.id);assert.equal(r.provenance.facultyValidated,false);}
 assert.equal(result.academic.disposition,R);assert.equal(result.compliance.score,100);
});
test('four valid labels do not establish semantic classification correctness',async()=>{
 const result=await exec(fixture(),p=>p.id==='clo2-classification'?{label:'NOT_ALIGNED',draft:'Review whether this statement demonstrates the assigned competence.'}:{});
 assert.equal(criterion(result,'course.classificationLabels').status,S);assert.equal(criterion(result,'course.CLOClassificationMeaning').status,R);assert.equal(result.academic.disposition,R);assert.equal(result.compliance.score,100);
});
test('missing/invalid classification labels and fewer than four CLOs remain distinct from semantic judgment',async()=>{
 const f=fixture();f.content.clos[1].level='Introductory';f.content.clos.pop();const result=await exec(f);
 assert.equal(criterion(result,'course.fourCLOs').status,R);assert.equal(criterion(result,'course.classificationLabels').status,R);assert.equal(result.academic.disposition,R);
});
test('unsupported and ambiguous CLO mappings are retained without invented tags',async()=>{
 const f=fixture();f.content.plan[2].ilos[0].tags=['clo:c1','clo:c3'];const before=structuredClone(f.content);
 const result=await exec(f,p=>p.id==='row2-ilo0-clo:c3'?fail(p):{});
 assert.equal(criterion(result,'weekly:2:ILO-CLO').status,F);assert.equal(result.academic.disposition,F);assert.deepEqual(f.content,before);
 const missing=fixture();missing.content.plan[2].ilos[0].tags=[];const absent=await exec(missing);const r=relation(absent,'row2-ilo0-unassigned-clo');assert.equal(r.status,N);assert.equal(r.sourceText,'');assert.equal(absent.academic.disposition,F,'Missing mapping also needs a faculty decision under the existing required-field finding');assert.deepEqual(missing.content.plan[2].ilos[0].tags,[]);
});
test('missing course content and ILO text are explicit missing evidence, not passes or invented questions',async()=>{
 const f=fixture();f.content.plan[2].contents='';f.content.plan[2].ilos=[];
 const result=await exec(f);assert.equal(relation(result,'row2-content').status,N);assert.equal(relation(result,'row2-ilo0-contentilo').status,N);assert.ok(result.academic.requirements.filter(c=>c.id.startsWith('weekly:2:')).some(c=>c.status===N));assert.notEqual(result.academic.disposition,S);
});
test('grouped weeks are shared rows; Week 1 timing remains a faculty question; exams create no seven-link obligations',async()=>{
 const f=fixture();f.content.plan[0].week='1-2';f.content.plan.splice(1,1);const result=await exec(f);
 assert.equal(criterion(result,'week1.introduction').status,F);assert.ok(criterion(result,'week1.introduction').reviewRequirements.includes('confirm_week1_timing_within_group'));
 for(const [i,row] of f.content.plan.entries())if(row.kind==='exam')assert.ok(!result.academic.requirements.some(c=>c.id.startsWith(`weekly:${i}:`)));
 assert.equal(criterion(result,'schedule.weeks1to18').status,S);
});
test('an orientation is evaluated against its stated course/ILO evidence, without imposing practical activity',async()=>{
 const f=fixture();f.content.plan[0].ilos[0].text='Describe the course subject and objectives.';f.content.plan[0].activities='Discuss objectives, grading and policies.';
 const result=await exec(f);assert.equal(criterion(result,'week1.introduction').status,S);assert.equal(relation(result,'row0-activityfit').status,S);
 const noIntro=await exec(f,p=>p.type==='Week1-introduction'?fail(p):{});assert.equal(criterion(noIntro,'week1.introduction').status,R);
});
for(const kind of ['unavailable','partial','invalid','duplicate','badQuote'])test(`${kind} Claude evidence never becomes academic support`,async()=>{
 const f=fixture(),data=replay(f.content,f.masters);
 if(kind==='unavailable'){data.availability='unavailable';data.judgements=[];}
 if(kind==='partial')Object.assign(data.judgements.find(j=>j.id==='row2-contentactivity'),{label:'PARTIALLY_ALIGNED',recommendation:'REVIEW_REQUIRED',draft:'Review the partial support in this learning activity.'});
 if(kind==='invalid')data.judgements.find(j=>j.id==='row2-contentactivity').label='PERFECT';
 if(kind==='duplicate')data.judgements.push(data.judgements.find(j=>j.id==='row2-contentactivity'));
 if(kind==='badQuote')data.judgements.find(j=>j.id==='row2-contentactivity').targetQuote='INVENTED EVIDENCE';
 const result=await run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:data});assert.notEqual(result.academic.disposition,S);assert.equal(result.compliance.score,100);
 if(kind==='unavailable'){assert.equal(result.academic.disposition,N);assert.equal(result.academic.provenance.adapterRequests,0);}else assert.equal(relation(result,'row2-contentactivity').status,kind==='partial'?F:N);
});
test('diverse-learner support is required, and unassessed aspects cannot become a pass',async()=>{
 const f=fixture(),r=await exec(f,p=>p.id==='row2-activityfit'?{label:'PARTIALLY_ALIGNED',teaching:'sound',learnerSupport:'limited',recommendation:'REWRITE_TEXT',draft:'Offer annotated examples and guided practice for the stated method.'}:{});
 assert.equal(criterion(r,'weekly:2:diverseLearners').status,F);assert.equal(r.academic.disposition,F);
 const unassessed=await exec(f,p=>p.id==='row2-activityfit'?{learnerSupport:'not_assessed'}:{});assert.equal(criterion(unassessed,'weekly:2:diverseLearners').status,N);assert.notEqual(unassessed.academic.disposition,S);
});
test('a named value alone is not semantic proof; unapproved definitions cause review, not faculty blame',async()=>{
 const f=fixture();f.content.plan[2].values='Courage';
 const r=await exec(f,p=>p.id==='row2-value'?fail(p):{});assert.equal(criterion(r,'weekly:2:values').status,R);
 const missing=fixture();missing.masters.valueDefinitions.status='pending_approval';const review=await exec(missing);assert.equal(criterion(review,'weekly:2:values').status,F);assert.ok(criterion(review,'weekly:2:values').reviewRequirements.includes('value_definition_approval_review'));
});
test('APA text checks are reused and visual/authenticity limitations are explicit',async()=>{
 const f=fixture();f.content.refs.books.items[0].t='Doe, J. (2025). A title.';const result=await exec(f);
 assert.ok(result.academic.requirements.some(r=>r.id.includes('APA7text')&&r.status!==S));assert.ok(result.academic.limitations.some(s=>s.includes('APA visual')));
});
for(const program of ['BSIT','BSIT-CYBERSECURITY','BSIE','BSCPE'])test(`${program} resolves the required approved PO basis and separate curriculum in V2`,async()=>{
 const f=fixture(program),r=await exec(f);assert.equal(r.academic.disposition,S);assert.equal(r.academic.references.poUsable,true);assert.equal(f.masters.pos.length,program.startsWith('BSIT')?9:13);
 if(program==='BSIT-CYBERSECURITY'){assert.equal(r.academic.references.poSource,'BSIT');assert.equal(f.masters.curricula[0].program,program);assert.equal(f.content.meta.curriculumYear,'2025-2026');}
});
test('conflicting or absent official references cause faculty/reference review without remapping or deductions',async()=>{
 const f=fixture();f.masters.pos.push({no:10,text:'Old reference meaning'});f.content.outcomes.pos=structuredClone(f.masters.pos);const before=structuredClone(f);
 const result=await exec(f);assert.equal(result.academic.references.poUsable,false);assert.equal(criterion(result,'course.clo0.PO').status,F);assert.equal(result.academic.disposition,F);assert.deepEqual(f,before);assert.deepEqual(result.hybrid.deductions,[]);
 const child=fixture('BSIT-CYBERSECURITY');child.masters.outcomeSource=null;const absent=await exec(child);assert.ok(absent.academic.references.issues.some(i=>i.code==='inheritance_unverified'));assert.notEqual(absent.academic.disposition,S);
});
test('optional ILO–Assessment never changes V2 disposition and retains C2 eligibility behavior',async()=>{
 const f=fixture(),baseline=await exec(f),result=await exec(f,p=>p.id==='row2-ilo0-assessment'?fail(p):{});
 assert.equal(result.academic.disposition,baseline.academic.disposition);assert.equal(result.compliance.score,baseline.compliance.score);assert.equal(result.academic.diagnostics.iloAssessment.find(r=>r.id==='row2-ilo0-assessment').status,R);assert.equal(result.academic.diagnostics.affectsDisposition,false);
 assert.ok(baseline.academic.diagnostics.c2Eligibility.asked.includes(2));assert.ok(!result.academic.diagnostics.c2Eligibility.asked.includes(2));assert.deepEqual(result.hybrid.deductions,[]);
});
test('confirmed shared roots group one correction but retain every independent relationship',async()=>{
 const f=fixture(),target=['row2-content','row2-ilo0-contentilo','row2-contentactivity','row2-contentassessment'];
 const data=replay(f.content,f.masters,p=>target.includes(p.id)?fail(p):{});
 const root={id:'content-root',relationshipIds:target,correction:'Review and correct the course-content topic first.',confirmation:{reviewer:'Mock reviewer',receiptId:'offline-root-1',basis:'Controlled shared-cause case, not a real faculty judgment.',inputHash:data.inputHash,referenceHash:data.referenceHash,provenance:'offline-mock'}};data.confirmedRoots=[root];
 const result=await run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:data});
 assert.ok(target.every(id=>relation(result,id).status===R));assert.equal(result.academic.remediation.actions.filter(a=>a.relationshipIds.some(id=>target.includes(id))).length,1);assert.equal(result.academic.remediation.actions.find(a=>a.id==='content-root').relationshipIds.length,4);
 assert.equal(result.academic.remediation.actions[0].canAutoApply,false);
});
test('same-field independent errors do not merge; unconfirmed/stale root receipts are refused',async()=>{
 const f=fixture(),ids2=['row2-contentassessment','row2-activityassessment'];
 const data=replay(f.content,f.masters,p=>ids2.includes(p.id)?fail(p):{},{confirmedRoots:[{id:'unconfirmed',relationshipIds:ids2,correction:'Guess one correction'}]});
 const result=await run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:data});assert.equal(result.academic.remediation.actions.filter(a=>a.relationshipIds.some(id=>ids2.includes(id))).length,2);assert.equal(result.academic.remediation.rootReviews.length,1);
});
test('no paid transport/config, stale replay or old policy can activate the preview',async()=>{
 const f=fixture(),data=replay(f.content,f.masters);let called=false;
 for(const option of [{transport:async()=>{called=true;}},{env:{ANTHROPIC_API_KEY:'real-looking'}},{useAi:true}])await assert.rejects(()=>run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:data,...option}),e=>e.code==='academic_v2_offline_only');
 await assert.rejects(()=>run(f.content,f.masters,{academicPolicy:POLICY.id}),e=>e.code==='academic_v2_offline_replay_required');
 await assert.rejects(()=>run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:{...data,inputHash:'stale'}}),e=>e.code==='academic_v2_offline_replay_required');assert.equal(called,false);
});
test('legacy mode retains deductions, original policy, stage flags and prompt; no V2 profile is appended',async()=>{
 const f=fixture();const transport=async(url,req)=>{const pairs=JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({judgements:pairs.map(p=>({id:p.id,label:p.id==='row2-ilo0-assessment'?'NOT_ALIGNED':'ALIGNED',explanation:'Scripted legacy test.',sourceQuote:p.source.slice(0,18),targetQuote:p.target.slice(0,18),sourceBloom:'N/A',targetBloom:'N/A',draft:p.id==='row2-ilo0-assessment'?'Revise this task for the stated performance.':''}))})}]}}]})};};
 const options={useAi:true,env:{SYLLABUS_CHECK_AI_PROVIDER:'gemini',GEMINI_API_KEY:'fake'},transport};
 const implicit=await run(f.content,f.masters,options),explicit=await run(f.content,f.masters,{...options,academicPolicy:'legacy'});
 delete implicit.hybrid.checkedAt;delete explicit.hybrid.checkedAt;assert.deepEqual(explicit,implicit);assert.equal(implicit.academic,undefined);assert.equal(implicit.hybrid.scoring.official.policy,legacyPolicy.version);assert.ok(implicit.hybrid.deductions.some(d=>d.id==='SEM:row2-ilo0-assessment'&&d.points===3));assert.ok(Object.values(stageFlags({})).every(v=>v===false));
 assert.equal(systemPromptOf('current',{},[]),promptFor(PROMPT,'current',stageFlags({})));
});
test('preview cannot be persisted as an official run/report and historical JSON is not reinterpreted',async()=>{
 const f=fixture(),result=await exec(f);let writes=0;const db={query:async()=>{writes++;throw Error('No write permitted');}};
 await assert.rejects(()=>service.storeRun(db,{syllabusId:1,content:f.content,result}),e=>e.body?.code==='academic_preview_not_official');await assert.rejects(()=>repo.saveReport(db,1,result,'x'),e=>e.body?.code==='academic_preview_not_official');assert.equal(writes,0);
 const reopened=await repo.readReport({query:async()=>[[{reference_hash:'x',report_json:JSON.stringify(result)}]]},1);assert.equal(reopened.evaluationPolicy.id,POLICY.id);assert.deepEqual(reopened.academic,result.academic);
 const historical=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/sample-misaligned-report.json'))),old=JSON.stringify(historical);const read=await repo.readReport({query:async()=>[[{reference_hash:'old',report_json:old}]]},2);assert.equal(read.score,historical.score);assert.equal(read.academic,undefined);assert.equal(JSON.stringify(historical),old);
});
test('47 rules, mark 79, coded checks and the existing submission gate implementation remain identical',()=>{
 const standard=require('../../server/lib/compliance/standard-v4.json');assert.equal(standard.rules.length,47);assert.equal(standard.passThreshold,79);assert.ok(!legacyPolicy.advisoryTypes.includes('ILO-assessment'));
 const h=f=>crypto.createHash('sha256').update(String(f)).digest('hex');const before=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/lcup-policy-v2-implementation/gate-functions-before.json')));assert.equal(h(coded),before.coded);assert.equal(h(service.requireHybrid),before.requireHybrid);
});
