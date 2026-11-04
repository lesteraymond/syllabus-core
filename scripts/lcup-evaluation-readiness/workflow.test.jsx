// Full import UI + real production import/content routes + isolated MariaDB.
// Only AI and ancillary catalog/status endpoints are simulated. No production DB config.
import React, { act } from 'react';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Window } from 'happy-dom';
import Builder from '../../src/views/builder2/index.jsx';
import { hydrateContent } from '../../src/lib/syllabusModel.js';
import { t, setLanguage } from '../../src/i18n/index.js';
const rootPath = process.cwd(), require = createRequire(import.meta.url);
const mysql = require(path.join(rootPath, 'server/node_modules/mysql2/promise'));
const express = require(path.join(rootPath, 'server/node_modules/express'));
const { loadCourse } = require(path.join(rootPath, 'server/lib/courses'));
const importRouter = require(path.join(rootPath, 'server/routes/pdfImport'));
const contentRouter = require(path.join(rootPath, 'server/routes/syllabusContent'));
const schemaDdl = require(path.join(rootPath, 'server/db/syllabuscheck-ddl'));
const output = path.join(rootPath, 'docs/lcup-evaluation-readiness');
const read = async f => JSON.parse(await fs.readFile(path.join(rootPath,'docs/lcup-approved-offline',f),'utf8'));
const audit = JSON.parse(await fs.readFile(path.join(output,'current-pos.json'),'utf8'));
const browser = new Window({url:'http://localhost:5173'});
Object.assign(globalThis,{window:browser,document:browser.document,HTMLElement:browser.HTMLElement,Event:browser.Event,MouseEvent:browser.MouseEvent,IS_REACT_ACT_ENVIRONMENT:true});
const { createRoot } = await import('react-dom/client');
URL.createObjectURL = () => 'blob:isolated-source'; URL.revokeObjectURL = () => {};
const nativeFetch = globalThis.fetch;
let pool, server, origin, sentinelBefore;
const requests=[], results=[], courses=[], fixtures=[];
let aiCalls=0, sqlWrites=0;
const comparable = c => ({ meta:{program:c.meta.program,code:c.meta.code,title:c.meta.title,prereq:c.meta.prereq,curriculumYear:c.meta.curriculumYear},
  clos:c.clos.map(x=>({statement:x.statement,pos:x.pos,egas:x.egas})),
  plan:c.plan.map(r=>({week:r.week,kind:r.kind,ilos:r.ilos.map(i=>({text:i.text,tags:i.tags.map(tag=>c.clos.findIndex(x=>tag===`clo:${x.id}`)+1)})),contents:r.contents,activities:r.activities,tasks:r.tasks,values:r.values})),
  outcomes:c.outcomes,description:c.description.map(i=>i.t),refs:Object.fromEntries(Object.entries(c.refs).map(([key,g])=>[key,{na:g.na,items:g.items.map(i=>i.t)}])),grading:c.grading.rows.map(r=>({label:r.label,pct:r.pct})) });
