'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/lcup-comprehensive-verification');
const groups=JSON.parse(fs.readFileSync(path.join(root,'docs/lcup-policy-v2-implementation/test-results.json'),'utf8')).map(g=>({name:g.name,args:g.command.slice(1),log:g.name.startsWith('V2 ')?g.log:'existing-'+g.log}));
const covered=new Set(groups.flatMap(g=>g.args));
const additional=['anthropic-client.test.js','anthropic-schema.test.js','answer-review.test.js','recommendation-review.test.js','reference-format.test.js','retry.test.js','cooldown.test.js','provider-contract.test.js'];
const available=additional.filter(f=>fs.existsSync(path.join(root,'server/lib/syllabuscheck',f))&&!covered.has('server/lib/syllabuscheck/'+f));
if(available.length)groups.push({name:'Additional safe provider/reference contracts',args:['--test',...available.map(f=>'server/lib/syllabuscheck/'+f)],log:'existing-additional.log'});
const results=[];for(const g of groups){const r=spawnSync(process.execPath,g.args,{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:25*1024*1024}),log=(r.stdout||'')+(r.stderr||'')+(r.error?String(r.error):'');fs.writeFileSync(path.join(out,g.log),log);const count=k=>Number(log.match(new RegExp('(?:# |ℹ )'+k+' (\\d+)'))?.[1]||0);const record={name:g.name,command:['node',...g.args],log:g.log,exitCode:r.status,tests:count('tests'),passed:count('pass'),failed:count('fail'),skipped:count('skipped')};results.push(record);console.log(JSON.stringify(record));}
fs.writeFileSync(path.join(out,'existing-results.json'),JSON.stringify(results,null,2)+'\n');if(results.some(r=>r.exitCode!==0||r.failed||!r.tests))process.exitCode=1;
