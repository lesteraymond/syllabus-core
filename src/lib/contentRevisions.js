// Client side of the mandatory revision contract for builder content (server/lib/contentRevision.js, PUT /syllabi/:id/content).
// This tab remembers, for each syllabus, the revision of every section it last read or saved, and sends that revision with its next save of the same section.
//   409 revision_conflict  the section was saved by someone else since this tab read it: nothing was written
//   428 revision_required  this tab sent no base revision for a section that already has content: nothing was written
// Pure functions, kept apart from the network layer so the rules can be tested on their own.

// The base revisions to send for the sections being saved. With nothing known for this syllabus (a draft this tab has just created) none are sent, and the server
// accepts that only for sections that have no stored content yet.
export const baseRevisionsFor = (known, sections) => (known
  ? Object.fromEntries(Object.keys(sections).filter((k) => known[k] !== undefined).map((k) => [k, known[k]]))
  : undefined);

// What this tab knows after a successful save. A section this tab did not send is NOT refreshed (another author may have changed it; this tab has not seen that),
// except the sections the server itself reports as derived from this save. A tab that knew nothing (it created the draft) adopts every saved revision.
export const nextKnown = (known, sections, response) => {
  if (!response || !response.revisions) return known;
  if (!known) return { ...response.revisions };
  const adopt = [...Object.keys(sections), ...(Array.isArray(response.derivedSections) ? response.derivedSections : [])];
  return { ...known, ...Object.fromEntries(adopt.map((k) => [k, response.revisions[k]])) };
};

// A save refused because this tab's copy is not the latest (409), or because it could not say which copy it had (428).
export const isRevisionProblem = (e) => !!(e && e.data && ((e.status === 409 && e.data.code === 'revision_conflict') || (e.status === 428 && e.data.code === 'revision_required')));
