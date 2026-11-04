# Hybrid-2 AI Checker: P2 A2 (alignment development split, legacy) with Claude Sonnet 5.5

**Status: A2 ran on 2026-10-28** (local time; `ranAt` 2026-10-27T19:11:27Z) and took 190 seconds. Only A2 ran. B2, B3 and P3–P5 were not run. Claude stays evaluation-only: no official score, readiness check or submission gate used these answers.

**This report keeps four kinds of evidence apart:**

| Kind | What it rests on | Sections |
|---|---|---|
| Technical validation | Checks done by code: JSON, the validator, verbatim quotes, model identity, retries, the guard's accounting | 3, 5, 8 |
| Agreement with provisional expectations | The dataset's expected verdicts. A developer wrote them, and faculty have not reviewed them (`reviewStatus: unreviewed`) | 3, 4, 7 |
| Recommendation appropriateness | My developer review of all 82 drafts, against rules and notes fixed before the run. It is not a faculty review | 6 |
| Faculty-validated academic correctness | **None exists.** No A2 answer or draft has been reviewed by faculty | — |

## Summary

- **Technically, the run was clean.** All 18 requests succeeded at the first attempt, and all 116 relationships were verified. All 232 quotes are verbatim, and no answer failed validation. The run cost $0.3256 of its $1.40 cap.
- **There were no false approvals.** Claude approved 0 of 52 answers on clear not-aligned items, including 0 of 24 on the 12 keyword traps.
- **There were many false rejections against the provisional labels.** Claude judged 18 of 50 answers (36%) on clear-ALIGNED items as not aligned, across 11 items.
  - 13 of the 18 follow two rules in the legacy prompt itself, which the provisional labels read differently (section 4).
  - Permissive agreement is 82.8%, and strict agreement is 72.7%.
- **The 16 items shared with A1 behaved as in A1:** 31 of 32 answers agree in both runs. The lower agreement comes from the 42 items new in this dataset, not from a change in the model.
- **Recommendation quality needs faculty attention.** I flag 43 of the 82 drafts for faculty review.
  - The legacy contract cannot recommend a re-tag, so every answer on the 8 remap candidates carries a rewrite. For the 3 re-tag candidates, the drafts bend a sound CLO toward the wrong PO or EGA.
  - Other findings:
    - 2 duplicate CLOs;
    - 10 drafts that raise a sound outcome to the PO's level or replace its competence;
    - value terms added on `d-ega-08`;
    - 18 rewrites of outcomes the labels call aligned.
- **B2:** I recommend proceeding under a separate authorization (section 10).

## 1. Scope and limits

| | A2 |
|---|---|
| Mode | A, the legacy academic alignment benchmark (`alignment-10`, no stage on, no recommendation field) |
| Dataset | `align-1` (`server/lib/syllabuscheck/eval/alignment-dataset.json`), development split only: 58 items |
| Relationship types | CLO-PO 24, ILO-CLO 19, CLO-EGA 10, CLO-anyPO 3, CLO-anyEGA 2 |
| Courses | calculus 20 items, programming 13, nursing 11, education 6, accounting 4, hospitality 3, operations research 1 |
| Held-out items | The 42 held-out items were excluded before any request was built |
| Model and settings | `claude-sonnet-5-5`, adaptive thinking, effort high, max_tokens 16,000, timeout 180 s, 2 adapter retries, prompt cache |
| Runs | 2 |
| Requests without retries | 18 (9 batches per run, at most 12 relationships each) |
| Request limit, retries included | 40 |
| Cost cap (guard accounting) | $1.40 |
| Cap over the spend register | $1.903157: the register's $0.5031572 plus $1.40, rounded down |
| Validation stop | the 3rd answer that fails validation |

Nothing in the prompt, the response contract, the validator or the dataset was changed for A2 (section 11).

## 2. Pre-flight checks (before any paid request)

1. **Workspace and spend limit.** You confirmed in the Anthropic Console that the workspace used since P1 still has the $10 limit. The workspace id is not recorded in this repository.
2. **Credits.** You confirmed that the remaining credits cover $1.40. The API cannot read the balance.
3. **Model.** The harness accepts only `claude-sonnet-5-5` or a dated snapshot of it, and it stops if an answer comes from any other model. All 18 answers came from `claude-sonnet-5-5`.
4. **Guard.** 37 of 37 guard, harness and quality-metric tests passed offline. The spend register held $0.5031572 of $10, with no stale lock.
5. **Planner.** `--plan` with the exact flags planned 18 requests and printed no warning.
   - Worst case: $0.2163 per request on average, $0.2198 at most.
   - Expected cost: $0.32–1.30. This is an estimate, not a limit.
6. **No held-out cases.** The planner reported "development (selected by `--split dev`) 58; held-out 42, excluded and not stored; held-out selected: 0". No held-out log was created, and none of the 58 answered ids is a held-out id.
7. **Scoring isolation.** The run is marked evaluation-only, and the stage switches exist only in the script's own environment object. The application's approval switch (`SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL`) is unset, and the official check reports `configured: false`. Both were checked again after A2.
8. **Historical files.** The A2 output files did not exist, and the harness refuses to overwrite a result. A hash snapshot of 652 files was taken before the run and compared after it (section 11).

**Fixed before the run.** Before any request, a script saved the following, together with the dataset's hash:

