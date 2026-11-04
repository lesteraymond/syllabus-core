# LCUP curriculum audit follow-up (read-only)

**Date:** 2026-10-28 · **Branch:** `Responsive-Design-2` at `68926cb` (uncommitted working tree) · **Status:** read-only analysis for review. Nothing was implemented.

**Companion document:** `docs/lcup-academic-decisions-for-vpaa.md`. It is the decision document for the academic authorities: plain language, the evidence quoted exactly, and no assumed answers.

**What was examined**
- The first audit, `docs/lcup-curriculum-reference-audit.md` (findings F1–F10, questions L1–L14, recommendations R1–R14, tests T1–T9).
- The three syllabi the user identified as VPAA-approved, in `docs/academic-references/`.
  - They were opened on this computer only. Text was extracted, and pages were rendered to images offline with the repository's own PDF library, then read by eye.
  - Nothing from them was sent to an AI provider or any other service.
- The local database, in a read-only session: the institution master, programs, Program Outcomes (POs), PO–EGA links, catalog subjects and approved curriculum references. **No syllabus content was read from the database.**
- The code involved:
  - the checker (`server/lib/syllabuscheck/`) and the compliance rules (`server/lib/compliance/`);
  - the PDF importer (`server/lib/pdfImport.js`, `src/lib/pdfImport.js`);
  - the save and submit routes (`server/routes/syllabusContent.js`).
- An offline probe that ran the application's own importer and `engine.coded` on the three PDFs, against the masters read from the database (appendix).

**What was not done**
- No change to the database, curriculum records, POs, the 47 deterministic rules, official scoring, the passing mark of 79 or the submission gates.
- No migration was run, not even a dry-run.
- `server/.env` was not touched.
- No paid call and no network call was made.
- P3–P5 were not started.
- No historical dataset or result was changed, and the approved syllabi were not modified.
- Nothing was committed, pushed, merged or deployed.

**People.** The syllabi name their authors and signatories. This report refers to roles only: Faculty, Dean, VPAA, Assistant VPAA (AVPAA) and LIC Director.

---

## Summary

1. **The three approved syllabi are in the repository folder,** with byte-identical copies in `reference-data/` (4.1).
   - All three are on form PRE-VPAA-FO-001 (011), for school year 2025-2026.
   - Each has a sign-off block for the Faculty author, the Dean, the VPAA and the AVPAA, with references certified by the LIC Director.
   - Their VPAA approval is taken from the user's statement; this report does not assess signatures or dates.
2. **None of the three passes the current checker as printed, and most of the reasons are not academic defects** (4.8).
   - **Template edition.** The approved form's reference groups (A Books, B Internet References, C Journals, D Electronics) are not the system's (A Books, B Internet Programming, C Internet References, D Electronics). T-21 therefore blocks all three until a group is marked N/A.
   - **Institutional text.** The approved syllabi print a different vision and mission from the system master. CpE 304 also prints a six-item mission.
   - **Document content.** Some findings come from the documents themselves:
     - ILOs with no CLO tag: IT 202 has 3, CpE 304 has 11;
     - a week in two rows (IT 202) and a lesson week with no ILO (CpE 304);
     - CLOs that no ILO builds;
     - lesson weeks that name none of the six core values: 1 of 10, 4 of 6 and 8 of 8.
   - **Closest to passing: IE-402.** With the system's outcomes, units and prerequisite, its only blocking findings are two empty reference groups, which can be marked N/A.
3. **VPAA approval and the checker disagree, and that needs an institutional answer, not a code fix.**
   - The approved documents fail rules on reference groups, core values and CLO tagging.
   - Either those rules ask for more than the approved form does, or the approval did not check them. Only the academic authorities can say which (Part 1).
   - Relaxing the checker until the approved syllabi pass would build their gaps into the standard (Part 7).
4. **BSIT Program Outcomes: all 19 CLO–PO tags of the approved IT 202 syllabus point to a different outcome under the stored numbering** (2.3).
   - The checker cannot notice, because it checks only that the numbers exist.
   - Its "use the master text" replacement swaps the PO texts under the unchanged numbers.
   - With the AI stage on, the 19 pairs are judged and scored against outcomes the author never chose. Each costs up to 3 points.
5. **Engineering Program Outcomes.**
   - PO-EXACT passes for IE-402 and CpE 304 only because the stored sets were transcribed from these same two documents. This is circular, not confirmation.
   - PO 12 is cut off mid-sentence in both approved documents themselves.
   - No approved syllabus contains a PO–EGA crosswalk, and BSIT's ten stored links have no source document. P-03 cannot fire for BSIE or BSCpE.
6. **Cyber Security** (Part 3).
   - The PO-inheritance link would be accepted without force: every PO and EGA row is identical, EGA short names included. This settles the point the first audit left open.
   - After the link, the code keeps Cyber Security's own 2025–2026 curriculum and takes BSIT's outcomes. That is the intended model.
   - Linking makes Cyber Security follow whichever BSIT list is in force, so decide L1 first.
7. **Correction to the first audit (F4, F7, F10).**
   - The builder copies the course code and title from the catalog on every save (`server/routes/syllabusContent.js:65`), and the author cannot type them.
   - So a "CpE 304"-style CRITICAL MISMATCH (score 0), and title failures for printed spellings, do not occur in the normal builder flow. They occur only where a code or title reaches the checker without the catalog (Part 5.1).
   - The typed fields remain exposed: curriculum year, prerequisite, units and year level.
8. **The importer adds risks of its own** (5.6). It:
   - keeps only the first PO of "PO1, PO2, PO3" lists, losing 7 of CpE 304's 11 CLO–PO tags;
   - merges an "ILO 2" written without a colon into the previous ILO, which hides an untagged ILO;
   - overwrites the prerequisite with the PDF's value;
   - treats "IT 202" (BSIT) and "IT-202" (Cyber Security) as the same code.
9. **Nothing proposed here changes the scoring formula or the passing mark of 79.**
   - Several items change what a blocking gate decides, or which deductions apply. Each is marked † and needs explicit approval (Parts 6 and 7).
10. **The evaluation plan (Part 9) keeps three things apart:**
    - objective rule outcomes;
    - outcomes that depend on a policy decision;
    - semantic judgements, which stay blank until faculty adjudicate them. VPAA approval of a document is not treated as ALIGNED for any relationship.
    - No AI or paid run is planned without separate privacy and cost approval.

---

## Part 1 — Institutional decisions requiring approval

### 1.1 The fourteen recommendations of the first audit, classified

**Classes**
- **INST**: an institutional decision is required.
- **REF**: an academic reference must be corrected.
- **DET**: improves deterministic matching.
- **DB**: improves database consistency.
- **AI**: improves AI reference selection.
- **INV**: more investigation is required.

"Scoring" means the published score and pass/fail. A blocking finding withholds the score (null); a CRITICAL finding sets it to 0; a deduction changes the number.

| ID | Recommendation (short) | Classes | Waits on | Touches the 47 rules? | Affects official scoring? |
|---|---|---|---|---|---|
| R1 | Settle title spellings through a reviewed new reference version | INST, REF | L7, L20 | No | Only if the reference title and the catalog subject title diverge: every syllabus of that subject would then fail CUR-FIELD title (blocking). Change both together (R23) |
| R2 † | Curriculum year as a choice, or spellings of one year treated as equal | DET (INST for the format) | L13, L19 | No | Yes, through a gate: CUR-REF is blocking. The choice-list form changes only the input |
| R3 † | Agreed wording for a blank prerequisite cell | INST, DET | L10 | T-05 only if an empty field were allowed | Yes, through a gate (CUR-FIELD prerequisite, blocking) |
| R4 † | Code written differently: hint instead of CRITICAL MISMATCH | DET (INST for the code forms) | L8 | No | Yes, directly: CRITICAL sets the score to 0. Low urgency, because the builder never lets an author type the code (5.1) |
| R5 | Apply the PO-inheritance link (dry-run first) | DB, AI | L4, and L1 first (3.3) | No | None today (identical sets). Afterwards Cyber Security follows every BSIT correction |
| R6 | Correct POs only by versioned, approved changes; refresh snapshots | INST, REF | L1–L3 | P-03 reads the PO–EGA links | Yes. Until updated, existing syllabi fail PO-EXACT (blocking), and CLO–PO pairs are judged against the new texts |
| R7 | Refresh BSIE MA 7's stored standards; check the MA 7 syllabus in `for_revision` | DB | Authorization (reading that syllabus needs separate approval) | No | No. The masters come from the program; this removes avoidable failures (2.6) |
| R8 | Registrar sign-off record per reference | INST, DB | L12 | No | No |
| R9 | Pre-fill units, year level, prerequisite and curriculum year | DET (UI) | — | No | No change to any rule; fewer typed-field failures |
| R10 | Stage A only after its own evaluation | AI, INV | an evaluation | No | No. Its relationship types are advisory (`policy.js:10`) |
| R11 | Future datasets from reference-verified identities | INV | — | No | No |
| R12 | One canonical copy of the curriculum images, with a hash manifest | INV (repository hygiene) | which folder is canonical | No | No |
| R13 | Offline tests T1–T9 | DET (tests) | — | No | No |
| R14 | Separate LCUP evaluation (lcup-1) | AI, INV | L1–L3, R11 | No | No. Paid runs need approval |

**Recommendations that could affect official scoring or the 47 rules:** R1 (only if the catalog and the reference diverge), R2, R3, R4 and R6. The new items R18–R21 in Part 6 are also in this group.

**None of them changes the formula** (`engine.js:436,453`) **or the passing mark of 79.**

### 1.2 Decisions requiring approval

The first audit's L1–L14 stand. This follow-up adds new evidence to some of them and raises L15–L21. Each is written out in plain language, with the evidence quoted exactly, in `docs/lcup-academic-decisions-for-vpaa.md`.

