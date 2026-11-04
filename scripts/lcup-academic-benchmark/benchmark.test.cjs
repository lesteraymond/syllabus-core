'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {prepare,outputs,writePackage,A_FIELDS,B_FIELDS}=require('./build.cjs');
const {references,sha,root}=require('./references.cjs');
const {POLICY,hash}=require('../../server/lib/syllabuscheck/academicV2Plan');
const {parseCsv}=require('../import-align1-faculty-responses.cjs');
const {replay}=require('../lcup-policy-v2-implementation/fixtures.cjs');
const {measure}=require('./measure.cjs');
const {Window}=require('happy-dom');
const priorFetch=globalThis.fetch;let network=0;
globalThis.fetch=async()=>{network++;throw Error('Benchmark preparation forbids network');};
const envBefore={...process.env};
const p=prepare(),files=outputs(p),clone=structuredClone;
test.after(()=>{globalThis.fetch=priorFetch;assert.equal(network,0);assert.deepEqual({...process.env},envBefore);});
const model=()=>({version:p.dataset.version,benchmarkHash:p.dataset.benchmarkHash,policyVersion:POLICY.id,provenance:'synthetic-test-only',plannedCaseIds:[],observations:[]});
const chosen=type=>p.dataset.cases.find(c=>c.contextId==='ctx-S01'&&c.relationshipType===type);
function adjudicate(c,label){return {id:c.id,caseHash:c.caseHash,reviewStatus:'adjudicated',adjudicatorId:'MOCK panel',reviewerIds:['MOCK R1','MOCK R2'],reviewedAt:'2026-10-29',acceptedJudgments:[label],ambiguous:false,reason:'Synthetic metric software test, not a faculty judgment.',recordRef:'synthetic-test-only',sourceEvidence:c.sourceText.slice(0,20),targetEvidence:c.targetText.slice(0,20)};}
function observation(c,label='ALIGNED'){
 const context=p.dataset.contexts[c.contextId],data=replay(context.content,context.masters,pair=>({label:pair.id===c.pairId?label:'ALIGNED'})),raw=clone(data.judgements.find(j=>j.id===c.pairId));
 return {id:c.id,caseHash:c.caseHash,attempted:true,judgment:raw};
}
function score(c,gold,answer,extra={}){const a={...clone(p.adjudication),provenance:'synthetic-test-only',adjudications:[adjudicate(c,gold)]},m=model();m.plannedCaseIds=[c.id];if(answer)m.observations.push(answer);return measure(p.dataset,a,m,{testOnly:true,...extra});}