- the 8 remap candidates, each with a provisional remedy;
- the 8 level-gap items, with notes;
- 12 keyword traps: clear not-aligned items whose texts share a content word or that test keyword overlap;
- the 16 items shared with A1;
- each course's CLO statements;
- the rules used in section 6: duplicate, escalation, replacement and values.

None of these was chosen after seeing the answers.

**Key scan.** The console output went to a scratch log. Before any of it was displayed, these files were scanned for the key, its last 12 characters and its body: the log, the result, the ledger, the case record and the spend register. None of the three appeared.

## 3. Results: the 19 requested items

| # | Item | A2 |
|---|---|---|
| 1 | Total cases | 58 development items × 2 runs = 116 relationships. All 116 verified, 0 unresolved, completion `complete`. Labels: ALIGNED 34, PARTIALLY_ALIGNED 36, NOT_ALIGNED 46, INSUFFICIENT_EVIDENCE 0 |
| 2 | Strict / permissive agreement | Strict 72.7% (48 of 66 answers on the 33 single-verdict items). Permissive 82.8% (96 of 116) |
| 3 | False approvals / rejections | False approvals: 0 of 52 answers on clear not-aligned items, and 0 of 24 on the 12 keyword traps. False rejections: 18 of 50 (36.0%) on clear-ALIGNED items, 16 PARTIALLY_ALIGNED and 2 NOT_ALIGNED |
| 4 | Insufficient evidence | 0 answers. No development item expects it, and every pair has both texts, so A2 does not exercise this path |
| 5 | Evidence validation | 232 of 232 quote sides are verbatim in their own text, confirmed by the validator and by an independent check. 0 refused, 0 on the wrong side, 0 empty |
| 6 | Bloom | 0 of the 30 ALIGNED answers the level rule applies to break it. Level-gap items show the gap in 16 of 16 answers. 5 of 36 repeated statements got different levels. 9 of 58 items changed a level between runs. 0 answers refused for an invalid level (section 5) |
| 7 | Run-to-run consistency | Same label on 54 of 58 items (93.1%), same Bloom levels on 49, same remedy on 54. On the 39 items with a draft in both runs, the two drafts share 57% of their words on average |
| 8 | Invalid answers and recovery | 0 of 18 answers invalid. 0 of 116 relationships refused at the first attempt. No re-ask needed, 0 unresolved |
| 9 | Recommendation quality | Section 6: 43 of 82 drafts flagged for faculty review |
| 10 | The 8 remap candidates | Section 6A: the verdicts agree on 16 of 16 answers. All 16 carry a rewrite, a limit of the contract |
| 11 | Duplicate CLOs | 2 (`clo-po-nurs-unrelated`, both runs) |
| 12 | Bloom escalation | 30 drafts raise the level. 10 are flagged as raised to match the PO (section 6C) |
| 13 | Institutional values | No draft removed or replaced a value reference. The `d-ega-08` drafts add value terms; 2 of the 3 terms are not among the six core-value names (section 6D) |
| 14 | Comparison with A1 | On the 16 shared items: same labels on 15, same Bloom levels on 15, same remedy on 16. Agreement 31 of 32 in both (section 7) |
| 15 | Requests and retries | 18 of the 40 allowed. 0 re-asks, 0 adapter retries, 0 timeouts, 0 transient errors. All HTTP 200 with `end_turn` |
| 16 | Tokens, latency, cost | Input 12,724; cache write 3,728; cache read 63,376; output 27,811, including 3,477 thinking. Latency median 9.2 s, p90 25.4 s, max 28.4 s. Estimate $0.3192156; guard charge $0.3255532 (section 8) |
| 17 | Remaining budget | A2 left $1.0744 of its $1.40 unused, which does not carry over. The register holds $0.8287104 of $10, leaving $9.1712896 |
| 18 | Remaining academic risks | Section 9 |
| 19 | Recommendation on B2 | Section 10 |

**Model and format.** Every answer came from `claude-sonnet-5-5` (18 of 18). All 18 answers are valid JSON. Re-running the validator on the saved answers verifies the same 116 judgements.

## 4. Agreement with the provisional expectations

### By relationship type and category

| Type | Items | Permissive agreement |
|---|---|---|
| CLO-PO | 24 | 37 of 48 (77.1%) |
| ILO-CLO | 19 | 34 of 38 (89.5%) |
| CLO-EGA | 10 | 17 of 20 (85.0%) |
| CLO-anyPO | 3 | 4 of 6 (66.7%) |
| CLO-anyEGA | 2 | 4 of 4 (100%) |

**By category**, every answer agrees on:

- clear-negative (18 of 18);
- level-gap (16 of 16);
- partial (8 of 8);
- wrong-program (4 of 4);
- keyword-overlap (4 of 4);
- broad-CLO-narrow-ILO (4 of 4);
- contradictory (2 of 2).

Agreement is lowest on:

- different-wording (6 of 14);
- specific-CLO-broad-PO (2 of 4);
- clear-positive (12 of 16);
- name-only EGA (9 of 12);
- interdisciplinary (3 of 4);
- whole-list (8 of 10).

**The pattern.** Claude never gave ALIGNED to a pair whose labels do not accept it. But it judged a third of the pairs the labels call aligned as not aligned: as PARTIALLY_ALIGNED in all but two answers, which were NOT_ALIGNED.

### The 18 false rejections

