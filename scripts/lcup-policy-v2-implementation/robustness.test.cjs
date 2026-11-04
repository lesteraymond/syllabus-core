'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {fixture,replay,POLICY}=require('./fixtures.cjs');
const {run}=require('../../server/lib/syllabuscheck/engine');
const exec=async f=>run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:replay(f.content,f.masters)});
const S='SUPPORTED_BY_SUPPLIED_EVIDENCE',N='NOT_EVALUATED',F='FACULTY_REVIEW';
const originalFetch=globalThis.fetch;let requests=0;
globalThis.fetch=async()=>{requests++;throw Error('Offline tests forbid network');};
test.after(()=>{globalThis.fetch=originalFetch;assert.equal(requests,0);});
test('context truncation is disclosed; an unseen remainder cannot receive semantic approval',async()=>{
 const f=fixture();f.content.plan[2].contents='Java method '.repeat(190);const before=structuredClone(f.content);
 const r=await exec(f),link=r.academic.relationships.find(j=>j.id==='row2-content');assert.equal(link.status,N);assert.ok(link.reviewRequirements.includes('context_limit'));assert.notEqual(r.academic.disposition,S);assert.deepEqual(r.academic.originalContext.content,before);
});
test('a long aggregate weekly outline cannot be certified from the old bounded description-plan context',async()=>{
 const f=fixture();f.content.plan.forEach(r=>{if(r.kind!=='exam')r.contents='Java methods and classes. '.repeat(12);});const r=await exec(f);
 assert.equal(r.academic.relationships.find(j=>j.id==='description-plan').status,N);assert.notEqual(r.academic.disposition,S);
});
test('missing EGA masters create an explicit reference limitation, without blocking the separate official PO basis',async()=>{
 const f=fixture();f.masters.institution.egas=[];const r=await exec(f);
 assert.equal(r.academic.references.poUsable,true);assert.equal(r.academic.references.egaUsable,false);assert.ok(r.academic.references.issues.some(i=>i.code==='ega_reference_unavailable'));assert.equal(r.academic.requirements.find(j=>j.id==='course.clo0.EGA').status,F);assert.notEqual(r.academic.disposition,S);
});
test('missing columns/cells and a schedule gap remain objective findings, even with scripted positive semantic labels',async()=>{
 const f=fixture();f.content.plan[2].activities='';f.content.plan[2].week='';f.content.meta.title='';
 const r=await exec(f);assert.notEqual(r.academic.disposition,S);assert.notEqual(r.academic.requirements.find(j=>j.id==='structure.requiredFields').status,S);assert.notEqual(r.academic.requirements.find(j=>j.id==='schedule.weeks1to18').status,S);assert.equal(r.academic.relationships.find(j=>j.id==='row2-activityfit').status,N);
 assert.ok(r.findings.length);assert.deepEqual(r.hybrid.deductions,[]);
});
test('replay cannot reuse evidence after reference content changes, even when source syllabus is unchanged',async()=>{
 const f=fixture(),data=replay(f.content,f.masters);f.masters.institution.egas[0].name+=' Changed meaning';await assert.rejects(()=>run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:data}),e=>e.code==='academic_v2_offline_replay_required');
});
test('the required value relationship uses content itself; activities cannot substitute for missing content',async()=>{
 const f=fixture();f.content.plan[2].contents='';f.content.plan[2].activities='Courage: responsible programming practice';const r=await exec(f),link=r.academic.relationships.find(j=>j.id==='row2-value');assert.equal(link.sourceText,'');assert.equal(link.status,N);assert.notEqual(r.academic.disposition,S);
 const full=fixture(),result=await exec(full);assert.equal(result.academic.relationships.find(j=>j.id==='row2-value').sourceText,full.content.plan[2].contents);
});
test('an unavailable approved curriculum is a reference-review limitation, not a faculty misalignment',async()=>{
 const f=fixture();f.masters.curricula=[];const r=await exec(f);
 assert.equal(r.academic.requirements.find(j=>j.id==='course.identity').status,F);
 assert.equal(r.academic.relationships.find(j=>j.id==='row2-content').status,F);
 assert.equal(r.academic.relationships.find(j=>j.id==='clo0-classification').status,F);
 assert.equal(r.academic.relationships.find(j=>j.id==='row2-contentactivity').status,S);
 assert.equal(r.academic.disposition,F);
});
test('a wrong program/course identity cannot certify title-dependent semantic judgments',async()=>{
 const f=fixture('BSIT-CYBERSECURITY');f.masters.curricula[0].courses=[];const r=await exec(f);
 assert.equal(r.academic.requirements.find(j=>j.id==='course.identity').status,'REQUIRES_REVISION');
 assert.equal(r.academic.relationships.find(j=>j.id==='row2-content').status,N);
 assert.equal(r.academic.relationships.find(j=>j.id==='clo0-classification').status,N);
 assert.equal(r.academic.disposition,'REQUIRES_REVISION');
});
test('the explicit file preview runs offline and emits a versioned, nonofficial report',()=>{
 const f=fixture(),dir=path.resolve(__dirname,'../../tmp/lcup-policy-v2-implementation');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'cli-input.json');fs.writeFileSync(file,JSON.stringify({...f,offlineReplay:replay(f.content,f.masters)}));
 const r=spawnSync(process.execPath,[path.join(__dirname,'preview.cjs'),'--input',file],{encoding:'utf8',maxBuffer:10*1024*1024});assert.equal(r.status,0,r.stderr);const report=JSON.parse(r.stdout);assert.equal(report.evaluationPolicy.id,POLICY.id);assert.equal(report.evaluationPolicy.official,false);assert.equal(report.score,null);assert.equal(report.hybrid.ready,false);assert.equal(report.academic.provenance.liveModelCalls,0);
});
test('actual legacy/V2 comparison retains all previous scenario IDs and exhibits the policy difference',()=>{
 const c=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/lcup-policy-v2-implementation/comparison.json'))),old=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../docs/lcup-policy-v2/shadow-comparison.json')));
 assert.equal(c.results.length,22);assert.deepEqual(c.results.map(r=>r.id).sort(),old.results.map(r=>r.id).sort());assert.equal(c.networkAttempts,0);assert.equal(c.databaseWrites,0);
 const off=c.results.find(r=>r.id==='complete-off-course-content');assert.equal(off.legacy.candidate,100);assert.equal(off.v2.compliance,100);assert.equal(off.v2.weeklyFailed.length,60);assert.equal(off.v2.academic,'REQUIRES_REVISION');
 const optional=c.results.find(r=>r.id==='legacy-ILO-assessment-only');assert.equal(optional.legacy.candidate,97);assert.equal(optional.v2.academic,S);assert.deepEqual(optional.v2.academicDeductions,[]);
 const unavailable=c.results.find(r=>r.id==='AI-unavailable');assert.equal(unavailable.v2.academic,N);
 for(const r of c.results.filter(r=>r.kind==='verified-source-no-semantic-judgments')){assert.equal(r.v2.weeklyDisposition,N);assert.ok(r.v2.objectiveRevisionCriteria.every(c=>!c.id.startsWith('weekly:')));}
});
