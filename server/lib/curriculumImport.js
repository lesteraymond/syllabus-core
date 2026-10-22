'use strict';
// Works out what importing the curricula (db/curriculum-data.js) does to a catalog, as plain data, without touching a database:
// which programs and subjects to create, which existing subject to retitle or recode, and each subject's prerequisites. db/seed-curriculum.js
// applies the plan; the tests run it on small catalogs.
//
//   planImport(data, existing)  -> { programs, courses, prerequisites, units, notes }
//     existing = { programs: [{ id, code, name }], courses: [{ id, code, title, programCode }] }
//
// A subject code is unique within a program, not across the catalog, so every program gets its own full list exactly as printed (the same
// ENGEC, CAD or IS-CITE may exist in several programs, and IT 204 may mean different subjects in BSIT and in Cyber Security). Per program:
//   - a subject with the same code (ignoring spaces and hyphens) is the same subject: its title is updated to the curriculum's when it differs;
//   - a subject an earlier import added with a program suffix (IT 202-CS, when codes had to be unique everywhere) is given the printed code back;
//   - anything else is added.
// General education (GE, PATHFit, NSTP, TH) is not a subject of the catalog: a prerequisite that names one is kept as its printed label. A
// prerequisite that names a subject of the program's curriculum is a link to that program's subject.
const alnum = (s) => String(s).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const normTitle = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();

// "IT-204" and "IT 204-" are "IT 204"; "CpE-300" is "CpE 300"; "CAPSPRO1" is "CAPSPRO 1". Codes like IT-ELEC1 and TECHPREN-CITE are kept.
function canonicalCode(code) {
  let c = String(code).trim().replace(/[\s-]+$/, '').replace(/\s+/g, ' ');
  c = c.replace(/^([A-Za-z]+)-(\d{3})$/, '$1 $2');
  c = c.replace(/^(CAPSPRO)(\d)$/i, '$1 $2');
  return c;
}

const GENERAL = [/^GE\b/i, /^PATHFit\b/i, /^NSTP\b/i, /^TH \d/i];
// The program suffixes an earlier import used to keep codes unique across programs.
const OLD_SUFFIXES = ['IT', 'CS', 'CPE', 'IE'];
const isGeneral = (code) => GENERAL.some((re) => re.test(String(code).trim()));

function planImport(data, existing) {
  const notes = [];
  const known = existing.courses.map((c) => ({ key: 'db:' + c.id, id: c.id, code: c.code, norm: alnum(c.code), title: c.title, normTitle: normTitle(c.title), programCode: c.programCode, existing: true, action: 'unchanged' }));
  const resolve = new Map(); // program code | printed code -> course key
  const defined = new Set(); // course keys whose prerequisites are already set
  const subjects = []; // { key, programCode, printed, prereq }
  const programs = [];
  const change = (c, title, code) => {
    if (title !== undefined && normTitle(title) !== c.normTitle) { c.oldTitle = c.title; c.newTitle = title; c.title = title; c.normTitle = normTitle(title); c.action = 'update'; }
    if (code !== undefined && code !== c.code) { c.oldCode = c.code; c.newCode = code; c.code = code; c.norm = alnum(code); c.action = 'update'; }
  };

  data.programs.forEach((program) => {
    const had = existing.programs.find((p) => p.code === program.code);
    programs.push({ code: program.code, name: program.name, exists: !!had, id: had ? had.id : null });
    const mine = () => known.filter((c) => c.programCode === program.code);
    program.subjects.forEach((s) => {
      const printed = canonicalCode(s.code);
      if (isGeneral(printed)) return;
      const norm = alnum(printed);
      let found = mine().find((c) => c.norm === norm);
      if (found) {
        if (found.existing) change(found, s.title);
        else if (found.normTitle !== normTitle(s.title)) notes.push(`${program.code}: ${printed} is listed twice with different titles ("${found.title}" and "${s.title}"); the first is kept.`);
      } else {
        // A subject an earlier import added as "IT 202-CS" gets its printed code back.
        found = mine().find((c) => c.existing && OLD_SUFFIXES.some((x) => c.code === printed + '-' + x) && c.normTitle === normTitle(s.title));
        if (found) { change(found, s.title, printed); notes.push(`${program.code}: ${found.oldCode} is now ${printed}.`); }
      }
      if (!found) {
        found = { key: 'new:' + program.code + '|' + printed, id: null, code: printed, norm, title: s.title, normTitle: normTitle(s.title), programCode: program.code, existing: false, action: 'create' };
        known.push(found);
      }
      resolve.set(program.code + '|' + printed, found.key);
      subjects.push({ key: found.key, programCode: program.code, printed, prereq: s.prereq.map(canonicalCode), units: s.units || {} });
    });
  });

  // Prerequisites: a link where the printed code is a subject of the same program's curriculum, else the printed label.
  const prerequisites = [];
  subjects.forEach((s) => {
    if (defined.has(s.key)) return;
    defined.add(s.key);
    const items = s.prereq.map((label) => ({ label, target: resolve.get(s.programCode + '|' + label) || null })).filter((it) => it.target !== s.key);
    // A subject with no prerequisite says so ("None"), which is not the same as a subject nobody has set yet.
    prerequisites.push({ key: s.key, items: items.length ? items : [{ label: 'None', target: null }] });
  });

  // Credit units, for every subject the curricula list.
  const units = subjects.map((s) => ({ key: s.key, lecture: s.units.lecture, lab: s.units.lab }));
  const courses = known.filter((c) => c.action !== 'unchanged' || defined.has(c.key));
  return { programs, courses, prerequisites, units, notes };
}

// The text the syllabus form shows for a subject's prerequisites: each linked subject as its current code and name ("IT 202 – Computer
// Programming 1 (Fundamentals of Programming)"), or the printed label (3rd Yr), separated by "; " because a subject's name can contain commas.
// null when nobody has set them (no rows), so the form is left alone.
function prerequisiteText(items) {
  const parts = items.map((it) => {
    const code = (it.code || it.label || '').trim();
    const title = (it.title || '').trim();
    return code && title ? code + ' – ' + title : code;
  }).filter(Boolean);
  return parts.length ? parts.join('; ') : null;
}

module.exports = { planImport, canonicalCode, isGeneral, prerequisiteText, alnum, normTitle };