| ID | Decision | New evidence from this follow-up | Who decides (suggested) |
|---|---|---|---|
| L1 | Official BSIT PO list and numbering | The approved IT 202 syllabus prints 9 POs. The system stores 10. All 19 IT 202 tags change meaning between the two (2.3). A third list, the IT 204 template's, used PO 11 and PO 14 (`src/data/outcomesSeed.js:44-47`) | VPAA with the Dean |
| L2 | Official BSIE and BSCpE POs: PO 12's full text, PO 13, one shared list or two | Both approved syllabi print the same 13 POs, with PO 12 cut off and the same PO 13 (2.4) | VPAA with the Dean |
| L3 | PO–EGA crosswalks (BSIE, BSCpE), and confirmation of BSIT's | No approved syllabus has one. BSIT's 10 links come from the seed, with no source document (2.5) | VPAA |
| L4 | Cyber Security outcomes | The link is technically ready (3.2) | VPAA with the Dean |
| L5 | Which cohorts follow Cyber Security 2025–2026 | Unchanged | Registrar |
| L6 | Other curriculum versions in force | The approved syllabi name school year 2025-2026, not a curriculum (4.2) | Registrar |
| L7 | Official title spellings | The approved CpE 304 syllabus spells "Signals", as stored, against the registrar print "SIGNAL". The approved IT 202 syllabus omits the curriculum title's parenthesis | Registrar |
| L8 | Official code forms | The approved syllabus prints "CpE 304"; the curriculum prints "CpE-304" | Registrar |
| L9–L12, L14 | As in the first audit | — | As in the first audit |
| L13 | Curriculum-year format | Merged into L19 | Registrar |
| **L15** | Vision and mission: which text is current; is CpE 304's six-item mission an approved revision? | All three approved syllabi differ from the system master (4.3) | President's or VPAA's office |
| **L16** | Which edition of form PRE-VPAA-FO-001 is current | Reference groups, the "COURSE"/"LEARNING CONTENTS" heading and the campus header differ (4.7) | VPAA |
| **L17** | Must every lesson week name one of the six core values? | 1 of 10, 4 of 6 and 8 of 8 lesson weeks do not (4.6) | VPAA |
| **L18** | Must every ILO carry a CLO tag, every lesson week have an ILO, and every CLO be built and assessed? | 3, 0 and 11 untagged ILOs; IT 202 CLO4 and CpE 304 CLO3 and CLO4 are built by no ILO (4.6) | VPAA |
| **L19** | Curriculum year or school year on a syllabus; which curriculum each SY 2025-2026 class follows | The form prints "SCHOOL YEAR 2025-2026"; the system asks for a curriculum year (5.2) | Registrar with the VPAA |
| **L20** | Must a syllabus reproduce the registrar's title, code and prerequisite exactly? | "Computer Programming 1", "4th Year Standing", "CpE 304", letter case (4.2) | Registrar |
| **L21** | May approved, faculty-authored syllabi be used as test material, and may their text ever go to an external AI provider (names removed)? Whose consent is needed? | They name real faculty and officials | VPAA (with the authors' consent) |

The faculty questions F1–F10 are about the content of the three documents. The decision document lists them for the Dean to pass on. They are not institutional decisions, and the checker does not depend on them.

---

## Part 2 — Program Outcome discrepancy analysis

### 2.1 Sources and provenance

| Source | Where | POs | Status |
|---|---|---|---|
| Stored BSIT set | Database (equal to `src/data/outcomesSeed.js:23-34`) | 10, each linked to EGAs | Added in commit `06a1111` (2026-10-13). The file says "Seed data copied from the institutional form (via the builder prototype)" (`outcomesSeed.js:1`). That form is not in the repository |
| Approved IT 202 syllabus | `docs/academic-references/IT-202-Programming-1.pdf`, pp. 2–3 | 9, no PO–EGA links | Transcribed in `server/db/local-outcome-data.cjs:25-35` (`bsitPdf`). Not imported: the import kept the stored set (`:39`) |
| IT 204 template "IT204-Programming2-EOMS" | Mentioned only in `outcomesSeed.js:44-47` | At least 14 (it tags PO 11 and PO 14) | Not in the repository |
| Stored BSIE set | Database (equal to `local-outcome-data.cjs:10-24, 37`) | 13, no links | Transcribed from the approved IE-402 syllabus |
| Stored BSCpE set | Database (equal to `local-outcome-data.cjs:10-24, 38`) | 13, no links | Transcribed from the approved CpE 304 syllabus |
| Stored Cyber Security set | Database | 10, identical to BSIT | Copied from BSIT by the import |

- **No official PO document** exists in `docs/academic-references/`, and the first audit's 4.2 still holds.
- **The approved syllabi are the most authoritative PO evidence in the repository.**
  - They do not settle L1. The IT 202 syllabus prints a list that differs from the stored one.
  - They do not settle L2. The two engineering syllabi print the same list, including the cut-off PO 12.
- **Read-only check:** every stored set equals its repository source. Nothing has changed since the 2026-10-22 import.

### 2.2 BSIT: exact wording, stored against the approved IT 202 syllabus

The printed text is quoted as it appears on pages 2–3, including its punctuation.

| Stored PO | Stored text | IT 202 PO | IT 202 text (as printed) | Difference |
|---|---|---|---|---|
| 1 | Apply computing and other knowledge domains to address realworld problems. | 7 | Apply computing and other knowledge domains to address real-world problems; | "realworld" / "real-world"; end mark |
| 2 | Analyze complex problems and identify and define the computing requirements needed to design an appropriate solution. | 6 | Analyze complex problems, and identify and define the computing requirements needed to design and appropriate solution; | comma after "problems"; "an appropriate" / "and appropriate"; end mark |
| 3 | Design and develop computing solutions using a system-level perspective. | 8 | Design and develop computing solutions using a system-level perspective; | end mark only |
| 4 | Demonstrate ethical behavior as an IT Professional and sensitivity to the impact of technology in the society. | — | — | stored only |
| 5 | Show Augustinian virtues/ethical values and the understanding and appreciation of corporate social responsibility. | — | — | stored only |
| 6 | Work effectively and independently in multi-disciplinary and multi-cultural teams. | 3 | Work effectively and independently in multi-disciplinary and multi-cultural teams; | end mark only |
| 7 | Understand the impact of their work on society and strive to ensure that their actions contribute positively on the community. | — | — | stored only |
| 8 | Articulate and discuss the latest developments in the specific field of practice. | 1 | Articulate and discuss the latest developments in the specific field of practice; | end mark only |
| 9 | Act in recognition of professional, social and ethical. | 4 | Act in recognition of professional, social ethical responsibility; | stored text ends without a noun and looks cut off; printed text has no "and" |
| 10 | Demonstrate ethical leadership and social responsibility by integrating sustainability, inclusivity, mental well-being and peace-building principles into academic, professional and community engagements, ensuring holistic development and societal transformation. | — | — | stored only |
| — | — | 2 | Effectively communicate orally and in writing using both English and Filipino; | printed only |
| — | — | 5 | Preserve and promote “Filipino historical and cultural heritage; | printed only; the opening quotation mark has no closing mark |
| — | — | 9 | Utilize modern computing tools. | printed only |

- **Common ground.** Five outcomes are shared with only punctuation or spelling differences, and one more is near-identical (stored 9 and printed 4).
- **Differences.** Four outcomes are stored only, and three are printed only.
- **Numbering.** No outcome has the same number in both lists.

### 2.3 What the approved IT 202 tags mean under each list

The approved syllabus tags its CLOs as follows:
- CLO1 "[EGA 1,3,4] [PO 1,2,3,6,8]";
- CLO2 "[EGA 1,3,4] [PO 1,2,3,6,8]";
- CLO3 "[EGA 1,2,3,4] [PO 1,2,3,4,6,8,9]";
- CLO4 "[EGA 2] [PO 4,5]".

That is 19 CLO–PO tags.

| Tag | Meaning in the approved IT 202 list | Meaning in the stored list (what the checker uses) |
|---|---|---|
| PO 1 | Articulate and discuss the latest developments… | Apply computing and other knowledge domains… |
| PO 2 | Effectively communicate orally and in writing… | Analyze complex problems and identify and define… |
| PO 3 | Work effectively and independently in multi-disciplinary… teams | Design and develop computing solutions… |
| PO 4 | Act in recognition of professional, social ethical responsibility | Demonstrate ethical behavior as an IT Professional… |
| PO 5 | Preserve and promote “Filipino historical and cultural heritage | Show Augustinian virtues/ethical values… |
| PO 6 | Analyze complex problems, and identify and define… | Work effectively and independently in multi-disciplinary… teams |
| PO 8 | Design and develop computing solutions… | Articulate and discuss the latest developments… |
| PO 9 | Utilize modern computing tools. | Act in recognition of professional, social and ethical. |

**Per tag: all 19 tags point to a different outcome.**

**Per CLO, as a set of outcomes:**
- **CLO1 and CLO2.**
  - As approved: latest developments, communication, teamwork, problem analysis and design.
  - As stored: application of computing, problem analysis, design, teamwork and latest developments.
  - Four of the five coincide; "communicate" becomes "apply computing".
- **CLO3.** Five of seven coincide, counting stored 9 ≈ printed 4. "Communicate" and "modern computing tools" become "apply computing" and "ethical IT professional".
- **CLO4.**
  - As approved: ethical responsibility and Filipino heritage.
  - As stored: ethical IT professional, and Augustinian virtues/CSR.
  - Neither coincides.

**What the system does with this**
- **CLO-MAP passes.** It checks only that each number exists in the master (`validation.js`); 1–9 all exist among 10. The change of meaning is silent.
- **PO-EXACT fails** if the author keeps the printed list, and offers the stored list as a replacement. Accepting it keeps the tag numbers and swaps every text under them. No warning is shown.
- **With the AI stage on, every pair is judged against the stored text** (`gemini.js:144`). The four tag types are scored (`policy.js:10` lists them as non-advisory):
  - NOT_ALIGNED costs 3 points, and PARTIALLY_ALIGNED costs 1 (`engine.js:302`);
  - INSUFFICIENT_EVIDENCE is a blocking finding (`engine.js:304`).
  - The 19 IT 202 pairs alone could cost up to 57 points, for relationships the author never made.
- **The checker cannot tell which list the author meant.** Only L1, and the author's answer to F1, can settle that.

### 2.4 BSIE and BSCpE

The two approved engineering syllabi print the same thirteen outcomes. The table quotes the three that matter here.

| PO | IE-402 (as printed, pp. 3–4) | CpE 304 (as printed, p. 3) | Stored |
|---|---|---|---|
| 11 | Ability to use techniques, skills and modern engineering tools necessary for engineering practice; and; | Ability to use techniques, skills and modern engineering tools necessary for engineering practice; and | each equal to its own source; this is the only difference between the stored BSIE and BSCpE sets |
| 12 | Knowledge and understanding of engineering and management principles as a member and leader in a team, to manage projects and in | the same | the same, marked `sourceIncomplete` in the transcription (`local-outcome-data.cjs:24`) |
| 13 | Ability to design, develop, implement and improve integrated system that include people materials, implementation, equipment and energy. | the same | the same |

**Observations (no conclusions drawn)**
- **PO 12 ends mid-sentence in the approved documents themselves**, not only in the transcription. Its ending must come from the official source. This report does not supply one.
- **PO 13 is the same statement in both programs.** It names integrated systems of people, materials and equipment. The documents cannot show whether the two programs share one list or whether one syllabus was built from the other's template. That is L2.
- **PO-EXACT passes for both approved syllabi by construction,** because the stored sets were transcribed from them. That pass does not confirm the stored sets.
- **Effect of a future PO 12 correction (R6).** Every BSIE and BSCpE syllabus carrying the cut-off text would fail PO-EXACT (blocking) until it is updated. A replacement would be offered.
- **AI exposure today.**
  - CpE 304 tags its CLO2 with PO 12 ("[EGA2, PO6. PO7, PO12]"), so with the AI stage on, that pair is judged against the incomplete sentence. NOT_ALIGNED would cost 3 points, PARTIALLY_ALIGNED 1, and INSUFFICIENT_EVIDENCE would withhold the score.
  - The importer happens to drop that tag (5.6). That is not a safeguard; it is a second defect.

### 2.5 PO–EGA links

| Program | Stored links | Source |
|---|---|---|
| BSIT | PO1→EGA1, PO2→1, PO3→1, PO4→2, PO5→2, PO6→4, PO7→3, PO8→1 and 4, PO9→2, PO10→3 | `outcomesSeed.js` only. No institutional document in the repository |
| BSIT–Cyber Security | the same ten (a copy) | the import |
| BSIE, BSCpE | none | The approved syllabi print EGAs, POs and CLOs in three separate columns, with no crosswalk. The transcription left the links empty rather than infer them (`local-outcome-data.cjs:8-9`) |

**Effect on P-03** ("CLO {n} is tagged PO {po}, which maps to EGA {ega}, but EGA {ega} is not tagged"; major, weight 2):
- **BSIE and BSCpE.** P-03 cannot fire, so it is reported as passed although nothing was checked.
- **BSIT.** It works against the stored numbering only. For IT 202 it passes, but under the printed list that pass means nothing (2.3).

**AI judgements.** The CLO–EGA judgements use EGA names only (`gemini.js:145`). No EGA descriptions exist (L14).

### 2.6 MA 7

| Subject | Catalog id | Stored standards | Curriculum reference row |
|---|---|---|---|
| BSIE MA 7 DIFFERENTIAL CALCULUS | 25 | **blank**: no vision, no mission items, 0 EGAs, 0 POs (versions 1/1/1) | 3 lec / 0 lab, Year 1, 1st Semester, page 1 of `BSIE-1.jpeg`, blank prerequisite cell stored as "Not specified in the source curriculum (blank prerequisite cell)." |
| BSCpE MA 7 DIFFERENTIAL CALCULUS | 141 | complete, equal to the masters | same values, `BSCPE-1.jpeg` |

**What is "missing" is the subject's copy, not an institutional source.**
- The BSIE program's POs exist and are what the checker uses for any BSIE syllabus (`repository.js:12`).
- No new outcome is needed. Refreshing the copy (R7) needs only authorization.

**What happens today with a new BSIE MA 7 syllabus**
- The builder copies the blank set (`syllabusModel.js:132-134`).
- The submit route then refuses it with "Complete Vision, Mission, EGA, PO and CLO in step 2 before submitting." (`syllabusContent.js:292-298`).
- Once the author fills them in, INST-EXACT and PO-EXACT require the master texts exactly, and offer them as replacements.
- **Verdicts are not wrong; the author has avoidable work.**

**A hypothesis checked and ruled out.** The question was whether T-09–T-12 compare the syllabus with MA 7's blank subject set and so contradict INST-EXACT and PO-EXACT. They do not:
- At submit, the syllabus's own snapshot is built from its submitted outcomes (`syllabusContent.js:290`) and passed in as the catalog. T-09–T-12 therefore compare the syllabus with itself.
- The hybrid engine runs the rules without a catalog, so they are skipped there.

**Not investigated.** Whether the existing BSIE MA 7 syllabus (status `for_revision`) has blank outcomes. Reading syllabus content needs approval, so it stays part of R7.

---

## Part 3 — Cyber Security curriculum and inheritance

### 3.1 How the checker handles Cyber Security today

| Item | Behaviour today | Code |
|---|---|---|
| BSIT curriculum 2022–2023 | Reference #1. Selected only for program `BSIT` | `engine.js:65` |
| Cyber Security curriculum 2025–2026 | Reference #4 (61 rows). Selected only for `BSIT-CYBERSECURITY`, when the year is blank or exactly "2025-2026" | `engine.js:65` |
| Specialization-specific courses | CS-301…CS-404, CAPCYB 1–2 and the Year 3 Summer electives are verified against #4 only: code, title, prerequisite, units and year level. Semester is not checked (F9) | `engine.js:71-83` |
| Near-identical codes across the two curricula (5.2 of the first audit) | Never mixed: codes are matched only inside the selected curriculum, and another program's match is only an "exists elsewhere" hint | `engine.js:71`, `identity.js` |
| BSIT PO copy | Cyber Security has its own ten rows. Number, short name, text and EGA links are identical to BSIT's, and so are its four EGA rows, short names included. Program versions: Cyber Security 2/2, BSIT 1/1 | read-only probe |
| Inheritance link | `program_outcome_sources` does not exist (ER_NO_SUCH_TABLE), so the outcome source falls back to Cyber Security itself | `programs.js:42-47` |
| Existing Cyber Security syllabus | One draft (CS-301), per the first audit's 2.1 | — |

### 3.2 What the link would change (code reading only; nothing was run)

- **The curriculum stays Cyber Security's.** `loadResolvedProgram` keeps the program's own code, so CUR-REF still selects reference #4. Only the EGAs, the POs and their versions come from BSIT (`programs.js:56-62`).
- **Subjects follow BSIT live.** `inheritStandards` gives every Cyber Security subject BSIT's current POs and EGAs (`programs.js:65-70`, used by `courses.js:23`), so new Cyber Security syllabi start from BSIT's list.
- **Edits are refused at the specialization.** The message is "BSIT-CYBERSECURITY inherits its Program Outcomes and EGAs from BSIT. Edit them in BSIT." (`programs.js:72-75`).
- **Cyber Security's own PO rows stay in the database,** unused. Removing the link row would restore today's behaviour.
- **Version numbers change.** The versions shown for Cyber Security change from 2/2 to BSIT's 1/1. They serve only optimistic locking, so an administrator page open during the change may need a reload.
- **The migration's guard.** It refuses a link when any PO or EGA row differs, unless forced. The read-only comparison, using the guard's own comparison logic, found no difference. The first audit had not compared the EGA short names; they are identical. So the link would be accepted without `--force`. The `--dry-run` itself was not run.

### 3.3 Proposal: the specialization uses its own approved course list and inherits BSIT's outcomes

This is not implemented and is subject to L4.
1. **Keep reference #4 as Cyber Security's curriculum.**
   - Do not point Cyber Security at BSIT 2022–2023. Under the checker's rules, 37 of its 61 subjects would fail (first audit 5.4).
   - Reference #4 and the Cyber Security PO rows stay as they are.
2. **Link the outcomes only.**
   - Run `server/db/migrate-program-outcome-sources.js --dry-run` and review its report.
   - Then apply it with separate authorization. Nothing else changes: programs, curricula, subjects and syllabi keep their ids.
3. **Decide L1 before the link, or with it.** The link makes Cyber Security follow BSIT's list. Settling the BSIT list first means the correction is made once, in BSIT, and Cyber Security follows it automatically.
4. **After any BSIT correction (R6),** refresh the BSIT subjects' stored snapshots (`courses.standards_json`).
   - They are not refreshed automatically: new BSIT syllabi would start from the old list and then fail PO-EXACT.
   - Linked Cyber Security subjects need no refresh.
5. **Cohorts (L5).** If earlier Cyber Security students follow BSIT 2022–2023, they need a second Cyber Security reference, approved like the others. The registrar decides first.
6. **Specialization-specific outcomes (L4).** If the institution wants Cyber Security-specific outcomes, the link is the wrong model, and Cyber Security keeps its own set, edited separately.
7. **Tests before the link:**
   - the code stays Cyber Security's, and the POs and EGAs come from BSIT;
   - edits are refused at the specialization;
   - an alarm sounds if the copy drifts from BSIT before the link exists (T5 and T20).

### 3.4 A cross-program path found in this follow-up

The PDF importer compares codes after removing every non-alphanumeric character (`src/lib/pdfImport.js:66-67`).

**How it goes wrong**
1. A Cyber Security author whose subject is IT-202 (System Integration and Architecture 1) can import the BSIT IT 202 syllabus (Computer Programming 1).
2. The import raises no code mismatch, only a passive title warning.
3. The saved syllabus then carries the catalog's identity (IT-202 and its title), so CUR-CODE and CUR-FIELD pass.
4. Only Stage A, which is off, or the reviewer would notice that the content belongs to another course. This is the first audit's F5 caveat, now with a concrete path.

**The correction** (R17, UI only): turn the title warning into a confirmation that names both titles.

---

## Part 4 — Comparison of the three VPAA-approved syllabi

### 4.1 Files

| File (in `docs/academic-references/`) | Bytes | Pages | SHA-256 (first 16) | Copy in `reference-data/` |
|---|---|---|---|---|
| `IT-202-Programming-1.pdf` | 334 192 | 11 | `6376fe94981ae65f` | byte-identical |
| `IE402-SYSTEM-ENGINEERINGS.pdf` | 297 498 | 12 | `44ca6d48c77d0b04` | byte-identical |
| `CPE-304-Fundamentals-of-Mixed-Signals-and-Sensors.pdf` | 308 385 | 9 | `f68eb5bedb77d31b` | byte-identical |

- **Both folders are untracked by git.** Note that `realSyllabi.js` reads the `reference-data/` copies (Part 9).
- **All three are text PDFs.** They were read from their text layer and checked against rendered page images. No OCR was needed.

### 4.2 Course identity

The syllabus wording is quoted as printed. The curriculum values are the approved references (#1 BSIT, #2 BSIE, #3 BSCpE, all 2022–2023).

| Item | IT 202 | IE-402 | CpE 304 |
|---|---|---|---|
| Code (syllabus) | IT 202 | IE-402 | CpE 304 |
| Code (curriculum) | IT 202 | IE-402 | CpE-304 |
| | match | match | **punctuation differs** (L8, L20) |
| Title (syllabus) | Computer Programming 1 | Systems Engineering | Fundamentals of Mixed Signals and Sensors |
| Title (curriculum) | COMPUTER PROGRAMMING 1 (FUNDAMENTALS OF PROGRAMMING) | SYSTEMS ENGINEERING | FUNDAMENTALS OF MIXED SIGNALS AND SENSORS (registrar print: "…MIXED SIGNAL AND SENSORS", first audit 3.2) |
| | **the parenthesis is omitted**: fails under both the exact and the normalized title policy | letter case only: fails exact, passes normalized | letter case only. The syllabus spells "Signals", as stored, not as the registrar printed it (L7) |
| Credit units (syllabus) | 2 units lecture / 1 unit laboratory | 3 units | 3 units lecture |
| Credit units (curriculum) | 2 lec / 1 lab | 3 / 0 | 3 / 0 |
| | consistent | consistent, if "3 units" means 3 lecture and 0 laboratory (assumed) | consistent |
| Prerequisite (syllabus) | IT 101 | 4th Year Standing ("th" printed as a superscript) | FUNEC, FUNELC |
| Prerequisite (curriculum) | IT 101 | 4th Yr | FUNEC, FUNELC |
| | match | **wording differs** (L20) | match |
| Year level and semester (curriculum; not printed on the form) | Year 2, 1st Semester | Year 4, 1st Semester | Year 3, 1st Semester |
| Applicable curriculum | The form names "SCHOOL YEAR 2025-2026", not a curriculum. BSIT has one stored reference, 2022–2023, where IT 202 is Computer Programming 1. In Cyber Security 2025–2026, "IT-202" is System Integration and Architecture 1 and Computer Programming 1 is "IT 103-" | "SCHOOL YEAR 2025-2026". BSIE has one stored reference, 2022–2023 | "School Year 2025-2026". BSCpE has one stored reference, 2022–2023 |

**Which curriculum the SY 2025-2026 classes follow is not stated in any of the three documents** (L6, L19).

| Item | IT 202 | IE-402 | CpE 304 |
|---|---|---|---|
| Campus header | Valenzuela St., Capitol View Park Subdivision, Bulihan, City of Malolos, Bulacan | (formerly University of Regina Carmeli) Catmon, City of Malolos | same as IT 202 |
| Form code | PRE-VPAA-FO-001 (011) | PRE-VPAA-FO-001 (011) | PRE-VPAA-FO-001(011) |

### 4.3 Vision, mission and EGAs

**Vision.** The text is identical in all three syllabi and differs from the system master.

| | Text |
|---|---|
| Approved syllabi | Moved by the Spirit of the Risen Christ, La Consolacion University Philippines, envisions itself to become a catalyst for the wholistic transformational development of Catholic Augustinian Marian graduates rooted in Gospel values. |
| System master | Moved by the Spirit of the Risen Christ, La Consolacion University Philippines, rooted in Gospel values as a Catholic Augustinian-Marian institution, envisions to become a catalyst for the holistic transformation of all persons and communities. |

**Mission lead.** The text is identical in all three syllabi and differs from the master.

| | Text |
|---|---|
| Approved syllabi | To achieve the above vision, LCUP commits itself to generate and make available to its Augustinian Marian students, programs and services that will make them: |
| System master | LCUP commits to generate and make available to all persons and communities’ programs and services that will enable them to: |

**Mission items**

| # | System master (5 items) | IT 202 and IE-402 (5 items) | CpE 304 (6 items) |
|---|---|---|---|
| 1 | exhibit academic and technical competence in their respective areas of discipline in the local and international environment; | same | same |
| 2 | demonstrate their knowledge, critical thinking and creativity by exploring the various avenues of learning and searching for truth; | same | same |
| 3 | manifest their willingness to serve specially the marginalized sector of our society; | same | live the Gospel values in the varied aspects of their personal and professional lives; |
| 4 | demonstrate productivity in various areas of learning as responsible citizens of the society; and | same | manifest their willingness to serve specially the marginalized sector of our society; |
| 5 | live the Gospel values in the varied aspects of their personal and professional lives. | same, without the final period | demonstrate productivity in various areas of learning as responsible citizens of the society; and |
| 6 | — | — | develop individuals who are resilient, inclusive and responsive to be socio-economic realities of the Philippines and the complexities of the global environment. |

**EGAs.** All three print exactly the four master names:
- "Critical and Creative thinker";
- "Competent Catholic Augustinian-Marian Professional";
- "Socially Responsive Steward";
- "Transformative Lifelong learner".

**Two import artifacts, not differences in the documents.**
- The importer's "Augustinian- Marian" for IT 202 and CpE 304 comes from the line break after the hyphen.
- Its EGA short names are copied from the full names (`src/lib/pdfImport.js:62`), so INST-EXACT fails on EGAs after an import.

### 4.4 Program Outcomes

| | IT 202 | IE-402 | CpE 304 |
|---|---|---|---|
| POs printed | 9 | 13 | 13 |
| Against the stored set | different list and numbering (2.2) | equal to the stored BSIE set, its transcription source | equal to the stored BSCpE set, its transcription source |
| Open points | L1 | PO 12 cut off; PO 11 ends "and;" (L2) | PO 12 cut off; PO 11 ends "and" (L2) |

### 4.5 CLO–PO and CLO–EGA mappings, exactly as printed

| CLO | IT 202 | IE-402 | CpE 304 |
|---|---|---|---|
| 1 | [EGA 1,3,4] [PO 1,2,3,6,8] | [EGA 1] [PO 1,3] | [EGA1, PO1, PO2, PO3, PO5] |
| 2 | [EGA 1,3,4] [PO 1,2,3,6,8] | [EGA 1] [PO 2,3, 4, 5] | [EGA2, PO6. PO7, PO12] |
| 3 | [EGA 1,2,3,4] [PO 1,2,3,4,6,8,9] | [EGA 1, 2] [PO 2, 3. 5, 6,7] | [EGA3, PO4, PO9] |
| 4 | [EGA 2] [PO 4,5] | [EGA 2] [PO 4,5] | [EGA 4, PO11, PO13] |
| CLO–PO tags | 19 | 13 | 11 |
| CLO–EGA tags | 11 | 5 | 4 |
| Captured by the importer | all | all | **4 of 11 PO tags** (PO1, PO6, PO4, PO11); all EGA tags |

**Reading notes for faculty confirmation (F10)**
- "PO6. PO7" (CpE 304) and "3. 5" (IE-402) are read as two separate POs.
- IT 202's and IE-402's CLO 4 have the same statement ("Demonstrate the Filipino-Catholic Augustinian Spirituality through value webbing.") and the same tags ("[EGA 2] [PO 4,5]"). But PO 4 and PO 5 name different outcomes in the two lists:
  - **IT list:** "Act in recognition of professional, social ethical responsibility;" and "Preserve and promote “Filipino historical and cultural heritage;".
  - **Engineering list:** "Ability to function on multidisciplinary teams" and "Ability to identify; formulate, and solve complex engineering problems;" (F5).

### 4.6 Weekly learning plan

**How to read these tables**
- Each lists the rows as printed: week label, ILO labels with their CLO tags, and whether a core value is named.
- A core value is one of Compassion, Courage, Community-orientedness, Humility, Interiority or Missionary Spirit (`engine.js:26`).
- Exam rows are not checked for values. For lesson rows that name no core value, every listed value is quoted.

**IT 202** (13 rows: 10 lessons, 3 exams)

| Week (as printed) | ILOs and tags (as printed) | Core value named |
|---|---|---|
| Week1 | ILO 1: [CLO1] | Compassion, Courage |
| Week 2 | LO1. [CLO 1] | Courage, Humility |
| Week 3-4 | ILO1: [CLO 1,2]; ILO2: (CLO 2] [CLO 3] | Interiority, Courage |
| Week 4-5 | ILO 1: [CLO 1] [CLO 2]; **ILO 2 (no tag)**; ILO4: [CLO 3] | **none**: Understanding, Exactness, Patience, Critical Thinking, Active participation and involvement, Critical Thinking, Patience, Appreciation |
| Week 6 | PRELIM EXAMINATION | (exam) |
| Week 7-8 | ILO3: [CLO 1] [CLO3]; ILO4: [CLO 2] [CLO3] | Humility, Courage |
| Week 9-11 | ILO1: CLO1 CLO2, CLO3; **ILO2. (no tag)** | Humility |
| Week 12 | MIDTERM EXAMINATION | (exam) |
| Week 13 | ILO4: [CLO1] [CLO2]; **ILO6: (no tag)** | Compassion |
| Week 14 | ILO1: [CLO 1-2]; LO2: [CLO2-3] | Humility, Courage |
| Week 15 | ILO4: [CLO1-2]; ILO5: [CLO 1-2]; ILO6: [CLO2-3] | Interiority, Courage |
| Week 16-17 | ILO1 [CLO 2-3]; then an unlabelled, untagged sentence: "Demonstrate the Filipino-Catholic Augustinian Spirituality through value webbing." | Courage |
| Week 18 | FINALS EXAMINATION | (exam) |

- **Week 4 appears in two rows** ("Week 3-4" and "Week 4-5"). This gives WEEK-DUP (blocking) and H-04 (minor).
- **Three labelled ILOs carry no CLO tag,** and the value-webbing sentence has none either.
  - The importer detects two of them: "ILO2." and "ILO6:".
  - It merges "ILO 2 Acquire…", which has no colon, into the ILO before it (5.6).
- **CLO4 is built by no ILO.** This gives P-05 and A-02 (major).
- **Read inclusively, the 19 labelled ILOs carry 30 ILO–CLO tags.** Each range, such as "CLO 1-2", is read as both CLOs. The importer reads a range as its first CLO only.
- **ILO labels restart in most rows.** "LO1." and "LO2:" lack the I. Course-content numerals run I, II, III, IV, V, XI, X, XIII, XII, X.
- **Week 15's machine problem reads "Hands-on exercises using C programs"** in a Java course (F4).

**IE-402** (9 rows: 6 lessons, 3 exams)

| Week (as printed) | ILOs and tags (as printed) | Core value named |
|---|---|---|
| Week 1 | ILO10: [CLO 4] | Interiority |
| Week 2-3 | ILO1: [CLO 1], [CLO 2]; ILO2: [CLO 1], [CLO 2] | Courage and Humility |
| WEEK 4 | PRELIMINARY EXAM, tagged "[ILO 1], [ILO 2]" | (exam) |
| WEEK 5-8 | ILO3: [CLO1][CLO2]; ILO4: [CLO2][CLO3]; ILO5: [CLO2][CLO3] | **none**: Understanding and patience in learning, Creative and critical thinking, Analytical thinking, Good and active participation and involvement, Appreciation, Effective and efficient management of resources, Problem solving skills |
| WEEK 9 | MIDTERM EXAM, tagged "[ILO 3], [ILO 4] [ILO5]" | (exam) |
| Week 10-11 | ILO6:, ILO7:, ILO8:, each [CLO 3] [CLO4] | **none**: the same seven values as weeks 5-8 |
| Week 12-14 | ILO9:, ILO10:, each [CLO 3] [CLO4] | **none**: Active participation and involvement (twice), Critical Thinking, Patience, Understanding, Critical Analysis, Logical Thinking |
| Week 15-17 | ILO11:, ILO 12:, ILO 13:, ILO14:, each [CLO 3] [CLO4] | **none**: Skills and Competencies, Critical Thinking, Honesty |
| Week 18 | FINAL EXAMINATION, tagged "[CLO 3] [CLO 4]" | (exam) |

- **The plan is complete:** weeks 1–18, with no overlap.
- **Every one of the 15 labelled ILOs carries tags,** 29 in all.
- **ILO10 names two different outcomes:** the week 1 value webbing, and the week 12-14 "Evaluate essential management considerations…" (F6).
- **CLO 4, the value-webbing CLO,** is tagged by every technical ILO from week 10 (ILO6–ILO14) and by the final exam row (F5).
- **Four of six lesson weeks name no core value.**

**CpE 304** (11 rows: 8 lessons, 3 exams)

| Week (as printed) | ILOs and tags (as printed) | Core value named |
|---|---|---|
| Week 1 | **no ILO** (the row holds "I.ORIENTATION" content) | **none**: Understanding, Open Mindedness, Respect, Obedience |
| Week 2-3 | ILO1: [CLO1]; ILO2: [CLO1] | **none**: Cooperation, Understanding, Critical Thinking, Active participation and involvement |
| Week 4-5 | ILO1: …[CLO1, CLO2]; ILO2: ….[CLO1, CLO2] | **none**: the same four |
| Week 6 | Preliminary Examination. Its content reads "Examination on the topics discussed during the Mid Term" | (exam) |
| Week 7-8 | **ILO1:, ILO6:, ILO10: (no tags)** | **none**: the same four |
| Week 9-11 | **ILO4:, ILO7:, ILO10: (no tags)** | **none**: the same four |
| Week 12 | Midterm Examination. The values and assessment cells appear swapped | (exam) |
| Week 13-14 | **ILO8:, ILO10: (no tags)** | **none**: the same four |
| Week 15-16 | **ILO8: (no tag)** | **none**: the same four |
| Week 17 | **ILO9:, ILO10: (no tags)** | **none**: the same four |
| Week 18 | Final Examination | (exam) |

- **Week 1 has no ILO.** This gives ILO-MISSING (blocking).
- **From week 7 to week 17, none of the 11 ILOs carries a CLO tag.** This gives T-13 and ILO-MAP (blocking). Only 6 ILO–CLO tags exist in the whole plan.
- **CLO3 and CLO4 are built by no ILO.** This gives P-05 and A-02 (major).
- **No lesson week names a core value** (8 of 8).
- **ILO labels repeat and skip.**
  - ILO1 and ILO2 are reused with different texts.
  - Week 4-5's ILO2 text reappears as ILO4 in weeks 9-11, and ILO8 is used twice.
  - The value-webbing ILO10 appears in four rows (weeks 7-8, 9-11, 13-14 and 17).
  - ILO3 and ILO5 do not appear.

### 4.7 Requirements, references and grading

| | IT 202 | IE-402 | CpE 304 | System form |
|---|---|---|---|---|
| Content heading | COURSE CONTENTS | COURSE CONTENTS | LEARNING CONTENTS | — |
| Course requirements | 5: Class attendance, Recitations, Quizzes, Examinations, Machine Problem : Laboratory Exercises | 5: …, Compilation of activity reports | 6: …, Compilation of Laboratory Activity Reports, Project | numbered by the form; a typed number triggers T-20 (minor) |
| Reference groups | A. BOOKS (3), B. INTERNET REFERENCES (5), C. JOURNALS (3), D. ELECTRONICS (2) | A. BOOKS (3), B. INTERNET REFERENCES (1), C. JOURNALS (3) | A. INTERNET REFERENCES: (4 arXiv items, years 2020, 2023, 2020, 2013) | A Books, B Internet Programming, C Internet References, D Electronics (`standard-v4.json:40-45`); the importer files Journals under C (`src/lib/pdfImport.js:41`) |
| Grading | Class Standing 60%, Examination 40%; Term Grade CS (60%) + TE (40%); Final Rating (Prelim + Midterm + Final) / 3 | the same | the same, but item "4." is empty and the Final Rating is numbered 5 | — |

**Items for the faculty, the Dean or the LIC (F7, F9)**
- **IE-402's references are titles about computing:** "Ethics in information technology: a practical guide", "Future skills…", "Introduction to digital media", an MIT OpenCourseWare course "Introduction to Design Computing", and three computing journal articles. Whether they support Systems Engineering is for the Faculty and the LIC Director, who certified them.
- **CpE 304 lists laboratory reports and a project** for a course of 3 lecture units.
- **CpE 304's 2013 preprint** is twelve years before SY 2025-2026. The legacy reference-age rule R-03 (10 years) is excluded from the hybrid engine, so the checker does not flag it.

### 4.8 What the checker makes of them (offline probe)

**Method** (details in the appendix)
- The application's importer read each PDF into a draft that already carried its catalog subject, as the builder does after a subject is chosen.
- `engine.coded` then ran against the database masters.
- **Scenario A** is the import as it stands.
- **Scenario C** adds the units and year level from the reference, the system's master outcomes and the stored prerequisite. It is the closest a builder author gets to the printed document.

| Finding | Severity | IT 202 | IE-402 | CpE 304 | Cause |
|---|---|---|---|---|---|
| T-21 reference group empty and not marked N/A | blocking | B | B, D | A, B, D | form edition (L16) |
| T-13 / ILO-MAP: ILO without a CLO tag | blocking | 2 (3 in the PDF) | — | 11 | document (L18) |
| WEEK-DUP: a week in two rows | blocking | week 4 | — | — | document |
| ILO-MISSING: lesson week without an ILO | blocking | — | — | week 1 | document (L18) |
| INST-EXACT vision, mission, EGAs (A only) | blocking | fail | fail | fail | text version (L15), plus the EGA short-name import artifact |
| PO-EXACT (A only) | blocking | fail: 9 against 10 | pass (circular) | pass (circular) | L1, L2 |
| T-06 / CUR-FIELD units and year level (A only) | blocking | lecture, lab, year level blank | lab blank ("3 units" read as 3 / blank), year level blank | lecture, lab, year level blank | the builder does not pre-fill (R9); the importer parses only "N units" |
| CUR-FIELD prerequisite (A only) | blocking | pass | "4 Year Standing" against "4th Yr" | pass | wording (L20); superscript lost on import |
| VALUE: no core value in a lesson week | −1 each | week 4-5 | weeks 5-8, 10-11, 12-14, 15-17 | all 8 lesson weeks | L17 |
| P-05 / A-02: CLO not built / not assessed | major | CLO 4 | — | CLO 3, CLO 4 | document (L18) |
| H-04 week overlap | minor | week 4 | — | — | document |
| T-20 typed requirement numbers | minor | 5 | 5 | 6 | import artifact |
| Base score of the 44 rules (A / C) | — | 93 / 96 | 96 / 99 | 90 / 93 | — |
| Published score | — | none: blocking findings, and no AI check | none | none | — |

**Code and title as printed** (scenarios D and E, which a builder author cannot reach):
- CpE 304 with the code "CpE 304" is a CRITICAL MISMATCH, so the score is 0.
- The printed titles fail the exact title policy for all three. Under the normalized policy, IE-402 and CpE 304 pass and IT 202 still fails.

**Score.** The base scores stay above 79. What withholds a score is the blocking findings, and the AI check that has not been run (`engine.js:429-437,453`).

---

## Part 5 — Deterministic matching risks

Each risk is described under the six points the brief asked for:
1. current behaviour;
2. expected behaviour once the reference is confirmed;
3. false rejection or false approval;
4. minimal correction;
5. regression tests;
6. effect on official scoring.

### 5.1 Course codes with spaces or hyphens

1. **Current behaviour.**
   - **Checker.** CUR-CODE compares codes after trimming, collapsing spaces and upper-casing (`engine.js:34,71`). A hyphen is not a space.
     - Not found: "CRITICAL MISMATCH: Course Code … does not exist in the official … curriculum." (`engine.js:75`).
     - The score is 0 (`engine.js:436,453`), and the submit gate returns 409 with score 0 (`compliance/service.js:39`).
   - **Builder.** The author never types the code.
     - Choosing a subject copies the catalog code (`syllabusModel.js:126`), and every save copies it again (`syllabusContent.js:65`).
     - The catalog code equals the reference code (first audit 2.1), so the approved CpE 304 syllabus is checked as "CpE-304" and passes (probe C).
   - **Importer.** It ignores every non-alphanumeric character when comparing codes (`src/lib/pdfImport.js:66-67`). So "CpE 304" equals "CpE-304", and so do BSIT "IT 202" and Cyber Security "IT-202" (3.4).
   - **Where a typed code still reaches the checker:**
     - paths that bypass the catalog, such as the offline harnesses (probe D: CpE 304 scores 0);
     - any future checking of an uploaded PDF against the curriculum, which `server/lib/compliance/upload.js` says is not done yet.
2. **Expected behaviour.**
   - Once L8 and L20 settle the official form, the registrar's code is the identity.
   - A syllabus that prints another punctuation is the same course only if it matches exactly one course of the selected curriculum and the titles agree.
3. **False rejection or false approval.**
   - **False rejection:** a typed or imported "CpE 304" scores 0. This is not reachable in the builder today.
   - **False approval:** BSIT IT 202 content imported into Cyber Security IT-202 gets only a passive title warning, then passes the identity checks.
4. **Minimal correction.**
   - No checker change now. Keep R4's design for when a typed or imported code reaches the checker.
   - In the importer, make the title warning a confirmation naming both titles (R17).
5. **Regression tests:**
   - a save with a typed "CpE 304" and subject 182 stores "CpE-304" (route test, mocked database);
   - "CpE 304" under BSCpE is CRITICAL (pinned until R4 is decided);
   - importing "CpE 304" into CpE-304 gives no mismatch;
   - importing "IT 202" into Cyber Security IT-202 shows the title warning, or the confirmation once R17 exists;
   - the existing T4 isolation test.
6. **Effect on official scoring.**
   - R4 would turn a score of 0 into a withheld score or a pass, so it needs approval.
   - R17 does not touch scoring.

### 5.2 Curriculum-year formatting

1. **Current behaviour.**
   - The field is free text labelled "Curriculum year", with the placeholder "For example, 2022-2023" (`InfoStep.jsx:42`, `src/i18n/hybrid.js:87-88`).
   - CUR-REF keeps approved references whose year equals the typed year exactly, and a blank year selects the program's single reference (`engine.js:65`).
   - Otherwise CUR-REF is NOT_EVALUATED (blocking), with "Official approved curriculum unavailable for {program}. Submission is blocked until it is supplied." (`engine.js:67`), and CUR-CODE is NOT_EVALUATED.
   - **The approved syllabi print "SCHOOL YEAR 2025-2026".** An author who copies it into the field finds no BSIT, BSIE or BSCpE curriculum. For Cyber Security, 2025-2026 happens to be its curriculum year.
   - The importer does not set the year, so an imported draft keeps it blank, which works.
2. **Expected behaviour.** After L19 and L13, the field names a curriculum version, chosen from the program's approved references. A school year, if the form needs one, is a separate field.
3. **False rejection or false approval.**
   - **False rejection:** the school year, "2022 - 2023" as the registrar prints it, an en dash, or "SY 2022-2023". Each is reported as a missing curriculum, not as a typing difference.
   - **False approval:** none found. The risk is different: if L5 or L6 says a cohort follows another version, the only stored version is used without warning.
4. **Minimal correction (R2).**
   - Prefer a choice among the program's approved years, with blank meaning the single one. This is UI only and removes the failure at its source.
   - Reword the message to say "year not recognised" and list the available years.
   - Normalising typed variants would be a gate change instead.
5. **Regression tests (extend T3):**
   - an exact year, a blank year, "2022 - 2023", an en dash, and "2025-2026" for BSIT;
   - Cyber Security with "2025-2026";
   - the message wording;
   - after R2, stored drafts that hold a free-text year still resolve.
6. **Effect on official scoring.**
   - CUR-REF decides whether a score can be published, not the number.
   - The choice list changes only the input. Normalisation changes what the gate accepts, so it needs approval.

### 5.3 Course-title spelling

1. **Current behaviour.**
   - CUR-FIELD compares titles under the title policy (`engine.js:81`). The default, `shadow`, makes the exact comparison official (`titles.js:39-45`).
   - `normalized`, which is not active, would forgive case, spacing, zero-width characters and Unicode form (`titles.js:12`).
   - In the builder, the title is copied from the catalog on every save. Differences arise only:
     - if the catalog and the reference diverge;
     - for a draft saved before a catalog change and submitted unchanged, because the submit checks the saved identity before `applyCatalog` (`syllabusContent.js:282-288`);
     - outside the builder.
   - The importer keeps the catalog title and warns when the printed one differs (IT 202 only; `src/lib/pdfImport.js:69`).
2. **Expected behaviour.** The curriculum title, as settled under L7 and L20, is the identity. A syllabus may print it in another letter case if L20 allows.
3. **False rejection or false approval.**
   - **False rejection:** none in the builder. Outside it, all three printed titles fail the exact policy, and "Computer Programming 1" fails both policies.
   - **False approval:** the replacement offered turns a wrong title into the official one without any change to the content (first audit F5).
4. **Minimal correction.**
   - R1 must change the catalog subject title in the same change as the reference (R23). Otherwise every syllabus of that subject fails.
   - Activating the normalized policy follows `docs/title-policy-activation.md` and needs approval.
5. **Regression tests:**
   - the catalog title equals the reference title for all 243 subjects (read-only verification script, beside T8);
   - the three printed titles under both policies;
   - a save copies the title.
6. **Effect on official scoring.**
   - A title failure is blocking: it withholds the score.
   - Policy activation, and any reference title change, alter what passes.

### 5.4 Blank prerequisite fields

1. **Current behaviour.**
   - A blank prerequisite cell is stored as the sentence "Not specified in the source curriculum (blank prerequisite cell)." with `rawPrerequisite` "" (83 cells, first audit A11).
   - CUR-FIELD compares the prerequisite exactly, without trimming (`engine.js:82`).
   - T-05, one of the 47 rules, requires a non-empty field (blocking; `standard-v4.json:77`).
   - **So the author must type that sentence.** "None", "N/A", "-" and a blank field all fail.
   - None of the three approved syllabi has a blank prerequisite. But IE-402 prints "4th Year Standing" against "4th Yr", and that fails.
   - The importer overwrites the prerequisite with the PDF's value (`src/lib/pdfImport.js:70`), and loses the superscript ("4 Year Standing").
   - Both MA 7 subjects have a blank cell.
2. **Expected behaviour.** L10 gives the agreed wording for "no prerequisite", and L20 says whether an equivalent wording is accepted.
3. **False rejection or false approval.**
   - **False rejection:** an MA 7 syllabus that says "None", and the approved IE-402 syllabus.
   - **False approval:** none (the comparison is strict).
4. **Minimal correction.**
   - R9: pre-fill the prerequisite from the reference.
   - R3: an accepted-wording list, decided by the institution. For equivalents such as "4th Yr", use a short list approved by the registrar, never fuzzy matching.
   - In the importer, keep the reference value and show the PDF's as a difference (R15).
5. **Regression tests:**
   - a blank-cell subject with the sentence, "None", "N/A", a blank field and a trailing space;
   - IE-402 with "4th Year Standing" and with "4th Yr";
   - the importer's superscript case.
6. **Effect on official scoring.**
   - CUR-FIELD prerequisite is blocking.
   - T-05 changes only if the institution allows an empty field.

### 5.5 Incomplete academic references

This covers PO 12, BSIE MA 7's blank subject set, the missing BSIE and BSCpE PO–EGA links, the unsettled BSIT list (L1), the absent EGA descriptions (L14) and the missing registrar sign-off (F8).

1. **Current behaviour.**
   - **A missing master is reported as NOT_EVALUATED,** never as PASS or FAIL. This applies to CUR-REF, PO-MASTER and CLO-MAP without a master.
   - **An incomplete master is used as it is:**
     - PO 12's partial sentence goes to the AI;
     - P-03 passes when there are no links;
     - MA 7's blank copy makes new syllabi start blank;
     - EGA judgements see names only.
2. **Expected behaviour.** Once confirmed, the masters are complete texts with a recorded source and version, and links exist where the institution provides them.
3. **False rejection or false approval.**
   - **False rejection:**
     - a completed PO 12 fails PO-EXACT;
     - INSUFFICIENT_EVIDENCE on CpE 304's CLO2–PO12 pair withholds the score;
     - a new MA 7 syllabus is blank.
   - **False approval:**
     - P-03 passes for BSIE and BSCpE without checking anything;
     - a pair judged against a partial PO 12 may be scored as if the outcome were complete.
4. **Minimal correction.**
   - R19: carry the transcription's `sourceIncomplete` flag into the master and report pairs that use it as NOT_EVALUATED, rather than sending them to the AI.
   - R18: report P-03 as NOT_EVALUATED when the program has no links.
   - R7: refresh MA 7's copy.
   - R6: make corrections only as approved, versioned changes.
5. **Regression tests:**
   - T8, which fails today on BSIE MA 7: fix the data, not the test;
   - P-03 without links: pin today's pass, then switch to NOT_EVALUATED if approved;
   - a `sourceIncomplete` PO is flagged and never sent;
   - INSUFFICIENT_EVIDENCE stays blocking.
6. **Effect on official scoring.**
   - R18 changes the co_po area of the base score for BSIE and BSCpE.
   - R19 removes possible deductions and blocks.
   - R6 makes existing syllabi fail PO-EXACT until they are updated.
   - All three need approval.

### 5.6 Risks specific to the PDF importer

Importing is a convenience: the author reviews before saving, and the importer already shows review warnings (`creditsReview`, `outcomesReview`, `referencesReview`). These are its blind spots, found on the three approved syllabi:

| Behaviour | Code | Effect on the approved syllabi | Direction |
|---|---|---|---|
| Keeps only the first number of "PO1, PO2, PO3" lists (the pattern stops at the next "PO") | `src/lib/pdfImport.js:86` | CpE 304: 4 of 11 CLO–PO tags kept | false approval: unjudged pairs cost nothing |
| Splits ILOs only where a number is followed by ":" or "." | `:110-111` | IT 202 week 4-5: "ILO 2 Acquire…" (no tag) merged into ILO 1 | false approval: a blocking finding is missed |
| Reads "CLO 1-2" as CLO 1 only | `:114` | IT 202 weeks 14–16-17: six ranges cut to one CLO each | coverage findings may be wrong |
| Overwrites the prerequisite with the PDF's value | `:70` | IE-402 gets "4 Year Standing" | false rejection |
| Parses credits only as "N" or "N units", and then sets lab to blank | `:71-72` | IE-402 lab is blank; IT 202 and CpE 304 are not parsed | false rejection (T-06, CUR-FIELD) |
| Sets an EGA's short name to its full name | `:62` | INST-EXACT on EGAs fails for all three | false rejection |
| Keeps typed requirement numbers | `:124-129` | T-20 on every requirement | minor false findings |
| Replaces the vision, mission, EGAs and POs with the PDF's | `:57-63` | INST-EXACT for all three; PO-EXACT for IT 202. Accepting the PO replacement swaps texts under unchanged tags (2.3) | false rejection, then a silent change of meaning |
| Compares codes with every non-alphanumeric character removed | `:66-67` | BSIT IT 202 equals Cyber Security IT-202 | false approval path (3.4) |
| Files "JOURNALS" under C Internet References | `:41` | the approved four-group layout does not map | T-21 blocks on B (and D) |

---

## Part 6 — Recommended minimal corrections

Nothing here is implemented. † marks a change to what a gate or a deduction decides, and each needs explicit approval. The first audit's R1–R14 stand, as classified in 1.1. The new items are R15–R23.

| ID | Correction | Type | Waits on | Gate or score effect |
|---|---|---|---|---|
| R9 | Pre-fill units, year level, prerequisite and curriculum year from the approved reference; the author's edits stay visible as differences | UI | — | none. It removes most typed-field failures (5.2–5.4) |
| R2 (choice form) | The curriculum year as a choice among the program's approved years | UI | L19 | none (the input changes, the gate does not) |
| R15 | Importer parsing: "PO1, PO2" lists; CLO ranges; "ILO n" without a colon; "N units lecture / M unit laboratory"; strip typed requirement numbers; EGA short names from the master when names match; keep the reference prerequisite and show the PDF's as a difference | importer | — | none to the rules. The inputs become faithful to the document |
| R16 | PO replacement safety: when PO-EXACT's replacement would change the texts behind existing CLO tags, warn and ask the author to re-check the tags; never swap silently | UI | — | none. It prevents the silent change of meaning in 2.3 |
| R17 | On import, a confirmation naming both titles when they differ | UI | — | none |
| R23 | A read-only verification that every catalog code and title equals its reference row (beside T8); any R1 change updates both together | verification script | — | none |
| R7 | Refresh BSIE MA 7's standards from the BSIE program | data | authorization | none |
| R5 | The PO-inheritance link (dry-run, review, then apply) | migration | L4, after L1 | none today |
| R6 | PO corrections as approved, versioned changes, then a snapshot refresh and a transition notice | data | L1–L3 | † PO-EXACT for existing syllabi |
| R18 † | Report P-03 as NOT_EVALUATED when a program has no PO–EGA links | checker reporting | approval | † base score (co_po) for BSIE and BSCpE |
| R19 † | Carry `sourceIncomplete` into the masters; pairs using an incomplete PO become NOT_EVALUATED instead of an AI judgement | data and checker | L2 (until answered) | † deductions and blocks |
| R20 † | Bring the form's reference groups, and any other template element L16 decides, into line with the current edition of PRE-VPAA-FO-001 | `standard-v4.json` (T-21, one of the 47) | L16 | † T-21 |
| R21 † | Apply the core-value and ILO-completeness policy as decided | VALUE (hybrid deduction); T-13, P-05, A-02 (47 rules) | L17, L18 | † deductions and blocking |
| R2 (normalisation), R3, R4 † | As in the first audit, only after their decisions | checker | L8, L10, L19, L20 | † |
| R22 | The isolated approved-syllabus evaluation (Part 9) | evaluation | L21, and approvals | none |

**What not to do**
- Do not edit an approved reference or PO in place.
- Do not complete PO 12, merge the two BSIT lists, or infer PO–EGA links.
- Do not normalise titles or codes that differ in substance.
- Do not relax the CLO-tagging, core-value or reference-group checks merely so that the approved syllabi pass. That waits for L16–L18.

---

## Part 7 — Risk assessment for official scoring

**How a score is made today** (`engine.js:429-453`, `policy.js`)
- The base score of the 44 hybrid-applied rules, minus deductions:
  - −1 for each lesson week without a core value;
  - −2 for each failing reference link;
  - −3 for NOT_ALIGNED, and −1 for PARTIALLY_ALIGNED, on the scored relationship types (CLO-PO, CLO-EGA, ILO-CLO, Module-value).
- A CRITICAL identity mismatch sets the score to 0.
- Any blocking finding, including an AI check not yet completed and INSUFFICIENT_EVIDENCE on a scored type, withholds the score (null).
- `passed` requires a published score of at least 79.
- The AI gate is `advisory` by default: the AI never blocks a submit or an approval (`policy.js:15-21`). Its scored judgements still shape the number.

| Risk | Today | If left alone | Affected by | Severity |
|---|---|---|---|---|
| IT 202-style PO renumbering (2.3) | CLO-MAP passes; the replacement swaps texts silently | With the AI stage on, up to 3 points per tag are deducted for relationships the author never made. 19 tags could cost up to 57 points: a pass can become a fail | L1, R16 | **high** (validity and pass/fail) |
| PO 12 cut off | Pairs are judged on a partial sentence | INSUFFICIENT_EVIDENCE withholds the score; NOT_ALIGNED and PARTIALLY_ALIGNED deduct | L2, R19 | medium |
| Importer under-capture (CpE 304: 7 of 11 tags dropped) | unjudged pairs cost nothing | an inflated score for imported drafts | R15 | medium (false approval) |
| P-03 vacuous for BSIE and BSCpE | always passes | an inflated co_po area | R18 | low to medium |
| Year typed as the school year | blocked as "unavailable" | the score is withheld for a typing reason | R2, R9 | medium (false rejection; easy to trigger, given the approved form) |
| Prerequisite wording ("4th Year Standing") | blocked | the score is withheld | R3, R9, L20 | low to medium |
| Code punctuation typed outside the builder | CRITICAL, score 0 | only in harnesses or future upload matching | R4 | low today |
| A reference title changed without the catalog | every syllabus of that subject blocked | the score is withheld | R1, R23 | medium (during corrections) |
| PO correction transition (R6) | — | every existing syllabus fails PO-EXACT until updated | R6 plan | medium (temporary; plan it) |
| Core-value policy | −1 per lesson week | the approved syllabi lose 1, 4 and 8 points | L17, R21 | policy question |
| Reference-group template | T-21 blocks the approved form's layout | withheld until marked N/A | L16, R20 | low (workaround exists) |

**Conclusions**
- No proposal touches the formula or the mark of 79. The items marked † change what passes, and each needs approval with its tests in place first.
- **The approved syllabi should calibrate format and identity handling, not content rules.** A false rejection caused by reference groups, year format or wording is a checker problem. A missing CLO tag or a missing core value is a policy question (L17, L18), and the answer must come from the institution, not from the wish to make the approved documents pass.

---

## Part 8 — Regression-test requirements

**General requirements**
- **Where:** new offline test files beside the existing ones, run one at a time with `node --test <file>`. **Never `npm test`**, which rewrites `docs/faculty-review/phase3`.
- **Fixtures:** structural and synthetic only, meaning codes, numbers, tag shapes and layout tokens such as "ILO 2 Acquire…", "[EGA1, PO1, PO2]", "CLO 1-2", "4th" and "3 units lecture". **No faculty prose.**
- **The PDFs:** new tests must not read the PDFs. They are untracked, real documents.
- **Database checks** belong in read-only verification scripts, not in unit tests.

| Test | Pins |
|---|---|
| T1–T9 | as in the first audit (printed anomalies, term totals, reference selection, cross-program isolation, PO selection, missing versus violation, no auto-approval, subject standards against program POs, the Summer term) |
| T10 | Builder identity: a save copies the catalog code and title over typed values (route test, mocked database) |
| T11 | Curriculum-year variants: exact, blank, "2022 - 2023", en dash, school year; the message wording. Pin today, update with R2 |
| T12 | Prerequisite: the blank-cell sentence, "None", "N/A", blank, trailing space; "4th Year Standing" against "4th Yr" |
| T13 | The three printed titles under the exact and normalized policies |
| T14 | Code variants: "CpE 304" CRITICAL (pinned until R4); importer equivalence; IT 202 into Cyber Security IT-202 gives a warning, or the confirmation after R17 |
| T15 | PO numbering safety: the same tags under a 9-item and a 10-item master; the replacement warning (after R16) |
| T16 | Importer parsing (R15): "PO1, PO2, PO3"; "PO6. PO7"; "3. 5"; ranges; "ILO 2" without a colon; "LO1."; units strings; superscript "th"; typed requirement numbers; the "Augustinian- Marian" line break; the four-group reference layout with Journals |
| T17 | P-03 without links: pin the pass today, then NOT_EVALUATED if R18 is approved |
| T18 | A `sourceIncomplete` PO is flagged and never sent to the AI (after R19) |
| T19 | Read-only verification: every subject's standards equal its program's (T8), and catalog code and title equal the reference (R23). It fails today on BSIE MA 7, and the data must be fixed, not the check |
| T20 | Inheritance link (mocked database, no migration): the code stays Cyber Security's; POs, EGAs and versions come from BSIT; edits are refused; the drift alarm sounds before the link |
| T21 | Scoring invariants: CRITICAL gives 0; blocking gives null; an incomplete AI check gives null; the exam-row exemption from VALUE; the 79 threshold. Confirm the existing coverage and add what is missing |
| T22 | VALUE and ILO-completeness behaviour pinned as today, so that any R21 change is visible in a diff |

---

## Part 9 — Proposed approved-syllabus evaluation plan (design only)

**Name and isolation**
- Call it "lcup-approved-1". It is separate from align-1, P3–P5, Faculty Packages V1 and V2, and the lcup-1 synthetic design (first audit 9.2).
- New folders when authorized, for example `server/lib/syllabuscheck/eval/lcup-approved-1/` and `docs/ai-eval-lcup-approved-1/`.
- Nothing is written into any existing dataset, result or held-out log.

**Inputs**
- The three PDFs, read on this computer by a new offline loader.
- **Do not use `realSyllabi.js` or `live-pipeline-eval.cjs`.**
  - `realSyllabi.js` uses each PDF's own vision and mission as the institution master, and the IT 202 PDF's nine POs as the BSIT master (`realSyllabi.js:48-52`). It also takes the printed title (`:31`) and sets `synthetic: false`.
  - It therefore makes INST-EXACT and PO-EXACT pass by construction, and it does not measure what the production checker does.
- The new loader must take the masters from the database, read-only, or from a frozen export of them. It records the master versions.

**Layer 1 — Objective curriculum-compliance checks** (deterministic, offline, no AI)
- **What is checked:**
  - identity (code, title, units, prerequisite, year level) against the reference;
  - vision, mission, EGAs and POs against the masters;
  - plan structure (weeks 1–18, overlaps, exam rows per term);
  - presence of an ILO in each lesson week, and of CLO tags;
  - reference groups, and grading totals.
- **Each expected outcome is one of two kinds.**
  - **Rule-expected:** derived from the document and the rule text, so anyone can verify it. Example: IT 202 has week 4 in two rows, so WEEK-DUP is expected.
  - **Policy-dependent:** the expected result depends on a pending decision. Examples:
    - T-21 under the current template is FAIL, and under the approved form's groups (if L16 says so) is PASS;
    - VALUE depends on L17;
    - PO-EXACT for IT 202 depends on L1.
- **Policy-dependent items are reported separately** and stay "pending" until the decision is recorded.
- **Correct handling of the documents' own gaps counts as a true positive.** Examples: the untagged ILOs, and the missing ILO in CpE 304 week 1. The VPAA approval does not turn them into false rejections. Only a decision under L18 could.

**Layer 2 — Semantic alignment checks** (the relationships as printed, not as imported)

| Relationship | IT 202 | IE-402 | CpE 304 | Total |
|---|---|---|---|---|
| CLO–PO | 19 | 13 | 11 | 43 |
| CLO–EGA | 11 | 5 | 4 | 20 |
| ILO–CLO (ranges read inclusively) | 30 | 29 | 6 | 65 |
| Module–value (lesson weeks) | 10 | 6 | 8 | 24 |

- **Expected judgements: blank until faculty adjudicate.** VPAA approval of a document establishes no expected label: not ALIGNED, and not any other.
- **Some items need a decision first:**
  - IT 202's CLO–PO pairs need L1 and F1. Until then, keep two readings, as approved and as stored, as separate, clearly labelled items, or hold them back.
  - CpE 304's CLO2–PO12 pair needs L2.

**Layer 3 — Faculty-reviewed expected judgements**
- **Reviewers.** Faculty of the discipline (IT, IE, CpE) other than each syllabus's author, with the Dean as tiebreaker. The authors may annotate intent, for example the CLO they meant for an untagged ILO. That annotation is recorded as the author's intent, not as a change to the approved document.
- **The record.** Each label is recorded with the reviewer's role and the date. Disagreements are kept, and no majority vote is presented as an institutional decision.
- **Format.** A form like Faculty Package V2's, but separate. The V1 and V2 packages are not reused or modified.
- **Which expected judgements still require faculty review: all of Layer 2,** that is 43 CLO–PO, 20 CLO–EGA, 65 ILO–CLO and 24 Module–value relationships. Also the faculty questions F1–F10.

**Layer 4 — Controlled synthetic-error tests**
- **Deterministic errors, offline.**
  - Start from the frozen structure of each approved syllabus and inject one known error per variant. Examples:
    - code punctuation, the year typed as the school year, a prerequisite variant;
    - swapped PO numbering, a removed CLO tag, a duplicated week, a removed exam row;
    - a lesson week without a core value, an empty reference group, a grading total of 90.
  - The expected rule finding follows from the rule, by construction. Each variant is labelled synthetic.
- **Semantic errors.** Use fully synthetic texts (the lcup-1 design), never the approved prose. Only an egregious mismatch, such as a CLO tagged to an unrelated PO, gets an expected label by construction, and that label is marked "synthetic, not faculty".

**Privacy, cost and contamination**
- **No AI or paid call without two separate approvals:**
  1. institutional consent to send faculty-authored text to an external provider (L21), with names and the sign-off block removed;
  2. the user's approval of a pre-registered plan with a cost cap. Cost estimates are not spending limits.
- **Until then, only Layer 1 and the deterministic part of Layer 4 run.**
- **The approved syllabi become test-only material.**
  - Their text must never be used in prompt work.
  - Before freezing, a contamination check compares them with the 100 align-1 items (58 dev, 42 held-out). It prints only ids and scores, so the 42 held-out items stay unseen.

**Metrics**
- **Layer 1:** per rule, expected against actual. False rejections are split into format and identity causes against content causes.
- **Layers 2–3** (later, if approved): agreement with faculty, false approvals, false rejections and the INSUFFICIENT_EVIDENCE rate, per program and per relationship type.

**What the evaluation must not claim**
- That the approved syllabi are correct in every respect.
- That the AI agrees or disagrees with the VPAA.
- That any synthetic or provisional label is a faculty or institutional judgement.

---

## Part 10 — Recommended implementation order

0. **Now.** Review this report. Send the decision document to the academic authorities. This is the user's action; nothing is sent by the system.
1. **No decision needed, no gate change** (each step separately authorized):
   1. Tests that pin today's behaviour: T10, T11, T12, T13, T14 (pinned), T16 (structural fixtures), T17 (pinned), T19 (read-only script), T20, T21 and T22.
   2. R9 pre-fill, and R2 in its choice form.
   3. R15 importer parsing, R16 the PO-replacement warning, R17 the import title confirmation.
   4. R23 catalog–reference verification.
2. **Data, with separate authorization:**
   - R7, the MA 7 refresh, after approval to inspect the MA 7 syllabus in `for_revision`;
   - R12, the canonical image folder and hash manifest.
3. **After decisions L1–L4 and L15–L20:**
   1. R6: versioned PO corrections, then the snapshot refresh and a transition notice to faculty.
   2. R5: link dry-run, review, then apply.
   3. R1 and R8: reference versions and the registrar sign-off.
   4. R20 and R21: template and policy alignment, only as decided.
4. **Gate changes, each with its own approval and the tests above already in place:**
   - R2 normalisation, if the choice list is not enough;
   - R3, R4, R18 and R19;
   - title-policy activation.
5. **Evaluation:**
   1. lcup-approved-1 Layer 1 and deterministic Layer 4, offline.
   2. Faculty adjudication of Layer 2.
   3. Any AI run only after L21 consent and a separately approved, capped plan.
   4. R14 (lcup-1) and R10 (Stage A) on their own evaluations.

---

## Appendix — How this follow-up stayed read-only

**The three PDFs**
- Read on this computer only.
- Text was extracted with the repository's pdfjs-dist, and pages were rendered to PNG with @napi-rs/canvas (scale 1.6) in the session scratchpad, then viewed locally.
- Nothing was sent to any provider or service.

**Database**
- Local MariaDB 10.4.32, in a read-only session (`SET SESSION TRANSACTION READ ONLY`, then `START TRANSACTION READ ONLY`, rolled back).
- Reads used the application's own SELECT functions (`loadOutcomes`, `loadCourse`, `mastersFor`) and plain SELECT queries.
- No syllabus content was read.
- No migration was run, not even the dry-run. The migration's comparison was reproduced read-only.

**`server/.env`**
- Read only through `dotenv.parse` inside the probe, which copied the four database connection variables into the process.
- Nothing from it was printed.

**Probe scenarios** (offline, against the database masters)
- **A:** the PDF imported into a draft carrying its catalog subject.
- **B:** A, plus the units and year level from the reference.
- **C:** B, plus the master outcomes and the stored prerequisite.
- **D:** C, with the code as printed.
- **E:** C, with the title as printed, under both title policies.
- **F:** C, with the prerequisite as printed.

**Network.** Every script ran with a preload that blocks and logs non-local connections. No attempt was logged. No AI provider was called, and nothing was paid for.

**Tests.** None were run. `npm test` was not run.

**Files**
- A SHA-256 snapshot of 805 files was taken before this follow-up and compared after these two documents were written.
- Coverage: `server/lib`, `server/db`, `server/routes`, `server/scripts`, `src`, `docs`, `scripts`, `tests`, `reference-data`, `server/.env` and the root configuration files.
- Result: 2 files added (this report and `docs/lcup-academic-decisions-for-vpaa.md`), 0 removed, 0 changed.
- `server/.env` is unchanged (SHA-256 begins `9e8eb0103c0aae56`).

**Scratch work.** Scripts, extracted text, page images and probe output are in the session scratchpad, not in the repository.
