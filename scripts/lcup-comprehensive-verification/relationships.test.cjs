'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture,replay,POLICY}=require('../lcup-policy-v2-implementation/fixtures.cjs');
const {plan}=require('../../server/lib/syllabuscheck/academicV2Plan'),{run}=require('../../server/lib/syllabuscheck/engine');
const S='SUPPORTED_BY_SUPPLIED_EVIDENCE',R='REQUIRES_REVISION',F='FACULTY_REVIEW',N='NOT_EVALUATED';
const modes=['ALIGNED','PARTIALLY_ALIGNED','NOT_ALIGNED','NOT_CHECKED','empty-source','empty-target','ambiguous','keyword-trap','equivalent-wording','incorrect-quote','incorrect-recommendation','multiple-ILOs','grouped-weeks','provider-unavailable'];
const rows=[],fetchBefore=globalThis.fetch;let network=0;globalThis.fetch=async()=>{network++;throw Error('No external transport in relationship verification');};
function blankSide(f,type,side){const r=f.content.plan[2],ilo=r.ilos[0];if(side==='target'){if(['Content-ILO','ILO-CLO'].includes(type))ilo.text='';else if(['Content-activity','ILO-activity'].includes(type))r.activities='';else if(['Content-assessment','Activity-assessment'].includes(type))r.tasks='';else r.contents='';}else if(type==='Content-course')f.content.meta.title='';else if(['Content-ILO','Content-activity','Content-assessment'].includes(type))r.contents='';else if(type==='ILO-CLO')f.content.clos.find(c=>ilo.tags.includes('clo:'+c.id)).statement='';else if(type==='ILO-activity')ilo.text='';else r.activities='';}
for(const type of POLICY.weeklyTypes)for(const mode of modes)test(`${type} / ${mode}`,async()=>{
 const f=fixture(),row=f.content.plan[2];
 if(mode==='empty-source'||mode==='empty-target')blankSide(f,type,mode.split('-')[1]);
 if(mode==='keyword-trap'){row.contents='Java: the island ecosystem and geographic features';row.ilos[0].text='Classify plants on the island of Java.';row.activities='Identify Java island plants';row.tasks='Map Java island vegetation';}
 if(mode==='equivalent-wording'){row.contents='Repeated execution controlled by Boolean conditions';row.ilos[0].text='Implement and test conditional loops in Java.';row.activities='Trace iterations, then code and test a while loop';row.tasks='Produce a tested repetition construct and explain termination';}
 if(mode==='ambiguous'){row.ilos[0].text='Analyze the appropriate approach.';}
 if(mode==='multiple-ILOs')row.ilos.push({...structuredClone(row.ilos[0]),id:'extra-ilo',text:'Test another Java method and explain its results.'});
 if(mode==='grouped-weeks'){row.week='3-4';f.content.plan.splice(3,1);}
 const p=plan(f.content,f.masters),pair=p.pairs.find(p=>p.type===type&&p.id.startsWith('row2-'));assert.ok(pair);
 const negative=['NOT_ALIGNED','keyword-trap','incorrect-recommendation'].includes(mode),partial=['PARTIALLY_ALIGNED','ambiguous'].includes(mode);
 const data=replay(f.content,f.masters,p=>p.id===pair.id?{label:negative?'NOT_ALIGNED':partial?'PARTIALLY_ALIGNED':'ALIGNED',...(mode==='incorrect-recommendation'?{draft:'Replace the correct CLOs with invented PO 99 and teach human anatomy instead.'}:{}),...(mode==='incorrect-quote'?{sourceQuote:'This quotation does not occur in the supplied text.'}:{} )}:{});
 if(mode==='NOT_CHECKED')data.judgements=data.judgements.filter(j=>j.id!==pair.id);
 if(mode==='provider-unavailable'){data.availability='unavailable';data.judgements=[];}
 const before=JSON.stringify(f),r=await run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:data}),j=r.academic.relationships.find(j=>j.id===pair.id);
 const expected=['NOT_CHECKED','empty-source','empty-target','incorrect-quote','provider-unavailable'].includes(mode)?N:negative?R:partial?F:S;
 rows.push({relationship:type,mode,pairId:pair.id,expected,actual:j?.status,status:j?.status===expected?'PASS':'FAIL',semanticAccuracy:'BLOCKED: scripted labels are not genuine Claude or faculty judgments',source:j?.sourceText,target:j?.targetText,review:j?.reviewRequirements,correction:j?.recommendedCorrection});
 assert.equal(j?.status,expected);assert.equal(JSON.stringify(f),before);assert.equal(r.score,null);assert.deepEqual(r.hybrid.deductions,[]);
 if(mode==='incorrect-recommendation')assert.ok(r.academic.remediation.actions.every(a=>a.requiresHumanReview&&!a.canAutoApply));
 if(mode==='NOT_ALIGNED'){for(const other of POLICY.weeklyTypes.filter(t=>t!==type)){const cell=r.academic.requirements.find(c=>c.id===`weekly:2:${other}`);assert.equal(cell.status,S,other+' must remain independent');}}
 if(mode==='multiple-ILOs'&&['Content-ILO','ILO-CLO','ILO-activity'].includes(type))assert.equal(p.weekly.find(c=>c.id===`weekly:2:${type}`).groups.length,2);
 if(mode==='provider-unavailable')assert.equal(r.academic.provenance.adapterRequests,0);
});
test.after(()=>{globalThis.fetch=fetchBefore;assert.equal(network,0);fs.writeFileSync(path.resolve(__dirname,'../../docs/lcup-comprehensive-verification/relationship-cases.json'),JSON.stringify(rows,null,2)+'\n');});
