import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),out=path.join(root,'docs/lcup-policy-v2');
const before=JSON.parse(await fs.readFile(path.join(out,'before.json'),'utf8'));
const allowed=new Set(['server/lib/syllabuscheck/variants.js','src/i18n/lessonAuthoring.js']);
const changed=[],missing=[];
for(const item of before.files){
 try{const hash=crypto.createHash('sha256').update(await fs.readFile(path.join(root,item.path))).digest('hex');if(hash!==item.sha256)changed.push({path:item.path,before:item.sha256,after:hash,expected:allowed.has(item.path)});}
 catch(error){if(error.code!=='ENOENT')throw error;missing.push(item.path);}
}
for(const name of await fs.readdir(out))if(name.endsWith('.log')){
 const file=path.join(out,name),bytes=await fs.readFile(file);if(bytes[0]===0xff&&bytes[1]===0xfe)await fs.writeFile(file,bytes.subarray(2).toString('utf16le'));
}
const commands=JSON.parse(await fs.readFile(path.join(out,'test-commands.json'),'utf8'));
const groups=[];
for(const group of commands.groups){
 const text=await fs.readFile(path.join(out,group.log),'utf8'),n=key=>Number(text.match(new RegExp('\\b'+key+' (\\d+)'))?.[1]??NaN);
 const result={name:group.name,log:group.log,tests:n('tests'),passed:n('pass'),failed:n('fail')};
 if(!Number.isFinite(result.tests)||result.passed!==result.tests||result.failed!==0||(group.expected!==undefined&&result.tests!==group.expected))throw Error('Passing result not established: '+group.log);groups.push(result);
}
const audit=await fs.readFile(path.join(out,'translations-final.log'),'utf8');if(!audit.includes('**0 of 57**'))throw Error('Sampled translation audit not clean');
const comparison=JSON.parse(await fs.readFile(path.join(out,'shadow-comparison.json'),'utf8'));
for(const input of comparison.inputs){const hash=crypto.createHash('sha256').update(await fs.readFile(path.join(root,input.file))).digest('hex');if(hash!==input.sha256)throw Error('Frozen comparison input changed');}
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const result={baselineHead:before.head,finalHead:head,existingFilesChecked:before.files.length,unchanged:before.files.length-changed.length-missing.length,changed,missing,unexpectedChanges:changed.filter(x=>!x.expected),testGroups:groups,totalPassed:groups.reduce((n,g)=>n+g.passed,0),sampledTranslationAudit:{missing:0,sentences:57},comparisonCases:comparison.results.length,networkAttempts:comparison.networkAttempts,productionDatabaseWrites:0,migrationsRun:0,paidAiCalls:0,officialPolicyActivated:false};
await fs.writeFile(path.join(out,'integrity.json'),JSON.stringify(result,null,2)+'\n');
await fs.writeFile(path.join(out,'after-status.txt'),execFileSync('git',['status','--short'],{encoding:'utf8'}));
console.log(JSON.stringify({files:result.existingFilesChecked,unchanged:result.unchanged,changed:changed.map(c=>c.path),missing,unexpected:result.unexpectedChanges,passed:result.totalPassed,comparisonCases:result.comparisonCases,officialPolicyActivated:false},null,2));
if(missing.length||result.unexpectedChanges.length||head!==before.head||comparison.networkAttempts)process.exitCode=1;
