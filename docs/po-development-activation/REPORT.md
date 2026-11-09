# Corrected PO development activation

**ACTIVE IN DEVELOPMENT ONLY**, applied 2026-11-05T11:09:11.043Z. Target: **localhost:3306 / syllabus_cms_plus**, server JpDelRosario, XAMPP datadir C:\xampp\mysql\data\. Identity and reference-before hashes match the reviewed dry run. No staging/production connection, environment modification, paid AI request, commit, push or deployment was performed. Formal VPAA approval remains **not_recorded**; this activation is for development testing.

## Safety and backup

The complete logical SQL backup includes every table, schema, routines, triggers and events: **34,824,707 bytes**, SHA-256 `9809ce02a8b1076d8e087d03bb59fb0b7b563a3059ecc748109cce4ff69bb46d`. Private location: `C:\Users\JPDELR~1\AppData\Local\Temp\lcup-dev-po-activation-x7VyTW\development-full-before.sql`. Keep this backup and its private context/authorization files outside version control and retain them through review. [Backup manifest](backup-created.json), [restore verification](backup-restored.json), [recovery locations](recovery-locations.json).

The dump was restored on a separate loopback MariaDB server at port 43309 with events OFF. All **48 tables / 8,311 rows** and exact data/schema hashes matched; there were zero routines, triggers or events. The first isolated helper process ended before verification; it was restarted and a fresh complete restore passed before any development mutation. The same prepared migration was then rehearsed and rolled back on that restored copy; both directions passed. [Rehearsal](rehearsal.json). The SQL dump and restored personal data were never printed or added to documentation. Only owned isolated servers were stopped afterward.

## Database changes

[Dry run](dry-run.json) and [authorization/application receipt](activation-receipt.json) bind the change to program IDs **1,15,16,17** and version **lcup-po-2026-10-29**. The existing migration created five additive support tables, then used its serializable DML transaction.

| Program | Before physical POs | After physical POs | Resolved POs | Canonical source |
|---|---:|---:|---:|---|
| BSIT | 10 | 9 | 9 | BSIT |
| BSIT-CYBERSECURITY | 10 | 0 | 9 | BSIT |
| BSIE | 13 | 13 | 13 | BSIE |
| BSCPE | 13 | 13 | 13 | BSCPE |

Only three distinct canonical masters are active. Target PO rows changed from **46 to 35**; Cyber has no competing independent master. Untargeted PO rows remain unchanged. Program pos_version increments: BSIT 1→2, BSIE/BSCPE/Cyber 2→3. Exactly one Cyber→BSIT source link, three immutable version rows, three active assignments, one migration audit, and eight needs_review sidecars were added. No faculty mappings were rewritten.

Cyber retains program identity ID17 and inherits source ID1. Checker curriculum source is BSIT, approved reference ID1; the historical Cyber curriculum row remains untouched. Source hashes, exact numbering, ordering, short labels and statement text match the three designated source PDFs/canonical reference. Source-document verification is separate from institutional approval.

## Preservation and review

All **46 other original tables** have identical full data and schema hashes, while the programs/program_outcomes schemas are unchanged. Protected checks cover 15 syllabi, 18 historical versions, 202 saved checker reports, 293 AI runs, 820 saved recommendation decisions, courses, curriculum references, institutional settings and EGAs. Untargeted program/configuration hashes match. [Final verification](post-migration.json).

Seven PO mapping reviews remain visible for syllabus IDs **43,93,97,99,100,101,102**; curriculum-only review remains for **110**. Every sidecar is needs_review with null proposed mappings. The existing checking path returns po_mapping_remediation_required or curriculum_reference_review_required. Syllabus99's original obsolete PO10 mapping remains unchanged and is never renumbered. Faculty must review meanings and reference adoption explicitly; copying new PO text does not resolve a review. Original saved status, authored content, historical reports and approval history remain intact.

## Integration and scoring

Read-only development program APIs and the existing Builder model return exact corrected references for all four selections. A local component browser uses those read-only reference outputs with synthetic content and verifies PO text/counts, mapping checkbox counts, source labels, faculty/admin presentation and English/Filipino. This is not a deployed full-stack user-login certification. [Browser results](browser-results.json), [screenshot](browser-reference-review.png).

The shared checker receives the same canonical PO statements in deterministic T-12/P-01/P-02, PO-EXACT/CLO-MAP and scripted CLO–PO/CLO-anyPO prompts. Policy V2 and comprehensive checks cover all seven VPAA relationship types for each selection. Reports retain source/version/authorization context through serialization; actual report persistence was tested only on the isolated synthetic DB. No new checking report was written to development. Provider-disabled tests verify zero relationships as completed. [Integration results](integration-results.json).

The official standard retains 47 registered / 44 direct Hybrid-2 rules, six weights **20/20/20/15/10/15**, threshold **79**, existing deductions and submission/approval policies. All four synthetic reference tests score 100 in legacy and comprehensive paths with identical deductions. Existing regression tests cover security, permissions, approval flow and recommendation actions. [Scoring parity](scoring-parity.json). Scripted judgments establish software behavior and reference selection, never real Claude accuracy.

**Policy V2 runtime remains unset/default OFF; the comprehensive runtime profile remains unset.** Both were enabled only in explicit offline test environments. This PO activation does not authorize paid/background AI or alter those runtime flags. [Activation status](activation-status.json).

## Tests after activation

| Suite | Passed | Failed | Skipped | Todo |
|---|---:|---:|---:|---:|
| regression | 2144 | 0 | 0 | 0 |
| vpaa | 294 | 0 | 0 | 0 |
| isolatedMigration | 10 | 0 | 0 | 0 |
| developmentIntegration | 6 | 0 | 0 | 0 |
| sourceReferences | 4 | 0 | 0 | 0 |
| browser | 4 | 0 | 0 | 0 |

All final suites have zero cancelled tests. npm run build passed with the existing non-fatal bundle-size warning. Suite counts overlap. An initial local HTTP test failed because the synthetic account fixture was not registered; that fixture was corrected and the final six integration tests pass. Actual database preservation checks passed throughout, so no development rollback was required. [Exact counts/log locations](test-results.json).

## Institutional decisions still required

Formal VPAA approval/effective reference version is not recorded. Vision, Mission and EGAs were not replaced; their separate authoritative-source/approval review remains open. No PO–EGA crosswalk was inferred from the corrected statements; P-03 remains unverified where approved crosswalk data is unavailable. Historical curriculum adoption and seven PO mapping reviews require faculty/institutional review. Neither staging nor production is activated or authorized.

## Recovery

The rehearsal proved the existing guarded rollback restores prior PO rows, program versions and source links while retaining audit history. For a verified development failure, stop writes, reverify identity, full-backup hash and current state, then use the existing rollout rollback command with the private connection, authorization and reference backup recorded in recovery-locations.json. Do not execute a restore directly into another environment.

`node scripts/po-controlled-activation/rollout.cjs rollback --config <private-development-connection.json> --program-ids 1,15,16,17 --backup <private-reference-before.json> --expected 80ba46cda6d6cbc93d9a8a3c2fac6c0cc80905a749838b88c490009b67d94e9e --maintenance --authorization <private-development-authorization.json>`

Rollback refuses intervening protected-data/reference drift; never bypass that refusal or overwrite later faculty work. If drift exists, stop and prepare a reviewed selective recovery using the preserved full backup. The successful isolated full restore demonstrates backup recoverability; it does not authorize replacing a live DB. No recovery was necessary on development.

Exact task files and generated evidence are listed in [files.json](files.json). Earlier preparation reports are dated pre-activation snapshots; this report and activation receipt establish the current development status.
