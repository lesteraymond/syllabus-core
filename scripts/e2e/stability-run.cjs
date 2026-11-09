'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'docs/e2e-stability-2026-11-05'),WORK=path.join(ROOT,'tmp/e2e-stability-2026-11-05');
const snapshot=JSON.parse(fs.readFileSync(path.join(OUT,'source-state.json'),'utf8')).snapshot;
const label=process.argv[2];if(!/^[a-z0-9-]+$/.test(label||''))throw Error('Explicit run label required');
const recommended={SYLLABUS_CHECK_CACHE_WARMUP:'on',SYLLABUS_CHECK_OUTPUT_PLAN:'on',SYLLABUS_CHECK_OUTPUT_FIELDS:'scoped'};
const off=Object.fromEntries(['CACHE_WARMUP','OUTPUT_PLAN','OUTPUT_FIELDS','COURSE_CONTEXT','V2_GROUPING','PROMPT_TRIM'].map(n=>['SYLLABUS_CHECK_'+n,'off']));
async function main(){
 const mode=label.endsWith('-on')?'on':'off',po=label.startsWith('po-'),suite=po?'po':label.startsWith('comprehensive')?'comprehensive':label.startsWith('budget')?'budget':'regression';
 const database='syllabus_e2e_po_1105_'+(po?'workflow_'+(mode==='on'?'optimized':'baseline'):suite);
 const env={...process.env,VITE_NEW_BUILDER:'true',PATH:'C:/xampp/apache/bin;'+process.env.PATH,OPENSSL_CONF:'C:/xampp/apache/conf/openssl.cnf',E2E_DB_PORT:'43310',E2E_SKIP_BOOTSTRAP:'1',E2E_NO_DDL:'1',E2E_DB_NAME:database,E2E_FRONT_PORT:'3864',E2E_PROXY_PORT:'3863',E2E_API_PORT:'3421',E2E_OUT_SUFFIX:'stability-'+label,E2E_TRACE_RUN:label,E2E_EXTRA_ENV:JSON.stringify({...off,...(mode==='on'?recommended:{})})};
 if(suite==='regression')env.E2E_NO_PROFILE='1';else delete env.E2E_NO_PROFILE;
 if(po)env.PO_E2E_PREPROVISIONED='1';
 const reset=cp.spawnSync(process.execPath,['scripts/e2e/stability-fixture.cjs',database],{cwd:snapshot,env,encoding:'utf8'});if(reset.status!==0)throw Error('Fixture reset refused: '+reset.stderr);fs.writeFileSync(path.join(OUT,label+'-fixture.json'),reset.stdout);
 const log=path.join(WORK,label+'.log'),fd=fs.openSync(log,'w'),start=new Date().toISOString();
 const args=['-r','./scripts/e2e/stability-no-ddl.cjs','-r','./scripts/e2e/stability-trace.cjs',...(po?['scripts/po-controlled-activation/checker-browser.cjs',mode==='on'?'optimized':'baseline']:['scripts/e2e/run-comprehensive-ui.cjs','--suite='+suite])];
 const exit=await new Promise((resolve,reject)=>{const child=cp.spawn(process.execPath,args,{cwd:snapshot,env,windowsHide:true,stdio:['ignore',fd,fd]});fs.writeFileSync(path.join(WORK,'active-child.json'),JSON.stringify({pid:child.pid,label,start}));child.once('error',reject);child.once('exit',resolve);});fs.closeSync(fd);
 const report=po?path.join(snapshot,'docs/po-checker-integration/browser-'+(mode==='on'?'optimized':'baseline')+'/results.json'):path.join(snapshot,'docs/checker-comprehensive/ui-verification',suite+(suite==='regression'?'-baseline-no-profile':'')+'-stability-'+label,'results.json');
 const result={label,start,finished:new Date().toISOString(),exit,suite,mode,configuration:JSON.parse(env.E2E_EXTRA_ENV),snapshot,migrationsExecuted:0,log:path.relative(ROOT,log),resultPath:report,result:fs.existsSync(report)&&fs.statSync(report).mtimeMs>=Date.parse(start)?JSON.parse(fs.readFileSync(report,'utf8')):null};
 fs.writeFileSync(path.join(OUT,label+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({label,exit,summary:result.result?.summary||null}));process.exitCode=exit||0;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
