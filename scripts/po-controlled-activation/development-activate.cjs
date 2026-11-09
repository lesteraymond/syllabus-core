'use strict';
// Explicit DEVELOPMENT-only operator command. Never runs at application startup.
// Uses the existing migration; full backup restoration and rehearsal are mandatory.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const mysql=require('../../server/node_modules/mysql2/promise');
const safety=require('./development-safety.cjs'),restore=require('./development-restore.cjs');
const migration=require('../../server/db/official-po-migration.cjs');
const official=require('../../src/data/officialProgramOutcomes.json');
const {findProgram,loadResolvedProgram}=require('../../server/lib/programs');
const {mastersFor}=require('../../server/lib/syllabuscheck/repository');
const {assertRecordReview}=require('../../server/lib/programPoReferences');
const backupFile=path.join(safety.TEMP,'reference-before.json');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,value)=>fs.writeFileSync(path.join(safety.OUT,file),JSON.stringify(value,null,2)+'\n');
function backupVerified(ctx){
 const report=read(path.join(safety.OUT,'backup-restored.json'));
 assert.equal(report.restoreVerified,true,'STOP: complete backup restoration is not verified');
 assert.equal(ctx.manifest.restoreVerified,true);
 assert.equal(safety.sha(fs.readFileSync(ctx.dump)),ctx.manifest.sha256,'STOP: backup bytes changed');
 assert.equal(report.backupSha256,ctx.manifest.sha256);
}
async function verifyState(db,ctx){
 const state=await migration.verify(db);assert.equal(state.active,true);
 const before=read(path.join(ctx.privateDir,'before-full-inventory.json')),after=await safety.inventory(db);
 const allowed=new Set(['programs','program_outcomes']);
 const unchanged=before.tables.filter(t=>!allowed.has(t.name)).map(t=>{const r=after.tables.find(r=>r.name===t.name);assert.ok(r,'Missing original table '+t.name);assert.equal(r.sha256,t.sha256,'Unexpected data change '+t.name);assert.equal(r.ddlSha256,t.ddlSha256,'Unexpected schema change '+t.name);return {table:t.name,rows:r.rows,sha256:r.sha256,unchanged:true};});
 for(const name of allowed){const old=before.tables.find(t=>t.name===name),now=after.tables.find(t=>t.name===name);assert.equal(now.ddlSha256,old.ddlSha256,'Unexpected schema change '+name);}
 const programs=[];
 for(const code of migration.CODES){
  const program=await loadResolvedProgram(db,await findProgram(db,code));const canonical=code==='BSIT-CYBERSECURITY'?'BSIT':code;
  assert.deepEqual(program.pos.map(p=>[p.no,p.short,p.text]),official.programs[canonical].outcomes.map(p=>[p.no,p.short,p.text]));
  assert.equal(program.poReference.institutionalApproval,'not_recorded');
  const masters=await mastersFor(db,{meta:{program:code},outcomes:{pos:program.pos},clos:[{pos:[1]}]});
  assert.deepEqual(masters.pos,program.pos);assert.equal(masters.referenceContext.po.source,canonical);
  const [own]=await db.query('SELECT po_no FROM program_outcomes WHERE program_id=?',[program.id]);
  if(code==='BSIT-CYBERSECURITY'){assert.equal(own.length,0);assert.equal(program.inheritedFrom.id,1);assert.equal(program.curriculumSource,'BSIT');assert.deepEqual(masters.referenceContext.curriculum.referenceIds,[1]);assert.ok(masters.curricula.every(c=>c.program==='BSIT'));}
  programs.push({id:program.id,code,physicalPoCount:own.length,resolvedPoCount:program.pos.length,poSource:canonical,referenceId:program.poReference.id,referenceVersion:program.poReference.version,institutionalApproval:'not_recorded',curriculum:masters.referenceContext.curriculum});
 }
 const [active]=await db.query('SELECT program_id,reference_id FROM program_po_reference_active ORDER BY program_id');assert.equal(active.length,3);
 const [reviews]=await db.query('SELECT entity_type,entity_id,status,details_json FROM program_po_reference_remediation WHERE migration_id=? ORDER BY entity_id',[migration.ID]);
 assert.deepEqual(reviews.map(r=>r.entity_id),[43,93,97,99,100,101,102,110]);
 const visible=[];
 for(const r of reviews){assert.equal(r.status,'needs_review');let code=null;try{await assertRecordReview(db,r.entity_id);}catch(e){code=e.body?.code;}
  assert.equal(code,r.entity_id===110?'curriculum_reference_review_required':'po_mapping_remediation_required');
  const details=JSON.parse(r.details_json);assert.equal(details.proposedMappings,null);
  visible.push({syllabusId:r.entity_id,status:r.status,reviewCode:code,proposedReference:details.proposedReference||null,curriculumReview:!!details.curriculumReview,automaticRemapping:false});
 }
 const snap=await migration.snapshot(db,{programIds:state.targets.map(p=>p.id)}),prior=read(backupFile);
 assert.deepEqual(snap.protectedHashes,prior.before.protectedHashes);assert.equal(snap.unrelatedHash,prior.before.unrelatedHash);
 const added=after.tables.filter(t=>!before.tables.some(p=>p.name===t.name)).map(t=>({table:t.name,rows:t.rows}));
 assert.deepEqual(added.map(t=>t.table).sort(),['program_outcome_sources','program_po_reference_active','program_po_reference_migrations','program_po_reference_remediation','program_po_reference_versions'].sort());
 return {verifiedAt:new Date().toISOString(),active:true,developmentTestingOnly:true,formalInstitutionalApproval:'not_recorded',migrationId:migration.ID,programs,canonicalActiveReferences:active,reviewQueue:visible,protectedHashes:snap.protectedHashes,unrelatedProgramHash:snap.unrelatedHash,unchangedOriginalTables:unchanged,newTables:added,originalTableCount:before.tables.length,afterTableCount:after.tables.length,originalFacultyContentUnchanged:true,originalReportsAndApprovalHistoryUnchanged:true};
}
async function main(action){
 const ctx=restore.context();backupVerified(ctx);const prior=read(backupFile);const options={backupFile,expectedBeforeHash:prior.beforeSha256,maintenanceConfirmed:true};
 if(action==='rehearse'){
  const db=await mysql.createConnection(ctx.restoreConfig);
  try{await restore.verifyIdentity(db,ctx);assert.equal(migration.hash(await migration.snapshot(db,{programIds:[1,15,16,17]})),prior.beforeSha256);
   const applied=await migration.apply(db,options);assert.equal(applied.applied,true);const verification=await verifyState(db,ctx);
   const rollback=await migration.rollback(db,options);assert.equal(rollback.rolledBack,true);assert.deepEqual(await migration.snapshot(db,{programIds:[1,15,16,17]}),prior.before);
   const result={...verification,kind:'restored full development backup on PRIVATE isolated port 43309',actualDevelopmentModified:false,rollbackVerified:true,originalReferenceStateRestored:true};write('rehearsal.json',result);
   console.log(JSON.stringify({rehearsalPassed:true,rollbackVerified:true,programCounts:verification.programs.map(p=>[p.code,p.resolvedPoCount]),reviewCount:verification.reviewQueue.length,developmentModified:false}));
  }finally{await db.end();}return;
 }
 if(!['apply','verify'].includes(action))throw Error('Explicit rehearse|apply|verify action required');
 const db=await mysql.createConnection(safety.config());let applied=false;
 try{
  const identity=await safety.identityOf(db),target=safety.assertDevelopment(identity);
  if(action==='apply'){
   assert.equal(read(path.join(safety.OUT,'rehearsal.json')).rollbackVerified,true,'STOP: isolated rehearsal required');
   assert.equal((await safety.inventory(db)).hash,read(path.join(ctx.privateDir,'before-full-inventory.json')).hash,'STOP: development data changed after full backup');
   assert.equal(migration.hash(await migration.snapshot(db,{programIds:[1,15,16,17]})),prior.beforeSha256);
   const receipt={confirmed:true,authorizedBy:'User explicit instruction in this conversation',authorizationRecord:'Controlled corrected PO activation in the EXISTING DEVELOPMENT DATABASE ONLY, with full backup and restore verification; 2026-11-05. No staging/production/formal VPAA approval.',migrationId:migration.ID,databaseIdentityHash:target.databaseIdentityHash,beforeHash:prior.beforeSha256,programIds:[1,15,16,17],developmentTestingOnly:true,institutionalApproval:'not_recorded'};
   const receiptFile=path.join(ctx.privateDir,'development-authorization.json'),configFile=path.join(ctx.privateDir,'development-connection.json');
   fs.writeFileSync(receiptFile,JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});fs.writeFileSync(configFile,JSON.stringify(ctx.developmentConfig),{flag:'wx',mode:0o600});
   require('./rollout.cjs').authorize({config:ctx.developmentConfig,identity,ids:receipt.programIds,expected:prior.beforeSha256,receipt,maintenance:true});
   const result=await migration.apply(db,options);applied=!!result.applied;
   write('activation-receipt.json',{...receipt,appliedAt:new Date().toISOString(),applied,remediationItems:result.remediationItems,backupSha256:ctx.manifest.sha256});
  }
  const result=await verifyState(db,ctx);write('post-migration.json',result);
  console.log(JSON.stringify({developmentActive:true,programCounts:result.programs.map(p=>[p.code,p.resolvedPoCount]),canonicalSources:result.canonicalActiveReferences.length,reviewCount:result.reviewQueue.length,unchangedOriginalTables:result.unchangedOriginalTables.length,formalInstitutionalApproval:'not_recorded'}));
 }catch(e){
  write('failure.json',{time:new Date().toISOString(),action,appliedThisAttempt:applied,error:e.code||e.message,furtherChangesStopped:true});
  // Never force recovery over intervening faculty work. Existing rollback performs its own strict drift checks.
  if(applied){try{const recovered=await migration.rollback(db,options);write('recovery.json',{time:new Date().toISOString(),...recovered});}catch(r){write('recovery.json',{time:new Date().toISOString(),automaticRecoveryRefused:true,error:r.code||r.message,manualReviewedRecoveryRequired:true});}}
  throw e;
 }finally{await db.end();}
}
module.exports={verifyState,backupVerified};
if(require.main===module)main(process.argv[2]).catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