before(async()=>{
  // Fail before any DDL/DML unless this is the independently bootstrapped server.
  const config={host:'127.0.0.1',port:43307,user:'root',password:'lcup-isolated-only',multipleStatements:false,connectionLimit:3};
  const conn=await mysql.createConnection(config);
  const [[identity]]=await conn.query('SELECT @@datadir AS datadir, @@port AS port, VERSION() AS version');
  const expected=path.join(rootPath,'tmp/lcup-evaluation-readiness-db/data').replaceAll('\\','/').toLowerCase();
  assert.equal(identity.datadir.replaceAll('\\','/').replace(/\/$/,'').toLowerCase(),expected);
  assert.equal(identity.port,43307);
  await fs.writeFile(path.join(output,'disposable-database.json'),JSON.stringify({identity,guardVerified:true,productionConfigUsed:false},null,2)+'\n');
  const database=`lcup_import_evaluation_${process.pid}`;
  await conn.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.end();
  pool=mysql.createPool({...config,database});
  const schema=await fs.readFile(path.join(rootPath,'server/db/schema.sql'),'utf8');
  const tables=new Set(['users','curriculum','programs','program_egas','program_outcomes','courses','course_clos','faculty_programs','faculty_courses','syllabi']);
  for(const match of schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)\s*\([\s\S]*?\n\);/g)) if(tables.has(match[1]))await pool.query(match[0]);
  await pool.query(schemaDdl[0]); // create a fresh test reference table, not a migration
  await pool.query("INSERT INTO users(user_id,email,password_hash,role,first_name,last_name) VALUES(5,'isolated@example.invalid','test-only','faculty','Isolated','Tester'),(6,'sentinel@example.invalid','test-only','faculty','Sentinel','Tester')");
  const selectedKeys=['it202','ie402','cpe304'];
  for(const key of selectedKeys)fixtures.push(await read(`${key}.fixture.json`));
  for(const [index,code] of ['BSIT','BSIE','BSCPE','BSIT-CYBERSECURITY'].entries()){
    const id=index+1, program=audit.programs[code];
    await pool.query('INSERT INTO programs(program_id,code,name) VALUES(?,?,?)',[id,code,`Isolated ${code}`]);
    await pool.query('INSERT INTO faculty_programs(user_id,program_id) VALUES(5,?)',[id]);
    for(const c of program.masters.curricula)await pool.query('INSERT INTO syllabus_check_curricula(program_code,curriculum_year,status,source,courses_json) VALUES(?,?,?,?,?)',[code,c.curriculumYear,'approved',c.source,JSON.stringify(c.courses)]);
    const fixture=fixtures.find(f=>f.content.meta.program===code);
    const record=program.masters.curricula[0].courses.find(c=>fixture?c.code.replace(/[^A-Z0-9]/gi,'').toUpperCase()===fixture.content.meta.code.replace(/[^A-Z0-9]/gi,'').toUpperCase():c.code==='IT-202');
    const courseId=index+25, standards={...program.masters.institution,pos:program.ownPos};
    await pool.query('INSERT INTO courses(course_id,code,title,program_id,standards_json) VALUES(?,?,?,?,?)',[courseId,record.code,record.title,id,JSON.stringify(standards)]);
    await pool.query('INSERT INTO faculty_courses(user_id,course_id) VALUES(5,?)',[courseId]);
    const content=structuredClone(fixture?.content || fixtures[0].content);
    Object.assign(content.meta,{courseId,code:record.code,title:record.title,program:code,curriculumYear:program.masters.curricula[0].curriculumYear,prereq:'ISOLATED EXISTING PREREQUISITE'});
    content.description=[{id:'isolated_before',t:'ISOLATED BEFORE IMPORT'}];
    await pool.query("INSERT INTO syllabi(syllabus_id,user_id,course_id,status,version,content,content_schema_version) VALUES(?,5,?,'draft','v1.0',?,3)",[id,courseId,JSON.stringify(content)]);
    courses.push({id:courseId,syllabusId:id,code:record.code,title:record.title,program:code,initial:content});
  }
  await pool.query("INSERT INTO syllabi(syllabus_id,user_id,status,version,content,content_schema_version) VALUES(9001,6,'approved','v1.0','{\"sentinel\":\"synthetic unrelated record\"}',3)");
  [sentinelBefore]=await pool.query('SELECT * FROM syllabi WHERE syllabus_id=9001');
  const app=express();app.use(express.json({limit:'1mb'}));
  const tracked={query:async(sql,params)=>{if(!/^SELECT/i.test(sql))sqlWrites++;return pool.query(sql,params);},getConnection:()=>pool.getConnection()};
  app.locals.db=tracked;
  app.use((req,res,next)=>{req.session={user:{id:5,role:'faculty',firstName:'Isolated',lastName:'Tester'}};requests.push({method:req.method,path:req.path});next();});
  app.get('/api/programs',async(req,res)=>res.json(courses.map(c=>({code:c.program,name:`Isolated ${c.program}`}))));
  app.get('/api/courses/:id',async(req,res)=>res.json(await loadCourse(pool,Number(req.params.id))));
  app.get('/api/courses',async(req,res)=>res.json(courses.filter(c=>c.program===req.query.program)));
  app.get('/api/users/me/assignments',(req,res)=>res.json({courseIds:courses.map(c=>c.id),programIds:[1,2,3,4]}));
  app.get('/api/syllabus-check/status',(req,res)=>res.json({aiGate:'advisory'}));
  app.get('/api/syllabi/:id/compliance',(req,res)=>res.json({installed:true,run:null}));
  app.post('/api/syllabi/:id/compliance/recheck',(req,res)=>{aiCalls++;res.json({run:{id:aiCalls,status:'insufficient',overall:null,stale:false,findings:[],areas:[],recommendations:[],aiStatus:'mocked',filledSections:0,passThreshold:79}});});
  app.use('/api/syllabi',importRouter);app.use('/api/syllabi',contentRouter);
  app.use((req,res)=>res.status(404).json({error:`Unexpected isolated request: ${req.method} ${req.path}`}));
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.on('listening',resolve));
  origin=`http://127.0.0.1:${server.address().port}`;
  globalThis.fetch=(url,options)=>{
    const value=String(url),local=value.replace(/^http:\/\/localhost:3001/,origin);
    if(!local.startsWith(origin+'/api/'))throw Error(`External network denied in workflow test: ${value}`);
    return nativeFetch(local,options);
  };
});
after(async()=>{
  if(pool){
    const [sentinelAfter]=await pool.query('SELECT * FROM syllabi WHERE syllabus_id=9001');
    const untouched=JSON.stringify(sentinelBefore)===JSON.stringify(sentinelAfter);
    await fs.writeFile(path.join(output,'workflow-results.json'),JSON.stringify({results,requests,mockedAiCalls:aiCalls,paidAiCalls:0,syntheticSentinelUnchanged:untouched,productionDatabaseWrites:0,scope:'Actual React builder in simulated DOM; real HTTP upload/content routes and isolated MariaDB; AI/ancillary endpoints mocked'},null,2)+'\n');
    assert.equal(untouched,true);
    await pool.end();
  }
  globalThis.fetch=nativeFetch;setLanguage('en');
  if(server)await new Promise(resolve=>server.close(resolve));
});
async function waitFor(fn,message){
  for(let i=0;i<200;i++){if(fn())return;await act(async()=>new Promise(r=>setTimeout(r,25)));}
  throw Error(message);
}
async function mount(id){
  const host=document.createElement('div');document.body.append(host);const react=createRoot(host);
  await act(async()=>react.render(<Builder editing={{syllabusId:id}} user={{id:5,role:'faculty'}} notify={()=>{}} setPage={()=>{}} onSubmitted={()=>{}}/>));
  await waitFor(()=>host.querySelector('.bld2-modes'),'Builder did not load');
  return {host,react,close:async()=>{await act(async()=>react.unmount());host.remove();}};
}
const button=(host,label)=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes(label));
async function upload(ui,key){
  const tab=ui.host.querySelectorAll('.bld2-modes [role=tab]')[1];await act(async()=>tab.click());
  const fixture=fixtures.find(f=>f.key===key),bytes=await fs.readFile(path.join(rootPath,fixture.source.file));
  const input=ui.host.querySelector('input[type=file]');
  Object.defineProperty(input,'files',{configurable:true,value:[new File([bytes],path.basename(fixture.source.file),{type:'application/pdf'})]});
  await act(async()=>input.dispatchEvent(new browser.Event('change',{bubbles:true})));
  await act(async()=>button(ui.host,t('pdfImport.extract')).click());
  await waitFor(()=>ui.host.querySelector('.pdf-import-review'),'No PDF preview');
  assert.ok(ui.host.textContent.includes(t('pdfImport.reviewTitle')));
}
for(const language of ['en','tl'])for(const action of ['keep','replace'])for(const [index,key] of ['it202','ie402','cpe304'].entries()){
test(`${language} ${key} ${action}: PDF upload → preview → Apply → real save → unmount → reopen`,async()=>{
  setLanguage(language);importRouter.limiter.reset();
  const entry=courses[index],fixture=fixtures[index];
  await pool.query('UPDATE syllabi SET content=? WHERE syllabus_id=?',[JSON.stringify(entry.initial),entry.syllabusId]);
  const start=requests.length,aiBefore=aiCalls;
  let ui=await mount(entry.syllabusId);
  try{
    await upload(ui,key);
    assert.equal(requests.slice(start).filter(r=>r.method==='PUT').length,0,'Preview must not save');
    assert.equal(aiCalls,aiBefore);
    const radios=ui.host.querySelectorAll('.pdf-import-prerequisite input');assert.equal(radios.length,2);
    await act(async()=>radios[action==='keep'?0:1].click());
    await act(async()=>ui.host.querySelector('.pdf-import-confirm input').click());
    await act(async()=>button(ui.host,t('pdfImport.apply')).click());
    await waitFor(()=>aiCalls===aiBefore+1,'Apply did not reach the mocked AI endpoint after save');
    const saved=await (await fetch(`${origin}/api/syllabi/${entry.syllabusId}/content`)).json();
    assert.equal(saved.content.meta.program,entry.program);assert.equal(saved.content.meta.code,entry.code);assert.equal(saved.content.meta.title,entry.title);
    assert.equal(saved.content.meta.prereq,action==='keep'?'ISOLATED EXISTING PREREQUISITE':fixture.content.meta.prereq);
    assert.equal(saved.content.meta.curriculumYear,entry.initial.meta.curriculumYear);
    assert.deepEqual(saved.content.clos.map(c=>c.pos),fixture.content.clos.map(c=>c.pos));
    assert.deepEqual(saved.content.clos.map(c=>c.egas),fixture.content.clos.map(c=>c.egas));
    const links=c=>c.plan.filter(r=>r.kind!=='exam').flatMap(r=>r.ilos).filter(i=>i.text.trim()).map(i=>i.tags.map(tag=>c.clos.findIndex(clo=>`clo:${clo.id}`===tag)+1));
    assert.deepEqual(links(saved.content),links(fixture.content));
    const sequence=requests.slice(start),put=sequence.findIndex(r=>r.method==='PUT'&&r.path.endsWith('/content')),check=sequence.findIndex(r=>r.path.endsWith('/compliance/recheck'));
    assert.ok(put>=0&&check>put);
    await ui.close();ui=await mount(entry.syllabusId);
    assert.ok(ui.host.textContent.includes(entry.code));
    const reopened=await(await fetch(`${origin}/api/syllabi/${entry.syllabusId}/content`)).json();
    assert.deepEqual(comparable(reopened.content),comparable(saved.content));
    let fallbackId=0;
    const hydrated=hydrateContent(reopened.content,()=>`unused_fallback_${++fallbackId}`);
    assert.deepEqual(comparable(hydrated),comparable(saved.content));
    assert.deepEqual(hydrated.clos.map(c=>c.id),saved.content.clos.map(c=>c.id));
    assert.deepEqual(hydrated.plan.flatMap(r=>r.ilos.map(i=>i.id)),saved.content.plan.flatMap(r=>r.ilos.map(i=>i.id)));
    results.push({language,key,action,roundTrip:true,cloPo:saved.content.clos.reduce((n,c)=>n+c.pos.length,0),cloEga:saved.content.clos.reduce((n,c)=>n+c.egas.length,0),iloClo:links(saved.content).reduce((n,v)=>n+v.length,0),prereq:saved.content.meta.prereq});
  }finally{await ui.close();}
});}
for(const language of ['en','tl'])test(`${language}: BSIT IT202 PDF is blocked for Cyber IT-202 before save/check`,async()=>{
  setLanguage(language);importRouter.limiter.reset();const entry=courses[3],start=requests.length,aiBefore=aiCalls;
  const [[before]]=await pool.query('SELECT content FROM syllabi WHERE syllabus_id=?',[entry.syllabusId]);
  const ui=await mount(entry.syllabusId);
  try{
    await upload(ui,'it202');await act(async()=>ui.host.querySelector('.pdf-import-confirm input').click());
    await act(async()=>button(ui.host,t('pdfImport.apply')).click());
    assert.ok(ui.host.querySelector('.pdf-import-review [role=alert][tabindex]'));
    assert.ok(ui.host.textContent.includes(t('pdfImport.identityMismatch',{code:'IT 202',selected:'IT-202'})));
    assert.equal(requests.slice(start).filter(r=>r.method==='PUT').length,0);assert.equal(aiCalls,aiBefore);
    const [[after]]=await pool.query('SELECT content FROM syllabi WHERE syllabus_id=?',[entry.syllabusId]);assert.equal(after.content,before.content);
    results.push({language,key:'cyber-collision',blockedBeforeSave:true});
  }finally{await ui.close();}
});
for(const language of ['en','tl'])test(`${language}: unresolved prerequisite choice blocks before save/check`,async()=>{
  setLanguage(language);importRouter.limiter.reset();const entry=courses[0],start=requests.length,aiBefore=aiCalls;
  await pool.query('UPDATE syllabi SET content=? WHERE syllabus_id=?',[JSON.stringify(entry.initial),entry.syllabusId]);
  const ui=await mount(entry.syllabusId);
  try{
    await upload(ui,'it202');await act(async()=>ui.host.querySelector('.pdf-import-confirm input').click());
    await act(async()=>button(ui.host,t('pdfImport.apply')).click());
    assert.ok(ui.host.textContent.includes(t('pdfImport.prereqReviewRequired')));
    assert.equal(requests.slice(start).filter(r=>r.method==='PUT').length,0);assert.equal(aiCalls,aiBefore);
    const [[row]]=await pool.query('SELECT content FROM syllabi WHERE syllabus_id=?',[entry.syllabusId]);assert.equal(row.content,JSON.stringify(entry.initial));
    results.push({language,key:'prerequisite-decision',blockedBeforeSave:true});
  }finally{await ui.close();}
});
