# Vision, Mission and EGA versioning: audit and minimum changes

Date 2026-11-06. **Audit only; no schema or policy was changed and nothing here is implemented.** Evidence: `server/routes/institution.js`, `server/lib/institution.js`, `server/lib/programs.js`, `server/lib/programEgas.js`, `server/lib/syllabuscheck/repository.js`, `server/lib/syllabuscheck/ruleCoverage.js`, `server/db/schema.sql`, and a saved report from the isolated integration database.

## 1. Three different things

| Reference | Where it lives | Meaning | Edited by | Versioning today |
|---|---|---|---|---|
| **Institutional Vision and Mission** | `institution_settings` (one row, `setting_id = 1`: `vision`, `mission_lead`, `mission_items`, `version`) | the school's statements, identical for every program and year | Admin, `PUT /api/institution/outcomes` | an integer counter, incremented on every save, used only to refuse an out-of-date screen (optimistic lock). **The previous text is overwritten; no history row exists** |
| **Institutional EGA list** | `institution_egas` (`ega_no`, `name`, `short_name`) | the default list of Expected Graduate Attributes | same route, same transaction | shares the institution counter; edited in place; removing an EGA a program still relies on is refused |
| **Program-level EGA assignment** | `program_egas`, one set per program row, and so per academic year (`programs.egas_version`) | the EGAs that program has configured for itself (the list its POs and CLOs map to) | Admin, `PUT /api/programs/:id/egas` | integer counter per program row; edited in place; a program row exists per academic year, so each year has its own copy (`copy-catalog` copies it) |
| **PO-to-EGA crosswalk** | each PO's own `ega_nos` (`program_outcomes`, and inside a published PO reference version) | which EGAs each Program Outcome supports | Admin with the POs | **versioned with the published PO reference** (this work): a draft/publish captures `egas` per PO and hashes them |

A subject keeps its own copy of vision, mission, EGAs and POs (`courses.standards_json`); `Apply to subjects` is the explicit step that refreshes it, and a syllabus carries the subject's copy in its `outcomes` section (non-admin saves are forced to the subject's copy). The checker's `INST-EXACT` rule compares a syllabus's vision, mission and EGAs with the master that `mastersFor` resolves: vision and mission from `institution_settings`, and (this work) the EGAs from the program's own `program_egas` when it has any, else `institution_egas`.

## 2. What the checker and the saved reports record today

* Saved reports **embed the text they were judged against**: a report of the isolated database contains the Vision and Mission text and the EGA list used. A later edit therefore does not rewrite what an old report shows (old reports are never rewritten).
* Since this work `referenceContext` also records `institution.version` (the counter at check time) and `ega` = `{ source: 'program' | 'institution', programId, version, count, sha256 }`. These identify which master was in force without storing a second copy.
* **Gap:** the counter is not a history. Two different Vision texts can both have been "version 3" of nothing, because the previous text is gone. Nothing can answer "what was the Vision on 2027-03-01", or reconstruct the master for a re-verification of an old check, except the text embedded in each old report.
* The reference-aware cache (`pairKey`) does not need the Vision/Mission/EGA version: no AI relationship reads them (the `CLO-EGA` relationship reads the program's EGA text and is already keyed by its own source text).

## 3. Assessment

| Question | Answer |
|---|---|
| Is a historical Vision/Mission/EGA version needed for the checker to be *correct* today? | **No.** The checker resolves the master in force and embeds it in the report. Correctness for new programs and years does not depend on history |
| Is it needed to *re-verify or audit* an old check? | **Yes, if that is a requirement.** Today an old report is self-describing (embedded text) but the institution cannot list "all versions of the Vision" or prove which was officially adopted when |
| Is it a prerequisite for activating the PO publication migration in development? | **No.** The PO reference versions are independent of it |
| Are the authoritative requirements known? | **No.** Nothing in the repository says who may change the Vision, Mission or institutional EGAs, whether a change needs a documented approval, whether past academic years keep their text, or whether per-program EGAs may differ from the institutional list. Those are institutional policy decisions, not engineering ones |

## 4. Minimum change, once the decisions exist (not implemented, schema decision pending)

1. **One append-only history table**, `institution_reference_versions(version_id, kind ENUM('vision_mission','egas'), content_json, content_sha256, effective_from, recorded_by, recorded_at, authorization_note, source_evidence, institutional_approval DEFAULT 'not_recorded')`, written inside the existing `PUT /api/institution/outcomes` transaction (the same save that bumps the counter). The live `institution_settings` / `institution_egas` rows stay the working copy the screens read, so no reader changes.
2. **`mastersFor` records the version id and hash** of the Vision/Mission and the institutional EGA list it resolved (it already records `institution.version`; the hash replaces the dependence on the counter), exactly as the PO reference context does.
3. **Program EGAs:** reuse the pattern of the PO reference (a published, hashed version per program row) *only if* the institution decides program EGAs need the same authorization trail; otherwise the existing per-program-row copy plus the recorded hash is sufficient.
4. **Academic years:** `copy-catalog` already copies program EGAs into the new year's rows; Vision/Mission are not year-scoped. If the institution wants year-specific Vision/Mission, the history table gains an `academic_year`, and the checker picks the version effective for the syllabus's year.
5. **No approval inference:** every row records `institutional_approval = not_recorded` until a separate, explicit approval record exists.

Decisions needed from the owner before any schema work: (a) who may edit the Vision/Mission/institutional EGAs and whether a change requires a recorded authorization; (b) whether the Vision/Mission are per academic year; (c) whether program EGAs must be authorized the same way as Program Outcomes; (d) the authoritative source documents to cite. **Nothing was invented or changed**; Vision, Mission and EGAs of the four existing programs were not replaced (their separate authoritative-source review remains open).
