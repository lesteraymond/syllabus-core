# Admin academic references: policy and behavior

Date 2026-11-06. This replaces the earlier draft, authorization and publication design.

## Policy

The Admin encodes the official references the VPAA supplies. **What an authorized Admin saves is the institution's reference.** The system has no VPAA approval workflow, approval button, mandatory approval document, draft or publication step.

## What happens on a save

| Admin action | Result |
|---|---|
| Add a program with its EGAs and POs | The POs become version 1, in force at once for that program and academic year |
| Save changed POs in the outcomes dialog | The next version is created and put in force in the same transaction as the live rows. The previous version stays, unchanged, as "superseded" |
| Save the same POs | No new version |
| Save EGAs | The audit trail keeps the full statements before and after, with the program's EGA version numbers |
| Save Vision and Mission | The audit trail keeps the school record before and after, with the record's version numbers |
| Copy the catalog into a new academic year | The new year keeps using the same version through a pointer. No version is duplicated |
| Save POs in the new year | That year gets its own version. The earlier year's version stays in force for the earlier year |
| Program from before versioning | One button records its saved outcomes as version 1 |

Every save records who, when, the previous version and the new version (`program_po_reference_audit`). The panel under the outcomes shows the version in force, the years it applies to, its hash, the version history with a comparison, the change log, and reuse of a version from another year.

## Rules that still hold

* Only an Admin can save. Faculty read the references and cannot change them: the Step 2 view is read-only, a forged save keeps the Admin's values, and the Admin routes return 403.
* Past academic years are read-only. A specialization edits nothing and follows its source program, so BSIT-Cyber Security follows every BSIT version.
* A PO or EGA that a CLO still uses cannot be removed.
* A version is immutable: it is re-verified against its hash on every read, and a changed row is refused.
* A saved report is never rewritten, and a syllabus authored under an earlier version is not re-scored. Its check is refused until its mappings are reviewed.
* A subject stays on the version it was given until the Admin uses Apply to Subjects. A specialization has no outcomes of its own, so its subjects follow the source program at once.

## What the checker does with them

The existing resolver (`repository.mastersFor`) reads the version in force for the syllabus's own program and year. No list of programs is consulted, so a new program needs no checker change.

* Claude judges each CLO against the statement. A reference being official never makes a mapping aligned.
* Claude is never asked whether a reference is approved.
* A PO-to-EGA relationship needs its own mapping evidence (P-03 stays NOT_CHECKED), and no crosswalk is invented.
* A program with no saved POs stays NOT_CHECKED for CLO-PO.
* A new version is part of the cache key, so CLO-PO relationships are asked again. A changed EGA statement changes the relationship text, so CLO-EGA relationships are asked again too.

## Before the migration

On a database without the version tables (development today), saving behaves as it does now, the panel says it is not set up, and a program that already has a version stays locked rather than losing its history. Nothing has been migrated.

## Limits

* EGA and Vision/Mission history lives in the audit trail, with full statements. It is not shown as a comparable version list in the panel.
* The source versions of BSIT, BSIE and BSCpE keep their recorded provenance fields until an Admin saves a new version.
* **Curricula have an Admin API (create, approve, retire) but no Admin screen, and an approved curriculum cannot be edited in place.** Requirement 1 of the policy is therefore met only through the API for curricula.
