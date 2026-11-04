'use strict';
// Existing database: SELECT-only, session read-only. Produces no live migration.
const fs=require('node:fs');const path=require('node:path');
const mysql=require('../../server/node_modules/mysql2/promise');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/lcup-po-correction');
const env=require('../../server/node_modules/dotenv').parse(fs.readFileSync(path.join(root,'server/.env')));
const migration=require('../../server/db/official-po-migration.cjs');
(async()=>{
 const c=await mysql.createConnection({host:env.DB_HOST,user:env.DB_USER,password:env.DB_PASS,database:env.DB_NAME,dateStrings:true});
 try{
  await c.query('SET SESSION TRANSACTION READ ONLY');await c.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  const queries=[];const db={query:(sql,params)=>{if(!/^SELECT\b/i.test(sql))throw Error('Read-only query guard');queries.push(sql);return c.query(sql,params);}};
  const [[session]]=await db.query('SELECT @@tx_read_only AS read_only, VERSION() AS version');
  const plan=await migration.plan(db);
  const [foreignKeys]=await db.query("SELECT table_name,column_name,referenced_table_name,referenced_column_name,constraint_name FROM information_schema.key_column_usage WHERE table_schema=DATABASE() AND referenced_table_name IS NOT NULL ORDER BY table_name,column_name");
  await c.rollback();
  fs.writeFileSync(path.join(out,'live-readonly-plan.json'),JSON.stringify({...plan,session,foreignKeys,queries,productionWrites:0},null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({readOnly:session.read_only,programs:plan.before.programs.map(p=>p.code),impacts:plan.impacts.map(({oldBasis,...i})=>i),preconditionHash:plan.beforeSha256,foreignKeys:foreignKeys.length}));
 }finally{await c.end();}
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
