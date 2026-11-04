'use strict';
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const destination=path.join(root,'docs/lcup-approved-offline');
const hash=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const before=JSON.parse(fs.readFileSync(path.join(destination,'repository-before.json'),'utf8').replace(/^\uFEFF/,''));
const changes=[],unreadable=[];
for(const entry of before.files) {
  try { if(hash(entry.path)!==entry.sha256) changes.push(entry.path); }
  catch(e){unreadable.push({path:entry.path,error:e.code});}
}
const git=(...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8'}).trimEnd();
const status=git('status','--short').split(/\r?\n/);
const laterOnly=[{path:'docs/anthropic-p2-a2-report.md',sha256:hash('docs/anthropic-p2-a2-report.md'),limitation:'PowerShell initial hashing could not open this Word-locked historical report; no before hash available. Node can read it with sharing at the end. Task scripts do not target it.'}];
const result={branch:git('branch','--show-current'),head:git('rev-parse','HEAD'),status,
  initialFilesHashed:before.files.length,existingFilesChanged:changes,unreadable,
  initialHashException:laterOnly,
  originalStatusEntriesPreserved:before.status.every(s=>status.includes(s)),
  addedStatusEntries:status.filter(s=>!before.status.includes(s)),
  assertions:{sameBranch:git('branch','--show-current')===before.branch,sameHead:git('rev-parse','HEAD')===before.head,existingHashesUnchanged:!changes.length&&!unreadable.length},
  safety:{aiRequests:0,databaseWrites:0,migrations:0,productionFixes:0,commits:0,pushes:0,deployments:0}};
fs.writeFileSync(path.join(destination,'repository-after.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({initialFilesHashed:result.initialFilesHashed,existingFilesChanged:changes,unreadable,addedStatusEntries:result.addedStatusEntries,assertions:result.assertions}));
if(changes.length||unreadable.length||!result.originalStatusEntriesPreserved)process.exitCode=1;
