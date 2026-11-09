'use strict';
// READ-ONLY development references + synthetic academic content/scripted model.
// Never stores a report, edits a syllabus, or calls an external provider.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const mysql=require('../../server/node_modules/mysql2/promise');
const safety=require('./development-safety.cjs'),migration=require('../../server/db/official-po-migration.cjs');
const {findProgram,loadResolvedProgram}=require('../../server/lib/programs');
const {mastersFor}=require('../../server/lib/syllabuscheck/repository');
const official=require('../../src/data/officialProgramOutcomes.json');
const h=require('../../server/lib/syllabuscheck/vpaa-conformance/harness');
let connection,db;const evidence=[],fixtures=[];
test.before(async()=>{
 connection=await mysql.createConnection(safety.config());safety.assertDevelopment(await safety.identityOf(connection));
 await connection.query('START TRANSACTION READ ONLY');
 db={query:(sql,args)=>{if(!/^\s*(SELECT|SHOW)\b/i.test(sql))throw Error('STOP: integration tests forbid development DB writes');return connection.query(sql,args);}};
 assert.equal((await migration.verify(db)).active,true);
});
for(const code of migration.CODES)test(code+' uses the active corrected master in Builder and comprehensive/legacy checking',async t=>{
 h.liveGuard(t);const p=await loadResolvedProgram(db,await findProgram(db,code)),canonical=code==='BSIT-CYBERSECURITY'?'BSIT':code;
 assert.deepEqual(p.pos.map(p=>[p.no,p.text]),official.programs[canonical].outcomes.map(p=>[p.no,p.text]));
 const preliminary=await mastersFor(db,{meta:{program:code}}),curriculum=preliminary.curricula[0];assert.ok(curriculum?.courses.length);
 const c=curriculum.courses[0],{content}=h.sample();
 content.meta={...content.meta,program:code,courseId:null,code:c.code,title:c.title,prereq:c.prereq,lecture:String(c.lecture),lab:String(c.lab),yearLevel:String(c.yearLevel),curriculumYear:curriculum.curriculumYear};
 content.outcomes={...preliminary.institution,egas:p.egas,pos:p.pos,poReference:p.poReference};
 const masters=await mastersFor(db,content);assert.equal(masters.curricula.length,1);
 const engine=require('../../server/lib/syllabuscheck/engine'),coded=engine.coded(content,masters);
 assert.equal(coded.critical,false);assert.equal(coded.checks.find(c=>c.ruleId==='PO-EXACT').status,'PASS');assert.ok(coded.checks.filter(c=>c.ruleId==='CLO-MAP').every(c=>c.status==='PASS'));
 const standard=require('../../server/lib/compliance/standard-v4.json'),catalog={institution:masters.institution,program:{egas:p.egas,pos:p.pos}};
 const deterministic=require('../../server/lib/compliance/rules').evaluate({...content,catalog},{...standard,rules:standard.rules.filter(r=>['T-12','P-01','P-02'].includes(r.id))},{catalog,year:2026});assert.equal(deterministic.findings.length,0);
 if(canonical==='BSIT'){const bad=structuredClone(content);bad.clos[0].pos=[10];assert.ok(engine.coded(bad,masters).findings.some(f=>['CLO-MAP','P-02'].includes(f.ruleId)));assert.deepEqual(bad.clos[0].pos,[10]);}
 const svc=require('../../server/lib/compliance/service'),transport=h.scriptedTransport();
 const comprehensive=await svc.checkHybrid(db,content,{env:h.envFor({SYLLABUS_CHECK_PROFILE:'comprehensive-testing'}),transport,linkChecker:async url=>({url,status:'ok',httpStatus:200})});
 const legacy=await svc.checkHybrid(db,content,{env:h.envFor({SYLLABUS_CHECK_ACADEMIC_V2:'off'}),transport:h.scriptedTransport(),linkChecker:async url=>({url,status:'ok',httpStatus:200})});
 assert.equal(comprehensive.passThreshold,79);assert.ok(Number.isFinite(comprehensive.overall));assert.equal(comprehensive.overall,legacy.overall);assert.deepEqual(comprehensive.hybrid.deductions,legacy.hybrid.deductions);
 assert.equal(comprehensive.hybrid.semanticCoverage.evaluated,7);assert.equal(comprehensive.hybrid.academicV2.academic.references.poUsable,true);
 assert.equal(comprehensive.hybrid.ruleCoverage.rules.find(r=>r.ruleId==='P-03').verified,false);
 const pairs=transport.pairs().filter(p=>p.type==='CLO-PO');assert.ok(pairs.length);for(const pair of pairs){const no=Number(/-po(\d+)$/.exec(pair.id)[1]);assert.equal(pair.source,p.pos.find(o=>o.no===no).text);}
 const any=transport.pairs().find(p=>p.type==='CLO-anyPO');assert.ok(any);for(const po of p.pos)assert.ok(any.source.includes(po.text));
 const context=comprehensive.hybrid.referenceContext;assert.equal(context.po.source,canonical);assert.equal(context.po.reference.institutionalApproval,'not_recorded');assert.equal(context.curriculum.source,code);
 const serialized=JSON.parse(JSON.stringify(comprehensive));assert.deepEqual(serialized.hybrid.referenceContext,context);
 const unavailable=await svc.checkHybrid(db,content,{env:h.envFor({SYLLABUS_CHECK_PROFILE:'comprehensive-testing'}),useAi:false,linkChecker:async url=>({url,status:'ok',httpStatus:200})});
 assert.equal(unavailable.hybrid.semanticCoverage.evaluated,0,'Disabled model cannot become verified semantic alignment');
 evidence.push({code,count:p.pos.length,referenceId:p.poReference.id,poSource:context.po.source,curriculumSource:context.curriculum.source,legacyScore:legacy.overall,comprehensiveScore:comprehensive.overall,passThreshold:79,sevenVpaaRelationshipsEvaluated:7,providerDisabledVerifiedRelationships:0,scriptedRequests:transport.sent.length,liveModelCalls:0,reportSerialization:'verified; no report written to development'});
 const {applyCourse}=await import('../../src/lib/syllabusModel.js');
 const course={id:900000+p.id,code:c.code,title:c.title,program:{id:p.id,code,name:p.name},clos:content.clos,standards:content.outcomes};
 const selected=applyCourse({...structuredClone(content),meta:{...content.meta,courseId:null}},course);assert.deepEqual(selected.outcomes.pos,p.pos);assert.equal(selected.outcomes.poReference.id,p.poReference.id);
 fixtures.push({code,name:p.name,content,course,report:comprehensive});
});
test('existing read routes return the same corrected references for faculty and administrator views',async()=>{
 const express=require('../../server/node_modules/express'),app=express();
 // Synthetic authentication fixture only. All academic reference queries still
 // reach the real read-only development connection. No real account is used.
 app.locals.db={query:(sql,args)=>sql.startsWith('SELECT user_id FROM users WHERE user_id = ?')&&args[0]===0?Promise.resolve([[{user_id:0}]]):db.query(sql,args)};
 app.use((req,res,next)=>{req.session={user:{id:0,role:req.headers['x-local-role']==='faculty'?'faculty':'admin'},destroy:cb=>cb()};next();});app.use('/programs',require('../../server/routes/programs'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
 try{const base='http://127.0.0.1:'+server.address().port+'/programs';const list=await(await fetch(base)).json();
  for(const code of migration.CODES){const expected=code.startsWith('BSIT')?9:13,item=list.find(p=>p.code===code);assert.equal(item.outcomeCount,expected);
   for(const role of ['admin','faculty']){const response=await fetch(base+'/'+item.id+'/outcomes',{headers:{'x-local-role':role}});assert.equal(response.status,200);const body=await response.json();assert.equal(body.pos.length,expected);assert.equal(body.poReference.version,official.version);}
  }
 }finally{await new Promise(r=>server.close(r));}
});
test('all eight unresolved historical reviews remain protected and every original protected hash is unchanged',async()=>{
 const report=await require('./development-activate.cjs').verifyState(db,require('./development-restore.cjs').context());
 assert.equal(report.reviewQueue.length,8);assert.equal(report.unchangedOriginalTables.length,46);
});
test.after(async()=>{
 if(connection){await connection.rollback();await connection.end();}
 fs.writeFileSync(path.join(safety.OUT,'integration-results.json'),JSON.stringify({kind:'read-only development DB references with synthetic content and scripted model; no real syllabi or reports modified',programs:evidence,developmentDataWrites:0,liveModelCalls:0,formalInstitutionalApproval:'not_recorded'},null,2));
 fs.writeFileSync(path.join(safety.OUT,'browser-fixtures.json'),JSON.stringify(fixtures));
});
