// Run with: npm test   (Node's built-in test runner, no extra dependency)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultModel as M, createModel, emptyDraft, migrateContent, hydrateContent, applyCourse, LCUP, hasLcup, withLcup, syncClos, clearCourse, SCHEMA_VERSION, STEPS,
  weekNums, weekSet, renderMarkup, esc, abbr, gradeTotal, clone,
} from './syllabusModel.js';
import { INSTITUTION, PROGRAMS } from '../data/outcomesSeed.js';

let n = 0;
const newId = () => 'id' + (++n);
const ilo = (text, tags = []) => ({ id: newId(), text, tags });
const row = (kind, week, ilos, extra = {}) => ({ id: newId(), kind, week, ilos, contents: '', activities: '', tasks: '', values: '', ...extra });

// A small filled-in draft (test fixture only, not app data).
function fixture() {
  const d = emptyDraft(newId);
  d.meta = { courseId: 7, code: 'XX 101', title: 'Fixture', program: 'BSIT', lecture: '2', lab: '1', prereq: 'None' };
  d.description = [{ id: newId(), t: 'A course.' }];
  d.clos = ['One', 'Two', 'Three'].map((t) => ({ id: newId(), title: t, level: 'Introductory', statement: t + ' statement', egas: [1], pos: [1] }));
  const [c1, c2, c3] = d.clos.map((c) => c.id);
  d.plan = [
    row('lesson', '1', [ilo('a', ['clo:' + c1]), ilo('b', ['clo:' + c2, 'ega:3'])]),
    row('lesson', '2-3', [ilo('c', ['clo:' + c2, 'po:5'])]),
    row('exam', '4', [ilo('Review', [])], { contents: '**PRELIMINARY EXAMINATION**' }),
  ];
  d.grading.rows = [{ id: newId(), label: 'Class Standing', abbr: 'CS', pct: 60 }, { id: newId(), label: 'Examination', abbr: 'TE', pct: 40 }];
  return { d, c1, c2, c3 };
}

test('tags resolve to a code and a name', () => {
  const { d, c1 } = fixture();
  assert.deepEqual([M.tagInfo(d, 'clo:' + c1).label, M.tagInfo(d, 'clo:' + c1).name], ['CLO 1', 'One']);
  assert.deepEqual([M.tagInfo(d, 'ega:2').label, M.tagInfo(d, 'ega:2').name], ['EGA 2', 'Competent Professional']);
  assert.equal(M.tagInfo(d, 'ega:2').text, 'Competent Catholic Augustinian-Marian Professional');
  assert.deepEqual([M.tagInfo(d, 'po:3').label, M.tagInfo(d, 'po:3').name], ['PO 3', 'Design computing solutions']);
  assert.ok(M.tagInfo(d, 'po:3').ok);
});

test('syllabus-owned outcomes override the live catalog and survive selecting the same subject', () => {
  const { d } = fixture();
  d.outcomes = { vision: 'Own vision', mission: { lead: 'Own mission', items: ['Purpose'] }, egas: [{ no: 1, name: 'Own EGA', short: 'Own' }], pos: [{ no: 1, short: 'Own PO', text: 'Own statement', egas: [1] }] };
  assert.strictEqual(M.institutionFor(d).vision, 'Own vision');
  assert.strictEqual(M.tagInfo(d, 'ega:1').text, 'Own EGA');
  assert.strictEqual(M.tagInfo(d, 'po:1').text, 'Own statement');
  const again = applyCourse(d, catalogCourse(d.meta.courseId, d.meta.code, []));
  assert.deepEqual(again.clos, d.clos);
  assert.deepEqual(again.outcomes, d.outcomes);
  d.outcomes.vision = '';
  assert.ok(M.blockers(d, 'clos').some(issue => issue.source === 'form' && issue.text.includes('vision')));
});

test('tags that point at nothing resolve as not ok', () => {
  const { d } = fixture();
  assert.equal(M.tagInfo(d, 'clo:gone').ok, false);
  assert.equal(M.tagInfo(d, 'ega:9').ok, false);
  assert.equal(M.tagInfo(d, 'po:99').ok, false);
  assert.equal(M.tagInfo(d, 'bogus:1').ok, false);
});

test('deleting CLO 2 removes its tags everywhere and renumbers the rest', () => {
  const { d, c1, c2, c3 } = fixture();
  const r = M.removeClo(d, c2);
  assert.equal(r.affected, 2);
  assert.deepEqual(r.draft.clos.map((c) => c.id), [c1, c3]);
  assert.equal(M.tagInfo(r.draft, 'clo:' + c3).label, 'CLO 2');
  assert.equal(M.tagInfo(r.draft, 'clo:' + c2).ok, false);
  assert.ok(r.draft.plan.every((p) => p.ilos.every((il) => !il.tags.includes('clo:' + c2))));
  assert.ok(r.draft.plan[0].ilos[1].tags.includes('ega:3'), 'non-CLO tags stay');
  assert.equal(d.clos.length, 3, 'input is not mutated');
});

