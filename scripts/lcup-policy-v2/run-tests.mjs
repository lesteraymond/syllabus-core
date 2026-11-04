import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'docs/lcup-policy-v2');
// Read the existing targeted suite, but write fresh logs only under this task.
const previous=JSON.parse(await fs.readFile(path.join(root,'docs/lcup-requirements/test-commands.json'),'utf8')).groups;
const groups=[...previous.map(g=>({...g,log:'regression-'+g.log})),
 {name:'Compatibility fixes and existing prompt variants',log:'compatibility-final.log',expected:9,args:['--test','scripts/lcup-policy-v2/compatibility.test.mjs','server/lib/syllabuscheck/variants.test.js']},
 {name:'Policy V2 isolated projection',log:'projection-tests.log',expected:22,args:['--test','scripts/lcup-policy-v2/projection.test.cjs']},
 {name:'Existing C3 addendum contracts',log:'c3-addendum-tests.log',args:['--test','server/lib/syllabuscheck/stage-c3-addendum.test.js']},
];
await fs.writeFile(path.join(out,'test-commands.json'),JSON.stringify({groups},null,2)+'\n');
const results=await Promise.allSettled(groups.map(group=>new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,group.args,{cwd:root,windowsHide:true});let output='';
 child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});child.on('error',reject);
 child.on('close',async code=>{try{await fs.writeFile(path.join(out,group.log),output);console.log(`${group.name}: exit ${code}`);resolve(code);}catch(error){reject(error);}});
})));
if(results.some(r=>r.status==='rejected'||r.value!==0))process.exitCode=1;
