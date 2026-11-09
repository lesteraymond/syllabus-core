'use strict';
// One lesson, one consistent recommendation. Policy V2's Course Title <-> Course Content relationship (Content-course) decides whether a week's content
// belongs to the course. When it finds the content NOT_ALIGNED (not about the course), every other rewrite proposed for that week (an ILO, the activity,
// the assessment task, the values statement, or the content fitted to its own ILO) was written for the current topic and would keep it. Those drafts are
// withheld from the recommendation list for that lesson, and the faculty member is left with the Policy V2 finding: review the week's topic first.
//
// Deterministic and advisory only: it reads the Policy V2 records already in the result and removes suggestions; it never edits the syllabus, never adds
// text, never touches a judgement, a finding, a deduction or the score, and keeps every suggestion based on the Content-course relationship itself (a
// rewrite of the topic toward the course). Suggestions for other weeks, for the CLOs and for the course description are untouched. What was withheld is
// listed in `suggestionsWithheld` with its reason, so nothing disappears without a record. A PARTIALLY_ALIGNED week (related but loosely tied) is not
// treated as off-topic.
const ROW = /^plan\[(\d+)\]/;
const relationshipIdsOf = (s) => (s.basedOn && s.basedOn.length ? s.basedOn : [s.relationshipId || s.id]).map((id) => String(id).replace(/^(SEM:|review:)/, ''));

// The weeks Policy V2 found off-topic: [{ row, week, relationshipId, explanation }].
function offTopicLessons(hybrid) {
  const records = (hybrid && hybrid.academicV2 && hybrid.academicV2.academic && hybrid.academicV2.academic.relationships) || [];
  return records.filter((r) => r && r.relationshipType === 'Content-course' && r.academicJudgment === 'NOT_ALIGNED' && ROW.test(String(r.path || '')))
    .map((r) => ({ row: Number(ROW.exec(r.path)[1]), week: r.week ?? null, relationshipId: r.id, explanation: r.explanation || null }));
}

// The fields of `hybrid` to replace: { suggestions, suggestionsWithheld } when something is withheld, {} otherwise.
function withholdConflicts(hybrid) {
  const lessons = offTopicLessons(hybrid);
  if (!lessons.length || !Array.isArray(hybrid.suggestions)) return {};
  const byRow = new Map(lessons.map((l) => [l.row, l]));
  const kept = [], withheld = [];
  for (const s of hybrid.suggestions) {
    const m = ROW.exec(String((s && s.path) || '')), lesson = m && byRow.get(Number(m[1]));
    if (lesson && !relationshipIdsOf(s).includes(lesson.relationshipId)) withheld.push({ id: s.id, path: s.path, basedOn: s.basedOn || [], reason: 'off_topic_lesson', offTopicRelationship: lesson.relationshipId, week: lesson.week });
    else kept.push(s);
  }
  return withheld.length ? { suggestions: kept, suggestionsWithheld: [...(hybrid.suggestionsWithheld || []), ...withheld] } : {};
}

module.exports = { offTopicLessons, withholdConflicts };
