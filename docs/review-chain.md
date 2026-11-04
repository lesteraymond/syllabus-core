# The review chain: who checks a syllabus, and who approves it

Until now the administrator both reviewed and approved a syllabus. Approval now belongs to the **VPAA** alone, after three reviewers have each checked the syllabus.

## Roles

| Role (`users.role`) | Title | What it does |
|---|---|---|
| `faculty` | Faculty | Writes a syllabus and submits it |
| `admin` | Dean / Academics Administrator | Checks and reviews (stage **dean**); also manages users, the catalog, deadlines and settings |
| `asst_vpaa` | Asst. Vice President for Academic Affairs | Checks and reviews (stage **asst_vpaa**) |
| `lic_director` | LIC Director | Checks and reviews (stage **lic_director**), with a view on references and citations |
| `vpaa` | Vice President for Academic Affairs | Reviews the result and is the **only** role that approves or rejects |

The dean, the Asst. VPAA and the LIC Director are global (they see every submitted syllabus, never a draft). Create the accounts in **Users & Roles**; the new person gets a generated password by email and must change it at first sign-in, like any account.

## The flow

```
faculty submits  ->  AI check (any reviewer, in the AI Checker)
                 ->  dean, Asst. VPAA and LIC Director each clear their check   (any order, in parallel)
                 ->  VPAA reviews and approves                                  ->  Repository
```

- A reviewer who finds a problem **returns the syllabus for revision** (with a reason, at least 5 characters). The faculty member edits and resubmits; the new version starts the three checks again.
- Only the VPAA can approve or reject. A plain request by anyone else gets `403`.
- The VPAA can approve only when all three stages are cleared on the **newest version** (otherwise `409 STAGES_PENDING`) and the AI check has been made (`409` as before). The existing alignment and curriculum gates still apply.
- A dean who writes a syllabus does not approve it: **Send for review** records the dean's stage as cleared by authoring, and the Asst. VPAA, the LIC Director and then the VPAA take it from there.
- Nobody clears a stage on their own syllabus.
- The printed form's sign-off block ("Checked and Reviewed by", "Approved by") shows the names and dates of the reviewers and of the VPAA.

## Where it lives

- `server/lib/roles.js` (mirrored by `src/lib/roles.js`): which roles review, which approves, which stage a role clears.
- `server/lib/reviewStages.js` and table `syllabus_review_stages`: one row per (syllabus, version, stage) when that stage is cleared. `syllabi.status` is unchanged (`submitted`, `under_review`, `approved`, `for_revision`, `rejected`, `draft`); "ready for the VPAA" is derived.
- `server/routes/reviewChain.js`: `POST /api/syllabi/:id/stage-clear` and `GET /api/syllabi/:id/stages`.
- `server/routes/syllabi.js`: the status `PUT` decides who may set which status and enforces the chain before `approved`. The syllabus list carries `stages`, `myStageCleared` and `readyForApproval` for reviewers, and `reviewProgress` for the owner.
- Client: `src/views/ReviewApproval.jsx` (each role's queue), `src/views/ReviewPanel.jsx` (stage strip and the buttons the role has), `src/lib/reviewView.js`.

## Upgrading an existing database

```bash
cd server
npm run migrate-review-stages -- --dry-run   # shows what it would do
npm run migrate-review-stages
```

The script adds the three roles to `users.role` and creates `syllabus_review_stages`. It is safe to run again. Until it has been run nothing can be approved (the API answers `503`: the review chain is not set up), because approval needs the chain.

Syllabi that were already **approved** stay approved. Syllabi that are still `submitted` or `under_review` have no stage rows yet, so the dean, the Asst. VPAA and the LIC Director clear them again before the VPAA can approve.
