# Corrected institutional references: current checker audit

Checked 5 November 2026 against the currently configured database in a read-only transaction. Only institutional/program reference tables were read; no faculty syllabus records, migrations, data writes or model requests were used. Raw observations: [reference-activation-audit-2026-11-05.json](reference-activation-audit-2026-11-05.json).

**Conclusion: the checks are implemented, but the corrected reference rollout is not complete.** A match with the current database master does not establish a match with the corrected official reference.

| Reference | Current behavior | Corrected-reference status |
| --- | --- | --- |
| Vision | `INST-EXACT` compares each syllabus with the shared institutional database master | Database version 1 still matches the prototype Vision in `src/data/outcomesSeed.js`; a separately approved corrected version was not verified |
| Mission | `INST-EXACT` compares the lead and ordered items with the shared institutional database master | Database version 1 still matches the prototype lead and five items; a separately approved corrected version was not verified |
| EGAs | `INST-EXACT`, CLO mapping validation, and semantic pair planning use `masters.institution.egas` | All five configured programs currently have four EGAs identical to this master and the seed list; a distinct corrected/approved EGA version was not verified |
| POs | `PO-EXACT` and legacy CLO–PO pair planning use the selected program's database outcomes | None of the five programs resolves an active versioned PO reference; the four applicable designated program lists do not match the corrected source version |

## Program-by-program PO findings

The corrected canonical source version is `lcup-po-2026-10-29` in `src/data/officialProgramOutcomes.json`. Its authority and PDF hashes are documented in `docs/lcup-po-correction/REPORT.md` and `exact-program-outcomes.md`.

| Program currently configured | Database PO count | Corrected expected count | Finding |
| --- | ---: | ---: | --- |
| BSIT | 10 | 9 | All nine corresponding numbered statements differ; the database also retains PO10 |
| BSIT–Cyber Security | 10 | 9 inherited from BSIT | Resolver uses its own copied list; no BSIT inheritance link is effective. All nine corresponding statements differ and PO10 remains |
| BSIE | 13 | 13 | Count matches, but exact source wording differs at PO2, PO4, PO5, PO7, PO10, PO11 and PO12 |
| BSCpE | 13 | 13 | Count matches, but exact source wording differs at PO4, PO7 and PO12 |
| BSFM | 1 | Not supplied | No designated corrected BSFM reference exists in the canonical source file, so correctness/completeness cannot be certified |

Matching counts are not sufficient: punctuation/wording differences and the completed engineering PO12 matter. No PO number or faculty mapping was rewritten by this audit.

## Checker integration and limits

- `repository.mastersFor` loads Vision, Mission and EGAs through `loadOutcomes`, and POs through `loadResolvedProgram`.
- All five synthetic reference-path probes matched their **current database** institutional/PO masters. This demonstrates integration, not corrected-source conformance or actual syllabus compliance.
- Legacy CLO–PO and CLO–EGA pair sources matched the current resolved database text in every program. No semantic judgment was requested.
- Policy V2's reference validator reports the supplied POs unusable for all five programs. This is a dependency result computed without a model, not proof that Policy V2 was activated or executed. Cyber also reports unverified inheritance. BSFM has no canonical program reference to compare.
- EGA checking currently uses the institution-wide list even though program-specific EGA records exist. Those lists are identical today. A future approved program-specific EGA correction must be checked against this resolution path before claiming it applies correctly to that program.
- BSIE/BSCpE still have no PO–EGA crosswalk entries in their current program outcomes. Their mapping consistency cannot be certified from missing data.

## Validation and next required work

Targeted institutional, outcome-source, inheritance and official-source tests: **28 passed, 0 failed, 0 skipped, 0 todo**. These tests use synthetic inputs/test databases; they do not prove live Claude accuracy. Log: `tmp/checker-comprehensive/reference-activation-tests.log`.

To complete the rollout, use the existing reviewed, versioned PO correction process, establish Cyber inheritance, and complete the required faculty mapping review for historical references. Confirm the approved corrected Vision, Mission and EGA wording/version before replacing institutional masters; supply an authorized BSFM reference if that program needs equivalent canonical verification. These are remaining steps, not actions performed by this audit. Enabling Policy V2 alone does not update the database references.
