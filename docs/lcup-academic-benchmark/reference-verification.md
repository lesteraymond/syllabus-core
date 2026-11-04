# Reference readiness for academic evaluation

This is a targeted source-to-fixture readiness check, not another curriculum audit. [Machine-readable verification](package/reference-verification.json) preserves the exact wording differences, source hashes, curriculum records, prior checker findings and PDF pages. No database was connected in this task. Prior database reports describe their recorded snapshots, not a fresh observation of the current database.

## Designated official sources

| Program | Required POs | Designated source | Separate curriculum reference |
|---|---:|---|---|
| BSIT | 9 | IT101, pages 2–3 | BSIT 2022–2023, two verified curriculum images |
| BSIT–Cyber Security | Same 9, inherited from BSIT | IT101 via the existing intended source relationship | Cyber 2025–2026, its own two curriculum images |
| BSIE | 13 | IE403, pages 2–3 | BSIE 2022–2023, two verified curriculum images |
| BSCpE | 13 | CPE404, pages 2–3 | BSCpE 2022–2023, two verified curriculum images |

Canonical reference: [officialProgramOutcomes.json](../../src/data/officialProgramOutcomes.json), version `lcup-po-2026-10-29`. The three canonical lists contain 35 distinct numbered statements; Cyber resolves the BSIT list rather than supplying a fourth independently edited set. All numbering sequences and actual PDF SHA-256 hashes were verified offline. Each of the eight curriculum image hashes also matches the existing verified import record. No image was reinterpreted or reference record changed.

The complete engineering PO12 is retained in both designated sources:

> Knowledge and understanding of engineering and management principles as a member and leader in a team, to manage projects and in multidisciplinary environments.

See [exact official wording and source pages](../lcup-po-correction/exact-program-outcomes.md). Printed quirks remain unchanged, including IT101 PO5's unmatched opening quotation mark, PO6's `design and appropriate solution;`, and engineering PO13's `people materials, implementation, equipment and energy.` The canonical file records no unreadable/OCR ambiguities. Interpretation of unusual wording still belongs to the institution/faculty; no missing word or punctuation was invented. No PO–EGA crosswalk was inferred.

## Verified syllabi versus frozen masters

| Fixture | Authored PO count | Frozen master count | Authored list matches designated official list exactly? | Frozen master matches? |
|---|---:|---:|---|---|
| IT202 / BSIT | 9 | 10 | **Yes** | No |
| IE402 / BSIE | 13 | 13 | No | No |
| CpE304 / BSCpE | 13 | 13 | No | No |
| Cyber | No verified syllabus fixture available | No fresh database assertion | Not measurable from a real syllabus | Intended inheritance verified in source/synthetic reference contexts only |

The IT202 PDF's nine POs agree with the designated IT101 list; its frozen database masters are the conflicting ten-PO basis. This is a reference-resolution issue, not evidence that IT202's authored nine POs are wrong.

For IE402, exact text differs from IE403 at PO2, PO4, PO5, PO7, PO10, PO11 and PO12. For CpE304, exact text differs from CPE404 at PO4, PO7 and PO12. These are literal comparisons, not a claim that all differences change academic meaning: punctuation/wording and incomplete PO12 remain separately reviewable in the JSON. Equal counts alone do not establish an identical reference basis.

All **43 real-source CLO–PO cases** are held from model evaluation while using these frozen masters. Review cases display the original authored PO text with its pages and retain the planner's conflicting master text separately. IT202 needs a consistent approved isolated master context; engineering historical mappings additionally need meaning/basis review. No tag is moved to a different meaning. These holds can be reviewed by faculty but cannot be bypassed merely by setting an expected label in the metrics file.

## Curriculum and identity issues

- IT202 says `Computer Programming 1`; the BSIT approved transcription includes `COMPUTER PROGRAMMING 1 (FUNDAMENTALS OF PROGRAMMING)`. Preserve the source and exact official title-policy distinction; do not invent a permitted alias.
- IE402's title differs in capitalization from `SYSTEMS ENGINEERING`. The existing exact/shadow title policy still reports that difference. Academic equivalence and official exact-match behavior are different questions; no gate or title policy was changed here.
- CpE304 is authored as `CpE 304`; the approved transcription uses `CpE-304`. The unchanged course-code matcher does not collapse that punctuation difference. Title-dependent cases are held rather than certified against an invented curriculum match.
- The three PDF fixtures do not state a curriculum year. Their school year is preserved and is not substituted for curriculum year. The available approved versions above are identified for review, not silently inserted into the verified fixtures.
- Cyber's `IT-202` is **SYSTEM INTEGRATION AND ARCHITECTURE 1**, in 2025–2026. BSIT's `IT 202` is **COMPUTER PROGRAMMING 1 (FUNDAMENTALS OF PROGRAMMING)**, in 2022–2023. Their course records remain isolated. Synthetic Cyber cases use the former; no real Cyber syllabus was invented.

Units/prerequisites and exact code/title records remain in `reference-verification.json`. This task does not change them or reinterpret prior curriculum discrepancies as faculty misconduct.

## Source availability and other limitations

The three fixtures' originally declared PDF paths under `docs/academic-references/` are absent in this checkout. Byte-identical copies exist under `reference-data/`. The package records the declared path, actual path and matching original hash; tests fail if no exact copy is found. No PDF was moved, edited or regenerated.

The institutional EGA names come from the existing frozen master export and authored source columns; these do not provide richer approved attribute definitions. Faculty must judge their intended meaning. Existing Marian-Augustinian names are preserved; local value definitions remain **pending_approval**. All Module-value/Value-use cases therefore identify that institutional hold. No synthetic definition was presented as approved.

## Database/migration dependency

The [prior isolated PO correction report](../lcup-po-correction/REPORT.md) records the last verified existing-database state: BSIT and Cyber each retained ten own PO rows, engineering retained thirteen, and the corrected active references/inheritance were tested only in a disposable database. No new existing-database verification or migration was performed here.

Before evaluating actual saved records under corrected references, the responsible institution must authorize an isolated/reference-consistent evaluation context and, separately if desired, an existing-database rollout. That rollout requires the existing backup/precondition/remediation process. Historical CLO–PO and direct ILO–PO meanings must be reviewed explicitly; saved reports and approved historical versions remain unchanged. Resolving a benchmark reference hold is not authorization to migrate production or rewrite faculty records.

The existing `mastersFor` and PO-remediation guards may refuse pending historical records before checking. This benchmark does not bypass those safeguards. A newly reviewed benchmark/reference version must bind the accepted context and evidence before such cases become model-eligible.
