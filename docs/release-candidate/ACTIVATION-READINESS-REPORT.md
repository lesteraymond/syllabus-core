# Dynamic academic reference: activation readiness

Date 2026-11-06. Everything here is **implemented in code and tested on isolated synthetic databases**. **Active in development: no. Staging: no. Production: no.** No migration ran on an existing database, no reference was published anywhere, no paid Claude call, no commit/push/deploy. The only thing run against the real development database is the **read-only dry run** (SELECT only, 0 writes).

## 1. Source stability

| Snapshot | Source hash | What it is |
|---|---|---|
| rc2 | `4d6aacec578613604e182d4f6e026fc5b3578ae4af035eb4d8b5b0a13a18aa68` (788 files) | earlier verified release candidate |
| **rc4h** | `0ce479957d16387e682f75e38c605c3d8cb5996eeb2ff6c3dfe571e99638a7eb` (801 files) | rc2 + only the dynamic-reference work below; hash re-checked unchanged at the end |
| **rc4** | `6af738131f9f59b708dacd175293751e0dbcb9d060db47500c22bfb1a347dd23` (805 files) | the complete current working tree at 03:40, including another session's unfinished Builder Step 1 change |

**The full working tree is not release-ready.** On rc4, scenarios E02 and K01 fail: `InfoStep.jsx:59` now renders `readOnly={lockTerm || lock.yearLevel}` and the faculty path locks the Year level field, while the scenarios still fill it (`scenarios.cjs:62`); everything downstream (E03-E11, K02-K06, E20, E23, E24) then fails only because no syllabus is created. The same scenarios pass on the tree before that edit. Owner: the session `separate-add-program-form` (it was told, with the file and line, and I edited none of its files). **Do not claim release readiness from rc4h alone**: it proves this work on the stable UI; a full-tree regression must be repeated after the other session finishes Step 1.

## 2. Admin publication UI status

API complete and tested; the panel `src/components/PoReferencePanel.jsx` (+ `poReferenceView.js`, `poReferenceApi.js`, `i18n/poReference.js`) is built and tested standalone but **not mounted**, because its mount point (`ProgramOutcomesEditor.jsx`) sits beside files the other session edits. The 5-line mount is in `ADMIN-PO-REFERENCE-UI.md`. Capabilities (all Admin-only, server-enforced): view published reference with source evidence, authorization, hash, applicable years and "institutional approval: not recorded"; start and edit a draft; compare draft/live/versions; publish with a required written authorization **and** source evidence and an explicit confirmation; history; reuse a version from another year; no edit control for a published version (the server also refuses in-place edits, 409 `po_reference_versioned`). An Admin publication is never a VPAA approval.

## 3. Academic-year PO version reuse

Implemented as **explicit association, not duplication**: `GET .../candidates` lists published versions of the same program code in other years; `POST .../adopt {referenceId, note, confirm}` points the new year's program row at the existing version (no new version row). The version keeps its owner year, hash, authorization, evidence and publisher; the association records who and why (audit row `adopted`); the version now lists every year it applies to. Safeguards tested: nothing is activated for a new year until an Admin selects; the live rows must equal the version's statements (else 409 `po_reference_adopt_mismatch`: publish a new version instead); same program code only; a past year is view-only; the new year's own later publication never supersedes the owner's version; the owner's next version does not move the other year; a specialization keeps inheriting BSIT through `program_outcome_sources`. `copy-catalog` is unchanged (it never activates a reference).

## 4. Vision, Mission and EGA versioning assessment

`INSTITUTIONAL-REFERENCE-VERSIONING-AUDIT.md`. Vision/Mission/institutional EGAs are one edited-in-place row with a counter (no history); program EGAs are per program row (per year) with a counter; the PO-to-EGA crosswalk is part of each PO and is now versioned with the PO reference. Saved reports embed the text judged and now record the institution version and an EGA source/hash. History is **not needed for correctness** and not a prerequisite for activation; it is needed only to re-verify old checks. The minimum design (one append-only history table written by the existing save transaction, hash recorded by `mastersFor`) is described, **not implemented**: four institutional decisions (who may edit, per-year or not, whether program EGAs need authorization, authoritative sources) are missing.

## 5. New-program AI Checker integration (scripted provider, isolated database)

