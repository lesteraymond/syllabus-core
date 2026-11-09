'use strict';
// Guard each browser runner/API process, including nested API instances.
if(process.env.E2E_DB_PORT!=='43310'||process.env.E2E_SKIP_BOOTSTRAP!=='1')throw Error('Preprovisioned isolated configuration is mandatory');
require('./db-port-redirect.cjs');
const mysql=require('../../server/node_modules/mysql2/promise');
const wrap=connection=>{const query=connection.query.bind(connection);connection.query=(sql,...args)=>{if(/^\s*(CREATE|ALTER|DROP|TRUNCATE|RENAME)\b/i.test(typeof sql==='string'?sql:sql.sql||''))throw Error('DDL/migrations prohibited by readiness audit');return query(sql,...args);};return connection;};
const createConnection=mysql.createConnection.bind(mysql);mysql.createConnection=async(...args)=>wrap(await createConnection(...args));
const createPool=mysql.createPool.bind(mysql);mysql.createPool=(...args)=>{const pool=wrap(createPool(...args)),get=pool.getConnection.bind(pool);pool.getConnection=async(...args)=>wrap(await get(...args));return pool;};
