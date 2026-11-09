'use strict';
// Complete logical backup of the explicitly verified DEVELOPMENT DB only.
// No application data is printed. Secret client options and SQL stay outside git.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const mysql=require('../../server/node_modules/mysql2/promise');
const safety=require('./development-safety.cjs');
const migration=require('../../server/db/official-po-migration.cjs');
const root=path.resolve(__dirname,'../..');
const iniValue=value=>{const s=String(value??'');if(/[\r\n\0]/.test(s))throw Error('Invalid client option');return '"'+s.replaceAll('\\','\\\\').replaceAll('"','\\"')+'"';};
async function main(){
 const db=await mysql.createConnection(safety.config());
 try{
  const target=safety.assertDevelopment(await safety.identityOf(db));
  const privateDir=fs.mkdtempSync(path.join(os.tmpdir(),'lcup-dev-po-activation-'));fs.chmodSync(privateDir,0o700);
  const cfg=safety.config();const ini=path.join(privateDir,'development-client.ini');
  fs.writeFileSync(ini,'[client]\nhost='+iniValue(cfg.host)+'\nport='+cfg.port+'\nuser='+iniValue(cfg.user)+'\npassword='+iniValue(cfg.password)+'\nprotocol=TCP\n',{mode:0o600,flag:'wx'});
  await db.query('SET SESSION TRANSACTION READ ONLY');await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  const before=await safety.inventory(db);const [[schema]]=await db.query('SELECT DEFAULT_CHARACTER_SET_NAME AS charset_name,DEFAULT_COLLATION_NAME AS collation_name FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=DATABASE()');await db.rollback();
  const dump=path.join(privateDir,'development-full-before.sql');
  const args=['--defaults-file='+ini,'--single-transaction','--routines','--events','--triggers','--hex-blob','--order-by-primary','--skip-lock-tables','--skip-add-locks','--skip-comments','--default-character-set=utf8mb4','--result-file='+dump,cfg.database];
  const result=cp.spawnSync('C:/xampp/mysql/bin/mysqldump.exe',args,{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024,timeout:120000});
  fs.writeFileSync(path.join(privateDir,'dump-process.log'),(result.stderr||'').replaceAll(String(cfg.password||'__no_password__'),'[redacted]'),{mode:0o600});
  if(result.status!==0)throw Error('STOP: full database backup command failed; inspect private dump-process.log');
  fs.chmodSync(dump,0o600);const bytes=fs.readFileSync(dump);
  if(bytes.length<1000||/^\s*(?:CREATE\s+DATABASE|DROP\s+DATABASE|USE\s+`)/im.test(bytes.toString('utf8')))throw Error('STOP: backup missing or contains unsafe database-selection directives');
  await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');const after=await safety.inventory(db);await db.rollback();
  if(before.hash!==after.hash)throw Error('STOP: development data changed while creating backup; no migration is permitted');
  const [tables]=await db.query('SELECT TABLE_NAME AS name,TABLE_TYPE AS type FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
  const report={createdAt:new Date().toISOString(),target:{host:cfg.host,port:cfg.port,database:cfg.database},databaseIdentityHash:target.databaseIdentityHash,backupType:'Complete logical SQL: schema, every table, routines, triggers and events',backupPath:dump,bytes:bytes.length,sha256:safety.sha(bytes),tables:before.tables.map(({ddl,...r})=>r),routines:before.routines.length,triggers:before.triggers.length,events:before.events.length,inventoryHash:before.hash,developmentUnchangedDuringBackup:true,restoreVerified:false,developmentTestingOnly:true};
  fs.writeFileSync(path.join(privateDir,'before-full-inventory.json'),JSON.stringify(before,null,2),{mode:0o600});
  const context={privateDir,dump,developmentClientIni:ini,developmentConfig:{...cfg,mode:'existing'},identity:target.identity,manifest:report,schema};
  const contextFile=path.join(privateDir,'private-context.json');fs.writeFileSync(contextFile,JSON.stringify(context,null,2),{mode:0o600,flag:'wx'});
  fs.writeFileSync(path.join(safety.TEMP,'private-backup-context.json'),JSON.stringify({privateDir,contextFile},null,2),{mode:0o600,flag:'wx'});
  fs.writeFileSync(path.join(safety.OUT,'backup-created.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({backupPath:dump,bytes:bytes.length,sha256:report.sha256,tableCount:tables.length,routines:report.routines,triggers:report.triggers,events:report.events,developmentUnchangedDuringBackup:true,restoreVerified:false}));
 }finally{await db.end();}
}
module.exports={iniValue};
if(require.main===module)main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
