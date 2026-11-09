# RC8 activation preparation and reference-adoption review

Date 2026-11-06. RC8 source `5edd97a3…` is unchanged and preserved. No code changed, no database or server configuration changed, and no migration ran. The development database was only read.

**Recommendation: preparation is complete, but do not run the migration on RC8. Correct the implicit adoption first, as RC9.**

## 1. Cyber Security inheritance

Probe on frozen RC8, synthetic source program and specialization:

| Step | Result |
|---|---|
| Specialization subject after the source program saves | Shows the new statement with no Apply |
| Check reference source | The source program |
| Syllabus written earlier, before any faculty save | Keeps its old statements |
| Check on that syllabus | Refused, `po_reference_review_required` |
| Earlier saved report | Byte-identical |
| After one unrelated faculty save | Takes the new statements and the check runs (the gap in section 3) |

Inheritance works as decided. The refusal holds until a save adopts the change.

## 2. Current faculty mapping review

What already protects:
* Before Apply, a faculty save keeps the old statements.
* An outdated syllabus is refused by the checker, including through Apply, until it adopts the statements.
* CLO mappings are preserved. After adoption every CLO-PO relationship is judged again, none reused.
* Saved reports never change.

## 3. Missing protection

**There is no explicit adoption step.** Adoption is a side effect:
* **Server:** `applyCatalog` calls `forceStandards` on every faculty save (`server/routes/syllabusContent.js:73`).
* **Client:** the builder applies the subject's standards when a draft opens (`src/views/builder2/index.jsx:109`), and that change autosaves.
* **UI:** no faculty notice or adopt control exists, although the refusal message tells the author to adopt.

Proof on RC8: after Apply, saving only the References section changed the syllabus's PO statement, and the check then passed on the new version. From the client code, opening the draft would have the same effect (not run in a browser).

## 4. Smallest correction (not applied)

No new rule, no scoring change, no database change.

| Change | Where |
|---|---|
| On a faculty save, keep the syllabus's stored PO statements when it has PO mappings and they differ from the subject's, unless the request says adopt. Vision, Mission and EGAs behave as today | `syllabusContent.js`, `syllabusOutcomes.js` |
| A small adopt action that takes the subject's statements for that syllabus and changes no mapping | `syllabusContent.js` |
| Do not auto-apply POs on open when the draft has PO mappings; a draft with none (a new one) still fills in | `syllabusModel.js`, `builder2/index.jsx` |
| Step 2 notice with a Review and adopt button, in English and Filipino | `ClosStep.jsx`, i18n |

**Regression impact:** the save path every faculty save uses, so moderate. New drafts and E-scenarios without PO mappings should be unaffected; forged-save protection must be retested, because stored statements must come from the database and never the request. Integration tests 19b and Apply to Subjects change, since they adopt by saving. **Full regression required, about 40 minutes, producing RC9.**

Two small wording items can go in the same change: the tooltip `hybrid.poReferenceApproval` still speaks of formal institutional approval, against the policy, and a dry-run detail in `check.cjs` still names `institutional_approval`, a column removed from the migration.

## 5. Backup and recovery readiness

| Item | Result |
|---|---|
| Backup tool (`development-backup.cjs`) | Present; refuses any database but the reviewed one |
| Target identity | Matches the reviewed target, read-only |
| Rehearsal on a synthetic database, same dump options | Passed 7 of 7: backup, no database-selection statement, restore, tables, counts and checksums equal, damage detected, full recovery |
| Migration rehearsal (dry run, apply, verify, repeat, rollback, refusal) | Passed on RC8 |
| Real backup of `syllabus_cms_plus` | **Not taken.** It must be taken inside the window, and it copies real records |

`backup-restore-rehearsal.json` holds the evidence. The repository's `development-restore.cjs` was reviewed but not run: it needs a real backup's context file.

## 6. Migration dry run

COMPATIBLE, zero writes, against `syllabus_cms_plus` (`po-publication-dry-run-development.json`). It would create `program_po_reference_audit`, add 6 version columns and 4 pointer columns, and leave the 2 existing tables and every row alone.

## 7. Packet size

Live value 1 MB; `my.ini` `[mysqld]` line 37 is still `1M`; the requirement is 16 MB. The largest saved report is already 914,798 bytes (87% of the limit). Plan and rollback are in `DEV-DATABASE-PACKET-CONFIG.md`.

## 8. Authorization

The exact operations are listed in `DEVELOPMENT-ACTIVATION-PLAN.md`, sections 8 and 9.
