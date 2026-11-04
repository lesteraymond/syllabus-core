import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const root=process.cwd(),out=path.join(root,'docs/lcup-requirements'),require=createRequire(import.meta.url);
const baseline=JSON.parse(await fs.readFile(path.join(out,'before.json'),'utf8'));
const allowed=new Set([
 'server/lib/syllabuscheck/acceptance.js','server/lib/syllabuscheck/engine.js','server/lib/syllabuscheck/gemini.js',
 'server/lib/syllabuscheck/identity.js','server/lib/syllabuscheck/stages.js','server/lib/syllabuscheck/verdict.js',
 'server/routes/catalog.routes.test.js','src/i18n/index.js','src/lib/syllabusModel.js','src/lib/syllabusModel.test.js',
 'src/views/builder2/PlanStep.jsx','src/views/builder2/parts.jsx',
]);
const changed=[],missing=[];
for(const item of baseline.files){
 try{const hash=crypto.createHash('sha256').update(await fs.readFile(path.join(root,item.path))).digest('hex');if(hash!==item.sha256)changed.push({path:item.path,before:item.sha256,after:hash,expected:allowed.has(item.path)});}
 catch(error){if(error.code!=='ENOENT')throw error;missing.push(item.path);}
}
for(const name of await fs.readdir(out))if(name.endsWith('.log')){
 const file=path.join(out,name),bytes=await fs.readFile(file);if(bytes[0]===0xff&&bytes[1]===0xfe)await fs.writeFile(file,bytes.subarray(2).toString('utf16le'));
}
const tests=[];
const {groups}=JSON.parse(await fs.readFile(path.join(out,'test-commands.json'),'utf8'));
for(const {log,expected} of groups){
 const text=await fs.readFile(path.join(out,log),'utf8'),n=key=>Number(text.match(new RegExp('\\b'+key+' (\\d+)'))?.[1]??NaN);
 const result={log,tests:n('tests'),passed:n('pass'),failed:n('fail')};
 if(result.tests!==expected||result.passed!==expected||result.failed!==0)throw Error('Successful result not established by '+log);tests.push(result);
}
// Run a synthetic syllabus through the real local configuration. Never open the
// DB or permit network access, even if configuration has changed since inspection.
const env=require('../../server/node_modules/dotenv').parse(await fs.readFile('server/.env'));
const {sample}=require('../../server/lib/syllabuscheck/fixtures'),{run}=require('../../server/lib/syllabuscheck/engine');
const {providerConfig}=require('../../server/lib/syllabuscheck/gemini');
const sampleData=sample(),priorFetch=globalThis.fetch;let requestAttempts=0;
const rejectNetwork=async()=>{requestAttempts++;throw Error('Network blocked in requirements verification');};
globalThis.fetch=rejectNetwork;
let result;
try{result=await run(sampleData.content,sampleData.masters,{env,useAi:true,transport:rejectNetwork,refFetch:rejectNetwork,linkChecker:async url=>({url,status:'ok',httpStatus:200})});}
finally{globalThis.fetch=priorFetch;}
const configuredExecution={scope:'Synthetic fixture through real local configuration; no server process or database exercised',provider:providerConfig(env),stages:result.hybrid.stages,alignmentStatus:result.hybrid.alignment.status,failure:result.hybrid.alignment.failure,reason:result.hybrid.alignment.reason,codedChecks:result.hybrid.codedChecks.length,academicJudgements:result.hybrid.alignment.judgements.length,providerRequestAttempts:requestAttempts};
await fs.writeFile(path.join(out,'configured-execution.json'),JSON.stringify(configuredExecution,null,2)+'\n');
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const integrity={baselineHead:baseline.head,finalHead:head,existingFilesChecked:baseline.files.length,unchanged:baseline.files.length-changed.length-missing.length,changed,missing,unexpectedChanges:changed.filter(x=>!x.expected),tests,totalPassed:tests.reduce((n,t)=>n+t.passed,0),productionDatabaseWrites:0,migrationsRun:0,paidAiCalls:0,configuredExecution};
await fs.writeFile(path.join(out,'integrity.json'),JSON.stringify(integrity,null,2)+'\n');
await fs.writeFile(path.join(out,'after-status.txt'),execFileSync('git',['status','--short'],{encoding:'utf8'}));
console.log(JSON.stringify({checked:integrity.existingFilesChecked,unchanged:integrity.unchanged,changed:changed.map(x=>x.path),missing,unexpectedChanges:integrity.unexpectedChanges,totalPassed:integrity.totalPassed,configuredExecution},null,2));
if(missing.length||integrity.unexpectedChanges.length||head!==baseline.head||requestAttempts)process.exitCode=1;
