'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,replay,POLICY}=require('../lcup-policy-v2-implementation/fixtures.cjs'),{run}=require('../../server/lib/syllabuscheck/engine');
const ids={'Content-course':'row2-content','Content-ILO':'row2-ilo0-contentilo','ILO-CLO':'row2-ilo0-clo:c3','Content-activity':'row2-contentactivity','ILO-activity':'row2-ilo0-activity','Content-assessment':'row2-contentassessment','Activity-assessment':'row2-activityassessment'};
for(const type of POLICY.weeklyTypes)for(const side of ['source','target'])test(type+' ignores generated scaffolding when original '+side+' is markup-only',async()=>{
 const f=fixture(),r=f.content.plan[2];
 if(side==='target'){if(['Content-ILO','ILO-CLO'].includes(type))r.ilos[0].text='** **';else if(['Content-activity','ILO-activity'].includes(type))r.activities='** **';else if(['Content-assessment','Activity-assessment'].includes(type))r.tasks='** **';else r.contents='** **';}
 else if(type==='Content-course')f.content.meta.title='** **';else if(['Content-ILO','Content-activity','Content-assessment'].includes(type))r.contents='** **';else if(type==='ILO-CLO')f.content.clos[2].statement='** **';else if(type==='ILO-activity')r.ilos[0].text='** **';else r.activities='** **';
 const before=JSON.stringify(f.content),report=await run(f.content,f.masters,{academicPolicy:POLICY.id,offlineReplay:replay(f.content,f.masters)}),j=report.academic.relationships.find(j=>j.id===ids[type]);assert.equal(j.status,'NOT_EVALUATED');assert.ok(j.reviewRequirements.includes('missing_evidence'));assert.equal(JSON.stringify(f.content),before);
});
