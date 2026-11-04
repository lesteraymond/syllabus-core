import React,{act} from 'react';
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {Window} from 'happy-dom';
import Builder from '../../src/views/builder2/index.jsx';
import ComplianceCard from '../../src/views/ComplianceCard';
import {t,setLanguage} from '../../src/i18n';
const require=createRequire(import.meta.url),{start}=require('../../scripts/lcup-comprehensive-verification/sql-child.cjs');
const {replay,POLICY}=require('../../scripts/lcup-policy-v2-implementation/fixtures.cjs');
const browser=new Window({url:'http://localhost:5173'});Object.assign(globalThis,{window:browser,document:browser.document,HTMLElement:browser.HTMLElement,Event:browser.Event,MouseEvent:browser.MouseEvent,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client'),nativeFetch=globalThis.fetch;let state;const evidence=[];
before(async()=>{state=await start();globalThis.fetch=(url,options)=>{const local=String(url).replace(/^http:\/\/localhost:3001/,state.origin);if(!local.startsWith(state.origin+'/api/'))throw Error('External request forbidden: '+url);return nativeFetch(local,options);};});
after(async()=>{globalThis.fetch=nativeFetch;setLanguage('en');if(state)await state.close();fs.writeFileSync('docs/lcup-comprehensive-verification/ui-integration-evidence.json',JSON.stringify(evidence,null,2)+'\n');});
async function until(fn){for(let i=0;i<160;i++){if(await fn())return;await act(async()=>new Promise(r=>setTimeout(r,25)));}throw Error('UI condition did not settle');}
async function mount(Component,props){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(<Component {...props}/>));return {host,close:async()=>{await act(async()=>root.unmount());host.remove();}};}
for(const language of ['en','tl'])test(`${language}: real Builder load → actual Re-Check route → shared service → SQL report → faculty/admin display`,async()=>{
 setLanguage(language);const id=language==='en'?1:2;
 const ui=await mount(Builder,{editing:{syllabusId:id},user:{id:5,role:'faculty'},notify:()=>{},setPage:()=>{},onSubmitted:()=>{}});
 const description=state.contents[id-1].description[0].t+' Synthetic saved-and-reopened text.';
 try{await until(()=>ui.host.querySelector('.bld2-modes'));assert.ok(ui.host.textContent.includes(state.courses[id-1].code));
  const field=ui.host.querySelector(`textarea[aria-label="${t('ui.description_paragraph_207be8')}1"]`);assert.ok(field);await act(async()=>{Object.getOwnPropertyDescriptor(browser.HTMLTextAreaElement.prototype,'value').set.call(field,description);field.dispatchEvent(new browser.Event('input',{bubbles:true}));});
  await until(async()=>{const [[row]]=await state.pool.query('SELECT content FROM syllabi WHERE syllabus_id=?',[id]);return JSON.parse(row.content).description[0].t===description;});
 }finally{await ui.close();}
 const reopen=await mount(Builder,{editing:{syllabusId:id},user:{id:5,role:'faculty'},notify:()=>{},setPage:()=>{},onSubmitted:()=>{}});try{await until(()=>reopen.host.querySelector('.bld2-modes'));assert.equal(reopen.host.querySelector(`textarea[aria-label="${t('ui.description_paragraph_207be8')}1"]`).value,description);}finally{await reopen.close();}
 const [before]=await state.pool.query('SELECT content FROM syllabi WHERE syllabus_id=?',[id]);
 const saved=await (await fetch(state.origin+`/api/syllabi/${id}/content`)).json();assert.deepEqual(saved.content.clos.map(c=>c.pos),state.contents[id-1].clos.map(c=>c.pos));assert.deepEqual(saved.content.clos.map(c=>c.egas),state.contents[id-1].clos.map(c=>c.egas));assert.deepEqual(saved.content.plan,state.contents[id-1].plan);assert.deepEqual(saved.content.refs,state.contents[id-1].refs);
 const response=await fetch(state.origin+`/api/syllabi/${id}/compliance/recheck`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({academicPolicy:POLICY.id,activate:true})});const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));const run=body.run;
 assert.equal(run.hybrid.version,'hybrid-2');assert.equal(run.evaluationPolicy,undefined);assert.equal(run.hybrid.policy.version,'syllabus-policy-2');
 const [[stored]]=await state.pool.query('SELECT report_json FROM syllabus_check_reports WHERE run_id=?',[run.id]);const report=JSON.parse(stored.report_json);assert.equal(report.academic,undefined);assert.ok(report.hybrid.alignment.judgements.length);assert.equal(report.hybrid.alignment.judgements[0].explanation,'Synthetic integration response only.');
 const [after]=await state.pool.query('SELECT content FROM syllabi WHERE syllabus_id=?',[id]);assert.deepEqual(after,before);
 const card=await mount(ComplianceCard,{run});try{assert.equal(card.host.querySelector('[data-policy]'),null);assert.ok(card.host.textContent);}finally{await card.close();}
 const reload=await(await fetch(state.origin+`/api/syllabi/${id}/compliance`)).json();assert.equal(reload.run.id,run.id);assert.deepEqual(reload.run.hybrid.alignment.judgements,run.hybrid.alignment.judgements);
 evidence.push({language,legacyRunId:run.id,normalRouteIgnoresV2Body:true,savedReportPreserved:true,authoredContentUnchanged:true});
});
test('actual SQL master resolution retains all four program PO counts and separate Cyber curriculum',async()=>{
 for(const [i,program] of ['BSIT','BSIE','BSCPE','BSIT-CYBERSECURITY'].entries()){const m=await state.masters(state.contents[i],i+1);assert.equal(m.pos.length,program.startsWith('BSIT')?9:13);assert.ok(m.curricula.every(c=>c.program===program));if(program==='BSIT-CYBERSECURITY'){assert.equal(m.outcomeSource,'BSIT');assert.equal(m.curricula[0].curriculumYear,'2025-2026');assert.ok(m.curricula[0].courses.some(c=>c.code==='IT-202'&&c.title==='SYSTEM INTEGRATION AND ARCHITECTURE 1'));}}
});
for(const language of ['en','tl'])test(`${language}: V2 readonly preview → shared service → evidence/UI; cannot persist an official report`,async()=>{
 setLanguage(language);const content=(await(await fetch(state.origin+'/api/syllabi/1/content')).json()).content,masters=await state.masters(content,1),data=replay(content,masters,p=>p.type==='Content-course'?{label:'NOT_ALIGNED'}:{});await state.installReplay(1,data);
 const [[before]]=await state.pool.query('SELECT COUNT(*) AS n FROM ai_check_runs'),start=(await state.sqlSnapshot()).length;
 const response=await fetch(state.origin+'/api/syllabus-check/syllabi/1/academic-v2-preview',{method:'POST'}),r=await response.json();fs.writeFileSync('docs/lcup-comprehensive-verification/sql-v2-'+language+'.json',JSON.stringify(r,null,2));assert.equal(response.status,200,JSON.stringify(r));assert.equal(r.evaluationPolicy.id,POLICY.id);assert.equal(r.academic.disposition,'REQUIRES_REVISION');assert.equal(r.score,null);assert.equal(r.hybrid.ready,false);assert.ok((await state.sqlSnapshot()).slice(start).every(q=>/^SELECT/i.test(q)));
 const card=await mount(ComplianceCard,{run:r});try{assert.ok(card.host.textContent.includes(t('academicV2.preview')));assert.ok(card.host.textContent.includes(t('academicV2.status.REQUIRES_REVISION')));assert.ok(!card.host.querySelector('.big-ring'));assert.equal(card.host.querySelectorAll('button').length,0);}finally{await card.close();}
 const [[after]]=await state.pool.query('SELECT COUNT(*) AS n FROM ai_check_runs');assert.equal(after.n,before.n);evidence.push({language,V2Preview:true,officialWrites:0,academicGrade:null});
});
test('another faculty member cannot access content, stored reports, Re-Check or V2 preview',async()=>{
 for(const [method,url] of [['GET','/api/syllabi/1/content'],['GET','/api/syllabi/1/compliance'],['POST','/api/syllabi/1/compliance/recheck'],['POST','/api/syllabus-check/syllabi/1/academic-v2-preview']]){const r=await fetch(state.origin+url,{method,headers:{'x-test-user':'6'}});assert.equal(r.status,404,url);}
});
test('simultaneous normal Re-Checks use the existing single-check gate',async()=>{
 const responses=await Promise.all([1,2].map(()=>fetch(state.origin+'/api/syllabi/3/compliance/recheck',{method:'POST'})));assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);const busy=await responses.find(r=>r.status===409).json();assert.equal(busy.code,'ai_check_in_progress');
});
test('administrator reads the saved historical legacy report without reinterpreting policy',async()=>{
 await state.pool.query("UPDATE syllabi SET status='submitted' WHERE syllabus_id=1");const [[facultyRun]]=await state.pool.query('SELECT run_id FROM ai_check_runs WHERE syllabus_id=1 ORDER BY run_id DESC LIMIT 1');const privateRun=await fetch(state.origin+'/api/compliance/runs/'+facultyRun.run_id,{headers:{'x-test-user':'9'}});assert.equal(privateRun.status,404,'Faculty-owned runs remain private to that author');
 const [[saved]]=await state.pool.query('SELECT content FROM syllabi WHERE syllabus_id=1');await state.pool.query("INSERT INTO syllabus_versions(syllabus_id,version_label,status_at_save,content,created_by) VALUES(1,'v1.0','submitted',?,5)",[saved.content]);
 const checked=await fetch(state.origin+'/api/syllabi/1/compliance/recheck',{method:'POST',headers:{'x-test-user':'9'}}),checkedBody=await checked.json();assert.equal(checked.status,200,JSON.stringify(checkedBody));const runId=checkedBody.run.id;
 const response=await fetch(state.origin+'/api/compliance/runs/'+runId,{headers:{'x-test-user':'9'}}),body=await response.json();assert.equal(response.status,200,JSON.stringify(body));const report=body.run||body;assert.equal(report.hybrid.policy.version,'syllabus-policy-2');assert.equal(report.academic,undefined);
 const card=await mount(ComplianceCard,{run:report});try{assert.ok(card.host.textContent);assert.equal(card.host.querySelector('[data-policy]'),null);}finally{await card.close();}
});
test('a malformed saved structured record receives a controlled 4xx preview response instead of an unhandled server failure',async()=>{
 const [[old]]=await state.pool.query('SELECT content FROM syllabi WHERE syllabus_id=4'),valid=JSON.parse(old.content),masters=await state.masters(valid,4),data=replay(valid,masters),bad={...valid,plan:'malformed'};await state.installReplay(4,data);await state.pool.query('UPDATE syllabi SET content=? WHERE syllabus_id=4',[JSON.stringify(bad)]);
 try{const r=await fetch(state.origin+'/api/syllabus-check/syllabi/4/academic-v2-preview',{method:'POST'}),body=await r.json();fs.writeFileSync('docs/lcup-comprehensive-verification/malformed-api-response.json',JSON.stringify({httpStatus:r.status,body},null,2));assert.ok(r.status>=400&&r.status<500,JSON.stringify({status:r.status,body}));}finally{await state.pool.query('UPDATE syllabi SET content=? WHERE syllabus_id=4',[old.content]);}
});
