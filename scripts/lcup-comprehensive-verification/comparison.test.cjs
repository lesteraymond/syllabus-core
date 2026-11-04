'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {compare}=require('../lcup-policy-v2-implementation/compare.cjs');
const historical=require('../../docs/lcup-policy-v2-implementation/comparison.json');
let current;
test.before(async()=>{current=await compare();fs.writeFileSync(path.resolve(__dirname,'../../docs/lcup-comprehensive-verification/comparison.json'),JSON.stringify(current,null,2)+'\n');});
for(const previous of historical.results)test(`current legacy/V2 replay: ${previous.id}`,()=>{
 const actual=current.results.find(r=>r.id===previous.id);assert.ok(actual);assert.equal(current.networkAttempts,0);assert.equal(current.paidAiCalls,0);assert.equal(current.databaseWrites,0);
 assert.equal(actual.v2.officialScore,null);assert.equal(actual.v2.compliance,previous.v2.compliance);assert.equal(actual.v2.academic,previous.v2.academic);assert.equal(actual.legacy.candidate,previous.legacy.candidate);
 if(actual.kind==='verified-source-no-semantic-judgments')assert.equal(actual.v2.weeklyDisposition,'NOT_EVALUATED');
 else assert.deepEqual(actual.v2.academicDeductions,[]);
 if(actual.id==='complete-off-course-content'){assert.equal(actual.legacy.candidate,100);assert.equal(actual.v2.compliance,100);assert.equal(actual.v2.weeklyFailed.length,60);assert.equal(actual.v2.academic,'REQUIRES_REVISION');}
 if(actual.id==='legacy-ILO-assessment-only'){assert.equal(actual.legacy.candidate,97);assert.equal(actual.v2.academic,'SUPPORTED_BY_SUPPLIED_EVIDENCE');}
 if(actual.id==='AI-unavailable')assert.equal(actual.v2.academic,'NOT_EVALUATED');
});
