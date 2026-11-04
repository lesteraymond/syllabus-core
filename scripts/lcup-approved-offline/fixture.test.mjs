import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { build, flat, generate, targets } from './generate.mjs';
import { out, root, sources, sha, extract } from './extract.mjs';
const require = createRequire(import.meta.url);
const { validateOutcomes } = require('../../server/lib/syllabusOutcomes');
const { weeksOf } = require('../../server/lib/syllabuscheck/validation');
const read = async n => JSON.parse(await fs.readFile(`${out}/${n}`, 'utf8'));
const compact = s => String(s).replace(/\s/g, '');
const expected = {
  it202: { program: 'BSIT', code: 'IT 202', title: 'Computer Programming 1', po: 9, weeks: ['1','2','3-4','4-5','6','7-8','9-11','12','13','14','15','16-17','18'], ilos: 20, untagged: 4, poLinks: 19, egaLinks: 11, iloLinks: 30, exams: ['6','12','18'], refs: [3,5,3,2] },
  ie402: { program: 'BSIE', code: 'IE-402', title: 'Systems Engineering', po: 13, weeks: ['1','2-3','4','5-8','9','10-11','12-14','15-17','18'], ilos: 15, untagged: 0, poLinks: 13, egaLinks: 5, iloLinks: 29, exams: ['4','9','18'], refs: [3,1,3] },
  cpe304: { program: 'BSCPE', code: 'CpE 304', title: 'Fundamentals of Mixed Signals and Sensors', po: 13, weeks: ['1','2-3','4-5','6','7-8','9-11','12','13-14','15-16','17','18'], ilos: 15, untagged: 11, poLinks: 11, egaLinks: 4, iloLinks: 6, exams: ['6','12','18'], refs: [4] },
};
for (const [key, e] of Object.entries(expected)) {
  test(`${key}: source identity, all CLO/PO/EGA and printed relationships preserved`, async () => {
    const { content: c, evidence } = await read(`${key}.fixture.json`);
    assert.equal(c.meta.program, e.program); assert.equal(c.meta.code, e.code); assert.equal(c.meta.title, e.title);
    assert.equal(c.outcomes.pos.length, e.po); assert.equal(c.outcomes.egas.length, 4); assert.equal(c.clos.length, 4);
    assert.equal(c.clos.reduce((n, c) => n + c.pos.length, 0), e.poLinks);
    assert.equal(c.clos.reduce((n, c) => n + c.egas.length, 0), e.egaLinks);
    assert.equal(c.meta.curriculumYear, ''); assert.equal(c.meta.yearLevel, '');
    assert.equal(evidence.identity.curriculumYear, null);
    assert.ok(c.outcomes.pos.every(p => !p.egas.length));
    assert.doesNotThrow(() => validateOutcomes(c.outcomes, c.clos, c.plan));
  });
  test(`${key}: complete ILO boundaries, missing tags and inclusive ranges preserved`, async () => {
    const { content: c, evidence } = await read(`${key}.fixture.json`);
    const lessons = c.plan.filter(r => r.kind === 'lesson'), ilos = lessons.flatMap(r => r.ilos);
    assert.equal(ilos.length, e.ilos); assert.equal(ilos.filter(i => !i.tags.length).length, e.untagged);
    assert.equal(ilos.reduce((n, i) => n + i.tags.length, 0), e.iloLinks);
    for (const row of lessons) {
      const source = evidence.plan.find(p => p.week === row.week).cells[1];
      assert.equal(compact(row.ilos.map(i => i.text).join('')), compact(source));
    }
    if (key === 'it202') {
      const untagged = c.plan.find(r => r.week === '4-5').ilos[1];
      assert.match(untagged.text, /^ILO 2 Acquire/); assert.deepEqual(untagged.tags, []);
      assert.equal(c.plan.find(r => r.week === '16-17').ilos[1].tags.length, 0);
    }
  });
  test(`${key}: all weekly cells, merged continuations and examination rows preserved`, async () => {
    const f = await read(`${key}.fixture.json`), s = await read(`${key}.source.json`), c = f.content;
    assert.deepEqual(c.plan.map(r => r.week), e.weeks);
    assert.deepEqual(c.plan.filter(r => r.kind === 'exam').map(r => r.week), e.exams);
    assert.deepEqual([...new Set(c.plan.flatMap(r => weeksOf(r.week)))].sort((a,b) => a-b), Array.from({length:18}, (_,i)=>i+1));
    for (const [i, row] of c.plan.entries()) {
      const ev = f.evidence.plan[i]; assert.ok(ev.pages.length);
      for (const [j, name] of ['contents','activities','tasks','values'].entries()) assert.equal(row[name], ev.cells[j+2]);
      for (const chunk of ev.chunks) {
        const band = s.tables.find(t => t.page === chunk.page && t.top === chunk.box[1] && t.bottom === chunk.box[3] && t.cells.length === 6);
        assert.ok(band); assert.deepEqual(band.cells.map(c => c.text), chunk.cells);
      }
    }
    assert.deepEqual(f.evidence.plan.map(p => p.pages), s.production.layout.planRows.map(r => r.sourcePages));
    if (key === 'ie402') assert.deepEqual(f.evidence.plan.find(r=>r.week==='15-17').pages, [8,9,10]);
    if (key === 'cpe304') assert.deepEqual(c.plan[0].ilos, []);
  });
  test(`${key}: source prose, references, requirements and grading are not dropped`, async () => {
    const f = await read(`${key}.fixture.json`), s = await read(`${key}.source.json`);
    const stream = compact(s.pages.map(p => p.stream).join(''));
    for (const name of ['code','title','description','credits','reqs','refs','grading','prereq']) {
      assert.ok(stream.includes(compact(f.evidence.fields[name].raw)), `${key} ${name} not found in source stream`);
      assert.ok(f.evidence.fields[name].pages.length, `${name} missing pages`);
    }
    assert.equal(f.content.description[0].t, f.evidence.fields.description.raw);
    assert.equal(compact(f.content.reqs.map(r=>r.t).join('')), compact(f.evidence.fields.reqs.raw));
    assert.deepEqual(f.evidence.references.map(g=>g.items.length), e.refs);
    for (const group of f.evidence.references) assert.equal(compact(group.items.join('')), compact(group.raw));
    assert.equal(f.content.grading.rows.reduce((n,r)=>n+Number(r.pct),0), 100);
    for (const [name, ev] of Object.entries(f.evidence.outcomes)) assert.ok(ev.pages.length && ev.raw.startsWith(name.replace(/(\D+)(\d+)/, '$1')));
    // Character conservation for every text-bearing outcome and weekly cell,
    // independent of the adapter's outcome/ILO boundary parser.
    for (const band of s.tables.filter(t=>(t.cells.length===3 && t.page>=2 && t.page<=(key==='ie402'?4:3)) || t.cells.length===6)) {
      for (const cell of band.cells) {
        const actual=compact(cell.text), original=compact(cell.items.map(t=>t.text).join(''));
        assert.equal([...actual].sort().join(''), [...original].sort().join(''), `${key} p${band.page}: cell character loss`);
        // Separate bullet glyphs can precede/follow their text in the PDF stream;
        // the adapter orders them geometrically. All prose order must still agree.
        assert.equal(actual.replace(/[•●▪➢]/g,''), original.replace(/[•●▪➢]/g,''), `${key} p${band.page}: prose reordering`);
      }
    }
    const outcomeBands=s.tables.filter(t=>t.cells.length===3 && t.page>=2 && t.page<=(key==='ie402'?4:3) && !/PROGRAM\s+OUTCOMES/.test(t.cells[1].text));
    for (const [i,label] of ['EGA','PO','CLO'].entries()) {
      const raw=Object.entries(f.evidence.outcomes).filter(([n])=>n.startsWith(label)).map(([,ev])=>ev.raw).join('');
      assert.equal(compact(raw), compact(outcomeBands.map(b=>b.cells[i].text).join('')), `${label} source column incomplete`);
    }
  });
}
test('prerequisites retain authored wording and superscript; no catalog overwrite', async () => {
  const fixtures = await Promise.all(['it202','ie402','cpe304'].map(k=>read(`${k}.fixture.json`)));
  assert.deepEqual(fixtures.map(f=>f.content.meta.prereq), ['IT 101','4th Year Standing','FUNEC, FUNELC']);
});
test('source POs stay incomplete; all thirteen supporting POs have page references', async () => {
  const comparisons = await read('engineering-pos.json');
  for (const c of comparisons) {
    assert.equal(c.pos.length,13); assert.ok(c.pos.every(p=>p.pages.length));
    assert.equal(c.pos[11].text.endsWith('multidisciplinary environments.'), /403|404/.test(c.key));
  }
});
test('fixture tag adapter handles repeated labels, periods and inclusive ranges', () => {
  assert.deepEqual(targets('[PO1, PO2, PO3, PO5]', 'PO'), [1,2,3,5]);
  assert.deepEqual(targets('[PO6. PO7, PO12]', 'PO'), [6,7,12]);
  assert.deepEqual(targets('[PO 2, 3. 5, 6,7]', 'PO'), [2,3,5,6,7]);
  assert.deepEqual(targets('[CLO 1-2] [CLO2-3]', 'CLO'), [1,2,3]);
});
test('original PDFs match the pre-work hashes, both baseline copies byte-identical', async () => {
  const before = JSON.parse((await fs.readFile(`${out}/repository-before.json`, 'utf8')).replace(/^\uFEFF/,''));
  for (const [key, file] of sources) {
    const relative = `docs/academic-references/${file}`, bytes = await fs.readFile(`${root}/${relative}`), s = await read(`${key}.source.json`);
    assert.equal(sha(bytes), before.files.find(f=>f.path===relative)?.sha256);
    assert.equal(sha(bytes), s.sha256);
    if (['it202','ie402','cpe304'].includes(key)) assert.equal(sha(bytes), sha(await fs.readFile(`${root}/reference-data/${file}`)));
  }
});
test('fixture generation is byte-repeatable and does not mutate source snapshots', async () => {
  const names = ['it202.fixture.json','ie402.fixture.json','cpe304.fixture.json','engineering-pos.json'];
  const before = await Promise.all(names.map(n=>fs.readFile(`${out}/${n}`,'utf8')));
  await generate();
  const after = await Promise.all(names.map(n=>fs.readFile(`${out}/${n}`,'utf8')));
  assert.deepEqual(after, before);
});
test('fresh PDF token extraction is repeatable for all five allowlisted documents', async () => {
  for (const definition of sources) {
    const previous = await read(`${definition[0]}.source.json`), fresh = await extract(definition, false, { persist: false });
    // Historical worker preview stays frozen. Geometry/source evidence must
    // remain identical while production field corrections are tested separately.
    const { production: oldPreview, ...oldSource } = previous;
    const { production: newPreview, ...newSource } = fresh;
    assert.deepEqual(newSource, oldSource);
  }
});
