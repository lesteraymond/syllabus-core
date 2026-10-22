// syllabusModel: pure, framework-free rules for the syllabus builder (outcome tags, coverage, weeks,
// formulas, step issues). No React, no DOM, no network, so the server can import it as well.
//
// The institution and program catalogs are injected (they are admin-managed data), so the same rules
// run against the seed file, database rows, or a test fixture:
//   const model = createModel({ institution, programs, year });
// Each program has its own EGAs and program outcomes: programs[code] = { name, pos, egas? }. A program without its own
// `egas` (an older snapshot, a test fixture) uses the institution's list.
// `defaultModel` (below) uses the seed data and the configured school year.
import { INSTITUTION as SEED_INSTITUTION, PROGRAMS as SEED_PROGRAMS } from '../data/outcomesSeed.js';
import { namesCoreValue } from './coreValues.js';
import { CURRENT_SCHOOL_YEAR } from './schoolYear.js';

// Bump when the stored content shape changes, and add a step to migrateContent.
export const SCHEMA_VERSION = 3;

export const LEVELS = ['Introductory', 'Enabling', 'Demonstrating', 'Integration of Values'];
export const GROUPS = [['books', 'Books'], ['program', 'Internet Programming'], ['online', 'Internet References'], ['electronics', 'Electronics']];
// The column headings of the learning plan (form section VII) in the wording of the institutional form. The printed form shows them in
// capitals (views/builder2/FormPaper.jsx); the builder's Learning Plan step shows them as written, in the user's language, from the
// plan.heading.* keys in src/i18n/extra.js, whose English must say exactly this (a test checks it). The first column is the Schedule
// on the form and the week number in the builder, so it is not listed here.
export const PLAN_HEADINGS = {
  ilo: 'Intended Learning Outcomes (ILO)',
  contents: 'Course Contents',
  activities: 'Suggested Learning Activities',
  tasks: 'Suggested Assessment Tasks',
  values: 'Expected Value/s To Be Integrated',
};
export const STEPS = [
  { key: 'info', title: 'Course Information', form: 'I–V', sub: 'Identify the course. School year and college are filled in for you.' },
  { key: 'clos', title: 'Learning Outcomes', form: 'VI', sub: 'The institution’s vision, mission, graduate attributes and program outcomes, then your course learning outcomes tagged to them.' },
  { key: 'plan', title: 'Learning Plan', form: 'VII', sub: 'One row per week or week range. Tag every ILO with the outcomes it builds.' },
  { key: 'reqs', title: 'Course Requirements', form: 'VIII', sub: 'What students must complete. Suggestions come from your assessment tasks.' },
  { key: 'refs', title: 'References', form: 'IX', sub: 'Group references the way the form does. Older sources are marked.' },
  { key: 'grade', title: 'Grading System', form: 'X', sub: 'Components must total 100%. The formulas follow from them and from your exam rows.' },
  { key: 'review', title: 'Review & Check', form: 'Form', sub: 'Check the finished form against the template and read it through. Sign-off names are filled in by the system when it is reviewed and approved.' },
];

// ---- plain helpers (no catalog needed) ----
export function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
export function clone(o) { return JSON.parse(JSON.stringify(o)); }

// "3" -> [3]; "9-10" -> [9, 10]; "1, 3-4" -> [1, 3, 4]; "Week 2" -> [2]. Ranges stop at week 60.
export function weekNums(str) {
  const out = [];
  String(str).replace(/week/ig, '').split(',').forEach((p) => {
    p = p.trim();
    const m = p.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (m) { for (let k = +m[1]; k <= +m[2] && k <= 60; k++) out.push(k); }
    else if (/^\d+$/.test(p)) out.push(+p);
  });
  return out;
}
export function weekSet(plan) {
  const s = {};
  plan.forEach((r) => weekNums(r.week).forEach((w) => { s[w] = 1; }));
  return s;
}

// Tags are 'clo:<id>' | 'ega:<no>' | 'po:<no>'.
export function parseTag(t) {
  const i = String(t).indexOf(':');
  return { kind: String(t).slice(0, i), id: String(t).slice(i + 1) };
}
export const iloClos = (il) => il.tags.filter((t) => t.indexOf('clo:') === 0).map((t) => parseTag(t).id);

