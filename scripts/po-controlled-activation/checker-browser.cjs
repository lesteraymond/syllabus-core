'use strict';
// Full existing React/Express workflow. Writes only to a fresh isolated synthetic
// database. Actual development references are supplied by a READ-ONLY snapshot.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..'),mode=process.argv[2];assert.ok(['baseline','optimized'].includes(mode));
process.env.E2E_DB_PORT='43310';process.env.E2E_DB_NAME='syllabus_e2e_po_1105_workflow_'+mode;
const OUT=path.join(ROOT,'docs/po-checker-integration/browser-'+mode);fs.mkdirSync(OUT,{recursive:true});
const {seedCorrected}=require('./checker-browser-seed.cjs'),L=require('../e2e/lib.cjs');
const {startStack}=require('../e2e/stack.cjs');const results=[];
const recommended={SYLLABUS_CHECK_CACHE_WARMUP:'on',SYLLABUS_CHECK_OUTPUT_PLAN:'on',SYLLABUS_CHECK_OUTPUT_FIELDS:'scoped'};
async function main(){
 if(process.env.PO_E2E_PREPROVISIONED!=='1'){
  const bootstrap=cp.spawnSync(process.execPath,[path.join(ROOT,'scripts/e2e/db-bootstrap-check.cjs')],{env:{...process.env,E2E_KEEP:'1'},encoding:'utf8'});fs.writeFileSync(path.join(OUT,'bootstrap.log'),bootstrap.stdout+bootstrap.stderr);assert.equal(bootstrap.status,0,'Isolated bootstrap failed');
 }else assert.equal(process.env.E2E_SKIP_BOOTSTRAP,'1','Preprovisioned mode requires bootstrap disabled');
 const {fixtures}=await seedCorrected(process.env.E2E_DB_NAME);
 const stack=await startStack({ports:{front:3774,proxy:3773,api:3331},extraEnv:{E2E_DB_PORT:'43310',SYLLABUS_CHECK_PROFILE:'comprehensive-testing',SYLLABUS_CHECK_ACADEMIC_V2:'off',SYLLABUS_CHECK_AI_MAX_COST_USD:'100',SYLLABUS_CHECK_REUSE:'off',SYLLABUS_CHECK_V2_GROUPING:'off',SYLLABUS_CHECK_PROMPT_TRIM:'off',SYLLABUS_CHECK_COURSE_CONTEXT:'off',...(mode==='optimized'?recommended:{SYLLABUS_CHECK_CACHE_WARMUP:'off',SYLLABUS_CHECK_OUTPUT_PLAN:'off',SYLLABUS_CHECK_OUTPUT_FIELDS:'off'})}});
 const browser=await L.launch();const ids=[];let filterProbe=null;
 try{
  for(const fixture of fixtures){let s;const record={program:fixture.code,mode,steps:[],status:'PASS'};
   try{
    s=await L.session(browser,stack);await s.loginOk('faculty');await s.nav('My Syllabi');await s.page.getByRole('button',{name:/new syllabus/i}).click();
    await s.pick(/Choose a program/,new RegExp('^'+fixture.code+' (?:–|—|-)'));
    await s.pick(/Choose a subject/,new RegExp('^'+fixture.course.code.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' (?:–|—|-)'));
    await s.page.locator('[aria-label="Lecture units"]').fill(fixture.content.meta.lecture);await s.page.locator('[aria-label="Laboratory units"]').fill(fixture.content.meta.lab);
    await s.page.locator('[placeholder="For example, 2022-2023"],[aria-label="For example, 2022-2023"]').first().fill(fixture.content.meta.curriculumYear);
    if(!await s.page.getByPlaceholder('Describe the course in a few sentences').count())await s.page.getByRole('button',{name:/add paragraph/i}).click();await s.page.getByPlaceholder('Describe the course in a few sentences').first().fill(fixture.content.description.map(p=>p.t).join(' '));
    await s.page.getByRole('button',{name:/2 learning outcomes/i}).click();
    await s.page.locator('.learning-outcomes-editor .refi').first().waitFor();const shown=await s.page.locator('.learning-outcomes-editor .refi').evaluateAll(nodes=>nodes.map(n=>({cd:(n.querySelector('.cd')||{}).textContent||'',rt:(n.querySelector('.rt')||{}).textContent||''}))).then(rows=>rows.filter(r=>/^PO/i.test(r.cd.trim())));assert.equal(shown.length,fixture.content.outcomes.pos.length);
    assert.deepEqual(fixture.content.outcomes.pos.map((p,k)=>shown[k]&&shown[k].rt.trim().startsWith(p.text)?p.text:'MISMATCH '+p.text),fixture.content.outcomes.pos.map(p=>p.text));
    const group=s.page.locator('.clorow [role="group"][aria-label^="PO"]').first();assert.equal(await group.locator('input[type="checkbox"]').count(),fixture.content.outcomes.pos.length);assert.equal(await group.locator('input:checked').count(),1,'A subject never maps automatically to every PO');
    record.steps.push('program/subject selection; exact corrected PO text; subset mapping options');
    await s.page.getByRole('button',{name:/save as draft/i}).click();await s.page.waitForTimeout(900);
    const list=(await s.api('GET','/syllabi')).body;const rows=Array.isArray(list)?list:list.syllabi;const item=rows.find(r=>Number(r.course_id||r.courseId)===fixture.course.id)||rows.find(r=>(r.course_code||r.courseCode)===fixture.course.code&&!ids.includes(r.syllabus_id||r.id));assert.ok(item,'Saved synthetic draft');const id=item.syllabus_id||item.id;ids.push(id);record.syllabusId=id;
    const sections=Object.fromEntries(['clos','plan','reqs','refs','grading','outcomes'].map(k=>[k,fixture.content[k]]));const saved=await s.api('PUT',`/syllabi/${id}/content`,{sections,schemaVersion:3});assert.equal(saved.status,200,JSON.stringify(saved.body));
    await s.page.reload();await s.page.waitForTimeout(900);await s.nav('My Syllabi');const edit=s.page.locator('tr').filter({hasText:fixture.course.code}).getByRole('button',{name:/edit/i});if(await edit.count())await edit.first().click();else await s.page.getByRole('button',{name:/edit/i}).first().click();
    await s.page.getByRole('button',{name:/7 review/i}).click();assert.ok((await s.text()).includes('Integration of Values'));record.steps.push('synthetic syllabus saved; Review step renders classifications');
    await s.nav('AI Checker');await s.page.getByRole('button',{name:/^ai checker$/i}).nth(1).click();await s.page.getByText('Academic Evaluation Policy V2').first().waitFor({timeout:120000});
    const run=(await s.api('GET','/compliance?syllabus='+id)).body.run;assert.ok(run&&Number.isFinite(run.overall));assert.equal(run.passThreshold,79);assert.equal(run.hybrid.ruleCoverage.profile,'comprehensive-testing');assert.equal(run.hybrid.referenceContext.po.source,fixture.source);assert.equal(run.hybrid.referenceContext.po.reference.id,fixture.referenceId);assert.equal(run.hybrid.referenceContext.curriculum.source,fixture.code);
    assert.equal(run.hybrid.semanticCoverage.evaluated,7);for(let n=1;n<=4;n++)for(const part of ['structure','semantic'])assert.equal(run.hybrid.ruleCoverage.rules.find(r=>r.ruleId===`CLO${n}:${part}`).verified,true);
    assert.equal(run.hybrid.ruleCoverage.rules.find(r=>r.ruleId==='P-03').status,'NOT_CHECKED');assert.ok(run.hybrid.alignment.judgements.some(j=>j.type==='CLO-PO'));assert.ok(run.hybrid.suggestions.length>0);assert.ok((await s.text()).includes('PO source '+fixture.source));
    await s.shot(path.join(OUT,fixture.code+'-faculty.png'));await s.page.reload();await s.page.waitForTimeout(1000);await s.nav('AI Checker');const reloaded=(await s.api('GET','/compliance?syllabus='+id)).body.run;assert.equal(reloaded.id,run.id);assert.deepEqual(reloaded.hybrid.referenceContext,run.hybrid.referenceContext);record.steps.push('comprehensive check through UI; score/VPAA/CLO/PO findings; report saved and reloaded');
    fs.writeFileSync(path.join(OUT,fixture.code+'-report.json'),JSON.stringify(run));record.score=run.overall;record.passThreshold=79;record.poCount=fixture.content.outcomes.pos.length;record.poSource=fixture.source;record.referenceId=fixture.referenceId;record.vpaa=7;record.classifications=4;
    const submitted=await s.api('POST',`/syllabi/${id}/submit`,{note:'Synthetic integration workflow only'});assert.equal(submitted.status,200,JSON.stringify(submitted.body));
    assert.deepEqual(s.issues.pageErrors,[]);assert.deepEqual(s.issues.blocked,[]);await s.close();s=await L.session(browser,stack);await s.loginOk('admin');await s.nav('AI Checker');await s.pick(/Choose a faculty member/,/Test Faculty/);await s.pick(/Choose a program/,new RegExp('^'+fixture.code+'(?:\\s|$)'));await s.pick(/Choose a subject/,new RegExp('^'+fixture.course.code+' '));await s.page.getByRole('button',{name:/check compliance/i}).click();await s.page.getByText('Academic Evaluation Policy V2').first().waitFor({timeout:120000});
    const adminRun=(await s.api('GET','/compliance?syllabus='+id)).body.run;assert.equal(adminRun.hybrid.referenceContext.po.reference.id,fixture.referenceId);assert.equal(adminRun.passThreshold,79);assert.ok((await s.text()).includes('PO source '+fixture.source));await s.shot(path.join(OUT,fixture.code+'-admin.png'));record.adminScore=adminRun.overall;record.steps.push('administrator checked and read synthetic submission; no approval performed');assert.deepEqual(s.issues.pageErrors,[]);assert.deepEqual(s.issues.blocked,[]);
   }catch(e){record.status='FAIL';record.error=e.message;console.log(fixture.code+' FAIL '+e.message.slice(0,250));if(s)await s.shot(path.join(OUT,fixture.code+'-failure.png')).catch(()=>{});
   }finally{if(s)await s.close();results.push(record);console.log(record.status+' '+fixture.code+' '+mode);}
  }
  if(mode==='optimized'){
   const s=await L.session(browser,stack);filterProbe={status:'PASS',scope:'Follow-up to baseline E19; existing product filter with settled scroll; no product/test-suite source edited'};
   try{await s.loginOk('admin');await s.nav('Program & Subjects');const combo=s.page.getByRole('combobox',{name:'Semester',exact:true});await combo.scrollIntoViewIfNeeded();await s.page.waitForTimeout(400);await combo.click();filterProbe.options=await s.page.getByRole('option').allInnerTexts();await s.shot(path.join(OUT,'semester-filter-probe.png'));assert.ok(filterProbe.options.some(t=>/2nd Semester/.test(t)));await s.page.getByRole('option',{name:/2nd Semester/}).click();await s.page.waitForTimeout(300);assert.equal(await s.page.locator('tr[data-catalog-row^="subject-"]').count(),0);await combo.click();await s.page.getByRole('option',{name:/1st Semester/}).click();const year=s.page.getByRole('combobox',{name:'Year level',exact:true});await year.click();await s.page.getByRole('option',{name:'Year 3',exact:true}).click();await s.page.waitForTimeout(300);assert.equal(await s.page.locator('tr[data-catalog-row^="subject-"]').count(),1);assert.ok(/CpE-304/i.test(await s.text()));}
   catch(e){filterProbe.status='FAIL';filterProbe.error=e.message;}finally{await s.close();}
  }
 }finally{await browser.close();const events=stack.providerEvents();fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({mode,kind:'LOCAL full React/Express browser E2E, isolated synthetic DB, corrected development reference snapshot, scripted provider',results,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status!=='PASS').length,filterProbe,providerRequests:events.filter(e=>e.kind==='provider').length,blockedNetwork:events.filter(e=>/^blocked/.test(e.kind)),liveClaudeCalls:0,profile:'comprehensive-testing',ordinaryDevelopmentFlagsModified:false},null,2));await stack.stop();}
 process.exitCode=results.some(r=>r.status==='FAIL')?1:0;
}
main().catch(e=>{console.error(e.message);process.exitCode=2;});
