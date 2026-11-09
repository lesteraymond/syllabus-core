'use strict';
// Transport for the EXISTING versioned migration, not a second resolver.
// No .env loading. Read actions use a read-only transaction. Existing-environment
// writes require a separately supplied authorization receipt tied to DB identity,
// all four target IDs, reference version and the exact reviewed backup hash.
const fs=require('node:fs'),path=require('node:path');
const mysql=require('../../server/node_modules/mysql2/promise');
const migration=require('../../server/db/official-po-migration.cjs');
const root=path.resolve(__dirname,'../..');
const option=(args,key)=>{const i=args.indexOf(key);return i<0?null:args[i+1];};
function authorize({config,identity,ids,expected,receipt,maintenance}){
 if(!maintenance)throw Error('Explicit maintenance confirmation required');
 if(config.mode==='isolated'){
  const directory=path.join(root,'tmp/lcup-po-correction-db/data').replaceAll('\\','/').toLowerCase();
  if(config.host!=='127.0.0.1'||config.port!==43308||identity.port!==43308||!/^lcupo_test_\d+$/.test(identity.database)||String(identity.datadir).replaceAll('\\','/').replace(/\/$/,'').toLowerCase()!==directory)throw Error('Verified workspace-owned isolated database required');
  return;
 }
 if(config.mode!=='existing'||!receipt||receipt.confirmed!==true||!receipt.authorizedBy||!receipt.authorizationRecord||!Array.isArray(receipt.programIds)||receipt.migrationId!==migration.ID||receipt.databaseIdentityHash!==migration.hash(identity)||receipt.beforeHash!==expected||JSON.stringify([...receipt.programIds].sort((a,b)=>a-b))!==JSON.stringify([...ids].sort((a,b)=>a-b)))throw Error('Explicit existing-environment authorization tied to this database, backup and four program IDs is required');
}
async function main(args=process.argv.slice(2)){
 const action=args[0],configFile=option(args,'--config'),backupFile=option(args,'--backup'),expected=option(args,'--expected');
 const ids=String(option(args,'--program-ids')||'').split(',').map(Number);
 if(!['plan','backup','verify','apply','rollback'].includes(action)||!configFile||ids.length!==4||new Set(ids).size!==4||ids.some(id=>!Number.isSafeInteger(id)||id<1))throw Error('Usage: plan|backup|verify|apply|rollback --config <explicit.json> --program-ids <four IDs> [--backup <file> --expected <hash> --maintenance --authorization <receipt.json>]');
 const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
 const {mode,...connection}=config;const db=await mysql.createConnection({...connection,dateStrings:true,multipleStatements:false});
 try{
  const [[serverIdentity]]=await db.query('SELECT DATABASE() AS db_name,@@hostname AS hostname,@@port AS port,@@datadir AS datadir');
  const identity={database:serverIdentity.db_name,hostname:serverIdentity.hostname,port:serverIdentity.port,datadir:serverIdentity.datadir};
  if(action==='apply'||action==='rollback'){
   if(!backupFile||!expected)throw Error('Reviewed backup file and expected hash required');
   const authorizationFile=option(args,'--authorization');const receipt=authorizationFile?JSON.parse(fs.readFileSync(authorizationFile,'utf8')):null;
   authorize({config,identity,ids,expected,receipt,maintenance:args.includes('--maintenance')});
   const backup=JSON.parse(fs.readFileSync(backupFile,'utf8'));
   if(JSON.stringify(backup.before.programs.map(p=>p.program_id).sort((a,b)=>a-b))!==JSON.stringify([...ids].sort((a,b)=>a-b)))throw Error('Backup target IDs differ from authorized IDs');
   return await migration[action](db,{backupFile,expectedBeforeHash:expected,maintenanceConfirmed:true});
  }
  await db.query('START TRANSACTION READ ONLY');
  const result=action==='verify'?await migration.verify(db):await migration.plan(db,{programIds:ids});
  await db.rollback();
  if(action==='backup'){if(!backupFile)throw Error('New backup path required');migration.writeBackup(backupFile,result);}
  return {databaseIdentityHash:migration.hash(identity),...(action==='verify'?result:{migrationId:result.migrationId,beforeHash:result.beforeSha256,targets:result.before.programs.map(p=>({id:p.program_id,code:p.code})),impacts:result.impacts,activationPerformed:false})};
 }finally{await db.end();}
}
module.exports={authorize,main};
if(require.main===module)main().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