test('coverage lists weeks and rows per CLO; exam rows and uncovered CLOs', () => {
  const { d, c1, c2, c3 } = fixture();
  const cov = M.coverage(d);
  assert.deepEqual(cov.find((c) => c.id === c1).weeks, [1]);
  assert.deepEqual(cov.find((c) => c.id === c2).weeks, [1, 2, 3]);
  assert.equal(cov.find((c) => c.id === c2).rows.length, 2);
  assert.equal(cov.find((c) => c.id === c3).rows.length, 0, 'not covered yet');
  d.plan[2].ilos[0].tags = ['clo:' + c3];
  assert.equal(M.coverage(d).find((c) => c.id === c3).rows.length, 0, 'exam rows do not count');
});

test('week parsing', () => {
  assert.deepEqual(weekNums('3'), [3]);
  assert.deepEqual(weekNums('9-10'), [9, 10]);
  assert.deepEqual(weekNums('Week 1, 3–5'), [1, 3, 4, 5]);
  assert.deepEqual(weekNums('abc'), []);
  assert.equal(Object.keys(weekSet(fixture().d.plan)).length, 4);
});

test('implied EGAs and the one-click suggestion', () => {
  const { d } = fixture();
  const clo = { egas: [1], pos: [4, 8] };
  assert.deepEqual(M.impliedEgas(d, clo), [1, 2, 4]);
  assert.deepEqual(M.missingEgas(d, clo), [2, 4]);
  assert.deepEqual(M.impliedEgas(d, { egas: [], pos: [99] }), []);
});

test('generated formulas follow components and exam rows; override wins', () => {
  const { d } = fixture();
  d.plan.push(row('exam', '9', [], { contents: 'Midterm exam' }), row('exam', '17', [], { contents: 'Final exam' }));
  const f = M.formulas(d);
  assert.equal(f.term, 'Term Grade = CS (60%) + TE (40%)');
  assert.equal(f.final, 'Final Rating = Prelim Grade + Midterm Grade + Final Grade');
  d.grading.rows[0].pct = 50;
  assert.equal(M.formulas(d).term, 'Term Grade = CS (50%) + TE (40%)');
  d.grading.override = { on: true, term: 'T', final: 'F' };
  assert.deepEqual([M.formulas(d).term, M.formulas(d).final, M.formulas(d).genTerm.startsWith('Term Grade')], ['T', 'F', true]);
  assert.equal(abbr('Class Standing'), 'CS');
  assert.equal(abbr('Quiz'), 'QU');
});

test('a grading total other than 100 needs attention', () => {
  const { d } = fixture();
  assert.equal(gradeTotal(d), 100);
  assert.ok(!M.issues(d, 'grade').some((i) => /total/.test(i.text)));
  d.grading.rows[0].pct = 70;
  assert.equal(gradeTotal(d), 110);
  assert.ok(M.issues(d, 'grade').some((i) => i.text === 'Components total 110%, not 100%.'));
  assert.ok(M.issues(d, 'grade').some((i) => /Only 1 of 3/.test(i.text)));
});

test('an invalid PO is flagged, and an empty program says so', () => {
  const { d, c1 } = fixture();
  d.clos[0].pos = [1, 77];
  assert.ok(M.issues(d, 'clos').some((i) => /PO 77, which does not exist in BSIT/.test(i.text) && i.clo === c1));
  d.meta.program = 'BSIS';
  assert.ok(M.issues(d, 'clos').some((i) => /No program outcomes have been added for BSIS yet. Please ask your administrator/.test(i.text)));
  assert.equal(M.poList(d).length, 0);
});

test('plan issues: untagged ILO, orphan tag, unresolved tag, uncovered CLO', () => {
  const { d, c3 } = fixture();
  d.plan[0].ilos.push(ilo('no tag'), ilo('', ['ega:1']));
  d.plan[1].ilos[0].tags.push('po:88');
  const t = M.issues(d, 'plan').map((i) => i.text).join('\n');
  assert.match(t, /Week 1, ILO3 has no CLO tag/);
  assert.match(t, /Week 1, ILO4 is tagged but has no text/);
  assert.match(t, /Week 2-3, ILO1 has a tag that no longer resolves: PO 88/);
  assert.match(t, /CLO 3 is not covered by any ILO yet/);
  assert.ok(M.issues(d, 'plan').some((i) => i.clo === c3));
});

test('markup renders bullets and bold, and escapes HTML', () => {
  assert.equal(renderMarkup('**Topic**\n- one\n- two'), '<div><strong>Topic</strong></div><ul><li>one</li><li>two</li></ul>');
  const out = renderMarkup('- <script>alert(1)</script> & "q"');
  assert.ok(!out.includes('<script>'));
  assert.ok(out.includes('&lt;script&gt;') && out.includes('&amp;') && out.includes('&quot;q&quot;'));
  assert.equal(esc('<b>'), '&lt;b&gt;');
  assert.equal(renderMarkup('**<img src=x onerror=1>**'), '<div><strong>&lt;img src=x onerror=1&gt;</strong></div>');
});