test('all faculty templates and dataset expectations are blank, never developer answers',()=>{
 for(const c of p.dataset.cases){assert.equal(c.expectedJudgment,null);assert.equal(c.reviewStatus,'unassigned');}
 for(const row of p.responseA.responses){assert.equal(row.reviewStatus,'unassigned');for(const k of A_FIELDS)assert.equal(row[k],null,k);}
 for(const row of p.responseB.responses){assert.equal(row.reviewStatus,'unassigned');for(const k of B_FIELDS)assert.equal(row[k],null,k);}
 for(const row of p.responseB.responses){const proposal=p.proposals.find(r=>r.id===row.id);assert.equal(row.caseHash,proposal.caseHash);assert.equal(row.proposalHash,proposal.proposalHash);}
 for(const row of p.adjudication.adjudications){assert.deepEqual(row.acceptedJudgments,[]);assert.equal(row.adjudicatorId,null);assert.deepEqual(row.reviewerIds,[]);}
 assert.ok(p.coordinator.constructionIntents.every(r=>r.facultyJudgment===null));
});
test('case IDs and hashes are unique and regenerated output is byte-repeatable',()=>{
 assert.equal(new Set(p.dataset.cases.map(c=>c.id)).size,p.dataset.cases.length);assert.equal(new Set(p.dataset.cases.map(c=>c.caseHash)).size,p.dataset.cases.length);assert.deepEqual(outputs(prepare()),files);
});
test('all original fixture contents and mappings survive unchanged in the real contexts',()=>{
 for(const key of ['it202','ie402','cpe304']){const f=JSON.parse(fs.readFileSync(path.join(root,`docs/lcup-approved-offline/${key}.fixture.json`),'utf8')),context=p.dataset.contexts['ctx-'+key];assert.deepEqual(context.content,f.content);assert.deepEqual(context.rawEvidence,f.evidence);assert.equal(context.source.sha256,f.source.sha256);assert.equal(sha(fs.readFileSync(path.join(root,context.source.file))),f.source.sha256);}
});
test('all case source files match hashes; real cases have positive PDF pages',()=>{
 for(const ref of p.dataset.sourceManifest)assert.equal(sha(fs.readFileSync(path.join(root,ref.file))),ref.sha256,ref.file);
 for(const c of p.dataset.cases){for(const ref of c.sourceRefs)assert.equal(sha(fs.readFileSync(path.join(root,ref.file))),ref.sha256,ref.file);if(c.sourceKind==='verified-syllabus')assert.ok(c.sourceRefs.some(r=>r.file.endsWith('.pdf')&&r.pages?.length&&r.pages.every(n=>n>0)));}
});
test('ILO–CLO citations include both weekly and mapped CLO source pages',()=>{
 for(const c of p.dataset.cases.filter(c=>c.sourceKind==='verified-syllabus'&&c.relationshipType==='ILO-CLO')){if(c.pairId.endsWith('unassigned-clo')){assert.equal(c.sourceText,'');continue;}const context=p.dataset.contexts[c.contextId],cloId=c.pairId.split('-clo:')[1],i=context.content.clos.findIndex(x=>x.id===cloId),pages=context.rawEvidence.outcomes['CLO'+(i+1)].pages,pdf=c.sourceRefs.find(r=>r.file.endsWith('.pdf'));assert.ok(pages.every(n=>pdf.pages.includes(n)));}
});
for(const program of ['BSIT','BSIT-CYBERSECURITY','BSIE','BSCPE'])test(`${program}: all seven independent relationships and course-level requirements are represented`,()=>{
 const cases=p.dataset.cases.filter(c=>c.program===program);for(const type of [...POLICY.weeklyTypes,'Course-CLO','CLO-PO','CLO-EGA','CLO-classification','Title-description','Description-plan','Week1-introduction','Activity-fit','Module-value','Value-use','Assessment-fit','APA7-text','Schedule','Four-CLOs','Required-fields'])assert.ok(cases.some(c=>c.relationshipType===type),type);
});
test('Cyber has no invented approved syllabus and keeps its separate curriculum/title',()=>{
 const contexts=Object.values(p.dataset.contexts).filter(c=>c.program==='BSIT-CYBERSECURITY');assert.ok(contexts.every(c=>c.sourceKind==='synthetic'));for(const c of contexts){assert.equal(c.course.curriculumYear,'2025-2026');assert.equal(c.course.code,'IT-202');assert.equal(c.course.title,'SYSTEM INTEGRATION AND ARCHITECTURE 1');assert.equal(c.masters.outcomeSource,'BSIT');assert.equal(c.masters.pos.length,9);}assert.equal(p.referenceReport.programs.find(c=>c.program==='BSIT-CYBERSECURITY').realSyllabusAvailable,false);
});
test('official PO counts, numbering, PDF hashes and full engineering PO12 are retained',()=>{
 const r=references();for(const source of r.poSources){assert.equal(source.count,source.program==='BSIT'?9:13);assert.deepEqual(source.numbering,Array.from({length:source.count},(_,i)=>i+1));if(source.program!=='BSIT')assert.match(source.po12.text,/to manage projects and in multidisciplinary environments\./);}
 const base=r.official.programs.BSIT.outcomes;for(const c of Object.values(p.dataset.contexts).filter(c=>c.sourceKind==='synthetic'&&c.program.startsWith('BSIT')))assert.deepEqual(c.masters.pos,base);
});
test('real PO cases display the authored meaning with an explicit hold, never silently remapped official numbers',()=>{
 for(const c of p.dataset.cases.filter(c=>c.sourceKind==='verified-syllabus'&&c.relationshipType==='CLO-PO')){const context=p.dataset.contexts[c.contextId],no=Number(/-po(\d+)$/.exec(c.pairId)[1]);assert.equal(c.sourceText,context.content.outcomes.pos.find(p=>p.no===no)?.text||'');assert.equal(c.reviewOnlyUntilBasisResolved,true);assert.equal(c.claudeEligibility,'held_for_reference_or_context_review');}
});
test('synthetic construction intents cover requested contrasts without becoming reviewer labels',()=>{
 const intents=p.coordinator.constructionIntents.map(x=>x.constructionIntent);for(const s of ['coherent-candidate','partial-scope-candidate','unrelated-content-candidate','incorrect-mapping-candidate','ambiguous-candidate','missing-evidence'])assert.ok(intents.includes(s));assert.ok(intents.includes('Unrelated correction candidate'));assert.equal(p.proposals.length,8);assert.ok(p.proposals.every(p=>p.isClaudeOutput===false&&p.origin==='synthetic-proposal'));
});
test('grouped weeks, orientation, examinations and untagged source ILOs remain reviewable evidence',()=>{
 const contexts=Object.values(p.dataset.contexts).filter(c=>c.sourceKind==='verified-syllabus');assert.ok(contexts.some(c=>c.content.plan.some(r=>String(r.week).includes('-'))));assert.ok(contexts.every(c=>c.content.plan.some(r=>r.kind==='exam')));assert.ok(p.dataset.cases.some(c=>c.pairId.includes('unassigned-clo')&&c.sourceText===''));assert.ok(p.dataset.cases.some(c=>c.relationshipType==='Week1-introduction'));
 for(const c of p.dataset.cases.filter(c=>c.requiredWeekly)){const context=p.dataset.contexts[c.contextId],i=Number(/^row(\d+)-/.exec(c.pairId)[1]);assert.notEqual(context.content.plan[i].kind,'exam');}
});
test('public JSON/HTML contains no construction intents, model answers or faculty defaults',()=>{
 for(const program of ['BSIT','BSIT-CYBERSECURITY','BSIE','BSCPE']){const html=files['faculty-'+program+'.html'];assert.ok(!html.includes('coherent-candidate'));assert.ok(!html.includes('Unrelated correction candidate'));assert.ok(!html.includes('academicJudgment'));const browser=new Window();browser.document.write(html);for(const node of browser.document.querySelectorAll('textarea'))assert.equal(node.value,'');for(const node of browser.document.querySelectorAll('select'))assert.equal(node.value,'');assert.ok(browser.document.querySelector('meta[http-equiv="Content-Security-Policy"]').content.includes("connect-src 'none'"));}
});
test('HTML escapes faculty/source text and JSON script boundaries safely',()=>{
 const q=clone(p);q.dataset.cases[0].sourceText='</pre><img src=x onerror=alert(1)>';q.responseA.responses[0].notes='</script><script>evil</script>';const html=require('./render.cjs').renderPartA(q,'BSIT');assert.ok(html.includes('&lt;/pre&gt;&lt;img'));assert.ok(!html.includes('</script><script>evil'));assert.ok(html.includes('\\u003c/script>'));
});
test('offline reviewer form exports only supplied answers with source bindings and no inferred labels',async()=>{
 const browser=new Window(),html=files['faculty-BSIT-CYBERSECURITY.html'];browser.document.write(html);let blob;browser.URL.createObjectURL=value=>{blob=value;return 'blob:mock';};browser.URL.revokeObjectURL=()=>{};browser.HTMLAnchorElement.prototype.click=()=>{};
 browser.eval(browser.document.querySelector('script').textContent);
 browser.document.querySelector('#reviewer').value='MOCK faculty reviewer';browser.document.querySelector('#date').value='2026-10-29';
 const first=browser.document.querySelector('article');first.querySelector('[data-field="expectedJudgment"]').value='PARTIALLY_ALIGNED';first.querySelector('[data-field="reason"]').value='Mock form-interaction test, not a faculty judgment.';
 browser.document.querySelector('#export').click();assert.ok(blob,browser.happyDOM.virtualConsolePrinter.readAsString());
 const result=JSON.parse(await blob.text());assert.equal(result.benchmarkHash,p.dataset.benchmarkHash);assert.equal(result.provenance,'faculty-return-unverified');assert.equal(result.responses[0].expectedJudgment,'PARTIALLY_ALIGNED');assert.equal(result.responses[0].reviewStatus,'returned');assert.ok(result.responses.slice(1).every(r=>r.expectedJudgment===null&&r.reviewStatus==='unassigned'));assert.equal(p.responseA.responses[0].expectedJudgment,null);
});
test('CSV writer/parser is reused and all faculty answer cells round-trip blank',()=>{
 const rows=parseCsv(files['faculty-part-a.responses.csv'].replace(/^\uFEFF/,'')),header=rows.shift();for(const r of rows.filter(r=>r.length>1)){for(const field of A_FIELDS)assert.equal(r[header.indexOf(field)],'');assert.equal(r[header.indexOf('reviewStatus')],'unassigned');}
});
test('package check is read-only and a changed faculty return cannot be overwritten, even by refresh',()=>{
 const dir=fs.mkdtempSync(path.join(root,'tmp/academic-benchmark-test-'));writePackage(dir,files);writePackage(dir,files,{check:true});const f=path.join(dir,'faculty-part-a.responses.json');const returned=clone(p.responseA);returned.responses[0].reviewerId='MOCK faculty';returned.responses[0].expectedJudgment='NOT_ALIGNED';returned.responses[0].reviewStatus='returned';fs.writeFileSync(f,JSON.stringify(returned));const before=fs.readFileSync(f);assert.throws(()=>writePackage(dir,files),/Refusing/);assert.throws(()=>writePackage(dir,files,{refreshUnassigned:true}),/edited|refused/);assert.deepEqual(fs.readFileSync(f),before);
});
test('unreviewed and unavailable data produces no accuracy percentage or academic approval',()=>{
 const m={...model(),provenance:'not-run'},r=measure(p.dataset,p.adjudication,m);assert.equal(r.status,'awaiting_faculty_adjudication');assert.equal(r.academic.facultyLabelled,0);assert.equal(r.academic.agreement,null);assert.equal(r.academic.falseApprovals.rate,null);assert.equal(r.academic.falseRejections.rate,null);assert.equal(r.operations.attempted,0);assert.equal(r.operations.planned,0);assert.equal(r.operations.notSelected,p.dataset.cases.filter(c=>c.kind==='academic-semantic').length);assert.equal(r.institutionalAcceptanceThreshold,null);assert.equal(r.academic.profileFalseApprovals,null);assert.equal(r.evidence.facultyRatings.relevanceOfEvidence.yesShare,null);
});
for(const type of POLICY.weeklyTypes)test(`${type}: reused metrics measure a controlled false approval independently`,()=>{
 const c=chosen(type),r=score(c,'NOT_ALIGNED',observation(c));assert.equal(r.scope,'synthetic-software-validation-only');assert.equal(r.academic.falseApprovals.judgedAligned,1);assert.equal(r.academic.byRelationship[type].falseApprovals.judgedAligned,1);assert.equal(r.academic.byProgram[c.program].facultyLabelled,1);
});
test('false rejections, ambiguous judgments and missing evaluations have separate denominators',()=>{
 const c=chosen('Content-activity'),r=score(c,'ALIGNED',observation(c,'NOT_ALIGNED'));assert.equal(r.academic.falseRejections.judgedOtherwise,1);
 const a={...clone(p.adjudication),provenance:'synthetic-test-only',adjudications:[{...adjudicate(c,'PARTIALLY_ALIGNED'),ambiguous:true,acceptedJudgments:['PARTIALLY_ALIGNED','NOT_ALIGNED']}]},m=model();m.plannedCaseIds=[c.id];m.observations.push(observation(c,'NOT_ALIGNED'));const ambiguous=measure(p.dataset,a,m,{testOnly:true});assert.equal(ambiguous.academic.falseRejections.clearAligned,0);assert.equal(ambiguous.academic.falseApprovals.clearNotAligned,0);assert.equal(ambiguous.academic.agreement,1);
 const missing=score(c,'ALIGNED',null);assert.equal(missing.academic.byRelationship[c.relationshipType].notAttempted,1);assert.equal(missing.academic.agreement,null);
});
test('invalid, invented-evidence and missing answers remain unresolved; never become supported judgments',()=>{
 const c=chosen('Content-activity');for(const mode of ['label','quote','unavailable']){const o=observation(c);if(mode==='label')o.judgment.label='PERFECT';if(mode==='quote')o.judgment.sourceQuote='invented evidence';if(mode==='unavailable')o.judgment=null;const r=score(c,'ALIGNED',o);assert.equal(r.operations.verified,0);assert.equal(r.operations.unresolved,1);assert.equal(r.academic.agreement,null);assert.equal(r.academic.byRelationship[c.relationshipType].invalid,1);}
});
test('stale cases, benchmark hashes, duplicate judgments and wrong policy are rejected',()=>{
 const c=chosen('Content-activity'),a=clone(p.adjudication),m=model();for(const change of [x=>x.benchmarkHash='stale',x=>x.policyVersion='legacy',x=>x.observations=[observation(c),observation(c)],x=>x.observations=[{...observation(c),caseHash:'stale'}]]){const bad=clone(m);change(bad);assert.throws(()=>measure(p.dataset,a,bad,{testOnly:true}));}
 const ds=clone(p.dataset);ds.cases[0].sourceText='modified';assert.throws(()=>measure(ds,a,m,{testOnly:true}),/hash mismatch/);
});
test('synthetic labels, raw single reviews and reference-held cases are not promoted to faculty accuracy',()=>{
 const c=chosen('Content-activity'),a={...clone(p.adjudication),provenance:'synthetic-test-only',adjudications:[adjudicate(c,'ALIGNED')]};assert.throws(()=>measure(p.dataset,a,model()),/Synthetic/);
 a.adjudications[0].reviewerIds=['one reviewer'];assert.equal(measure(p.dataset,a,model(),{testOnly:true}).academic.facultyLabelled,0);
 const held=p.dataset.cases.find(c=>c.holds.length&&c.sourceText&&c.targetText);a.adjudications=[adjudicate(held,'NOT_ALIGNED')];assert.equal(measure(p.dataset,a,model(),{testOnly:true}).academic.facultyLabelled,0);
});
test('model provenance is required before reporting supplied responses as a real evaluation',()=>{
 const c=chosen('Content-activity'),a=clone(p.adjudication),m={...model(),provenance:'controlled-Claude-evaluation',observations:[observation(c)]};assert.throws(()=>measure(p.dataset,a,m),/provenance/);
});
test('mock recommendation ratings stay separate from Claude recommendation quality',()=>{
 const proposal=p.proposals[0],m=model(),rating={id:proposal.id,proposalHash:proposal.proposalHash,reviewStatus:'reviewed',reviewerId:'MOCK reviewer',recommendationAppropriate:'no',reason:'Synthetic rating, not faculty.'};const r=measure(p.dataset,p.adjudication,m,{testOnly:true,proposals:p.proposals,recommendationReviews:[rating]});assert.equal(r.recommendations['synthetic-proposal'].inappropriate,1);assert.equal(r.recommendations.Claude.reviewerRatings,0);assert.equal(r.recommendations.Claude.appropriateShare,null);
});
test('faculty evidence review is independent of mechanical quote matching',()=>{
 const c=chosen('Content-activity'),a={...clone(p.adjudication),provenance:'synthetic-test-only',adjudications:[adjudicate(c,'ALIGNED')]},m={...model(),runId:'mock-run',transcriptSha256:'mock-hash',plannedCaseIds:[c.id],observations:[observation(c)]};const evidence={id:c.id,caseHash:c.caseHash,runId:m.runId,transcriptSha256:m.transcriptSha256,reviewStatus:'reviewed',reviewerId:'MOCK reviewer',reason:'Synthetic contrast',quoteAccuracy:'yes',relevanceOfEvidence:'no'};const r=measure(p.dataset,a,m,{testOnly:true,evidenceReviews:[evidence]});assert.equal(r.evidence.facultyRatings.relevanceOfEvidence.no,1);assert.ok(r.evidence.mechanical.sides.exact>0);
});
test('an explicit run plan separates selected-but-unattempted from unselected and reference-held cases',()=>{
 const a=chosen('Content-activity'),b=chosen('Content-assessment'),m={...model(),plannedCaseIds:[a.id,b.id],observations:[observation(a)]},r=measure(p.dataset,p.adjudication,m,{testOnly:true});assert.equal(r.operations.planned,2);assert.equal(r.operations.attempted,1);assert.equal(r.operations.neverAttempted,1);assert.ok(r.operations.notSelected>0);m.plannedCaseIds.push(p.dataset.cases.find(c=>c.holds.length).id);assert.throws(()=>measure(p.dataset,p.adjudication,m,{testOnly:true}),/reference-held/);
});
test('Policy V2, compliance, gates, reference data and all protected historical files retain baseline hashes',()=>{
 const before=JSON.parse(fs.readFileSync(path.join(root,'docs/lcup-academic-benchmark/before.json'),'utf8'));for(const f of before.files)assert.equal(sha(fs.readFileSync(path.join(root,f.path))),f.sha256,f.path);
 const standard=require('../../server/lib/compliance/standard-v4.json');assert.equal(standard.rules.length,47);assert.equal(standard.passThreshold,79);const {stageFlags}=require('../../server/lib/syllabuscheck/stages');assert.ok(Object.values(stageFlags({})).every(x=>x===false));
});
