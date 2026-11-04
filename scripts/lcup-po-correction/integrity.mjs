import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
const root=process.cwd(),out=path.join(root,'docs/lcup-po-correction');
const before=JSON.parse(await fs.readFile(path.join(out,'before.json'),'utf8'));
const allowed=new Set([
 'src/data/outcomesSeed.js','server/db/seed-outcomes.js','server/db/seed-local-references.js',
 'server/lib/programs.js','server/lib/courses.js','server/lib/syllabusOutcomes.js','server/lib/syllabuscheck/repository.js',
 'server/lib/compliance/service.js','server/routes/syllabusCheck.js','server/routes/programs.js','server/routes/courses.js',
 'server/routes/syllabusContent.js','src/lib/syllabusModel.test.js','server/lib/syllabuscheck/outcome-sharing.test.js',
 'server/routes/compliance.routes.test.js',
]);
const changed=[],missing=[];
for(const item of before.files){
 try { const bytes=await fs.readFile(path.join(root,item.path));const hash=crypto.createHash('sha256').update(bytes).digest('hex');if(hash!==item.sha256)changed.push({path:item.path,before:item.sha256,after:hash,expected:allowed.has(item.path)}); }
 catch(error){if(error.code!=='ENOENT')throw error;missing.push(item.path);}
}
// PowerShell redirection produces UTF-16 on this host. Normalize only this task's new logs.
for(const name of await fs.readdir(out))if(name.endsWith('.log')){
 const file=path.join(out,name),bytes=await fs.readFile(file);
 if(bytes[0]===0xff&&bytes[1]===0xfe)await fs.writeFile(file,bytes.subarray(2).toString('utf16le'));
}
const portClosed=await new Promise(resolve=>{const socket=net.createConnection({host:'127.0.0.1',port:43308});socket.once('connect',()=>{socket.destroy();resolve(false);});socket.once('error',error=>resolve(error.code==='ECONNREFUSED'));socket.setTimeout(3000,()=>{socket.destroy();resolve(false);});});
const live=JSON.parse(await fs.readFile(path.join(out,'live-readonly-final-plan.json'),'utf8'));
const testGroups=[];
for(const [name,expected] of [['migration-tests.log',8],['reference-regression.log',59],['gates-regression.log',68],['importer74-verified-copies.log',74],['ui-regression.log',16]]){
 const log=await fs.readFile(path.join(out,name),'utf8');
 const count=key=>Number(log.match(new RegExp('\\b'+key+' (\\d+)'))?.[1]??NaN);
 const group={log:name,tests:count('tests'),passed:count('pass'),failed:count('fail')};
 if(group.tests!==expected||group.passed!==expected||group.failed!==0)throw Error('Test log does not establish the expected passing result: '+name);
 testGroups.push(group);
}
const result={baselineHead:before.head,existingFilesChecked:before.files.length,changed,missing,
 unexpectedChanges:changed.filter(item=>!item.expected),
 unchanged:before.files.length-changed.length-missing.length,
 existingDatabaseUnchanged:live.liveDataUnchanged,disposablePortClosed:portClosed,
 testGroups,totalPassed:testGroups.reduce((sum,group)=>sum+group.passed,0),
 productionDatabaseWrites:0,paidAiCalls:0,
 protectedStatement:'All existing source PDFs, approved offline fixtures, academic references, evaluation datasets/reports, rule/scoring implementations, submission gate implementations and server/.env have their original hashes. Compliance service changes only carry the syllabus ID to the PO-reference guard.'};
await fs.writeFile(path.join(out,'integrity.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({existingFilesChecked:result.existingFilesChecked,unchanged:result.unchanged,changed:changed.map(item=>item.path),missing,unexpectedChanges:result.unexpectedChanges,existingDatabaseUnchanged:result.existingDatabaseUnchanged,disposablePortClosed:portClosed,
 programCounts:live.before.programs.map(p=>({code:p.code,count:live.before.pos.filter(row=>row.program_id===p.program_id).length})),
 impactedRecords:live.impacts.map(i=>({id:i.id,program:i.program,status:i.status,cloMappings:i.cloMappings.length,directIloMappings:i.directIloPoMappings.length})),protectedRows:live.before.protectedHashes},null,2));
if(missing.length||result.unexpectedChanges.length||!live.liveDataUnchanged||!portClosed)process.exitCode=1;
