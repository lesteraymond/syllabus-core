'use strict';
// SELECT-only audit. It cannot activate references or invoke a model.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const env=require('../../server/node_modules/dotenv').parse(fs.readFileSync(path.join(root,'server/.env')));
const mysql=require('../../server/node_modules/mysql2/promise');
const migration=require('../../server/db/official-po-migration.cjs');
const official=require('../../src/data/officialProgramOutcomes.json');
const {findProgram,loadResolvedProgram}=require('../../server/lib/programs');
const {loadOutcomes}=require('../../server/lib/institution');
const {sameBasis}=require('../../server/lib/programPoReferences');
const sha=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stage=process.argv.includes('--after')?'after':'before';
(async()=>{
 const c=await mysql.createConnection({host:env.DB_HOST,user:env.DB_USER,password:env.DB_PASS,database:env.DB_NAME,dateStrings:true,connectTimeout:8000});
 try{
  await c.query('SET SESSION TRANSACTION READ ONLY');await c.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  const db={query:(sql,p)=>{if(!/^SELECT\b/i.test(sql))throw Error('SELECT-only audit');return c.query(sql,p);}};
  const targets=[];for(const code of migration.CODES)targets.push(await findProgram(db,code));
  const rows=[];for(const p of targets){const r=await loadResolvedProgram(db,p),expected=official.programs[p.code==='BSIT-CYBERSECURITY'?'BSIT':p.code];const [[stored]]=await db.query('SELECT COUNT(*) AS count FROM program_outcomes WHERE program_id=?',[p.program_id]);rows.push({id:p.program_id,program:p.code,poCount:r.pos.length,storedPoCount:Number(stored.count),matchesCorrected:sameBasis(r.pos,expected.outcomes),activeReference:r.poReference?.id||null,inheritedFrom:r.inheritedFrom?.code||null,currentPos:r.pos,expectedCount:expected.outcomes.length,changedNumbers:expected.outcomes.filter(o=>!r.pos.some(p=>p.no===o.no&&p.text===o.text)).map(o=>o.no)});}
  const protectedHashes={};for(const table of [...migration.protectedTables,'programs','program_outcomes','program_outcome_sources','program_po_reference_versions','program_po_reference_active']){try{const [r]=await db.query(`SELECT * FROM ${table}`);r.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));protectedHashes[table]={rows:r.length,sha256:sha(r)};}catch(e){if(e.code!=='ER_NO_SUCH_TABLE')throw e;protectedHashes[table]={absent:true};}}
  const [curricula]=await db.query('SELECT reference_id,program_code,curriculum_year,status,source,courses_json FROM syllabus_check_curricula ORDER BY reference_id');
  const impacts=await migration.impacts(db,{programs:targets});
  const report={capturedAt:new Date().toISOString(),stage,databaseWrites:0,paidAiCalls:0,activation:'NOT_ACTIVE_IN_EXISTING_DATABASE',targets:rows,institution:await loadOutcomes(db),curricula:curricula.filter(r=>migration.CODES.includes(r.program_code)).map(({courses_json,...r})=>({...r,courseCount:JSON.parse(courses_json).length,sha256:sha(JSON.parse(courses_json))})),impacts,protectedHashes};
  await c.rollback();
  const file=path.join(root,`docs/po-controlled-activation/live-${stage}.json`);fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
  if(stage==='after'){const before=JSON.parse(fs.readFileSync(path.join(root,'docs/po-controlled-activation/live-before.json'),'utf8'));report.existingDataUnchanged=sha(before.protectedHashes)===sha(protectedHashes);fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');if(!report.existingDataUnchanged)throw Error('Existing database changed; inspect before/after hashes without overwriting data');}
  console.log(JSON.stringify({stage,targets:rows.map(({currentPos,...r})=>r),impacts:impacts.map(({oldBasis,...i})=>i),existingDataUnchanged:report.existingDataUnchanged??null,databaseWrites:0}));
 }finally{await c.end();}
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
