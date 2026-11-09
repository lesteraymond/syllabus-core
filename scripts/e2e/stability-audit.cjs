'use strict';
// Development is strictly READ ONLY. Never printed/copied faculty content.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const mysql=require('../../server/node_modules/mysql2/promise');
const safety=require('../po-controlled-activation/development-safety.cjs');
const {findProgram,loadResolvedProgram}=require('../../server/lib/programs');
const {mastersFor}=require('../../server/lib/syllabuscheck/repository');
const official=require('../../src/data/officialProgramOutcomes.json');
const OUT=path.resolve(__dirname,'../../docs/e2e-stability-2026-11-05');
(async()=>{const db=await mysql.createConnection(safety.config());try{
 const target=safety.assertDevelopment(await safety.identityOf(db));await db.query('START TRANSACTION READ ONLY');
 const programs=[];for(const code of ['BSIT','BSIE','BSCPE','BSIT-CYBERSECURITY']){const p=await loadResolvedProgram(db,await findProgram(db,code)),source=code==='BSIT-CYBERSECURITY'?'BSIT':code;assert.deepEqual(p.pos.map(o=>[o.no,o.text]),official.programs[source].outcomes.map(o=>[o.no,o.text]));const m=await mastersFor(db,{meta:{program:code}});if(code==='BSIT-CYBERSECURITY'){assert.equal(p.inheritedFrom.code,'BSIT');assert.ok(m.curricula.every(c=>c.program==='BSIT-CYBERSECURITY'));assert.deepEqual(m.referenceContext.curriculum.referenceIds,m.curricula.map(c=>c.id));}programs.push({program:code,count:p.pos.length,source,version:p.poReference.version,approval:p.poReference.institutionalApproval,curriculumIds:m.curricula.map(c=>c.id)});}
 const [reviews]=await db.query('SELECT entity_id,status,details_json FROM program_po_reference_remediation ORDER BY entity_id');assert.deepEqual(reviews.map(r=>r.entity_id),[43,93,97,99,100,101,102,110]);for(const row of reviews){assert.equal(row.status,'needs_review');const d=JSON.parse(row.details_json);if(d.contentSha256){const [[s]]=await db.query('SELECT content FROM syllabi WHERE syllabus_id=?',[row.entity_id]);assert.equal(safety.sha(s.content),d.contentSha256);}}
 const inventory=await safety.inventory(db),env=require('../../server/node_modules/dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../../server/.env')));
 const result={checkedAt:new Date().toISOString(),target:{host:target.configuredHost,port:target.configuredPort,database:target.configuredName,identityHash:target.databaseIdentityHash},programs,reviews:reviews.map(r=>({id:r.entity_id,status:r.status})),readOnly:true,tables:inventory.tables.map(({ddl,...r})=>r),configuration:{policyV2:env.SYLLABUS_CHECK_ACADEMIC_V2||'unset/off',profile:env.SYLLABUS_CHECK_PROFILE||'unset',envSha256:safety.sha(fs.readFileSync(path.resolve(__dirname,'../../server/.env')))}};
 fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'development-'+(process.argv[2]||'before')+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({programs,reviews:reviews.length,readOnly:true,policyV2:result.configuration.policyV2}));
 }finally{await db.rollback();await db.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
