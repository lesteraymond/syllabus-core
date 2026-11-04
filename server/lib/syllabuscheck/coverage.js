'use strict';
// Stage B4: whole-course CLO coverage.
//   coveragePairs  one question per CLO, asked once per syllabus revision: do the weeks that are tagged to it, read by their CONTENT and ILO text,
//                  really build it? (an identifier in a weekly row is never coverage)
//   coverageTable  no model call: from the verdicts already made (ILO-CLO) it lists for every CLO the weeks that are tagged, the weeks whose ILO was
//                  judged to build it, the tagged weeks that were judged not to, and the weeks that cannot count (content off-course, not yet checked)
// Examination rows are handled apart and never counted for or against a CLO; course-orientation weeks are simply weeks without a tag.
const { weeksOf } = require('./validation');
const { examLike, brief } = require('./planrows');

const MAX_TAGGED = 12, MAX_OTHER = 14;
const tagOf = clo => `clo:${clo.id}`;
const instructional = row => !examLike(row) && row.kind !== 'exam';
const weekCount = row => (weeksOf(row.week) || [1]).length; // "9-10" is two weeks
const level = clo => String(clo.level || '').trim();
const isValuesLevel = clo => /integration of values/i.test(level(clo));

function taggedRows(content, clo) {
  return (content.plan || []).map((row, i) => ({ row, i }))
    .filter(({ row }) => instructional(row) && (row.ilos || []).some(ilo => String(ilo.text || '').trim() && (ilo.tags || []).includes(tagOf(clo))));
}

// The text of one CLO's question. Pure; the engine adds it as a 'CLO-coverage' pair.
function coveragePairs(content, add) {
  const clos = content.clos || [], rows = content.plan || [];
  const teaching = rows.filter(row => instructional(row) && String(row.contents || '').trim());
  if (teaching.length < 3) return;
  clos.forEach((clo, k) => {
    if (!String(clo.statement || '').trim()) return;
    const mine = taggedRows(content, clo), tagged = new Set(mine.map(({ i }) => i));
    const lines = ['Weeks tagged to this CLO:'];
    if (!mine.length) lines.push('(none)');
    for (const { row, i } of mine.slice(0, MAX_TAGGED)) {
      const ilos = (row.ilos || []).filter(ilo => String(ilo.text || '').trim() && (ilo.tags || []).includes(tagOf(clo))).map(ilo => brief(ilo.text, 200)).join(' / ');
      lines.push(`- Week ${row.week}: ILO: ${ilos} | Content: ${brief(row.contents, 160)}${isValuesLevel(clo) ? ` | Values: ${brief(row.values, 300) || '(none written)'}` : ''}`);
    }
    if (mine.length > MAX_TAGGED) lines.push(`(${mine.length - MAX_TAGGED} more tagged weeks not shown)`);
    lines.push('Other weeks (not tagged to this CLO):');
    const others = rows.map((row, i) => ({ row, i })).filter(({ row, i }) => instructional(row) && !tagged.has(i) && String(row.contents || '').trim());
    for (const { row } of others.slice(0, MAX_OTHER)) lines.push(`- Week ${row.week}: ${brief(row.contents, 80)}`);
    if (!others.length) lines.push('(none)');
    if (others.length > MAX_OTHER) lines.push(`(${others.length - MAX_OTHER} more weeks not shown)`);
    const exams = rows.filter(row => !instructional(row)).map(row => row.week);
    if (exams.length) lines.push(`Examination weeks: ${exams.join(', ')}`);
    add(`coverage-clo${k}`, 'CLO-coverage', `CLO ${k + 1} [course level tag: ${level(clo) || 'not stated'}]: ${String(clo.statement).trim()}`, lines.join('\n'), 'plan', null);
  });
}

