# Conversation: "Upload a syllabus file" button missing in the Syllabus Builder

## User
The "Upload a syllbus file" button in syllabus builder disappeared.

## Claude
Searched `src` for the button text and found the tab in `src/views/builder2/index.jsx:223`:

```jsx
{!isAdmin && <button type="button" role="tab" aria-selected={mode === 'upload'} ...>Upload a file instead</button>}
```

- `isAdmin` is `user?.role === 'admin'`, so the tab is hidden on purpose when signed in as an admin.
- The condition came in with commit `4e65dda` ("improve settings, catalog and admin syllabus workflows"), not from the uncommitted student-view work. No builder files have uncommitted changes.

Possible causes:
- Testing as admin: existing behavior. Sign in as faculty to see the tab.
- Faculty and still missing: something else hides it (`user.role` not `'faculty'`, or a CSS rule). Needs the account used.
- If admins should be able to upload: remove the `!isAdmin` check, after confirming it makes sense for the admin flow.

## User
But admin can upload a syllabus file too?

## Claude
Not in the current code. The server rejects it. In `server/routes/syllabi.js` (~line 236), the file-upload (edit) path refuses admins:

```js
// Administrator-authored records publish only through the checked form transaction.
if (rules.isAdmin(me) && rules.isOwner(me,syl)) throw httpError(409, 'Use the syllabus builder and AI Checker to publish your own syllabus.');
```

Admins publish only through form → AI Checker (`prepareCheck` → `setPage('ai')`). Commit `4e65dda` added `!isAdmin &&` so the UI matches the rule. Before it, the tab always showed and clicking it as admin would have returned the 409.

Allowing admin uploads would need:
1. Removing `!isAdmin &&` at `src/views/builder2/index.jsx:223`.
2. Changing the server rule to accept an admin's own upload.
3. Deciding what happens next, since an uploaded file can't go through the form-based AI check (the file-vs-template AI check "is not switched on yet").

## User
later.

## Claude
Understood. Nothing was changed: the tab stays hidden for admins and visible for faculty.

## User
i mean, for you? whats the correct?

## Claude
Keep it hidden for admins, as it is now.

- **The check is the point of admin publishing.** The admin path is form → AI Checker → publish. A PDF can't go through that check yet, so an upload would let admins publish with no check.
- **The server and UI already agree.** The server rejects admin uploads of their own syllabi, and the tab is hidden to match.
- **Admins have another route.** They can fill in the form, or assign the subject to a faculty member who uploads the PDF.

Revisit once the AI service can check uploaded files; then uploads could go through the same check before publishing.

If you were signed in as admin when you noticed the tab was gone, that explains it. Nothing is broken.
