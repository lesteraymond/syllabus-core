'use strict';
// Fresh, separately initialized MariaDB only. Never loads server/.env.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),mysql=require('../../server/node_modules/mysql2/promise'),express=require('../../server/node_modules/express');
const {fixture}=require('../lcup-policy-v2-implementation/fixtures.cjs');
const {references}=require('../lcup-academic-benchmark/references.cjs');
const svc=require('../../server/lib/compliance/service'),repo=require('../../server/lib/syllabuscheck/repository');
async function start(){
 const cfg=JSON.parse(fs.readFileSync(path.join(root,'docs/lcup-comprehensive-verification/disposable-config.json'),'utf8'));
 assert.equal(cfg.host,'127.0.0.1');assert.equal(cfg.port,43309);assert.ok(path.resolve(cfg.datadir).toLowerCase().startsWith(path.join(root,'tmp/lcup-comprehensive-verification-db-').toLowerCase()));
 const base={host:cfg.host,port:cfg.port,user:cfg.user,password:cfg.password},conn=await mysql.createConnection(base),[[identity]]=await conn.query('SELECT @@datadir AS datadir, @@port AS port, VERSION() AS version');
 assert.equal(identity.port,43309);assert.equal(identity.datadir.replaceAll('\\','/').replace(/\/$/, '').toLowerCase(),cfg.datadir.replaceAll('\\','/').toLowerCase());
 const database='lcup_verify_'+process.pid+'_'+Date.now();await conn.query('CREATE DATABASE '+database+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');await conn.end();
 const pool=mysql.createPool({...base,database,connectionLimit:4});
 const schema=fs.readFileSync(path.join(root,'server/db/schema.sql'),'utf8');let tables=0;for(const m of schema.matchAll(/CREATE TABLE IF NOT EXISTS[\s\S]*?;(?=\s*(?:\r?\n|$))/g)){await pool.query(m[0]);tables++;}
 await pool.query("INSERT INTO users(user_id,email,password_hash,role,first_name,last_name) VALUES(5,'author@example.invalid','test','faculty','Synthetic','Author'),(6,'sentinel@example.invalid','test','faculty','Synthetic','Sentinel'),(9,'admin@example.invalid','test','admin','Synthetic','Administrator')");
 const refs=references(),inst=fixture().masters.institution;
 await pool.query('INSERT INTO institution_settings(setting_id,vision,mission_lead,mission_items,version) VALUES(1,?,?,?,1)',[inst.vision,inst.mission.lead,JSON.stringify(inst.mission.items)]);
 for(const e of inst.egas)await pool.query('INSERT INTO institution_egas(ega_no,name,short_name) VALUES(?,?,?)',[e.no,e.name,e.short]);
 const courses=[],contents=[];
 for(const [i,program] of ['BSIT','BSIE','BSCPE','BSIT-CYBERSECURITY'].entries()){
  const id=i+1,ref=refs.curricula.find(c=>c.program===program),codes={BSIT:'IT 202',BSIE:'IE-402',BSCPE:'CpE-304','BSIT-CYBERSECURITY':'IT-202'},course=ref.courses.find(c=>c.code===codes[program]);
  await pool.query('INSERT INTO programs(program_id,code,name) VALUES(?,?,?)',[id,program,'Isolated '+program]);
  for(const e of inst.egas)await pool.query('INSERT INTO program_egas(program_id,ega_no,name,short_name) VALUES(?,?,?,?)',[id,e.no,e.name,e.short]);
  if(program!=='BSIT-CYBERSECURITY')for(const p of refs.official.programs[program].outcomes)await pool.query('INSERT INTO program_outcomes(program_id,po_no,short_name,outcome_text,ega_nos) VALUES(?,?,?,?,?)',[id,p.no,p.short,p.text,'']);
  await pool.query('INSERT INTO faculty_programs(user_id,program_id) VALUES(5,?)',[id]);
  await pool.query('INSERT INTO syllabus_check_curricula(program_code,curriculum_year,status,source,courses_json) VALUES(?,?,?,?,?)',[program,ref.curriculumYear,'approved','Isolated copy of existing verified curriculum; no production reference approval',JSON.stringify(ref.courses)]);
  const {content}=fixture(program);Object.assign(content.meta,{courseId:25+i,program,code:course.code,title:course.title,curriculumYear:ref.curriculumYear,prereq:course.prereq,yearLevel:String(course.yearLevel),lecture:String(course.lecture),lab:String(course.lab)});
  content.outcomes={...structuredClone(inst),pos:structuredClone(refs.official.programs[program==='BSIT-CYBERSECURITY'?'BSIT':program].outcomes)};
  const standards={...structuredClone(content.outcomes)};
  await pool.query('INSERT INTO courses(course_id,code,title,program_id,standards_json) VALUES(?,?,?,?,?)',[25+i,course.code,course.title,id,JSON.stringify(standards)]);
  await pool.query('INSERT INTO faculty_courses(user_id,course_id) VALUES(5,?)',[25+i]);
  await pool.query("INSERT INTO syllabi(syllabus_id,user_id,course_id,status,version,content,content_schema_version) VALUES(?,5,?,'draft','v1.0',?,3)",[id,25+i,JSON.stringify(content)]);
  courses.push({id:25+i,code:course.code,title:course.title,program});contents.push(content);
 }
 await pool.query("INSERT INTO program_outcome_sources(program_id,source_program_id,specialization) VALUES(4,1,'Synthetic isolated inheritance test')");
 await pool.query("INSERT INTO syllabi(syllabus_id,user_id,status,version,content,content_schema_version) VALUES(9001,6,'approved','v1.0','{\"sentinel\":\"isolated untouched record\"}',3)");
 const [sentinel]=await pool.query('SELECT * FROM syllabi WHERE syllabus_id=9001'),sql=[];
 const track=(target,query,params)=>{sql.push(query);return target.query(query,params);};
 const db={query:(q,p)=>track(pool,q,p),getConnection:async()=>{const c=await pool.getConnection();return {query:(q,p)=>track(c,q,p),beginTransaction:()=>c.beginTransaction(),commit:()=>c.commit(),rollback:()=>c.rollback(),release:()=>c.release()};}};
 const originalCheck=svc.checkHybrid;let semanticRequests=0;
 svc.checkHybrid=(db,content,options={})=>options.academicPolicy?originalCheck(db,content,options):originalCheck(db,content,{...options,env:{SYLLABUS_CHECK_AI_PROVIDER:'gemini',GEMINI_API_KEY:'isolated-mock-not-a-key'},useAi:true,linkChecker:async url=>({url,status:'ok',httpStatus:200}),transport:async(_url,request)=>{
  semanticRequests++;const pairs=JSON.parse(JSON.parse(request.body).contents[0].parts[0].text).document_data;
  return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({judgements:pairs.map(p=>({id:p.id,label:'ALIGNED',explanation:'Synthetic integration response only.',sourceQuote:p.source.slice(0,18),targetQuote:p.target.slice(0,18),sourceBloom:'N/A',targetBloom:'N/A',draft:''}))})}]}}]})};
 }});
 svc.resetInstalledCache();
 const app=express();app.use(express.json({limit:'2mb'}));app.locals.db=db;
 app.use((req,res,next)=>{const id=Number(req.headers['x-test-user']||5);req.session={user:{id,role:id===9?'admin':'faculty',firstName:'Synthetic',lastName:'Tester'}};next();});
 app.get('/api/programs',(req,res)=>res.json(courses.map(c=>({code:c.program,name:c.program}))));
 app.get('/api/courses',(req,res)=>res.json(courses.filter(c=>c.program===req.query.program)));
 app.get('/api/courses/:id',async(req,res)=>{try{res.json(await require('../../server/lib/courses').loadCourse(pool,Number(req.params.id)));}catch(e){res.status(500).json({error:e.message});}});
 app.get('/api/users/me/assignments',(req,res)=>res.json({courseIds:courses.map(c=>c.id),programIds:[1,2,3,4]}));
 app.use('/api/syllabi',require('../../server/routes/syllabusContent'));app.use('/api',require('../../server/routes/compliance'));app.use('/api/syllabus-check',require('../../server/routes/syllabusCheck'));
 app.use((error,req,res,next)=>res.status(error.status||500).json({error:error.message,...error.body}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.on('listening',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 const state={pool,db,app,origin,courses,contents,sql,repo,identity,database,semanticRequests:()=>semanticRequests,close:async()=>{
  const [after]=await pool.query('SELECT * FROM syllabi WHERE syllabus_id=9001');assert.deepEqual(after,sentinel);svc.checkHybrid=originalCheck;svc.resetInstalledCache();await new Promise(resolve=>server.close(resolve));await pool.end();
  fs.writeFileSync(path.join(root,'docs/lcup-comprehensive-verification/sql-integration-evidence.json'),JSON.stringify({identity,database,tables,productionDatabaseUsed:false,migrationsRun:0,syntheticSentinelUnchanged:true,mockedProviderRequests:semanticRequests,sqlStatements:sql.map(s=>s.split(/\s+/).slice(0,5).join(' ')),paidRequests:0,scope:'Real local HTTP/routes/shared service/SQL persistence; simulated DOM and provider only'},null,2)+'\n');
 }};return state;
}
module.exports={start};
