'use strict';
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const {fixture,replay,POLICY}=require('../lcup-policy-v2-implementation/fixtures.cjs'),{run}=require('../../server/lib/syllabuscheck/engine'),{plan}=require('../../server/lib/syllabuscheck/academicV2Plan'),{replayOptions}=require('../../server/lib/syllabuscheck/academicV2Replay');
const {align,courseOf,resetProviderBlock}=require('../../server/lib/syllabuscheck/gemini'),{planCostOf}=require('../../server/lib/syllabuscheck/eval/claudeEvaluation'),{claudePrices}=require('../../server/lib/syllabuscheck/eval/providerGuard'),{PRICES_AS_OF}=require('../../server/lib/syllabuscheck/anthropicClient');
const out=path.resolve(__dirname,'../../docs/lcup-comprehensive-verification');
async function measured(name,edit){const f=fixture();edit?.(f.content);const p=plan(f.content,f.masters),data=replay(f.content,f.masters),before=process.memoryUsage(),start=performance.now();const r=await run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:data});return {name,elapsedMs:performance.now()-start,heapDeltaBytes:process.memoryUsage().heapUsed-before.heapUsed,rssBytes:process.memoryUsage().rss,pairCount:p.pairs.length,requiredWeeklyCells:p.weekly.length,retainedRelationshipRecords:r.academic.relationships.length,adapterRequests:r.academic.provenance.adapterRequests,disposition:r.academic.disposition,contextLimited:p.unavailable.size,liveCalls:0};}
(async()=>{
 const nativeFetch=globalThis.fetch;let external=0;globalThis.fetch=async()=>{external++;throw Error('Offline performance only');};
 try{const rows=[];rows.push(await measured('small partial syllabus',c=>c.plan=c.plan.slice(0,2)));rows.push(await measured('full 18-week syllabus'));
 rows.push(await measured('six ILOs per instructional lesson',c=>c.plan.forEach(r=>{if(r.kind==='lesson')r.ilos=Array.from({length:6},(_,i)=>({...structuredClone(r.ilos[0]),id:r.id+'-i'+i,text:r.ilos[0].text+' Example '+i}));})));
 rows.push(await measured('grouped Week 1–2',c=>{c.plan[0].week='1-2';c.plan.splice(1,1);}));rows.push(await measured('long academic cell',c=>c.plan[2].contents='Java programming method and signal. '.repeat(400)));
 const start=performance.now(),concurrent=await Promise.all(Array.from({length:4},()=>measured('concurrent independent preview'))),wall=performance.now()-start;
 const f=fixture(),p=plan(f.content,f.masters),data=replay(f.content,f.masters),adapter=replayOptions(data,p),bodies=[];
 const capture=async(_url,req)=>{bodies.push(req.body);return adapter.transport(_url,req);};resetProviderBlock();
 for(let i=0;i<p.pairs.length;i+=120)await align(f.content,f.masters,{...adapter,transport:capture,pairs:p.pairs.slice(i,i+120),course:courseOf(f.content)});
 const model=adapter.env.ANTHROPIC_MODEL,cost=planCostOf(bodies,claudePrices(model));
 const result={scope:'Offline Node performance and mock provider; not live latency, throughput, accuracy or billing',node:process.version,rows,concurrent:{count:4,wallMs:wall,requests:concurrent.reduce((n,r)=>n+r.adapterRequests,0),rows:concurrent},promptPlan:{model,priceBasisDate:PRICES_AS_OF,bodyCount:bodies.length,bodyBytes:bodies.reduce((n,b)=>n+Buffer.byteLength(b),0),...cost,note:'Existing repository-pinned prices and heuristic estimates, not a current quote or approved spend. Main-pass request bodies only; conditional C2/retries add calls. No price endpoint called.'},externalNetworkAttempts:external,paidCalls:0,peakProcessRssKilobytes:process.resourceUsage().maxRSS};
 fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(external)process.exitCode=1;
 }finally{globalThis.fetch=nativeFetch;resetProviderBlock();}
})().catch(e=>{console.error(e);process.exitCode=1;});
