# Administrator authoring and subject setup

Administrators can navigate builder steps in any order. My Syllabi lists their own drafts and saved syllabi. Other people's drafts remain private. Faculty keep their assignment restrictions and sequential navigation.

Administrator workflow: drafts remain in My Syllabi and cannot be checked through the administrator AI Checker. Completing the form and choosing Save and continue validates the saved content on the server and moves the syllabus to the existing under_review state. This handoff does not approve the syllabus or create a faculty submission. AI Checker lists completed records awaiting a decision, including the administrator's own checked record; there is no My checked drafts card.

The administrator checks the completed syllabus, then explicitly chooses Approve & Add to Repository, or Edit Syllabus. Editing returns it to Draft before the builder opens, removes it from AI Checker, and keeps its earlier checks in storage. A new handoff increments a server-managed review cycle, so a previous check cannot approve the next cycle even when no text changed. The server also rejects approval if content or subject setup changed, the check is pending/failed, or the result ID differs from the one the administrator reviewed. Published syllabi are locked and appear in Repository.

Each subject stores its own vision, mission, EGAs and POs in courses.standards_json. CLOs remain in course_clos, with stable IDs. Programs organize subjects; changing a subject's setup does not update sibling subjects or institution/program defaults. Each setup section has its own version counter. Saves lock the subject row, reject stale versions, and refuse removal of outcomes still referenced by that subject's POs or CLOs. CLO saves validate against that subject's own EGA/PO numbers under the same lock.

Learning Outcomes and the preview show the selected subject's setup only after program and subject selection and complete learning-outcome setup. Submitted snapshots keep their original texts, including older snapshots without subject-scoped data.

## Database update

Run from server: npm run migrate-subject-standards. The additive, repeatable migration adds standards_json and copies existing settings into independent subject records. Existing submitted versions are untouched. New subjects explicitly start with blank setup. Restart the API if it does not reload automatically.

node db/verify-subject-standards.js exercises blank defaults, isolation, version conflicts and row locking against MySQL, rolling back every synthetic record. The automated HTTP regressions cover ownership, subject isolation, stale saves, required AI checks, check invalidation and direct publication.

## History and communication

Completed administrator handoffs save immutable revisions. Changed completed content creates the next version; autosaves, unchanged handoffs and approval do not duplicate versions. Returning older completed records to draft preserves their snapshot before editing. Admin My Syllabi keeps History available while editing, but hides faculty-only comments, feedback and messaging. Shared UI and server checks reject administrator self-conversations; faculty-owned syllabi retain administrator/faculty messaging.
