# LCUP curriculum reference audit (read-only)

**Date:** 2026-10-28 · **Branch:** `Responsive-Design-2` at `68926cb` (uncommitted working tree) · **Status:** read-only audit for review. Nothing was implemented.

**What was compared**
- The eight registrar curriculum photos in `docs/academic-references/`, used as the official curricula.
- The local database, read in a read-only session:
  - programs, Program Outcomes (POs) and EGAs;
  - the approved curriculum references, catalog subjects and curriculum terms;
  - which subjects have syllabi (codes and statuses only; no syllabus content was read).
- The repository's transcriptions:
  - `server/db/local-curriculum-data.cjs` (curricula);
  - `server/db/local-outcome-data.cjs` (POs transcribed from the three faculty-syllabus PDFs);
  - `src/data/outcomesSeed.js` (BSIT POs).
- The AI Checker's deterministic code in `server/lib/syllabuscheck/`, plus an offline probe with synthetic syllabus metadata.

**What was not done**
- No change to the database, migrations, POs, curricula, the catalog, the deterministic rules, scoring, the passing mark of 79 or the submission gates.
- `server/.env` was not touched.
- No paid call and no network call.
- P3–P5 were not started, and nothing was committed.

See the appendix.

## Summary

1. **All four curricula are present and readable.**
   - Each program has both printed pages, and no row is unreadable.
   - Units add up to the printed totals in all 33 terms.
2. **The database matches the prints, with six exceptions.**
   - There is one approved reference per program, and every printed row is in it.
   - All fields match, except six course titles that were stored with a corrected spelling instead of the printed one (3.2).
3. **One catalog subject is defective.** BSIE MA 7 has blank stored standards (no vision, mission, EGAs or POs), and a BSIE syllabus for MA 7 exists (3.3).
4. **Program Outcomes are unchanged** since the 2026-10-22 import.
   - No official PO document exists in `docs/academic-references`.
   - The stored BSIT set (10 POs) disagrees with the list in the IT-202 faculty syllabus (9 POs) (Part 4).
5. **Cyber Security is checked against its own copy of BSIT's POs.**
   - The copy is identical today.
   - Its course identities come from its own 2025–2026 curriculum, which differs substantially from BSIT 2022–2023: only 23 of 61 rows are identical.
   - The PO-inheritance link was never migrated, so the copy will not follow future BSIT corrections (Part 5).
6. **The checker picks the right program, curriculum and PO set.**
   - It does not confuse programs and never approves on its own.
   - Its weak point is exact matching of free text that the author retypes (Part 6):
     - a year written "2022 - 2023", as printed, is reported as a missing curriculum;
     - "IT 204" for "IT-204" is a CRITICAL MISMATCH;
     - a blank prerequisite cell must be typed as a fixed sentence;
     - the six corrected titles fail when typed as printed.
7. **Decisions needed.**
   - 14 institutional questions (L1–L14, Part 7).
   - 14 proposed changes (R1–R14, Part 8).
   - A test plan and the design of a separate LCUP evaluation (Part 9).

---

## Part 1 — Curriculum references found

### 1.1 Registrar curriculum printouts

| File in `docs/academic-references/` | Program | Curriculum year | Page | SHA-256 (first 16 hex) |
|---|---|---|---|---|
| `BSIT-1.jpeg` | BSIT | 2022–2023 | 1 | `a71664c8ad1a47d1` |
| `BSIT-2.jpeg` | BSIT | 2022–2023 | 2 | `0d7812a46615671e` |
| `BSIE-1.jpeg` | BSIE | 2022–2023 | 1 | `cd5bd50fd4dfb1da` |
| `BSIE-2 (1).jpeg` | BSIE | 2022–2023 | 2 | `92cabc29bc21d1fc` |
| `BSCPE-1.jpeg` | BSCpE | 2022–2023 | 1 | `a2572018209a342e` |
| `BSCPE-2.jpeg` | BSCpE | 2022–2023 | 2 | `79256f4f44f8fbee` |
| `BSIT-Cybersecurity-1.jpeg` | BSIT–Cyber Security | 2025–2026 | 1 | `afa2f17df048e965` |
| `BSIT-Cybersecurity-2.jpeg` | BSIT–Cyber Security | 2025–2026 | 2 | `bbccdfc55aa2a712` |

- **What they are.** Photos of the registrar system's "Courses Curriculum" print page, printed on 20/10/2026 between 14:28 and 14:32.
- **Columns.** Code, subject title, lecture and lab hours, lecture and lab units, prerequisite and co-requisite. The co-requisite column is empty on every page.
- **Copies.** `reference-data/` holds byte-identical copies. The import hashed those copies, and the hashes stored in each reference's `source` field match the current images. Neither folder is tracked by git.
- **Missing images: none.** Every program has both pages and every term: Year 1, 1st Semester to Year 4, 2nd Semester, plus the Cyber Security Year 3 Summer.
- **Readability: every row is readable.**
  - The right edge of the BSIE page-2 photo is cut off. Only the program-total line is affected, and its lab total (14.0) is confirmed by summing.
  - A second sheet, stamped 14:32, is partly visible behind BSCpE page 2. It was ignored.

### 1.2 The three PDFs in the same folder

- The files are `IT-202-Programming-1.pdf`, `IE402-SYSTEM-ENGINEERINGS.pdf` and `CPE-304-Fundamentals-of-Mixed-Signals-and-Sensors.pdf`.
- They are faculty syllabi, not curricula.
- Under the standing rule on real faculty syllabi they were not opened; only their hashes were computed.
- Their PO lists appear in this audit only through the repository's existing transcription, `server/db/local-outcome-data.cjs`.

### 1.3 Sources that do not exist

