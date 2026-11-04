'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture,replay,POLICY}=require('../lcup-policy-v2-implementation/fixtures.cjs'),{run,coded}=require('../../server/lib/syllabuscheck/engine');
const refs=require('../../server/lib/syllabuscheck/references'),{aggregate}=require('../../server/lib/syllabuscheck/academicPolicyV2');
const rows=[],S='SUPPORTED_BY_SUPPLIED_EVIDENCE',R='REQUIRES_REVISION',F='FACULTY_REVIEW',N='NOT_EVALUATED',P='PARTIALLY_EVALUATED';
const exec=async(f,decide)=>run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:replay(f.content,f.masters,decide)});
const criterion=(r,id)=>r.academic.requirements.find(x=>x.id===id);
for(const n of [0,1,2,3,4,5])test(`exactly-four criterion with ${n} CLOs`,async()=>{const f=fixture();if(n<4)f.content.clos=f.content.clos.slice(0,n);if(n>4)f.content.clos.push({...structuredClone(f.content.clos[0]),id:'fifth'});const r=await exec(f);assert.equal(criterion(r,'course.fourCLOs').status,n===4?S:R);});
test('duplicate statements remain separate from count and are not silently rewritten',async()=>{const f=fixture();f.content.clos[1].statement=f.content.clos[0].statement;const before=JSON.stringify(f.content),r=await exec(f,p=>p.type==='CLO-classification'?{label:'PARTIALLY_ALIGNED'}:{});assert.equal(criterion(r,'course.fourCLOs').status,S);assert.equal(r.academic.disposition,F);assert.equal(JSON.stringify(f.content),before);});
test('four empty statements have count four but cannot receive academic support',async()=>{const f=fixture();f.content.clos.forEach(c=>c.statement='');const r=await exec(f);assert.equal(criterion(r,'course.fourCLOs').status,S);assert.notEqual(r.academic.disposition,S);});
for(const mode of ['missing','repeated','invalid'])test(`classification ${mode} is independent of a supplied positive semantic answer`,async()=>{const f=fixture();f.content.clos[1].level={missing:'',repeated:'Introductory',invalid:'Expert'}[mode];const r=await exec(f);assert.equal(criterion(r,'course.classificationLabels').status,R);assert.notEqual(r.academic.disposition,S);});
for(const type of ['Title-description','Description-plan','Course-CLO','CLO-PO','CLO-EGA','CLO-classification','Activity-fit','Value-use'])test(`${type} independent academic mismatch in a complete syllabus`,async()=>{const f=fixture(),r=await exec(f,p=>p.type===type?{label:'NOT_ALIGNED',...(type==='Activity-fit'?{teaching:'weak',learnerSupport:'limited',responsible:'activity'}:{}),...(type==='Value-use'?{valueUse:'unrelated',valueFit:'clashes',carriedBy:'none',responsible:'values'}:{})}:{});assert.equal(r.academic.disposition,R);assert.equal(r.compliance.score,100);assert.deepEqual(r.hybrid.deductions,[]);});
for(const kind of ['PO','EGA'])test(`out-of-range ${kind} mapping is reported without inventing an outcome`,async()=>{const f=fixture();f.content.clos[0][kind==='PO'?'pos':'egas']=[999];const before=JSON.stringify(f.content),r=await exec(f);assert.notEqual(r.academic.disposition,S);assert.ok(r.findings.some(c=>JSON.stringify(c).includes('999')));assert.equal(JSON.stringify(f.content),before);});
for(const program of ['BSIT','BSIT-CYBERSECURITY','BSIE','BSCPE'])for(const issue of ['wrong-course','missing-PO','missing-EGA','stale-input'])test(`${program} / ${issue}`,async()=>{
 const f=fixture(program);if(issue==='wrong-course')f.content.meta.code='UNLISTED-999';if(issue==='missing-PO')f.masters.pos=[];if(issue==='missing-EGA')f.masters.institution.egas=[];const data=replay(f.content,f.masters);
 if(issue==='stale-input'){f.content.meta.title+=' edited';await assert.rejects(()=>run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:data}),e=>e.code==='academic_v2_offline_replay_required');return;}
 const r=await run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:data});assert.notEqual(r.academic.disposition,S);if(issue==='missing-PO'||issue==='missing-EGA')assert.equal(criterion(r,'course.clo0.'+(issue==='missing-PO'?'PO':'EGA')).status,F);
});
for(const week of ['0','19','5-3','1-99','3-x','1,1'])test(`schedule rejects malformed/out-of-range/overlapping assignment ${week}`,async()=>{const f=fixture();f.content.plan[2].week=week;const r=await exec(f);assert.notEqual(criterion(r,'schedule.weeks1to18').status,S);assert.notEqual(r.academic.disposition,S);});
for(const value of ['', 'Kindness','Courage','Courage: be a good person.'])test(`values ${JSON.stringify(value)} do not prove meaningful integration`,async()=>{const f=fixture();f.content.plan[2].values=value;const r=await exec(f,p=>p.id==='row2-value'?{label:value?'PARTIALLY_ALIGNED':'INSUFFICIENT_EVIDENCE'}:{});assert.notEqual(criterion(r,'weekly:2:values').status,S);assert.notEqual(r.academic.disposition,S);});
test('every approved name is retained; pending definition approval is not upgraded by positive mock judgments',async()=>{const f=fixture();delete f.masters.valueDefinitions;const before=fs.readFileSync(path.resolve(__dirname,'../../server/config/marian-values.json'),'utf8'),r=await exec(f);assert.equal(r.academic.references.valueDefinitions.status,'pending_approval');assert.equal(criterion(r,'weekly:2:values').status,F);assert.equal(fs.readFileSync(path.resolve(__dirname,'../../server/config/marian-values.json'),'utf8'),before);});
const references=[
 ['book','Doe, J. (2025). Java programming. Academic Press.', 'PASS'],
 ['missing-date','Doe, J. Java programming. Academic Press.','FAIL'],
 ['missing-title','Doe, J. (2025).','FAIL'],
 ['unknown-type','Doe, J. (2025). A work with unclassified source.','NEEDS_REVIEW'],
 ['malformed-doi','Doe, J. (2025). A study. Journal of Examples, 2(1), 1–8. https://doi.org/not-a-doi','FAIL'],
 ['doi-format','Doe, J. (2025). A study. Journal of Examples, 2(1), 1–8. doi:10.1234/example','FAIL'],
 ['article','Doe, J. (2025). A study. Journal of Examples, 2(1), 1–8. https://doi.org/10.1234/example','PASS'],
 ['blank','', 'NOT_CHECKED']
];
for(const [id,text,expected] of references)test(`APA ${id}`,()=>{const p=refs.parseReference(text,{year:2026});rows.push({id,text,expected,actual:p.format.status,issues:p.issues,type:p.type,authenticity:p.authenticity});assert.equal(p.format.status,expected);assert.equal(p.authenticity.status,'not_verified');});
test('disposition precedence is revision > faculty review > partial > not evaluated > supported',()=>{
 for(const [states,expected] of [[[S],S],[[N],N],[[S,N],P],[[S,P],P],[[N,F],F],[[F,R,N],R],[[],N]])assert.equal(aggregate(states.map(status=>({status}))),expected);
});
test('provider unavailable plus an independently established four-CLO failure retains revision without fabricating semantics',async()=>{
 const f=fixture();f.content.clos=f.content.clos.slice(0,3);const data=replay(f.content,f.masters,()=>({}),{availability:'unavailable',judgements:[]}),r=await run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:data});assert.equal(r.academic.disposition,R);assert.equal(criterion(r,'course.fourCLOs').status,R);assert.ok(r.academic.relationships.every(j=>j.academicJudgment===null));assert.equal(r.academic.provenance.adapterRequests,0);
});
test('malformed V2 top-level arrays are rejected as controlled validation errors rather than unhandled TypeErrors',async()=>{
 const f=fixture(),data=replay(f.content,f.masters);f.content.plan='malformed';await assert.rejects(()=>run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:data}),e=>Number.isInteger(e.status)&&e.status>=400&&e.status<500,'malformed structured input must not crash unchecked');
});
test.after(()=>fs.writeFileSync(path.resolve(__dirname,'../../docs/lcup-comprehensive-verification/course-reference-cases.json'),JSON.stringify(rows,null,2)+'\n'));
