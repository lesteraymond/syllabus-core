// One pass of the syllabus builder's autosave, kept apart from React so its rules can be tested on their own (views/builder2/useDraft.js
// owns the timing and the screen state). The rules:
//  - nothing is sent for sections that have not changed since the last confirmed save;
//  - a syllabus has no row on the server until it has a subject: before that there is nothing worth keeping, and a form abandoned at
//    "choose a program" must not leave an empty draft behind in My Syllabi;
//  - the row is created by the first save, and if that very save is refused because the person already has a syllabus on the subject
//    (code syllabus_exists, see server/lib/subjectLock.js) the row is deleted again, so a refused pick leaves nothing behind. A row that
//    already existed, or any other failure, keeps it: a retry then reuses the row instead of creating a second one.
// `idRef` and `saved` are the hook's refs ({ current }); both are updated here. Resolves 'unchanged', 'no-subject' or 'saved'; a failed
// request throws.
export const hasSubject = (d) => !!(d && d.meta && d.meta.courseId);

export async function saveOnce({ api, d, idRef, saved, sections, schemaVersion }) {
  const changed = sections.filter((k) => d[k] !== undefined && JSON.stringify(d[k]) !== saved.current[k]);
  if (!changed.length) return 'unchanged';
  if (!idRef.current && !hasSubject(d)) return 'no-subject';
  let created = false;
  if (!idRef.current) { idRef.current = (await api.createDraft()).id; created = true; }
  const body = {};
  const sent = {};
  changed.forEach((k) => { body[k] = d[k]; sent[k] = JSON.stringify(d[k]); });
  try {
    await api.saveContent(idRef.current, body, schemaVersion);
  } catch (e) {
    if (created && e && e.data && e.data.code === 'syllabus_exists') {
      const id = idRef.current;
      idRef.current = null;
      await api.remove(id).catch(() => {}); // the pick was refused: take the empty row away again
    }
    throw e;
  }
  Object.assign(saved.current, sent);
  return 'saved';
}