`scripts/release/dynamic-reference.integration.test.cjs`, **18 / 18 on rc4h**, drives the real Admin and faculty API: Admin creates a program that is in no list, with its own EGAs and POs, a year, a curriculum and a published PO version; the faculty check: before publication V2 CLO-PO is NOT_CHECKED (`po_reference_unpublished`) and CUR-REF blocks a subject with no approved curriculum; after approval and publication the CLO-PO relationships are evaluated with the program's own PO text; `P-03` stays NOT_CHECKED for a PO with no EGA mapping; a 3-PO program works from its own database rows; a specialization inherits through data; the saved report names the real reference id, version, hash, kind, academic year, publisher, PO source program, EGA source/hash, institution version, curriculum id and hash and never `lcup-po-2026-10-29`; an unchanged re-check reuses its judgements, a new version asks only CLO-PO again; tampering with a published version is refused; optimization flags on/off give the identical official result. Policy V2 stays off in the ordinary runtime (only the isolated test processes enable it).

## 6. Existing four-program compatibility

SELECT-only against the real development database and the rc2/rc4h-era code: BSIT 9, BSIE 13, BSCpE 13, Cyber Security 9 inherited from BSIT with BSIT's curriculum; baseline and optimized runs identical (51 requests, official 85, threshold 79, 0 NOT_CHECKED among the seven VPAA types, 4 CLO classifications, CLO-PO evaluated); the old-schema rehearsal reproduces the same resolution and the same `lcup-po-2026-10-29` official-source reading. Eight historical reviews (seven PO-mapping reviews, one curriculum review) present and unchanged in every check.

## 7. Official scoring parity

Threshold 79, six areas, status, score identical with the recommended optimization flags on and off for a new program (integration test 20) and for the four programs (`po-parity-dynamic.json`). No rule, weight, VPAA relationship, CLO classification or gate was changed.

## 8. Final browser regression results

| Suite | On rc4h (this work) | Status |
|---|---|---|
| `npm test` | **2,171 / 2,171** (2066 + 22 + 49 + 16 + 18), 0 failed | complete |
| `npm run test:vpaa` | 276 / 276 + UI 18 / 18 | complete |
| `npm run build` | passes | complete |
| Panel rendering EN/TL | 5 / 5; helper unit tests 5 / 5; localization audit passes (2,579 bilingual keys, no hardcoded strings) | complete |
| New-program dynamic-reference integration | 18 / 18 | complete |
| Browser B01 ($6 tight budget, recommended flags) | **1 / 1** | complete |
| Browser K01-K10 (recommended flags on) | **10 / 10** (K01-K10, run as one suite so K08-K10 had their K01-K07 setup) | complete |
| Four-program PO browser workflow, optimizations OFF | **4 / 4** (BSIT 9 POs, BSIE 13, BSCpE 13, BSIT-Cyber Security 9 from BSIT; browser score 99, threshold 79) | complete |
| Four-program PO browser workflow, optimizations ON | **4 / 4** (same programs, counts and sources) | complete |
| Browser E01-E24, optimizations OFF | **24 / 24**, 0 failed checks | complete |
| Browser E01-E24, recommended optimizations ON | **24 / 24**, 0 failed checks | complete |

All of the above ran on the frozen **rc4h**, source hash `0ce479957d16387e682f75e38c605c3d8cb5996eeb2ff6c3dfe571e99638a7eb` (801 files), re-verified unchanged before the resumed runs and again after the last one (08:22 UTC). Each ran on a freshly bootstrapped isolated synthetic database (all `migrate-*` scripts including the new one), scripted provider, ports 43310 (database) and the harness's own ports, one suite at a time, with the database and stacks left running until each chain printed its completion line. No existing database was touched; the development database was only read earlier by the dry run.

**Genuine application failures: none.** **Infrastructure/process events, all now closed:**
1. Earlier invalid results (K08-K10, the first PO attempt, the first regressions): caused by me stopping the isolated database while the chain was still running; files renamed `*.INVALID-database-removed-by-assistant`.
2. First resumed PO attempt: the PO harness asserts that the isolated server's datadir is `<snapshot>/tmp/po-checker-integration/db/data`; my server used another directory, so the harness refused to start (exit 2, no test ran). Not an application failure; fixed by starting the isolated server on exactly that datadir.
3. The memory reaper stopped the tracked shell wrapper once; the scripts themselves kept running and no suite was killed.

