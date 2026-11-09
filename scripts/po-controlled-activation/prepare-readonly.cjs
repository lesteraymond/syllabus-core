'use strict';
// Prepares a concrete reviewable reference backup. SELECT-only, never apply.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const env=require('../../server/node_modules/dotenv').parse(fs.readFileSync(path.join(root,'server/.env')));
const mysql=require('../../server/node_modules/mysql2/promise');
const migration=require('../../server/db/official-po-migration.cjs');
const {findProgram}=require('../../server/lib/programs');
(async()=>{
 const db=await mysql.createConnection({host:env.DB_HOST,user:env.DB_USER,password:env.DB_PASS,database:env.DB_NAME,dateStrings:true});
 try{
  await db.query('SET SESSION TRANSACTION READ ONLY');await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  const ro={query:(sql,args)=>{if(!/^SELECT\b/i.test(sql))throw Error('SELECT-only preparation');return db.query(sql,args);}};
  const ids=[];for(const code of migration.CODES)ids.push((await findProgram(ro,code)).program_id);
  const plan=await migration.plan(ro,{programIds:ids});
  const [[serverIdentity]]=await ro.query('SELECT DATABASE() AS db_name,@@hostname AS hostname,@@port AS port,@@datadir AS datadir');
  const identity={database:serverIdentity.db_name,hostname:serverIdentity.hostname,port:serverIdentity.port,datadir:serverIdentity.datadir};
  await db.rollback();
  const backup='tmp/po-controlled-activation/reference-backup-review.json';const backupSha256=migration.writeBackup(path.join(root,backup),plan);
  const summary={preparedAt:new Date().toISOString(),migrationId:plan.migrationId,authorization:plan.authorization,institutionalApproval:plan.institutionalApproval,databaseIdentityHash:migration.hash(identity),beforeHash:plan.beforeSha256,backupSha256,privateBackupPath:backup,targets:plan.before.programs.map(p=>({id:p.program_id,code:p.code,academicYear:p.academic_year||null})),impacts:plan.impacts.map(({oldBasis,cloMappings,directIloPoMappings,...r})=>r),existingDatabaseWrites:0,activationPerformed:false,operatorAuthorization:false,fullPhysicalBackupRequiredBeforeActivation:true};
  fs.writeFileSync(path.join(root,'docs/po-controlled-activation/reviewed-plan.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({beforeHash:plan.beforeSha256,targets:summary.targets,impacts:summary.impacts.length,existingDatabaseWrites:0,activationPerformed:false}));
 }finally{await db.end();}
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
