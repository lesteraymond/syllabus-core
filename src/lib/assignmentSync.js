// The Assignments modal keeps working while subjects are created in Program & Subjects. When the browser tab regains focus
// it re-fetches the programs and subjects and merges them with what the admin has ticked so far.
// Pure functions, so they are unit-tested without React.

// Merges a freshly fetched catalog with the admin's current (possibly unsaved) selection:
//  - ticks are never reset: a program or subject that still exists keeps its tick, untouched;
//  - a program or subject that no longer exists is dropped from the ticks;
//  - a new subject appears unticked (it is simply in the list);
//  - the focused program stays focused, or falls back to the first program if it was removed.
export function mergeCatalog({ programs, courses }, { progSel, courseSel, focusId }) {
  const programIds = new Set(programs.map((p) => p.id));
  const courseIds = new Set(courses.map((c) => c.id));
  return {
    programs,
    courses,
    progSel: new Set([...progSel].filter((id) => programIds.has(id))),
    courseSel: new Set([...courseSel].filter((id) => courseIds.has(id))),
    focusId: programIds.has(focusId) ? focusId : (programs[0] ? programs[0].id : null),
  };
}

export const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// True when the admin has ticked or unticked something that is not saved yet.
export const hasUnsaved = (saved, now) => !sameSet(saved.progSel, now.progSel) || !sameSet(saved.courseSel, now.courseSel);