They fall on 11 items. Their explanations point to five causes:

| Cause | Answers | Items | What the explanations say |
|---|---|---|---|
| A multi-part PO with one part not shown | 6 | `d-po-03` × 2, `d-po-07` × 2, `d-po-09` × 2 | `d-po-03`: "Develop and test a web application…" lacks "design" and "evaluate". `d-po-07`: a test blueprint and items lack "implement" and "evaluate". `d-po-09`: "measure" is missing |
| A broad PO with only part of its scope covered | 3 | `d-po-05` × 2, `clo-po-prog-interdisciplinary` run 1 | `d-po-05`: no nursing process, and individuals only, not "families and communities". `clo-po-prog-interdisciplinary`: the users of one system, not "individuals, organizations and society" |
| The CLO lies outside the course's stated subject | 4 | `d-po-01` × 2, `d-any-po-01` run 2, `d-any-po-03` run 2 | Integration (areas and volumes) and matrix methods are "not part of Differential Calculus", whose description reads "Limits, continuity, derivatives and their applications to engineering problems". The prototype CLO has "no calculus subject matter" |
| The EGA's name read literally | 1 | `d-ega-03` run 1 | The outreach CLO "does not mention stewardship" |
| An ILO step judged against the whole CLO | 4 | `d-ilo-10` × 2 (PARTIALLY), `d-ilo-01` × 2 (NOT) | Setting a cover is a smaller step of table service but "does not show the delivery of service itself". Differentiating functions omits "the optimization and engineering application" |

**13 of the 18 follow the legacy prompt's own rules.** The prompt (`alignment-10`, in `gemini.js`) contains two rules that produce them:

- **The multi-part rule** (rows 1 and 2, 9 answers): "When the source asks for several things (a PO with two skills, an ILO with two verbs), every one must be shown. If one is missing the pair is PARTIALLY_ALIGNED, not ALIGNED. When in doubt between ALIGNED and PARTIALLY_ALIGNED, choose PARTIALLY_ALIGNED…"
- **The course-subject rule** (row 3, 4 answers): "…judge it as part of THIS subject… A text that has nothing to do with the course is NOT_ALIGNED…"

The provisional labels read the same pairs differently. Their rationales say, for example:

- "A specific skill that clearly develops one real part of broad safe-care practice" (`d-po-05`);
- "Constructing a test blueprint and items is designing an assessment" (`d-po-07`);
- "Different words… for the same competency" (`d-po-01`).

On these items, the labels count a CLO that develops one part of a PO as aligned, and the prompt does not. **Which reading is right is an academic policy question for faculty.** A2 cannot settle it, and I changed neither the labels nor the prompt.

`d-po-01`, `d-any-po-01` and `d-any-po-03` also place CLOs outside the course's described topics in the calculus course. Claude's objection that such a CLO does not fit the course is a real curriculum point, but it answers a different question from whether the CLO fits the PO.

**One item's labels contradict its own explanations.** `d-ilo-01` was labelled NOT_ALIGNED in both runs, yet each explanation affirms the ILO-CLO tests: "a smaller prerequisite step in the same subject, so it builds toward the CLO… it reaches Apply, the CLO's own level… The ILO does not claim more than the CLO."

- By the prompt's own tests, that is at least PARTIALLY_ALIGNED.
- Claude judged six other ILOs it called smaller steps ALIGNED: `d-ilo-02`, `d-ilo-04`, `d-ilo-06`, `d-ilo-13`, `ilo-clo-calc-aligned` and `ilo-clo-prog-aligned`.
- For ILO-CLO pairs, the prompt's multi-part rule and its "smaller step" test pull in different directions, and Claude resolved the conflict inconsistently.
- The checker's advisory answer review did not flag these answers. A heuristic search of all 116 explanations found no other contradiction; I checked its other 4 hits, and they are consistent.

### Keyword overlap and false approvals

None of the 12 keyword traps was approved. All 24 answers were PARTIALLY_ALIGNED or NOT_ALIGNED, and all agree with the labels.

