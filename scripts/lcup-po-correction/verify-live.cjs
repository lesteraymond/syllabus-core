'use strict';
const fs=require('node:fs'),path=require('node:path');
const mysql=require('../../server/node_modules/mysql2/promise');
const migration=require('../../server/db/official-po-migration.cjs');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/lcup-po-correction');
const env=require('../../server/node_modules/dotenv').parse(fs.readFileSync(path.join(root,'server/.env')));
(async()=>{
 const c=await mysql.createConnection({host:env.DB_HOST,user:env.DB_USER,password:env.DB_PASS,database:env.DB_NAME,dateStrings:true});
 try{
  await c.query('SET SESSION TRANSACTION READ ONLY');await c.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  const db={query:(sql,args)=>{if(!/^SELECT\b/i.test(sql))throw Error('SELECT only');return c.query(sql,args);}};
  const prior=JSON.parse(fs.readFileSync(path.join(out,'live-readonly-plan.json'),'utf8'));
  const after=await migration.plan(db),comparable={...after.before};
  if(!('activeVersions' in prior.before)&&after.before.activeVersions.length===0)delete comparable.activeVersions;
  const unchanged=migration.hash(comparable)===prior.beforeSha256;
  await c.rollback();
  fs.writeFileSync(path.join(out,'live-readonly-final-plan.json'),JSON.stringify({...after,productionWrites:0,liveDataUnchanged:unchanged},null,2)+'\n');
  if(!unchanged)throw Error('Existing database changed during work; inspect snapshot before release');
  console.log('Existing program outcomes, faculty rows, historical reports and curricula are unchanged. SELECT-only verification.');
 }finally{await c.end();}
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