- An official Program Outcomes document for any of the four programs. The curriculum printouts carry no outcomes.
- PO-to-EGA crosswalks for BSIE and BSCpE.
- Descriptions of the four EGAs; only their names exist.
- A registrar or dean sign-off for the four stored references.
- A document that defines Cyber Security as a BSIT specialization and states which outcomes it uses.
- Any other curriculum version, such as BSIT 2025–2026 or later BSIE and BSCpE revisions, and a statement of which student cohorts each version covers.
- A BSFM curriculum. BSFM exists in the database but is outside this audit.

---

## Part 2 — Program and curriculum mappings

### 2.1 What the database holds (read-only session)

| Program | DB id | Approved reference | Reference rows | Catalog subjects | Curriculum terms | Stored POs | Syllabi linked to a subject |
|---|---|---|---|---|---|---|---|
| BSIT | 1 | #1, 2022-2023 | 53 | 53 | 8 | 10, own set | IT 202 (draft) |
| BSIE | 15 | #2, 2022-2023 | 63 | 63 | 8 | 13, own set | MA 7 (for_revision) |
| BSCPE | 16 | #3, 2022-2023 | 66 | 66 | 8 | 13, own set | none |
| BSIT-CYBERSECURITY | 17 | #4, 2025-2026 | 61 | 61 | 9 (incl. Y3 Summer) | 10, own copy of BSIT's | CS-301 (draft) |

- **The references.** All four were created on 2026-10-22 at 03:53:45 UTC by `server/db/seed-local-references.js --apply`, which also wrote the manifest `docs/local-reference-import.json`.
  - All four are `approved`.
  - No other reference (draft, approved or retired) exists for these programs.
- **Catalog and terms.** Catalog subjects and curriculum terms agree exactly with the references.
  - The codes and titles are the same.
  - No subject lies outside a curriculum, and no curriculum row lacks a subject.
  - No subject has catalog CLOs.
- **Unlinked syllabi.** 12 syllabi are not linked to any subject. The audit did not read their content to attribute them.
- **Link tables.**
  - `program_code_aliases` exists and is empty.
  - **`program_outcome_sources`, the PO-inheritance link, does not exist.**
- **BSFM** has no curriculum reference (out of scope).

### 2.2 How a syllabus is tied to a program, a curriculum and a PO set

1. **Subject choice.** The author picks a catalog subject. `applyCourse` (`src/lib/syllabusModel.js:123-138`) copies into the syllabus:
   - the subject's code, title and program code;
   - the subject's stored standards (vision, mission, EGAs and POs), as the starting outcomes.
2. **Typed fields.** The author types the curriculum year, units, year level and prerequisite (`src/views/builder2/InfoStep.jsx:38-44`). The year is free text; a placeholder shows an example.
3. **Program.** The checker resolves the program by code or alias (`server/lib/programs.js:7-21`). It loads that program's POs, or once a link exists, the POs of the program it inherits from (`programs.js:56-62`).
4. **Curriculum.** The checker keeps the approved references whose program code matches and whose year equals the typed year exactly (`server/lib/syllabuscheck/repository.js:15-19`, `engine.js:65`).

---

## Part 3 — Course-level discrepancies

### 3.1 Method and totals

**Method.**
- Every printed row was compared, field by field, with the repository transcription and with the stored reference, catalog subject and curriculum term.
- The fields compared were program, curriculum year, code, title, lecture units, lab units, semester, year level, prerequisite, page and hours.
- This audit made its own transcription of the images, with zoomed crops for every hard-to-read cell. It differs from the repository's only in the six titles in 3.2.

**Totals.**
- The stored references match the transcription in all 12 compared fields of all 243 rows.
- The unit sums of all 33 terms equal the printed term totals.
- The program sums equal the printed program totals:
  - BSIT 156 = 138 + 18;
  - BSIE 186 = 172 + 14;
  - BSCpE 187 = 160 + 27;
  - Cyber Security 176 = 155 + 21.

| Program and year | Rows | MATCH | MISMATCH | MISSING_RECORD | DIFFERENT_CURRICULUM_VERSION | SOURCE_UNREADABLE |
|---|---|---|---|---|---|---|
| BSIT 2022–2023 | 53 | 52 | 1 | 0 | 0 | 0 |
| BSIE 2022–2023 | 63 | 62 | 1 | 0 | 0 | 0 |
| BSCpE 2022–2023 | 66 | 64 | 2 | 0 | 0 | 0 |
| BSIT–Cyber Security 2025–2026 | 61 | 59 | 2 | 0 | 0 | 0 |
| **Total** | **243** | **237** | **6** | **0** | **0** | **0** |

NEEDS_INSTITUTIONAL_CONFIRMATION is listed separately in 3.4, because it concerns the printed source itself: a row can match the database exactly and still carry a printed anomaly.

### 3.2 MISMATCH: titles stored with a corrected spelling

The transcription file says to "Keep spelling … as printed" (`server/db/local-curriculum-data.cjs:2-4`). These six titles were nevertheless stored with a corrected spelling. All their other fields match.

| Program | Code | Printed (zoom-verified) | Stored |
|---|---|---|---|
| BSIT | GE - ELECT KOMFIL | KONTESTWALISADONG KOMUNIKASYON SA FILIPINO | KONTEKSTWALISADONG KOMUNIKASYON SA FILIPINO |
| BSIE | GE - ELECT KOMFIL | KONTESTWALISADONG … | KONTEKSTWALISADONG … |
| BSCpE | GE - ELECT KOMFIL | KONTESTWALISADONG … | KONTEKSTWALISADONG … |
| BSCpE | CpE-304 | FUNDAMENTALS OF MIXED SIGNAL AND SENSORS | FUNDAMENTALS OF MIXED SIGNALS AND SENSORS |
| BSIT–CS | IT-204- | QUANTITATTIVE METHODS (INCLUDING MODELING AND SIMULATION) | QUANTITATIVE METHODS (…) |
| BSIT–CS | IT-210 | SOCIAL AND PROFERSSIONAL ISSUES | SOCIAL AND PROFESSIONAL ISSUES |

