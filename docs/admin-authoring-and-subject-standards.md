# Syllabus authoring and subject setup

Vision, Mission, EGAs, POs and CLOs are authored in syllabus builder Step 2 (Learning Outcomes). Faculty edit these values inside the existing builder; they use the same section autosave, ownership/assignment restrictions and submission workflow as the rest of the form. Administrators retain program/subject identity, assignment, deadline and review controls. The old SubjectModal authoring entry point has been removed from Program & Subjects.

Schema version 3 adds an `outcomes` section to the existing syllabus JSON: `{ vision, mission: { lead, items }, egas, pos }`. CLOs retain their existing `clos` section and stable string IDs. This needs no database schema migration. Choosing a subject copies its existing starting values once; later catalog refreshes never overwrite faculty edits. Selecting a different subject resets outcome mappings, with confirmation in the builder. Read-only/approved syllabi and version history retain their original content.

An editable legacy syllabus adopts the submitted snapshot when present, otherwise its selected subject's existing values. Reading does not write to the database. The API marks this adoption so the next autosave persists both outcomes and CLOs, even if only another section was edited. Legacy catalog endpoints and stored subject setup remain for compatibility; they do not overwrite syllabus-owned outcomes.

Server validation accepts incomplete text for draft autosave, rejects malformed or dangling outcome references, and requires complete Step 2 content on submission. Preview, learning-plan tags, compliance checks, stale-check hashes and revision comparisons use syllabus-owned values. Learning-outcome-only revisions now count as actual changes. Every new submission snapshots those exact authored values for review.

Administrators can navigate builder steps in any order. My Syllabi lists their own drafts and saved syllabi. Other people's drafts remain private. Faculty keep their assignment restrictions and sequential navigation.

Administrator workflow: drafts remain in My Syllabi and cannot be checked through the administrator AI Checker. Completing the form and choosing Save and continue validates the saved content on the server and moves the syllabus to the existing under_review state. This handoff does not approve the syllabus or create a faculty submission. AI Checker lists completed records awaiting a decision, including the administrator's own checked record; there is no My checked drafts card.

The administrator checks the completed syllabus, then explicitly chooses Approve & Add to Repository, or Edit Syllabus. Editing returns it to Draft before the builder opens, removes it from AI Checker, and keeps its earlier checks in storage. A new handoff increments a server-managed review cycle, so a previous check cannot approve the next cycle even when no text changed. The server also rejects approval if content or subject setup changed, the check is pending/failed, or the result ID differs from the one the administrator reviewed. Published syllabi are locked and appear in Repository.

Legacy subject setup remains in courses.standards_json and course_clos. Programs organize subjects. Those catalog values are starting values for a new syllabus, rather than the source of subsequent faculty edits. Existing legacy version counters and protections remain in place for older API clients.

Step 2 opens its editors after program and subject selection, including when no outcomes exist yet. The finished-form preview is populated after required learning-outcome fields are complete. Submitted snapshots keep their original texts, including older snapshots without subject-scoped data.

## Database update

Run from server: npm run migrate-subject-standards. The additive, repeatable migration adds standards_json and copies existing settings into independent subject records. Existing submitted versions are untouched. New subjects explicitly start with blank setup. Restart the API if it does not reload automatically.

node db/verify-subject-standards.js exercises blank defaults, isolation, version conflicts and row locking against MySQL, rolling back every synthetic record. The automated HTTP regressions cover ownership, subject isolation, stale saves, required AI checks, check invalidation and direct publication.

## History and communication

Completed administrator handoffs save immutable revisions. Changed completed content creates the next version; autosaves, unchanged handoffs and approval do not duplicate versions. Returning older completed records to draft preserves their snapshot before editing. Admin My Syllabi keeps History available while editing, but hides faculty-only comments, feedback and messaging. Shared UI and server checks reject administrator self-conversations; faculty-owned syllabi retain administrator/faculty messaging.
