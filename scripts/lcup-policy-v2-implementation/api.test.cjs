'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const express=require('../../server/node_modules/express');
const repo=require('../../server/lib/syllabuscheck/repository');
const service=require('../../server/lib/compliance/service');
const {run}=require('../../server/lib/syllabuscheck/engine');
const {fixture,replay,POLICY}=require('./fixtures.cjs');
const priorFetch=globalThis.fetch;
async function withServer(t,{enabled=false,user=5}={},fn){
 const f=fixture();f.masters.fingerprint='synthetic-master-context';const data=replay(f.content,f.masters);const queries=[];
 const app=express();app.use(express.json());app.locals.db={query:async(sql,args)=>{queries.push(sql);if(sql==='SELECT user_id FROM users WHERE user_id = ?')return [[{user_id:user}]];if(sql==='SELECT * FROM syllabi WHERE syllabus_id = ?')return [[{syllabus_id:1,user_id:5,status:'draft',content:JSON.stringify(f.content)}]];throw Error('Unexpected SQL in readonly preview: '+sql);}};
 t.mock.method(repo,'mastersFor',async()=>f.masters);
 t.mock.method(repo,'reusableJudgements',async()=>{throw Error('V2 must not reuse legacy academic judgments');});
 t.mock.method(repo,'correctionHistory',async()=>{throw Error('V2 must not reinterpret legacy correction history');});
 if(enabled)app.locals.academicV2OfflinePreviews=new Map([[1,data]]);
 app.use((req,res,next)=>{req.session={user:{id:user,role:'faculty'}};next();});app.use('/syllabus-check',require('../../server/routes/syllabusCheck'));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.on('listening',resolve));
 try{await fn({app,base:`http://127.0.0.1:${server.address().port}`,f,queries});}finally{await new Promise(resolve=>server.close(resolve));}
}
test('production preview route is inactive and cannot be enabled by request fields or stage names',t=>withServer(t,{},async({base,queries})=>{
 const response=await priorFetch(base+'/syllabus-check/syllabi/1/academic-v2-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({academicPolicy:POLICY.id,SYLLABUS_CHECK_STAGE_C3:'on',activate:true})});assert.equal(response.status,404);assert.deepEqual(queries,['SELECT user_id FROM users WHERE user_id = ?']);
}));
test('isolated Re-Check API → shared service → versioned JSON is readonly and preserves dual axes',t=>withServer(t,{enabled:true},async({base,queries})=>{
 const response=await priorFetch(base+'/syllabus-check/syllabi/1/academic-v2-preview',{method:'POST'});assert.equal(response.status,200);const report=await response.json();assert.equal(report.evaluationPolicy.id,POLICY.id);assert.equal(report.compliance.score,100);assert.equal(report.academic.disposition,'SUPPORTED_BY_SUPPLIED_EVIDENCE');assert.equal(report.score,null);assert.ok(queries.every(q=>q.startsWith('SELECT')));
 const reloaded=await repo.readReport({query:async()=>[[{reference_hash:report.referenceHash,report_json:JSON.stringify(report)}]]},1);assert.deepEqual(reloaded.academic,report.academic);assert.equal(reloaded.hybrid.ready,false);
}));
test('preview preserves existing faculty visibility rules',t=>withServer(t,{enabled:true,user:9},async({base})=>{
 const response=await priorFetch(base+'/syllabus-check/syllabi/1/academic-v2-preview',{method:'POST'});assert.equal(response.status,404);
}));
test('a preview cannot satisfy the existing required-AI submission gate',async t=>{
 const f=fixture(),report=await run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:replay(f.content,f.masters)});
 const previous=process.env.SYLLABUS_CHECK_AI_GATE;process.env.SYLLABUS_CHECK_AI_GATE='required';t.after(()=>{if(previous===undefined)delete process.env.SYLLABUS_CHECK_AI_GATE;else process.env.SYLLABUS_CHECK_AI_GATE=previous;service.resetInstalledCache();});
 t.mock.method(repo,'mastersFor',async()=>f.masters);t.mock.method(repo,'readReport',async()=>report);service.resetInstalledCache();
 const db={query:async sql=>{if(sql.startsWith('SELECT 1 FROM ai_check_runs'))return [[]];if(sql.includes('FROM ai_check_runs'))return [[{run_id:7}]];throw Error('Unexpected gate SQL: '+sql);}};
 await assert.rejects(()=>service.requireHybrid(db,1,f.content),e=>e.body?.code==='alignment_required');
});
test('saved preview data cannot contaminate legacy reusable judgments or correction history',async()=>{
 const f=fixture(),report=await run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:replay(f.content,f.masters)});
 const db={query:async()=>[[{run_id:1,report_json:JSON.stringify(report)}]]};assert.equal((await repo.reusableJudgements(db,1)).size,0);assert.deepEqual(await repo.correctionHistory(db,1),{attempts:{},last:{},previous:{}});
});
