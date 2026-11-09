'use strict';
// Reset DATA ONLY in an already provisioned, copied synthetic schema. No DDL,
// bootstrap or migration is permitted. Never connects to the development port.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const mysql=require('../../server/node_modules/mysql2/promise');
async function reset(name){
 assert.match(name,/^syllabus_e2e_po_1105_(regression|comprehensive|budget|workflow_baseline|workflow_optimized)$/);
 const db=await mysql.createConnection({host:'127.0.0.1',port:43310,user:'root',password:'',database:name,dateStrings:true});
 try{const [[identity]]=await db.query('SELECT @@port AS port,@@datadir AS datadir');assert.equal(identity.port,43310);assert.equal(path.resolve(identity.datadir).toLowerCase(),path.resolve('tmp/po-checker-integration/db/data').toLowerCase());
  const [tables]=await db.query('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
  const [columns]=await db.query('SHOW COLUMNS FROM academic_years');assert.ok(columns.some(c=>c.Field==='is_current'));
  const schemas=[];for(const t of tables){const [ddl]=await db.query('SHOW CREATE TABLE ??',[t.name]);schemas.push({table:t.name,ddl:Object.values(ddl[0])[1]});}
  await db.query('SET FOREIGN_KEY_CHECKS=0');try{for(const t of tables)await db.query('DELETE FROM ??',[t.name]);}finally{await db.query('SET FOREIGN_KEY_CHECKS=1');}
  await db.query('INSERT INTO academic_years(label,start_year,is_current) VALUES(?,?,1)',['2026–2027',2026]);
  const after=[];for(const t of tables){const [ddl]=await db.query('SHOW CREATE TABLE ??',[t.name]);after.push({table:t.name,ddl:Object.values(ddl[0])[1]});}assert.deepEqual(after,schemas,'Fixture reset must not modify schema');
  return {database:name,port:43310,tables:tables.length,schemaUnchanged:true,migrationsExecuted:0};
 }finally{await db.end();}
}
module.exports={reset};if(require.main===module)reset(process.argv[2]).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