**Effect.**
- An author who copies the printed title gets a blocking title finding, and the stored spelling is offered as the replacement (probes S10 and S11).
- The normalized title policy would not help, because it forgives only case and spacing.
- The stored spellings are probably the intended ones; the CPE-304 faculty syllabus file name also says "Signals". Even so, the official spelling is an institutional decision (L7).

**Titles kept as printed.** These count as MATCH, but some may be typos (also L7):
- "MATHEMATIC IN THE MODERN WORLD" (GE - MMW, all four programs).
- "INTERNET TO THINGS (IoT)" (CS-302).
- "PHYTON" (CS IT-ELEC1-). BSIT and BSCpE print "PYTHON".
- "DATA STRUCTURE AND ALGORITHM" (BSIT IT 203, CS IT 104).
- "INFORMATION MANAGEMENT 1 (DATABASE FUNDAMENTAL)".
- "COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING)" in BSIT IT-204, with no space before the parenthesis. CS IT-201 has the space.
- "IT ELECTIVE 2(MOBILE APPLICATION DEVELOPMENT)" in Cyber Security, with no space. BSIT has the space.
- "Engineering Mechanics" in mixed case (BSIE EMEC).

### 3.3 Catalog-level MISMATCH: BSIE MA 7

Every catalog subject's stored standards carry its program's current POs, except **BSIE MA 7 (DIFFERENTIAL CALCULUS)**.
- Its stored standards are blank: no vision, no mission items, no EGAs and no POs.
- Its code, title and curriculum fields are correct.

**Effect on new syllabi.**
- A new MA 7 syllabus starts with blank outcomes, because the builder copies the subject's stored set (`src/lib/syllabusModel.js:132-134`).
- INST-EXACT and PO-EXACT then fail and offer the master texts as replacements.
- Alignment is still checked against the BSIE program POs, because the checker takes the master from the program, not from the subject.

**Existing syllabus.** A BSIE syllabus linked to MA 7 exists, with status `for_revision`. Whether it has blank outcomes was not checked, because syllabus content was not read.

**Likely cause (not confirmed).** A subject created before the import would look like this:
- the import leaves an existing subject untouched (`server/db/seed-local-references.js:113-116`);
- the subject route creates subjects with a blank set (`server/routes/courses.js:102`).

### 3.4 NEEDS_INSTITUTIONAL_CONFIRMATION: printed anomalies

Each item below is printed this way (verified on zoomed crops) and stored exactly as printed.

| # | Program | What is printed | Question |
|---|---|---|---|
| A1 | BSIE | IE 302 ← "IE 301, STATIE2" and ERGO 1 ← "IE 301", all three in Year 3, 2nd Semester | IE 301 is offered in the same term, so it cannot be completed first. Was a co-requisite intended? |
| A2 | BSIE | COMPRO (Computer Fundamentals and Programming) ← PHYENG | Unusual prerequisite; FUNELC-IE in the same term has none |
| A3 | BSCpE | CpE-305 OPERATING SYSTEM ← ENGDA (Engineering Data Analysis) | Unusual prerequisite |
| A4 | BSIT–CS | IT-203 (Computer Networks 1) ← IT 104 (Data Structure and Algorithm) | BSIT's IT-304, with the same title, requires IT 101 |
| A5 | BSIT–CS | Eleven codes end in a hyphen: IT 102-, IT 103-, IT-204-, IT 205-, IT 206-, IT 207-, IT 208-, IT 209-, IT-ELEC1-, IT-307-, IS- | Is the hyphen part of the official code? The prerequisite column repeats the hyphenated forms, which suggests real registrar codes |
| A6 | BSIT–CS | IS- INTEGRATING SEMINAR, with a blank prerequisite | Looks truncated; BSIT prints IS-CITE ← 4th Yr |
| A7 | BSIT–CS | IT-ELEC1- has 0 lecture units and 1 lab unit | BSIT's IT-ELEC1, with the same name, has 2 / 1 |
| A8 | BSIT–CS | CS-301 to CS-304, then CS-307 to CS-310; there is no CS-305 or CS-306 | Numbering gap: is anything missing? |
| A9 | BSIT–CS | No GE electives (KOMFIL, DL, SOSLIT), although all three 2022–2023 curricula have them | Confirm for 2025–2026 |
| A10 | All | Mixed code punctuation within one curriculum: BSIT "IT 202" and "IT-204"; BSCpE "CpE 301" and "CpE-300", plus "COE 7" | Which form is official, and must syllabi reproduce it exactly? |
| A11 | All | 83 blank prerequisite cells: BSIT 19, BSIE 24, BSCpE 22, CS 18 | Does blank mean "none"? The checker currently requires the sentence "Not specified in the source curriculum (blank prerequisite cell)." |
| A12 | All | The six spellings in 3.2 and the as-printed titles listed after them | Which spelling is official? |

### 3.5 Version differences, and records missing outside the database

- **The database.** Every reference carries the year printed on its source, and no record belongs to another version.
- **Cyber Security.** Its 2025–2026 curriculum differs from BSIT 2022–2023 by design (Part 5). These are version differences, not errors.
- **Evaluation data** (not the database). The align-1 dataset, from whose dev cases Faculty Packages V1 and V2 were built, uses three course identities that need care:
  - **"IE 310" (Operations Research) for BSIE.** BSIE 2022–2023 has no such code; it has OR 1 and OR 2. This is a MISSING_RECORD.
  - **"IT 204" for BSIT.** The curriculum code is "IT-204"; only the format differs.
  - **"Differential Calculus" for MA 7.** The curriculum title is "DIFFERENTIAL CALCULUS"; only the case differs.
