'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {sample}=require('../../server/lib/syllabuscheck/fixtures');
const {run}=require('../../server/lib/syllabuscheck/engine');
const {buildVerdict}=require('../../server/lib/syllabuscheck/verdict');
const {stageFlags,trimToTypes}=require('../../server/lib/syllabuscheck/stages');
const {promptFor}=require('../../server/lib/syllabuscheck/variants');
const {PROMPT,isAdvisory,isNoRewrite,promptVersionOf,resetProviderBlock,validate}=require('../../server/lib/syllabuscheck/gemini');
const {tierOfType}=require('../../server/lib/syllabuscheck/acceptance');
const advice=require('../../server/lib/syllabuscheck/requirementsAdvice');
const realFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw Error('Network prohibited in requirements tests');};
test.after(()=>{globalThis.fetch=realFetch;});test.afterEach(()=>resetProviderBlock());
const AI={SYLLABUS_CHECK_AI_PROVIDER:'gemini',GEMINI_API_KEY:'test-only'};
const CHAIN={...AI,SYLLABUS_CHECK_STAGE_B:'on',SYLLABUS_CHECK_STAGE_C3:'on'};
const ON={...CHAIN,SYLLABUS_CHECK_REQUIREMENTS_ADVICE:'on'};
const ids={'Content-course':'row2-content','Content-ILO':'row2-ilo0-contentilo','ILO-CLO':'row2-ilo0-clo:c3','Content-activity':'row2-contentactivity','ILO-activity':'row2-ilo0-activity','Content-assessment':'row2-contentassessment','Activity-assessment':'row2-activityassessment'};
const all=(report,content)=>buildVerdict(report,content,{all:true}).all;
const deductions=report=>report.hybrid.deductions.filter(d=>d.kind==='alignment').map(d=>[d.id,d.points]);
function model(decide=()=>null,{anthropic=false,outage=false}={}){
 const asked=[],systems=[];
 const transport=async(url,req)=>{
  const body=JSON.parse(req.body),pairs=JSON.parse(anthropic?body.messages[0].content:body.contents[0].parts[0].text).document_data;
  asked.push(...pairs);systems.push(anthropic?body.system[0].text:body.systemInstruction.parts[0].text);
  if(typeof outage==='function'?outage(pairs):outage)return {ok:false,status:503,json:async()=>({})};
  const judgements=pairs.map(p=>{const decision=decide(p)||{},label=decision.label||'ALIGNED';return {id:p.id,label,explanation:decision.explanation||'The supplied relationship is supported.',sourceQuote:p.source.slice(0,18),targetQuote:p.target.slice(0,18),sourceBloom:'N/A',targetBloom:'N/A',draft:label==='ALIGNED'?'':decision.draft??(isNoRewrite(p.type)?'Review the stated mismatch with faculty.':`${p.target} Revised for the stated competence.`)};});
  const text=JSON.stringify({judgements});
  return anthropic?new Response(JSON.stringify({id:'msg_offline',type:'message',role:'assistant',model:'claude-sonnet-4-6',content:[{type:'text',text}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}),{status:200,headers:{'content-type':'application/json'}}):{ok:true,json:async()=>({candidates:[{content:{parts:[{text}]}}]})};
 };
 return {asked,systems,transport};
}
async function execute(content,masters,decide,env=ON,options={}){
 const m=model(decide,options);const result=await run(content,masters,{useAi:true,env,transport:m.transport,linkChecker:async url=>({url,status:'ok',httpStatus:200})});return {result,...m};
}
test('new advice is opt-in, no-rewrite, zero-point, trimmed and versioned; previous all-off prompt is unchanged',()=>{
 assert.equal(stageFlags({}).requirements,undefined);
 assert.equal(stageFlags({SYLLABUS_CHECK_REQUIREMENTS_ADVICE:'on'}).requirements,true);
 const off=promptFor(PROMPT,'current',stageFlags({}));
 assert.equal(crypto.createHash('sha256').update(off).digest('hex'),'81d11a069d91ee47c7171bd941f05867d73e6423eebf1ea9d8fa6c06f49d7262');
 const on=promptFor(PROMPT,'current',stageFlags(ON));
 assert.ok(!off.includes(advice.TESTS));assert.ok(on.includes(advice.TESTS));
 for(const type of advice.TYPES){assert.ok(isAdvisory(type));assert.ok(isNoRewrite(type));assert.equal(tierOfType(type),'optional');assert.ok(!trimToTypes(on,new Set(['ILO-CLO'])).includes(type));}
 assert.notEqual(promptVersionOf('gemini-3.8-flash',ON),promptVersionOf('gemini-3.8-flash',CHAIN));
});
test('a new semantic mismatch without a recommendation is refused instead of treated as complete advice',()=>{
 const {content}=sample(),pair=advice.pairsOf(content)[0];
 const raw={judgements:[{id:pair.id,label:'NOT_ALIGNED',explanation:'The description teaches a different subject.',sourceQuote:pair.source.slice(0,15),targetQuote:pair.target.slice(0,15),sourceBloom:'N/A',targetBloom:'N/A',draft:''}]};
 assert.throws(()=>validate(raw,[pair]),e=>e.codes?.includes('missing_draft'));
});
for(const [type,id] of Object.entries(ids))test(`independent ${type} failure is retained while the other six pass`,async()=>{
 const {content,masters}=sample();
 const {result,asked}=await execute(content,masters,p=>p.id===id?{label:'NOT_ALIGNED',explanation:`${type} has a different subject despite populated cells.`}:null,CHAIN);
 const byId=new Map(result.hybrid.alignment.judgements.map(j=>[j.id,j]));
 for(const [other,otherId] of Object.entries(ids)){assert.ok(asked.some(p=>p.id===otherId),other);assert.equal(byId.get(otherId)?.label,other===type?'NOT_ALIGNED':'ALIGNED',other);}
 assert.ok(all(result,content).some(f=>f.relationshipId===id&&['FAIL','NEEDS_REVIEW'].includes(f.status)));
 assert.deepEqual(deductions(result),['ILO-CLO','ILO-activity'].includes(type)?[['SEM:'+id,3]]:[]);
});
test('all populated but unrelated subjects: the complete seven-link chain reports every independent failure',async()=>{
 const {content,masters}=sample();
 Object.assign(content.plan[2],{contents:'Geography of island climates',activities:'Bake and decorate a pastry',tasks:'Calculate stellar orbital periods'});
 content.plan[2].ilos[0].text='Perform a violin concerto';
 const snapshot=structuredClone(content),targets=new Set(Object.values(ids));
 const {result}=await execute(content,masters,p=>targets.has(p.id)?{label:'NOT_ALIGNED',explanation:'The two supplied subjects differ; populated fields do not establish academic alignment.'}:null,CHAIN);
 for(const id of targets){assert.equal(result.hybrid.alignment.judgements.find(j=>j.id===id)?.label,'NOT_ALIGNED');assert.ok(all(result,content).some(f=>f.relationshipId===id&&['FAIL','NEEDS_REVIEW'].includes(f.status)),id);}
 assert.deepEqual(content,snapshot,'No faculty text or mappings changed');
});
test('title/description and Week 1 advice add no deductions, readiness change, replacement text or new ILO–Assessment relationship',async()=>{
 const {content,masters}=sample();content.description=[{id:'d',t:'This course teaches marine navigation and sailing.'}];
 content.plan[0].contents='Grading policies only';
 const decide=p=>advice.TYPES.includes(p.type)?{label:'NOT_ALIGNED',explanation:'The description is about sailing and the introduction omits this course subject and objectives.',draft:'Introduce the selected course subject and its stated objectives in Week 1.'}:null;
 const on=await execute(content,masters,decide),off=await execute(content,masters,decide,CHAIN);
 assert.equal(on.systems[0],off.systems[0],'New advisory wording does not enter the scored request');
 assert.ok(!on.systems[0].includes(advice.TESTS));assert.ok(on.systems.some(system=>system.includes(advice.TESTS)));
 assert.deepEqual(deductions(on.result),deductions(off.result));assert.equal(on.result.hybrid.ready,off.result.hybrid.ready);assert.equal(on.result.hybrid.score,off.result.hybrid.score);
 for(const type of advice.TYPES){const finding=all(on.result,content).find(f=>f.legacyRuleId===type);assert.equal(finding.status,'FAIL');assert.equal(finding.recommendationType,'REVIEW_REQUIRED');assert.ok(finding.recommendation);assert.equal(finding.severity,'MINOR');assert.ok(on.result.hybrid.policy.advisoryTypes.includes(type));}
 assert.ok(!on.result.hybrid.suggestions.some(s=>s.id.includes('requirements-')||s.id.includes('week1introduction')));
 assert.equal(on.asked.filter(p=>p.type==='ILO-assessment').length,off.asked.filter(p=>p.type==='ILO-assessment').length);
 assert.ok(!off.asked.some(p=>advice.TYPES.includes(p.type)));
});
test('missing Week 1, missing title/description/objectives and empty sides are never passed or sent as invented text',async()=>{
 const {content,masters}=sample();content.plan=content.plan.filter(r=>String(r.week)!=='1');content.description=[];
 const {result,asked}=await execute(content,masters);
 assert.ok(!asked.some(p=>advice.TYPES.includes(p.type)));
 const found=result.hybrid.alignment.judgements.filter(j=>advice.TYPES.includes(j.type));
 assert.equal(found.length,2);assert.ok(found.every(j=>j.label==='INSUFFICIENT_EVIDENCE'&&j.failureKind==='insufficient_text'));
 assert.ok(all(result,content).filter(f=>advice.TYPES.includes(f.legacyRuleId)).every(f=>f.status!=='PASS'));
 const blank=advice.pairsOf({meta:{},clos:[],plan:[],description:[]});assert.ok(blank.every(p=>!p.source&&!p.target));
});
test('grouped weeks include Week 1 once, examinations stay out of the weekly chain, and missing CLO tags stay unresolved',async()=>{
 const {content,masters}=sample();content.plan[0].week='1-2';content.plan.splice(1,1);content.plan[1].ilos[0].tags=[];
 const snapshot=structuredClone(content),{result,asked}=await execute(content,masters);
 assert.equal(asked.filter(p=>p.type==='Week1-introduction').length,1);
 assert.ok(asked.find(p=>p.type==='Week1-introduction').target.includes(content.plan[0].ilos[0].text),'Week 1 ILO evidence is preserved as well as content and activities');
 const intro=all(result,content).find(f=>f.legacyRuleId==='Week1-introduction');assert.equal(intro.status,'NEEDS_REVIEW');assert.match(intro.recommendation,/Confirm.*Week 1/);
 for(const [i,row] of content.plan.entries())if(row.kind==='exam')assert.ok(!asked.some(p=>p.id.startsWith(`row${i}-`)&&['Content-course','Content-activity','Content-assessment','Activity-assessment'].includes(p.type)));
 assert.ok(!asked.some(p=>p.id==='row1-ilo0-clo:c3'));assert.ok(result.findings.some(f=>['T-13','ILO-MAP'].includes(f.ruleId)));
 assert.deepEqual(content,snapshot);assert.match(advice.TESTS,/do not invent how its contents are divided/);
});
test('Week 1 marked as examination does not satisfy the introduction automatically',async()=>{
 const {content,masters}=sample();content.plan[0].kind='exam';content.plan[0].contents='MIDTERM EXAMINATION';content.plan[0].activities='Examination';
 const {result}=await execute(content,masters,p=>p.type==='Week1-introduction'?{label:'NOT_ALIGNED',explanation:'An examination alone does not introduce the course and its objectives.'}:null);
 assert.equal(all(result,content).find(f=>f.legacyRuleId==='Week1-introduction').status,'FAIL');
});
test('long fields are not certified from truncated excerpts',async()=>{
 const {content,masters}=sample();content.description=[{id:'long',t:'A'.repeat(6001)}];
 const {result,asked}=await execute(content,masters);assert.ok(!asked.some(p=>p.type==='Title-description'));
 const finding=all(result,content).find(f=>f.legacyRuleId==='Title-description');assert.equal(finding.status,'NOT_CHECKED');assert.match(finding.explanation,/complete text/);
 assert.equal(result.hybrid.alignment.judgements.find(j=>j.type==='Title-description').failureKind,'context_limit');
});
test('ambiguous CLO mappings are retained; one aligned CLO does not rewrite the other mapping',async()=>{
 const {content,masters}=sample();content.plan[2].ilos[0].tags=['clo:c1','clo:c3'];const snapshot=structuredClone(content);
 const {result}=await execute(content,masters,p=>p.id==='row2-ilo0-clo:c3'?{label:'NOT_ALIGNED',explanation:'This CLO tag concerns a different competence.'}:null,CHAIN);
 assert.deepEqual(content,snapshot);assert.ok(!deductions(result).some(([id])=>id==='SEM:row2-ilo0-clo:c3'));
 assert.ok(result.findings.some(f=>f.id==='TAG:row2-ilo0-clo:c3'));
});
test('existing scored ILO–Assessment check is preserved and reports its separate three-point impact',async()=>{
 const {content,masters}=sample();const decide=p=>p.id==='row2-ilo0-assessment'?{label:'NOT_ALIGNED'}:null;
 const on=await execute(content,masters,decide),off=await execute(content,masters,decide,CHAIN);
 assert.deepEqual(deductions(on.result),[['SEM:row2-ilo0-assessment',3]]);assert.deepEqual(deductions(on.result),deductions(off.result));
});
test('all four CLO classifications and the four-CLO count are advisory; repeated valid labels do not satisfy coverage',async()=>{
 const {content,masters}=sample();content.clos.forEach(c=>c.level='Enabling');const snapshot=structuredClone(content);
 const result=await run(content,masters,{useAi:false,env:{},linkChecker:async url=>({url,status:'ok'})});
 const finding=all(result,content).find(f=>f.legacyRuleId==='clo-classification-coverage');assert.equal(finding.status,'FAIL');assert.match(finding.explanation,/Introductory, Demonstrating, Integration of Values/);
 assert.deepEqual(content,snapshot);assert.ok(!result.findings.some(f=>f.ruleId==='CLO-08'));
 for(const [i,c] of content.clos.entries())c.level=['Introductory','Enabling','Demonstrating','Integration of Values'][i];
 assert.equal(all(result,content).find(f=>f.legacyRuleId==='clo-classification-coverage').status,'PASS');
 content.clos.pop();assert.equal(all(result,content).find(f=>f.ruleId==='CLO-01').status,'FAIL');
});
test('provider unavailable or unapproved: no invented alignment passes or extra paid requests',async()=>{
 for(const env of [{SYLLABUS_CHECK_AI_PROVIDER:'off',SYLLABUS_CHECK_REQUIREMENTS_ADVICE:'on'},{SYLLABUS_CHECK_AI_PROVIDER:'anthropic',ANTHROPIC_MODEL:'claude-sonnet-4-6',ANTHROPIC_API_KEY:'sk-ant-test-only-not-a-real-key',SYLLABUS_CHECK_REQUIREMENTS_ADVICE:'on'}]){
  const {content,masters}=sample(),{result,asked}=await execute(content,masters,null,env);assert.equal(asked.length,0);assert.equal(result.hybrid.alignment.status,'not_evaluated');
  const findings=all(result,content).filter(f=>advice.TYPES.includes(f.legacyRuleId));assert.equal(findings.length,2);assert.ok(findings.every(f=>f.status==='NOT_CHECKED'));
 }
 const {content,masters}=sample(),{result,asked}=await execute(content,masters,null,ON,{outage:true});
 assert.ok(asked.length);assert.ok(!asked.some(p=>advice.TYPES.includes(p.type)));assert.ok(all(result,content).filter(f=>advice.TYPES.includes(f.legacyRuleId)).every(f=>f.status==='NOT_CHECKED'));
});
test('an outage only in the new advisory request preserves the completed scored check and C3 results',async()=>{
 const {content,masters}=sample(),baseline=await execute(content,masters,undefined,CHAIN);
 const {result}=await execute(content,masters,undefined,ON,{outage:pairs=>pairs.some(p=>advice.TYPES.includes(p.type))});
 assert.equal(result.hybrid.alignment.status,'completed');assert.equal(result.hybrid.ready,baseline.result.hybrid.ready);assert.equal(result.hybrid.score,baseline.result.hybrid.score);assert.deepEqual(deductions(result),deductions(baseline.result));
 assert.ok(all(result,content).filter(f=>advice.TYPES.includes(f.legacyRuleId)).every(f=>f.status==='NOT_CHECKED'));
 assert.deepEqual(result.hybrid.stageC,baseline.result.hybrid.stageC);
});
test('Claude SDK path carries new advisory pairs, evidence, prompt and findings using a mocked transport only',async()=>{
 const {content,masters}=sample();
 const env={SYLLABUS_CHECK_AI_PROVIDER:'anthropic',ANTHROPIC_MODEL:'claude-sonnet-4-6',ANTHROPIC_API_KEY:'sk-ant-test-only-not-a-real-key',SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL:'claude-sonnet-4-6',SYLLABUS_CHECK_REQUIREMENTS_ADVICE:'on'};
 const {result,asked,systems}=await execute(content,masters,p=>p.type==='Title-description'?{label:'PARTIALLY_ALIGNED',explanation:'The description omits the course subject.',draft:'Explain the selected course subject using the stated course objectives.'}:null,env,{anthropic:true});
 assert.equal(result.hybrid.alignment.provider,'anthropic');assert.ok(asked.some(p=>p.type==='Title-description'));assert.ok(systems.some(p=>p.includes(advice.TESTS)));
 const finding=all(result,content).find(f=>f.legacyRuleId==='Title-description');assert.equal(finding.status,'NEEDS_REVIEW');assert.equal(finding.verification,'quotes_verified');assert.equal(finding.recommendationType,'REVIEW_REQUIRED');assert.deepEqual(deductions(result),[]);
});
