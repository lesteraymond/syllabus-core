'use strict';
// Helpers over the rows of the learning plan, shared by the checker's pair builders.
// An examination or review row: judged by the schedule, never as an ordinary instructional topic. A row marked kind 'exam', or a short lesson row
// whose first line is only an examination ("PRELIM EXAMINATION", "Midterm Exam"), is one.
const examLike = row => row.kind === 'exam' || (String(row.contents || '').trim().length <= 120 && /^\W*(prelim(inary)?|midterm|final|periodical)?\s*(exam(ination)?s?|review for (the )?\w*\s*exam(ination)?s?)\W*$/i.test(String(row.contents || '').trim().split('\n')[0].replace(/\*/g, '')));
const brief = (text, max = 160) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
const ORIENTATION = /orientation|syllabus|vision|mission|requirement|grading|policy|policies|expectation|objective|introduction to the course/i;
// Week 1 as the course orientation (objectives, requirements, grading, policies): its ILO describes the course, not a CLO competence, so the CLO-mapping
// question (Stage B3) is not asked about it.
const orientationRow = row => /^\s*1\s*($|-|,)/.test(String(row.week ?? '')) && ORIENTATION.test(String(row.contents || ''));
// An orientation ILO is one of such a row whose own text is about the course itself (not a technical competence that happens to be in Week 1).
const orientationIlo = (row, ilo) => orientationRow(row) && ORIENTATION.test(String((ilo && ilo.text) || ''));
// ---- weeks named in text, and topics that repeat another week ----
const weeksIn = value => { const out = []; for (const part of String(value ?? '').replace(/week/ig, '').split(',')) { const m = part.trim().match(/^(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?$/); if (!m) continue; for (let w = Number(m[1]); w <= Number(m[2] || m[1]); w++) out.push(w); } return out; };
// The weeks an explanation names ("Weeks 2, 3 and 7", "Week 9-10"), split into those the plan has and those it does not (evidence the model invented).
function citedWeeks(explanation, content) {
  const present = new Set((content.plan || []).flatMap(row => weeksIn(row.week)));
  const cited = new Set();
  for (const m of String(explanation ?? '').matchAll(/\bweeks?\s+(\d{1,2}(?:\s*[-–]\s*\d{1,2})?(?:\s*(?:,|and|&|or)\s*\d{1,2}(?:\s*[-–]\s*\d{1,2})?)*)/gi)) for (const w of weeksIn(m[1].replace(/\s*(and|&|or)\s*/gi, ','))) cited.add(w);
  const all = [...cited].sort((a, b) => a - b);
  return { present: all.filter(w => present.has(w)), missing: all.filter(w => !present.has(w)) };
}
const STOP = new Set(['the', 'and', 'for', 'with', 'week', 'topic', 'topics', 'introduction', 'basic', 'basics', 'using', 'from']);
const tokens = text => new Set((String(text ?? '').toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter(word => !STOP.has(word)));
// Another instructional week whose course content a proposed replacement mostly repeats (overlap of the shorter one's words), or null. A suggestion
// that only restates a topic the plan already teaches elsewhere is not a correction.
function similarWeek(text, plan, selfIndex, threshold = 0.6) {
  const mine = tokens(text);
  if (mine.size < 3) return null;
  for (let i = 0; i < (plan || []).length; i++) {
    const row = plan[i];
    if (i === selfIndex || examLike(row) || !String(row.contents || '').trim()) continue;
    const other = tokens(row.contents);
    if (other.size < 3) continue;
    let shared = 0; for (const word of mine) if (other.has(word)) shared++;
    const overlap = shared / Math.min(mine.size, other.size);
    if (overlap >= threshold) return { week: row.week, index: i, overlap: Math.round(overlap * 100) / 100 };
  }
  return null;
}
module.exports = { examLike, brief, ORIENTATION, orientationRow, orientationIlo, weeksIn, citedWeeks, similarWeek };