- **V2 already discloses** that its cases are synthetic, that IE 310 is not found, and that the identities are "as transcribed in the system (not confirmed by the registrar)".

---

## Part 4 — Program Outcome verification

### 4.1 The stored sets

| Program | POs | SHA-256 of the set (first 16) | Versions (POs / EGAs) | PO–EGA links | Repository source | Same as source |
|---|---|---|---|---|---|---|
| BSIT | 10 | `f5799103d540066e` | 1 / 1 | all 10 linked | `src/data/outcomesSeed.js` | yes |
| BSIE | 13 | `f2222c90b34ad583` | 2 / 2 | none | `local-outcome-data.cjs` (IE402 syllabus, pp. 2–4) | yes |
| BSCpE | 13 | `50277c1f9172d07d` | 2 / 2 | none | `local-outcome-data.cjs` (CPE-304 syllabus, pp. 2–3) | yes |
| BSIT–CS | 10 | `f5799103d540066e` | 2 / 2 | same as BSIT | copied from BSIT by the import | identical to BSIT in number, short name, text and EGA links |

- All four programs carry the same four EGA names.
- The import manifest (`docs/local-reference-import.json`) records the same counts.
- **Conclusion: no Program Outcome has changed since the import.** This audit did not edit, merge or generate any outcome.

### 4.2 No authoritative source

- None of the files in `docs/academic-references` is an official PO document.
  - The curriculum printouts carry no outcomes.
  - The PO lists come from faculty syllabi, which are secondary sources.
- The stored POs can therefore be compared only with those transcriptions, not with an institutional source. This is recorded as L1 to L3.

### 4.3 BSIT: the stored set against the IT-202 syllabus list

| Stored PO | IT-202 syllabus PO | Relation |
|---|---|---|
| 1 Apply computing and other knowledge domains to address realworld problems. | 7 … real-world problems; | same except "realworld" |
| 2 Analyze complex problems and identify and define the computing requirements needed to design an appropriate solution. | 6 Analyze complex problems, and identify … design and appropriate solution; | near-identical |
| 3 Design and develop computing solutions using a system-level perspective. | 8 | identical |
| 4 Demonstrate ethical behavior as an IT Professional and sensitivity to the impact of technology in the society. | — | stored only |
| 5 Show Augustinian virtues/ethical values and the understanding and appreciation of corporate social responsibility. | — | stored only |
| 6 Work effectively and independently in multi-disciplinary and multi-cultural teams. | 3 | identical |
| 7 Understand the impact of their work on society and strive to ensure that their actions contribute positively on the community. | — | stored only |
| 8 Articulate and discuss the latest developments in the specific field of practice. | 1 | identical |
| 9 Act in recognition of professional, social and ethical. | 4 Act in recognition of professional, social ethical responsibility; | stored text looks truncated |
| 10 Demonstrate ethical leadership and social responsibility by integrating sustainability, inclusivity, … | — | stored only |
| — | 2 Effectively communicate orally and in writing using both English and Filipino; | syllabus only |
| — | 5 Preserve and promote "Filipino historical and cultural heritage; | syllabus only |
| — | 9 Utilize modern computing tools. | syllabus only |

- **Numbering differs as well as wording.** For example, "Apply computing…" is PO 1 in the database but PO 7 in the syllabus. A CLO tagged against one list therefore points at a different outcome in the other.
- **The import did not merge the lists.** It kept the existing stored set, as its own warning says.
- Which list is official is question L1.

### 4.4 BSIE and BSCpE

- **Both programs store the same 13 engineering outcomes,** transcribed from their faculty syllabi. In BSIE, PO 11 ends "and;"; in BSCpE it ends "and".
- **PO 12 is incomplete.** It ends mid-sentence: "…as a member and leader in a team, to manage projects and in". The import marked it as an incomplete source and did not complete it.
- **PO 13 reads like an industrial-engineering outcome,** yet it is stored for BSCpE too: "Ability to design, develop, implement and improve integrated system that include people materials, implementation, equipment and energy."
- **Neither set has PO–EGA links.** The PDFs give no crosswalk, and the import left the links empty rather than invent them.
- These are questions L2 and L3.

---

## Part 5 — Cyber Security specialization findings

### 5.1 What the printout is

The Cyber Security printout is a curriculum in its own right:
- curriculum year 2025–2026;
- 61 subjects and 176 units (155 lecture, 21 lab);
- nine terms, including a Year 3 Summer (IT-ELEC3, IT-ELEC4);
- specialization subjects CS-301 to CS-404, and its own capstones, CAPCYB 1 and CAPCYB 2.

### 5.2 Crosswalk against BSIT 2022–2023

