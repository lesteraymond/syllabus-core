import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { PROGRAMS } from '../../src/data/outcomesSeed.js';
const official=JSON.parse(await fs.readFile(new URL('../../src/data/officialProgramOutcomes.json',import.meta.url),'utf8'));
const require=createRequire(import.meta.url);
test('official source hashes, numbering, complete PO12 and all four frontend seed sets agree',async()=>{
 const evidence=JSON.parse(await fs.readFile(new URL('../../docs/lcup-po-correction/official-data.json',import.meta.url),'utf8'));
 assert.deepEqual(official,evidence,'Canonical seed data matches independently extracted source evidence');
 for(const [code,count] of [['BSIT',9],['BSIT-CYBERSECURITY',9],['BSIE',13],['BSCPE',13]]){
  const ref=official.programs[code==='BSIT-CYBERSECURITY'?'BSIT':code];
  assert.equal(PROGRAMS[code].pos.length,count);assert.deepEqual(PROGRAMS[code].pos.map(p=>p.text),ref.outcomes.map(p=>p.text));
  assert.deepEqual(ref.outcomes.map(p=>p.no),Array.from({length:count},(_,i)=>i+1));
  assert.ok(ref.outcomes.every(p=>p.sourcePages.length&&p.egas.length===0));
  const bytes=await fs.readFile(new URL(`../../${ref.sourceFile}`,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),ref.sha256);
  if(count===13)assert.ok(ref.outcomes[11].text.endsWith('multidisciplinary environments.'));
 }
 assert.equal(PROGRAMS['BSIT-CYBERSECURITY'].outcomeSource,'BSIT');
});
test('source wording quirks are preserved without inferred corrections or crosswalks',()=>{
 assert.equal(official.programs.BSIT.outcomes[4].text,'Preserve and promote “Filipino historical and cultural heritage;');
 assert.match(official.programs.BSIT.outcomes[5].text,/design and appropriate solution;/);
 assert.ok(official.programs.BSIT.outcomes.every(p=>!p.egas.length));
 assert.ok(official.programs.BSIE.outcomes[1].text.endsWith('data.'));
 assert.ok(official.programs.BSCPE.outcomes[1].text.endsWith('data;'));
});
test('legacy adoption preserves a known snapshot and refuses to assign new meanings to unknown old tags',()=>{
 const {outcomesFrom}=require('../../server/lib/syllabusOutcomes');
 const reference={id:'official',outcomes:official.programs.BSIT.outcomes};
 const course={standards:{vision:'V',mission:{lead:'L',items:[]},egas:[],pos:reference.outcomes,poReference:reference}};
 const content={clos:[{id:'historical',pos:[1]}]};
 assert.throws(()=>outcomesFrom(content,course),e=>e.body?.code==='po_reference_review_required');
 content.catalog={program:{pos:[{no:1,text:'Old PO1 meaning'}]}};
 assert.equal(outcomesFrom(content,course).pos[0].text,'Old PO1 meaning');
 assert.equal(content.outcomes,undefined);
});

test('direct ILO–PO mappings also require their authored reference and enter remediation',async()=>{
 const {assertContentBasis}=require('../../server/lib/programPoReferences');
 const {impacts}=require('../../server/db/official-po-migration.cjs');
 const content={meta:{program:'BSIT'},clos:[],plan:[{ilos:[{text:'Historical outcome',tags:['po:1']}]}]};
 const ref={id:'official',outcomes:official.programs.BSIT.outcomes};
 assert.throws(()=>assertContentBasis(content,ref),e=>e.body?.code==='po_reference_review_required');
 const db={query:async(sql,args)=>{
  if(sql.includes('information_schema.tables'))return [[{table_name:args[0]}]];
  if(sql==='SELECT * FROM syllabi')return [[{syllabus_id:7,content:JSON.stringify(content)}]];
  return [[]];
 }};
 const items=await impacts(db,{programs:[]});
 assert.equal(items.length,1);
 assert.deepEqual(items[0].directIloPoMappings,[{rowIndex:0,iloIndex:0,tags:['po:1']}]);
 assert.deepEqual(items[0].cloMappings,[]);
 content.outcomes={pos:ref.outcomes};
 assert.doesNotThrow(()=>assertContentBasis(content,ref));
});
