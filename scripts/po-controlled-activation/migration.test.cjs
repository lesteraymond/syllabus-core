'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const mysql=require('../../server/node_modules/mysql2/promise');
const migration=require('../../server/db/official-po-migration.cjs');
const official=require('../../src/data/officialProgramOutcomes.json');
const {loadResolvedProgram,findProgram}=require('../../server/lib/programs');
const {loadCourse}=require('../../server/lib/courses');
const {mastersFor,readReport}=require('../../server/lib/syllabuscheck/repository');
const {requireMutable}=require('../../server/lib/programPoReferences');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/po-controlled-activation');
const old=JSON.parse(fs.readFileSync(path.join(root,'docs/lcup-evaluation-readiness/current-pos.json'),'utf8'));
const ref=code=>official.programs[code==='BSIT-CYBERSECURITY'?'BSIT':code];
const scope={programIds:[1,2,3,4]};
let db,plan,backupFile,original,reportHash;const evidence=[],browserFixtures=[];
test.before(async()=>{
 const config={host:'127.0.0.1',port:43308,user:'root',password:'lcup-po-isolated-only',dateStrings:true};
 db=await mysql.createConnection(config);
 const [[identity]]=await db.query('SELECT @@datadir AS datadir,@@port AS port');
 assert.equal(identity.datadir.replaceAll('\\','/').replace(/\/$/,'').toLowerCase(),path.join(root,'tmp/lcup-po-correction-db/data').replaceAll('\\','/').toLowerCase());assert.equal(identity.port,43308);
 const database=`lcupo_test_${process.pid}`;await db.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4`);await db.changeUser({database});
 fs.writeFileSync(path.join(out,'disposable-config.json'),JSON.stringify({...config,database},null,2)+'\n');
 const schema=fs.readFileSync(path.join(root,'server/db/schema.sql'),'utf8');
 for(const m of schema.matchAll(/CREATE TABLE IF NOT EXISTS \w+\s*\([\s\S]*?\);/g))await db.query(m[0]);
 for(const ddl of require('../../server/db/syllabuscheck-ddl'))await db.query(ddl);
 await db.query('ALTER TABLE programs ADD COLUMN academic_year VARCHAR(9) NULL');
 await db.query('ALTER TABLE programs DROP INDEX code, ADD UNIQUE KEY programs_year_code(academic_year,code)');
 await db.query('CREATE TABLE IF NOT EXISTS academic_years(label VARCHAR(9) PRIMARY KEY,start_year INT NOT NULL,is_current TINYINT NOT NULL DEFAULT 0)');
 const [yearColumns]=await db.query("SHOW COLUMNS FROM academic_years LIKE 'is_current'");if(!yearColumns.length)await db.query('ALTER TABLE academic_years ADD COLUMN is_current TINYINT NOT NULL DEFAULT 0');
 await db.query("INSERT INTO academic_years(label,start_year,is_current) VALUES('2026-2027',2026,1)");
 await db.query("INSERT INTO users(user_id,email,password_hash,first_name,last_name) VALUES(5,'isolated@invalid.example','test','Isolated','Tester')");
 const seed=(await import('../../src/data/outcomesSeed.js')).INSTITUTION;
 await db.query('INSERT INTO institution_settings(setting_id,vision,mission_lead,mission_items) VALUES(1,?,?,?)',[seed.vision,seed.mission.lead,JSON.stringify(seed.mission.items)]);
 for(const ega of seed.egas)await db.query('INSERT INTO institution_egas(ega_no,name,short_name) VALUES(?,?,?)',[ega.no,ega.name,ega.short]);
 for(const [index,code] of migration.CODES.entries()){
  const id=index+1,p=old.programs[code];
  await db.query('INSERT INTO programs(program_id,code,name,pos_version) VALUES(?,?,?,?)',[id,code,code,p.versions.pos]);
  for(const po of p.ownPos)await db.query('INSERT INTO program_outcomes(program_id,po_no,short_name,outcome_text,ega_nos) VALUES(?,?,?,?,?)',[id,po.no,po.short,po.text,po.egas.join(',')]);
  for(const ega of seed.egas)await db.query('INSERT INTO program_egas(program_id,ega_no,name,short_name) VALUES(?,?,?,?)',[id,ega.no,ega.name,ega.short]);
  const standards={...seed,pos:p.ownPos,versions:{vision:1,egas:1,pos:p.versions.pos}};
  await db.query('INSERT INTO courses(course_id,code,title,program_id,standards_json) VALUES(?,?,?,?,?)',[10+index,`TEST-${index}`,`Isolated ${code}`,id,JSON.stringify(standards)]);
  const content={meta:{program:code,courseId:10+index},outcomes:{...seed,pos:p.ownPos},clos:[{id:`legacy_${index}`,pos:[1],egas:[1],title:'Legacy',statement:'Synthetic historical CLO',level:'Introductory'}],plan:[]};
  await db.query("INSERT INTO syllabi(syllabus_id,user_id,course_id,status,content) VALUES(?,5,?,'draft',?)",[id,10+index,JSON.stringify(content)]);
  await db.query("INSERT INTO syllabus_versions(syllabus_id,version_label,status_at_save,content,created_by) VALUES(?,'v1.0','approved',?,5)",[id,JSON.stringify(content)]);
  const [run]=await db.query("INSERT INTO ai_check_runs(syllabus_id,content_hash,standard_version,status,created_by) VALUES(?,'unchanged','historical','completed',5)",[id]);
  await db.query('INSERT INTO syllabus_check_reports(run_id,reference_hash,report_json) VALUES(?,?,?)',[run.insertId,'historical',JSON.stringify({historical:true,hybrid:{version:'hybrid-2'},findings:[]})]);
 }
 await db.query("INSERT INTO course_clos(course_id,sort_order,title,clo_level,statement,po_nos,ega_nos) VALUES(10,0,'Legacy catalog CLO','Introductory','Synthetic legacy','1','1')");
 await db.query("INSERT INTO programs(program_id,code,name,academic_year) VALUES(9000,'LEGACY-ARCHIVE','Untargeted legacy sentinel','2020-2021'),(9001,'BSIT','Historical BSIT catalog','2021-2022')");
 await db.query("INSERT INTO program_outcomes(program_id,po_no,short_name,outcome_text) VALUES(9000,1,'Legacy','Preserve unrelated data'),(9001,1,'Historical','Preserve historical program configuration')");
 const cyber={program:'BSIT-CYBERSECURITY',curriculumYear:'synthetic-old',source:'Synthetic historical curriculum',courses:[{code:'CS-OLD',title:'Historical synthetic course',prereq:'None',lecture:2,lab:1,yearLevel:2}]}; await db.query('INSERT INTO syllabus_check_curricula(program_code,curriculum_year,status,source,courses_json) VALUES(?,?,?,?,?)',['BSIT','synthetic-current','approved','Synthetic BSIT curriculum for isolated software tests',JSON.stringify([{code:'IT 204',title:'Computer Programming 2',prereq:'IT 101',lecture:2,lab:1,yearLevel:2}])]);
 for(const code of ['BSIE','BSCPE'])await db.query('INSERT INTO syllabus_check_curricula(program_code,curriculum_year,status,source,courses_json) VALUES(?,?,?,?,?)',[code,'synthetic-current','approved','Synthetic software test curriculum',JSON.stringify([{code:'IT 204',title:'Computer Programming 2',prereq:'IT 101',lecture:2,lab:1,yearLevel:2}])]);
 await db.query('INSERT INTO syllabus_check_curricula(program_code,curriculum_year,status,source,courses_json) VALUES(?,?,?,?,?)',[cyber.program,cyber.curriculumYear,'approved',cyber.source,JSON.stringify(cyber.courses)]);
 original=await migration.snapshot(db,scope);plan=await migration.plan(db,scope);backupFile=path.join(out,`test-backup-${process.pid}.json`);migration.writeBackup(backupFile,plan);
 reportHash=original.protectedHashes.syllabus_check_reports.sha256;
 fs.writeFileSync(path.join(out,'disposable-identity.json'),JSON.stringify({identity,database,productionConfigurationUsed:false},null,2)+'\n');
});
const options=()=>({backupFile,expectedBeforeHash:plan.beforeSha256,maintenanceConfirmed:true});
test('backup and source preconditions refuse missing maintenance/hash without changing data',async()=>{
 await assert.rejects(()=>migration.apply(db,{...options(),maintenanceConfirmed:false}),/maintenance/);
 await assert.rejects(()=>migration.apply(db,{...options(),expectedBeforeHash:'wrong'}),/mismatch/);
 assert.equal(migration.hash(await migration.snapshot(db,scope)),migration.hash(original));
});
test('migration is atomic, versioned, exact and idempotent; protected historical rows remain unchanged',async()=>{
 const failing={query:async(sql,args)=>{if(sql.startsWith('INSERT INTO program_outcomes(')&&args[1]===2)throw Error('injected transaction failure');return db.query(sql,args);},beginTransaction:()=>db.beginTransaction(),commit:()=>db.commit(),rollback:()=>db.rollback()};
 await assert.rejects(()=>migration.apply(failing,options()),/injected/);
 assert.deepEqual(await migration.snapshot(db,scope),original,'All DML rolled back on an injected mid-migration failure');
 const result=await migration.apply(db,options());assert.equal(result.applied,true);assert.equal(result.remediationItems,5);
 assert.deepEqual((await migration.snapshot(db,scope)).protectedHashes,original.protectedHashes);
 assert.equal((await migration.apply(db,options())).alreadyApplied,true);
 const [refs]=await db.query('SELECT * FROM program_po_reference_versions ORDER BY reference_id');assert.equal(refs.length,3);
 const [child]=await db.query('SELECT * FROM program_outcomes WHERE program_id=2');assert.equal(child.length,0,'Cyber stores no competing copy');
});
test('all four program APIs and checker sources resolve 9/9/13/13 with exact source wording',async()=>{
 for(const code of migration.CODES){const program=await loadResolvedProgram(db,await findProgram(db,code));assert.equal(program.pos.length,code.startsWith('BSIT')?9:13);
  assert.deepEqual(program.pos.map(p=>[p.no,p.text]),ref(code).outcomes.map(p=>[p.no,p.text]));assert.ok(program.poReference.id);
  const content={meta:{program:code},outcomes:{pos:ref(code).outcomes},clos:[{pos:[1]}]};const masters=await mastersFor(db,content);
  assert.deepEqual(masters.pos,program.pos);assert.equal(masters.poReference.id,program.poReference.id);
  evidence.push({code,count:program.pos.length,referenceId:program.poReference.id,inheritedFrom:program.inheritedFrom||null});
 }
 const cyber=await mastersFor(db,{meta:{program:'BSIT-CYBERSECURITY'}});assert.equal(cyber.outcomeSource,'BSIT');assert.ok(cyber.curricula.length>0);assert.ok(cyber.curricula.every(c=>c.program==='BSIT-CYBERSECURITY'));assert.equal(cyber.referenceContext.curriculum.source,'BSIT-CYBERSECURITY');
});
test('builder subject standards resolve corrected POs without rewriting stored standards or catalog mappings',async()=>{
 for(const [id,code] of [[11,'BSIT-CYBERSECURITY'],[12,'BSIE'],[13,'BSCPE']]){
  const course=await loadCourse(db,id);assert.deepEqual(course.standards.pos.map(p=>p.text),ref(code).outcomes.map(p=>p.text));assert.ok(course.standards.poReference);
 }
 await assert.rejects(()=>loadCourse(db,10),e=>e.body?.code==='catalog_po_reference_review_required');
 assert.deepEqual((await migration.snapshot(db,scope)).protectedHashes,original.protectedHashes);
});
test('HTTP program list/details expose inherited count and canonical reference; immutable PO edits are refused',async()=>{
 const express=require('../../server/node_modules/express'),app=express();app.use(express.json());
 app.locals.db={query:(...args)=>db.query(...args),getConnection:async()=>({query:(...args)=>db.query(...args),beginTransaction:()=>db.beginTransaction(),commit:()=>db.commit(),rollback:()=>db.rollback(),release(){}})};
 app.use((req,res,next)=>{req.session={user:{id:5,role:'admin'}};next();});app.use('/programs',require('../../server/routes/programs'));app.use('/courses',require('../../server/routes/courses'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));const base=`http://127.0.0.1:${server.address().port}/programs`;
 try{
  const list=await(await fetch(base)).json();assert.deepEqual(list.filter(p=>migration.CODES.includes(p.code)&&p.id<9000).map(p=>[p.code,p.outcomeCount]).sort(),[['BSIT',9],['BSIT-CYBERSECURITY',9],['BSIE',13],['BSCPE',13]].sort());
  for(const code of migration.CODES){const id=list.find(p=>p.code===code).id;const response=await fetch(`${base}/${id}/outcomes`);assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body.pos.map(p=>p.text),ref(code).outcomes.map(p=>p.text));}
  const response=await fetch(`${base}/1/outcomes`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({pos:ref('BSIT').outcomes,version:1})});assert.equal(response.status,409);assert.equal((await response.json()).code,'po_reference_versioned');
  const subjectResponse=await fetch(`${base.replace('/programs','/courses')}/10/standards`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({section:'pos',value:ref('BSIT').outcomes,version:1})});assert.equal(subjectResponse.status,409);assert.equal((await subjectResponse.json()).code,'po_reference_versioned');
 }finally{await new Promise(r=>server.close(r));}
});
test('historical mapping guard survives a text-only replacement; old reports remain readable and unchanged',async()=>{
 for(let id=1;id<=4;id++){
  const [[row]]=await db.query('SELECT content FROM syllabi WHERE syllabus_id=?',[id]);const content=JSON.parse(row.content);
  await assert.rejects(()=>mastersFor(db,content,{syllabusId:id}),e=>e.body?.code==='po_mapping_remediation_required');
  content.outcomes.pos=ref(content.meta.program).outcomes;
  await assert.rejects(()=>mastersFor(db,content,{syllabusId:id}),e=>e.body?.code==='po_mapping_remediation_required');
 }
 const [[report]]=await db.query('SELECT run_id FROM syllabus_check_reports ORDER BY run_id LIMIT 1');assert.equal((await readReport(db,report.run_id)).historical,true);
 assert.equal((await migration.snapshot(db,scope)).protectedHashes.syllabus_check_reports.sha256,reportHash);
 await assert.rejects(()=>requireMutable(db,1),e=>e.body?.code==='po_reference_versioned');
});
test('reference drift and unsafe rollback are refused without reinterpreting newer records',async()=>{
 await db.query("UPDATE program_outcomes SET outcome_text='synthetic drift' WHERE program_id=1 AND po_no=1");
 await assert.rejects(async()=>loadResolvedProgram(db,await findProgram(db,'BSIT')),e=>e.body?.code==='po_reference_drift');
 await assert.rejects(()=>migration.rollback(db,options()),/changed/);
 await db.query('UPDATE program_outcomes SET outcome_text=? WHERE program_id=1 AND po_no=1',[ref('BSIT').outcomes[0].text]);
 await db.query("INSERT INTO syllabi(syllabus_id,user_id,status,content) VALUES(999,5,'draft','{\"syntheticNew\":true}')");
 await assert.rejects(()=>migration.rollback(db,options()),/changed/);
 await db.query('DELETE FROM syllabi WHERE syllabus_id=999'); // only this test-created disposable row
});
test('explicit target IDs preserve non-target catalogs; dry-run and verification are read-only',async()=>{
 await assert.rejects(()=>migration.plan(db),/Exactly the four/);
 const state=await migration.verify(db);assert.equal(state.active,true);assert.deepEqual(state.targets.map(p=>p.id),scope.programIds);
 const cli=require('./rollout.cjs');const cliState=await cli.main(['verify','--config',path.join(out,'disposable-config.json'),'--program-ids','1,2,3,4']);assert.equal(cliState.active,true);assert.ok(cliState.databaseIdentityHash);
 await assert.rejects(()=>cli.main(['apply','--config',path.join(out,'disposable-config.json'),'--program-ids','1,2,3,4','--backup',backupFile,'--expected',plan.beforeSha256,'--maintenance','--authorization',path.join(out,'authorization.example.json')]),/authorization/);
 const [[legacy]]=await db.query('SELECT outcome_text FROM program_outcomes WHERE program_id=9000');assert.equal(legacy.outcome_text,'Preserve unrelated data');
 const [[historical]]=await db.query('SELECT outcome_text FROM program_outcomes WHERE program_id=9001');assert.equal(historical.outcome_text,'Preserve historical program configuration');
 await assert.rejects(()=>migration.snapshot(db,{programIds:[1,2,3,9000]}),/Exactly the four/);
 await assert.rejects(()=>migration.snapshot(db,{programIds:[9001,2,3,4]}),/same academic-year/);
});
test('all four selections share corrected PO context across legacy, V2, comprehensive checks and saved reports',async t=>{
 const h=require('../../server/lib/syllabuscheck/vpaa-conformance/harness');h.liveGuard(t);
 const svc=require('../../server/lib/compliance/service'),engine=require('../../server/lib/syllabuscheck/engine');
 const compliance=require('../../server/lib/compliance/rules'),standard=require('../../server/lib/compliance/standard-v4.json');
 for(const [i,code]of migration.CODES.entries()){
  const {content}=h.sample();const p=await loadResolvedProgram(db,await findProgram(db,i+1));
  content.meta={...content.meta,program:code,courseId:10+i,curriculumYear:'synthetic-current',prereq:'IT 101'};
  const institution=await require('../../server/lib/institution').loadOutcomes(db);content.outcomes={vision:institution.vision,mission:institution.mission,egas:p.egas,pos:p.pos};
  const masters=await mastersFor(db,content);assert.deepEqual(masters.pos,p.pos);assert.ok(masters.curricula.length===1);
  const checks=engine.coded(content,masters).checks;assert.equal(checks.find(c=>c.ruleId==='PO-EXACT').status,'PASS');assert.ok(checks.filter(c=>c.ruleId==='CLO-MAP').every(c=>c.status==='PASS'));
  const catalog={institution,program:{egas:p.egas,pos:p.pos}};
  const withSnapshot={...content,catalog};const only=standard.rules.filter(r=>['T-12','P-01','P-02','P-03'].includes(r.id));
  assert.equal(compliance.evaluate(withSnapshot,{...standard,rules:only},{catalog,year:2026}).findings.length,0);
  if(code.startsWith('BSIT')){const bad=structuredClone(content);bad.clos[0].pos=[10];assert.ok(engine.coded(bad,masters).findings.some(f=>['CLO-MAP','P-02'].includes(f.ruleId)));assert.equal(bad.clos[0].pos[0],10);}
  const transport=h.scriptedTransport();const comp=await svc.checkHybrid(db,content,{env:h.envFor({SYLLABUS_CHECK_PROFILE:'comprehensive-testing'}),transport,linkChecker:async url=>({url,status:'ok',httpStatus:200})});
  const legacy=await svc.checkHybrid(db,content,{env:h.envFor({SYLLABUS_CHECK_ACADEMIC_V2:'off'}),transport:h.scriptedTransport(),linkChecker:async url=>({url,status:'ok',httpStatus:200})});
  assert.equal(comp.passThreshold,79);assert.equal(comp.overall,100,'The aligned synthetic course must earn a numeric official score, not a vacuous null comparison');assert.equal(comp.overall,legacy.overall);assert.deepEqual(comp.hybrid.deductions,legacy.hybrid.deductions);
  assert.equal(comp.hybrid.semanticCoverage.evaluated,7);assert.equal(comp.hybrid.academicV2.academic.references.poUsable,true);
  assert.equal(comp.hybrid.ruleCoverage.rules.find(r=>r.ruleId==='P-03').verified,false,'Missing approved crosswalks never become verified mapping consistency');
  const basis=comp.hybrid.referenceContext;assert.equal(basis.po.reference.version,official.version);assert.equal(basis.po.reference.institutionalApproval,'not_recorded');assert.equal(basis.curriculum.source,code);
  const poPairs=transport.pairs().filter(p=>p.type==='CLO-PO');assert.ok(poPairs.length>0);for(const pair of poPairs){const no=Number(/-po(\d+)$/.exec(pair.id)[1]);assert.equal(pair.source,ref(code).outcomes.find(o=>o.no===no).text);}
  const any=transport.pairs().filter(p=>p.type==='CLO-anyPO');assert.ok(any.length);for(const o of ref(code).outcomes)assert.ok(any[0].source.includes(o.text));
  await db.beginTransaction();try{const id=await svc.storeRun(db,{syllabusId:i+1,content,result:comp,createdBy:5});const stored=await readReport(db,id);assert.deepEqual(stored.hybrid.referenceContext,basis);}finally{await db.rollback();}
  evidence.push({code,legacyScore:legacy.overall,comprehensiveScore:comp.overall,sevenVPAA:comp.hybrid.semanticCoverage.evaluated,poSource:basis.po.source,curriculumSource:basis.curriculum.source,scriptedRequests:transport.sent.length,liveModelCalls:0});
  browserFixtures.push({code,name:p.name,content,course:{id:10+i,code:content.meta.code,title:content.meta.title,program:{id:i+1,code,name:p.name},clos:content.clos,standards:{...content.outcomes,poReference:p.poReference}},report:comp});
 }
});
test('rollback restores legacy reference rows/versions and removes inheritance while preserving immutable audit history',async()=>{
 assert.equal((await migration.rollback(db,options())).rolledBack,true);
 assert.deepEqual(await migration.snapshot(db,scope),original);
 assert.equal((await migration.rollback(db,options())).alreadyRolledBack,true);
 const [refs]=await db.query('SELECT * FROM program_po_reference_versions');assert.equal(refs.length,3,'Approved source versions retained, inactive');
 const [queue]=await db.query('SELECT status FROM program_po_reference_remediation');assert.ok(queue.every(r=>r.status==='rolled_back'));
});
test.after(async()=>{fs.writeFileSync(path.join(out,'migration-results.json'),JSON.stringify({programs:evidence,protectedHashes:original?.protectedHashes,backupFile:backupFile&&path.relative(root,backupFile),productionWrites:0,paidAiCalls:0},null,2)+'\n');fs.writeFileSync(path.join(out,'browser-fixtures.json'),JSON.stringify(browserFixtures));if(db)await db.end();});