| Relation to BSIT 2022–2023 | Rows | Codes |
|---|---|---|
| Identical row (code, title, prerequisite, units, year, semester) | 23 | GE - US, PC, RPH, RC, ET, CW, STS, MMW, ART; PATHFit 1–4; NSTP 1–2; TH 1–6; IT 101; IT-PRAC |
| Same code, a field differs | 6 | OFFTOOLS (semester); IT-305 (prerequisite IT-205 → IT 208-); TECHPREN-CITE (adds IT-210); IT-ELEC2 (title spacing; adds IT-ELEC1-); IT-ELEC3 and IT-ELEC4 (Y4 1st Semester → Y3 Summer; "4th Yr" dropped) |
| Same course under a new code | 16 | IT 102- ← IT 102; IT 103- ← IT 202; IT 104 ← IT 203; IT 105 ← IT-205; IT-203 ← IT-304; IT-204- ← IT-401; IT 205- ← IT-302; IT 206- ← IT 301; IT 207- ← IT 306; IT 208- ← IT-307; IT 209- ← IT-308; IT-210 ← IT-402; IT-306 ← IT-403; CS-310 ← IT-309; IT-307- ← IT-404; IS- ← IS-CITE |
| Same course under a new code, title differs only by a space | 1 | IT-201 ← IT-204 (Computer Programming 2) |
| No BSIT counterpart | 15 | IT-202 (System Integration and Architecture 1); CS-301, CS-302, CS-303, CS-304; IT-ELEC1- (same elective name as BSIT IT-ELEC1, but "PHYTON" and 0/1 units); CAPCYB 1; CS-307, CS-308, CS-309; CAPCYB 2; CS-401, CS-402, CS-403, CS-404 |
| BSIT rows absent from Cyber Security | 7 | GE - ELECT KOMFIL, GE - ELECT DL, GE - ELECT SOSLIT, IT-303 (System Integration and Architecture), IT-ELEC1, CAPSPRO1, CAPSPRO 2 |

Six pairs of **different** courses have codes that differ only by a space or a hyphen:

| BSIT 2022–2023 | BSIT–CS 2025–2026 |
|---|---|
| IT 202 Computer Programming 1 | IT-202 System Integration and Architecture 1 |
| IT 203 Data Structure and Algorithm | IT-203 Computer Networks 1 |
| IT-204 Computer Programming 2 | IT-204- Quantitative Methods |
| IT-205 Introduction to Human Computer Interaction | IT 205- Information Management 1 |
| IT 306 Information Management 2 | IT-306 Application Development and Emerging Theories |
| IT-307 Computer Networks 2 | IT-307- System Administration and Maintenance |

- **Same course, two spellings.** Two more pairs are one course written two ways: IT 102 / IT 102- (Discrete Mathematics), and IT-ELEC1 / IT-ELEC1-.
- **No collisions inside a curriculum.** Within any single curriculum, no two codes differ only by spaces or hyphens.

### 5.3 Outcomes and inheritance

- **Stored today.** Cyber Security has its own 10 POs. The import copied them from BSIT (`seed-local-references.js:99-109`), and they are identical to BSIT's.
- **What the code intends.** A specialization should be checked against BSIT's POs through a link (`repository.js:11-12`, `programs.js:39-75`). While that link exists, editing the specialization's outcomes separately is refused.
- **What actually happens.** The link table was never created, because `server/db/migrate-program-outcome-sources.js` has not been applied. `outcomeSource` therefore falls back to Cyber Security itself (`programs.js:42-47`).
- **Risks.**
  - If the BSIT POs are later corrected (L1), Cyber Security syllabi will still be checked against the old copy.
  - Nothing currently stops Cyber Security's POs from being edited on their own.
  - Either way, the two sets can drift apart silently.
- **The migration's guard.**
  - It refuses the link when any PO row (number, short name, text, EGA links) or EGA row differs, unless forced.
  - The read-only comparison found the PO rows and the EGA names identical. EGA short names were not compared.
  - The link should therefore be accepted without force. Its `--dry-run` would confirm this, but it was not run, because migrations are not allowed in this audit.

### 5.4 The discrepancy with "Cyber Security uses BSIT's POs and curriculum references"

