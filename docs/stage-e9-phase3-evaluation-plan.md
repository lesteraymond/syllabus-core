# Stage E.9: Phase 3 evaluation plan — full 18-week syllabus validation

**Prepared, not run.**
- No paid call was made and nothing here has been implemented.
- Every step below needs your approval first. Each paid tranche has its own budget and is approved separately.
- Nothing in this plan changes the official score, the passing mark (79), deductions, readiness, the submission gates, a feature flag, a prompt (`alignment-10`, the D1/D2 `-r7` prompts, Stage C `r8`) or the provider guard and its retry policy. **No official academic enforcement is activated.** Stage switches are set only inside the evaluation process, as `scripts/live-pipeline-eval.cjs` already does.
- The `program_outcome_sources` migration stays unexecuted. It is a production dependency ([closeout, section 7](stage-e9-phase2-closeout.md#7-production-dependencies)).

This plan follows the [Phase 2 closeout](stage-e9-phase2-closeout.md). It replaces the whole-pipeline row of the E.2 [live evaluation plan](live-evaluation-plan.md), whose volume figures predate the batch-of-4 policy; that file is kept as history.

## Summary

| | |
|---|---|
| Aim | Validate the complete checker on whole 18-week syllabi for BSIT, BSIE, BSCpE and BSIT-Cyber Security. Use synthetic syllabi before any real submission, including fully populated syllabi whose relationships are deliberately wrong. |
| Layers | **A:** offline end to end, with controlled AI answers and fault injection. **B:** bounded live MiniMax runs on synthetic syllabi. **C:** faculty validation against the approved curricula. |
| New assets | A Cyber Security fixture; a misaligned variant of every program; a defect catalogue covering all 13 components; a ground-truth manifest; an oracle transport; a scorer; runner extensions; a whole-syllabus faculty export |
| Paid testing (B1–B6, synthetic) | About 544 requests before retries, 650–1,230 expected. **About $0.75 expected (range $0.41–2.28). Hard caps: 1,376 requests / $2.80 in all**, each tranche capped on its own. |
| First task | The Layer A harness, part 1 (section 12): offline only, no prompt or scoring change |

## 1. Goals and questions

Phase 3 answers these for complete syllabi:
1. **Detection.** With every stage on, does the pipeline flag each planted defect in a fully populated syllabus, per component?
2. **Restraint.** Does it leave the aligned syllabi and the untouched parts of the misaligned ones alone? Each false flag is counted per component.
3. **Evidence.** Are quotations exact and taken from the right fields? Do explanations state only what the syllabus says?
4. **Recommendations.**
   - Are they offered only for failing relationships, and are they grounded and free of contradictions?
   - Are they withheld when unsupported, in the right precedence order (upstream fields first)?
   - Is the right type chosen: re-tag or rewrite?
5. **Official invariance, live.** Is the official result (score, pass at 79, readiness) the same with the advisory stages on as with every stage off? See closeout section 3.
6. **The final report.** Does the advisory report (`verdict-1`) reflect the judgments faithfully?
   - every planted defect appears under the right rule;
   - nothing unchecked is shown as a pass;
   - every sentence exists in English and Tagalog.
7. **Operation.** Requests, retries, empty answers by endpoint, cost and time per syllabus.
8. **Academic validity (Layer C).** Do faculty agree with the expected judgments, and with the model's answers?

**Not in scope:** official enforcement, prompt or scoring changes, production activation of any stage, and real faculty submissions before consent (B7).

## 2. Starting point

| Existing asset | Where | Reused for | Gap |
|---|---|---|---|
| Representative 18-week syllabi: BSIT IT 202, BSIE IE-402, BSCpE CpE-304. The curriculum identity and outcomes are real; the plan is synthetic. Examinations fall in weeks 6, 12 and 18. | `server/lib/syllabuscheck/eval/programSyllabi.js` | The aligned base of three programs | No Cyber Security syllabus |
| Planted-defect variant: 7 errors (content, tag, activity, assessment, value named only, value without evidence, unrelated book) | `PLANTED` in `scripts/live-pipeline-eval.cjs` | Kept unchanged, for comparability | Covers 5 of 13 components, all of them obvious. The expectation is only "not ALIGNED": no expected label, field, responsible field or recommendation type. |
| Whole-pipeline runner: guard, ledger, stops, contradiction stop, free plan | `scripts/live-pipeline-eval.cjs` | Layer B | Always turns every stage on, so it cannot make the paired official run. It has none of: `--check-key`, endpoint diagnostics, a review pause between syllabi, or manifest scoring. |
| Definition of contradictory recommendations | `server/lib/syllabuscheck/eval/contradictions.js` | Every layer, as is | n/a |
| Offline whole-pipeline tests | `stage-e2.test.js` | Extended in Layer A | Stand-ins answer ALIGNED only |
| Advisory report and its translation audit | `verdict.js`, `scripts/audit-verdict-i18n.mjs` | Layers A and B | n/a |
| Real syllabi loader: three PDFs, untracked | `eval/realSyllabi.js` | B7 only, with consent | n/a |
| Faculty exports | `docs/faculty-review/`, `docs/academic-validation-package/` | Layer C | Per relationship only; the package is stale for Stage C |

## 3. Architecture

```text
 programSyllabi.js ─► phase3 fixtures (variants) ─► manifest (expected judgments, versioned, faculty-reviewable)
                                │                                  │
                                ▼                                  ▼
            engine.run (production code, unchanged) ◄── transport:  oracle + fault injection   (Layer A, offline)
                                │                                  guarded OpenRouter      (Layer B, paid)
                                ▼
                             result ─► scorer ─► report (JSON + Markdown) ─► faculty export (Layer C)
                                ▲
            paired run of the same syllabus with every stage off (official invariance)
```

| Component | Proposed location | What it does |
|---|---|---|
| Fixtures | `server/lib/syllabuscheck/eval/phase3/fixtures.js` | Builds each variant from the representative syllabi through declarative mutations. Adds the Cyber Security course. |
| Manifest | `server/lib/syllabuscheck/eval/phase3/manifest-phase3-1.json` | Expected judgments per variant (section 5.5). Status: DRAFT, unreviewed. |
| Oracle transport | `server/lib/syllabuscheck/eval/phase3/oracle.js` | Answers from the manifest in the provider's response shape, so the production validator, retries, precedence and verdict all run. Faults are injected on schedule. |
| Scorer | `server/lib/syllabuscheck/eval/phase3/score.js` | A pure function from a result, its manifest and an optional paired all-off result to the metrics of section 8 |
| Layer A tests | `server/lib/syllabuscheck/stage-e9-phase3.test.js` | Section 6 |
| Runner extensions | `scripts/live-pipeline-eval.cjs`, evaluation only | `--stages all\|off`, `--pair-official`, `--manifest`, `--check-key`, `--review-between-syllabi`, endpoint diagnostics, raw answer content kept for offline replay, the new syllabus names. `--syllabi bsit-defects` keeps its meaning. |
| Faculty export | `scripts/export-validation-package.cjs` (a new whole-syllabus view) | Per week and field: the faculty text, the expected and model judgments, the evidence, the recommendation, and decision columns |

## 4. Programs and courses

| Program | Curriculum (transcribed) | Course | Units, lecture/laboratory | Year | Outcomes used | State |
|---|---|---|---|---|---|---|
| BSIT | 2022-2023 | IT 202 Computer Programming 1 (Fundamentals of Programming) | 2/1 | 2, first semester; prerequisite IT 101 | BSIT POs and EGAs. The PDF has 9 POs and the database 10; the fixture uses the 9. | Existing fixture |
| BSIE | 2022-2023 | IE-402 Systems Engineering | 3/0 | 4, first semester | Engineering POs. PO12 ends mid-sentence; there is no PO–EGA crosswalk. | Existing |
| BSCpE | 2022-2023 | CpE-304 Fundamentals of Mixed Signals and Sensors | 3/0 | 3, first semester | Engineering POs, with the same caveats | Existing |
| BSIT-CYBERSECURITY | 2025-2026 (`server/db/local-curriculum-data.cjs`) | **CS-301 Introduction to Digital Forensics** (proposed). Alternate: CS-303 Essential Security Principles (3/0). | 2/1 | 3, first semester. Prerequisite "IT 208-" as transcribed (Computer Networks 2). | **BSIT's** POs and EGAs, mirroring `program_outcome_sources`. The fixture records that the policy is unconfirmed and the migration is not run. | **New** |

**Why CS-301.** It is a laboratory-bearing course (2/1), so it exercises the C1 laboratory-resource reasoning in a second program, where BSIE and BSCpE are laboratory-0. It is a different discipline from IT 202, and its prerequisite code carries the trailing hyphen of the transcription. CS-303 (3/0) is the alternate if a second laboratory-0 course is preferred.

**Code collision.**
- In the Cyber Security curriculum, `IT-202` is System Integration and Architecture 1; in BSIT, `IT 202` is Computer Programming 1. Both normalize to `IT202`.
- Both are 2/1 courses in year 2, first semester, so only the title tells them apart. Computer Programming 1 is `IT 103-` in the Cyber Security curriculum.
- Layer A must show that each syllabus is identified against its own program's curriculum and never across programs.

## 5. Fixture and dataset design

### 5.1 Variants per program

| Variant | Purpose | Layer |
|---|---|---|
| `aligned` | Restraint: false-flag rate, official pass, a verdict that is not negative | A, B |
| `misaligned` | **Fully populated:** every field filled and every coded form rule passing unless a mutation targets it. It carries one defect set that covers all 13 components, mixing obvious and subtle defects. | A, B |
| `defects` (existing) | The seven E.2 planted errors, unchanged, for comparison with earlier plans | A (B optional) |
| `single:<mutation>` | One mutation at a time: is it attributed to the right relationship, rule and responsible field? | A only |
| `edge:<case>` | Identity and structure edge cases (section 5.3, component 1) | A only |

### 5.2 Design rules for misaligned syllabi

1. **One primary defect per lesson row**, so detection is attributable.
2. **At least four untouched lesson rows** per syllabus serve as controls inside the same document.
3. **Course-level defects are bounded.**
   - A defect in the description, a CLO or a PO/EGA tag may cascade only into rows that are already defect rows or are marked as partial controls, never into a control row.
   - Changing a CLO's text changes every ILO–CLO relationship tagged to that CLO, so a CLO defect is placed on a CLO whose ILOs are all in defect or partial-control rows.
4. **Every cascade is listed in the manifest** with its own expected label set. Nothing is inferred at scoring time.
5. **Obvious and subtle defects are marked and reported separately.**
   - Obvious: another discipline, an unrelated activity.
   - Subtle: the same discipline but another course, a recall task for a design ILO, a value tied to an unrelated behaviour, a plausible but off-course book.

   The existing seven are all obvious and would inflate detection rates on their own.
6. **Identity stays correct in live variants.** A wrong course code suppresses every AI question by design (`stage-e2.test.js`), so identity defects are tested deterministically in Layer A.
7. **Components are covered across programs.** Every misaligned variant covers all 13 components, but the concrete mutations differ by program. Each component has an independent primary defect in at least two programs.
8. **Unadjudicated cases stay out of scoring.** A mutation whose expectation awaits adjudication, such as "Submit your work.", is scored as `open` until faculty decide.

### 5.3 Defect catalogue

Rule identifiers are the advisory report's. **Scored** marks relationships whose label deducts official points: alignment 3, partial alignment 1. "Det." means deterministic. "L" (live) marks mutations eligible for the live misaligned variants; Layer A tests every mutation.

| # | Component | Mutation (kind) | Checked by | Primary expectation | L |
|---|---|---|---|---|---|
| 1.1 | Curriculum identification | Course code not in the program's curriculum (obvious) | Det. CUR-03 | FAIL. No AI request by default. | — |
| 1.2 | | Cyber syllabus coded `IT-202` with the BSIT title "Computer Programming 1" (code collision) | Det. CUR-03/04 | Title mismatch against the Cyber curriculum's own IT-202; never matched to BSIT | — |
| 1.3 | | Units 3/0 for a 2/1 course; a wrong prerequisite, year level or curriculum year | Det. CUR-05/06/07 | FAIL on the field changed | — |
| 1.4 | | The title differs only in capital letters | Det. title policy (`shadow`) | Official unchanged; advisory note as specified | — |
| 2.1 | Title and description | A description of another course of the same discipline (subtle) | AI Description-plan (CUR-09) | NOT_ALIGNED or PARTIALLY_ALIGNED | L |
| 2.2 | | The description promises topics the plan lacks (subtle) | AI Description-plan | PARTIALLY_ALIGNED or NOT_ALIGNED | L |
| 3.1 | Four CLOs | A CLO rewritten for another field, level tag kept (obvious) | AI Course-CLO (CLO-03); Stage A | NOT_ALIGNED. No PO/EGA-fit rewrite of that CLO (`clo_off_course`). Cascades: its CLO-PO and CLO-EGA (**scored**), its ILO-CLO rows (**scored**), CLO-coverage. | L |
| 3.2 | | Three CLOs, or a level tag outside the four names | Det. CLO-01, CLO-08 | FAIL | — |
| 3.3 | | Two CLOs with repeated wording | Det. CLO-02; AI CLO-set (CLO-09) | FAIL; CLO-set PARTIALLY_ALIGNED or NOT_ALIGNED | — |
| 4.1 | CLO–PO/EGA mapping | One PO tag replaced by a PO about a different competence (obvious) | AI CLO-PO (**scored**) | NOT_ALIGNED; recommendation `RETAG_OUTCOME`; no rewrite of the CLO text | L |
| 4.2 | | A plausible but weaker PO or EGA tag (subtle) | AI CLO-PO / CLO-EGA (**scored**) | PARTIALLY_ALIGNED or NOT_ALIGNED | L |
| 5.1 | Week 1 orientation | Week 1 holds a regular topic with no orientation | Det. PLAN-02 | FAIL (MINOR). The AI judges the row as an ordinary lesson. | L |
| 5.2 | | Week 1 empty or missing | Det. PLAN-02 | FAIL (MAJOR) | — |
| 6.1 | Content and ILOs | Content from another discipline (obvious; existing) | AI Content-course (PLAN-03) | NOT_ALIGNED. Precedence: no activity, task or value rewrite for that week (`upstream_invalid`). | L |
| 6.2 | | Content from another course of the same discipline (subtle) | AI Content-course | NOT_ALIGNED or PARTIALLY_ALIGNED; the same precedence | L |
| 6.3 | | An ILO that does not match its week's content | AI Content-ILO (ALN-01) | NOT_ALIGNED; responsible: ILO. Cascades listed for that row. | L |
| 6.4 | | An ILO tagged to the wrong CLO (existing) | AI ILO-CLO (**scored**) | NOT_ALIGNED; re-tag advice | L |
| 6.5 | | Two whole lessons swapped (an advanced topic before its prerequisite) | AI Plan-sequence (PLAN-04) | PARTIALLY_ALIGNED or NOT_ALIGNED. Nothing else changes in the two rows. | L |
| 7.1 | Learning activities | Activity unrelated to the ILO (obvious; existing) | AI ILO-activity (**scored**), Activity-fit (ALN-05) | NOT_ALIGNED | L |
| 7.2 | | A lecture-only activity for a practical ILO (subtle) | the same | Activity-fit PARTIALLY_ALIGNED (teaching passive); ILO-activity PARTIALLY_ALIGNED or NOT_ALIGNED | L |
| 7.3 | | An activity that uses a laboratory in a laboratory-0 course | Activity-fit | **Open: faculty decide.** The competence judgment should not change for availability alone (E.8 decision). | — |
| 8.1 | Assessment tasks | Assessment unrelated to the ILO (obvious; existing) | AI ILO-assessment (**scored**), Assessment-fit (ALN-07) | NOT_ALIGNED | L |
| 8.2 | | A recall quiz for a develop or design ILO (subtle) | the same | Assessment-fit NOT_ALIGNED (level too low); ILO-assessment PARTIALLY_ALIGNED or NOT_ALIGNED | L |
| 8.3 | | A bare task name: "- Quiz" | Assessment-fit | PARTIALLY_ALIGNED (the r8 bare-name rule) | L |
| 8.4 | | A bare instruction: "- Submit your work." | Assessment-fit | **Open:** awaits adjudication (closeout, section 4) | L |
| 9.1 | Whole-course CLO coverage | The ILOs of one CLO re-tagged to another, so that CLO has no ILO | AI CLO-coverage (PLAN-10) | NOT_ALIGNED for that CLO. Cascades: the re-tagged ILO-CLO relationships (**scored**). | L |
| 9.2 | | One CLO covered by a single late week (subtle) | AI CLO-coverage | PARTIALLY_ALIGNED | L |
| 10.1 | Marian-Augustinian values | Value only named (existing) | AI Value-use (VAL-03), Module-value (**scored**) | PARTIALLY_ALIGNED | L |
| 10.2 | | A supporting value with no evidence (existing) | AI Value-map (VAL-05), Module-value | PARTIALLY_ALIGNED, NOT_ALIGNED or INSUFFICIENT_EVIDENCE (the D1 decision is open) | L |
| 10.3 | | A value tied to a behaviour that does not express it (subtle) | AI Value-use, Module-value | NOT_ALIGNED or PARTIALLY_ALIGNED | L |
| 10.4 | | A generic value word that is not one of the six core values | Det. VALUE (VAL-01); AI Value-map | As the coded rule decides, recorded from the Layer A run; a policy question for the institution | L |
| 11.1 | APA references | An unrelated book (obvious; existing) | AI Ref-relevance (REF-05) | NOT_ALIGNED | L |
| 11.2 | | An off-course book from the same discipline (subtle) | AI Ref-relevance | PARTIALLY_ALIGNED or NOT_ALIGNED | L |
| 11.3 | | Author format, a missing year, title case, a DOI not written as `https://doi.org/` | Det. REF-02/03/04 | FAIL on each | — |
| 12 | Recommendations | No mutation of its own: expected for every failing relationship above | `contradictions.js`, verdict precedence, draft reviewer | The expected type (`REWRITE_TEXT`, `RETAG_OUTCOME`, `REVIEW_REQUIRED`, or withheld with its reason); zero contradictions | — |
| 12.x | | Oracle only: a draft that assumes a resource; a draft that copies another relationship | `resources-4` | Withheld (`assumes_resource`, `copies_other_relationship`) | — |
| 13 | Final advisory report | No mutation of its own | `verdict-1` | Each primary defect shows FAIL or NEEDS_REVIEW under its rule, with the right responsible field. No PASS for anything unverified (NOT_CHECKED instead). Every sentence has a Tagalog translation. | — |

### 5.4 Worked example: BSIT misaligned layout

The four other variants follow the same pattern with different mutations (rule 7). Week numbers are those of the representative syllabus: examinations in weeks 6, 12 and 18; CLO 1 in weeks 1–5, CLO 2 in 7–10, CLO 3 in 11 and 13–15, CLO 4 in 16–17.

| Where | Mutation | Kind | Primary expectation | Cascade listed in the manifest |
|---|---|---|---|---|
| Description | 2.2: adds graphical user interfaces, file handling and database connectivity | subtle | Description-plan PARTIALLY_ALIGNED or NOT_ALIGNED | n/a |
| CLO 4 | 3.1: rewritten as a marketing-plan outcome | obvious | Course-CLO NOT_ALIGNED | CLO-PO and CLO-EGA of CLO 4 (**scored**); ILO-CLO of weeks 16–17 (**scored**); CLO-coverage of CLO 4 NOT_ALIGNED (component 9). Weeks 16–17 are partial controls: their other relationships are expected ALIGNED. |
| CLO 2 tags | 4.1: one PO tag replaced | obvious | CLO-PO NOT_ALIGNED (**scored**), `RETAG_OUTCOME` | No rewrite of CLO 2's text |
| Week 1 | 5.1: "History of programming languages", with no orientation | n/a | PLAN-02 FAIL (deterministic) | The AI rows are expected ALIGNED (the content is on course) |
| Week 3 | 6.2: SQL queries in a programming course | subtle | Content-course NOT_ALIGNED or PARTIALLY_ALIGNED | Content-ILO and the activity, task and value relationships of week 3, each listed; no downstream rewrite |
| Week 5 | 7.2: lecture-only activity for a practical ILO | subtle | Activity-fit PARTIALLY_ALIGNED; ILO-activity (**scored**) | n/a |
| Week 7 | 6.3: an arrays ILO in the conditionals week | subtle | Content-ILO NOT_ALIGNED | ILO-CLO of week 7 (**scored**); the week's activity, task and value fits judged against the wrong ILO |
| Week 9 | 6.4: ILO tagged to CLO 4 | obvious | ILO-CLO NOT_ALIGNED (**scored**), re-tag | n/a |
| Week 10 | 8.2: recall quiz for a "develop" ILO | subtle | Assessment-fit NOT_ALIGNED; ILO-assessment (**scored**) | n/a |
| Week 11 | 10.3: Compassion tied to refactoring code | subtle | Value-use NOT_ALIGNED or PARTIALLY_ALIGNED; Module-value (**scored**) | n/a |
| Week 14 | 8.3: "- Quiz" | n/a | Assessment-fit PARTIALLY_ALIGNED; ILO-assessment (**scored**) | n/a |
| Week 15 | 10.2: "Respect" with a lecture-only activity | obvious | Value-map / Module-value as in 10.2 | ILO-activity (**scored**) and Activity-fit of week 15 |
| References | 11.2: a database textbook | subtle | Ref-relevance PARTIALLY_ALIGNED or NOT_ALIGNED | n/a |
| **Controls** | Weeks 2, 4, 8 and 13 untouched | n/a | Every relationship as in the aligned variant | n/a |

**Expected official direction.** The scored defects should lower the score under both prompts, possibly below 79. The exact coded part is recorded from the Layer A run. The AI-dependent part is measured live and compared between the paired runs.

### 5.5 Ground-truth manifest

The manifest is one versioned JSON file (`phase3-1`). Each result records the version and the SHA-256 of the manifest it was scored against. A change makes a new version; old versions are never edited, the same rule as for the datasets.

```json
{
  "version": "phase3-1",
  "status": "DRAFT - developer-written expectations, NOT faculty-reviewed",
  "syllabi": {
    "bsit-misaligned": {
      "base": "bsit",
      "mutations": ["desc-missing-topics", "clo4-off-course", "clo2-po-wrong", "week1-no-orientation", "..."],
      "controls": [1, 3, 7, 12],
      "partialControls": [15, 16],
      "defaultExpectation": { "accept": ["ALIGNED"] },
      "expectations": [
        {
          "relationship": "Course-CLO:clo3-course",
          "component": 3,
          "mutation": "clo4-off-course",
          "role": "primary",
          "kind": "obvious",
          "accept": ["NOT_ALIGNED"],
          "fields": {},
          "responsible": "clo",
          "recommendation": ["REWRITE_TEXT"],
          "verdict": { "ruleId": "CLO-03", "status": ["FAIL", "NEEDS_REVIEW"] },
          "reviewStatus": "unreviewed",
          "facultyVerdict": null,
          "facultyNotes": ""
        }
      ],
      "deterministic": { "recordedFrom": "Layer A oracle run", "findings": ["PLAN-02 FAIL plan[0].contents"] }
    }
  }
}
```

- **Keys** are `Type:relationshipId`, the form `PLANTED` already uses (for example `ILO-CLO:row8-ilo0-clo:c4`). Row indexes are 0-based (`row8` is week 9).
- **Defaults.** A relationship not listed takes the aligned variant's expectation. Exceptions found in Layer C are listed explicitly.
- **Consistency.** A Layer A test fails if an expectation names a relationship the engine never plans for that variant, or if a mutation has no primary expectation.
- **Faculty fields** (`reviewStatus`, `facultyVerdict`, `facultyNotes`) are filled only in a new manifest version.

### 5.6 Cyber Security fixture outline (CS-301, synthetic)

The syllabus is marked synthetic like the other three. The curriculum identity comes from the transcription and the outcomes from BSIT.

- **Description:** principles and practice of acquiring, preserving, analysing and reporting digital evidence, within the legal and ethical limits of an investigation.
- **CLOs:**
  1. Introductory: explain the forensic process and the legal and ethical requirements for digital evidence.
  2. Enabling: apply sound acquisition, preservation and chain-of-custody procedures using imaging and hashing.
  3. Demonstrating: analyse file-system, operating-system, network and memory artifacts to reconstruct events.
  4. Integration of Values: investigate a simulated incident and report the findings truthfully, respecting privacy and working as a team.
- **Weeks:**
  - Week 1: orientation (the shared text).
  - Weeks 2–5: foundations of digital forensics; legal and ethical framework; evidence handling and chain of custody; forensic imaging and hash verification.
  - Week 6: preliminary examination.
  - Weeks 7–11: file systems; data recovery and file carving; Windows artifacts; timeline analysis; network forensics.
  - Week 12: midterm examination.
  - Weeks 13–17: memory forensics; e-mail, browser and cloud artifacts; mobile device forensics; anti-forensics and validating findings; reporting and the case presentation.
  - Week 18: final examination.
- **Resources.** Laboratory activities name only resources the lesson itself establishes, such as "the laboratory's imaging software and a prepared USB drive". This gives C1 a supported-resource case, set against the laboratory-0 BSIE and BSCpE courses.

## 6. Layer A: offline end-to-end testing (no paid calls)

**Oracle.**
- It answers every relationship the engine asks, in the provider's response shape:
  - the label is the first value of its accepted set;
  - the fields agree with the label under the r8 field contract;
  - the quotations are exact substrings of the pair's own texts;
  - drafts are scripted.
- It runs through the unchanged `engine.run`, `gemini.validate`, the staged retry policy (`MAX_ATTEMPTS` 3, every retry corrective), the draft reviewer, the precedence rules and `buildVerdict`.
- `fetch` is replaced by a function that throws, so no network call is possible.

| Test group | Asserts |
|---|---|
| A1. Aligned variants (4 programs) | Official pass; a verdict that is not negative; no FAIL on any manifest-default relationship; zero contradictions |
| A2. Misaligned variants (4) | Each primary expectation appears with the expected label, rule, responsible field and recommendation type. Every cascade is as listed. Controls stay clean. Zero contradictions. Precedence reasons are present. |
| A3. Single-mutation variants (each catalogue row) | Attribution to the right relationship and rule, and nothing else changes outside the listed cascade |
| A4. Official invariance plumbing | With identical scored answers, all-on and all-off runs give the same score, pass and readiness, whatever the advisory answers. This re-asserts E.6 #18 on the Phase 3 variants. |
| A5. Fault injection | See the list below |
| A6. Identity edge cases | Code collision (IT-202 / IT 202); a code outside the curriculum (no AI request); units, prerequisite, year and curriculum year; capitalization-only titles under `shadow`; Week 1 missing, empty or not an orientation; a laboratory-0 conditional laboratory draft (advisory, neutral) |
| A7. Language and compatibility | Every verdict sentence of every variant has a Tagalog translation (`audit-verdict-i18n.mjs`, without `--write`). Saved reports from earlier versions still render. Prompt labels and cache keys are unchanged. |
| A8. Manifest consistency | Every expectation id is planned by the engine; no orphan ids; every mutation has a primary expectation |

**A5 fault injection.**
- Answer faults:
  - an empty list, which is corrected and then verified;
  - a repeated empty list, which leaves the relationship unresolved (`NOT_CHECKED` in the verdict); 9 unproductive answers in a row stop the run;
  - a partial list;
  - swapped quotations;
  - a quotation with one letter's case flipped;
  - a quotation taken from another relationship;
  - broken JSON or a cut-off reply, which is asked again in two halves;
  - a label that disagrees with its fields;
  - a draft that assumes a resource, or copies another relationship, which is withheld.
- Transport faults:
  - HTTP 429, 5xx or a timeout, which counts as transient;
  - HTTP 401 or 402, which stops at once with nothing charged.
- For each fault, the guard's counters and the request count stay within the retry ceiling (requests + 2 × questions).

**Acceptance:**
- every new test passes, and so does the full suite (1,406 today);
- the rules document regenerates byte-identical;
- no prompt, scoring, gate, flag or saved result changes.

## 7. Layer B: bounded live MiniMax testing

### 7.1 Configuration (unchanged from production)

- **Provider.** OpenRouter `minimax/minimax-m3.1-flash`, as `server/.env` configures it (read, never changed). Requests send `provider.require_parameters: true`; temperature 0; strict JSON schema.
- **Prompts and batches.**
  - Advisory run: `alignment-12ab34c1c2d1d2-r8`, batches of 4.
  - Paired official run: `alignment-10`, batches of 12.
  - Trim off; `minItems` off.
- **Retries:** the production retry policy (section 7.4).
- **Accounting:** `--accounting reconcile`.
- **Ledger:** a new file, `docs/ai-eval-phase3-ledger.json`. The E.8 ledger and every earlier ledger are left as they are.
- **Before each tranche:**
  - `--check-key`, which reads the key's status and expiry, never its label;
  - endpoint diagnostics are recorded;
  - a review pause after every syllabus (`--review-between-syllabi`).

### 7.2 Tranches

| Tranche | Scope | Clean requests | Expected requests | Expected cost | Hard caps (requests / $) |
|---|---|---:|---:|---:|---|
| B0 | Free plan of the new variants; Layer A green; a dry run of the thresholds on a copy of the ledger | 0 | 0 | $0 | n/a |
| B1 canary | BSIT aligned, every stage on, stopped by its budget after 14 model requests. It measures the first-attempt validity of the never-sent all-stage r8 prompt. | 16 | 16 | $0.01–0.03 | 16 / $0.10 |
| B2 pilot | BSIT aligned + misaligned, every stage on, each paired with an all-off run | 117 | 141–269 | $0.09–0.50 (central $0.16) | 300 / $0.60 |
| B3 | BSIE pair, as B2 | 117 | 141–269 | $0.09–0.50 | 300 / $0.60 |
| B4 | BSCpE pair | 117 | 141–269 | $0.09–0.50 | 300 / $0.60 |
| B5 | Cyber Security pair | 117 | 141–269 | $0.09–0.50 | 300 / $0.60 |
| B6 (optional) | Stability: BSIT misaligned again, all on + all off | 60 | 72–137 | $0.04–0.25 | 160 / $0.30 |
| **B1–B6** | | **544** | **652–1,229** | **$0.41–2.28 (central about $0.75)** | **1,376 / $2.80** |
| B7 (later) | The three real syllabi, all on + all off. Needs data-governance consent and an extraction check against the PDFs first. | 161 | 194–367 | $0.12–0.70 | 400 / $0.75 |

- **Clean requests** are model requests with no retry, plus a key check and a price lookup per invocation. A pair is 48 + 49 all-stage requests (free plan) + 2 × 9 all-off requests + 2.
- **Time:** E.8 requests took 1.2–2.8 s, so a syllabus takes about 1–3 minutes before retries.

**Gate between tranches.** You review each tranche's report before the next is approved. B2 is the decision point. If its official results differ between the paired runs, the remaining tranches wait for your decision (closeout section 3, options a–c).

### 7.3 Cost model and assumptions

| Quantity | Value | Source |
|---|---|---|
| All-stage request | About 40.1k bytes, about 8.2k prompt tokens (bytes ÷ 4.89; about 10k by characters ÷ 4) | E.9 volume probe; free plan |
| Completion per relationship | About 200–230 tokens, so about 0.8–0.9k per all-stage request | E.8 r8 answers |
| All-off request | About 15.8k bytes, about 3.2k prompt tokens, about 11 relationships | E.9 volume probe |
| Prices on 2026-10-26 | Input $0.10–0.30 per million tokens, output $0.55–1.20, cached input $0.01–0.03; 12 endpoints, 9 with structured outputs | `prices.endpoints` in the unseen-cases result |
| Cached share | 33–72% observed | E.7–E.8 |
| Billed per all-stage request | $0.0006–0.0018 expected (E.5's all-stage requests: $0.0005–0.0017); $0.0035 at the highest list price without cache | Derived |
| Billed per all-off request | $0.0008–0.0025 | Estimate |
| Retry factor (model requests ÷ clean) | 1.25 observed (Stage C r8); 2.0 in the E.6 simulation with corrections (97 ÷ 49); 2.5 planning ceiling | E.8, E.6 |
| Retry ceiling per syllabus | 426–427 requests (requests + 2 × questions) | Free plan |
| Guard reservation | About $0.022 per all-stage request: the request body counted as tokens at $0.30 per million, plus 8,192 output tokens at $1.20 per million. It is settled at the reported cost. | `providerGuard.js` |

- **Reconcile accounting is required.** Under conservative accounting, a $0.60 cap admits only about 27 all-stage requests.
- **The caps bind first.** They are far below the theoretical retry ceiling, so a tranche that retries heavily stops at its cap (and is reviewed) instead of completing. At the highest list price with a 2.5 retry factor, a pair would cost about $0.95, so it would stop at $0.60.

### 7.4 Retry policy

- **Production policy, unchanged.**
  - With stages on, each relationship is sent at most 3 times: in its batch, again with the others that failed with it, then alone. Every retry carries a correction.
  - A problem that repeats after its correction stops that relationship. Transport errors are never retried.
  - With every stage off, the legacy policy applies (single retries for a lone relationship).
  - No operator retries beyond this. A relationship still unverified is reported unresolved: NOT_CHECKED in the verdict, never a pass.
- **Guard thresholds,** set from the ledger's carried counters at run time and dry-run in B0 on a copy of the ledger:
  - `--max-transient 3`;
  - `--max-unproductive 9`, the default for batches of 4;
  - `--max-unresolved 0.2 --min-sample 8`, between syllabi.

  Invalid answers only warn, the E.6 design for whole syllabi. The canary alone also sets `--max-invalid` to the carried count + 4, so an all-stage prompt that fails often stops early.

### 7.5 Stop conditions

**Enforced today:**
- HTTP 401, 402 or 403: stop at once.
- The request budget is reached.
- A request whose worst case would exceed `--max-cost` is not sent.
- 3 transient errors.
- 9 answers in a row that verify nothing.
- Between syllabi: a final unresolved rate above 20% (once 8 relationships were attempted), or any contradiction.

**Added for Phase 3** (in the runner, or by the operator at each review pause). These thresholds are proposals.

| Condition | Action |
|---|---|
| The official score, pass or readiness differs between the paired runs | Pause after the syllabus. Report each scored relationship whose label differs. Wait for your decision. |
| A quotation accepted that is not verbatim in its field | Stop at once. The validator should make this impossible. |
| A released draft that assumes an unestablished resource, participant or contact-hour change | Operator stop after the syllabus, as in E.8 |
| Fewer than 50% of primary defects detected in a misaligned syllabus | Pause and re-plan before spending more |
| More than 15% of the untouched relationships flagged in an aligned syllabus | Pause |
| 3 or more empty lists from one endpoint in a tranche | Pause, as evidence for the ModelRun policy |
| Canary: more than 25% of first-attempt answers invalid, any quotation refused although it exists, or any transient stop | Do not start B2 |

## 8. Evidence and recommendation review criteria

Automated criteria are computed by the scorer; manual ones are read by the operator and then by faculty.

**Evidence**

| # | Criterion | How |
|---|---|---|
| E1 | Quotations are exact and on their own side (source and target) | Automated (validator, `evidenceMatching`) |
| E2 | The explanation states only facts in the quoted fields or the lesson, with no borrowed behaviour or invented resource | Manual. Counted as "unsupported explanatory claims", as in E.7. |
| E3 | No carry-over from another relationship in the same request (four-word sequences found in a sibling but not in the item's own texts) | Automated flag, then manual |
| E4 | The structured fields agree with the label (contract) and with the manifest | Automated |
| E5 | The responsible field matches the manifest | Automated |
| E6 | The quotation is relevant, not merely exact | Manual, on a sample |

**Recommendations**

| # | Criterion | How |
|---|---|---|
| R1 | Offered only for failing relationships | Automated (`contradictions.js`) |
| R2 | Precedence holds: upstream fields first, no rewrite while the content or ILO is off, values answered once | Automated (`contradictions.js`, verdict `WITHHELD` reasons) |
| R3 | Grounded: no unestablished equipment, software, data, participants or facility, and no change to contact hours | Automated (`resources-4`), then manual. The closeout lists two known reviewer gaps: supplied test material and contact-hour changes. |
| R4 | Not copied from another relationship | Automated (`copies_other_relationship`; `borrowed_wording` advisory) |
| R5 | Academically sound: it fixes the defect at the right level, keeps the competence and adds no requirement | Manual, then faculty |
| R6 | Faculty text is preserved: drafts are proposals, never applied automatically (`requiresFacultyApproval`) | Automated |
| R7 | The right type for mapping defects: `RETAG_OUTCOME` when the text is right and the tag is wrong | Automated against the manifest |
| R8 | Withheld drafts are never shown or recommended | Automated (`contradictions.js`) |

**Metrics reported per syllabus and per component:**
- primary defects detected, split obvious / subtle;
- cascades matched;
- false flags on controls;
- label, field, responsible and recommendation agreement;
- exact quotations;
- unsupported explanations;
- released unsupported drafts;
- contradictions;
- unresolved relationships;
- official result, all on against all off;
- requests and retry factor;
- empty lists by endpoint;
- cost and time.

Every agreement figure is labelled "against developer-written expectations, not faculty-verified".

## 9. Layer C: faculty-reviewed academic validation

### 9.1 Design

- **Reviewers:**
  - two faculty members per program (BSIT and Cyber Security from CITE, BSIE, BSCpE), with the program chair as adjudicator;
  - a librarian for the APA rules and reference relevance;
  - the values or formation office for the Marian-Augustinian values;
  - a native Tagalog speaker for the report text.
- **Order. The manifest is reviewed before the paid runs.** Faculty first confirm that the aligned rows are aligned and the planted defects are real defects of the stated kind. Only then are model answers scored against expectations they accept.
- **What they review:**
  - every primary and cascaded expectation;
  - every disagreement between the model and the manifest;
  - every released draft on a misaligned syllabus;
  - a stratified random 20% of agreeing relationships on the aligned syllabi;
  - the open items (closeout section 6: `as-prog1-vague-evidence`, the D1 and D2 decisions).
- **Independence.** Two independent reviews per item, with disagreements adjudicated by the third reviewer. Agreement between the two reviewers is recorded as the ceiling against which model agreement is read.
- **Recording.** Decisions go into new manifest and dataset versions (`facultyVerdict`, `facultyNotes`, reviewer, date). Provisional labels and saved results are never edited.
- **After review:** faculty-verified accuracy per component, with confidence intervals. Samples will be small, so wide intervals must be reported as such.
- **Materials:** the existing [faculty review pack](faculty-review/README.md) and [validation package](academic-validation-package/README.md), plus the new whole-syllabus view.

### 9.2 Faculty-validation checklist

**Before review**
- [ ] Reviewers assigned: two per program, a chair as adjudicator, a librarian, the values or formation office, a Tagalog reviewer.
- [ ] Curriculum transcriptions confirmed against the registrar's source for the four programs: codes, titles, units, prerequisites, year levels.
- [ ] Outcome texts confirmed: BSIT 9 (PDF) or 10 (database); the full PO12 for BSIE and BSCpE; PO–EGA crosswalks.
- [ ] The Cyber Security inheritance of BSIT outcomes confirmed as institutional policy.
- [ ] The six value definitions approved for this use (`server/config/marian-values.json`).
- [ ] APA 7 rules confirmed by the librarian (`references.js`).
- [ ] Thresholds and the rubric acknowledged as proposals, or replaced by policy: 4 CLOs, the level names, 50% integrated values, 60% copied.

**Per synthetic syllabus (manifest review)**
- [ ] Each aligned week is an acceptable example of alignment.
- [ ] Each planted defect is a real defect, of the stated kind (obvious or subtle) and component.
- [ ] Each expected label set, responsible field and recommendation type is agreed, or corrected in a new version.
- [ ] Cascades are complete: no affected relationship is missing.
- [ ] Laboratory, resource and contact-hour statements match what the course can actually provide.

**Per model answer (sampled)**
- [ ] Label: agree / disagree / unsure.
- [ ] Evidence: the quotation is relevant, not only exact.
- [ ] Explanation: no unsupported claim.
- [ ] Recommendation: acceptable / acceptable with edits / not acceptable; no assumed resource, participant or contact-hour change.
- [ ] For scored types: the official effect of the answer is understood.

**Adjudication and sign-off**
- [ ] Two independent reviews per item; the third reviewer decides disagreements; reasons recorded.
- [ ] Decisions stored only in new manifest or dataset versions.
- [ ] Inter-reviewer agreement reported beside model agreement.
- [ ] Program chair sign-off per program; QA office acknowledgement.
- [ ] Bilingual report text reviewed by the Tagalog reviewer.

## 10. Risks

| Risk | Mitigation |
|---|---|
| The all-stage r8 prompt has never been sent; on r4–r6 most answers failed validation in whole or in part (closeout 2.2) | The B1 canary and its go/no-go criteria |
| Retry factor and endpoint empties raise the cost (4 of 28 responses empty; ModelRun 2 of 3) | Caps per tranche; the corrective retry; the empty-list pause |
| Official results may differ between the paired runs | That is a finding, not a defect of the evaluation. It blocks production activation of the stages until you decide (closeout section 3). |
| The expectations are the developer's; obvious defects inflate detection | Subtle defects reported separately; faculty review the manifest before the paid runs |
| The BSIT, BSIE and BSCpE syllabi were used in earlier development, and Stage B's example is the BSIT week 7 topic | The Cyber syllabus is new; BSIT content-relevance results are reported with this caveat until the example is replaced (decision 4) |
| Cascades blur attribution | One primary defect per row; cascades listed; controls kept outside every cascade |
| Spending beyond approval | Hard caps checked before each request (worst case reserved); a separate approval per tranche |
| Key expiry or exhausted credit | `--check-key` before each tranche; HTTP 401/402 stops at once with nothing charged |
| Real faculty text sent to a third-party provider (B7) | Not before consent; synthetic syllabi first |
| The fixtures are English only; the reviewer is English only | Tagalog report text is audited; Tagalog syllabus content is outside Phase 3 and recorded as a limitation |

## 11. Decisions needed before implementation or paid testing

1. Approve the three-layer plan, and the first task in section 12.
2. Confirm CS-301 as the Cyber Security course, or choose CS-303.
3. Stage B's example: replace it first (E.6's neutral wording), or accept the caveat for BSIT content relevance.
4. Approve the paired all-off runs, and how to respond to a divergence (closeout section 3).
5. Whether the Phase 2 completion runs come before Layer B (closeout section 5, items 3–6: about 50 requests, $0.03–$0.08):
   - A, B1–B2, B3 and B4 on r7;
   - the new D1-2 and D2-2 items;
   - stability;
   - the held-out split.
6. Assign the faculty, librarian, values and language reviewers, so the manifest is reviewed before B2.
7. Adjudicate `as-prog1-vague-evidence`. Until then, mutation 8.4 is scored as `open`.
8. Data-governance consent for the real syllabi (B7).

## 12. Recommended first implementation task

**"Phase 3 Layer A harness, part 1": offline only, no paid call, no prompt, scoring, gate or flag change.**

1. **Cyber Security fixture.**
   - Export a spec-based builder from `programSyllabi.js`, and add CS-301 (section 5.6) through the new `eval/phase3/fixtures.js`.
   - `PROGRAMS` and the three existing syllabi stay byte-identical, so `stage-e2.test.js`, the free plan and earlier results are unaffected.
2. **Mutation catalogue** (section 5.3) as declarative entries: id, component, kind, live-eligible, `apply(content)`, primary and cascade expectations.
3. **The BSIT `aligned` and `misaligned` manifest entries** (section 5.4) in `manifest-phase3-1.json`, status DRAFT. Then the other three programs, following rule 7.
4. **Oracle transport** with the fault schedule of A5.
5. **Scorer** for the automated criteria of section 8, with the official comparison of a paired run.
6. **Layer A tests** A1–A8 in `stage-e9-phase3.test.js`.
7. **Free plan** of the new variants, to replace the estimated 49 requests of each misaligned syllabus with a measured figure.

**Acceptance:**
- every new test passes, and so does the full suite (1,406 today);
- `node scripts/audit-verdict-i18n.mjs` passes, without `--write`;
- `npm run build` passes, and `git diff --check` is clean;
- the rules document regenerates byte-identical;
- every saved result, ledger and dataset is hash-unchanged;
- no network access in any test.

**Not in this task:**
- the runner extensions for Layer B (`--stages`, `--pair-official`, `--manifest`, `--check-key`, endpoint diagnostics, the review pause);
- the whole-syllabus faculty export.

Those are part 2, after you have reviewed Layer A. Faculty review of the manifest can begin as soon as part 1 exists.
