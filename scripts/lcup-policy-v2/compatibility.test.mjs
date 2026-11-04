import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {tr,setLanguage} from '../../src/i18n/index.js';
const require=createRequire(import.meta.url);
const {PROMPT,systemPromptOf}=require('../../server/lib/syllabuscheck/gemini');
const {promptFor}=require('../../server/lib/syllabuscheck/variants');
const {stageFlags}=require('../../server/lib/syllabuscheck/stages');
test('full-prompt helper default includes every assembled segment while runtime flags remain explicit/off',()=>{
 assert.equal(promptFor(PROMPT,'current'),PROMPT);
 const runtime=systemPromptOf('current',{},[]);
 assert.equal(runtime,promptFor(PROMPT,'current',stageFlags({})));
 assert.ok(!runtime.includes('Title-description'));
});
test('missing CLO classification explanation is translated, including the classification list',()=>{
 setLanguage('tl');
 assert.equal(tr('Required CLO classifications are missing: Integration of Values.'),'Kulang ang mga kinakailangang klasipikasyon ng CLO: Pagsasama ng mga Pagpapahalaga.');
 assert.ok(!tr('Required CLO classifications are missing: Introductory, Demonstrating.').includes('Introductory'));
 setLanguage('en');
});
test('CLO classification recommendation is translated without changing faculty text',()=>{
 setLanguage('tl');
 assert.equal(tr('Ask faculty to review the CLO classifications and include Integration of Values. No CLO was reclassified automatically.'),'Ipasuri sa guro ang mga klasipikasyon ng CLO at isama ang Pagsasama ng mga Pagpapahalaga. Walang CLO na awtomatikong binago ang klasipikasyon.');
 setLanguage('en');
 assert.equal(tr('Required CLO classifications are missing: Integration of Values.'),'Required CLO classifications are missing: Integration of Values.');
});
