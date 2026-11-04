'use strict';
const path=require('node:path'),fs=require('node:fs'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),preload=path.join(__dirname,'isolate-evidence.cjs').replaceAll('\\','/');
const r=spawnSync(process.execPath,['scripts/lcup-comprehensive-verification/run-integration.mjs','--test-name-pattern','a malformed saved'],{cwd:root,encoding:'utf8',maxBuffer:8e6,env:{...process.env,NODE_OPTIONS:'--require "'+preload+'"'}});
fs.writeFileSync(path.join(root,'docs/lcup-v2-evaluation/original-failure-sql.log'),(r.stdout||'')+(r.stderr||''));process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');process.exitCode=r.status??1;
