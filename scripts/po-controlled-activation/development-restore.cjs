'use strict';
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),cp=require('node:child_process');
const mysql=require('../../server/node_modules/mysql2/promise');
const safety=require('./development-safety.cjs');
const {iniValue}=require('./development-backup.cjs');
const root=path.resolve(__dirname,'../..');
function context(){const pointer=JSON.parse(fs.readFileSync(path.join(safety.TEMP,'private-backup-context.json'),'utf8'));return pointer.contextFile?JSON.parse(fs.readFileSync(pointer.contextFile,'utf8')):pointer;}
function save(ctx){const file=path.join(ctx.privateDir,'private-context.json');fs.writeFileSync(file,JSON.stringify(ctx,null,2),{mode:0o600});fs.writeFileSync(path.join(safety.TEMP,'private-backup-context.json'),JSON.stringify({privateDir:ctx.privateDir,contextFile:file},null,2),{mode:0o600});}
async function assertFree(port){await new Promise((resolve,reject)=>{const s=net.createConnection({host:'127.0.0.1',port});s.setTimeout(700);s.once('connect',()=>{s.destroy();reject(Error('STOP: isolated source/test port is occupied: '+port));});s.once('error',e=>e.code==='ECONNREFUSED'?resolve():reject(e));s.once('timeout',()=>{s.destroy();reject(Error('STOP: cannot verify free isolated port'));});});}
async function prepare(){const ctx=context();await assertFree(43308);await assertFree(43309);const src=path.resolve(root,'tmp/lcup-po-correction-db/data');const dest=path.resolve(ctx.privateDir,'restore-server/data');if(!src.startsWith(root+path.sep)||!dest.startsWith(ctx.privateDir+path.sep))throw Error('STOP: invalid private restore paths');if(fs.existsSync(dest))throw Error('STOP: preserve existing restore directory');fs.cpSync(src,dest,{recursive:true,errorOnExist:true,force:false});ctx.restoreDatadir=dest;ctx.restorePort=43309;save(ctx);console.log(JSON.stringify({restorePort:43309,restoreDatadir:dest,sourceApplicationDatabaseCopied:false}));}
async function verifyIdentity(db,ctx){const [[r]]=await db.query('SELECT @@port AS port,@@datadir AS datadir,@@event_scheduler AS scheduler');const normalize=s=>path.resolve(s).replaceAll('\\','/').replace(/\/$/,'').toLowerCase();if(r.port!==43309||normalize(r.datadir)!==normalize(ctx.restoreDatadir)||r.scheduler!=='OFF')throw Error('STOP: restore connection is not the private isolated server with events disabled');return r;}
async function verify(){
 const ctx=context();const cfg={host:'127.0.0.1',port:43309,user:'root',password:'lcup-po-isolated-only',dateStrings:true,multipleStatements:false};const db=await mysql.createConnection(cfg);
 try{
  const identity=await verifyIdentity(db,ctx);const restoreName='lcup_dev_restore_'+Date.now();if(!/^[a-z0-9_]+$/.test(restoreName))throw Error('Invalid test DB');
  if(!/^[a-z0-9_]+$/i.test(ctx.schema.charset_name)||!/^[a-z0-9_]+$/i.test(ctx.schema.collation_name))throw Error('Invalid schema encoding');
  await db.query('CREATE DATABASE '+safety.quote(restoreName)+' CHARACTER SET '+ctx.schema.charset_name+' COLLATE '+ctx.schema.collation_name);
  const ini=path.join(ctx.privateDir,restoreName+'-client.ini');fs.writeFileSync(ini,'[client]\nhost=127.0.0.1\nport=43309\nuser=root\npassword='+iniValue(cfg.password)+'\nprotocol=TCP\n',{mode:0o600,flag:'wx'});
  await new Promise((resolve,reject)=>{const child=cp.spawn('C:/xampp/mysql/bin/mysql.exe',['--defaults-file='+ini,'--binary-mode','--default-character-set=utf8mb4','--max-allowed-packet=128M',restoreName],{windowsHide:true,stdio:['pipe','ignore','pipe']});const log=fs.createWriteStream(path.join(ctx.privateDir,'restore-process.log'),{mode:0o600});child.stderr.pipe(log);child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('STOP: backup restore failed; inspect private restore-process.log')));child.stdin.on('error',e=>{if(e.code!=='EPIPE')reject(e);});fs.createReadStream(ctx.dump).pipe(child.stdin);});
  await db.changeUser({database:restoreName});
  const restored=await safety.inventory(db),before=JSON.parse(fs.readFileSync(path.join(ctx.privateDir,'before-full-inventory.json'),'utf8'));
  const differences=[];for(const t of before.tables){const r=restored.tables.find(r=>r.name===t.name);if(!r||r.rows!==t.rows||r.sha256!==t.sha256||r.ddlSha256!==t.ddlSha256)differences.push({table:t.name,rowsMatch:r?.rows===t.rows,dataMatch:r?.sha256===t.sha256,schemaMatch:r?.ddlSha256===t.ddlSha256});}
  if(before.tables.length!==restored.tables.length||JSON.stringify(before.routines)!==JSON.stringify(restored.routines)||JSON.stringify(before.triggers)!==JSON.stringify(restored.triggers)||JSON.stringify(before.events)!==JSON.stringify(restored.events))differences.push({objects:'schema object inventory differs'});
  const report={verifiedAt:new Date().toISOString(),backupPath:ctx.dump,backupSha256:safety.sha(fs.readFileSync(ctx.dump)),restoreDatabase:restoreName,restorePort:43309,restoreServerIdentityVerified:true,eventScheduler:'OFF',fullTableCount:restored.tables.length,totalRows:restored.tables.reduce((n,t)=>n+t.rows,0),routines:restored.routines.length,triggers:restored.triggers.length,events:restored.events.length,differences,restoreVerified:differences.length===0,originalDatabaseModified:false};
  fs.writeFileSync(path.join(safety.OUT,'backup-restored.json'),JSON.stringify(report,null,2)+'\n');
  if(differences.length)throw Error('STOP: restored backup differs from development database inventory; no migration permitted');
  ctx.restoreDatabase=restoreName;ctx.restoreConfig={...cfg,database:restoreName};ctx.manifest.restoreVerified=true;save(ctx);
  console.log(JSON.stringify({restoreVerified:true,tables:restored.tables.length,totalRows:report.totalRows,restorePort:43309,restoreDatabase:restoreName,allDataAndSchemaHashesMatch:true}));
 }finally{await db.end();}
}
module.exports={context,save,verifyIdentity};
if(require.main===module)(process.argv.includes('--prepare')?prepare():verify()).catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
