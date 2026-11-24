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
faculty submits  ->  dean clears          (the dean's turn)
                 ->  Asst. VPAA clears    (then the Asst. VPAA's turn)
                 ->  LIC Director clears  (then the LIC Director's turn)
                 ->  VPAA approves        ->  Repository
```

Since 2026-11-24 the stages are cleared **in order**, one after another (they were cleared in any order before).

- **Whose turn it is.** The syllabus is with the first stage not yet cleared on its newest version, or with the VPAA once all three are (`reviewStages.turnOf`). Only that reviewer can clear their stage or return the syllabus for revision; anyone else gets `409 stage_out_of_order` with a message naming who has it now. The other reviewers can open and read it while they wait.
- **Notifications follow the turn.** The dean is notified when the syllabus is submitted, the Asst. VPAA when the dean clears it, the LIC Director when the Asst. VPAA clears it, and the VPAA when the third stage clears. A reviewer account created later is notified of the pending syllabi already on its turn.
- **Returning for revision.** A reviewer who finds a problem returns the syllabus (with a reason of at least 5 characters). When the faculty member resubmits, the new version **goes back to the reviewer who returned it**: the stages cleared before that reviewer are copied onto the new version with their reviewer, note and date (`reviewStages.carryForward`). For example, if the LIC Director returns it, the dean and the Asst. VPAA stay cleared; if the VPAA returns or rejects it, all three stay cleared and it goes back to the VPAA; if the dean returns it, nothing is kept. A new version saved while the syllabus is under review (not returned) still starts the chain again.
- Only the VPAA can approve or reject. A plain request by anyone else gets `403`.
- The VPAA can approve only when all three stages are cleared on the **newest version** (otherwise `409 STAGES_PENDING`). The existing alignment and curriculum gates still apply. A finished AI check is needed first only when the AI gate is `required` (`SYLLABUS_CHECK_AI_GATE`); under `advisory` (the default) it is advice.
- A dean who writes a syllabus does not approve it: **Send for review** records the dean's stage as cleared by authoring, and the Asst. VPAA, the LIC Director and then the VPAA take it from there. Once sent it cannot be pulled back, and a returned dean syllabus cannot be sent again without changes.
- Nobody clears a stage on their own syllabus. Clearing a stage that is already cleared changes nothing and is not logged again.
- **What a reviewer can open.** The lists hide a syllabus from the VPAA until the three stages clear, and the dean's own syllabus from the other reviewers until it is sent. The routes that open one syllabus (its form, comments, AI check and stages) give the same answer (`reviewStages.assertReviewerMayOpen`). `GET /:id/versions` and `GET /:id/file` do not call it yet (pre-deploy report 2026-11-24, M4).
- **Messages.** Only the syllabus owner and the dean can message about a syllabus; the other reviewers do not see the Messages tab.
- **AI checks are per person.** Each reviewer (and each author) sees only the AI checks they ran themselves, never another reviewer's (2026-11-24).
- **Past academic years.** A syllabus of an academic year that is no longer active is view only, for everyone (`409 past_academic_year`).
- The **review progress** strip (`src/components/ReviewProgress.jsx`) shows the dean, the Asst. VPAA, the LIC Director and the VPAA in order, each as cleared, reviewing now, returned, rejected, approved or waiting.
- The printed form's sign-off block ("Prepared by", "Checked and Reviewed by", "Approved by") shows each name with the date of that step: submitted, each stage cleared, approved. Until a step happens the line reads "Date" and the name is a blank signature line.

## Where it lives

- `server/lib/roles.js` (mirrored by `src/lib/roles.js`): which roles review, which approves, which stage a role clears.
- `server/lib/reviewStages.js` and table `syllabus_review_stages`: one row per (syllabus, version, stage) when that stage is cleared. `syllabi.status` is unchanged (`submitted`, `under_review`, `approved`, `for_revision`, `rejected`, `draft`); "ready for the VPAA" is derived. The same file holds the order of the chain (`turnOf`, `assertTurn`), the carry-forward after a return (`returnedBy`, `keptStages`, `carryForward`), the turn notifications (`notifyTurn`, `notifyNewReviewer`) and the open check (`assertReviewerMayOpen`).
- `server/routes/reviewChain.js`: `POST /api/syllabi/:id/stage-clear` and `GET /api/syllabi/:id/stages`. The stages response carries `stages` (with `turn`), `status`, `decision` (the last approve, reject or return), `approved` and `submitted`.
- `server/routes/syllabi.js`: the status `PUT` decides who may set which status, refuses a return out of turn, and enforces the chain before `approved`. The syllabus list carries `stages`, `turn`, `myTurn`, `myStageCleared` and `readyForApproval` for reviewers, and `reviewProgress` for the owner.
- `server/routes/syllabusContent.js`: submit and resubmit (carries the kept stages forward and notifies whoever has the syllabus now).
- Client: `src/views/ReviewApproval.jsx` (each role's queue: what is on their turn first), `src/views/ReviewPanel.jsx` (the buttons the role has), `src/components/ReviewProgress.jsx`, `src/lib/reviewView.js` (`isMyTurn`, `canReturnNow`, `canClearStage`, `progressSteps`).

## Upgrading an existing database

```bash
cd server
npm run migrate-review-stages -- --dry-run   # shows what it would do
npm run migrate-review-stages
```

The script adds the three roles to `users.role` and creates `syllabus_review_stages`. It is safe to run again. Until it has been run nothing can be approved (the API answers `503`: the review chain is not set up), because approval needs the chain.

Syllabi that were already **approved** stay approved. Syllabi that are still `submitted` or `under_review` have no stage rows yet, so the dean, the Asst. VPAA and the LIC Director clear them again before the VPAA can approve.
