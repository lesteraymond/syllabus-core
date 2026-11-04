'use strict';
const fs=require('node:fs'),path=require('node:path');
const mysql=require('../../server/node_modules/mysql2/promise');
(async()=>{
 const c=await mysql.createConnection({host:'127.0.0.1',port:43308,user:'root',password:'lcup-po-isolated-only'});
 const [[id]]=await c.query('SELECT @@datadir AS datadir,@@port AS port');
 const expected=path.resolve(__dirname,'../../tmp/lcup-po-correction-db/data').replaceAll('\\','/').toLowerCase();
 if(id.port!==43308||id.datadir.replaceAll('\\','/').replace(/\/$/,'').toLowerCase()!==expected)throw Error('Refusing non-disposable server');
 await c.query('SHUTDOWN');await c.end();fs.writeFileSync(path.resolve(__dirname,'../../docs/lcup-po-correction/disposable-shutdown.json'),JSON.stringify({guardVerified:true,shutdownRequested:true,...id},null,2)+'\n');
 console.log('Only the workspace-owned disposable server was shut down.');
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
