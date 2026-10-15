// Manual local integration test: saves one identifiable, unapproved BSFM syllabus for visual review.
// Uses the real route handlers and database. Authentication is injected only in this temporary loopback test server.
// It never changes account credentials, approves a syllabus, or sends notifications.
require('dotenv').config();
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const mysql=require('mysql2/promise');
const express=require('express');
const {loadCourse}=require('../lib/courses');
const {toSessionUser}=require('../middleware/auth');
const compliance=require('../lib/compliance/service');
const resultPath=path.resolve(__dirname,'../../docs/bsfm-admin-workflow-result.json');
const marker='BSFM ADMIN WORKFLOW TEST — NOT FOR PUBLICATION';

function makeForm(course){
 const topics=['Numbers, operations and estimation','Fractions, decimals and percentages','Ratios and proportions in business','Algebraic expressions and equations','Problem solving and interpretation','PRELIM EXAMINATION','Linear functions and graphs','Systems of linear equations','Exponents and logarithms','Simple interest and discounting','Compound interest and present value','MIDTERM EXAMINATION','Annuities and payment streams','Loan amortization schedules','Descriptive statistics for business','Probability and financial decisions','Integrated financial mathematics case study','FINAL EXAMINATION'];
 const plan=topics.map((topic,index)=>{
  const week=index+1; const exam=[6,12,18].includes(week);
  return {id:'bsfm-row-'+week,kind:exam?'exam':'lesson',week:String(week),ilos:[{id:'bsfm-ilo-'+week,text:exam?'':'Apply mathematical procedures to '+topic.toLowerCase()+' and explain the result in a business context.',tags:exam?[]:course.clos.map(clo=>'clo:'+clo.id)}],contents:topic,activities:exam?'Individual written assessment':'Guided discussion, worked examples and collaborative problem solving.',tasks:exam?'Written examination':'Problem set and short formative quiz with written explanations.',values:'Accuracy, honesty, responsible stewardship and critical thinking.'};
 });
 const item=(id,t)=>({id,t});
 return {schemaVersion:2,meta:{courseId:course.id,code:course.code,title:course.title,program:course.program.code,lecture:'3',lab:'0',prereq:'None'},description:[item('bsfm-description',marker+'. This demonstration syllabus develops foundational mathematical skills used in financial management. Students work with numerical operations, percentages, proportions, algebraic equations, functions, interest calculations, annuities, amortization, descriptive statistics and elementary probability. Through guided examples, individual exercises and collaborative case studies, learners interpret quantitative information, select appropriate methods, explain solutions and assess the reasonableness of results. The content is prepared solely to verify the administrator builder, saving and AI Checker handoff; it is not an approved instructional syllabus.')],clos:course.clos,plan,
 reqs:[item('bsfm-req-1','Complete weekly practice exercises and show the steps of each solution.'),item('bsfm-req-2','Participate in group problem solving and submit an individual reflection.'),item('bsfm-req-3','Complete formative quizzes and preliminary, midterm and final examinations.'),item('bsfm-req-4','Submit a financial mathematics case study with calculations, interpretation and proper attribution.')],
 refs:{books:{na:false,items:[item('bsfm-book','BSFM Workflow Test Team (2026). Demonstration mathematics workbook. Local test material; not a published textbook.')]},program:{na:false,items:[item('bsfm-program','BSFM Workflow Test Team (2026). Demonstration financial mathematics exercises. Local workflow verification material.')]},online:{na:false,items:[item('bsfm-online','BSFM Workflow Test Team (2026). Demonstration online learning resource record. Test data only.')]},electronics:{na:true,items:[]}},
 grading:{rows:[{id:'bsfm-grade-1',label:'Problem sets and exercises',pct:30},{id:'bsfm-grade-2',label:'Quizzes and participation',pct:20},{id:'bsfm-grade-3',label:'Financial mathematics case study',pct:10},{id:'bsfm-grade-4',label:'Examinations',pct:40}],override:{on:false,term:'',final:''}}};
}
async function main(){
 const db=mysql.createPool({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASS,database:process.env.DB_NAME,connectionLimit:3});
 let server;let result={test:marker,browserVerified:false,approved:false};
 const saveResult=()=>fs.writeFile(resultPath,JSON.stringify(result,null,2)+'\n');
 try{
  const [[account]]=await db.query("SELECT user_id,email,role,first_name,last_name,avatar_path,must_change_password,preferred_language FROM users WHERE role='admin' AND first_name=? AND last_name=?",['BOSENG','Evale']);
  assert.ok(account,'The administrator observed in the browser was not found');assert.equal(account.must_change_password,0);
  const [subjects]=await db.query("SELECT c.course_id FROM courses c JOIN programs p ON p.program_id=c.program_id WHERE p.code='BSFM' ORDER BY c.course_id");
  assert.ok(subjects.length,'No BSFM subject exists');
  const course=await loadCourse(db,subjects[0].course_id);const content=makeForm(course);
  const {createModel,STEPS}=await import(pathToFileURL(path.resolve(__dirname,'../../src/lib/syllabusModel.js')).href);
  const model=createModel({institution:{vision:course.standards.vision,mission:course.standards.mission,egas:course.standards.egas},programs:{[course.program.code]:{name:course.program.name,egas:course.standards.egas,pos:course.standards.pos}},year:2026});
  const sections=STEPS.filter(step=>step.key!=='review').map(step=>({step:step.key,blockers:model.blockers(content,step.key).map(issue=>issue.text)}));
  result={...result,administratorId:account.user_id,program:course.program.code,subjectId:course.id,subjectCode:course.code,subjectTitle:course.title,sections};
  assert.ok(sections.every(section=>section.blockers.length===0),'A required builder section remains incomplete: '+JSON.stringify(sections));
  const app=express();app.use(express.json({limit:'1mb'}));
  app.use((req,res,next)=>{req.session={user:toSessionUser(account)};next();});app.locals.db=db;
  app.use('/api/syllabi',require('../routes/syllabusContent'));app.use('/api/syllabi',require('../routes/syllabi'));app.use('/api',require('../routes/compliance'));
  server=await new Promise(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});
  const base='http://127.0.0.1:'+server.address().port+'/api';
  async function call(method,url,body){const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const json=await response.json();return {status:response.status,body:json};}
  let previous;try{previous=JSON.parse(await fs.readFile(resultPath,'utf8'));}catch{}
  let id=previous?.test===marker?previous.syllabusId:null;
  if(id){const [[row]]=await db.query('SELECT user_id,status,content FROM syllabi WHERE syllabus_id=?',[id]);assert.ok(row&&row.user_id===account.user_id&&row.status==='draft'&&row.content?.includes(marker),'Existing test record cannot safely be reused');}
  else{const created=await call('POST','/syllabi/drafts');assert.equal(created.status,200,JSON.stringify(created.body));id=created.body.id;}
  result.syllabusId=id;await saveResult();
  const saved=await call('PUT','/syllabi/'+id+'/content',{sections:{meta:content.meta,description:content.description,clos:content.clos,plan:content.plan,reqs:content.reqs,refs:content.refs,grading:content.grading},schemaVersion:2});
  assert.equal(saved.status,200,JSON.stringify(saved.body));result.saved=true;await saveResult();
  const before=await call('GET','/compliance?syllabus=all');assert.equal(before.status,200);assert.ok(!before.body.syllabi.some(row=>row.syllabusId===id));result.draftExcludedFromAiChecker=true;
  const prepared=await call('POST','/syllabi/'+id+'/prepare-check');result.handoffResponse=prepared;
  assert.equal(prepared.status,200,JSON.stringify(prepared.body));assert.equal(prepared.body.status,'under_review');
  const after=await call('GET','/compliance?syllabus=all');assert.equal(after.status,200);const queued=after.body.syllabi.find(row=>row.syllabusId===id);assert.ok(queued&&queued.checkable,'Completed test syllabus is absent from AI Checker');
  const repository=await call('GET','/syllabi?scope=repository');assert.equal(repository.status,200);assert.ok(!repository.body.some(row=>row.id===id),'Unapproved test record must not enter Repository');
  const stored=await call('GET','/syllabi/'+id+'/content');assert.equal(stored.status,200);
  result={...result,status:stored.body.status,aiCheckerAvailable:true,aiCheckRun:false,repositoryExcluded:true,approved:false,planRows:stored.body.content.plan.length,requirements:stored.body.content.reqs.length,gradingTotal:stored.body.content.grading.rows.reduce((total,row)=>total+row.pct,0),completedAt:new Date().toISOString()};
  await saveResult();console.log(JSON.stringify(result,null,2));
 }catch(error){result.error=error.message;await saveResult();console.error(JSON.stringify(result,null,2));process.exitCode=1;}
 finally{if(server)await new Promise(resolve=>server.close(resolve));await db.end();}
}
main();