test('reference age is measured from the syllabus school year', () => {
  assert.deepEqual(M.refAge('Lowe, D. (2008). Java.'), { year: 2008, age: 18 });
  assert.equal(M.refAge('no year here'), null);
  const m2 = createModel({ institution: INSTITUTION, programs: PROGRAMS, year: 2030 });
  assert.equal(m2.refAge('X (2020)').age, 10);
});

test('requirement suggestions come from assessment tasks', () => {
  const { d } = fixture();
  d.plan[0].tasks = '- Create a class diagram\n- Visual Learners: draw a flowchart\nplain line\n- ab';
  d.reqs = [{ id: newId(), t: 'Create a class diagram' }];
  const s = M.suggestReqs(d);
  assert.deepEqual(s, ['Examinations', 'Draw a flowchart']);
});

test('step statuses: review is complete only when steps 1 to 6 are', () => {
  const e = emptyDraft(newId);
  assert.deepEqual(M.stepStatuses(e, {}).statuses, ['todo', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo']);
  assert.equal(M.stepStatuses(e, { 0: 1 }).statuses[0], 'attn');
  assert.equal(M.stepStatuses(e, {}).complete, false);
  assert.equal(STEPS.length, 7);
  const { d } = fixture();
  assert.equal(M.stepStatuses(d, {}).statuses[0], 'done');
  assert.equal(M.stepStatuses(d, {}).statuses[5], 'done', 'advice alone (fewer than 3 exam rows) does not hold a step back');
  d.grading.rows = []; // a blocking problem
  assert.equal(M.stepStatuses(d, {}).statuses[5], 'todo', 'unvisited step with blockers');
  assert.equal(M.stepStatuses(d, { 5: 1 }).statuses[5], 'attn');
  assert.equal(M.stepStatuses(d, {}).statuses[6], 'todo');
});

test('all seven completion statuses follow required fields, revoke on incomplete edits, and restore when fixed', () => {
  const { d } = fixture();
  d.reqs = ['Requirement A', 'Requirement B', 'Requirement C'].map(t => ({ id: newId(), t }));
  Object.values(d.refs).forEach(group => { group.na = true; });
  assert.deepEqual(M.stepStatuses(d, {}).statuses, Array(7).fill('done'));
  const prereq = d.meta.prereq;
  d.meta.prereq = '';
  const incomplete = M.stepStatuses(d, { 0: 1, 6: 1 });
  assert.equal(incomplete.statuses[0], 'attn');
  assert.equal(incomplete.statuses[6], 'attn');
  assert.equal(incomplete.complete, false);
  d.meta.prereq = prereq;
  assert.deepEqual(M.stepStatuses(d, { 0: 1, 6: 1 }).statuses, Array(7).fill('done'));
});

test('sequential step indicators do not check auto-loaded outcomes until earlier required fields are complete', () => {
  const { d } = fixture();
  d.meta.prereq = '';
  assert.equal(M.stepStatuses(d).statuses[1], 'done', 'catalog outcomes are already valid');
  const faculty = M.stepStatuses(d, { 0: 1 }, { sequential: true });
  assert.equal(faculty.firstBlocked, 0);
  assert.deepEqual(faculty.statuses, ['attn', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked']);
  assert.equal(faculty.statuses.filter(status => status === 'done').length, 0);
  d.meta.prereq = 'None';
  const unlocked = M.stepStatuses(d, { 0: 1 }, { sequential: true });
  assert.equal(unlocked.firstBlocked, 3);
  assert.deepEqual(unlocked.statuses.slice(0, 3), ['done', 'done', 'done']);
  assert.equal(unlocked.statuses[3], 'todo');
  assert.ok(unlocked.statuses.slice(4).every(status => status === 'locked'));
  assert.equal(M.stepStatuses(d).statuses[5], 'done', 'non-sequential administrator inspection stays unrestricted');
  d.reqs = ['A', 'B', 'C'].map(t => ({ id: newId(), t }));
  Object.values(d.refs).forEach(group => { group.na = true; });
  assert.deepEqual(M.stepStatuses(d, {}, { sequential: true }).statuses, Array(7).fill('done'));
  d.meta.prereq = '';
  assert.equal(M.stepStatuses(d, { 1: 1 }, { sequential: true }).statuses[1], 'locked', 'invalidating an earlier step removes later checks');
});

test('a new syllabus starts empty with one blank plan row', () => {
  const e = emptyDraft(newId);
  assert.equal(e.schemaVersion, SCHEMA_VERSION);
  assert.equal(e.plan.length, 1);
  assert.equal(e.plan[0].ilos.length, 1);
  assert.equal(e.meta.code, '');
  assert.equal(e.clos.length, 0);
  assert.ok(!JSON.stringify(e).includes('IT 204'));
  assert.equal(e.signoff && Object.keys(e.signoff).length, 0, 'no revision date or modifications');
});

test('migrating old ILOs from clos:[ids] to tags', () => {
  const old = { plan: [{ id: 'r', kind: 'lesson', week: '1', ilos: [{ id: 'i1', text: 'x', clos: ['a', 'b'], tags: ['ega:1'] }, { id: 'i2', text: 'y', clos: [] }] }] };
  const before = clone(old);
  const m = migrateContent(old);
  assert.equal(m.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(m.plan[0].ilos[0].tags, ['ega:1', 'clo:a', 'clo:b']);
  assert.deepEqual(m.plan[0].ilos[1].tags, []);
  assert.ok(!('clos' in m.plan[0].ilos[0]));
  assert.deepEqual(old, before, 'input is not mutated');
  assert.deepEqual(migrateContent(m), m, 'idempotent');
  assert.equal(migrateContent(null).schemaVersion, SCHEMA_VERSION);
});

test('seed data matches the form: 4 EGAs, 10 BSIT outcomes, every PO maps to a real EGA', () => {
  assert.equal(INSTITUTION.egas.length, 4);
  assert.equal(PROGRAMS.BSIT.pos.length, 10);
  assert.equal(INSTITUTION.mission.items.length, 6);
  assert.ok(PROGRAMS.BSIT.pos.every((p) => p.egas.length && p.egas.every((e) => INSTITUTION.egas.some((x) => x.no === e))));
  assert.deepEqual(M.poList({ meta: { program: 'BSCS' } }), []);
});

test('partial stored content is filled with defaults so the builder never sees an undefined section', () => {
  const h = hydrateContent({ meta: { code: 'SW 1', title: 'Only meta' } }, newId);
  assert.equal(h.meta.code, 'SW 1');
  assert.equal(h.meta.program, '');
  assert.deepEqual([h.description.length, h.clos.length, h.plan.length, h.reqs.length], [1, 0, 1, 0]);
  assert.equal(h.refs.books.na, false);
  assert.deepEqual(h.grading.override, { on: false, term: '', final: '' });
  assert.deepEqual(M.issues(h, 'grade').length > 0 && M.issues(h, 'refs').length > 0, true, 'every step can be validated');
  const g = hydrateContent({ grading: { rows: [{ id: 'g', label: 'A', abbr: 'A', pct: '100' }] }, plan: [{ id: 'r', kind: 'lesson', week: '1', ilos: [{ id: 'i', text: 'x', clos: ['c'] }] }] }, newId);
  assert.equal(g.grading.override.on, false);
  assert.deepEqual(g.plan[0].ilos[0].tags, ['clo:c'], 'older ILOs are migrated too');
  assert.equal(hydrateContent(null, newId).schemaVersion, SCHEMA_VERSION);
});

const catalogCourse = (id, code, clos) => ({ id, code, title: 'Title of ' + code, program: { code: 'BSIT' }, clos });

test('choosing a course copies its starting values without sharing mutable data', () => {
  const e = emptyDraft(newId);
  const c = catalogCourse(5, 'IT 204', [{ id: 'c10', title: 'A', level: 'Introductory', statement: 's', egas: [1], pos: [1] }, { id: 'c11', title: 'B', level: 'Enabling', statement: 's', egas: [1], pos: [3] }]);
  const d = applyCourse(e, c);
  assert.deepEqual([d.meta.courseId, d.meta.code, d.meta.title, d.meta.program], [5, 'IT 204', 'Title of IT 204', 'BSIT']);
  assert.deepEqual(d.clos.map((x) => x.id), ['c10', 'c11']);
  assert.equal(M.tagInfo(d, 'clo:c11').label, 'CLO 2');
  assert.equal(e.clos.length, 0, 'input is not mutated');
  d.clos[0].statement = 'changed';
  assert.equal(c.clos[0].statement, 's', 'the catalog entry is not shared with the draft');
});

test('changing the course drops all old outcome tags; selecting the same course preserves edits', () => {
  let d = applyCourse(emptyDraft(newId), catalogCourse(1, 'IT 204', [{ id: 'c1', title: 'A', level: 'Enabling', statement: 's', egas: [], pos: [] }]));
  d.plan[0].ilos[0].tags = ['clo:c1', 'ega:2', 'po:4'];
  const d2 = applyCourse(d, catalogCourse(2, 'IT 205', [{ id: 'c9', title: 'Z', level: 'Enabling', statement: 's', egas: [], pos: [] }]));
  assert.deepEqual(d2.plan[0].ilos[0].tags, []);
  const same = applyCourse(d, catalogCourse(1, 'IT 204', d.clos));
  assert.deepEqual(same.plan[0].ilos[0].tags, ['clo:c1', 'ega:2', 'po:4'], 're-applying the same course keeps its tags');
});

test('when an administrator deletes a CLO, the tag stays and shows as unresolved (warning style, reported by the checks)', () => {
  const { d, c2 } = fixture();
  const synced = syncClos(d, d.clos.filter((c) => c.id !== c2));
  assert.equal(M.tagInfo(synced, 'clo:' + c2).ok, false);
  assert.ok(M.issues(synced, 'plan').some((i) => /tag that no longer resolves/.test(i.text)));
  assert.equal(synced.plan[0].ilos[1].tags.includes('clo:' + c2), true);
});

test('step 1 asks for a subject; step 2 directs the author to complete missing outcomes', () => {
  const e = emptyDraft(newId);
  e.meta.program = 'BSIT';
  assert.ok(M.issues(e, 'info').some((i) => /Choose a subject/.test(i.text)));
  assert.ok(M.issues(e, 'clos').some((i) => /Choose a subject in step 1/.test(i.text)));
  const noClos = applyCourse(e, catalogCourse(3, 'IT 999', []));
  assert.ok(M.issues(noClos, 'clos').some((i) => /Complete the CLO statements/.test(i.text) && i.source === 'form'));
  assert.ok(!M.issues(noClos, 'info').some((i) => /Choose a subject/.test(i.text)));
});

test('clearing the course removes its identity and all outcome mappings, preserving authored course details', () => {
  const { d } = fixture();
  d.plan[0].ilos[0].tags.push('po:2');
  const c = clearCourse(d);
  assert.deepEqual([c.meta.courseId, c.meta.code, c.meta.title, c.clos.length], [null, '', '', 0]);
  assert.ok(c.plan.every((r) => r.ilos.every((il) => il.tags.every((t) => !t.startsWith('clo:')))));
  assert.ok(c.plan.every(r => r.ilos.every(il => il.tags.length === 0)));
  assert.equal(c.meta.prereq, d.meta.prereq, 'faculty-entered fields stay');
});

test('a model built from a submitted snapshot keeps the saved EGA and PO names even after the live catalog changed', () => {
  const snapshot = {
    institution: { ...INSTITUTION, egas: INSTITUTION.egas.map((e) => (e.no === 1 ? { ...e, short: 'Saved EGA name' } : e)) },
    program: { code: 'BSIT', name: 'BS IT', pos: PROGRAMS.BSIT.pos.map((p) => (p.no === 1 ? { ...p, short: 'Saved PO name' } : p)) },
  };
  const live = createModel({
    institution: { ...INSTITUTION, egas: INSTITUTION.egas.map((e) => (e.no === 1 ? { ...e, short: 'Edited later' } : e)) },
    programs: { BSIT: { name: 'BS IT', pos: PROGRAMS.BSIT.pos.map((p) => (p.no === 1 ? { ...p, short: 'Edited later' } : p)) } },
    year: 2026,
  });
  const frozen = createModel({ institution: snapshot.institution, programs: { BSIT: snapshot.program }, year: 2026 });
  const d = { meta: { program: 'BSIT' }, clos: [] };
  assert.equal(frozen.tagInfo(d, 'ega:1').name, 'Saved EGA name');
  assert.equal(frozen.tagInfo(d, 'po:1').name, 'Saved PO name');
  assert.equal(live.tagInfo(d, 'ega:1').name, 'Edited later');
  assert.equal(live.tagInfo(d, 'po:1').name, 'Edited later');
});

test('each program has its own EGAs: tags resolve against the syllabus\'s program, and a program without its own uses the institution list', () => {
  const m = createModel({
    institution: { ...INSTITUTION, egas: [{ no: 1, name: 'School-wide one', short: 'School one' }] },
    programs: {
      BSIT: { name: 'BS IT', pos: [], egas: [{ no: 1, name: 'IT thinker', short: 'IT thinker' }, { no: 2, name: 'IT professional', short: 'IT pro' }] },
      BSIE: { name: 'BS IE', pos: [], egas: [{ no: 1, name: 'Engineer', short: 'Engineer' }] },
      BSCS: { name: 'BS CS', pos: [] },
    },
    year: 2026,
  });
  const it = { meta: { program: 'BSIT' }, clos: [] };
  const ie = { meta: { program: 'BSIE' }, clos: [] };
  const cs = { meta: { program: 'BSCS' }, clos: [] };
  assert.equal(m.tagInfo(it, 'ega:1').name, 'IT thinker');
  assert.equal(m.tagInfo(ie, 'ega:1').name, 'Engineer');
  assert.equal(m.tagInfo(cs, 'ega:1').name, 'School one'); // no EGAs of its own: the institution list
  assert.deepEqual(m.egaList(it).map((e) => e.no), [1, 2]);
  assert.deepEqual(m.egaList(ie).map((e) => e.no), [1]);
  assert.equal(m.tagInfo(ie, 'ega:2').ok, false); // BSIE has no EGA 2, even though BSIT does
  assert.match(m.tagInfo(ie, 'ega:2').name, /BSIE/);
});

test('an older submitted snapshot without program EGAs still resolves EGA tags from its saved institution list', () => {
  const m = createModel({
    institution: { ...INSTITUTION, egas: [{ no: 1, name: 'Saved name', short: 'Saved name' }] },
    programs: { BSIT: { name: 'BS IT', pos: [], egas: undefined } },
    year: 2026,
  });
  assert.equal(m.tagInfo({ meta: { program: 'BSIT' }, clos: [] }, 'ega:1').name, 'Saved name');
});

// ---- blocking vs advisory issues (what stops a faculty member from moving on) ----
const blockingOf = (m, d, key) => m.blockers(d, key).map((i) => i.text);
const withCatalog = (institution, programs) => createModel({ institution, programs, year: 2026 });
const BSIT = { name: 'BS IT', pos: PROGRAMS.BSIT.pos };

test('every issue says whether it blocks and who must fix it; advice never blocks', () => {
  const { d } = fixture();
  d.plan = d.plan.slice(0, 1); // only 1 week of 18, uncovered CLOs, no exam rows: advice
  d.grading.rows = [{ id: 'g', label: 'Class Standing', abbr: 'CS', pct: 100 }];
  for (const key of ['info', 'clos', 'plan', 'reqs', 'refs', 'grade']) {
    M.issues(d, key).forEach((i) => { assert.equal(typeof i.blocking, 'boolean'); assert.ok(['form', 'admin'].includes(i.source)); });
  }
  const advice = M.issues(d, 'plan').filter((i) => !i.blocking).map((i) => i.text).join(' | ');
  assert.match(advice, /plan covers 1 of 18 weeks/);
  assert.match(advice, /not covered by any ILO/);
  assert.match(M.issues(d, 'grade').filter((i) => !i.blocking).map((i) => i.text).join(' '), /Only 0 of 3/);
  assert.deepEqual(M.blockers(d, 'plan'), []); // advice alone does not block
  assert.deepEqual(M.blockers(d, 'grade'), []);
  assert.equal(M.stepStatuses(d, {}).statuses[2], 'done');
});

test('step 1 blocks on an empty program, subject, prerequisite, units or description', () => {
  const e = emptyDraft(newId);
  assert.ok(blockingOf(M, e, 'info').some((t) => /Choose a program/.test(t)));
  e.meta.program = 'BSIT';
  assert.ok(blockingOf(M, e, 'info').some((t) => /Choose a subject/.test(t)));
  assert.ok(blockingOf(M, e, 'info').some((t) => /Pre-requisite is empty/.test(t)));
  assert.ok(blockingOf(M, e, 'info').some((t) => /units/.test(t)));
  assert.ok(blockingOf(M, e, 'info').some((t) => /description paragraph/.test(t)));
  const { d } = fixture();
  assert.deepEqual(M.blockers(d, 'info'), []);
  assert.ok(M.blockers(d, 'info').every((i) => i.source === 'form'));
});

test('step 2 blocks, as admin data, when the vision, mission, EGAs, POs or CLOs are missing', () => {
  const { d } = fixture();
  assert.deepEqual(M.blockers(d, 'clos'), []); // complete data: nothing blocks
  const noVision = withCatalog({ ...INSTITUTION, vision: '  ' }, { BSIT });
  assert.ok(noVision.blockers(d, 'clos').some((i) => /vision has not been added yet\. Please ask your administrator/.test(i.text) && i.source === 'admin'));
  const noLead = withCatalog({ ...INSTITUTION, mission: { lead: '', items: INSTITUTION.mission.items } }, { BSIT });
  assert.ok(noLead.blockers(d, 'clos').some((i) => /mission has not been added yet/.test(i.text) && i.source === 'admin'));
  const noItems = withCatalog({ ...INSTITUTION, mission: { lead: 'Lead', items: ['', '  '] } }, { BSIT });
  assert.ok(noItems.blockers(d, 'clos').some((i) => /mission has not been added yet/.test(i.text)));
  const noEgas = withCatalog({ ...INSTITUTION, egas: [] }, { BSIT: { ...BSIT, egas: [] } });
  assert.ok(noEgas.blockers(d, 'clos').some((i) => /No graduate attributes \(EGAs\) have been added for BSIT yet/.test(i.text) && i.source === 'admin'));
  const noPos = withCatalog(INSTITUTION, { BSIT: { name: 'BS IT', pos: [] } });
  assert.ok(noPos.blockers(d, 'clos').some((i) => /No program outcomes have been added for BSIT yet/.test(i.text) && i.source === 'admin'));
  const noClos = applyCourse(d, catalogCourse(3, 'IT 999', []));
  assert.ok(M.blockers(noClos, 'clos').some((i) => /Complete the CLO statements/.test(i.text) && i.source === 'form'));
});

test('step 2 blocks on a CLO with no statement or tags, or tagged with an EGA or PO that no longer exists', () => {
  const { d, c1 } = fixture();
  d.clos[0].statement = '';
  d.clos[0].egas = [];
  d.clos[0].pos = [];
  const t = blockingOf(M, d, 'clos').join(' | ');
  assert.match(t, /CLO 1 has no statement yet/);
  assert.match(t, /CLO 1 has no graduate attribute \(EGA\) tag yet/);
  assert.match(t, /CLO 1 has no program outcome tag yet/);
  d.clos[0].egas = [99];
  d.clos[0].pos = [77];
  assert.ok(M.blockers(d, 'clos').some((i) => /tagged EGA 99, which does not exist in BSIT/.test(i.text) && i.clo === c1));
  assert.ok(M.blockers(d, 'clos').some((i) => /tagged PO 77, which does not exist in BSIT/.test(i.text) && i.clo === c1));
  assert.ok(M.blockers(d, 'clos').every((i) => i.source === 'admin'));
});

test('program EGAs and POs decide step 2: a program with no POs blocks, another program is unaffected', () => {
  const m = withCatalog(INSTITUTION, { BSIT, BSIS: { name: 'BS IS', pos: [] } });
  const { d } = fixture();
  assert.deepEqual(m.blockers(d, 'clos'), []);
  d.meta.program = 'BSIS';
  assert.ok(m.blockers(d, 'clos').some((i) => /No program outcomes have been added for BSIS yet/.test(i.text)));
});

test('step 3 blocks on an empty plan, a blank week, a lesson without an ILO, an untagged ILO, and unresolved tags', () => {
  const e = emptyDraft(newId); // one blank row
  assert.ok(blockingOf(M, e, 'plan').some((t) => /at least one lesson with a learning outcome/.test(t)));
  assert.ok(blockingOf(M, e, 'plan').some((t) => /no week/.test(t)));
  const { d, c1 } = fixture();
  assert.deepEqual(M.blockers(d, 'plan'), []);
  d.plan[0].ilos[0].tags = [];
  assert.ok(blockingOf(M, d, 'plan').some((t) => /has no CLO tag/.test(t)));
  d.plan[0].ilos[0].tags = ['clo:' + c1, 'clo:gone'];
  assert.ok(blockingOf(M, d, 'plan').some((t) => /no longer resolves/.test(t)));
  d.plan[0].ilos[0].tags = ['clo:' + c1];
  d.plan[1].week = ' ';
  assert.ok(blockingOf(M, d, 'plan').some((t) => /A row has no week/.test(t)));
  d.plan[1].week = '2-3';
  d.plan[1].ilos.forEach((il) => { il.text = ''; il.tags = []; });
  assert.ok(blockingOf(M, d, 'plan').some((t) => /has no learning outcome \(ILO\)/.test(t)));
  d.plan = [];
  assert.ok(blockingOf(M, d, 'plan').some((t) => /Add at least one week/.test(t)));
});

test('steps 4 to 6 block on empty requirements, an empty reference group, and grading problems', () => {
  const e = emptyDraft(newId);
  assert.ok(blockingOf(M, e, 'reqs').some((t) => /at least 3 course requirements/.test(t)));
  assert.equal(blockingOf(M, e, 'refs').length, 4); // four groups with no entries
  e.refs.books.na = true;
  assert.equal(blockingOf(M, e, 'refs').length, 3); // marked not applicable: nothing to add
  assert.ok(blockingOf(M, e, 'grade').some((t) => /Add grading components/.test(t)));
  const { d } = fixture();
  d.reqs = ['a', 'b', 'c'].map((t) => ({ id: newId(), t }));
  assert.deepEqual(M.blockers(d, 'reqs'), []);
  d.grading.rows[0].pct = 70;
  assert.ok(blockingOf(M, d, 'grade').some((t) => /110%, not 100%/.test(t)));
  d.grading.rows[0].pct = 60;
  d.grading.override = { on: true, term: '', final: 'x' };
  assert.ok(blockingOf(M, d, 'grade').some((t) => /Override formulas cannot be empty/.test(t)));
});

test('firstBlocked finds the first of steps 1 to 6 that still has a blocker; nothing blocked is -1', () => {
  const { d } = fixture();
  d.refs.books.na = true; d.refs.program.na = true; d.refs.online.na = true; d.refs.electronics.na = true;
  d.reqs = ['a', 'b', 'c'].map((t) => ({ id: newId(), t }));
  assert.equal(M.firstBlocked(d), -1);
  assert.equal(M.stepStatuses(d, {}).complete, true);
  d.grading.rows = [];
  assert.equal(M.firstBlocked(d), 5);
  d.reqs = [];
  assert.equal(M.firstBlocked(d), 3);
  d.meta.prereq = '';
  assert.equal(M.firstBlocked(d), 0);
  assert.equal(M.stepStatuses(d, {}).complete, false);
});

test('explicitly empty program EGAs never inherit defaults, and missing programs expose no attributes', () => {
  const m=createModel({institution:INSTITUTION,programs:{NEW:{name:'New',egas:[],pos:[]}},year:2026});
  assert.deepEqual(m.egaList({meta:{program:'NEW'}}),[]);
  assert.deepEqual(m.egaList({meta:{program:''}}),[]);
  assert.deepEqual(m.egaList({meta:{program:'UNKNOWN'}}),[]);
});
test('outcome selection requires both fields while retained catalog snapshots remain readable', () => {
  const m=createModel({institution:INSTITUTION,programs:{BSIT:{name:'BSIT',egas:[],pos:[]}},year:2026});
  for(const meta of [{program:'',courseId:1},{program:'BSIT',courseId:null},{program:'UNKNOWN',courseId:1}]) assert.equal(m.hasOutcomeSelection({meta}),false);
  assert.equal(m.hasOutcomeSelection({meta:{program:'BSIT',courseId:1}}),true);
  assert.equal(m.hasOutcomeSelection({meta:{program:'BSIT',courseId:null},catalog:{program:{code:'BSIT'}}}),true);
});

test('choosing a subject puts in the LCUP vision and mission itself, whatever the subject\'s older starting values say', () => {
  const course = { id: 7, code: 'IT 204', title: 'Programming 2', program: { code: 'BSIT' }, clos: [], standards: { vision: 'An old placeholder vision.', mission: { lead: 'Old lead:', items: ['Old item.'] }, egas: [], pos: [] } };
  const d = applyCourse(emptyDraft(newId), course);
  assert.equal(d.outcomes.vision, LCUP.vision);
  assert.deepEqual(d.outcomes.mission, LCUP.mission);
  assert.equal(hasLcup(d.outcomes), true);
  assert.equal(hasLcup({ vision: 'An old placeholder vision.', mission: LCUP.mission }), false);
  const fixed = withLcup({ vision: 'x', mission: { lead: 'y', items: [] }, egas: [{ no: 1 }], pos: [] });
  assert.deepEqual([fixed.vision, fixed.egas], [LCUP.vision, [{ no: 1 }]]); // only the vision and mission change
  assert.notEqual(fixed.mission, LCUP.mission); // a copy, so editing the draft never edits the seed
});

test('choosing a subject fills Pre-requisite (IV) from the catalog, only when it is chosen or still empty, and never from a catalog that has none set', () => {
  const course = (extra) => ({ id: 7, code: 'IT 302', title: 'Information Management 1', program: { code: 'BSIT' }, clos: [], standards: { vision: '', mission: { lead: '', items: [] }, egas: [], pos: [] }, ...extra });
  const first = applyCourse(emptyDraft(newId), course({ prerequisiteText: 'IT 202 – Computer Programming 1; 3rd Yr' }));
  assert.equal(first.meta.prereq, 'IT 202 – Computer Programming 1; 3rd Yr');
  first.meta.prereq = 'IT 202 and consent of the instructor'; // the author's own wording
  assert.equal(applyCourse(first, course({ prerequisiteText: 'IT 202 – Computer Programming 1; 3rd Yr' })).meta.prereq, 'IT 202 and consent of the instructor');
  const blanked = { ...first, meta: { ...first.meta, prereq: '' } };
  assert.equal(applyCourse(blanked, course({ prerequisiteText: 'IT 202 – Computer Programming 1; 3rd Yr' })).meta.prereq, 'IT 202 – Computer Programming 1; 3rd Yr');
  const other = applyCourse(first, course({ id: 8, prerequisiteText: 'None' }));
  assert.equal(other.meta.prereq, 'None'); // a different subject: its own prerequisites
  assert.equal(applyCourse(emptyDraft(newId), course({ prerequisiteText: null })).meta.prereq, '');
  assert.equal(applyCourse(emptyDraft(newId), course({})).meta.prereq, '');
});

test('choosing a subject fills Credit Units (V) from the curriculum, only when it is chosen or a box is still empty, and never from a catalog without them', () => {
  const course = (extra) => ({ id: 7, code: 'IT 302', title: 'Information Management 1', program: { code: 'BSIT' }, clos: [], standards: { vision: '', mission: { lead: '', items: [] }, egas: [], pos: [] }, ...extra });
  const first = applyCourse(emptyDraft(newId), course({ units: { lecture: 2, lab: 1 } }));
  assert.deepEqual([first.meta.lecture, first.meta.lab], ['2', '1']);
  first.meta.lecture = '3'; // the author's own value
  const again = applyCourse(first, course({ units: { lecture: 2, lab: 1 } }));
  assert.deepEqual([again.meta.lecture, again.meta.lab], ['3', '1']);
  const blank = applyCourse({ ...first, meta: { ...first.meta, lecture: '', lab: '' } }, course({ units: { lecture: 2, lab: 1 } }));
  assert.deepEqual([blank.meta.lecture, blank.meta.lab], ['2', '1']);
  const other = applyCourse(first, course({ id: 8, units: { lecture: 0, lab: 1 } }));
  assert.deepEqual([other.meta.lecture, other.meta.lab], ['0', '1']); // a different subject: its own units, a zero is kept
  const none = applyCourse(emptyDraft(newId), course({ units: null }));
  assert.deepEqual([none.meta.lecture, none.meta.lab], ['', '']);
});
