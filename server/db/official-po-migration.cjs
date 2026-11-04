'use strict';
// No environment loading and no automatic execution. CLI transport is disposable-only.
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const official=require('../../src/data/officialProgramOutcomes.json');
const {sameBasis,hasPoMappings}=require('../lib/programPoReferences');
const ID=official.version, CODES=['BSIT','BSIT-CYBERSECURITY','BSIE','BSCPE'];
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const protectedTables=['syllabi','syllabus_versions','syllabus_check_reports','ai_check_runs','syllabus_check_decisions','syllabus_check_curricula','curriculum','courses','course_clos','program_egas','institution_egas','institution_settings'];
const DDL=[
  'CREATE TABLE IF NOT EXISTS program_outcome_sources (program_id INT PRIMARY KEY, source_program_id INT NOT NULL, specialization VARCHAR(120) NULL, FOREIGN KEY(program_id) REFERENCES programs(program_id) ON DELETE CASCADE, FOREIGN KEY(source_program_id) REFERENCES programs(program_id) ON DELETE RESTRICT)',
  'CREATE TABLE IF NOT EXISTS program_po_reference_versions (reference_id VARCHAR(100) PRIMARY KEY, program_id INT NOT NULL, version_label VARCHAR(80) NOT NULL, source_file VARCHAR(500) NOT NULL, source_sha256 CHAR(64) NOT NULL, outcomes_json LONGTEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(program_id) REFERENCES programs(program_id) ON DELETE RESTRICT, UNIQUE KEY program_version(program_id,version_label))',
  'CREATE TABLE IF NOT EXISTS program_po_reference_active (program_id INT PRIMARY KEY, reference_id VARCHAR(100) NOT NULL, FOREIGN KEY(program_id) REFERENCES programs(program_id) ON DELETE RESTRICT, FOREIGN KEY(reference_id) REFERENCES program_po_reference_versions(reference_id) ON DELETE RESTRICT)',
  'CREATE TABLE IF NOT EXISTS program_po_reference_migrations (migration_id VARCHAR(80) PRIMARY KEY, status VARCHAR(30) NOT NULL, backup_sha256 CHAR(64) NOT NULL, after_json LONGTEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
  'CREATE TABLE IF NOT EXISTS program_po_reference_remediation (migration_id VARCHAR(80) NOT NULL, entity_type VARCHAR(30) NOT NULL, entity_id INT NOT NULL, status VARCHAR(30) NOT NULL, details_json LONGTEXT NOT NULL, PRIMARY KEY(migration_id,entity_type,entity_id), FOREIGN KEY(migration_id) REFERENCES program_po_reference_migrations(migration_id) ON DELETE RESTRICT)',
];
const readJson=s=>{try{return s?JSON.parse(s):null;}catch{return null;}};
async function exists(db,table){const [rows]=await db.query('SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?',[table]);return !!rows.length;}
async function rowsIf(db,table){if(!await exists(db,table))return [];return (await db.query(`SELECT * FROM ${table}`))[0];}
const sorted=rows=>[...rows].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
async function snapshot(db){
  const [programs]=await db.query('SELECT * FROM programs WHERE code IN (?,?,?,?) ORDER BY program_id',CODES);
  if(programs.length!==4)throw Error('All four supported programs are required');
  const ids=programs.map(p=>p.program_id);
  const [pos]=await db.query('SELECT * FROM program_outcomes WHERE program_id IN (?,?,?,?) ORDER BY program_id,po_no',ids);
  const links=sorted(await rowsIf(db,'program_outcome_sources'));
  const active=sorted(await rowsIf(db,'program_po_reference_active'));
  const activeVersions=sorted((await rowsIf(db,'program_po_reference_versions')).filter(r=>active.some(a=>a.reference_id===r.reference_id)));
  const protectedHashes={};
  for(const table of protectedTables){const rows=sorted(await rowsIf(db,table));protectedHashes[table]={rows:rows.length,sha256:hash(rows)};}
  return {programs,pos,links,active,activeVersions,protectedHashes};
}
async function impacts(db,snap){
  const output=[];const ids=new Map(snap.programs.map(p=>[p.program_id,p.code]));
  const target=code=>official.programs[code==='BSIT-CYBERSECURITY'?'BSIT':code].outcomes;
  const courses=await rowsIf(db,'courses'), byCourse=new Map(courses.map(c=>[c.course_id,c]));
  for(const row of await rowsIf(db,'syllabi')){
    const content=readJson(row.content),course=byCourse.get(row.course_id),code=ids.get(course?.program_id)||content?.meta?.program;
    if(!CODES.includes(code)||!hasPoMappings(content))continue;
    const basis=content.outcomes?.pos||content.catalog?.program?.pos;
    if(!sameBasis(basis,target(code)))output.push({type:'syllabus',id:row.syllabus_id,program:code,status:row.status,contentSha256:hash(row.content||''),oldBasis:basis||null,cloMappings:(content.clos||[]).map(c=>({id:c.id,pos:c.pos||[]})),directIloPoMappings:(content.plan||[]).flatMap((row,rowIndex)=>(row.ilos||[]).flatMap((ilo,iloIndex)=>{const tags=(ilo.tags||[]).filter(tag=>/^po:\d+$/.test(tag));return tags.length?[{rowIndex,iloIndex,tags}]:[];})),proposedMappings:null,reason:'Faculty must compare meanings and explicitly confirm each new mapping; no automatic number crosswalk.'});
  }
  const clos=await rowsIf(db,'course_clos');
  for(const course of courses){const code=ids.get(course.program_id),mapped=clos.filter(c=>c.course_id===course.course_id&&String(c.po_nos).trim());if(!code||!mapped.length)continue;
    const basis=readJson(course.standards_json)?.pos;
    if(!sameBasis(basis,target(code)))output.push({type:'catalog_course',id:course.course_id,program:code,oldBasis:basis||null,cloMappings:mapped.map(c=>({id:c.clo_id,pos:c.po_nos})),proposedMappings:null,reason:'Catalog CLO mappings must be reviewed before new course adoption.'});
  }
  return output;
}
async function plan(db){const before=await snapshot(db);return {migrationId:ID,officialSha256:hash(official),before,beforeSha256:hash(before),impacts:await impacts(db,before)};}
function writeBackup(file,value){fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});return hash(fs.readFileSync(file,'utf8'));}
function loadBackup(file,expected){const raw=fs.readFileSync(file,'utf8'),value=JSON.parse(raw);if(value.migrationId!==ID||value.officialSha256!==hash(official)||value.beforeSha256!==hash(value.before)||expected!==value.beforeSha256)throw Error('Backup/source/precondition hash mismatch');return {value,sha256:hash(raw)};}
function verifySources(){for(const [code,ref] of Object.entries(official.programs)){if(ref.inheritsFrom)continue;const expected=code==='BSIT'?9:13;if(ref.outcomes.length!==expected||ref.outcomes.some((p,i)=>p.no!==i+1))throw Error('Invalid official numbering');const actual=crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../..',ref.sourceFile))).digest('hex');if(actual!==ref.sha256)throw Error('Official source PDF changed');}}
async function applied(db){if(!await exists(db,'program_po_reference_migrations'))return null;const [rows]=await db.query('SELECT * FROM program_po_reference_migrations WHERE migration_id=?',[ID]);return rows[0]||null;}
async function apply(db,{backupFile,expectedBeforeHash,maintenanceConfirmed=false}){
  verifySources();
  if(!maintenanceConfirmed)throw Error('A maintenance window and verified backup are required');
  const backup=loadBackup(backupFile,expectedBeforeHash),state=await applied(db);
  if(state?.status==='applied'){
    if(state.backup_sha256!==backup.sha256||hash(await snapshot(db))!==hash(JSON.parse(state.after_json)))throw Error('Applied state drift; refusing idempotent replay');
    return {alreadyApplied:true};
  }
  if(state)throw Error('This migration ID has already been rolled back; use a reviewed new version');
  if(hash(await snapshot(db))!==backup.value.beforeSha256)throw Error('Database changed since backup');
  const child=backup.value.before.programs.find(p=>p.code==='BSIT-CYBERSECURITY'),source=backup.value.before.programs.find(p=>p.code==='BSIT');
  const link=backup.value.before.links.find(l=>l.program_id===child.program_id);
  if(link&&link.source_program_id!==source.program_id)throw Error('Cyber is linked to a different source');
  if(backup.value.before.programs.some(p=>p.code!=='BSIT-CYBERSECURITY'&&backup.value.before.links.some(l=>l.program_id===p.program_id)))throw Error('A canonical program already inherits another outcome source; explicit review required');
  if(backup.value.before.active.some(a=>backup.value.before.programs.some(p=>p.program_id===a.program_id)))throw Error('An active reference already exists for a target program');
  const [egas]=await db.query('SELECT program_id,ega_no,name,short_name FROM program_egas WHERE program_id IN (?,?) ORDER BY program_id,ega_no',[source.program_id,child.program_id]);
  const egaRows=id=>egas.filter(e=>e.program_id===id).map(({program_id,...e})=>e);
  if(JSON.stringify(egaRows(source.program_id))!==JSON.stringify(egaRows(child.program_id)))throw Error('Existing inheritance mechanism also shares EGAs; EGA drift must be reviewed first');
  // DDL commits independently in MySQL. It is additive and deliberately precedes
  // the single DML transaction; a failed DML attempt leaves only empty support tables.
  for(const sql of DDL)await db.query(sql);
  await db.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
  await db.beginTransaction();
  try{
    await db.query('SELECT program_id FROM programs WHERE code IN (?,?,?,?) FOR UPDATE',CODES);
    if(hash(await snapshot(db))!==backup.value.beforeSha256)throw Error('Database changed while preparing migration');
    for(const program of backup.value.before.programs){
      await db.query('DELETE FROM program_outcomes WHERE program_id=?',[program.program_id]);
      if(program.code!=='BSIT-CYBERSECURITY'){
        const ref=official.programs[program.code],refId=`${ID}-${program.code}`;
        await db.query('INSERT INTO program_po_reference_versions(reference_id,program_id,version_label,source_file,source_sha256,outcomes_json) VALUES(?,?,?,?,?,?)',[refId,program.program_id,ID,ref.sourceFile,ref.sha256,JSON.stringify(ref.outcomes)]);
        for(const po of ref.outcomes)await db.query('INSERT INTO program_outcomes(program_id,po_no,short_name,outcome_text,ega_nos) VALUES(?,?,?,?,?)',[program.program_id,po.no,po.short,po.text,'']);
        await db.query('INSERT INTO program_po_reference_active(program_id,reference_id) VALUES(?,?)',[program.program_id,refId]);
      }
      await db.query('UPDATE programs SET pos_version=pos_version+1 WHERE program_id=?',[program.program_id]);
    }
    await db.query('INSERT INTO program_outcome_sources(program_id,source_program_id,specialization) VALUES(?,?,?) ON DUPLICATE KEY UPDATE source_program_id=VALUES(source_program_id),specialization=VALUES(specialization)',[child.program_id,source.program_id,'Cyber Security']);
    const after=await snapshot(db);
    for(const program of after.programs){const rows=after.pos.filter(p=>p.program_id===program.program_id);if(program.code==='BSIT-CYBERSECURITY'){if(rows.length)throw Error('Competing Cyber PO copy remains');}else if(!sameBasis(rows.map(p=>({no:p.po_no,text:p.outcome_text})),official.programs[program.code].outcomes))throw Error('Official PO verification failed before commit');}
    if(JSON.stringify(after.protectedHashes)!==JSON.stringify(backup.value.before.protectedHashes))throw Error('Protected data changed; rolling back');
    await db.query('INSERT INTO program_po_reference_migrations(migration_id,status,backup_sha256,after_json) VALUES(?,?,?,?)',[ID,'applied',backup.sha256,JSON.stringify(after)]);
    for(const item of backup.value.impacts)await db.query('INSERT INTO program_po_reference_remediation(migration_id,entity_type,entity_id,status,details_json) VALUES(?,?,?,?,?)',[ID,item.type,item.id,'needs_review',JSON.stringify(item)]);
    await db.commit();return {applied:true,remediationItems:backup.value.impacts.length,after};
  }catch(error){await db.rollback();throw error;}
}
async function rollback(db,{backupFile,expectedBeforeHash,maintenanceConfirmed=false}){
  if(!maintenanceConfirmed)throw Error('A maintenance window is required');
  const backup=loadBackup(backupFile,expectedBeforeHash),state=await applied(db);
  if(!state||state.backup_sha256!==backup.sha256)throw Error('Matching applied migration/backup required');
  if(state.status==='rolled_back')return {alreadyRolledBack:true};
  if(hash(await snapshot(db))!==hash(JSON.parse(state.after_json)))throw Error('Post-migration data changed; refusing rollback to avoid reinterpreting newer records');
  await db.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
  await db.beginTransaction();
  try{
    await db.query('SELECT program_id FROM programs WHERE code IN (?,?,?,?) FOR UPDATE',CODES);
    if(hash(await snapshot(db))!==hash(JSON.parse(state.after_json)))throw Error('Post-migration data changed while locking rollback');
    const prior=backup.value.before;
    for(const p of prior.programs){
      await db.query('DELETE FROM program_outcomes WHERE program_id=?',[p.program_id]);
      await db.query('DELETE FROM program_po_reference_active WHERE program_id=?',[p.program_id]);
      await db.query('DELETE FROM program_outcome_sources WHERE program_id=?',[p.program_id]);
      for(const po of prior.pos.filter(v=>v.program_id===p.program_id))await db.query('INSERT INTO program_outcomes(program_id,po_no,short_name,outcome_text,ega_nos) VALUES(?,?,?,?,?)',[po.program_id,po.po_no,po.short_name,po.outcome_text,po.ega_nos]);
      await db.query('UPDATE programs SET pos_version=? WHERE program_id=?',[p.pos_version,p.program_id]);
      for(const link of prior.links.filter(v=>v.program_id===p.program_id))await db.query('INSERT INTO program_outcome_sources(program_id,source_program_id,specialization) VALUES(?,?,?)',[link.program_id,link.source_program_id,link.specialization]);
    }
    if(hash(await snapshot(db))!==priorHash(prior))throw Error('Rollback verification failed');
    await db.query("UPDATE program_po_reference_remediation SET status='rolled_back' WHERE migration_id=?",[ID]);
    await db.query("UPDATE program_po_reference_migrations SET status='rolled_back' WHERE migration_id=?",[ID]);
    await db.commit();return {rolledBack:true};
  }catch(error){await db.rollback();throw error;}
}
const priorHash=hash;
module.exports={ID,CODES,DDL,hash,plan,snapshot,impacts,writeBackup,apply,rollback,protectedTables};
