# RC8 offline regression report

Date 2026-11-06. Offline only: isolated synthetic databases, scripted provider, no paid requests. Nothing was committed, pushed, deployed or migrated, and no real reference was published.

**Verdict: every offline suite passes on one frozen source. RC8 is ready for controlled development activation, subject to the written authorization and backup steps in section 7. Nothing has been activated.**

Tested source: `5edd97a3468a64642ad322830a9bf3925cfc5de39c82e96b9a9379013e1859b2` (805 source files). The live tree equalled the snapshot before and after the run.

| Status | State |
|---|---|
| Offline implementation | **Verified** on RC8 |
| Development database activation | **Not done.** Migration not applied; packet size still 1 MB |
| Staging readiness | **Not ready.** Not assessed in this work; earlier prerequisites remain open |
| Production readiness | **Not ready.** Not claimed |
| Real Claude verification | **Not done.** Every model response here came from the scripted provider |

## 1. Results

| Suite | Result | Evidence |
|---|---|---|
| E01-E24, optimizations off | 24 / 24 | `rc8-e-off.log` |
| E01-E24, recommended optimizations on | 24 / 24 | `rc8-e-on.log` |
| K01-K10, first run | 10 / 10 | `rc8-k-run1.log` |
| K01-K10, second run | 10 / 10 | `rc8-k-run2.log` |
| B01 | 1 / 1 | `rc8-b01.log` |
| Four-program PO workflow, off | 4 / 4 | `rc8-po-baseline.log` |
| Four-program PO workflow, on | 4 / 4 | `rc8-po-optimized.log` |
| Dynamic-reference integration, including Apply to Subjects | 22 / 22 | `rc8-integration.log` |
| Migration rehearsal | passed | `po-publication-rehearsal.json` |
| `npm test` | 2,175 passed, 0 failed | |
| `npm run test:vpaa` | 294 passed, 0 failed | |
| PO reference panel UI tests | 4 / 4 | |
| Build, localization audit | passed; 2,577 bilingual keys | |

No browser suite recorded a failed check.

## 2. Fixes

**E23.** `inheritStandards` (`server/lib/programs.js`) replaced a subject's POs with the active version on every read. That suited the few programs with a source version, but after the Admin policy every program has a version, so saved POs reached existing subjects without Apply to Subjects.

The fix: once an Admin-saved version is in force, a subject whose copy differs from it stays on its own version (`withAssignedVersion` in `server/lib/programPoReferences.js`). A subject stores statements, not a version id, so the version is found by matching them. A copy matching no version belongs to a program with a source version only if it was already being read through that source version, so it stays there; otherwise the subject keeps exactly what it stores. Source-version programs and specializations keep the overlay.

**K08.** `scripts/e2e/scenarios-comprehensive.cjs` now retries only HTTP 429, at most 4 times, waiting what `Retry-After` says (capped at 60 s, 15 s if absent). Other failures are not retried. A 429 that outlasts the retries fails the scenario. Each retry and final status is recorded as evidence. The application's limiter is unchanged. In the last run K08 recorded one 429 with `Retry-After 3 s`, one retry, then HTTP 200 from all three servers.

## 3. Apply to Subjects (integration test)

After an Admin updates a PO: the new program version is in force; the existing subject still shows its previous statements and names its previous version; the stored copy and catalog CLO tags are unchanged; a faculty save keeps the subject's version; a new subject starts on the new version. The check is refused with `po_reference_review_required`, and with the masters alone the CLO-PO relationships are held NOT_CHECKED (`authored_po_basis_review`). Faculty cannot run Apply. Apply updates the subject without rewriting a CLO mapping or reaching into the saved syllabus. The earlier report stays byte-identical. After the author saves, the check uses the new version, its report names it, every CLO-PO relationship is asked again, and an unchanged re-check reuses them.

## 4. Preserved behavior

`compliance/rules.js`, `compliance/service.js`, `academicPolicyV2.js`, `gemini.js`, `engine.js` and `costPlan.js` are byte-identical to RC7 and RC4h, so the deterministic rules, scoring, threshold 79, gates, VPAA relationships, CLO classifications and cost optimizations did not change.

Scoring parity: the PO workflow gives the same results off and on, BSIT 9 POs, BSIE 13, BSCpE 13, BSIT-Cyber Security 9 from BSIT, each score 99 against threshold 79. K08 passes profile on, profile off and V2-only parity in both runs, and older saved reports open.

New programs with 5, 4 and 3 POs were recognized with no program-specific checker code. No PO-to-EGA mapping was invented (P-03 stays NOT_CHECKED).

## 5. Limits of this evidence

* `scripts/release` is not copied into snapshots, so the integration test ran from the working tree. It is outside the source hash; the application code it exercises is inside it.
* The memory gate paused the chain once, before K01 (757 MB available), after E01-E24 had finished. It resumed from K01 on the same snapshot; nothing was interrupted. Claude Code later killed the background wrapper for low memory, but the script itself ran to completion.
* The single PO baseline timeout on RC7 did not recur, and its cause was never established.
* The new test proves the behavior through the API. The browser proof of the same rule is E23.

## 6. Behavior to confirm, and remaining UI defects

* **A specialization's subjects follow its source program at once.** A BSIT save reaches BSIT-Cyber Security subjects without Apply, because a specialization has no outcomes of its own and Apply is refused for it. This preserves inheritance as instructed.
* **After Apply, the author's next save takes the new statements while keeping the CLO numbers.** Claude then judges them against the new text. There is no separate per-mapping review step.
* No Curriculum Management screen (separate feature, after this release candidate).
* The panel's actions reload the dialog, which drops unsaved EGA and PO edits.
* Faculty are blocked at Step 1 when a subject has no pre-requisite, with a message they cannot act on.
* The empty-EGA Add Program state has not been tested in a browser.

## 7. Before development activation

1. Written authorization naming `syllabus_cms_plus`.
2. Backup and restore verification, per `DEVELOPMENT-ACTIVATION-PLAN.md`.
3. The migration, then `VERIFIED` from the check tool.
4. The packet-size decision (`DEV-DATABASE-PACKET-CONFIG.md`).

The source must stay at this hash, or be re-verified.
