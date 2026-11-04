'use strict';
// Explicit file-based opt-in; no .env loading, database, credentials or URL.
const fs=require('node:fs');
const {run}=require('../../server/lib/syllabuscheck/engine');
const {POLICY}=require('../../server/lib/syllabuscheck/academicPolicyV2');
const args=process.argv.slice(2),value=name=>args[args.indexOf(name)+1];
if(!args.includes('--input')){console.error('Usage: node preview.cjs --input <content-masters-replay.json> [--output <new-report.json>]');process.exitCode=1;}
else (async()=>{
 const data=JSON.parse(fs.readFileSync(value('--input'),'utf8'));
 const report=await run(data.content,data.masters,{academicPolicy:POLICY.id,offlineReplay:data.offlineReplay});
 const text=JSON.stringify(report,null,2)+'\n';
 if(args.includes('--output'))fs.writeFileSync(value('--output'),text,{flag:'wx'});else process.stdout.write(text);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
