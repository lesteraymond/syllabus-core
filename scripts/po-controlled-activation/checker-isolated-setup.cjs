'use strict';
const fs=require('node:fs'),path=require('node:path');
const mysql=require('../../server/node_modules/mysql2/promise');
(async()=>{const db=await mysql.createConnection({host:'127.0.0.1',port:43310,user:'root',password:'lcup-po-isolated-only'});
 try{const [[r]]=await db.query('SELECT @@port AS port,@@datadir AS datadir,@@event_scheduler AS scheduler');
  if(r.port!==43310||path.resolve(r.datadir).toLowerCase()!==path.resolve('tmp/po-checker-integration/db/data').toLowerCase()||r.scheduler!=='OFF')throw Error('STOP wrong isolated server');
  const [accounts]=await db.query("SELECT Host FROM mysql.user WHERE User='root' AND Host IN ('localhost','127.0.0.1','::1')");
  for(const account of accounts)await db.query("ALTER USER 'root'@'"+account.Host+"' IDENTIFIED BY ''");
  fs.writeFileSync('docs/po-checker-integration/isolated-identity.json',JSON.stringify({...r,syntheticOnly:true,developmentDataCopied:false},null,2));console.log(JSON.stringify({port:r.port,isolatedIdentityVerified:true,eventsOff:true}));
 }finally{await db.end();}
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
