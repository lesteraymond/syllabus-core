'use strict';
// Disposable-only command. Never reads .env and cannot address the existing DB.
const fs=require('node:fs');const path=require('node:path');
const mysql=require('../../server/node_modules/mysql2/promise');
const migration=require('../../server/db/official-po-migration.cjs');
const args=process.argv.slice(2),action=args[0];
const value=key=>args[args.indexOf(key)+1];
(async()=>{
 if(!['backup','apply','rollback'].includes(action)||!args.includes('--config')||!args.includes('--backup')||(action!=='backup'&&!args.includes('--expected')))throw Error('Usage: backup|apply|rollback --config <isolated-json> --backup <new-json> [--expected <before-hash>] --maintenance');
 const config=JSON.parse(fs.readFileSync(value('--config'),'utf8'));
 if(config.host!=='127.0.0.1'||config.port!==43308||!/^lcupo_test_\d+$/.test(config.database))throw Error('Disposable connection config required');
 const c=await mysql.createConnection({...config,dateStrings:true});
 try{
  const [[id]]=await c.query('SELECT @@datadir AS datadir, @@port AS port');
  const expected=path.resolve(__dirname,'../../tmp/lcup-po-correction-db/data').replaceAll('\\','/').toLowerCase();
  if(id.port!==43308||id.datadir.replaceAll('\\','/').replace(/\/$/,'').toLowerCase()!==expected)throw Error('Refusing a non-disposable database');
  if(action==='backup'){const plan=await migration.plan(c);migration.writeBackup(value('--backup'),plan);console.log(JSON.stringify({beforeHash:plan.beforeSha256,impacts:plan.impacts.length}));}
  else console.log(JSON.stringify(await migration[action](c,{backupFile:value('--backup'),expectedBeforeHash:value('--expected'),maintenanceConfirmed:args.includes('--maintenance')})));
 }finally{await c.end();}
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