**Full working tree (rc4, `6af73813…`) is still not release-ready**: E02 and K01 fail at the Year level field because of the other session's Step 1 `lockTerm` change (see section 1). That session has been idle since I reported it and **no source file has changed since the rc4 freeze** (verified: the live tree equals rc4), so there was nothing to reconcile. The full-tree regression has to be repeated once that session finishes Step 1.

## 9. Exact modified files (this task and the previous one; all uncommitted)

New: `server/lib/programPoReferences.js` rewrite (modified tracked file), `server/routes/programPoReference.js`, `server/db/migrate-po-reference-publication.js`, `server/lib/syllabuscheck/reference-resolution.test.js`, `src/components/PoReferencePanel.jsx`, `src/lib/{poReferenceView.js, poReferenceView.test.js, poReferenceApi.js}`, `src/i18n/poReference.js`, `tests/po-reference-panel.test.jsx`, `scripts/test-po-reference-ui.mjs`, `scripts/po-reference-publication/{check,rollback,rehearsal}.cjs`, `scripts/release/{dynamic-reference.integration.test.cjs, dynamic-reference-audit.cjs, run-suite-fresh.cjs, snapshot.cjs, source-compare.cjs, run-suite.cjs}`, `docs/release-candidate/*`.
Modified (small, mine): `server/lib/syllabuscheck/{academicV2Plan,repository,gemini}.js`, `server/index.js` (one mount line), `server/package.json` (one script), `src/i18n/{academicV2,index}.js`, `package.json` (two lines), `server/routes/enforcement.routes.test.js` (one allowlist entry). **Not touched:** every file of the other session (`InfoStep.jsx`, `CourseOutcomes.jsx`, `AddProgramForm.jsx`, `ProgramOutcomesEditor.jsx`, `scenarios.cjs`, `i18n/extra.js`, `styles.css`, ...).

## 10. Database migration readiness

`server/db/migrate-po-reference-publication.js`: additive, idempotent, never changes a row. **Rehearsal on a synthetic old-schema database: 14 / 14 steps pass** (`po-publication-rehearsal.json`: snapshot, dry run with zero writes, apply, VERIFIED, existing versions still read as official sources, idempotent re-apply, rollback refuses without confirmation, rollback removes only the added structure and restores the snapshot, rollback refuses once a publication exists). **Read-only dry run against `syllabus_cms_plus` (localhost:3306): COMPATIBLE** (InnoDB, INT keys, `academic_year` present, 3 existing version rows get safe defaults); finding: that server's **`max_allowed_packet` is 1 MB** (needs 16 MB for large reports; independent of this migration and its owner's decision). The full plan, backup/restore verification, post-migration verification, Admin publication check on a throwaway synthetic program and rollback are in `DEVELOPMENT-ACTIVATION-PLAN.md`. **Not executed.**

## 11. Remaining approvals and decisions

Written authorization to apply the migration to the named development database (the plan is not that authorization); formal VPAA approval of any published reference (the system records `not_recorded`); approved PO-EGA crosswalks (P-03 stays NOT_CHECKED without them); the seven PO-mapping reviews and the curriculum review by faculty; the Vision/Mission/EGA policy decisions of section 4; a decision on `max_allowed_packet` for the shared development server; mounting the Admin panel after the other session finishes; a full-tree browser regression after its Step 1 change is final; any staging or production activation (neither exists).

## 12. Development activation recommendation

**rc4h is ready for development activation PREPARATION** (not activation): every offline suite on the frozen rc4h passes, including the complete browser set, the integration test and the migration rehearsal, and the read-only dry run against the development database is COMPATIBLE. **It is not ready to activate**, and the full current tree is not release-ready. Remaining, in order: (1) the other session finishes Builder Step 1 and updates its scenarios, then freeze the full tree and repeat the full regression (E01-E24 off/on, K01-K10, B01, the PO workflow); (2) written authorization naming `syllabus_cms_plus`; (3) raise that server's `max_allowed_packet` to 16 MB (its owner's decision); (4) follow `DEVELOPMENT-ACTIVATION-PLAN.md` (backup, restore verification, migration, VERIFIED, synthetic-program publication check). The code is safe to deploy before the migration (it behaves as today until the tables are migrated). The new PO publication mechanism is **not activated**. Not staging-ready, not production-ready, no real-Claude verification.
