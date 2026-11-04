'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {scenario,standard,F}=require('./rule-cases.cjs'),{evaluate}=require('../../server/lib/compliance/rules');
const rows=[];for(const rule of standard.rules)for(const mode of ['positive','negative','boundary'])test(`${rule.id} ${mode}: ${rule.check}`,()=>{
 const {c,ctx}=scenario(rule,mode),before=JSON.stringify({c,ctx}),result=evaluate(c,standard,ctx),findings=result.findings.filter(f=>f.ruleId===rule.id),expected=mode==='negative';
 rows.push({rule:rule.id,mode,check:rule.check,expected:expected?'Rule finding':'No finding for this rule',actual:findings,status:!!findings.length===expected?'PASS':'FAIL'});
 assert.equal(!!findings.length,expected,JSON.stringify(findings));assert.equal(JSON.stringify({c,ctx}),before);assert.ok(result.overall===null||result.overall>=0&&result.overall<=100);
});
test('malformed/null structures are handled by all 47 compliance rules without throwing or passing',()=>{
 const inputs=[null,undefined,{},[],{meta:5,clos:{},plan:'bad',refs:[]},{plan:[null,5,{}],description:'bad',grading:{rows:'bad'}}];
 for(const input of inputs){const r=evaluate(input,standard,F.ctx());assert.equal(r.passed,false);assert.equal(r.conformance.ok,false);assert.ok(r.findings.length);}
});
for(const value of ['   ','\t\n','** **','- ** **'])test(`markup/whitespace-only content is incomplete: ${JSON.stringify(value)}`,()=>{const c=F.good();c.meta.title=value;c.plan[0].contents=value;const r=evaluate(c,standard,F.ctx());assert.ok(r.findings.some(f=>f.ruleId==='T-02'));assert.ok(r.findings.some(f=>f.ruleId==='T-16'));});
test('complete unrelated content can retain deterministic 100 but has no semantic approval field',()=>{
 const c=F.good();for(const r of c.plan.filter(r=>r.kind==='lesson')){r.contents='Human anatomy: digestive organs';r.ilos[0].text='Explain human digestion in detail.';r.activities='Identify human organs';r.tasks='Complete a human anatomy examination';}
 const r=evaluate(c,standard,F.ctx());assert.equal(r.overall,100);assert.equal(r.academic,undefined);assert.equal(r.hybrid,undefined);
});
test.after(()=>fs.writeFileSync(path.resolve(__dirname,'../../docs/lcup-comprehensive-verification/deterministic-cases.json'),JSON.stringify(rows,null,2)+'\n'));
