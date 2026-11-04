'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/lcup-academic-benchmark');
const groups=[
 {name:'Repeatable package verification',args:['scripts/lcup-academic-benchmark/build.cjs','--check'],log:'package-check.log',commandOnly:true},
 {name:'Benchmark provenance, blank faculty forms, citations, metrics and preservation',args:['--test','scripts/lcup-academic-benchmark/benchmark.test.cjs'],log:'benchmark-tests.log'},
 {name:'Unchanged Policy V2 replacement, API, reference safety and comparison regressions',args:['--test','scripts/lcup-policy-v2-implementation/policy.test.cjs','scripts/lcup-policy-v2-implementation/api.test.cjs','scripts/lcup-policy-v2-implementation/robustness.test.cjs'],log:'policy-v2-regressions.log'},
 {name:'Reused evaluation metrics',args:['--test','server/lib/syllabuscheck/eval-quality-metrics.test.js','server/lib/syllabuscheck/eval/eval.test.js'],log:'existing-metrics-tests.log'},
 {name:'Existing seven-relationship and C3 requirements',args:['--test','scripts/lcup-requirements/requirements.test.cjs','server/lib/syllabuscheck/stage-c3.test.js'],log:'existing-chain-tests.log'},
];
const results=[];for(const group of groups){const r=spawnSync(process.execPath,group.args,{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:20*1024*1024}),log=(r.stdout||'')+(r.stderr||'')+(r.error?String(r.error):'');fs.writeFileSync(path.join(out,group.log),log);const count=k=>Number(log.match(new RegExp('(?:# |ℹ )'+k+' (\\d+)'))?.[1]||0),result={name:group.name,command:['node',...group.args],log:group.log,exitCode:r.status,tests:count('tests'),passed:count('pass'),failed:count('fail'),skipped:count('skipped'),commandOnly:!!group.commandOnly};results.push(result);console.log(JSON.stringify(result));}
fs.writeFileSync(path.join(out,'test-results.json'),JSON.stringify(results,null,2)+'\n');if(results.some(r=>r.exitCode!==0||r.failed||!r.tests&&!r.commandOnly))process.exitCode=1;
