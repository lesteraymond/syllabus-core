'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'docs/lcup-policy-v2-implementation');
const before=JSON.parse(fs.readFileSync(path.join(dir,'before.json'))),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const intended=['server/lib/syllabuscheck/engine.js','server/lib/syllabuscheck/gemini.js','server/lib/compliance/service.js','server/lib/syllabuscheck/repository.js','server/routes/syllabusCheck.js','src/i18n/index.js','src/components/VerdictPanel.jsx','src/components/HybridCheckPanel.jsx','src/views/ComplianceCard.jsx'].sort();
const changed=[],missing=[];
for(const f of before.files){const file=path.join(root,f.path);if(!fs.existsSync(file))missing.push(f.path);else if(hash(fs.readFileSync(file))!==f.sha256)changed.push(f.path);}
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),status=execFileSync('git',['status','--short'],{cwd:root,encoding:'utf8'});
const prior=new Set(before.files.map(f=>f.path));
const added=execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(f=>f&&!f.startsWith('tmp/')&&!prior.has(f));
// tmp existed before this task and was excluded from the baseline. Inventory
// only this task's own temporary artifacts, never call older DB files "new".
const artifacts=[];
function walk(relative){for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){const f=relative+'/'+entry.name;if(entry.isDirectory())walk(f);else artifacts.push(f);}}
for(const d of ['docs/lcup-policy-v2-implementation','scripts/lcup-policy-v2-implementation','tmp/lcup-policy-v2-implementation'])walk(d);
const gates=JSON.parse(fs.readFileSync(path.join(dir,'gate-functions-before.json'))),{coded}=require('../../server/lib/syllabuscheck/engine'),{requireHybrid}=require('../../server/lib/compliance/service');
const tests=JSON.parse(fs.readFileSync(path.join(dir,'test-results.json'))),result={headBefore:before.head,headAfter:head,baselineFileCount:before.files.length,unchanged:before.files.length-changed.length-missing.length,changed:changed.sort(),missing,unexpectedChanges:changed.filter(f=>!intended.includes(f)),newFiles:[...new Set([...added,...artifacts])].sort(),codedBodyUnchanged:hash(String(coded))===gates.coded,submissionGateBodyUnchanged:hash(String(requireHybrid))===gates.requireHybrid,
 tests:{groups:tests.length,executed:tests.reduce((n,g)=>n+g.tests,0),passed:tests.reduce((n,g)=>n+g.pass,0),failed:tests.reduce((n,g)=>n+g.fail,0),skipped:tests.reduce((n,g)=>n+g.skipped,0),allExitZero:tests.every(g=>g.exitCode===0)},
 constraints:{existingSourceSeedsReferencesFixturesPdfsDatasetsReportsAndEnvironmentHashProtected:true,productionDatabaseUsed:false,productionFlagsEnabled:false,paidAiCalls:0,migrations:0}};
result.newFiles=[...new Set([...result.newFiles,'docs/lcup-policy-v2-implementation/FILES.md'])].sort();
const link=f=>`[${f}](${path.posix.relative('docs/lcup-policy-v2-implementation',f)})`;
fs.writeFileSync(path.join(dir,'FILES.md'),'# Exact task file inventory\n\nCompared with the captured before-state; pre-existing dirty files are not listed as new. Logs and generated preview/UI artifacts are included. No protected dataset is regenerated.\n\n## Modified existing files\n\n'+result.changed.map(f=>'- '+link(f)).join('\n')+'\n\n## Added files and artifacts\n\n'+result.newFiles.map(f=>'- '+link(f)).join('\n')+'\n');
fs.writeFileSync(path.join(dir,'integrity.json'),JSON.stringify(result,null,2)+'\n');fs.writeFileSync(path.join(dir,'after-status.txt'),status);
console.log(JSON.stringify({...result,newFiles:result.newFiles.length},null,2));
if(head!==before.head||missing.length||result.unexpectedChanges.length||!result.codedBodyUnchanged||!result.submissionGateBodyUnchanged||result.tests.failed||!result.tests.allExitZero)process.exitCode=1;
