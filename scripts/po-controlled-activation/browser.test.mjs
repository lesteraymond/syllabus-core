import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'rolldown';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../..');
const evidenceDir=process.env.PO_BROWSER_EVIDENCE_DIR||'po-controlled-activation';
assert.ok(['po-controlled-activation','po-development-activation'].includes(evidenceDir));
const out=path.join(root,'docs',evidenceDir),tmp=path.join(root,'tmp',evidenceDir);
await build({input:path.join(import.meta.dirname,'browser-app.jsx'),platform:'browser',transform:{define:{'import.meta.env':'{}'},jsx:{runtime:'automatic'}},output:{file:path.join(tmp,'browser-app.js')},logLevel:'silent'});
const fixtures=JSON.parse(await fs.readFile(path.join(out,'browser-fixtures.json'),'utf8'));
assert.equal(fixtures.length,4);
const assets=await fs.readdir(path.join(root,'dist/assets'));const css=assets.find(f=>f.endsWith('.css'));
const server=http.createServer(async(req,res)=>{
 try{const url=new URL(req.url,'http://127.0.0.1');let data,type;
 if(url.pathname==='/'){data='<html><head><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>';type='text/html';}
 else if(url.pathname==='/app.js'){data=await fs.readFile(path.join(tmp,'browser-app.js'));type='text/javascript';}
 else if(url.pathname==='/fixtures.json'){data=JSON.stringify(fixtures);type='application/json';}
 else if(url.pathname==='/style.css'){data=await fs.readFile(path.join(root,'dist/assets',css));type='text/css';}
 else if(url.pathname.endsWith('/syllabus-check/status')){data=JSON.stringify({aiGate:'advisory',configured:false});type='application/json';}
 else {res.writeHead(404);return res.end();}
 res.writeHead(200,{'Content-Type':type});res.end(data);
 }catch{res.writeHead(500);res.end();}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const results=[],errors=[];
try{
 browser=await require('../e2e/lib.cjs').launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.route('**/*',route=>{const url=new URL(route.request().url());return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.abort();});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByTestId('selected-program').waitFor();
 for(const fixture of fixtures){
  const combobox=page.getByRole('combobox',{name:'Program',exact:true});await combobox.click();await page.getByRole('option',{name:fixture.code+' – '+fixture.name,exact:true}).click();
  await page.waitForFunction(code=>document.querySelector('[data-testid="selected-program"]').textContent===code,fixture.code);
  assert.equal(await page.locator('.ie-po').count(),fixture.content.outcomes.pos.length);
  assert.deepEqual(await page.locator('.ie-po textarea').evaluateAll(nodes=>nodes.map(n=>n.value)),fixture.content.outcomes.pos.map(p=>p.text));
  const mapping=page.locator('.clorow [role="group"][aria-label^="PO"]').first();assert.equal(await mapping.locator('input[type="checkbox"]').count(),fixture.content.outcomes.pos.length);
  const source=fixture.report.hybrid.referenceContext.po.source;assert.ok((await page.locator('body').innerText()).includes(`PO source ${source}`));
  await page.getByTestId('role').click();assert.ok((await page.locator('body').innerText()).includes('lcup-po-2026-10-29'));await page.getByTestId('role').click();
  results.push({program:fixture.code,status:'PASS',poCount:fixture.content.outcomes.pos.length,poSource:source,curriculumSource:fixture.report.hybrid.referenceContext.curriculum.source});
 }
 await page.getByTestId('language').click();await page.waitForFunction(source=>document.body.innerText.includes('Pinagmulan ng PO '+source),fixtures.at(-1).report.hybrid.referenceContext.po.source);
 await page.locator('.ie-po').first().scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(out,'browser-reference-review.png'),fullPage:false});assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(out,'browser-results.json'),JSON.stringify({kind:evidenceDir==='po-development-activation'?'LOCAL COMPONENT BROWSER E2E with read-only development reference fixtures, synthetic content and scripted model; no faculty content saved':'LOCAL COMPONENT BROWSER E2E with real existing components and isolated-database service fixtures; no existing environment accessed',results,failed:0,englishAndFilipino:true,pageErrors:errors,paidAiCalls:0},null,2));
 console.log(JSON.stringify({passed:results.length,failed:0,englishAndFilipino:true}));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