The explanations reject on competence, not on shared words. For example, on `d-po-04` ("Write programs in Python that process text files", against a PO about computing's impact on society): "It has no analysis, Bloom level is Apply rather than Analyze, and it says nothing of the local and global impact…".

The wrong-program trap, `d-po-12`, pairs a nursing vital-signs CLO with a computing PO. It was PARTIALLY_ALIGNED in both runs, which the labels accept, but neither explanation notices that the PO belongs to another program (section 6A).

### Where the agreement drop comes from

| | 16 items shared with A1 | 42 items new in align-1 |
|---|---|---|
| Permissive agreement | 31 of 32 (96.9%) | 65 of 84 (77.4%) |
| Strict agreement | 15 of 16 | 33 of 50 (66.0%) |
| False rejections | 1 of 12 | 17 of 38 |

On the shared items, A2 matches A1 almost exactly (section 7). The drop is on the new items. There, most clear-ALIGNED pairs involve multi-part POs, broad POs, ILO steps, or CLOs outside the course description.

## 5. Technical validation: evidence, Bloom, consistency, recovery

**Evidence.** All 232 quote sides are verbatim, case-sensitive substrings of their own text. The validator, re-run on the saved answers, verifies all 116 judgements again. No quote was refused at any attempt.

The word-form changes seen in earlier runs did not recur. Those were "polynomials" for "polynomial" in A1 and "development" for "developing" in B1. This time `clo-po-nurs-unrelated` was quoted verbatim in both runs. Across all P2 runs so far, 3 of 275 returned judgements were refused for a quote, each for one changed word form.

**Bloom.**

- **Level rule.** No ALIGNED answer gives the CLO a level below the PO's or EGA's (0 of 30).
- **Level gaps.** On the 8 level-gap items, all 16 answers name the gap.
- **Changes between runs.** 9 of 58 items changed a level between runs. 7 of the changes are on the source side:
  - On three items with a multi-verb PO ("Design and evaluate…", "Design, implement and evaluate…"), the PO's level moved from Evaluate in run 1 to Create in run 2.
  - Two EGA names moved: "Critical and Creative thinker" went from Evaluate to Analyze, and "Socially Responsive Steward" from Evaluate to Apply.
  - The numbered PO list took the level of whichever item fit best.

  The other 2 changes are CLO or ILO ratings: `d-po-03` went from Apply to Create, and `d-ilo-12` from Create to Evaluate. Only 1 of the 9 coincides with a label change (`d-any-po-03`).
- **Repeated statements.** 5 of the 36 statements that appear more than once got different levels. All five are EGA names or the numbered PO list. Rating a noun phrase such as "Critical and Creative thinker" on Bloom's scale is a judgement call, and the level test for CLO-EGA depends on it.

**Run-to-run consistency.**

- **Labels:** they changed on 4 items, each between ALIGNED and PARTIALLY_ALIGNED and each a clear-ALIGNED item: `clo-po-prog-interdisciplinary`, `d-ega-03`, `d-any-po-01` and `d-any-po-03`. Their remedies changed with them.
- **Draft wording:** it varies more than the labels. On the 39 items with a draft in both runs, the two drafts share 57% of their words on average. The lowest are `d-ega-02` (17%) and `d-po-02` (21%).
- **Draft direction:** it is the same in both runs on every item but one. `d-po-06`'s second draft drops the cardiac topic that the first kept.

**Invalid answers and recovery.** No answer failed validation, so the stop at the 3rd failed answer was never close, and no re-ask was needed.

**Adaptive thinking engaged for the first time in P2.**

- **Where:** on 2 of 18 requests, #1 (1,742 thinking tokens) and #10 (1,735). Both carried the same batch, the first 12 calculus items, one in each run. The other 16 requests reported 0 thinking tokens.
- **Latency:** those two requests took 28.4 s and 25.4 s. The other 12-relationship batches took 12.7–13.5 s. This is why the p90 latency is 25.4 s.
- **Cost:** about $0.035 (3,477 output tokens at $10 per million).
- **Answers:** in that batch they agree with the labels on 22 of 24, a rate no different from the rest.
- **Why there:** the result cannot show why the model thought on that batch alone. It did so on the same input in both runs.

## 6. Recommendation quality (developer review, not faculty review)

I read all 116 explanations and all 82 drafts. Every answer that is not ALIGNED has a draft, because the legacy contract refuses a failing answer without one. I checked each draft against the rules fixed before the run and against the course and its year level.

| Result of the developer review | Drafts |
|---|---|
| No concern: the rewrite is the expected remedy and keeps the course's subject and level | 30 |
| A rewrite of an off-subject or below-college statement: some raise in level is expected, but faculty should set it | 9 |
| **Flagged for faculty review** | **43** |
| — rewrites an outcome the provisional label calls aligned (the 18 false rejections) | 18 |
| — bends a sound CLO toward the wrong PO or EGA (the re-tag candidates) | 6 |
| — replaces a plausible CLO's content (`d-po-06`, a remap candidate) | 2 |
| — duplicates an existing CLO | 2 |
| — raises an outcome to the PO's level, or replaces its competence, where a re-tag or a smaller change could keep it | 10 |
| — adds value terms (`d-ega-08`) | 2 |
| — an ILO draft repeats an existing ILO or restates its CLO | 3 |

Each flagged draft is counted once, under its main reason. Several have more than one.

### A. The 8 remap candidates (CLO–PO and CLO–EGA mapping)

**This is a limit of the recommendation contract.** Mode A has no `RETAG_OUTCOME`, so every failing CLO-PO or CLO-EGA answer must carry a rewrite of the CLO. None of the 16 answers below is counted as a verdict failure for carrying one, and all 16 verdicts agree with the labels.

The CLO and its course are in the first table; what the drafts do is in the second.

| Item | Course, year | The CLO, and the outcome it is tagged to | Provisional remedy | Verdicts |
|---|---|---|---|---|
| `clo-po-calc-unrelated` | MA 7, 1 | "Evaluate limits of rational functions.", tagged to a communication PO | RETAG | NOT / NOT |
| `clo-po-nurs-unrelated` | NCM 101, 1 | "Compute the derivative of polynomial functions." | REWRITE OR REMOVE | NOT / NOT |
| `clo-ega-unrelated` | IT 204, 2 | "Recite the history of the institution.", tagged to "Competent Professional" | REWRITE | NOT / NOT |
| `d-po-06` | NCM 101, 1 | "Identify the anatomical structures of the heart.", tagged to a therapeutic-communication PO | EITHER | NOT / NOT |
| `d-po-12` | NCM 101, 1 | "Apply the nursing process to assess a patient's vital signs.", tagged to a computing PO | RETAG | PARTIAL / PARTIAL |
| `d-ega-02` | MA 7, 1 | "Recite the multiplication table.", tagged to "Critical and Creative thinker" | REWRITE | NOT / NOT |
| `d-ega-04` | MA 7, 1 | "Compute the derivative of trigonometric functions.", tagged to "Socially Responsive Steward" | RETAG | NOT / NOT |
| `d-ega-06` | MA 7, 1 | "Solve quadratic equations.", tagged to "Transformative Lifelong learner" | EITHER | NOT / NOT |

| Item | What the drafts do | Assessment |
|---|---|---|
| `clo-po-calc-unrelated` | Keep the calculus and add communication: "…and communicate the steps and results effectively in written and oral form to peers and non-specialist audiences". Run 2 makes communication the main verb | **Forced fit.** A re-tag to the apply-mathematics PO would keep the CLO. A1 did the same |
| `clo-po-nurs-unrelated` | Replace it with "Perform basic nursing procedures safely … using the nursing process" | Right direction, but both drafts duplicate an existing course CLO (section B) |
| `clo-ega-unrelated` | Replace it with an object-oriented programming CLO | Right direction. Its level, Create, is above the EGA's Apply (section C). Run 2 shares about half its words with the course's existing "Design, implement and test object-oriented programs…" |
| `d-po-06` | Replace the anatomy with therapeutic communication. Run 1 keeps "a cardiac condition"; run 2 drops it | **Content replaced.** Heart anatomy is plausible in nursing fundamentals. Faculty should choose between a re-tag, a raise and this replacement |
| `d-po-12` | Keep 86% of the CLO and add "basic mathematics and computing skills to calculate, record and interpret" | **Forced fit:** it adds a computing competence to a sound nursing CLO. Neither explanation notices that the PO belongs to another program |
| `d-ega-02` | Replace it with a calculus analysis CLO | Right direction. The level (Evaluate, then Create) is for faculty to set |
| `d-ega-04` | Keep the derivative and add "engineering problems of community concern… the benefit of the solution to society" (run 1) or "serve community needs responsibly" (run 2) | **Forced fit.** The note fixed before the run warned that "adding social service to it would force the fit" |
| `d-ega-06` | Rewrite it for calculus, adding reflection and independent study | An acceptable rewrite for the course. Faculty should choose between this and a re-tag |

**In sum:**

- **The re-tag candidates.** For the 3 of them (6 answers), every draft bends a sound CLO toward the wrong outcome. Here the contract's limit becomes an academic problem: in the application today, each of these drafts would appear as a suggested revision.
- **The explanations.** None of the 16 says the mapping itself may be wrong.
- **The harness's count.** Its heuristic counts 8 of the 16 drafts as bringing in two or more of the PO's or EGA's words. It undercounts the EGA cases, because EGA names are only 2–5 words long.

### B. Duplicate CLO recommendations

The rule, fixed before the run: a draft counts as a duplicate if it is equal to another CLO of the same course, or shares at least 80% of its content stems with one (Jaccard ≥ 0.8). The draft's own original CLO is excluded.

| Answer | Original CLO | Draft |
|---|---|---|
| `clo-po-nurs-unrelated` run 1 | Compute the derivative of polynomial functions. | Perform basic nursing procedures safely on a simulated patient using the steps of the nursing process. |
| `clo-po-nurs-unrelated` run 2 | (the same) | Perform basic nursing procedures safely on individuals using the nursing process on a simulated patient. |

Both drafts duplicate the existing CLO "Perform basic nursing procedures safely using the nursing process on a simulated patient." (Jaccard 0.89 each). That CLO belongs to `clo-po-nurs-aligned`, `d-ilo-04` and `d-ilo-05`.

A1 had the same problem on the same item. **Neither draft should replace the original automatically.** The provisional remedy is "rewrite or remove", and a duplicate adds nothing to the course.

These checks were made after the run, outside the fixed rule:

- No ILO draft reaches 0.8 against another ILO.
- `d-ilo-05` run 1 ("Demonstrate correct hand hygiene before and after contact with a simulated patient…") repeats the competence of `d-ilo-04`'s ILO (Jaccard 0.60).
- The two `d-ilo-09` drafts restate their own CLO (0.55–0.60), so they are no longer a smaller step of it.
- The `d-po-09` drafts are close to another accounting CLO (up to 0.79). The original was already that close, so this overlap comes from the dataset.

### C. Bloom escalation

The rule, fixed before the run: flag a CLO draft whose verb level is above the CLO's and at or above the PO's or EGA's. It flagged 30 drafts, 15 per run.

| Group | Drafts | Items |
|---|---|---|
| The raise is the remedy the item calls for | 8 | `clo-po-calc-vague` × 2 (Understand → Apply), `d-po-10` × 2 (Remember → Apply), `d-po-13` × 2 (Understand → Apply), `d-po-14` × 2 (Remember → Apply) |
| **Raised to match the PO, where a re-tag or a smaller change could keep the outcome: flag for faculty** | 13 | listed below |
| A rewrite of an off-subject or below-college statement, where faculty should set the level | 9 | `clo-ega-unrelated` × 2 (→ Create, above the EGA's Apply), `d-ega-02` × 2 (→ Evaluate, Create), `d-any-ega-02` × 2 (→ Create, Analyze), `d-any-po-02` × 2 (→ Apply), `d-ega-06` run 2 (→ Evaluate) |

The 13 drafts in the flagged group:

| Item | Year | Original | Draft |
|---|---|---|---|
| `clo-po-calc-lower-level` × 2 | 1 | "Define the derivative" | design solutions (Create) |
| `d-po-02` × 2 | 1 | power rule (Apply) | design (Create) |
| `clo-po-prog-lower-level` × 2 | 2 | list keywords | design and evaluate |
| `d-po-08` × 2 | 3 | history of testing | design, administer and evaluate |
| `d-po-04` × 2 | 2 | write Python programs | analyze societal impact |
| `d-po-06` × 2 | 1 | heart anatomy | therapeutic communication |
| `d-po-03` run 1 | 2 | a web-application CLO | adds design and evaluation |

For this group, a re-tag would keep the outcome: to a PO at the CLO's own level, which for the calculus items is "Apply knowledge of mathematics…". The notes fixed before the run said so for `clo-po-calc-lower-level`, `d-po-02`, `clo-po-prog-lower-level` and `d-po-08`. Raising a year-1 recall or computation outcome to Create is a curriculum decision, not a wording fix, and the legacy contract cannot offer the re-tag.

In the table at the top of section 6, `d-po-06` × 2 is counted under content replacement and `d-po-03` run 1 under rewrites of aligned outcomes. That leaves 10 in this category there.

### D. Institutional values

- **No value reference was removed or replaced.** Only one CLO names values: `d-ega-07`, "show the Augustinian values of community and truth in patient care". Both runs judged it ALIGNED and left it unchanged.
- **No explanation proposed changing an EGA, a Marian or Augustinian value, or any institutional policy.**
- **`d-ega-08` adds value wording to a technical CLO.**
  - **The item.** The CLO is "Write a Python function that sorts a list", tagged to "Competent Catholic Augustinian-Marian Professional". The label accepts ALIGNED or PARTIALLY_ALIGNED and marks the item ambiguous, because the answer "depends on a definition the system does not hold". Claude said NOT_ALIGNED in both runs.
  - **Run 1's draft** adds "with integrity and humility". Humility is one of the six core-value names the checker uses (`values.js`: Compassion, Courage, Community-orientedness, Humility, Interiority, Missionary Spirit). Integrity is not.
  - **Run 2's draft** adds "using Augustinian-Marian values such as integrity and service to others". Neither term is one of the six, yet the draft presents both as Augustinian-Marian values.
  - **For faculty:** whether these terms are approved values, and whether value wording belongs in this CLO at all. Nothing was changed here.
- **The other EGA drafts add the EGA's ideas, not named values.** `d-ega-04` adds "community" and "society" to a calculus CLO (section A). `d-ega-03` run 1 adds responsible "use of resources" and narrows the outreach to basic nursing care.
- **Heuristic false alarms.** The values heuristic also flagged 4 drafts whose "values" are mathematical, such as "optimal values" and "values approaching a number". These are not value references.
- **A dataset observation (not changed).** `clo-ega-aligned` and `clo-ega-unrelated`, copied from eval-1.1, use "Competent Professional", which is not one of the school's four official EGA names.

### E. Unsupported academic changes (recorded apart from verdict accuracy)

An answer can appear in more than one row.

| Kind | Answers |
|---|---|
| Rewrites an outcome the provisional label calls aligned | 18: `clo-po-prog-interdisciplinary` run 1, `d-po-01` × 2, `d-po-03` × 2, `d-po-05` × 2, `d-po-07` × 2, `d-po-09` × 2, `d-ega-03` run 1, `d-ilo-01` × 2, `d-ilo-10` × 2, `d-any-po-01` run 2, `d-any-po-03` run 2 |
| Adds an unrelated competence | `d-po-12` × 2 (computing into nursing), `clo-po-calc-unrelated` × 2 (communication into calculus), `d-ega-04` × 2 (community service into calculus), `d-ega-08` × 2 (values into a coding task), `d-po-05` run 1 (patient and family teaching) |
| Changes the scope | `d-po-07` × 2 (one outcome becomes construct, administer and evaluate), `d-ilo-10` × 2 (the ILO grows into the whole CLO, serving guests), `d-ilo-09` × 2 (the ILO restates its CLO), `d-po-03` × 2 (adds design and evaluation), `clo-po-prog-interdisciplinary` run 1 (widened to individuals, organizations and society), `d-ega-03` run 1 (narrowed to basic nursing care), `d-any-po-03` run 2 (brings calculus into a team design CLO) |
| Replaces content | `d-po-01` × 2 (integration replaced by differentiation, to fit the course title), `d-any-po-01` run 2 (linear algebra replaced by limits and derivatives), `d-po-06` × 2 (anatomy replaced by communication), `d-po-04` × 2 (a programming task replaced by impact analysis), `d-po-08` × 2 (the history topic dropped) |
| Adds a detail the source does not state | "Philippine Financial Reporting Standards" where the CLO says "the applicable financial reporting standards" (`d-po-09` × 2, `d-po-10` run 2, `d-ilo-09` run 1). This is plausible for this school; faculty should confirm the wording |

**Why the aligned-outcome rewrites widen their scope.** The legacy prompt asks each draft to fix every gap it lists, so that the pair passes when it is checked again. Once Claude judges a pair partial, its draft therefore adds the PO's missing parts.

Mode B's Stage A wording differs here. It adds "add nothing from the PO that the CLO does not need: never copy the PO's qualifiers, constraints or lists of examples into the draft". B2 will show whether that changes these drafts.

## 7. Comparison with A1 on the 16 shared items

The 16 items have the same ids, texts and accepted verdicts in both datasets. Only their batch neighbours differ: in A2 they share batches with the new items of the same course.

| Measure | A1 | A2 |
|---|---|---|
| Agreement | 31 of 32 | 31 of 32 |
| Disagreement | `clo-po-prog-interdisciplinary`: PARTIALLY_ALIGNED, then ALIGNED | The same. Run 1's draft is word for word A1's |
| Labels | — | Different on 1 item: `clo-po-calc-lower-level` was PARTIAL, then NOT in A1, and NOT both times in A2. Both labels are accepted |
| Bloom levels | — | Different on 1 item: `clo-po-prog-lower-level` run 1 rated the PO "Design and evaluate…" Evaluate (A1: Create) |
| Remedies | — | None different |
| Drafts | — | The same direction on every item. The wording differs (Jaccard 0.18–1.00) |

**The same recommendation problems recur on the same items:**

- `clo-po-calc-unrelated` is rewritten into communication;
- `clo-po-calc-lower-level` is escalated to design;
- `clo-po-nurs-unrelated` duplicates the course's CLO.

**No model change is claimed, and none could be.** Both runs used the same model and the same prompt, and both are scored against the same provisional labels. The overall gap between A1 (98.8%) and A2 (82.8%) comes from the datasets.

**MiniMax.** No MiniMax result exists for the alignment split. The baseline on record (`docs/ai-eval-baseline-prompt10.json`) ran eval-1 and keeps summary figures and its disagreements, not answers per item. On eval-1, MiniMax's only disagreement was `clo-po-prog-interdisciplinary`, PARTIALLY_ALIGNED in all 3 runs (A1 report, section 6). MiniMax, A1 and A2 all disagree with the label on that item.

## 8. Requests, tokens, latency and cost

| Requests (run 1 / run 2) | Batch | Relationships | Latency | Output tokens (thinking) |
|---|---|---|---|---|
| #1 / #10 | calculus, part 1 | 12 | 28.4 s / 25.4 s | 4,030 (1,742) / 4,091 (1,735) |
| #2 / #11 | calculus, part 2 | 8 | 12.2 s / 15.3 s | 1,843 / 2,365 |
| #3 / #12 | operations research | 1 | 1.6 s / 1.6 s | 142 / 152 |
| #4 / #13 | programming, part 1 | 12 | 13.5 s / 12.7 s | 2,232 / 2,104 |
| #5 / #14 | programming, part 2 | 1 | 2.0 s / 2.0 s | 175 / 177 |
| #6 / #15 | nursing | 11 | 14.6 s / 14.5 s | 2,293 / 2,147 |
| #7 / #16 | education | 6 | 9.5 s / 9.2 s | 1,363 / 1,317 |
| #8 / #17 | accounting | 4 | 7.1 s / 7.4 s | 961 / 1,017 |
| #9 / #18 | hospitality | 3 | 5.6 s / 6.2 s | 731 / 671 |

- **Requests:** 18 of the 40 allowed. All returned HTTP 200 with `end_turn`, from `claude-sonnet-5-5`. The ledger's 18 request ids match the result's.
- **Tokens:**
  - input 12,724;
  - cache write 3,728: the system prompt, written once, by #1;
  - cache read 63,376: the other 17 requests, including run 2's first, so the cache stayed warm between runs;
  - output 27,811, of which thinking 3,477. That is 240 output tokens per relationship, or 210 without thinking.
- **Latency:** median 9.2 s, p90 25.4 s, max 28.4 s. Without the two thinking requests, the maximum is 15.3 s.
- **Cost:**
  - The estimate at published prices is $0.3192156. The guard charged $0.3255532. The $0.0063376 difference is exactly the guard's cache-read margin: $0.20 instead of $0.10 per million, on 63,376 tokens.
  - The conservative rule would have charged $0.525448.
  - That is $0.0028 per verified relationship and $0.018 per request, at the low end of the plan's $0.32–1.30.
  - A1 cost $0.0024 per relationship. A2 costs more because of the thinking and the longer explanations on harder items.
- **Reservations:** the guard reserved $0.2123–0.2198 per request before sending it, and released the reservation when the answer settled.

**Remaining budget:**

- A2 used $0.3256 of its $1.40 cap and 18 of its 40 requests. The unused $1.0744 does not carry over.
- The spend register holds $0.8287104 of $10:

  | Run | Charge |
  |---|---|
  | P1 | $0.019372 |
  | A3 | $0.06535 |
  | B1 | $0.2181312 |
  | A1 | $0.200304 |
  | A2 | $0.3255532 |

  That leaves **$9.1712896**. If B2 later used its whole planned cap of $1.90, $7.27 would remain.
- These are the guard's own figures, not Anthropic's invoice. The Console's usage page is what counts.

## 9. Remaining academic risks

1. **The labels are provisional.** A developer wrote every expected verdict, and faculty have reviewed none. Agreement is not accuracy.
2. **The prompt and the labels disagree on a policy question.** Must a CLO show every part of a multi-part or broad PO to count as aligned? This single question explains half of the false rejections. Until faculty decide it, neither A2's 36% false-rejection rate nor A1's 3.6% describes how the checker would treat faculty CLOs.
3. **One verdict mixes two questions.** The prompt asks Claude to judge each pair "as part of THIS subject". So a CLO outside the course description gets a lower CLO-PO verdict even when it fits the PO.
4. **ILO-CLO verdicts are inconsistent.** The prompt's multi-part rule conflicts with its "smaller step" test, and `d-ilo-01` got a label its own explanation contradicts. Nothing in the pipeline catches this.
5. **The legacy contract forces rewrites where a re-tag is right.** In the application today, these drafts would appear as suggested revisions that bend sound CLOs toward the wrong PO or EGA. In several cases they would also raise a year-1 outcome to design level.
6. **Drafts can duplicate existing CLOs or ILOs.** Nothing in the pipeline checks a draft against the course's other statements.
7. **Drafts' value wording is not checked against the approved list.** On `d-ega-08`, drafts present terms outside the six core-value names as Augustinian-Marian values.
8. **Bloom levels for EGA names and multi-verb POs are unstable,** and the level test depends on them.
9. **The sample is small:** 58 items and 2 runs, with only 1–4 items in four of the seven courses. Two runs of the same item are not independent, and no conclusion per discipline is possible.
10. **When adaptive thinking engages cannot be predicted.** It engaged on one batch and roughly doubled that batch's latency. Its effect on the verdicts cannot be separated from the batch's content.
11. **The insufficient-evidence path is untested.** No A2 item exercises it.

## 10. Recommendation on B2

**Proceed with B2 under a separate authorization, as planned:**

- dataset flags `--dataset alignment --split dev --stage-a --stage-b3`;
- 2 runs, `--budget 75`, `--max-cost 1.90`;
- `--total-cap 2.728710` (the register's $0.8287104 plus $1.90, rounded down);
- the same 58 development items and the same model and settings as A2.

**Why:**

- **Reliability is established.** A2 had 0 failed requests, 0 invalid answers and 0 quote refusals, and it cost $0.33.
- **A2 is preserved as the paired baseline.** `p2-a2-cases.json` holds, for every case, the texts, verdicts, quotes, Bloom levels, remedies, drafts, failures and request metadata, with the hashes of its sources.
- **Only B2 can test whether mode B's contract fixes the problems documented here.** B2 adds three things:
  - `RETAG_OUTCOME` for the 3 re-tag candidates (6 answers);
  - the rule "add nothing from the PO that the CLO does not need", for the drafts that widen scope;
  - the ILO re-tag (Stage B3), for the ILO-CLO items.

**What B2 cannot answer.** B2 keeps the base prompt's multi-part and course-subject rules, so its verdicts on the 11 disputed items may well look like A2's.

- Compare B2 with A2 item by item: both right, only A2 right, only B2 right, both wrong.
- Keep verdict agreement apart from recommendation quality.
- Do not read a difference as a model improvement. Both arms are the same model, scored against the same provisional labels.

**Decide before B2:**

1. **The invalid-answer stop.** For comparability with A2, I recommend keeping `--max-invalid 3` and accepting that B2 may stop early for review. The pilot report noted this risk: B1 had 2 recovered quote refusals in 18 requests, and B2 sends about 34.
2. **Faculty review of the disputed items.** This is optional and free, and it does not block B2.
   - **What a reviewer would rule on:** the 11 items behind the 18 false rejections, above all the multi-part PO question, and the 8 remap candidates.
   - **How to record it:** separately, without editing the dataset.
   - **Effect:** the rulings would then apply equally to A2 and B2.

**Not recommended:**

- any change to the production configuration;
- any use of the held-out split;
- any prompt change based on these results before B2.

## 11. Files and integrity

**New files (nothing was overwritten):**

| File | What it holds | Size | sha256 (first 16) |
|---|---|---|---|
| `docs/ai-eval-anthropic/p2-a2-result.json` | the harness's result, including the raw answers | 214,840 bytes | `082284ac04284ac1` |
| `docs/ai-eval-anthropic/p2-a2-ledger.json` | the guard's ledger | 16,318 bytes | `23709c09c1ef83b9` |
| `docs/ai-eval-anthropic/p2-a2-cases.json` | a read-only case record for B2, derived offline from the two files above and the development split, with their hashes | 146,292 bytes | `73c27948f75cb1b7` |
| `docs/anthropic-p2-a2-report.md` | this report | — | — |

The harness also updated `docs/ai-eval-anthropic/spend-register.json`.

**Snapshot comparison.** 652 files were hashed before the run and 655 after. The only differences are the three new A2 files and the spend register. The git diff hash is unchanged, so no tracked file changed, and HEAD is still `68926cb`.

**Unchanged:**

- the alignment dataset and its labels (`align-1`, sha256 `ab282a107df8c73b…`);
- the general dataset;
- the MiniMax results;
- the P1, A3, B1 and A1 results;
- the faculty-review data;
- the prompt and the validator;
- the 47 rules and their pass mark of 79;
- the scoring, the deductions, the submission gates and the curriculum policies;
- `server/.env`, whose sha256 prefix is `9e8eb0103c0aae56` before and after.

**Production lock.** The approval switch is unset, and the official check reports `configured: false`, even with a valid-format key in place.

**Housekeeping.** No held-out log exists, no spend-register lock remains, and nothing is staged or committed.
