'use strict';
// May stop only the workspace-owned MariaDB instance, never the configured DB.
const fs=require('node:fs');
const path=require('node:path');
const mysql=require('../../server/node_modules/mysql2/promise');
(async()=>{
  const c=await mysql.createConnection({host:'127.0.0.1',port:43307,user:'root',password:'lcup-isolated-only'});
  const [[id]]=await c.query('SELECT @@datadir AS datadir, @@port AS port');
  const expected=path.resolve(__dirname,'../../tmp/lcup-evaluation-readiness-db/data').replaceAll('\\','/').toLowerCase();
  if(id.port!==43307||id.datadir.replaceAll('\\','/').replace(/\/$/,'').toLowerCase()!==expected)throw Error('Refusing to stop non-test database');
  await c.query('SHUTDOWN');await c.end();
  fs.writeFileSync(path.resolve(__dirname,'../../docs/lcup-evaluation-readiness/disposable-shutdown.json'),JSON.stringify({guardVerified:true,shutdownRequested:true,datadir:id.datadir,port:id.port,retainedForReview:true},null,2)+'\n');
  console.log('Workspace-owned database shut down; test data retained.');
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
