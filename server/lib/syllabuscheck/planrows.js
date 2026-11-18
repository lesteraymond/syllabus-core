'use strict';
// Helpers over the rows of the learning plan, used by the new AI Checker (pipeline/extract.js).
// An examination or review row: judged by the schedule, never as an ordinary instructional topic. A row marked kind 'exam', or a short lesson row
// whose first line is only an examination ("PRELIM EXAMINATION", "Midterm Exam"), is one.
const examLike = row => row.kind === 'exam' || (String(row.contents || '').trim().length <= 120 && /^\W*(prelim(inary)?|midterm|final|periodical)?\s*(exam(ination)?s?|review for (the )?\w*\s*exam(ination)?s?)\W*$/i.test(String(row.contents || '').trim().split('\n')[0].replace(/\*/g, '')));
const ORIENTATION = /orientation|syllabus|vision|mission|requirement|grading|policy|policies|expectation|objective|introduction to the course/i;
// The weeks a week cell names ("3", "3-4", "Week 1, 2").
const weeksIn = value => { const out = []; for (const part of String(value ?? '').replace(/week/ig, '').split(',')) { const m = part.trim().match(/^(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?$/); if (!m) continue; for (let w = Number(m[1]); w <= Number(m[2] || m[1]); w++) out.push(w); } return out; };

module.exports = { examLike, ORIENTATION, weeksIn };
