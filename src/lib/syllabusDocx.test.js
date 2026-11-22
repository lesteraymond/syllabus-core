import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSyllabusDocx } from './syllabusDocx.js';

test('buildSyllabusDocx matches the LCUP Step 7 FormPaper template (landscape, Roman I–X, formulas, sign-off)', () => {
  const bytes = buildSyllabusDocx({
    meta: { code: 'IT-204', title: 'Programming & Design <2>', program: 'BSIT', academicYear: '2026–2027', lecture: '2', lab: '1', prereq: 'IT-202' },
    description: [{ id: 'd1', t: 'Intermediate programming with OOP & data structures.' }],
    outcomes: { vision: 'Excellence', mission: { lead: 'Forming leaders', items: ['Integrity'] }, egas: [{ no: 1, name: 'Critical Thinker' }], pos: [{ no: 1, text: 'Apply computing knowledge.', egas: [1] }] },
    clos: [{ id: 'c1', level: 'Enabling', title: 'OOP', statement: 'Build modular apps.', egas: [1], pos: [1] }],
    plan: [{ id: 'p1', week: '1-2', kind: 'lesson', ilos: [{ id: 'il1', text: 'Write classes & objects.', tags: ['clo:c1'] }], contents: 'OOP', activities: 'Lab', tasks: 'Quiz', values: 'Diligence' }],
    reqs: [{ id: 'r1', t: 'Machine problems' }],
    refs: { books: { na: false, items: [{ id: 'b1', t: 'Java How to Program' }] }, online: { na: true, items: [] } },
    grading: { rows: [{ id: 'g1', label: 'Exams', pct: 60 }, { id: 'g2', label: 'Projects', pct: 40 }], override: { on: false, term: '', final: '' } },
  }, {
    faculty: 'Jp Del Rosario',
    signoffs: {
      stages: { cleared: 1, dean: { cleared: true, by: 'Dean Test', at: '2026-11-20T00:00:00Z' }, asst_vpaa: { cleared: false }, lic_director: { cleared: false } },
      approved: { by: 'VPAA Test', at: '2026-11-21T00:00:00Z' },
    },
  });

  assert.ok(bytes instanceof Uint8Array);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  assert.equal(bytes[2], 0x03);
  assert.equal(bytes[3], 0x04);

  const text = new TextDecoder().decode(bytes);
  assert.ok(text.includes('w:orient="landscape"'), 'uses landscape Letter like FormPaper');
  assert.ok(text.includes('La Consolacion University Philippines'));
  assert.ok(text.includes('SCHOOL YEAR 2026–2027'));
  assert.ok(text.includes('COURSE CODE'));
  assert.ok(text.includes('IT-204'));
  assert.ok(text.includes('Programming &amp; Design &lt;2&gt;'), 'XML special characters are escaped');
  assert.ok(text.includes('2 units lecture / 1 unit laboratory'));
  assert.ok(text.includes('EXPECTED GRADUATE ATTRIBUTES'));
  assert.ok(text.includes('CLO 1 – Enabling (OOP)'));
  assert.ok(text.includes('[CLO1]'));
  assert.ok(text.includes('A. BOOKS'));
  assert.ok(text.includes('Term Grade:'));
  assert.ok(text.includes('Final Rating:'));
  assert.ok(text.includes('Prepared by:'));
  assert.ok(text.includes('Dean Test'));
  assert.ok(text.includes('VPAA Test'));
});
