'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/lcup-policy-v2-implementation');
const old=JSON.parse(fs.readFileSync(path.join(root,'docs/lcup-policy-v2/test-commands.json')));
// The old design-only projection suite pins source hashes to the pre-V2 engine.
// Keep that historical task artifact unchanged; the actual replacement is tested here.
const groups=old.groups.filter(g=>g.name!=='Policy V2 isolated projection');
groups.push({name:'V2 replacement policy',log:'policy-tests-final.log',args:['--test','scripts/lcup-policy-v2-implementation/policy.test.cjs']},
 {name:'V2 HTTP and persistence safety',log:'api-tests-final.log',args:['--test','scripts/lcup-policy-v2-implementation/api.test.cjs']},
 {name:'V2 bilingual UI',log:'ui-tests-final.log',args:['scripts/lcup-policy-v2-implementation/test-ui.mjs']},
 {name:'V2 context, references, CLI and comparison',log:'robustness-tests-final.log',args:['--test','scripts/lcup-policy-v2-implementation/robustness.test.cjs']});
const selected=process.argv.includes('--v2-only')?groups.filter(g=>g.name.startsWith('V2 ')):groups;
const results=process.argv.includes('--v2-only')?JSON.parse(fs.readFileSync(path.join(out,'test-results.json'))).filter(r=>!selected.some(g=>g.name===r.name)):[];
for(const group of selected){
 const r=spawnSync(process.execPath,group.args,{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:20*1024*1024});
 const log=(r.stdout||'')+(r.stderr||'')+(r.error?String(r.error):'');
 fs.writeFileSync(path.join(out,group.log),log);
 const count=key=>Number(log.match(new RegExp('(?:# |ℹ )'+key+' (\\d+)'))?.[1]||0);
 const result={name:group.name,command:['node',...group.args],log:group.log,exitCode:r.status,tests:count('tests'),pass:count('pass'),fail:count('fail'),skipped:count('skipped')};
 results.push(result);console.log(JSON.stringify(result));
}
fs.writeFileSync(path.join(out,'test-results.json'),JSON.stringify(results,null,2)+'\n');
if(results.some(r=>r.exitCode!==0||r.fail||!r.tests))process.exitCode=1;
