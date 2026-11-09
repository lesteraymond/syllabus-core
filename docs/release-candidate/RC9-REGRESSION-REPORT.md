# RC9 report: explicit Program Outcome review and adoption

Date 2026-11-06. Offline only: isolated synthetic databases, scripted provider, no paid requests. The real backup, service shutdown, packet change and migration were not run. `syllabus_cms_plus` was only read. Nothing was committed, pushed or deployed. RC8 remains frozen at `tmp/release-candidate/rc8`.

**Verdict: RC9 passes every offline suite on one frozen source and closes the implicit-adoption gap. It is ready for a separately authorized development activation. Nothing has been activated.**

Tested source: `b11c15c8713e44f4065ad28c8e4a6d288c5fb97ad51a46f5cddf2fe48cf1ceba` (806 source files).

| Status | State |
|---|---|
| Offline implementation | **Verified** on RC9 |
| Development database activation | **Not done:** migration not applied, packet size still 1 MB |
| Staging readiness | **Not ready:** not assessed in this work |
| Production readiness | **Not ready:** not claimed |
| Real Claude verification | **Not done:** all model responses came from the scripted provider |

## 1. Root cause

Adoption was a side effect of two "keep it equal to the catalog" behaviors:

* `forceStandards` replaced a syllabus's POs on every faculty save, whichever section was sent.
* The builder applied the subject's standards to the draft on open, and that change autosaved.

## 2. Corrected mechanism

* **Save.** While a mapped syllabus's POs differ from its subject's, a faculty save keeps the stored statements and reference. They are read from the database under the save's row lock, never from the request. Vision, Mission and EGAs follow the subject as before.
* **Open.** The builder no longer applies POs to a mapped draft. Drafts with no mappings fill in as before.
* **Subject change.** Choosing a different subject takes that subject's POs; the guard applies only to the same subject.
* **Adopt.** `POST /syllabi/:id/po-review/adopt` requires the owner, `confirm: true`, and the hash of the reviewed statements. It runs in one locked transaction, takes the statements from the server, and leaves CLO mappings and the plan alone. It is refused if the statements changed since review, if nothing is pending, or if a mapped PO was removed.
* **Review.** `GET /syllabi/:id/po-review` returns affected POs, both statements, mapped CLOs and versions. Reading it changes nothing.
* **Inheritance.** A specialization still follows its source program automatically; its mapped syllabus goes through the same review.

Every path that writes syllabus content was inventoried: the section save and submit go through the guard, and the administrator preparation path has no faculty standards force. PDF import reaches the database only through the guarded save.

## 3. Results

| Suite | Result |
|---|---|
| E01-E25, optimizations off | 25 / 25 |
| E01-E25, optimizations on | 25 / 25 |
| K01-K10, two runs | 10 / 10 both |
| B01 | 1 / 1 |
| Four-program PO workflow, off and on | 4 / 4 both |
| Integration | 24 / 24 |
| Migration rehearsal | passed |
| `npm test` | 2,177 passed, 0 failed |
| `npm run test:vpaa` | 294 passed, 0 failed |
| PO panel and review UI tests | 5 / 5 |
| Build and localization | passed; 2,597 bilingual keys |
| Read-only dry run on `syllabus_cms_plus` | COMPATIBLE, zero writes |

**One event to disclose:** the first `npm test` in the chain reported 633 passed, 127 failed. It ran as Claude Code killed the chain's background wrapper for low memory, and whole files failed within milliseconds. A clean rerun on the same hash passed 2,177 with 0 failures, and that is the result reported. The cause is inferred from the timing and the pattern, not proven.

Testing found a real bug in the first RC9 draft: on a partial save the stored and saved outcomes are the same object, so the guard compared them to themselves and did nothing. The earlier unit test missed it and the integration test caught it. It is fixed, with a unit test added.

## 4. Requirement coverage