// Deterministic evidence per CLO from the verdicts already made. `judgements` are the alignment judgements (may be empty offline).
function coverageTable(content, judgements = []) {
  const byId = new Map(judgements.map(j => [j.id, j]));
  const contentOff = i => byId.get(`row${i}-content`)?.label === 'NOT_ALIGNED';
  return (content.clos || []).map((clo, k) => {
    const supported = [], unsupported = [], unverified = [], offCourse = [], tagged = [];
    for (const { row, i } of taggedRows(content, clo)) {
      tagged.push(row.week);
      const verdicts = (row.ilos || []).map((ilo, j) => (String(ilo.text || '').trim() && (ilo.tags || []).includes(tagOf(clo)) ? byId.get(`row${i}-ilo${j}-${tagOf(clo)}`) : null)).filter(Boolean);
      const checked = verdicts.filter(j => !j.unverified && j.label !== 'INSUFFICIENT_EVIDENCE');
      if (contentOff(i)) offCourse.push(row.week);
      else if (checked.some(j => j.label === 'ALIGNED')) supported.push(row.week);
      else if (checked.length) unsupported.push(row.week);
      else unverified.push(row.week);
    }
    const weeks = list => ({ weeks: list, count: content.plan.filter(row => list.includes(row.week)).reduce((n, row) => n + weekCount(row), 0) });
    return { cloIndex: k, cloId: clo.id, level: level(clo), tagged: weeks(tagged), supported: weeks(supported), unsupported: weeks(unsupported), unverified: weeks(unverified), offCourse: weeks(offCourse) };
  });
}
// The state of every CLO's instructional coverage, from the model's verdict AND the evidence of the checked ILO-CLO relationships:
//   adequate              at least one week really builds it (a checked week, or a week the model names and the plan has)
//   partial               a specific part of the CLO is not built by any week (named in the explanation)
//   insufficient          no week builds it
//   insufficient_evidence it cannot be decided: not asked (plan too short), not answered, the explanation cites a week the plan lacks, or the model
//                         says "adequate" while no checked week and no named week supports it (conflicting evidence)
// Nothing here invents a requirement: a CLO is only judged against its own statement and the weeks supplied.
const { citedWeeks } = require('./planrows');
function coverageSummary(content, table, judgements = []) {
  const byId = new Map(judgements.map(j => [j.id, j]));
  const teaching = (content.plan || []).filter(instructional).filter(row => String(row.contents || '').trim()).length;
  return (content.clos || []).map((clo, k) => {
    if (!String(clo.statement || '').trim()) return null;
    const row = table[k] || { supported: { weeks: [] }, unsupported: { weeks: [] }, tagged: { weeks: [] }, offCourse: { weeks: [] } };
    const j = byId.get(`coverage-clo${k}`);
    const cited = j && !j.unverified ? citedWeeks(j.explanation, content) : { present: [], missing: [] };
    const supporting = { checked: row.supported.weeks, cited: cited.present.filter(w => !row.supported.weeks.some(label => String(label) === String(w))).map(String) };
    let state, reason = null;
    if (!j || j.unverified || j.label === 'INSUFFICIENT_EVIDENCE') { state = 'insufficient_evidence'; reason = teaching < 3 ? 'plan_too_short' : 'not_checked'; }
    else if (cited.missing.length) { state = 'insufficient_evidence'; reason = 'cited_week_not_in_plan'; }
    else if (j.label === 'ALIGNED') { state = supporting.checked.length || supporting.cited.length ? 'adequate' : 'insufficient_evidence'; if (state !== 'adequate') reason = 'conflicting_evidence'; }
    else state = j.label === 'PARTIALLY_ALIGNED' ? 'partial' : 'insufficient';
    return { cloIndex: k, number: k + 1, level: level(clo), state, reason, supportingWeeks: supporting, taggedWeeks: row.tagged.weeks, taggedButNotBuilding: row.unsupported.weeks, offCourseWeeks: row.offCourse.weeks, gaps: state === 'partial' || state === 'insufficient' ? String(j.explanation || '').slice(0, 1200) : null };
  }).filter(Boolean);
}
module.exports = { coverageSummary, coveragePairs, coverageTable, taggedRows, isValuesLevel, MAX_TAGGED, MAX_OTHER };