- **POs: consistent.** Cyber Security is checked against a copy of the BSIT POs that is identical today (probe S15).
- **Curriculum: not literally.** The system checks Cyber Security syllabi against the **Cyber Security 2025–2026 reference**, not against BSIT 2022–2023, and this is what the printout requires.
- **The literal reading would reject most subjects.** If all 61 Cyber Security subjects were checked against BSIT 2022–2023 (offline run of the checker's own rules):
  - 37 would fail: 32 as CRITICAL MISMATCH, because the code is not in BSIT, and 5 on a checked field;
  - 24 would pass. These include OFFTOOLS, whose semester differs, because semester is not checked.
- **How this audit reads the instruction.** Cyber Security uses BSIT's Program Outcomes, and its course identities come from its own 2025–2026 curriculum.
- **To be confirmed** under L4 and L5. No inheritance or mapping was changed.

---

## Part 6 — AI Checker reference-selection findings

**Code read**
- In `server/lib/syllabuscheck/`: `engine.js`, `repository.js`, `identity.js`, `titles.js`, `validation.js`, `gemini.js`, `stages.js` and `policy.js`.
- `server/lib/programs.js` and `server/lib/compliance/service.js`.
- The status and approval routes.

**Offline probe**
- `engine.coded` and `gemini.pairsOf` were run on synthetic metadata.
- The masters were built from the stored references, the same way `repository.mastersFor` builds them.
- No database call and no AI call were made.

**Current settings**
- Stages A–D2 are off.
- The title policy is `shadow`, so the exact title comparison is the official one.
- The AI gate is `advisory`.
- None of these flags is set in `server/.env`.

### 6.1 Probe results (synthetic metadata)

| # | Input | Result |
|---|---|---|
| S1 | BSIT IT-204, every field as stored | all PASS; identity verified |
| S2 | BSIT, year typed as printed: "2022 - 2023" | CUR-REF NOT_EVALUATED: "Official approved curriculum unavailable for BSIT. Submission is blocked until it is supplied." |
| S3 | BSIT, year left blank | all PASS (the only BSIT reference is used) |
| S4 | BSIT, code "IT 204" | "CRITICAL MISMATCH: Course Code IT 204 does not exist in the official BSIT curriculum."; no hint |
| S5 | CS IT-202 carrying BSIT IT 202's title | title FAIL; replacement offered: "SYSTEM INTEGRATION AND ARCHITECTURE 1" |
| S6 | CS, code "IT 202" | CRITICAL MISMATCH; hint only: "BSIT 2022-2023 IT 202 COMPUTER PROGRAMMING 1 …" |
| S7 | BSIE STATIE1 (blank cell), prerequisite "None" | prerequisite FAIL; replacement is the blank-cell sentence |
| S8 | BSIE, code "IE 310" | CRITICAL MISMATCH |
| S9 | BSIE MA 7 titled "Differential Calculus" | title FAIL under the exact policy (would match under the normalized policy, which forgives case) |
| S10 | BSCpE CpE-304 titled as printed ("SIGNAL") | title FAIL; replacement "…SIGNALS…" |
| S11 | CS IT-204- titled as printed ("QUANTITATTIVE") | title FAIL |
| S12 | CS with year "2022-2023" | CUR-REF NOT_EVALUATED: curriculum unavailable for BSIT-CYBERSECURITY |
| S13 | CS IT-ELEC3 (Summer), year level 3 | PASS |
| S14 | CS IT-ELEC3, year level 4 | year level FAIL |
| S15 | CS CS-301 with the BSIT POs | PO-EXACT PASS |
| S16 | BSIT CLO tagged PO 11 (BSIT has 10) and PO 3 | CLO-MAP FAIL; the PO 11 relationship has no PO text and is never sent to the AI (it is left out, or marked INSUFFICIENT_EVIDENCE) |
| S17 | Program with no POs | PO-MASTER NOT_EVALUATED: "Official program outcomes are unavailable; program alignment cannot be verified." |

### 6.2 Findings

**F1. Program selection is correct.**
- The program is resolved by its code (upper-cased) or by an alias (`server/lib/programs.js:7-21`). The alias table is empty.
- An unknown program gets an empty PO master (`repository.js:12-13`). The result is NOT_EVALUATED, never a pass (S17).

**F2. Curriculum version selection is correct but brittle.**
- **How it selects.** The candidates are the approved references whose program code matches and whose year equals the typed year exactly (`repository.js:19`, `engine.js:65`). A blank year selects the program's single reference (S3).
- **Where it breaks.** Any other spelling of the same year selects nothing. Examples are "2022 - 2023" (the form printed on the curricula), an en dash, or "SY 2022-2023".
- **What the author is told.** That the official curriculum is unavailable and submission is blocked (S2). **A typing difference is reported as a missing reference.**
- **Root cause.** The year field is free text (`InfoStep.jsx:42`).

**F3. The PO set is correct.**
- The POs come from the resolved program (`repository.js:12`).
- Each CLO–PO relationship takes its PO text, by number, from that set (`gemini.js:144`).
- The "any PO" question uses the whole set (`gemini.js:148-150`).
- Cyber Security is checked against its own copy of the BSIT POs (S15; see 5.3).

**F4. Programs are not confused.**
- Only the selected program's references are candidates (`engine.js:65`).
- Other programs' references feed only a "this code exists elsewhere" hint, which is never treated as a match (`identity.js:14-21`; S6).
- Codes are compared only after trimming, collapsing spaces and upper-casing (`engine.js:34`). The six near-identical BSIT/CS code pairs in 5.2 therefore cannot be mixed up.
- **The cost:** a punctuation variant of a real code, such as "IT 204" for "IT-204", is reported as a CRITICAL MISMATCH. The submission gate reports a score of 0 for it (S4; `compliance/service.js:39`).

**F5. Nothing is auto-approved.**
- **Who approves.** Only an administrator can change a status.
- **What approval requires.**
  - The AI check must have been run (`server/routes/syllabi.js:186-189`).
  - No blocking coded finding may remain (`syllabi.js:190-197`, via `compliance/service.js:34-39`).
  - An administrator publishing their own syllabus also needs a current, conformant, scored check (`syllabusContent.js:316-323`).
- **The AI never approves.**
  - Its judgements are advice by default (`policy.js:15-21`).
  - Even under the `required` gate, the AI check only has to be completed by an approved model; its verdict need not agree (`gemini.js:44-47`).
- **Invalid tags are blocked.** A CLO tagged with a PO number that does not exist is blocked (CLO-MAP, `validation.js:38-46`; S16).
- **Caveats.**
  - A CLO tagged with a real but unsuitable PO passes the coded rules. Only the advisory AI judgement and the administrator can catch it.
  - The "Use the exact master text" replacement can turn a wrong title into the official one without any change to the content (S5). With Stage A off (the default), nothing checks that the CLOs and topics fit the course the code identifies.

**F6. Missing references are mostly kept apart from violations.**
- **Where it works.**
  - A missing master gives NOT_EVALUATED, never PASS or FAIL. This covers CUR-REF, PO-MASTER and CLO-MAP without a master (S17).
  - A relationship with an empty side is never sent to the AI (`gemini.js:789-797`; S16).
- **Exceptions.**
  - A year typed differently is reported as a missing reference (F2).
  - A course from another program or version is reported as a code violation with a hint, not as a different curriculum version (S6).
  - A syllabus that names another version's year finds no reference at all (S12).
  - A blank prerequisite cell becomes a required sentence, so "None", "N/A" and an empty field all fail (S7).

**F7. Comparisons are exact.**
- **Titles** are compared exactly. The normalized policy, if activated, would forgive only case, spacing and Unicode form (`titles.js:20-46`).
- **Prerequisites** must match exactly; they are not even trimmed (`engine.js:82`).
- **Units and year level** are compared as numbers (`engine.js:83`).
- **What blocks as a result:**
  - the six corrected titles typed as printed;
  - the letter case of MA 7's title (S9);
  - any spacing difference in a prerequisite.

**F8. The references were approved without a sign-off.**
- The import inserted the four references directly as `approved` (`seed-local-references.js:124`).
- That bypassed the route that requires an administrator to confirm each reference against its source (`server/routes/syllabusCheck.js:42-47`).
- This audit's comparison now provides that verification, but no registrar sign-off is recorded (L12).

**F9. Some fields are not compared.**
- Semester, lecture and lab hours, and co-requisites are stored but not checked (`engine.js:81-83`).
- The Cyber Security Summer subjects are stored as year level 3, and the year-level check enforces it (S13, S14).

**F10. Authors retype values the system already holds.**
- The builder copies only the code, title and program from the catalog (`syllabusModel.js:125-128`).
- The units, year level, prerequisite and curriculum year are typed again, even though the approved reference holds them.
- Most of the avoidable failures in F2 and F7 begin here.

---

## Part 7 — Missing or unverified institutional information

| ID | Question | Why it matters |
|---|---|---|
| L1 | Which BSIT Program Outcome list is official, and in what numbering: the stored 10 (PO 9 looks truncated, PO 1 has "realworld") or the 9 in the IT-202 syllabus? | BSIT and Cyber Security alignment is checked against it |
| L2 | The official BSIE and BSCpE outcomes: the full text of PO 12, whether PO 13 belongs to BSCpE, and whether the two programs share one list | PO-EXACT and CLO–PO alignment |
| L3 | PO-to-EGA crosswalks for BSIE and BSCpE (none exist), and confirmation of BSIT's | EGA alignment cannot be traced for engineering |
| L4 | Cyber Security outcomes: BSIT's POs and EGAs, or outcomes of its own? Which BSIT set (2022–2023 or newer)? | Whether to apply the inheritance link (R5) |
| L5 | Is the 2025–2026 printout the official Cyber Security curriculum? Which cohorts follow it, and do earlier Cyber Security students follow BSIT 2022–2023? | Whether a second Cyber Security reference is needed |
| L6 | Other curriculum versions in force (for example BSIT 2025–2026, or BSIE and BSCpE revisions) and the cohorts they cover | A syllabus for another version currently finds no reference |
| L7 | The official spelling of the titles in 3.2 and of the as-printed titles listed after it | R1 |
| L8 | The official course codes: trailing hyphens, "IS-", space or hyphen, "COE 7". Must syllabi reproduce them exactly? | CUR-CODE and R4 |
| L9 | Prerequisite anomalies A1–A4 | Whether the printed curriculum is correct |
| L10 | How a syllabus should state "no prerequisite" for a blank cell | R3 |
| L11 | Cyber Security gaps: GE electives, CS-305 and CS-306, IT-ELEC1- units | Completeness of the 2025–2026 reference |
| L12 | Who verifies each reference against its source, and when (registrar sign-off) | F8, R8 |
| L13 | The curriculum-year format to use in syllabi | F2, R2 |
| L14 | EGA descriptions (only names exist) | Quality of EGA alignment |

---

## Part 8 — Recommended changes requiring approval

Nothing in this part has been implemented. Items marked † change what a deterministic check decides. Until you say otherwise, treat them as covered by the restriction on the 47 deterministic rules and on official scoring.

| ID | Change | Touches | Waits on |
|---|---|---|---|
| R1 | Settle the title spellings. If the printed spelling is official, issue a reviewed new reference version (a draft, confirmed against the source, then approved, with the old version retired); do not edit an approved reference in place. If the corrected spelling is official, record that decision in the transcription and the manifest so it is no longer silent | reference data | L7 |
| R2 † | Make the curriculum year a choice among the program's approved years, or treat spellings of the same year as equal. Reword the "unavailable" message so it says when the year was not recognised | UI; CUR-REF | L13 |
| R3 † | Accept the agreed wording for a blank prerequisite cell, or pre-fill the field (R9) | CUR-FIELD prerequisite, or UI | L10 |
| R4 † | When a code is not found but matches a code **of the selected curriculum** once spaces and hyphens are ignored, report "written differently; did you mean X (title)?" instead of CRITICAL MISMATCH. Never match across programs (5.2), still check the title, and never replace the code automatically | CUR-CODE | L8 |
| R5 | Apply the PO-inheritance link. First run `migrate-program-outcome-sources.js --dry-run` and review its report, then apply it with authorization | database (migration) | L4 |
| R6 | Correct Program Outcomes only through versioned, institution-approved changes, never edits in place, then refresh the subject snapshots | POs | L1–L3 |
| R7 | Refresh BSIE MA 7's stored standards from the BSIE program, and check whether the MA 7 syllabus in `for_revision` has blank outcomes | catalog data | — |
| R8 | Record a registrar sign-off for each reference: who verified it, when, and against which images | reference metadata | L12 |
| R9 | When a subject is chosen, pre-fill the units, year level, prerequisite and curriculum year from the approved reference. Author edits stay visible as differences | UI only | — |
| R10 | Enable Stage A (does the content fit the course?) only after its own evaluation, to catch relabelled courses (F5) | AI stage flag | an evaluation |
| R11 | Build future faculty packages and datasets from reference-verified identities. V1 and V2 stay frozen as they are | evaluation data | — |
| R12 | Keep one canonical copy of the curriculum images (`docs/academic-references` or `reference-data`), with a tracked hash manifest | repository | — |
| R13 | Add the offline tests in 9.1 | tests | — |
| R14 | Build the separate LCUP evaluation in 9.2. It is not part of P3–P5, and any paid run needs approval | evaluation | L1–L3, R11 |

---

## Part 9 — Proposed program-specific test coverage

### 9.1 Deterministic offline tests (no AI, no database, no network)

- **Where.** A new file, `server/lib/syllabuscheck/lcup-curriculum.test.js`, built on the transcription and `engine.coded`, as this audit's probe was.
- **How to run.** On its own, with `node --test <file>`. **Do not use `npm test`**, which rewrites `docs/faculty-review/phase3`.

| Test | What it pins |
|---|---|
| T1 | The printed anomalies A1–A11 stay as printed (for example IE 302 ← IE 301 in the same term, the 11 hyphen-final codes, and IT-ELEC1- at 0/1), so that a later clean-up cannot change them silently |
| T2 | Per-term subject counts and unit sums equal the printed totals in all 33 terms, and the program totals likewise |
| T3 | Reference selection: one reference per program; a blank or exact year selects it; variant years behave as they do today (S2) until R2 is decided |
| T4 | Cross-program isolation: each of the six near-identical BSIT/CS code pairs verifies only under its own program, and "elsewhere" stays a hint |
| T5 | PO selection: BSIT and Cyber Security use the BSIT set; BSIE and BSCpE use their own. Raise an alarm if the Cyber Security copy drifts from BSIT before the link exists |
| T6 | Missing reference versus violation: no reference gives NOT_EVALUATED; an unknown code gives CRITICAL; an empty PO side gives INSUFFICIENT_EVIDENCE without an AI call |
| T7 | No auto-approval: approval is refused while a blocking coded finding remains (a route test with a mocked database, like the existing route tests) |
| T8 | Every subject's stored standards equal its program's POs. This needs the database, so it belongs in a read-only verification script (an extension of `seed-local-references.js --verify`), not in a unit test. **It currently fails on BSIE MA 7.** Fix the data (R7); do not weaken the check |
| T9 | The Summer term: CS IT-ELEC3 and IT-ELEC4 are stored as year level 3 with semester "Summer" |

The existing coverage stays as it is:
- `reference-import.test.js`: the 243 subjects, totals, blank cells, punctuation and PO omissions.
- `outcome-sharing.test.js`.
- `outcome-source.test.js`.

### 9.2 A separate LCUP evaluation ("lcup-1", design only)

**Purpose:** to measure the AI's judgements on real LCUP course identities and each program's own POs, without touching any existing evaluation.

1. **Separate files.**
   - Create a new dataset (for example `server/lib/syllabuscheck/eval/lcup-1-dataset.json`) and a new results folder (for example `docs/ai-eval-lcup-1/`).
   - Write nothing into align-1, the A1/A2/A3/B1/B2 results, Faculty Packages V1 and V2, the response importer's outputs or `heldout-log.jsonl`.
2. **Identities.**
   - Take them only from the approved references: code, title, units and year level as stored.
   - Sample every program and every year level, including the Cyber Security Summer and the CS-coded subjects.
   - Include the six near-identical code pairs as negative controls.
3. **Outcomes.** Use only POs confirmed under L1–L3. Until then, label the set "provisional POs" and do not report results as institutional.
4. **Content.**
   - Use only newly written synthetic CLOs and weekly topics.
   - Do not use real faculty syllabi, `realSyllabi.js`, text from the three PDFs, or V1/V2 cases.
5. **Contamination guard.**
   - Before the set is frozen, a script compares every new item with all 100 align-1 items (58 dev, 42 held-out), by normalized text and word n-gram overlap, and rejects near-duplicates.
   - The script prints only item ids and scores, never held-out text, so the held-out set stays unseen by anyone tuning prompts.
6. **Splits fixed before any run.**
   - A dev split, for prompt work.
   - A held-out split, locked by its SHA-256 in a manifest and with its own access log. Held-out runs happen once per approved prompt version.
7. **Labels.**
   - Expected verdicts come from faculty adjudication in each discipline (IT, IE, CpE), recorded with the reviewer and the date.
   - Synthetic or majority labels are never presented as faculty or institutional judgements.
8. **Metrics.**
   - Per program and per relationship type: accuracy, false approvals, false rejections and the INSUFFICIENT_EVIDENCE rate.
   - The deterministic checks (identity and PO selection) are reported separately, as pass/fail.
9. **Cost and approval.** Run an offline replay first. Paid runs happen only with explicit approval and a pre-registered plan, as for P2-B2.

---

## Appendix — How this audit stayed read-only

- **Database.**
  - Local MariaDB 10.4.32, in a read-only session (`SET SESSION TRANSACTION READ ONLY`, then `START TRANSACTION READ ONLY`, rolled back).
  - Only SELECT queries were run. Syllabus content was never read; only subject codes and statuses were.
  - No seed or migration script was run.
- **`server/.env`.**
  - Read only through dotenv, inside the audit scripts.
  - Its checker flags were checked with a script that prints flag names, not values.
- **Network.** Every script ran with a preload that blocks and logs any non-local connection. No attempt was logged. No AI provider was called and nothing was paid for.
- **Real faculty syllabi.** The three PDFs were not opened; only their hashes were computed.
- **Tests.** `npm test` was not run.
- **Files.** A SHA-256 snapshot of 804 files was taken before the audit and compared after this report was written.
  - Coverage: `server/lib`, `server/db`, `server/routes`, `server/scripts`, `src`, `docs`, `scripts`, `tests`, `reference-data`, `server/.env` and the root configuration files. This includes the evaluation datasets and results, Faculty Packages V1 and V2, and the response importer.
  - Result: 1 file added (this report), 0 removed, 0 changed.
  - `server/.env` is unchanged (SHA-256 begins `9e8eb0103c0aae56`).
- **Scratch work.** Scripts, image crops and outputs are in the session scratchpad, not in the repository.
