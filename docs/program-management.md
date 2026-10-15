# Administrator program maintenance

Program & Subjects contains a Programs table with Rename and Delete actions using shared buttons and modal styles. Creating a program with its first subject remains the existing workflow. Program names and codes can change; numeric IDs remain stable so faculty assignments and subject relationships keep their identities. Codes use 2–20 letters, digits or hyphens and start with a letter. Code changes require both the loaded name and code; name-only API clients remain compatible. Duplicate or historically reserved codes are refused. Earlier names and codes are retained in separate alias tables, and changes record the previous values in the audit event.

## Permanent deletion

Deletion always uses two explicit stages:

1. The administrator reviews affected subjects and syllabi, with totals for saved versions, assignment links and uploaded files, and must check the acknowledgement box before Delete Program becomes available. Syllabus lists show at most the first 100 items while totals cover the complete impact.
2. The administrator types the exact program code and acknowledges that deletion is permanent. Approved syllabi are included. The final button is disabled until both requirements are satisfied.

The API independently requires an authenticated administrator, a signed preview tied to that administrator/program, the exact code and acknowledgement. Previews expire after ten minutes. An impact change requires a fresh preview and both confirmation stages again. A configured SESSION_SECRET is used with a separate signing context; otherwise a per-process random key makes previews invalid after restart.

GET /api/programs/:id/deletion-preview, PATCH /api/programs/:id and DELETE /api/programs/:id use numeric IDs. The delete body is { previewToken, confirmCode, acknowledgeCascade: true }. Renaming accepts { name, expectedName, code, expectedCode }. Program-code aliases resolve earlier code references to the same current program ID. Editable drafts adopt the current code from catalog data; saves and submissions also canonicalize it from the selected subject. Submitted/approved version content is never rewritten by a catalog rename. Pending deletion previews become stale when a code changes, and refreshed confirmation dialogs use the latest code.

The server locks the program, subjects, matching legacy curriculum records, affected syllabi/versions and assignment links in a transaction. It deletes the selected syllabi before subjects, curriculum rows and the program. Existing foreign keys remove related versions, comments, messages, notifications, compliance runs/findings and assignment links. Faculty accounts are retained. The normal faculty rule still requires an assigned subject within an assigned program; program-only assignment cannot create a syllabus.

Current course IDs are authoritative for ownership. For syllabi without a course ID, fallback association uses program codes/names, retained names, curriculum relations, subject codes and saved versions. A legacy name claimed by another current program blocks deletion until the ambiguity is resolved. Versions of unrelated current-course syllabi are not used to delete those syllabi. Legacy free-text creation now holds the course authorization lock through its transaction so it cannot race program deletion.

The audit event and PDF cleanup jobs commit with deletion. Files are removed only after commit, only directly inside configured syllabus upload storage, and only if no remaining syllabus/version references them. Names outside that boundary are rejected. Failed cleanup remains queued and retries every five minutes and on server startup. The interface reports pending cleanup when it has not completed. Shared files remain for their remaining owners. Student accounts and COR files are not deleted; existing course foreign-key behavior detaches deleted catalog subjects from enrollment records.

## Deployment

From server/, run before deploying the API:

    npm run migrate-program-management

The repeatable additive migration creates program_name_aliases, program_code_aliases, catalog_events and catalog_file_cleanup. Run it again when upgrading the earlier name-only feature to add the historical-code table. Fresh schema.sql includes them. The migration was applied locally; no existing programs, subjects or syllabi were renamed or deleted during implementation.

## Verification

The full suite passes 459 tests: 414 domain/API/motion checks and 45 localization/rendered UI checks. New coverage includes administrator-only access, invalid/expired/cross-account confirmations, stale impact, rollback, unused and populated program deletion, isolation, preserved rename identities/history, file boundaries, shared files and cleanup retry. Production build and translation audit pass.

Code changes, old-code resolution, unchanged saved versions, the cascade, FK behavior, unrelated-program isolation and the file outbox were also exercised against local MySQL using synthetic records inside an outer transaction that was fully rolled back. Browser screenshot and click-through verification remains manual because a browser surface was unavailable.

## Interaction motion

Catalog motion uses 320 ms eased panel entry, dialog resizing, inline-form expansion and keyed table-row movement. Closing dialogs move and fade with their backdrop over 220 ms. Inline forms collapse their height, spacing and borders over 260 ms so following content moves continuously. Surviving table rows move from their previous relative positions; only new/changed rows fade, avoiding a flash across the entire table. Table height animates alongside row movement. Buttons use matching hover and press feedback.

The same timing/easing coordinates loading-to-impact and final-confirmation changes. Stable scrollbar space prevents dialog text reflow, and confirmation focus is scrolled into view after size motion settles. Save/delete requests remain independent of decorative motion; exit controls become inert and duplicate dismissal is ignored. Unmount cancels running animation.

Reduced-motion preferences skip/cancel Web Animations and disable CSS motion. Missing animation support completes the action immediately. Motion preserves React row identities and stored data. Filters and the add-subject program field continue to follow the stable program ID after a code rename. Browser visual verification remains manual.