// ---- light markup: "- " bullets and **bold**, HTML escaped first ----
export function lines(t) { return String(t || '').split(/\n/).map((x) => x.trim()).filter(Boolean); }
export function stripMarkup(s) { return s.replace(/^-\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1').trim(); }
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
export function renderMarkup(text) {
  let out = '';
  let ul = false;
  lines(text).forEach((l) => {
    if (/^-\s+/.test(l)) {
      if (!ul) { out += '<ul>'; ul = true; }
      out += '<li>' + inline(l.replace(/^-\s+/, '')) + '</li>';
    } else {
      if (ul) { out += '</ul>'; ul = false; }
      out += '<div>' + inline(l) + '</div>';
    }
  });
  if (ul) out += '</ul>';
  return out;
}

export function abbr(label) {
  const w = String(label).trim().split(/\s+/).filter(Boolean);
  return w.length > 1 ? w.map((x) => x[0]).join('').toUpperCase() : String(label).slice(0, 2).toUpperCase();
}
export function examName(row) {
  const t = lines(row.contents).map(stripMarkup).join(' ');
  if (/prelim/i.test(t)) return 'Prelim Grade';
  if (/midterm/i.test(t)) return 'Midterm Grade';
  if (/final/i.test(t)) return 'Final Grade';
  return t ? t.charAt(0) + t.slice(1).toLowerCase() : 'Exam';
}
export const gradeTotal = (d) => d.grading.rows.reduce((s, g) => s + (Number(g.pct) || 0), 0);
export const examRows = (d) => d.plan.filter((r) => r.kind === 'exam');

// ---- stored content: new drafts and upgrades ----
const blank = (newId) => ({ id: newId(), text: '', tags: [] });
export function blankRow(newId, kind = 'lesson') {
  return { id: newId(), kind, week: '', ilos: [blank(newId)], contents: '', activities: '', tasks: '', values: '' };
}
// A new syllabus starts empty: one blank description paragraph, one blank plan row. `newId` makes stable ids.
export function emptyDraft(newId) {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { courseId: null, code: '', title: '', program: '', lecture: '', lab: '', prereq: '' },
    description: [{ id: newId(), t: '' }],
    clos: [],
    plan: [blankRow(newId)],
    reqs: [],
    refs: { books: { na: false, items: [] }, program: { na: false, items: [] }, online: { na: false, items: [] }, electronics: { na: false, items: [] } },
    grading: { rows: [], override: { on: false, term: '', final: '' } },
    signoff: {},
  };
}
// Selecting a subject copies its legacy starting values into this syllabus. Faculty edit their own copy in Step 2.
// `course` is the catalog entry { id, code, title, program: { code }, clos: [{ id, title, level, statement, egas, pos }] }.
// Choosing a different course resets outcome mappings; selecting the same one preserves authored values.
export function applyCourse(d, course) {
  const n = clone(d);
  n.meta.courseId = course.id;
  n.meta.code = course.code;
  n.meta.title = course.title;
  n.meta.program = course.program.code;
  if (d.meta.courseId === course.id && d.outcomes) return n;
  delete n.catalog;
  n.clos = clone(course.clos);
  const setup = course.standards || { vision: '', mission: { lead: '', items: [] }, egas: [], pos: [] };
  // Copy existing subject values once; all subsequent edits belong to this syllabus.
  n.outcomes = clone({ vision: setup.vision, mission: setup.mission, egas: setup.egas, pos: setup.pos });
  const ids = new Set(n.clos.map((c) => c.id));
  n.plan.forEach((r) => r.ilos.forEach((il) => { il.tags = d.meta.courseId && d.meta.courseId !== course.id ? [] : il.tags.filter((t) => t.indexOf('clo:') !== 0 || ids.has(parseTag(t).id)); }));
  return n;
}
// Unchooses the course (for example when the program changes), clearing its outcome data and mappings.
export function clearCourse(d) {
  const n = clone(d);
  n.meta.courseId = null;
  n.meta.code = '';
  n.meta.title = '';
  n.clos = [];
  n.outcomes = { vision: '', mission: { lead: '', items: [] }, egas: [], pos: [] };
  delete n.catalog;
  n.plan.forEach((r) => r.ilos.forEach((il) => { il.tags = []; }));
  return n;
}
// Refreshes the CLOs from the catalog after an administrator edited them. Tags are kept: one that now points at a
// removed outcome shows as unresolved in the plan and is reported by the checks, so the faculty member can fix it.
export function syncClos(d, clos) {
  const n = clone(d);
  n.clos = clone(clos);
  return n;
}
export const closEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Stored content can be partial (saved section by section, or by an older client): upgrade it and fill every
// missing section with its empty default so the builder never meets an undefined list.
export function hydrateContent(content, newId) {
  const base = emptyDraft(newId);
  const stored = migrateContent(content);
  return {
    ...base,
    ...stored,
    meta: { ...base.meta, ...(stored.meta || {}) },
    refs: { ...base.refs, ...(stored.refs || {}) },
    grading: { ...base.grading, ...(stored.grading || {}), override: { ...base.grading.override, ...((stored.grading || {}).override || {}) } },
  };
}
// v1 stored ILOs as { clos: [cloIds] }; v2 stores { tags: ['clo:<id>', ...] }. Returns a new object, never mutates.
export function migrateContent(content) {
  const d = clone(content || {});
  if (!d.schemaVersion || d.schemaVersion < 2) {
    (d.plan || []).forEach((r) => (r.ilos || []).forEach((il) => {
      const old = Array.isArray(il.clos) ? il.clos : [];
      const tags = Array.isArray(il.tags) ? il.tags : [];
      old.forEach((id) => { const t = 'clo:' + id; if (tags.indexOf(t) < 0) tags.push(t); });
      il.tags = tags;
      delete il.clos;
    }));
  }
  d.schemaVersion = SCHEMA_VERSION;
  return d;
}

// ---- rules that depend on the catalog ----
export function createModel({ institution, programs, year }) {
  const institutionFor = d => d.outcomes || institution;
  const poList = (d) => d.outcomes?.pos || (programs[d.meta.program] || { pos: [] }).pos;
  // The EGAs of the syllabus's program (EGA numbers and names differ by program).
  const egaList = (d) => {
    if (d.outcomes) return d.outcomes.egas;
    const p = programs[d.meta.program];
    if (!p) return [];
    // Only older saved catalogs without an EGA field use their institution snapshot.
    return Array.isArray(p.egas) ? p.egas : institution.egas;
  };
  const hasOutcomeSelection = d => !!(d.meta.program && (programs[d.meta.program] || d.outcomes) && (d.meta.courseId || d.catalog?.program?.code === d.meta.program));

  function tagInfo(d, t) {
    const p = parseTag(t);
    if (p.kind === 'clo') {
      const i = d.clos.findIndex((c) => c.id === p.id);
      if (i < 0) return { ok: false, kind: 'clo', idx: 0, no: '?', label: 'CLO', name: 'Removed outcome', text: '' };
      return { ok: true, kind: 'clo', idx: i, no: i + 1, label: 'CLO ' + (i + 1), name: d.clos[i].title || 'Untitled outcome', text: d.clos[i].statement };
    }
    if (p.kind === 'ega') {
      const e = egaList(d).find((x) => String(x.no) === p.id);
      return e
        ? { ok: true, kind: 'ega', no: e.no, label: 'EGA ' + e.no, name: e.short, text: e.name }
        : { ok: false, kind: 'ega', no: p.id, label: 'EGA ' + p.id, name: 'Not in the ' + (d.meta.program || 'program') + ' EGA list', text: '' };
    }
    if (p.kind === 'po') {
      const o = poList(d).find((x) => String(x.no) === p.id);
      return o
        ? { ok: true, kind: 'po', no: o.no, label: 'PO ' + o.no, name: o.short, text: o.text }
        : { ok: false, kind: 'po', no: p.id, label: 'PO ' + p.id, name: 'Not in the ' + d.meta.program + ' list', text: '' };
    }
    return { ok: false, kind: p.kind, no: p.id, label: String(t), name: 'Unknown tag', text: '' };
  }

  // CLOs that a lesson row builds (exam rows build none).
  function rowHits(d, row) {
    if (row.kind !== 'lesson') return [];
    return d.clos.filter((c) => row.ilos.some((il) => iloClos(il).indexOf(c.id) > -1)).map((c) => c.id);
  }
  function coverage(d) {
    return d.clos.map((c, i) => {
      const weeks = {};
      const rows = [];
      d.plan.forEach((r) => {
        if (rowHits(d, r).indexOf(c.id) > -1) { rows.push(r.id); weekNums(r.week).forEach((w) => { weeks[w] = 1; }); }
      });
      return { id: c.id, n: i + 1, weeks: Object.keys(weeks).map(Number).sort((a, b) => a - b), rows };
    });
  }
  // Removes a CLO and its tags from every ILO. Remaining CLOs renumber because numbers come from order.
  function removeClo(d, id) {
    const n = clone(d);
    let affected = 0;
    n.clos = n.clos.filter((c) => c.id !== id);
    n.plan.forEach((r) => r.ilos.forEach((il) => {
      const b = il.tags.length;
      il.tags = il.tags.filter((x) => x !== 'clo:' + id);
      if (il.tags.length < b) affected++;
    }));
    return { draft: n, affected };
  }
  // EGAs implied by the program outcomes a CLO is tagged with (the PO -> EGA mapping from the form).
  function impliedEgas(d, clo) {
    const s = {};
    clo.pos.forEach((no) => {
      const po = poList(d).find((x) => x.no === no);
      if (po) po.egas.forEach((e) => { s[e] = 1; });
    });
    return Object.keys(s).map(Number).sort((a, b) => a - b);
  }
  const missingEgas = (d, clo) => impliedEgas(d, clo).filter((e) => clo.egas.indexOf(e) < 0);

  function formulas(d) {
    const g = d.grading;
    const ex = examRows(d).map(examName);
    const term = 'Term Grade = ' + (g.rows.length ? g.rows.map((r) => (r.abbr || abbr(r.label)) + ' (' + (Number(r.pct) || 0) + '%)').join(' + ') : '(add grading components)');
    const fin = 'Final Rating = ' + (ex.length ? ex.join(' + ') : '(add exam rows in step 3)');
    return { term: g.override.on ? g.override.term : term, final: g.override.on ? g.override.final : fin, genTerm: term, genFinal: fin };
  }
  // Age is measured from the syllabus's school year, not today's date.
  function refAge(t) {
    const m = String(t).match(/\b(19|20)\d{2}\b/);
    return m ? { year: +m[0], age: year - (+m[0]) } : null;
  }
  function suggestReqs(d) {
    const have = {};
    d.reqs.forEach((r) => { have[r.t.trim().toLowerCase()] = 1; });
    const out = [];
    const seen = {};
    d.plan.forEach((r) => lines(r.tasks).forEach((l) => {
      if (!/^-\s+/.test(l)) return;
      const t = stripMarkup(l).replace(/^(visual|logical|applied|reflective)[^:]*:\s*/i, '');
      if (t.length < 4 || t.length > 60) return;
      const k = t.toLowerCase();
      if (have[k] || seen[k]) return;
      seen[k] = 1;
      out.push(t.charAt(0).toUpperCase() + t.slice(1));
    }));
    if (examRows(d).length && !have['examinations'] && !seen['examinations']) out.unshift('Examinations');
    return out.slice(0, 8);
  }

  // What still needs attention in a step, as { text, blocking, source, clo?, row? }.
  //  - blocking: true means the faculty member cannot move on (an empty required field, or admin-managed data that is missing);
  //    false is advice only (it is shown but never blocks Next, Re-check or Submit).
  //  - source: 'form' is something the faculty member fills in; 'admin' is data an administrator manages (vision, mission, the
  //    program's EGAs and POs, the subject's CLOs and their tags). Its wording is for the faculty member, who cannot fix it.
  // An empty list means the step is complete.
  const blank = (v) => !String(v == null ? '' : v).trim();
  function issues(d, key) {
    const o = [];
    const form = (text, extra) => o.push({ text, blocking: true, source: 'form', ...extra });
    const admin = (text, extra) => o.push({ text: d.outcomes ? text.replace(' Please ask your administrator.', '') : text, blocking: true, source: d.outcomes ? 'form' : 'admin', ...extra });
    const advice = (text, extra) => o.push({ text, blocking: false, source: 'form', ...extra });
    if (key === 'clos' && d.outcomes) {
      const own = d.outcomes;
      if (!d.meta.courseId) form('Choose a subject.');
      if (blank(own.vision)) form('Add the vision in step 2.');
      if (blank(own.mission.lead) || !own.mission.items.length || own.mission.items.some(blank)) form('Complete the mission in step 2.');
      if (!own.egas.length || own.egas.some(e => blank(e.name) || blank(e.short))) form('Complete the EGA names and short names in step 2.');
      if (!own.pos.length || own.pos.some(p => blank(p.text) || blank(p.short))) form('Complete the PO statements and short names in step 2.');
      if (!d.clos.length || d.clos.some(c => blank(c.statement) || !LEVELS.includes(c.level) || !c.egas.length || !c.pos.length)) form('Complete the CLO statements and EGA and PO mappings in step 2.');
      if (own.pos.some(p => p.egas.some(no => !own.egas.some(e => e.no === no))) || d.clos.some(c => c.egas.some(no => !own.egas.some(e => e.no === no)) || c.pos.some(no => !own.pos.some(p => p.no === no)))) form('Fix the outcome mappings in step 2.');
      return o;
    }
    if (key === 'info') {
      if (!d.meta.program) form('Choose a program.');
      else if (!d.meta.courseId) form('Choose a subject.');
      if (blank(d.meta.prereq)) form('Pre-requisite is empty.');
      if (isNaN(parseFloat(d.meta.lecture)) || isNaN(parseFloat(d.meta.lab))) form('Enter lecture and laboratory units.');
      if (!d.description.some((p) => p.t.trim())) form('Add at least one description paragraph.');
    }
    if (key === 'clos') {
      const pos = poList(d);
      const egas = egaList(d);
      const program = d.meta.program || 'this program';
      const own = institutionFor(d);
      if (blank(own.vision)) admin(d.outcomes ? 'Add the vision in step 2.' : 'The vision has not been added yet. Please ask your administrator.');
      const mission = own.mission || { lead: '', items: [] };
      if (blank(mission.lead) || !(mission.items || []).some((t) => !blank(t))) admin('The mission has not been added yet. Please ask your administrator.');
      if (!d.meta.courseId) form('Choose a subject in step 1 to load its learning outcomes.');
      if (d.meta.program) {
        if (!egas.length) admin('No graduate attributes (EGAs) have been added for ' + program + ' yet. Please ask your administrator.');
        if (!pos.length) admin('No program outcomes have been added for ' + program + ' yet. Please ask your administrator.');
      }
      if (d.meta.courseId && !d.clos.length) admin('No learning outcomes have been added for ' + d.meta.code + ' yet. Please ask your administrator.');
      d.clos.forEach((c, i) => {
        const n = 'CLO ' + (i + 1);
        if (blank(c.statement)) admin(n + ' has no statement yet. Please ask your administrator.', { clo: c.id });
        if (!c.egas.length) admin(n + ' has no graduate attribute (EGA) tag yet. Please ask your administrator.', { clo: c.id });
        if (!c.pos.length) admin(n + ' has no program outcome tag yet. Please ask your administrator.', { clo: c.id });
        const bad = c.pos.filter((p) => !pos.some((x) => x.no === p));
        if (bad.length && pos.length) admin(n + ' is tagged PO ' + bad.join(', ') + ', which ' + (bad.length > 1 ? 'do' : 'does') + ' not exist in ' + program + '. Please ask your administrator.', { clo: c.id });
        const badEga = c.egas.filter((g) => !egas.some((x) => x.no === g));
        if (badEga.length && egas.length) admin(n + ' is tagged EGA ' + badEga.join(', ') + ', which ' + (badEga.length > 1 ? 'do' : 'does') + ' not exist in ' + program + '. Please ask your administrator.', { clo: c.id });
      });
    }
    if (key === 'plan') {
      if (!d.plan.length) form('Add at least one week.');
      else if (!d.plan.some((r) => r.kind === 'lesson' && r.ilos.some((il) => il.text.trim()))) form('Add at least one lesson with a learning outcome (ILO).');
      d.plan.forEach((r) => {
        if (blank(r.week)) form('A row has no week. Enter the week, or delete the row.', { row: r.id });
        if (r.kind !== 'lesson') return;
        if (!blank(r.values) && !namesCoreValue(r.values)) advice('Week ' + (r.week || '?') + ' names none of the six LCUP core values.', { row: r.id });
        if (!r.ilos.some((il) => il.text.trim())) form('Week ' + (r.week || '?') + ' has no learning outcome (ILO).', { row: r.id });
        r.ilos.forEach((il, j) => {
          const w = 'Week ' + (r.week || '?') + ', ILO' + (j + 1);
          if (il.text.trim() && !iloClos(il).length) form(w + ' has no CLO tag.', { row: r.id });
          if (!il.text.trim() && il.tags.length) form(w + ' is tagged but has no text.', { row: r.id });
          il.tags.forEach((t) => { const i = tagInfo(d, t); if (!i.ok) form(w + ' has a tag that no longer resolves: ' + i.label + '.', { row: r.id }); });
        });
      });
      coverage(d).forEach((c) => { if (!c.rows.length) advice('CLO ' + c.n + ' is not covered by any ILO yet.', { clo: c.id }); });
      const ws = Object.keys(weekSet(d.plan)).length;
      if (ws < 18) advice('The plan covers ' + ws + ' of 18 weeks.');
    }
    if (key === 'reqs') {
      if (d.reqs.filter((r) => r.t.trim()).length < 3) form('List at least 3 course requirements.');
    }
    if (key === 'refs') {
      GROUPS.forEach((g) => {
        const grp = d.refs[g[0]];
        if (!grp.na && !grp.items.some((x) => x.t.trim())) form(g[1] + ' has no entries. Add one or mark it not applicable.');
      });
    }
    if (key === 'grade') {
      const t = gradeTotal(d);
      if (t !== 100) form('Components total ' + t + '%, not 100%.');
      if (!d.grading.rows.length) form('Add grading components.');
      const ex = examRows(d).length;
      if (ex < 3) advice('Only ' + ex + ' of 3 grading terms have an exam row in the Learning Plan.');
      if (d.grading.override.on && (!d.grading.override.term.trim() || !d.grading.override.final.trim())) form('Override formulas cannot be empty.');
    }
    return o;
  }
  // Only the problems that stop the faculty member from moving on.
  const blockers = (d, key) => issues(d, key).filter((i) => i.blocking);

  // Step status: 'done' when nothing blocks it, 'attn' when visited with blockers, 'todo' otherwise. Advice never changes a
  // status. Review is done only when steps 1-6 are, which is also what unlocks Re-check and Submit.
  function stepStatuses(d, visited = {}, { sequential = false } = {}) {
    const st = STEPS.map((s, i) => {
      if (s.key === 'review') return 'todo';
      return blockers(d, s.key).length === 0 ? 'done' : (visited[i] ? 'attn' : 'todo');
    });
    const sixDone = st.slice(0, 6).every((x) => x === 'done');
    st[6] = sixDone ? 'done' : (visited[6] ? 'attn' : 'todo');
    const firstBlocked = st.slice(0, 6).findIndex(status => status !== 'done');
    // Sequential faculty navigation: valid auto-loaded data must not mark an inaccessible step complete.
    const statuses = sequential && firstBlocked >= 0 ? st.map((status, index) => index > firstBlocked ? 'locked' : status) : st;
    return { statuses, complete: sixDone, firstBlocked };
  }

  // The first of steps 1-6 that still has a blocker (its index), or -1. The builder lets you go forward only up to it.
  function firstBlocked(d) {
    for (let i = 0; i < 6; i++) if (blockers(d, STEPS[i].key).length) return i;
    return -1;
  }

  const outcomesReady = d => hasOutcomeSelection(d) && blockers(d, 'clos').length === 0;
  return { institution, institutionFor, programs, year, outcomesReady, hasOutcomeSelection, poList, egaList, tagInfo, rowHits, coverage, removeClo, impliedEgas, missingEgas, formulas, refAge, suggestReqs, issues, blockers, firstBlocked, stepStatuses };
}

export const defaultModel = createModel({ institution: SEED_INSTITUTION, programs: SEED_PROGRAMS, year: CURRENT_SCHOOL_YEAR.startYear });