| # | Requirement | Evidence |
|---|---|---|
| 1 | Open without adopting | Browser E25; unit |
| 2 | References save keeps POs | Integration; E25 through the API from the browser session |
| 3 | Autosave of unrelated fields | Browser E25 (real Step 1 edit); integration for plan, description, meta |
| 4 | Explicit adoption | Browser E25; integration |
| 5 | Authorization | Integration: other faculty 404, administrator refused, faculty 403 on Admin routes |
| 6-7 | Stale and concurrent attempts | Integration: an Admin update after review opened is refused and shown again |
| 8 | CLO mappings preserved | Browser E25; integration |
| 9 | Re-evaluation after adoption | Integration: every CLO-PO relationship asked again, none reused; E25: next check on the new version |
| 10 | Report immutability | Integration: byte-identical |
| 11 | Cyber Security inheritance | Integration (synthetic specialization); PO workflow in browser for the real program code |
| 12 | English and Tagalog | Rendered component test, localization audit |
| 13 | Scoring, pass mark, gates | Rule, scoring and checker files byte-identical to RC8; K08 parity; submission refused while pending |
| 14 | Integrity and rollback | No schema change; migration file identical to RC8; rehearsal passed |

## 5. Not verified in a real browser

* The Tagalog review screen (rendered in a component test only).
* A specialization's review flow (API only).
* The "statements changed after review" message, and the removed-PO block on screen (API and component test only).
* The phone-width layout of the review table.
* References through its own form: E25 sent that section through the API.
* PDF import during a pending review (no dedicated test; by code reading it goes through the guarded save).

## 6. Compatibility with RC8

`rules.js`, `service.js`, `academicPolicyV2.js`, `academicV2Plan.js`, `gemini.js`, `costPlan.js`, `engine.js`, `repository.js`, `programs.js`, `programPoReferences.js` and the migration are byte-identical to RC8. There is no schema change. BSIT 9, BSIE 13, BSCpE 13 and BSIT-Cyber Security 9 from BSIT each score 99 against threshold 79, off and on.

**Files changed from RC8:** `server/lib/syllabusOutcomes.js`, `server/routes/syllabusContent.js`, `src/lib/syllabusModel.js`, `src/lib/api.js`, `src/views/builder2/index.jsx`, `src/views/builder2/ClosStep.jsx`, `src/views/builder2/PoReviewNotice.jsx` (new), `src/views/ComplianceCard.jsx`, `src/i18n/hybrid.js`, `src/i18n/poReference.js`, `src/styles.css`, `scripts/po-reference-publication/check.cjs`. Tests: `scripts/e2e/scenarios.cjs` (E25), `scripts/release/dynamic-reference.integration.test.cjs`, `server/lib/syllabuscheck/reference-resolution.test.js`, `src/lib/syllabusModel.test.js`, `src/lib/poReferenceView.test.js`, `tests/po-reference-panel.test.jsx`.

## 7. Remaining risks

* A change only to a PO's short name or EGA mapping, with the same statement, is not a statement change, so it still follows the subject without review.
* While a review is pending the author cannot complete a check, by design. An author who never adopts stays blocked, and nothing tells the Admin which syllabi are waiting.
* Apply to Subjects can skip a subject when a catalog CLO uses a removed PO; it reports this and does not force it.
* The largest saved development report is at 87% of the 1 MB limit.
* The new adopt path has been exercised only on synthetic data.

## 8. Rollback

Code only; no database step exists, because RC9 has no schema change.

1. Stop the application.
2. Copy the 16 changed source and test files listed above from `tmp/release-candidate/rc8/` over the working tree, excluding `scripts/release/dynamic-reference.integration.test.cjs`, which snapshots do not hold.
3. Delete `src/views/builder2/PoReviewNotice.jsx`.
4. Confirm `node scripts/release/snapshot.cjs verify rc8` reports `5edd97a3…`.

Syllabi adopted under RC9 stay valid under RC8: they hold ordinary outcomes. After rollback the implicit-adoption gap returns.

## 9. Recommendation

RC9 is ready for a separately authorized development activation, following `DEVELOPMENT-ACTIVATION-PLAN.md` sections 8 to 10 on source hash `b11c15c8…`. It is not a statement of staging or production readiness.
