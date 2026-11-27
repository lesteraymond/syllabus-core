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
  assert.ok(text.includes('Term Grade'));
  assert.ok(text.includes('Final Rating'));
  assert.ok(text.includes('Prepared by:'));
  assert.ok(text.includes('Dean Test'));
  assert.ok(text.includes('VPAA Test'));
});

// The grading system and sign-off block as the printed form lays them out (numbered rows, Final Rating as a fraction,
// Prepared / Checked and Reviewed / References Certified / Approved with underlined capitalised names and their titles).
test('buildSyllabusDocx lays out the grading system and sign-off block like the printed form', () => {
  const exam = (id, word) => ({ id, week: '', kind: 'exam', ilos: [{ id: id + 'i', text: '' }], contents: word + ' Examination', activities: '', tasks: '', values: '' });
  const bytes = buildSyllabusDocx({
    meta: { code: 'CPE 101' },
    plan: [exam('e1', 'Preliminary'), exam('e2', 'Midterm'), exam('e3', 'Final')],
    grading: { rows: [{ id: 'g1', label: 'Class Standing', abbr: 'CS', pct: '60', items: 'Quizzes/Recitation\nGroup Participation\n\nSeat Work' }, { id: 'g2', label: 'Examination', abbr: 'TE', pct: '40' }], override: { on: false, term: '', final: '' } },
  }, {
    faculty: 'Engr. Test Faculty',
    signoffs: { stages: { cleared: 1, dean: { cleared: true, by: 'Dr. Test Dean', at: '2026-01-14T00:00:00Z' }, asst_vpaa: { cleared: false }, lic_director: { cleared: false } }, approved: null },
  });
  const text = new TextDecoder().decode(bytes);
  const from = text.indexOf('GRADING SYSTEM');
  const order = (...parts) => { let at = from; return parts.every((p) => { at = text.indexOf(p, at + 1); return at >= 0; }); };
  assert.ok(order('>1.<', 'Class Standing', 'Quizzes/Recitation', 'Group Participation', 'Seat Work', '60%', '>2.<', 'Examination', '40%'), 'components are numbered, with what they include under the label');
  assert.ok(order('>3.<', 'Term Grade', 'CS (60%) + TE (40%)', '>4.<', 'Final Rating', 'Prelim Grade + Midterm Grade + Final Grade', '>3<'), 'Term Grade and Final Rating are rows 3 and 4; the Final Rating is over 3');
  assert.ok(/<w:u w:val="single"\/><\/w:rPr><w:t xml:space="preserve">Prelim Grade \+ Midterm Grade \+ Final Grade</.test(text), 'the fraction numerator is underlined');
  assert.ok(!text.includes('Term Grade:') && !text.includes('Term Grade ='), 'the formula shows without its own name in front');
  assert.ok(order('Prepared by:', 'Engr. Test Faculty', 'Faculty - Date', 'Checked and Reviewed by:', 'Dr. Test Dean', 'Dean - ', 'Asst. Vice President for Academic Affairs - Date', 'References Certified by:', 'LIC Director - Date', 'Approved by:', 'Vice President for Academic Affairs - Date'), 'sign-off block in the printed order');
  assert.ok(/<w:caps\/>[^]*?<w:u w:val="single"\/><\/w:rPr><w:t xml:space="preserve">Dr\. Test Dean</.test(text), 'names are underlined capitals');
  assert.ok(text.includes('w:fill="DBE5F1"'), 'light blue strip across the top of the sign-off block');
  assert.equal((text.match(/w:fill="/g) || []).length, 1, 'table headers are white: the strip is the only shading');
  // VIII, IX and X are full-width rows of the Learning Plan table (one table from its header to the grading system).
  const plan = text.slice(text.lastIndexOf('<w:tbl>', text.indexOf('SCHEDULE')), text.indexOf('Prepared by:'));
  assert.equal((plan.match(/<w:gridSpan w:val="6"\/>/g) || []).length, 3, 'three full-width bordered rows under the Learning Plan');
  for (const s of ['COURSE REQUIREMENTS', 'REFERENCES', 'GRADING SYSTEM', 'Final Rating']) assert.ok(plan.includes(s), s + ' sits inside the bordered Learning Plan table');
  assert.ok(!text.includes('Added by the system'), 'no placeholder text: blank signature lines instead');
});

// The rest of the IT 101 template: the script letterhead, "SUGGESTED REFERENCES" with only the groups in use, the Learning Plan
// heading without "(ILO)", and the Revision Date / Modifications box with the form code.
test('buildSyllabusDocx prints the letterhead, references, headings and revision box of the approved template', () => {
  const content = {
    meta: { code: 'IT 101' },
    refs: { books: { na: false, items: [{ id: 'b1', t: 'Awari, G. K. (2022). Ethics in information technology. CRC Press.' }] }, program: { na: true, items: [] }, online: { na: false, items: [{ id: 'o1', t: 'Coursera (2024). Introduction to Computers.' }] }, electronics: { na: true, items: [] } },
  };
  const text = new TextDecoder().decode(buildSyllabusDocx(content, { faculty: 'Jp Del Rosario', signoffs: { stages: { cleared: 0 }, approved: { by: 'VPAA', at: '2026-01-22T00:00:00Z' }, submitted: { at: '2026-01-12T00:00:00Z' } } }));
  assert.ok(/w:ascii="Monotype Corsiva"[^]*?La Consolacion University Philippines/.test(text), 'the name in the script letterhead');
  assert.ok(text.includes('(formerly University of Regina Carmeli)') && text.includes('Catmon, City of Malolos'), 'former name and address');
  assert.ok(text.includes('SUGGESTED REFERENCES') && !text.includes('>REFERENCES<'), 'Section IX is "SUGGESTED REFERENCES"');
  assert.ok(text.includes('A. BOOKS') && text.includes('B. INTERNET REFERENCES'), 'only the groups in use, lettered in order');
  assert.ok(text.includes('<w:ind w:left="1440" w:hanging="720"/>'), 'references use APA 7th edition 0.5 in hanging indent');
  assert.match(text, /<w:i\/>[^<]*<w:color[^>]*\/><w:sz[^>]*\/><w:szCs[^>]*\/><\/w:rPr><w:t xml:space="preserve">Ethics in information technology</, 'book title is italicized per APA 7th edition');
  assert.ok(!text.includes('INTERNET PROGRAMMING') && !text.includes('ELECTRONICS') && !text.includes('Not applicable'), 'groups marked not applicable are left out');
  assert.ok(text.includes('>INTENDED LEARNING OUTCOMES<'), 'the Learning Plan heading has no "(ILO)"');
  assert.ok(text.includes('>Revision Date:<') && !text.includes('Revision Date: Jan'), 'the revision date is left blank in the download, even once approved');
  for (const m of ['__Learning Outcomes', '__Course Contents', '__Grading System']) assert.ok(text.includes(m), m);
  assert.ok(text.indexOf('Modifications:') > text.indexOf('Approved by:'), 'the box comes after the sign-off block');
  assert.ok(text.indexOf('PRE-VPAA-FO-001(011)') > text.indexOf('__Grading System'), 'the form control code comes last, under the box');
  assert.match(text, /<w:b\/>[^<]*(<[^>]+>)*?<w:t xml:space="preserve">PRE-VPAA-FO-001\(011\)</, 'the form control code is bold');
  // The box is as wide as the other tables: the page width, split in two equal columns.
  const rev = text.slice(text.lastIndexOf('<w:tbl>', text.indexOf('Revision Date:')));
  assert.match(rev, /^<w:tbl><w:tblPr><w:tblW w:w="14400" w:type="dxa"\/>[^]*?<w:gridCol w:w="7200"\/><w:gridCol w:w="7200"\/>/);
  // Each sign-off date is the day that step happened: submitted beside the faculty member, approved beside the VPAA.
  assert.ok(text.includes('Faculty - Jan 12, 2026'), 'the faculty date is the submit date');
  assert.ok(text.includes('Vice President for Academic Affairs - Jan 22, 2026'), 'the VPAA date is the approval date');
  assert.ok(text.includes('Dean - Date'), 'a stage not yet cleared still says Date');
});
