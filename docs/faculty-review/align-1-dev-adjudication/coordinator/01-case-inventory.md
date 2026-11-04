# Unique-case disagreement inventory (restricted)

**Restricted to the review coordinator.** This document names the evaluation arms, and shows the software's verdicts, explanations and drafts and the developer's provisional verdicts. Do not give it to case reviewers before they have returned Parts A and B.

**Agreement here is with provisional, developer-written verdicts. It is not faculty-validated accuracy.** No verdict in this document has been reviewed by faculty. Where an answer differs from a provisional verdict, the inventory does not assume that either is right.

## Scope
The inventory covers all 58 cases in the development split of align-1, each once. No two cases share both texts, and the held-out split was not read.

| Set | Cases | Meaning | Where |
|---|---|---|---|
| 1 | 18 | At least one A2 or B2 answer is outside the provisional labels | Section 1, full records |
| 2 | 26 | All answers are within the provisional labels, but the labels vary between answers, or a recommendation raises a question (a re-mapping, a pre-registered remap or level-gap note, or a draft flagged by a pre-registered rule) | Section 2, full records |
| 3 | 14 | No disagreement and no flagged recommendation | Section 3, summary only |

False rejections (an answer other than ALIGNED where ALIGNED is the only provisional label): A2 18 of 50 answers, B2 27 of 50. False approvals: none in either arm.

**Evaluations compared**

| Arm | Model (as recorded; Anthropic's direct API) | Prompt | Mode | Dataset | Runs | Ran (UTC) | Saved record |
|---|---|---|---|---|---|---|---|
| A2 | `anthropic/claude-sonnet-5-5` | `alignment-10` | A (legacy academic alignment benchmark) | align-1, development split (58) | 2 | 2026-10-27T19:11:27.945Z | `docs/ai-eval-anthropic/p2-a2-cases.json` (sha256 `73c27948f75cb1b7`) |
| B2 | `anthropic/claude-sonnet-5-5` | `alignment-12a3-r7` | B (enhanced staged semantic evaluation; stages a, b3) | align-1, development split (58) | 2 | 2026-10-27T19:58:25.397Z | `docs/ai-eval-anthropic/p2-b2-cases.json` (sha256 `ef984e44cd49667a`) |

A1 (the same model and the A2 prompt on the eval-1.1 dataset, 2026-10-27T18:50:34.142Z) is quoted only for the 16 cases copied from eval-1.1.

## Summary of all 58 cases
Verdicts: A = aligned, P = partially aligned, N = not aligned; FR = false rejection against the provisional labels; ✗ = otherwise outside them.

| Code | Case id | Set | Type | Provisional labels | A2 run 1 / 2 | B2 run 1 / 2 | Part B proposals | Policy questions |
|---|---|---|---|---|---|---|---|---|
| MA7-01 | `clo-po-calc-lower-level` | 2 | CLO-PO | P or N | N / N | N / N | 4 | P5 |
| MA7-02 | `clo-po-calc-unrelated` | 2 | CLO-PO | N or P | N / N | N / N | 3 | P5 |
| MA7-03 | `d-po-02` | 2 | CLO-PO | N or P | N / N | N / N | 3 | P5 |
| MA7-04 | `clo-po-calc-aligned` | 3 | CLO-PO | A | A / A | A / A | – | – |
| MA7-05 | `d-po-01` | 1 | CLO-PO | A | P (FR) / P (FR) | P (FR) / P (FR) | 4 | P1, P4 |
| MA7-06 | `clo-po-calc-vague` | 2 | CLO-PO | P or N | P / P | P / P | 3 | – |
| MA7-07 | `d-any-po-01` | 1 | CLO-anyPO | A | A / P (FR) | P (FR) / P (FR) | 3 | P1, P4 |
| MA7-08 | `d-any-po-03` | 1 | CLO-anyPO | A | A / P (FR) | P (FR) / A | 2 | P1, P4 |
| MA7-09 | `d-any-po-02` | 2 | CLO-anyPO | N or P | N / N | N / N | 4 | – |
| MA7-10 | `d-ega-04` | 2 | CLO-EGA | N or P | N / N | N / N | 3 | P5 |
| MA7-11 | `d-ega-06` | 2 | CLO-EGA | N or P | N / N | N / N | 4 | P4, P5, P7 |
| MA7-12 | `d-ega-01` | 3 | CLO-EGA | A | A / A | A / A | – | P3 |
| MA7-13 | `d-ega-02` | 2 | CLO-EGA | N or P | N / N | N / N | 4 | P5 |
| MA7-14 | `d-any-ega-02` | 2 | CLO-anyEGA | N or P | N / N | N / N | 4 | – |
| MA7-15 | `d-ilo-01` | 1 | ILO-CLO | A | N (FR) / N (FR) | P (FR) / P (FR) | 4 | P2, P7 |
| MA7-16 | `ilo-clo-calc-aligned` | 3 | ILO-CLO | A | A / A | A / A | – | P2 |
| MA7-17 | `d-ilo-14` | 3 | ILO-CLO | P | P / P | P / P | 4 | P2 |
| MA7-18 | `ilo-clo-claims-more` | 2 | ILO-CLO | P or N | P / P | P / P | 4 | – |
| MA7-19 | `ilo-clo-unrelated` | 2 | ILO-CLO | N | N / N | N / N | 4 | – |
| MA7-20 | `d-ilo-12` | 2 | ILO-CLO | P or N | N / N | N / N | 4 | – |
| IE310-01 | `d-ilo-13` | 3 | ILO-CLO | A | A / A | A / A | – | – |
| IT204-01 | `d-po-03` | 1 | CLO-PO | A | P (FR) / P (FR) | P (FR) / P (FR) | 3 | P1, P7 |
| IT204-02 | `clo-po-prog-aligned` | 3 | CLO-PO | A | A / A | A / A | – | – |
| IT204-03 | `d-po-04` | 2 | CLO-PO | N or P | N / N | N / N | 3 | P5 |
| IT204-04 | `clo-po-prog-two-skills` | 3 | CLO-PO | P or N (ambiguous) | P / P | P / P | 4 | P1 |
| IT204-05 | `clo-po-prog-interdisciplinary` | 1 | CLO-PO | A | P (FR) / A | P (FR) / P (FR) | 3 | P1, P4 |
| IT204-06 | `clo-po-prog-lower-level` | 2 | CLO-PO | P or N | N / N | N / N | 4 | – |
| IT204-07 | `clo-ega-aligned` | 3 | CLO-EGA | A or P (ambiguous) | A / A | A / A | – | P3 |
| IT204-08 | `d-ega-08` | 1 | CLO-EGA | A or P (ambiguous) | N (✗) / N (✗) | N (✗) / N (✗) | 3 | P3, P5, P6, P7 |
| IT204-09 | `clo-ega-unrelated` | 2 | CLO-EGA | N or P | N / N | N / N | 4 | P5 |
| IT204-10 | `d-any-ega-01` | 1 | CLO-anyEGA | A | A / A | A / P (FR) | 1 | P3, P4 |
| IT204-11 | `d-ilo-02` | 1 | ILO-CLO | A | A / A | A / P (FR) | 1 | P2, P7 |
| IT204-12 | `ilo-clo-prog-aligned` | 1 | ILO-CLO | A | A / A | P (FR) / A | 1 | P2 |
| IT204-13 | `d-ilo-03` | 2 | ILO-CLO | P or N (ambiguous) | N / N | N / N | 3 | P5 |
| NCM101-01 | `clo-po-nurs-unrelated` | 2 | CLO-PO | N | N / N | N / N | 4 | P5 |
| NCM101-02 | `clo-po-nurs-aligned` | 3 | CLO-PO | A | A / A | A / A | – | – |
| NCM101-03 | `d-po-05` | 1 | CLO-PO | A | P (FR) / P (FR) | P (FR) / P (FR) | 3 | P1, P4 |
| NCM101-04 | `d-po-06` | 2 | CLO-PO | N | N / N | N / N | 4 | P4, P5 |
| NCM101-05 | `d-po-13` | 2 | CLO-PO | P | P / P | P / P | 3 | – |
| NCM101-06 | `d-po-12` | 2 | CLO-PO | N or P | P / P | N / N | 3 | P5 |
| NCM101-07 | `d-ega-03` | 1 | CLO-EGA | A | P (FR) / A | P (FR) / N (FR) | 3 | P3, P4, P7 |
| NCM101-08 | `d-ega-07` | 1 | CLO-EGA | A | A / A | P (FR) / P (FR) | 2 | P3, P6, P7 |
| NCM101-09 | `d-ilo-05` | 2 | ILO-CLO | N or P | N / N | N / N | 3 | – |
| NCM101-10 | `d-ilo-15` | 2 | ILO-CLO | P | P / P | P / P | 4 | P2 |
| NCM101-11 | `d-ilo-04` | 1 | ILO-CLO | A | A / A | P (FR) / A | 1 | P2 |
| EDUC105-01 | `d-po-14` | 2 | CLO-PO | P | P / P | P / P | 4 | – |
| EDUC105-02 | `d-po-07` | 1 | CLO-PO | A | P (FR) / P (FR) | P (FR) / P (FR) | 4 | P1 |
| EDUC105-03 | `d-po-08` | 2 | CLO-PO | P or N (ambiguous) | N / N | N / N | 4 | P4 |
| EDUC105-04 | `d-ega-05` | 3 | CLO-EGA | A | A / A | A / A | – | P3, P7 |
| EDUC105-05 | `d-ilo-07` | 3 | ILO-CLO | A or P (ambiguous) | P / P | P / P | 4 | P2 |
| EDUC105-06 | `d-ilo-06` | 1 | ILO-CLO | A | A / A | P (FR) / P (FR) | 2 | P2 |
| ACCTG201-01 | `d-po-10` | 2 | CLO-PO | P or N | N / N | N / N | 4 | – |
| ACCTG201-02 | `d-po-09` | 1 | CLO-PO | A | P (FR) / P (FR) | P (FR) / P (FR) | 3 | P1 |
| ACCTG201-03 | `d-ilo-08` | 3 | ILO-CLO | A or P (ambiguous) | P / P | P / P | 4 | P2 |
| ACCTG201-04 | `d-ilo-09` | 2 | ILO-CLO | N or P | N / N | N / N | 4 | P5 |
| HM210-01 | `d-po-11` | 3 | CLO-PO | A | A / A | A / A | – | – |
| HM210-02 | `d-ilo-11` | 3 | ILO-CLO | N | N / N | N / N | 4 | – |
| HM210-03 | `d-ilo-10` | 1 | ILO-CLO | A | P (FR) / P (FR) | A / A | 2 | P2 |

## Section 1. Verdict disputes (Set 1, 18 cases)

### MA7-05 · `d-po-01` (Set 1)

- **Course context:** MA 7 Differential Calculus (BSIE, year 1); a test record. Description: "Limits, continuity, derivatives and their applications to engineering problems." BSIE 2022-2023 curriculum: MA 7 DIFFERENTIAL CALCULUS, year 1, 1st semester, 3 lecture and 0 laboratory units, prerequisite (blank in the source).
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Apply knowledge of mathematics and science to solve complex engineering problems.

- **Target (verbatim):**

> Use integration techniques to compute areas and volumes that arise in engineering problems.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned · category different-wording. Rationale: "Different words ('use integration to compute' vs 'apply knowledge to solve') for the same competency."
- **Faculty forms:** Part A MA7-05; Part B MA7-05-R1, MA7-05-R2, MA7-05-R3, MA7-05-R4.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Partially aligned | false rejection | Apply → Apply | rewrite |
| A2 | 2 | Partially aligned | false rejection | Apply → Apply | rewrite |
| B2 | 1 | Partially aligned | false rejection | Apply → Apply | rewrite |
| B2 | 2 | Partially aligned | false rejection | Apply → Apply | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Apply knowledge of mathematics and science" · target quote "Use integration techniques to compute areas and volumes"
  - Explanation: The CLO applies mathematics (Apply) to engineering problems, so it matches the PO's verb, level and subject. However, integration for areas and volumes is integral calculus. It is not a topic of Differential Calculus (limits, continuity, derivatives), so the CLO does not fit this course.
  - Draft: "Use derivatives to compute rates of change and optimal values that arise in engineering problems."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **A2 run 2.** Source quote "Apply knowledge of mathematics and science to solve complex engineering problems" · target quote "Use integration techniques to compute areas and volumes"
  - Explanation: The verb and engineering context match the PO's apply-mathematics-to-engineering-problems. But the CLO's subject is integration (areas and volumes), which falls outside this Differential Calculus course (limits, continuity, derivatives), so it does not fit the course's own subject.
  - Draft: "Use differentiation techniques to compute rates of change and optimal values that arise in engineering problems."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 1.** Source quote "Apply knowledge of mathematics and science to solve complex engineering problems." · target quote "Use integration techniques to compute areas and volumes"
  - Explanation: The CLO uses mathematics on engineering problems at an Apply level, which matches the PO verb in general. Gaps: (1) its subject is integration (areas and volumes), which is outside Differential Calculus (limits, continuity, derivatives), so the CLO itself does not fit this course. (2) It does not show the PO's "complex engineering problems" or any use of science. The CLO text needs to change and the PO tag is not the problem.
  - Draft: "Apply differentiation techniques to solve engineering problems involving rates of change and optimization."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 2.** Source quote "Apply knowledge of mathematics and science to solve complex engineering problems." · target quote "Use integration techniques to compute areas and volumes that arise in engineering problems."
  - Explanation: The CLO (target) uses a verb (use/compute) at Apply level and its subject is mathematics applied to engineering problems, which fits the PO (source). But its subject matter is integration (areas and volumes), which is not part of Differential Calculus (limits, continuity, derivatives), so it does not belong to this course. It also states only routine computation and does not show solving complex engineering problems.
  - Draft: "Use differentiation techniques to solve rate-of-change and optimization problems that arise in engineering."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.

**Reason for disagreement.** All four answers are PARTIALLY_ALIGNED at Apply → Apply. Both arms place integration outside a differential calculus course (course fit); B2 adds that the CLO shows neither "complex" engineering problems nor any use of science, and B2 run 2 that it states only routine computation. The provisional label reads using integration on engineering problems as the PO's competence in other words. The registrar curriculum lists MA 8 Integral Calculus as a separate course after MA 7; that bears on course fit, not on the CLO–PO relationship as such.

**Policy questions:** P1, coverage or contribution (CLO and PO); P4, course fit and year level. **Case question:** Judged against the PO alone, does the CLO align? Separately, does an integration CLO belong in MA 7, and should that affect the alignment verdict?

### MA7-07 · `d-any-po-01` (Set 1)

- **Course context:** MA 7 Differential Calculus (BSIE, year 1); a test record. Description: "Limits, continuity, derivatives and their applications to engineering problems." BSIE 2022-2023 curriculum: MA 7 DIFFERENTIAL CALCULUS, year 1, 1st semester, 3 lecture and 0 laboratory units, prerequisite (blank in the source).
- **Relationship type:** CLO-anyPO. Source: Program outcomes (the whole list). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> 1. Apply knowledge of mathematics and science to solve complex engineering problems.
> 2. Design solutions for complex engineering problems that meet specified needs.
> 3. Function effectively as a member or leader of a team.
> 4. Communicate effectively on complex engineering activities with the engineering community and society.
> 5. Recognize the need for, and engage in, independent and lifelong learning.

- **Target (verbatim):**

> Solve systems of linear equations using matrix methods.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned · category whole-list. Rationale: "Fits PO 1; it need not fit the others."
- **Faculty forms:** Part A MA7-07; Part B MA7-07-R1, MA7-07-R2, MA7-07-R3.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Aligned | agrees | Apply → Apply | no change |
| A2 | 2 | Partially aligned | false rejection | Apply → Apply | rewrite |
| B2 | 1 | Partially aligned | false rejection | Apply → Apply | rewrite |
| B2 | 2 | Partially aligned | false rejection | Apply → Apply | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Apply knowledge of mathematics and science to solve complex engineering problems." · target quote "Solve systems of linear equations using matrix methods."
  - Explanation: PO 1: solving linear systems with matrix methods applies mathematics to solve problems.
- **A2 run 2.** Source quote "1. Apply knowledge of mathematics and science to solve complex engineering problems." · target quote "Solve systems of linear equations using matrix methods."
  - Explanation: PO 1 fits best: the CLO applies mathematics (matrix methods) to solve problems, so it shares the verb 'solve' and the mathematics subject. But it lacks the engineering context ('complex engineering problems') and, being a linear algebra topic, it is not part of Differential Calculus. The draft adds the engineering problems and the calculus subject.
  - Draft: "Apply knowledge of mathematics, including limits and derivatives, to solve complex engineering problems such as rates of change and optimization."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome; replacement (keeps 17% of the original).
- **B2 run 1.** Source quote "Apply knowledge of mathematics and science to solve complex engineering problems" · target quote "Solve systems of linear equations using matrix methods"
  - Explanation: PO 1 is the best fit. It asks the student to apply mathematics to solve complex engineering problems. The CLO shares the verb 'solve' and the mathematics subject, but it has gaps. (1) It names no engineering problem or context. (2) It states no complexity, only a routine matrix exercise. (3) It shows no application, since it only solves systems of equations as a computation. The other POs (design, teamwork, communication, lifelong learning) are not developed by the CLO.
  - Draft: "Apply matrix methods to solve systems of linear equations that model engineering problems."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 2.** Source quote "Apply knowledge of mathematics and science to solve complex engineering problems" · target quote "Solve systems of linear equations using matrix methods"
  - Explanation: PO 1 is the best fit: the CLO's 'Solve' matches 'solve' and it uses mathematics. The target CLO does not state any engineering problem, so the 'engineering problems' part of PO 1 is missing. It also lies outside this differential calculus course (limits, derivatives and applications). The other POs (2-5) are not built by it either.
  - Draft: "Apply differentiation and matrix methods to solve engineering problems involving rates of change and systems of linear equations."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.

**Reason for disagreement.** A2 answered ALIGNED, then PARTIALLY_ALIGNED; B2 PARTIALLY_ALIGNED twice. B2 names PO 1 as the best fit but says the CLO names no engineering problem, complexity or application; B2 run 2, like A2 run 2 (A2 report: the CLO lies outside the course's stated subject), adds that the CLO lies outside a differential calculus course. The provisional label reads fitting PO 1 as sufficient for a list case.

**Policy questions:** P1, coverage or contribution (CLO and PO); P4, course fit and year level. **Case question:** Does solving systems of linear equations by matrix methods align with "apply knowledge of mathematics … to solve complex engineering problems" without a stated engineering context? Separately, does such a CLO belong in MA 7?

### MA7-08 · `d-any-po-03` (Set 1)

- **Course context:** MA 7 Differential Calculus (BSIE, year 1); a test record. Description: "Limits, continuity, derivatives and their applications to engineering problems." BSIE 2022-2023 curriculum: MA 7 DIFFERENTIAL CALCULUS, year 1, 1st semester, 3 lecture and 0 laboratory units, prerequisite (blank in the source).
- **Relationship type:** CLO-anyPO. Source: Program outcomes (the whole list). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> 1. Apply knowledge of mathematics and science to solve complex engineering problems.
> 2. Design solutions for complex engineering problems that meet specified needs.
> 3. Function effectively as a member or leader of a team.
> 4. Communicate effectively on complex engineering activities with the engineering community and society.
> 5. Recognize the need for, and engage in, independent and lifelong learning.

- **Target (verbatim):**

> Collaborate with a team to design a prototype that meets stated requirements.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned · category whole-list. Rationale: "Fits PO 2 and PO 3."
- **Faculty forms:** Part A MA7-08; Part B MA7-08-R1, MA7-08-R2.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Aligned | agrees | Apply → Create | no change |
| A2 | 2 | Partially aligned | false rejection | Create → Create | rewrite |
| B2 | 1 | Partially aligned | false rejection | Apply → Create | rewrite |
| B2 | 2 | Aligned | agrees | Apply → Create | no change |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Function effectively as a member or leader of a team." · target quote "Collaborate with a team to design a prototype"
  - Explanation: PO 3 and PO 2: the CLO has team collaboration and design to requirements.
- **A2 run 2.** Source quote "2. Design solutions for complex engineering problems that meet specified needs." · target quote "Collaborate with a team to design a prototype that meets stated requirements."
  - Explanation: PO 2 fits best: the CLO designs a prototype to meet requirements, so it shares the verb 'design' and the 'meets stated requirements' idea. It is not tied to complex engineering problems, and it has no calculus subject matter (Differential Calculus), which is not covered. PO 3 (teamwork) is also matched by 'collaborate', but the CLO is about a prototype design and not about leading or functioning in a team. The draft adds the engineering problem and calculus.
  - Draft: "Design, with a team, solutions to complex engineering problems that meet specified needs, using derivatives to model and optimize the design."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 1.** Source quote "Function effectively as a member or leader of a team." · target quote "Collaborate with a team to design a prototype that meets stated requirements."
  - Explanation: The CLO (target) matches PO 3 ('Function effectively as a member or leader of a team') through 'Collaborate with a team', and the PO 2 verb 'design' through 'design a prototype that meets stated requirements'. However, it states no calculus content, so it does not belong to this course's subject. It also never states that the design is of a solution to a complex engineering problem. Its subject is therefore not that of PO 2, and teamwork is the only competence it shows for PO 3.
  - Draft: "Collaborate with a team to design a solution to an engineering problem by applying derivatives to meet stated requirements."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 2.** Source quote "Function effectively as a member or leader of a team." · target quote "Collaborate with a team to design a prototype"
  - Explanation: PO 3 is met: the CLO has the student collaborate with a team (function as a team member), and it also designs a prototype, which fits PO 2.

**Reason for disagreement.** Each arm answered ALIGNED in one run and PARTIALLY_ALIGNED in the other (A2 run 2, B2 run 1); the PARTIALLY_ALIGNED answers cite course fit, because the CLO has no calculus content. B2 run 2 found PO 3 met and PO 2 fitting. The provisional label reads fitting PO 2 and PO 3 as sufficient.

**Policy questions:** P1, coverage or contribution (CLO and PO); P4, course fit and year level. **Case question:** Is a team design CLO aligned with an engineering program's design and teamwork POs when it has no calculus content? Separately, does it belong in MA 7?

### MA7-15 · `d-ilo-01` (Set 1)

- **Course context:** MA 7 Differential Calculus (BSIE, year 1); a test record. Description: "Limits, continuity, derivatives and their applications to engineering problems." BSIE 2022-2023 curriculum: MA 7 DIFFERENTIAL CALCULUS, year 1, 1st semester, 3 lecture and 0 laboratory units, prerequisite (blank in the source).
- **Relationship type:** ILO-CLO. Source: Course learning outcome (CLO). Target: Intended learning outcome (ILO).
- **Source (verbatim):**

> Apply differentiation rules to solve optimization problems in engineering.

- **Target (verbatim):**

> Differentiate polynomial and trigonometric functions.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned · category different-wording. Rationale: "A needed step toward applying the rules; different wording."
- **Faculty forms:** Part A MA7-15; Part B MA7-15-R1, MA7-15-R2, MA7-15-R3, MA7-15-R4.
- **Same CLO in:** MA7-04 (`clo-po-calc-aligned`), MA7-16 (`ilo-clo-calc-aligned`), MA7-17 (`d-ilo-14`), MA7-19 (`ilo-clo-unrelated`).

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | false rejection | Apply → Apply | rewrite |
| A2 | 2 | Not aligned | false rejection | Apply → Apply | rewrite |
| B2 | 1 | Partially aligned | false rejection | Apply → Apply | rewrite |
| B2 | 2 | Partially aligned | false rejection | Apply → Apply | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Apply differentiation rules to solve optimization problems in engineering." · target quote "Differentiate polynomial and trigonometric functions."
  - Explanation: The source CLO asks to apply differentiation rules to solve engineering optimization problems (Apply, optimization). The ILO only says to differentiate polynomial and trig functions. This is a lower step (Apply of routine differentiation) in the same subject. It builds toward the CLO but is not stated as optimization, and the ILO contains no engineering context. The ILO does not claim more than the CLO, but it should be a smaller step of the CLO. The gap is that it names only the differentiation skill and omits the optimization and engineering application.
  - Draft: "Apply differentiation rules to polynomial and trigonometric functions as a step toward setting up and solving simple engineering optimization problems."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **A2 run 2.** Source quote "Apply differentiation rules to solve optimization problems in engineering." · target quote "Differentiate polynomial and trigonometric functions."
  - Explanation: Here the source is the CLO and the target the ILO. The ILO (differentiate polynomial and trigonometric functions) is a smaller prerequisite step in the same subject, so it builds toward the CLO. However, the CLO is about solving engineering optimization problems, and the ILO only differentiates functions, so the match is incomplete: it does not name differentiation rules, optimization or engineering context. As a step it reaches Apply, the CLO's own level, but it does not show the optimization or engineering application, so it claims less than needed and is only a partial step.
  - Draft: "Apply differentiation rules to polynomial and trigonometric functions as a step toward setting up and solving simple optimization problems in engineering."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 1.** Source quote "Apply differentiation rules to solve optimization problems in engineering" · target quote "Differentiate polynomial and trigonometric functions"
  - Explanation: The source (CLO) asks the student to apply differentiation rules to solve optimization problems in engineering, at Apply level. The target (ILO) only asks the student to differentiate polynomial and trigonometric functions. It is the same subject and builds toward the CLO as a smaller step, so it is not an overclaim. Gaps: (1) it never mentions solving optimization problems, so the CLO's goal is missing; (2) it has no engineering context; (3) its verb 'Differentiate' is at the level of procedural skill, not applying rules to a problem. It would be a sound ILO if its scope were widened.
  - Draft: "Apply differentiation rules to polynomial and trigonometric functions to solve simple optimization problems in engineering."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome; ILO draft restates its CLO (0.58).
  - First-attempt refusals: quotes_swapped (re-asked; final answer verified).
- **B2 run 2.** Source quote "Apply differentiation rules to solve optimization problems in engineering" · target quote "Differentiate polynomial and trigonometric functions"
  - Explanation: The source (CLO) asks students to apply differentiation rules to solve engineering optimization problems (Apply). The target (ILO) only asks students to differentiate polynomial and trigonometric functions. This is a smaller, related step at about Apply level, so it builds toward the CLO. Gaps: (1) the ILO never mentions optimization problems; (2) it has no engineering context; (3) it covers only polynomial and trigonometric functions, so it does not reach the problem-solving the CLO asks for. The ILO does not claim more than the CLO.
  - Draft: "Apply differentiation rules to polynomial and trigonometric functions to set up and solve simple engineering optimization problems."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome; ILO draft restates its CLO (0.54).
  - First-attempt refusals: quotes_swapped (re-asked; final answer verified).

**Reason for disagreement.** A2 answered NOT_ALIGNED and B2 PARTIALLY_ALIGNED in both runs, all at Apply → Apply. The explanations describe the ILO as a smaller step toward the CLO, then withhold ALIGNED because it mentions neither optimization nor an engineering context. A2's NOT_ALIGNED contradicts its own explanation; B2's PARTIALLY_ALIGNED does not. B2 run 1 also calls "differentiate" a procedural skill, below its own rating of Apply. On its first attempt in both runs B2 swapped the source and target quotes; the validator refused them and the re-ask corrected them.

**Policy questions:** P2, ILO steps; P7, cognitive levels for attributes and multi-verb outcomes. **Case question:** Is an ILO that is a necessary step toward its CLO aligned when it does not show the CLO's application context?

### IT204-01 · `d-po-03` (Set 1)

- **Course context:** IT 204 Computer Programming 2 (BSIT, year 2); a test record. Description: "Object-oriented programming, data structures and the design, implementation and testing of programs in a modern language." BSIT 2022-2023 curriculum: IT-204 COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING), year 2, 2nd semester, 2 lecture and 1 laboratory units, prerequisite IT 202.
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Design, implement and evaluate computing-based solutions to meet desired needs.

- **Target (verbatim):**

> Develop and test a web application that meets the requirements of a client.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned · category different-wording. Rationale: "Develop and test a solution for a client's requirements is the PO's competency in other words."
- **Faculty forms:** Part A IT204-01; Part B IT204-01-R1, IT204-01-R2, IT204-01-R3.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Partially aligned | false rejection | Create → Apply | rewrite |
| A2 | 2 | Partially aligned | false rejection | Create → Create | rewrite |
| B2 | 1 | Partially aligned | false rejection | Create → Create | rewrite |
| B2 | 2 | Partially aligned | false rejection | Evaluate → Apply | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Design, implement and evaluate computing-based solutions" · target quote "Develop and test a web application that meets the requirements of a client."
  - Explanation: The CLO has develop (implement) and test, which fits the PO's subject. However, the PO's design verb is not shown, and evaluate is only partly covered, since testing is not evaluating the solution against needs. The CLO is also narrowed to a web application and client requirements.
  - Draft: "Design, develop and evaluate a web application that meets the requirements of a client, testing it against those requirements."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome; Bloom escalation (Apply → Create).
- **A2 run 2.** Source quote "Design, implement and evaluate computing-based solutions" · target quote "Develop and test a web application that meets the requirements of a client."
  - Explanation: The CLO has develop (implement) and test, which is partly evaluating, in the right subject. Missing: design is not stated, and evaluating the solution against needs is not shown beyond testing.
  - Draft: "Design, develop and evaluate a web application that meets the requirements of a client, testing it against those requirements."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 1.** Source quote "Design, implement and evaluate computing-based solutions to meet desired needs." · target quote "Develop and test a web application that meets the requirements of a client."
  - Explanation: The CLO develops and tests a web application for a client's requirements, which matches the PO's implement and meet-needs parts. The PO's design verb is missing, and the CLO does not say how the solution is evaluated against the needs. Its web-application subject is also narrower than computing-based solutions in general, though it is acceptable.
  - Draft: "Design, develop and evaluate a web application that meets the requirements of a client."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 2.** Source quote "Design, implement and evaluate computing-based solutions" · target quote "Develop and test a web application"
  - Explanation: The CLO has the verbs develop (equivalent to implement) and test, and it meets client requirements. Gaps: (1) it does not state design, which the PO asks for; (2) it does not state evaluation of the solution, which the PO asks for. (3) Its Bloom level is Apply/Create, below the Evaluate the PO asks for. The CLO must be rewritten.
  - Draft: "Design, develop and test a web application that meets the requirements of a client, and evaluate the finished application against those requirements."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome; Bloom escalation (Apply → Create).

**Reason for disagreement.** All four answers are PARTIALLY_ALIGNED. B2 accepts "develop" as implementing but not as designing, and does not accept testing against a client's requirements as evaluating. B2 run 2 also rates the PO by "evaluate" rather than "design" and the CLO as Apply, a stricter level reading than the other three answers. The provisional label reads developing and testing a solution for a client as the PO's competence in other words.

**Policy questions:** P1, coverage or contribution (CLO and PO); P7, cognitive levels for attributes and multi-verb outcomes. **Case question:** Does "develop and test a web application that meets the requirements of a client" show the PO's design, implementation and evaluation, or only part of them? Is that difference enough to withhold ALIGNED?

### IT204-05 · `clo-po-prog-interdisciplinary` (Set 1)

- **Course context:** IT 204 Computer Programming 2 (BSIT, year 2); a test record. Description: "Object-oriented programming, data structures and the design, implementation and testing of programs in a modern language." BSIT 2022-2023 curriculum: IT-204 COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING), year 2, 2nd semester, 2 lecture and 1 laboratory units, prerequisite IT 202.
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Analyze the impact of computing on individuals, organizations and society.

- **Target (verbatim):**

> Evaluate the ethical and social implications of a software system on its users.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned · category interdisciplinary. Rationale: "Valid interdisciplinary outcome that matches the PO. DISPUTED: the model judged PARTIAL in every run because the CLO narrows the PO's object to one system and its users; faculty to decide."
- **Faculty forms:** Part A IT204-05; Part B IT204-05-R1, IT204-05-R2, IT204-05-R3.
- **Also in eval-1.1:** this case is an unchanged copy. A1 (same model, prompt alignment-10) answered run 1 Partially aligned, run 2 Aligned.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Partially aligned | false rejection | Analyze → Evaluate | rewrite |
| A2 | 2 | Aligned | agrees | Analyze → Evaluate | no change |
| B2 | 1 | Partially aligned | false rejection | Analyze → Evaluate | rewrite |
| B2 | 2 | Partially aligned | false rejection | Analyze → Evaluate | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Analyze the impact of computing on individuals, organizations and society." · target quote "Evaluate the ethical and social implications of a software system on its users."
  - Explanation: The CLO evaluates ethical and social implications for users, which is related to the PO's impact on society and is at Evaluate level (above Analyze). However, it covers only users of one software system, not the impact on individuals, organizations and society, and it uses neither the verb analyze nor a broader scope.
  - Draft: "Analyze and evaluate the ethical and social impact of a software system on individuals, organizations and society."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **A2 run 2.** Source quote "impact of computing on individuals, organizations and society" · target quote "ethical and social implications of a software system on its users"
  - Explanation: The CLO evaluates the social and ethical implications of software on its users, which matches analyzing computing's impact on individuals and society, at an equal or higher Bloom level.
- **B2 run 1.** Source quote "Analyze the impact of computing on individuals, organizations and society." · target quote "Evaluate the ethical and social implications of a software system on its users."
  - Explanation: The CLO statement evaluates the ethical and social implications of software on users, which is close to the PO's analysis of computing's impact on society. It is limited to the users of one system and does not mention the impact on individuals, organizations and society more broadly. The Bloom level (Evaluate) is not lower than the PO's Analyze, so the gap is in scope only.
  - Draft: "Analyze and evaluate the ethical and social impact of a software system on its users, organizations and society."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 2.** Source quote "Analyze the impact of computing on individuals, organizations and society." · target quote "Evaluate the ethical and social implications of a software system on its users."
  - Explanation: The target CLO evaluates the ethical and social implications of software on users, which relates to the source PO's impact on society, and its Bloom level (Evaluate) is not lower than Analyze. However, it covers only users, not the individuals, organizations and society the PO names, and it does not state that the impact is of computing. It is also not a programming outcome for this course.
  - Draft: "Evaluate the ethical and social impact of a software system on individuals, organizations and society."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.

**Reason for disagreement.** All four answers rate the levels Analyze → Evaluate, so the level is not in question. The answers that withhold ALIGNED (A2 run 1, B2 both runs) treat the PO's three objects (individuals, organizations and society) as parts the CLO must each show; B2 run 2 adds that the CLO is "not a programming outcome for this course". The provisional label reads evaluating a system's implications for its users as one valid instance of the PO. The label's own rationale already records the case as disputed, and A1 also answered PARTIALLY_ALIGNED in one of its two runs.

**Policy questions:** P1, coverage or contribution (CLO and PO); P4, course fit and year level. **Case question:** Does a CLO that evaluates a software system's ethical and social implications for its users align with a PO on the impact of computing on individuals, organizations and society? Separately, does such a CLO belong in IT 204?

### IT204-08 · `d-ega-08` (Set 1)

- **Course context:** IT 204 Computer Programming 2 (BSIT, year 2); a test record. Description: "Object-oriented programming, data structures and the design, implementation and testing of programs in a modern language." BSIT 2022-2023 curriculum: IT-204 COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING), year 2, 2nd semester, 2 lecture and 1 laboratory units, prerequisite IT 202.
- **Relationship type:** CLO-EGA. Source: Expected graduate attribute (EGA). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Competent Catholic Augustinian-Marian Professional

- **Target (verbatim):**

> Write a Python function that sorts a list.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned or Partially aligned · marked ambiguous · category name-only-ega. Rationale: "Technical competence only; whether that is enough for this EGA depends on a definition the system does not hold (the EGA is a name only)."
- **Faculty forms:** Part A IT204-08; Part B IT204-08-R1, IT204-08-R2, IT204-08-R3.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | outside the provisional labels | Apply → Apply | rewrite |
| A2 | 2 | Not aligned | outside the provisional labels | Apply → Apply | rewrite |
| B2 | 1 | Not aligned | outside the provisional labels | N/A → Apply | re-map (re-tag) |
| B2 | 2 | Not aligned | outside the provisional labels | N/A → Apply | re-map (re-tag) |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Competent Catholic Augustinian-Marian Professional" · target quote "Write a Python function that sorts a list."
  - Explanation: Writing a sorting function is a technical Apply task. It shows no Catholic Augustinian-Marian professional attributes such as values, faith or service, and no professional conduct.
  - Draft: "Write and test Python functions, such as a list-sorting function, with professional competence and with integrity and humility, documenting code for the benefit of others."
  - Pre-registered rule flags: value wording (Humility, integrity).
- **A2 run 2.** Source quote "Competent Catholic Augustinian-Marian Professional" · target quote "Write a Python function that sorts a list."
  - Explanation: The CLO is a technical coding task. It has no Catholic Augustinian-Marian values or professional dimension, and the Bloom level is Apply with no ethical or value-based competence shown.
  - Draft: "Write and test a Python function that sorts a list, and justify, using Augustinian-Marian values such as integrity and service to others, how it was built to be correct and reliable for its users."
  - Pre-registered rule flags: value wording (augustinian, marian, integrity, service to others).
- **B2 run 1.** Source quote "Competent Catholic Augustinian-Marian Professional" · target quote "Write a Python function that sorts a list."
  - Explanation: The source EGA, Competent Catholic Augustinian-Marian Professional, asks for professional competence grounded in Catholic Augustinian-Marian formation. The target CLO only states writing a Python function that sorts a list. It is a narrow Apply-level technical task with no professional, ethical or faith-related element. The EGA does not fit this CLO.
  - Pre-registered rule flags: re-tag.
- **B2 run 2.** Source quote "Competent Catholic Augustinian-Marian Professional" · target quote "Write a Python function that sorts a list."
  - Explanation: The source EGA is a broad attribute of a Competent Catholic Augustinian-Marian Professional. The target CLO states only a technical task, writing a Python function that sorts a list. It shows no professional, Catholic, Augustinian or Marian dimension such as ethics, values or service, and the link would rest on an imagined connection the CLO does not state. The CLO is a sound technical outcome, so the EGA tag does not fit and should be changed or removed.
  - Pre-registered rule flags: re-tag.

**Reason for disagreement.** The provisional label accepts ALIGNED or PARTIALLY_ALIGNED and marks the case ambiguous: the CLO shows technical competence only, and whether that suffices depends on a definition of the attribute that the system does not hold. Both arms answered NOT_ALIGNED in all four runs: the CLO has no professional, ethical or faith-related element. A2 proposed adding value words; B2 proposed re-mapping the CLO. B2 rated the EGA's level "N/A" in both runs.

**Policy questions:** P3, EGA names; P5, re-mapping (re-tag) recommendations; P6, value wording; P7, cognitive levels for attributes and multi-verb outcomes. **Case question:** Does a purely technical programming CLO align with "Competent Catholic Augustinian-Marian Professional"? If not, should the CLO be re-mapped, or should values be added to it?

### IT204-10 · `d-any-ega-01` (Set 1)

- **Course context:** IT 204 Computer Programming 2 (BSIT, year 2); a test record. Description: "Object-oriented programming, data structures and the design, implementation and testing of programs in a modern language." BSIT 2022-2023 curriculum: IT-204 COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING), year 2, 2nd semester, 2 lecture and 1 laboratory units, prerequisite IT 202.
- **Relationship type:** CLO-anyEGA. Source: Expected graduate attributes (the whole list). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> 1. Critical and Creative thinker
> 2. Competent Catholic Augustinian-Marian Professional
> 3. Socially Responsive Steward
> 4. Transformative Lifelong learner

- **Target (verbatim):**

> Analyze alternative designs and justify the selection of one for a given problem.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned · category whole-list. Rationale: "Fits EGA 1."
- **Faculty forms:** Part A IT204-10; Part B IT204-10-R1.
- **Same CLO in:** IT204-07 (`clo-ega-aligned`).

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Aligned | agrees | Analyze → Evaluate | no change |
| A2 | 2 | Aligned | agrees | Analyze → Evaluate | no change |
| B2 | 1 | Aligned | agrees | Evaluate → Evaluate | no change |
| B2 | 2 | Partially aligned | false rejection | Create → Evaluate | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Critical and Creative thinker" · target quote "Analyze alternative designs and justify the selection"
  - Explanation: 1. Critical and Creative thinker: the CLO asks students to analyze alternative designs and justify a selection, which is critical thinking at Analyze/Evaluate level, in computing design.
- **A2 run 2.** Source quote "Critical and Creative thinker" · target quote "Analyze alternative designs and justify the selection of one"
  - Explanation: 1. Critical and Creative thinker: the CLO analyzes alternative designs and justifies a choice, which is critical thinking at Analyze/Evaluate level on a programming design problem.
- **B2 run 1.** Source quote "Critical and Creative thinker" · target quote "Analyze alternative designs and justify the selection"
  - Explanation: EGA 1 (Critical and Creative thinker) is developed: the CLO asks students to analyze alternative designs and justify a selection, which is critical thinking.
- **B2 run 2.** Source quote "1. Critical and Creative thinker" · target quote "Analyze alternative designs and justify the selection of one"
  - Explanation: EGA 1 (Critical and Creative thinker) is the best fit: the CLO's analysis of alternative designs and justification of a choice builds critical thinking. However, the CLO states only the analysis and justification. It does not state any creative element, such as proposing or devising a new design, so the 'Creative' half of EGA 1 is not shown. It also names no subject in this course (object-oriented programs or data structures), so it could fit any design course. The other EGAs (2, 3, 4) are not built by the CLO's own text.
  - Draft: "Design alternative object-oriented solutions to a given programming problem, analyze their data structures and trade-offs, and justify the selection of one."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome; Bloom escalation (Evaluate → Create).

**Reason for disagreement.** A2 answered ALIGNED twice; B2 ALIGNED, then PARTIALLY_ALIGNED. B2 run 2 withheld ALIGNED because no creative element is stated (the "Creative" half of EGA 1) and the CLO names no subject of the course. The provisional label reads fitting EGA 1 as sufficient. The same CLO is judged against EGA 1 alone in another case, whose provisional label accepts ALIGNED or PARTIALLY_ALIGNED.

**Policy questions:** P3, EGA names; P4, course fit and year level. **Case question:** Does analysing alternative designs and justifying a selection fit "Critical and Creative thinker" without a stated creative element?

### IT204-11 · `d-ilo-02` (Set 1)

- **Course context:** IT 204 Computer Programming 2 (BSIT, year 2); a test record. Description: "Object-oriented programming, data structures and the design, implementation and testing of programs in a modern language." BSIT 2022-2023 curriculum: IT-204 COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING), year 2, 2nd semester, 2 lecture and 1 laboratory units, prerequisite IT 202.
- **Relationship type:** ILO-CLO. Source: Course learning outcome (CLO). Target: Intended learning outcome (ILO).
- **Source (verbatim):**

> Design, implement and test object-oriented programs that solve given problems.

- **Target (verbatim):**

> Write unit tests for a class and run them.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned · category different-wording. Rationale: "Testing is one of the three things the CLO asks for."
- **Faculty forms:** Part A IT204-11; Part B IT204-11-R1.
- **Same CLO in:** IT204-02 (`clo-po-prog-aligned`), IT204-12 (`ilo-clo-prog-aligned`), IT204-13 (`d-ilo-03`).

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Aligned | agrees | Create → Apply | no change |
| A2 | 2 | Aligned | agrees | Create → Apply | no change |
| B2 | 1 | Aligned | agrees | Create → Apply | no change |
| B2 | 2 | Partially aligned | false rejection | Create → Apply | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "implement and test object-oriented programs" · target quote "Write unit tests for a class and run them."
  - Explanation: Writing and running unit tests for a class is a smaller step of the test part of the CLO.
- **A2 run 2.** Source quote "implement and test object-oriented programs" · target quote "Write unit tests for a class and run them."
  - Explanation: Writing and running unit tests for a class is a smaller step of the test part of the CLO, in the same subject.
- **B2 run 1.** Source quote "test object-oriented programs" · target quote "Write unit tests for a class and run them."
  - Explanation: The target ILO, writing and running unit tests for a class, is a smaller step toward the source CLO's test of object-oriented programs.
- **B2 run 2.** Source quote "Design, implement and test object-oriented programs" · target quote "Write unit tests for a class and run them."
  - Explanation: The target ILO, writing unit tests for a class and running them, builds the 'test' part of the source CLO and is in the same subject (object-oriented programs). However, the ILO covers only testing: it does not design or implement anything, so it is a narrow step toward the CLO's three verbs. Its Bloom level (Apply) is lower than the CLO's Create. It also does not say that the tests check a program that solves a given problem. The ILO should be extended to link the tests to a class that it implements for a given problem.
  - Draft: "Implement a class for a given problem, write unit tests for it and run them to verify that the program works."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.

**Reason for disagreement.** A2 answered ALIGNED twice; B2 ALIGNED, then PARTIALLY_ALIGNED, all at Create → Apply. B2 run 2 withheld ALIGNED because the ILO covers only testing, and counted the ILO's lower level (Apply against the CLO's Create) as a gap; the checker's own level rule for ILO–CLO pairs flags only an ILO above its CLO. The provisional label reads testing as one of the three things the CLO asks for.

**Policy questions:** P2, ILO steps; P7, cognitive levels for attributes and multi-verb outcomes. **Case question:** Is an ILO that develops one of the CLO's activities (testing) aligned with it? Is a lower cognitive level than the CLO a gap for an ILO?

### IT204-12 · `ilo-clo-prog-aligned` (Set 1)

- **Course context:** IT 204 Computer Programming 2 (BSIT, year 2); a test record. Description: "Object-oriented programming, data structures and the design, implementation and testing of programs in a modern language." BSIT 2022-2023 curriculum: IT-204 COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING), year 2, 2nd semester, 2 lecture and 1 laboratory units, prerequisite IT 202.
- **Relationship type:** ILO-CLO. Source: Course learning outcome (CLO). Target: Intended learning outcome (ILO).
- **Source (verbatim):**

> Design, implement and test object-oriented programs that solve given problems.

- **Target (verbatim):**

> Implement a class hierarchy using inheritance in the chosen language.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned · category clear-positive. Rationale: "A concrete step of the CLO."
- **Faculty forms:** Part A IT204-12; Part B IT204-12-R1.
- **Same CLO in:** IT204-02 (`clo-po-prog-aligned`), IT204-11 (`d-ilo-02`), IT204-13 (`d-ilo-03`).
- **Also in eval-1.1:** this case is an unchanged copy. A1 (same model, prompt alignment-10) answered run 1 Aligned, run 2 Aligned.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Aligned | agrees | Create → Apply | no change |
| A2 | 2 | Aligned | agrees | Create → Apply | no change |
| B2 | 1 | Partially aligned | false rejection | Create → Apply | rewrite |
| B2 | 2 | Aligned | agrees | Create → Apply | no change |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "implement and test object-oriented programs" · target quote "Implement a class hierarchy using inheritance"
  - Explanation: Implementing a class hierarchy is a smaller step of implementing OO programs, at a matching level.
- **A2 run 2.** Source quote "implement and test object-oriented programs" · target quote "Implement a class hierarchy using inheritance"
  - Explanation: Implementing a class hierarchy is a smaller implement step of the CLO in the same subject.
- **B2 run 1.** Source quote "Design, implement and test object-oriented programs that solve given problems." · target quote "Implement a class hierarchy using inheritance in the chosen language."
  - Explanation: The ILO is in the same subject and builds the CLO's implement step by implementing an inheritance hierarchy. However, the CLO also asks to design and test programs, and the ILO shows neither. It also does not say what problem the hierarchy solves, so it is weaker than the CLO. The ILO needs to add testing and tie the hierarchy to a given problem.
  - Draft: "Implement and test a class hierarchy using inheritance in the chosen language to solve a given problem."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 2.** Source quote "Design, implement and test object-oriented programs" · target quote "Implement a class hierarchy using inheritance"
  - Explanation: The ILO implements a class hierarchy, which is a smaller step toward the CLO's design and implementation of object-oriented programs, in the same subject.

**Reason for disagreement.** A2 answered ALIGNED twice; B2 PARTIALLY_ALIGNED, then ALIGNED, all at Create → Apply. B2 run 1 withheld ALIGNED because the CLO also asks to design and test and the ILO shows neither, and because no problem is named; B2 run 2 accepted the ILO as a smaller step. The provisional label reads a concrete step of the CLO as aligned; A1 answered ALIGNED in both runs.

**Policy questions:** P2, ILO steps. **Case question:** Is implementing a class hierarchy with inheritance aligned with a CLO to design, implement and test object-oriented programs, as one step of it?

### NCM101-03 · `d-po-05` (Set 1)

- **Course context:** NCM 101 Fundamentals of Nursing Practice (BSN, year 1); a test record. Description: "Basic nursing concepts, patient safety, vital signs assessment, hygiene care and therapeutic communication, with return demonstration in the skills laboratory." No curriculum or program outcomes for BSN are held (R-NONE).
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Apply the nursing process in providing safe, quality care to individuals, families and communities.

- **Target (verbatim):**

> Prepare and administer oral medications safely following the five rights of medication administration.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned · category specific-clo-broad-po. Rationale: "A specific skill that clearly develops one real part of broad safe-care practice."
- **Faculty forms:** Part A NCM101-03; Part B NCM101-03-R1, NCM101-03-R2, NCM101-03-R3.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Partially aligned | false rejection | Apply → Apply | rewrite |
| A2 | 2 | Partially aligned | false rejection | Apply → Apply | rewrite |
| B2 | 1 | Partially aligned | false rejection | Apply → Apply | rewrite |
| B2 | 2 | Partially aligned | false rejection | Apply → Apply | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Apply the nursing process in providing safe, quality care to individuals, families and communities." · target quote "Prepare and administer oral medications safely following the five rights of medication administration."
  - Explanation: Safe oral medication administration is nursing care at Apply level, but the CLO never mentions the nursing process (assess, diagnose, plan, implement, evaluate). It also covers only individual patients, not the families and communities the PO names.
  - Draft: "Apply the nursing process to prepare and administer oral medications safely following the five rights, and teach the patient and family about the medication."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **A2 run 2.** Source quote "Apply the nursing process in providing safe, quality care to individuals, families and communities." · target quote "Prepare and administer oral medications safely following the five rights of medication administration."
  - Explanation: The CLO applies safe practice to oral medication administration, which is nursing, but it does not mention the nursing process (assess, diagnose, plan, implement, evaluate). It is limited to one procedure and does not cover individuals, families or communities. The Bloom level (Apply) is adequate.
  - Draft: "Apply the nursing process to prepare and administer oral medications safely, following the five rights, to individual patients and their families in a simulated setting."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 1.** Source quote "Apply the nursing process in providing safe, quality care" · target quote "Prepare and administer oral medications safely following the five rights of medication administration."
  - Explanation: The target CLO applies safe practice in administering oral medications (five rights), which fits 'safe, quality care' and the Apply level. Gaps: it does not mention the nursing process (assessment, planning, implementation, evaluation) that the source PO asks to apply. It also does not reach families and communities, since it is limited to a medication task. The CLO also exceeds the course description, which does not list medication administration, though this is secondary.
  - Draft: "Apply the nursing process in safely preparing and administering oral medications to a simulated patient, following the five rights of medication administration."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 2.** Source quote "Apply the nursing process in providing safe, quality care" · target quote "Prepare and administer oral medications safely following the five rights of medication administration."
  - Explanation: The CLO (target) applies safe medication administration, which is part of safe care, so the Bloom level (Apply) and subject match. But it does not state the nursing process (assessing, diagnosing, planning, implementing, evaluating), and it names no individuals, families or communities as recipients of care. It also falls outside the course description, which lists vital signs, hygiene, safety and communication but not medication administration. The CLO is a sound outcome that mostly needs the nursing process added.
  - Draft: "Apply the nursing process in safely preparing and administering oral medications to a simulated patient, following the five rights of medication administration."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.

**Reason for disagreement.** All four answers are PARTIALLY_ALIGNED at Apply → Apply. B2 says the CLO does not mention the nursing process or reach families and communities, and notes that the course description does not list medication administration; A2's rewrites add families and family teaching. The provisional label reads a specific skill that develops one real part of a broad practice PO as aligned.

**Policy questions:** P1, coverage or contribution (CLO and PO); P4, course fit and year level. **Case question:** Does a specific, safely performed skill align with a broad practice PO when it names neither the PO's process nor all of its client groups? Separately, is medication administration within NCM 101's scope?

### NCM101-07 · `d-ega-03` (Set 1)

- **Course context:** NCM 101 Fundamentals of Nursing Practice (BSN, year 1); a test record. Description: "Basic nursing concepts, patient safety, vital signs assessment, hygiene care and therapeutic communication, with return demonstration in the skills laboratory." No curriculum or program outcomes for BSN are held (R-NONE).
- **Relationship type:** CLO-EGA. Source: Expected graduate attribute (EGA). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Socially Responsive Steward

- **Target (verbatim):**

> Design a community outreach activity that addresses a local health need and evaluate its results.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned · category name-only-ega. Rationale: "Serves a community need and reflects on the result."
- **Faculty forms:** Part A NCM101-07; Part B NCM101-07-R1, NCM101-07-R2, NCM101-07-R3.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Partially aligned | false rejection | Apply → Create | rewrite |
| A2 | 2 | Aligned | agrees | Apply → Create | no change |
| B2 | 1 | Partially aligned | false rejection | Apply → Create | rewrite |
| B2 | 2 | Not aligned | false rejection | N/A → Create | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Socially Responsive Steward" · target quote "Design a community outreach activity that addresses a local health need and evaluate its results."
  - Explanation: The CLO designs and evaluates a community outreach activity for a local health need, which fits social responsiveness and is at Create/Evaluate level. However, it does not mention stewardship, meaning responsible and sustainable care for people and resources. It also does not say who is served or how the activity responds to that community's needs. The subject is also not tied to fundamentals of nursing practice.
  - Draft: "Design a community health outreach activity on basic nursing care, such as hygiene or safety, that responsibly addresses a local health need, and evaluate its results and use of resources."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **A2 run 2.** Source quote "Socially Responsive Steward" · target quote "community outreach activity that addresses a local health need"
  - Explanation: Designing and evaluating a community outreach addressing a local health need shows socially responsive stewardship.
- **B2 run 1.** Source quote "Socially Responsive Steward" · target quote "addresses a local health need"
  - Explanation: The target CLO shares the community and social-responsiveness theme of the source EGA and its Bloom level (Create, Evaluate) is high enough. But it asks a first-year fundamentals student to design and evaluate a community outreach activity. That is not in the course description (basic nursing concepts, patient safety, vital signs, hygiene, communication, skills lab). The CLO is not a sound outcome for this course, so the CLO itself needs rewriting and not just a new tag. Rewrite it into a fundamentals-level outcome that keeps the social responsibility element.
  - Draft: "Explain how basic nursing care, patient safety and therapeutic communication respond to the health needs of patients and the community."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome; replacement (keeps 30% of the original).
- **B2 run 2.** Source quote "Socially Responsive Steward" · target quote "Design a community outreach activity that addresses a local health need and evaluate its results."
  - Explanation: The source EGA is 'Socially Responsive Steward'. The target CLO asks for designing and evaluating a community outreach activity. That is a Create/Evaluate outcome that may fit the EGA, but it does not belong to this course. NCM 101 covers basic nursing concepts, safety, vital signs, hygiene and communication, with skills lab return demonstration, and the description includes no community outreach or program evaluation. The CLO needs content the description does not cover and is too advanced for year 1. The CLO should be rewritten toward the course subject while keeping a socially responsive, patient-centred element.
  - Draft: "Demonstrate safe, patient-centered basic nursing care, including patient safety and therapeutic communication, that responds to the needs of individual patients and their families."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome; replacement (keeps 20% of the original).

**Reason for disagreement.** A2 answered PARTIALLY_ALIGNED, then ALIGNED; B2 PARTIALLY_ALIGNED, then NOT_ALIGNED. Both B2 answers concede a link with the attribute ("may fit the EGA"; "shares the community and social-responsiveness theme") and withhold ALIGNED for course fit: the outreach is not in the course description, and designing and evaluating it may be too advanced for year 1. B2 run 2 is NOT_ALIGNED on course fit alone while conceding the EGA fit, so its verdict answers a different question from the one asked; it also rates the EGA's level "N/A". A2 run 1's cause in its report was reading the attribute's name literally. The provisional label reads serving a community need and evaluating the result as social responsiveness.

**Policy questions:** P3, EGA names; P4, course fit and year level; P7, cognitive levels for attributes and multi-verb outcomes. **Case question:** Does designing and evaluating a community outreach for a local health need align with "Socially Responsive Steward"? Separately, is such a CLO appropriate for a year-1 fundamentals of nursing course?

### NCM101-08 · `d-ega-07` (Set 1)

- **Course context:** NCM 101 Fundamentals of Nursing Practice (BSN, year 1); a test record. Description: "Basic nursing concepts, patient safety, vital signs assessment, hygiene care and therapeutic communication, with return demonstration in the skills laboratory." No curriculum or program outcomes for BSN are held (R-NONE).
- **Relationship type:** CLO-EGA. Source: Expected graduate attribute (EGA). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Competent Catholic Augustinian-Marian Professional

- **Target (verbatim):**

> Perform nursing procedures to professional standards and show the Augustinian values of community and truth in patient care.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned · category name-only-ega. Rationale: "Professional competence together with named Augustinian values."
- **Faculty forms:** Part A NCM101-08; Part B NCM101-08-R1, NCM101-08-R2.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Aligned | agrees | Apply → Apply | no change |
| A2 | 2 | Aligned | agrees | Apply → Apply | no change |
| B2 | 1 | Partially aligned | false rejection | Apply → Apply | rewrite |
| B2 | 2 | Partially aligned | false rejection | N/A → Apply | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Competent Catholic Augustinian-Marian Professional" · target quote "Augustinian values of community and truth in patient care"
  - Explanation: The CLO has professional-standard nursing performance and names the Augustinian values of community and truth.
- **A2 run 2.** Source quote "Competent Catholic Augustinian-Marian Professional" · target quote "Augustinian values of community and truth in patient care"
  - Explanation: The CLO combines professional nursing performance with Augustinian values of community and truth.
- **B2 run 1.** Source quote "Competent Catholic Augustinian-Marian Professional" · target quote "show the Augustinian values of community and truth in patient care"
  - Explanation: The target CLO contains the key competence of the source EGA: it performs nursing procedures to professional standards. It also names Augustinian values of community and truth. However, it does not state any Catholic or Marian element, which the EGA names. It does not show how the values are shown in practice, which makes the link vague. The Apply level suits the EGA.
  - Draft: "Perform basic nursing procedures to professional standards in the skills laboratory, showing Augustinian-Marian values of community, truth and compassion in patient care."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome; value wording (Compassion, augustinian, marian, truth).
- **B2 run 2.** Source quote "Competent Catholic Augustinian-Marian Professional" · target quote "show the Augustinian values of community and truth in patient care"
  - Explanation: The target CLO covers performing nursing procedures to professional standards, and it names community and truth as values, so it covers the professional and Augustinian elements. However, the EGA also asks for a 'Catholic' and 'Marian' dimension, and the CLO mentions no Marian value or Catholic identity. The CLO also does not say how the values are shown, such as honest documentation or caring for patients, so 'show' is vague and hard to assess. The CLO should name a Marian value and state an observable action.
  - Draft: "Perform basic nursing procedures to professional standards and demonstrate the Augustinian values of community and truth and the Marian value of compassion in patient care, such as through honest reporting and respectful, caring interaction with patients."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome; value wording (Compassion, augustinian, truth, marian).

**Reason for disagreement.** A2 answered ALIGNED twice; B2 PARTIALLY_ALIGNED twice, because the CLO states no Catholic or Marian element of the attribute's name and does not show how the values are practised. B2 run 2 rates the EGA's level "N/A". The provisional label reads professional competence together with named Augustinian values as aligned. B2's rewrites change the value wording (see the recommendation review).

**Policy questions:** P3, EGA names; P6, value wording; P7, cognitive levels for attributes and multi-verb outcomes. **Case question:** Must a CLO mapped to "Competent Catholic Augustinian-Marian Professional" reflect each element of the name, or is professional competence with named Augustinian values enough?

### NCM101-11 · `d-ilo-04` (Set 1)

- **Course context:** NCM 101 Fundamentals of Nursing Practice (BSN, year 1); a test record. Description: "Basic nursing concepts, patient safety, vital signs assessment, hygiene care and therapeutic communication, with return demonstration in the skills laboratory." No curriculum or program outcomes for BSN are held (R-NONE).
- **Relationship type:** ILO-CLO. Source: Course learning outcome (CLO). Target: Intended learning outcome (ILO).
- **Source (verbatim):**

> Perform basic nursing procedures safely using the nursing process on a simulated patient.

- **Target (verbatim):**

> Demonstrate correct hand hygiene before and after patient contact.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned · category clear-positive. Rationale: "A basic procedure performed safely."
- **Faculty forms:** Part A NCM101-11; Part B NCM101-11-R1.
- **Same CLO in:** NCM101-02 (`clo-po-nurs-aligned`), NCM101-09 (`d-ilo-05`).

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Aligned | agrees | Apply → Apply | no change |
| A2 | 2 | Aligned | agrees | Apply → Apply | no change |
| B2 | 1 | Partially aligned | false rejection | Apply → Apply | rewrite |
| B2 | 2 | Aligned | agrees | Apply → Apply | no change |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Perform basic nursing procedures safely" · target quote "Demonstrate correct hand hygiene"
  - Explanation: Hand hygiene is a basic nursing procedure and a smaller step toward the CLO, at Apply level.
- **A2 run 2.** Source quote "Perform basic nursing procedures safely" · target quote "Demonstrate correct hand hygiene"
  - Explanation: Demonstrating hand hygiene is a smaller, applied step of performing basic nursing procedures safely.
- **B2 run 1.** Source quote "Perform basic nursing procedures safely" · target quote "Demonstrate correct hand hygiene before and after patient contact."
  - Explanation: The source CLO is to perform basic nursing procedures safely using the nursing process on a simulated patient. The target ILO is to demonstrate correct hand hygiene before and after patient contact. It is a smaller step in the same subject (patient safety) and builds toward safe performance, at Apply level. But the ILO does not show the nursing process or a simulated patient that the CLO states. It also covers only one procedure, so it is a narrow step. The ILO can be revised to link it to the CLO.
  - Draft: "Demonstrate correct hand hygiene before and after contact with a simulated patient as part of safe care within the nursing process."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 2.** Source quote "Perform basic nursing procedures safely" · target quote "Demonstrate correct hand hygiene"
  - Explanation: The target ILO (hand hygiene before and after patient contact) is a smaller step toward the source CLO's safe performance of basic nursing procedures.

**Reason for disagreement.** A2 answered ALIGNED twice; B2 PARTIALLY_ALIGNED, then ALIGNED, all at Apply → Apply. B2 run 1 accepted the ILO as a smaller step in the same subject but withheld ALIGNED because it shows neither the nursing process nor a simulated patient and covers only one procedure. The provisional label reads a basic procedure performed safely as aligned.

**Policy questions:** P2, ILO steps. **Case question:** Is demonstrating correct hand hygiene aligned with performing basic nursing procedures safely using the nursing process, as one step of it?

### EDUC105-02 · `d-po-07` (Set 1)

- **Course context:** EDUC 105 Assessment of Student Learning 1 (BSEd, year 3); a test record. Description: "Principles of assessment, the design of classroom tests and performance tasks, and the interpretation and use of assessment results to improve teaching and learning." No curriculum or program outcomes for BSEd are held (R-NONE).
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Design, implement and evaluate assessments that measure student learning.

- **Target (verbatim):**

> Construct a table of specifications and write test items that match the stated learning objectives.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned · category different-wording. Rationale: "Constructing a test blueprint and items is designing an assessment."
- **Faculty forms:** Part A EDUC105-02; Part B EDUC105-02-R1, EDUC105-02-R2, EDUC105-02-R3, EDUC105-02-R4.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Partially aligned | false rejection | Evaluate → Create | rewrite |
| A2 | 2 | Partially aligned | false rejection | Create → Create | rewrite |
| B2 | 1 | Partially aligned | false rejection | Create → Create | rewrite |
| B2 | 2 | Partially aligned | false rejection | Create → Create | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Design, implement and evaluate assessments that measure student learning." · target quote "Construct a table of specifications and write test items that match the stated learning objectives."
  - Explanation: The CLO covers constructing (Create) a table of specifications and writing test items, which fits 'design' of assessments in the right subject. But the PO also asks for 'implement' and 'evaluate'; the CLO has no administering of the assessment and no evaluation of its quality or of the learning it measures (e.g. item analysis, validity or reliability review). Evaluate level is not reached.
  - Draft: "Construct a table of specifications and write test items that match the stated learning objectives, administer the test to a class, and evaluate its quality and the learning it measures through item analysis and validity and reliability checks."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **A2 run 2.** Source quote "Design, implement and evaluate assessments that measure student learning." · target quote "Construct a table of specifications and write test items"
  - Explanation: The CLO covers the 'design' part (Create-level table of specifications and item writing) and matches the subject. It does not show 'implement' (administering the assessment) or 'evaluate' (judging or analysing the quality of the test or of results), so two of the three actions in the PO are missing.
  - Draft: "Construct a table of specifications, write test items that match the stated learning objectives, administer the test to a class, and evaluate its quality through item analysis and the results."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 1.** Source quote "Design, implement and evaluate assessments that measure student learning." · target quote "Construct a table of specifications and write test items"
  - Explanation: The CLO (target) covers designing assessments (table of specifications, test items matched to objectives) and is at Create level. But the PO (source) also asks to 'implement and evaluate' assessments, and the CLO states neither administering assessments nor evaluating them (e.g., item analysis or judging validity). It also does not mention measuring student learning, so two of the PO's three verbs are missing.
  - Draft: "Construct a table of specifications and write test items that match the stated learning objectives, administer the test, and evaluate its quality through item analysis to judge how well it measures student learning."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 2.** Source quote "Design, implement and evaluate assessments" · target quote "Construct a table of specifications and write test items"
  - Explanation: The PO (source) asks for three things: design, implement and evaluate assessments. The CLO (target) covers designing, through constructing a table of specifications and writing test items that match objectives. It does not state implementing (administering) the assessment. It does not state evaluating the assessment or its results, such as item analysis or judging validity. Subject matter and Bloom level (Create) fit for design only.
  - Draft: "Construct a table of specifications, write test items that match the stated learning objectives, administer the test, and evaluate its quality using item analysis."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.

**Reason for disagreement.** All four answers are PARTIALLY_ALIGNED. Both arms accept the CLO as the design part of the PO and withhold ALIGNED because it does not implement or evaluate assessments. The provisional label reads constructing a test blueprint and items as designing an assessment.

**Policy questions:** P1, coverage or contribution (CLO and PO). **Case question:** Does a CLO that develops one of the PO's three activities (design) align with the PO, when the other two (implement, evaluate) may be developed by other CLOs?

### EDUC105-06 · `d-ilo-06` (Set 1)

- **Course context:** EDUC 105 Assessment of Student Learning 1 (BSEd, year 3); a test record. Description: "Principles of assessment, the design of classroom tests and performance tasks, and the interpretation and use of assessment results to improve teaching and learning." No curriculum or program outcomes for BSEd are held (R-NONE).
- **Relationship type:** ILO-CLO. Source: Course learning outcome (CLO). Target: Intended learning outcome (ILO).
- **Source (verbatim):**

> Construct valid and reliable classroom tests.

- **Target (verbatim):**

> Write multiple-choice items with plausible distractors.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned · category different-wording. Rationale: "Item writing is a core step of constructing a test."
- **Faculty forms:** Part A EDUC105-06; Part B EDUC105-06-R1, EDUC105-06-R2.
- **Same CLO in:** EDUC105-05 (`d-ilo-07`).

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Aligned | agrees | Create → Create | no change |
| A2 | 2 | Aligned | agrees | Create → Create | no change |
| B2 | 1 | Partially aligned | false rejection | Create → Create | rewrite |
| B2 | 2 | Partially aligned | false rejection | Create → Apply | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Construct valid and reliable classroom tests." · target quote "Write multiple-choice items with plausible distractors."
  - Explanation: Writing multiple-choice items with plausible distractors is a smaller step toward constructing valid classroom tests.
- **A2 run 2.** Source quote "Construct valid and reliable classroom tests." · target quote "Write multiple-choice items with plausible distractors"
  - Explanation: Writing multiple-choice items is a smaller step toward constructing valid classroom tests.
- **B2 run 1.** Source quote "Construct valid and reliable classroom tests." · target quote "Write multiple-choice items with plausible distractors."
  - Explanation: The ILO (target) is a smaller Create-level step toward the CLO (source) in the same subject (test construction): writing multiple-choice items is part of building a test. But the CLO requires tests that are both 'valid and reliable', and the ILO says nothing about validity (e.g., matching items to objectives) or reliability. The ILO also covers only one item format, so it does not yet build toward the whole CLO.
  - Draft: "Write multiple-choice items with plausible distractors that match the stated learning objectives, as a step toward a valid and reliable classroom test."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 2.** Source quote "Construct valid and reliable classroom tests." · target quote "Write multiple-choice items with plausible distractors."
  - Explanation: The CLO (source) asks for constructing valid and reliable classroom tests. The ILO (target) is a smaller step in the same subject: writing multiple-choice items is a part of test construction, at Create/Apply level. But the ILO does not address validity or reliability. It covers only one item format, so it does not show how the items would build valid and reliable tests. Writing plausible distractors alone does not claim more than the CLO, but it leaves out the quality criteria the CLO names.
  - Draft: "Write multiple-choice items with plausible distractors that support the validity and reliability of a classroom test."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.

**Reason for disagreement.** A2 answered ALIGNED twice; B2 PARTIALLY_ALIGNED twice, because the CLO requires tests that are "valid and reliable", which the ILO does not address, and because the ILO covers one item format. The provisional label reads item writing as a core step of constructing a test.

**Policy questions:** P2, ILO steps. **Case question:** Is writing multiple-choice items with plausible distractors aligned with constructing valid and reliable classroom tests, when it does not itself address validity and reliability?

### ACCTG201-02 · `d-po-09` (Set 1)

- **Course context:** ACCTG 201 Intermediate Accounting 1 (BSA, year 2); a test record. Description: "Recognition, measurement and presentation of cash, receivables, inventories and property, plant and equipment under the Philippine Financial Reporting Standards." No curriculum or program outcomes for BSA are held (R-NONE).
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Apply accounting principles and standards to record, measure and report financial transactions.

- **Target (verbatim):**

> Record and report receivables and inventories in accordance with the applicable financial reporting standards.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned · category clear-positive. Rationale: "Records and reports under the standards."
- **Faculty forms:** Part A ACCTG201-02; Part B ACCTG201-02-R1, ACCTG201-02-R2, ACCTG201-02-R3.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Partially aligned | false rejection | Apply → Apply | rewrite |
| A2 | 2 | Partially aligned | false rejection | Apply → Apply | rewrite |
| B2 | 1 | Partially aligned | false rejection | Apply → Apply | rewrite |
| B2 | 2 | Partially aligned | false rejection | Apply → Apply | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "record, measure and report financial transactions" · target quote "Record and report receivables and inventories"
  - Explanation: The CLO has 'record' and 'report' and covers the right subject (receivables and inventories under reporting standards). It omits 'measure', which the PO requires. Its verbs also do not clearly reach Apply, since it never says the standards are applied to transactions.
  - Draft: "Apply the applicable Philippine Financial Reporting Standards to record, measure and report receivables and inventories."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **A2 run 2.** Source quote "record, measure and report financial transactions" · target quote "Record and report receivables and inventories"
  - Explanation: The CLO covers 'record' and 'report' (the PO's verbs) for receivables and inventories under the standards, so subject and standards match. Gap: the PO asks for 'measure' as well, and the CLO never states measurement (e.g., valuation, impairment, lower of cost and NRV). Bloom is Apply in both, which is fine.
  - Draft: "Record, measure and report receivables and inventories in accordance with the applicable Philippine Financial Reporting Standards."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 1.** Source quote "record, measure and report financial transactions" · target quote "Record and report receivables and inventories"
  - Explanation: The CLO states record and report, which matches the PO's 'record' and 'report', and its subject (receivables and inventories under reporting standards) fits. However, it never states 'measure', which the PO asks for, so one of the three required actions is not shown. It also does not state 'apply' as the action, though 'in accordance with' standards implies it. Bloom level is Apply for both.
  - Draft: "Record, measure and report receivables and inventories in accordance with the applicable financial reporting standards."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 2.** Source quote "record, measure and report financial transactions" · target quote "Record and report receivables and inventories"
  - Explanation: The CLO statement has the PO's verbs 'record' and 'report' and the right subject (receivables and inventories under reporting standards). It does not state 'measure', which the PO asks for. Its Bloom level (Apply) matches the PO's Apply level. The missing measurement competence prevents a full match.
  - Draft: "Record, measure and report receivables and inventories in accordance with the applicable financial reporting standards."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.

**Reason for disagreement.** All four answers are PARTIALLY_ALIGNED at Apply → Apply. B2 withholds ALIGNED because the CLO never states "measure"; A2's cause in its report is the same kind (a multi-part PO with one part not shown). The provisional label reads recording and reporting under the standards as the PO's competence; the course description covers recognition, measurement and presentation under the Philippine Financial Reporting Standards.

**Policy questions:** P1, coverage or contribution (CLO and PO). **Case question:** Must a CLO state a component of the PO (here, measurement) that its other components imply, for the CLO to be aligned?

### HM210-03 · `d-ilo-10` (Set 1)

- **Course context:** HM 210 Food and Beverage Service (BSHM, year 2); a test record. Description: "Table service, beverage service, guest relations and the safety and sanitation standards of food and beverage operations." No curriculum or program outcomes for BSHM are held (R-NONE).
- **Relationship type:** ILO-CLO. Source: Course learning outcome (CLO). Target: Intended learning outcome (ILO).
- **Source (verbatim):**

> Deliver table service to industry standards.

- **Target (verbatim):**

> Set a cover for a three-course meal following the standard layout.

- **Provisional labels (developer-written, not faculty-reviewed):** Aligned · category clear-positive. Rationale: "A standard step of table service."
- **Faculty forms:** Part A HM210-03; Part B HM210-03-R1, HM210-03-R2.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Partially aligned | false rejection | Apply → Apply | rewrite |
| A2 | 2 | Partially aligned | false rejection | Apply → Apply | rewrite |
| B2 | 1 | Aligned | agrees | Apply → Apply | no change |
| B2 | 2 | Aligned | agrees | Apply → Apply | no change |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Deliver table service to industry standards." · target quote "Set a cover for a three-course meal following the standard layout."
  - Explanation: The ILO is a smaller step of table service in the same subject. But it only covers setting a cover (a single task), not the delivery of service. The ILO verb 'Set' is Apply, which builds toward 'Deliver'. As a CLO-level statement, it claims less than the CLO: it omits serving guests and the industry standards. The ILO text is also missing the standard being met beyond 'standard layout'. Since the source is the CLO and the target is the ILO, the ILO is a valid smaller step but does not state the industry standard or service delivery.
  - Draft: "Set a cover for a three-course meal and serve it to guests following industry-standard table service procedures."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **A2 run 2.** Source quote "Deliver table service to industry standards." · target quote "Set a cover for a three-course meal following the standard layout."
  - Explanation: The ILO is the same subject (table service) and practises a smaller step (setting a cover), but the source CLO asks to deliver service to industry standards, which includes more than the cover layout: the ILO covers only a table setup, not serving or delivering to guests. Its Bloom level (Apply) matches, but it does not show the delivery of service itself, so it is only a partial step of the CLO.
  - Draft: "Set a cover for a three-course meal following the standard layout and serve the courses to guests following industry service standards."
  - Pre-registered rule flags: rewrite of a provisionally aligned outcome.
- **B2 run 1.** Source quote "Deliver table service to industry standards" · target quote "Set a cover for a three-course meal following the standard layout"
  - Explanation: The target ILO, setting a three-course cover to the standard layout, is a concrete Apply-level step toward the source CLO of delivering table service to standard.
- **B2 run 2.** Source quote "Deliver table service to industry standards" · target quote "Set a cover for a three-course meal following the standard layout"
  - Explanation: The target ILO, setting a cover to the standard layout, is a concrete step toward the source CLO's table service to industry standards.

**Reason for disagreement.** A2 answered PARTIALLY_ALIGNED in both runs because the ILO does not show the delivery of service itself; B2 answered ALIGNED in both runs, as "a concrete Apply-level step" toward the CLO. The provisional label reads a standard step of table service as aligned. It is the one case where B2 changed A2's verdict toward the provisional label in both runs.

**Policy questions:** P2, ILO steps. **Case question:** Is setting a cover for a three-course meal aligned with delivering table service to industry standards, as one step of it?

## Section 2. Recommendation and consistency cases (Set 2, 26 cases)

### MA7-01 · `clo-po-calc-lower-level` (Set 2)

- **Course context:** MA 7 Differential Calculus (BSIE, year 1); a test record. Description: "Limits, continuity, derivatives and their applications to engineering problems." BSIE 2022-2023 curriculum: MA 7 DIFFERENTIAL CALCULUS, year 1, 1st semester, 3 lecture and 0 laboratory units, prerequisite (blank in the source).
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Design solutions for complex engineering problems that meet specified needs.

- **Target (verbatim):**

> Define the derivative of a function.

- **Provisional labels (developer-written, not faculty-reviewed):** Partially aligned or Not aligned · category level-gap. Rationale: "Recall-level outcome against a design-level outcome."
- **Pre-registered level-gap note: "Year 1: raising "Define the derivative" to design is a faculty decision; re-tagging to the apply-mathematics PO keeps it."**
- **Faculty forms:** Part A MA7-01; Part B MA7-01-R1, MA7-01-R2, MA7-01-R3, MA7-01-R4.
- **Also in eval-1.1:** this case is an unchanged copy. A1 (same model, prompt alignment-10) answered run 1 Partially aligned, run 2 Not aligned.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Create → Remember | rewrite |
| A2 | 2 | Not aligned | agrees | Create → Remember | rewrite |
| B2 | 1 | Not aligned | agrees | Create → Remember | rewrite |
| B2 | 2 | Not aligned | agrees | Create → Remember | re-map (re-tag) |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Design solutions for complex engineering problems" · target quote "Define the derivative of a function."
  - Explanation: The PO asks to design solutions that meet specified needs (Create). The CLO only defines a derivative (Remember), so it has no design verb, sits far below the required level, and contains no engineering problem or specified needs.
  - Draft: "Design a solution to an engineering problem that meets specified needs by applying derivatives, such as dimensioning a container of minimum material cost."
  - Pre-registered rule flags: Bloom escalation (Remember → Create).
- **A2 run 2.** Source quote "Design solutions for complex engineering problems that meet specified needs" · target quote "Define the derivative of a function"
  - Explanation: The PO asks for designing solutions to meet specified needs (Create), but the CLO only defines a term (Remember). It has no design verb, is far below the PO's Bloom level, and has no engineering problem or specified needs.
  - Draft: "Design solutions to engineering problems that meet specified needs by applying derivatives, such as determining the dimensions of a container that minimize material cost within given constraints."
  - Pre-registered rule flags: Bloom escalation (Remember → Create).
- **B2 run 1.** Source quote "Design solutions for complex engineering problems that meet specified needs" · target quote "Define the derivative of a function"
  - Explanation: The PO asks for Create-level design of solutions to complex engineering problems that meet specified needs. The CLO only asks to define the derivative, which is Remember level, below the PO. It has no design action and no engineering problem or specified needs. It shares only the mathematical topic, so it does not contribute to this PO. The CLO is a sound foundational outcome, but it needs rewriting to reach the PO's level.
  - Draft: "Design solutions to engineering problems that meet specified needs by applying the derivative of a function."
  - Pre-registered rule flags: Bloom escalation (Remember → Create).
- **B2 run 2.** Source quote "Design solutions for complex engineering problems that meet specified needs" · target quote "Define the derivative of a function"
  - Explanation: The PO asks for Create-level design of solutions to complex engineering problems that meet specified needs. The CLO only asks to define the derivative (Remember). It has no design verb, no engineering problem subject and no specified needs. It is a sound foundational outcome for the course, but it does not develop this PO, so the tag does not fit.
  - Pre-registered rule flags: re-tag.

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite (Bloom escalation (Remember → Create)); run 2 Not aligned, rewrite (Bloom escalation (Remember → Create)). B2: run 1 Not aligned, rewrite (Bloom escalation (Remember → Create)); run 2 Not aligned, re-map (re-tag). B2's run-2 re-tag keeps a recall-level CLO under an Apply-level PO. Pre-registered level-gap note: "Year 1: raising "Define the derivative" to design is a faculty decision; re-tagging to the apply-mathematics PO keeps it."

**Policy questions:** P5, re-mapping (re-tag) recommendations.

### MA7-02 · `clo-po-calc-unrelated` (Set 2)

- **Course context:** MA 7 Differential Calculus (BSIE, year 1); a test record. Description: "Limits, continuity, derivatives and their applications to engineering problems." BSIE 2022-2023 curriculum: MA 7 DIFFERENTIAL CALCULUS, year 1, 1st semester, 3 lecture and 0 laboratory units, prerequisite (blank in the source).
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Communicate effectively with a range of audiences.

- **Target (verbatim):**

> Evaluate limits of rational functions.

- **Provisional labels (developer-written, not faculty-reviewed):** Not aligned or Partially aligned · category clear-negative. Rationale: "Nothing about communication."
- **Pre-registered remap candidate; provisional remedy RETAG: "A sound Differential Calculus CLO; the communication PO is the wrong mapping. A rewrite would turn mathematics into communication."**
- **Faculty forms:** Part A MA7-02; Part B MA7-02-R1, MA7-02-R2, MA7-02-R3.
- **Also in eval-1.1:** this case is an unchanged copy. A1 (same model, prompt alignment-10) answered run 1 Not aligned, run 2 Not aligned.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Apply → Evaluate | rewrite |
| A2 | 2 | Not aligned | agrees | Apply → Evaluate | rewrite |
| B2 | 1 | Not aligned | agrees | Apply → Apply | re-map (re-tag) |
| B2 | 2 | Not aligned | agrees | Apply → Apply | re-map (re-tag) |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Communicate effectively with a range of audiences." · target quote "Evaluate limits of rational functions."
  - Explanation: The PO is about communicating with different audiences. The CLO is about computing limits of rational functions. It has no communication verb, no audience, and a different subject.
  - Draft: "Evaluate limits of rational functions and communicate the steps and results effectively in written and oral form to peers and non-specialist audiences."
- **A2 run 2.** Source quote "Communicate effectively with a range of audiences" · target quote "Evaluate limits of rational functions"
  - Explanation: The PO is about communicating effectively with different audiences. The CLO is about evaluating limits of rational functions, so it has no communication verb, no audience and a different subject.
  - Draft: "Communicate the evaluation of limits of rational functions clearly to technical and non-technical audiences using correct notation, graphs and written explanations."
- **B2 run 1.** Source quote "Communicate effectively with a range of audiences" · target quote "Evaluate limits of rational functions"
  - Explanation: The PO asks for effective communication with a range of audiences. The CLO asks for evaluating limits of rational functions, which is mathematical computation. It has no communication action, no audience and no communicated output. The CLO is sound for the course, but this PO is not the one it develops, so the tag does not fit.
  - Pre-registered rule flags: re-tag.
- **B2 run 2.** Source quote "Communicate effectively with a range of audiences" · target quote "Evaluate limits of rational functions"
  - Explanation: The PO asks for effective communication with a range of audiences. The CLO asks for evaluating limits of rational functions, a mathematical computation skill with no communication verb, audience or output. The tag does not fit the CLO, which is a sound outcome for the course.
  - Pre-registered rule flags: re-tag.

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite; run 2 Not aligned, rewrite. B2: run 1 Not aligned, re-map (re-tag); run 2 Not aligned, re-map (re-tag). B2's re-tag explanations say the tag does not fit; neither names the PO to move to. Pre-registered remap candidate; provisional remedy RETAG: "A sound Differential Calculus CLO; the communication PO is the wrong mapping. A rewrite would turn mathematics into communication."

**Policy questions:** P5, re-mapping (re-tag) recommendations.

### MA7-03 · `d-po-02` (Set 2)

- **Course context:** MA 7 Differential Calculus (BSIE, year 1); a test record. Description: "Limits, continuity, derivatives and their applications to engineering problems." BSIE 2022-2023 curriculum: MA 7 DIFFERENTIAL CALCULUS, year 1, 1st semester, 3 lecture and 0 laboratory units, prerequisite (blank in the source).
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Design solutions for complex engineering problems that meet specified needs.

- **Target (verbatim):**

> Compute the derivative of a polynomial using the power rule.

- **Provisional labels (developer-written, not faculty-reviewed):** Not aligned or Partially aligned · category level-gap. Rationale: "A routine calculation does not develop design."
- **Pre-registered level-gap note: "Year 1: a sound Apply-level calculus CLO; raising it to design to fit a design PO is escalation; a re-tag keeps it."**
- **Faculty forms:** Part A MA7-03; Part B MA7-03-R1, MA7-03-R2, MA7-03-R3.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Create → Apply | rewrite |
| A2 | 2 | Not aligned | agrees | Create → Apply | rewrite |
| B2 | 1 | Not aligned | agrees | Create → Apply | re-map (re-tag) |
| B2 | 2 | Not aligned | agrees | Create → Apply | re-map (re-tag) |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Design solutions for complex engineering problems" · target quote "Compute the derivative of a polynomial using the power rule."
  - Explanation: The PO asks to design solutions that meet needs (Create). The CLO only computes a polynomial derivative with the power rule (Apply). It has no design verb, a lower Bloom level, and no engineering problem or specified needs.
  - Draft: "Design a solution to an engineering problem that meets specified needs by using derivatives, including the power rule, to model and optimize it."
  - Pre-registered rule flags: Bloom escalation (Apply → Create).
- **A2 run 2.** Source quote "Design solutions for complex engineering problems that meet specified needs" · target quote "Compute the derivative of a polynomial using the power rule"
  - Explanation: The PO asks to design solutions that meet specified needs (Create). The CLO only computes a derivative by a rule (Apply), so it has no design verb, is below the PO's Bloom level, and has no engineering problem or specified needs.
  - Draft: "Design solutions to engineering problems that meet specified needs by applying derivatives, such as determining dimensions that minimize cost under given constraints."
  - Pre-registered rule flags: Bloom escalation (Apply → Create); replacement (keeps 20% of the original).
- **B2 run 1.** Source quote "Design solutions for complex engineering problems" · target quote "Compute the derivative of a polynomial using the power rule"
  - Explanation: The source PO asks for designing solutions for complex engineering problems (Create level). The target CLO only asks to compute a polynomial derivative with the power rule (Apply level). It lacks the key verb 'design', its Bloom level is lower than the PO asks, and its subject (a routine calculus procedure) is not engineering design or complex problems. The CLO is sound for a Differential Calculus course, but this PO is not the one it develops, so the tag does not fit.
  - Pre-registered rule flags: re-tag.
- **B2 run 2.** Source quote "Design solutions for complex engineering problems" · target quote "Compute the derivative of a polynomial"
  - Explanation: The PO (source) asks for designing solutions for complex engineering problems that meet specified needs (Create). The CLO (target) only asks the student to compute a derivative with the power rule (Apply), a routine procedure. It has no design verb, a lower Bloom level, and no engineering problem or specified needs. The CLO is sound for Differential Calculus, but this PO is not the one it develops, so the tag does not fit.
  - Pre-registered rule flags: re-tag.

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite (Bloom escalation (Apply → Create)); run 2 Not aligned, rewrite (Bloom escalation (Apply → Create); replacement (keeps 20% of the original)). B2: run 1 Not aligned, re-map (re-tag); run 2 Not aligned, re-map (re-tag). A2's rewrites raise the computation CLO to engineering design. Pre-registered level-gap note: "Year 1: a sound Apply-level calculus CLO; raising it to design to fit a design PO is escalation; a re-tag keeps it."

**Policy questions:** P5, re-mapping (re-tag) recommendations.

### MA7-06 · `clo-po-calc-vague` (Set 2)

- **Course context:** MA 7 Differential Calculus (BSIE, year 1); a test record. Description: "Limits, continuity, derivatives and their applications to engineering problems." BSIE 2022-2023 curriculum: MA 7 DIFFERENTIAL CALCULUS, year 1, 1st semester, 3 lecture and 0 laboratory units, prerequisite (blank in the source).
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Apply knowledge of mathematics and science to solve complex engineering problems.

- **Target (verbatim):**

> Understand calculus.

- **Provisional labels (developer-written, not faculty-reviewed):** Partially aligned or Not aligned · category level-gap. Rationale: "No action or object that can be compared."
- **Pre-registered level-gap note: "A vague CLO: raising it to Apply is appropriate."**
- **Faculty forms:** Part A MA7-06; Part B MA7-06-R1, MA7-06-R2, MA7-06-R3.
- **Also in eval-1.1:** this case is an unchanged copy. A1 (same model, prompt alignment-10) answered run 1 Partially aligned, run 2 Partially aligned.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Partially aligned | agrees | Apply → Understand | rewrite |
| A2 | 2 | Partially aligned | agrees | Apply → Understand | rewrite |
| B2 | 1 | Partially aligned | agrees | Apply → Understand | rewrite |
| B2 | 2 | Partially aligned | agrees | Apply → Understand | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "solve complex engineering problems" · target quote "Understand calculus."
  - Explanation: "Understand calculus" is vague. It lacks the PO's verbs apply and solve. Its Bloom level (Understand) is below Apply. It names no engineering problems and no specific calculus content such as limits or derivatives.
  - Draft: "Apply limits and derivatives to solve engineering problems."
  - Pre-registered rule flags: Bloom escalation (Understand → Apply); replacement (keeps 0% of the original).
- **A2 run 2.** Source quote "Apply knowledge of mathematics and science to solve complex engineering problems" · target quote "Understand calculus"
  - Explanation: The CLO only shares the topic of mathematics with the PO. 'Understand' is below the PO's Apply level. It does not say what is understood, and it has no engineering problems or solving.
  - Draft: "Apply the concepts of limits, continuity and derivatives to solve engineering problems."
  - Pre-registered rule flags: Bloom escalation (Understand → Apply); replacement (keeps 0% of the original).
- **B2 run 1.** Source quote "Apply knowledge of mathematics and science to solve complex engineering problems" · target quote "Understand calculus"
  - Explanation: The CLO uses the verb 'Understand', which is not an observable, assessable action and sits at Understand level, below the PO's Apply. It has no application and no engineering problem solving. It only shares the topic word calculus with the PO's mathematics. It is also too broad, since it would fit any calculus course.
  - Draft: "Apply the concepts of limits and derivatives to solve engineering problems."
  - Pre-registered rule flags: Bloom escalation (Understand → Apply); replacement (keeps 0% of the original).
- **B2 run 2.** Source quote "Apply knowledge of mathematics and science to solve complex engineering problems" · target quote "Understand calculus"
  - Explanation: The CLO shares the mathematics subject (calculus) with the PO, but 'Understand' is Understand-level, lower than the PO's Apply. It is not an observable action, and it states no problem solving and no engineering problems. The PO's verb and its object (complex engineering problems) are missing.
  - Draft: "Apply the concepts of limits and derivatives to solve engineering problems."
  - Pre-registered rule flags: Bloom escalation (Understand → Apply); replacement (keeps 0% of the original).

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Partially aligned, rewrite (Bloom escalation (Understand → Apply); replacement (keeps 0% of the original)); run 2 Partially aligned, rewrite (Bloom escalation (Understand → Apply); replacement (keeps 0% of the original)). B2: run 1 Partially aligned, rewrite (Bloom escalation (Understand → Apply); replacement (keeps 0% of the original)); run 2 Partially aligned, rewrite (Bloom escalation (Understand → Apply); replacement (keeps 0% of the original)). Pre-registered level-gap note: "A vague CLO: raising it to Apply is appropriate."

**Policy questions:** none of P1–P7 directly; see I11 for limits on recommendations.

### MA7-09 · `d-any-po-02` (Set 2)

- **Course context:** MA 7 Differential Calculus (BSIE, year 1); a test record. Description: "Limits, continuity, derivatives and their applications to engineering problems." BSIE 2022-2023 curriculum: MA 7 DIFFERENTIAL CALCULUS, year 1, 1st semester, 3 lecture and 0 laboratory units, prerequisite (blank in the source).
- **Relationship type:** CLO-anyPO. Source: Program outcomes (the whole list). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> 1. Apply knowledge of mathematics and science to solve complex engineering problems.
> 2. Design solutions for complex engineering problems that meet specified needs.
> 3. Function effectively as a member or leader of a team.
> 4. Communicate effectively on complex engineering activities with the engineering community and society.
> 5. Recognize the need for, and engage in, independent and lifelong learning.

- **Target (verbatim):**

> Appreciate the history of ancient Rome and its art.

- **Provisional labels (developer-written, not faculty-reviewed):** Not aligned or Partially aligned · category whole-list. Rationale: "Fits none of the five."
- **Faculty forms:** Part A MA7-09; Part B MA7-09-R1, MA7-09-R2, MA7-09-R3, MA7-09-R4.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Understand → Understand | rewrite |
| A2 | 2 | Not aligned | agrees | Apply → Understand | rewrite |
| B2 | 1 | Not aligned | agrees | Apply → Understand | rewrite |
| B2 | 2 | Not aligned | agrees | Apply → Understand | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "5. Recognize the need for, and engage in, independent and lifelong learning." · target quote "Appreciate the history of ancient Rome and its art."
  - Explanation: Best-fitting item is PO 5 (learning), but the CLO is about appreciating Roman history and art, which is unrelated to engineering or mathematics. It has no engineering subject, and 'Appreciate' (Understand) does not match any PO verb; it also has nothing to do with Differential Calculus.
  - Draft: "Apply derivatives to solve engineering problems involving rates of change and optimization."
  - Pre-registered rule flags: Bloom escalation (Understand → Apply); replacement (keeps 0% of the original).
- **A2 run 2.** Source quote "1. Apply knowledge of mathematics and science to solve complex engineering problems." · target quote "Appreciate the history of ancient Rome and its art."
  - Explanation: No PO fits. The CLO is about appreciating the history and art of ancient Rome: it is an Understand/affective outcome in a humanities subject, with no engineering or mathematics subject. It has none of the verbs of POs 1 to 5. The best-fitting item is PO 1, so the draft rewrites it toward Differential Calculus and begins with its verb.
  - Draft: "Apply knowledge of limits, continuity and derivatives to solve complex engineering problems."
  - Pre-registered rule flags: Bloom escalation (Understand → Apply); replacement (keeps 0% of the original).
- **B2 run 1.** Source quote "Apply knowledge of mathematics and science to solve complex engineering problems." · target quote "Appreciate the history of ancient Rome and its art."
  - Explanation: The CLO (target) is about appreciating Roman history and art, which has no connection to Differential Calculus. It fits none of POs 1-5. Closest is PO 1 (apply mathematics), but the CLO uses a Remember/Understand-level verb ('Appreciate'), names no mathematics, and has no engineering subject matter.
  - Draft: "Apply limits and differentiation rules to solve engineering problems."
  - Pre-registered rule flags: Bloom escalation (Understand → Apply); replacement (keeps 0% of the original).
- **B2 run 2.** Source quote "Apply knowledge of mathematics and science to solve complex engineering problems." · target quote "Appreciate the history of ancient Rome and its art."
  - Explanation: The CLO (target) is about the history of ancient Rome and its art. It fits none of the POs in the list: its verb 'Appreciate' is only Understand level, and its subject has nothing to do with engineering, mathematics or science. The closest item is PO 1, but the CLO does not apply mathematics to engineering problems. It is also not a Differential Calculus outcome.
  - Draft: "Apply differentiation techniques to solve engineering problems involving rates of change and optimization."
  - Pre-registered rule flags: Bloom escalation (Understand → Apply); replacement (keeps 0% of the original).

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite (Bloom escalation (Understand → Apply); replacement (keeps 0% of the original)); run 2 Not aligned, rewrite (Bloom escalation (Understand → Apply); replacement (keeps 0% of the original)). B2: run 1 Not aligned, rewrite (Bloom escalation (Understand → Apply); replacement (keeps 0% of the original)); run 2 Not aligned, rewrite (Bloom escalation (Understand → Apply); replacement (keeps 0% of the original)).

**Policy questions:** none of P1–P7 directly; see I11 for limits on recommendations.

### MA7-10 · `d-ega-04` (Set 2)

- **Course context:** MA 7 Differential Calculus (BSIE, year 1); a test record. Description: "Limits, continuity, derivatives and their applications to engineering problems." BSIE 2022-2023 curriculum: MA 7 DIFFERENTIAL CALCULUS, year 1, 1st semester, 3 lecture and 0 laboratory units, prerequisite (blank in the source).
- **Relationship type:** CLO-EGA. Source: Expected graduate attribute (EGA). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Socially Responsive Steward

- **Target (verbatim):**

> Compute the derivative of trigonometric functions.

- **Provisional labels (developer-written, not faculty-reviewed):** Not aligned or Partially aligned · category clear-negative. Rationale: "Nothing about responsibility toward society."
- **Pre-registered remap candidate; provisional remedy RETAG: "A sound calculus CLO; Socially Responsive Steward is the wrong attribute. Adding social service to it would force the fit."**
- **Faculty forms:** Part A MA7-10; Part B MA7-10-R1, MA7-10-R2, MA7-10-R3.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Evaluate → Apply | rewrite |
| A2 | 2 | Not aligned | agrees | Apply → Apply | rewrite |
| B2 | 1 | Not aligned | agrees | Apply → Apply | re-map (re-tag) |
| B2 | 2 | Not aligned | agrees | Apply → Apply | re-map (re-tag) |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Socially Responsive Steward" · target quote "Compute the derivative of trigonometric functions."
  - Explanation: The EGA is about responsible, socially minded stewardship. The CLO is a purely technical computation (Apply) with no social or community context, no responsibility and no stewardship competency.
  - Draft: "Apply derivatives of trigonometric functions to model and solve engineering problems of community concern, such as vibration in structures, and explain the benefit of the solution to society."
- **A2 run 2.** Source quote "Socially Responsive Steward" · target quote "Compute the derivative of trigonometric functions"
  - Explanation: The CLO only computes derivatives of trigonometric functions. It has no social responsiveness or stewardship, no community or societal context, and no responsible use of results.
  - Draft: "Apply derivatives of trigonometric functions to model and analyze periodic engineering phenomena, such as vibration or electrical signals, and explain how the results serve community needs responsibly."
- **B2 run 1.** Source quote "Socially Responsive Steward" · target quote "Compute the derivative of trigonometric functions."
  - Explanation: The source EGA asks for socially responsive stewardship, which means acting responsibly for the community and the environment. The target CLO only computes derivatives of trigonometric functions (Apply level), and states no social, community or stewardship element. The CLO is a sound calculus outcome, but this EGA is not the one it develops, so the tag does not fit.
  - Pre-registered rule flags: re-tag.
- **B2 run 2.** Source quote "Socially Responsive Steward" · target quote "Compute the derivative of trigonometric functions."
  - Explanation: The EGA (source) names social responsibility and stewardship. The CLO (target) is a purely technical computation of derivatives of trigonometric functions. It has no social, community or ethical element, so it does not develop this attribute. The CLO is sound for the course, so the EGA tag does not fit.
  - Pre-registered rule flags: re-tag.

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite; run 2 Not aligned, rewrite. B2: run 1 Not aligned, re-map (re-tag); run 2 Not aligned, re-map (re-tag). A2's rewrites add community service to the calculus CLO, which the developer note says would force the fit. Pre-registered remap candidate; provisional remedy RETAG: "A sound calculus CLO; Socially Responsive Steward is the wrong attribute. Adding social service to it would force the fit."

**Policy questions:** P5, re-mapping (re-tag) recommendations.

### MA7-11 · `d-ega-06` (Set 2)

- **Course context:** MA 7 Differential Calculus (BSIE, year 1); a test record. Description: "Limits, continuity, derivatives and their applications to engineering problems." BSIE 2022-2023 curriculum: MA 7 DIFFERENTIAL CALCULUS, year 1, 1st semester, 3 lecture and 0 laboratory units, prerequisite (blank in the source).
- **Relationship type:** CLO-EGA. Source: Expected graduate attribute (EGA). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Transformative Lifelong learner

- **Target (verbatim):**

> Solve quadratic equations.

- **Provisional labels (developer-written, not faculty-reviewed):** Not aligned or Partially aligned · category clear-negative. Rationale: "A skill, with no learning-to-learn element."
- **Pre-registered remap candidate; provisional remedy EITHER (faculty): "Solving quadratic equations is below Differential Calculus and develops no lifelong learning: rewrite it for the course or re-tag it."**
- **Faculty forms:** Part A MA7-11; Part B MA7-11-R1, MA7-11-R2, MA7-11-R3, MA7-11-R4.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Evaluate → Apply | rewrite |
| A2 | 2 | Not aligned | agrees | Evaluate → Apply | rewrite |
| B2 | 1 | Not aligned | agrees | N/A → Apply | re-map (re-tag) |
| B2 | 2 | Not aligned | agrees | N/A → Apply | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Transformative Lifelong learner" · target quote "Solve quadratic equations."
  - Explanation: The EGA asks for lifelong learning and transformation (self-directed, continuing learning). The CLO 'Solve quadratic equations' is a narrow Apply-level algebra skill. It has no verb or competency of learning independently, no reflection or growth, and it is also not a Differential Calculus topic (limits, derivatives, applications). Only the subject is mathematics, with no link to the attribute.
  - Draft: "Apply derivatives to analyze engineering problems and reflect on gaps in one's own understanding to plan further independent study of calculus."
  - Pre-registered rule flags: replacement (keeps 0% of the original).
- **A2 run 2.** Source quote "Transformative Lifelong learner" · target quote "Solve quadratic equations."
  - Explanation: The EGA asks for lifelong learning and transformation (reflecting on, seeking and sustaining one's own learning), but the CLO is only a procedural algebra skill. (1) It has no verb or competency of lifelong learning. (2) Its Bloom level (Apply) is not the level of self-directed learning. (3) Its subject, quadratic equations, is unrelated to the attribute and is not part of Differential Calculus. The draft ties the CLO to calculus and to independent learning.
  - Draft: "Evaluate one's own understanding of limits and derivatives and independently choose study strategies and resources to solve differential calculus problems."
  - Pre-registered rule flags: Bloom escalation (Apply → Evaluate).
- **B2 run 1.** Source quote "Transformative Lifelong learner" · target quote "Solve quadratic equations"
  - Explanation: The EGA asks for a transformative lifelong learner (self-directed, reflective, continuing learning). The CLO only asks the student to solve quadratic equations. It names no learning behaviour, reflection or growth. It is a routine algebra skill and shares no verb or subject with the EGA. The tag does not fit, so the EGA choice is what is wrong, not the CLO wording.
  - Pre-registered rule flags: re-tag.
- **B2 run 2.** Source quote "Transformative Lifelong learner" · target quote "Solve quadratic equations."
  - Explanation: The target CLO asks the student to solve quadratic equations, an Apply-level algebra skill. The source EGA asks for a transformative lifelong learner, meaning self-directed learning and reflection. The CLO states no learning, reflection or self-directed action, so the EGA's competence is not built. The CLO is also prerequisite algebra and not a differential calculus outcome (limits, continuity, derivatives, applications), so the text itself needs to change.
  - Draft: "Evaluate one's own understanding of limits and derivatives and apply independent study strategies to solve differentiation problems."
  - Pre-registered rule flags: Bloom escalation (Apply → Evaluate).

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite (replacement (keeps 0% of the original)); run 2 Not aligned, rewrite (Bloom escalation (Apply → Evaluate)). B2: run 1 Not aligned, re-map (re-tag); run 2 Not aligned, rewrite (Bloom escalation (Apply → Evaluate)). B2's run-1 re-tag keeps a CLO the developer note calls below the course; its run-2 rewrite raises it for the course and the attribute. Pre-registered remap candidate; provisional remedy EITHER (faculty): "Solving quadratic equations is below Differential Calculus and develops no lifelong learning: rewrite it for the course or re-tag it."

**Policy questions:** P4, course fit and year level; P5, re-mapping (re-tag) recommendations; P7, cognitive levels for attributes and multi-verb outcomes.

### MA7-13 · `d-ega-02` (Set 2)

- **Course context:** MA 7 Differential Calculus (BSIE, year 1); a test record. Description: "Limits, continuity, derivatives and their applications to engineering problems." BSIE 2022-2023 curriculum: MA 7 DIFFERENTIAL CALCULUS, year 1, 1st semester, 3 lecture and 0 laboratory units, prerequisite (blank in the source).
- **Relationship type:** CLO-EGA. Source: Expected graduate attribute (EGA). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Critical and Creative thinker

- **Target (verbatim):**

> Recite the multiplication table.

- **Provisional labels (developer-written, not faculty-reviewed):** Not aligned or Partially aligned · category clear-negative. Rationale: "Pure recall."
- **Pre-registered remap candidate; provisional remedy REWRITE: "Reciting the multiplication table is not a college calculus outcome: weak in itself."**
- **Faculty forms:** Part A MA7-13; Part B MA7-13-R1, MA7-13-R2, MA7-13-R3, MA7-13-R4.
- **Same CLO in:** MA7-14 (`d-any-ega-02`).

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Evaluate → Remember | rewrite |
| A2 | 2 | Not aligned | agrees | Analyze → Remember | rewrite |
| B2 | 1 | Not aligned | agrees | Evaluate → Remember | rewrite |
| B2 | 2 | Not aligned | agrees | Evaluate → Remember | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Critical and Creative thinker" · target quote "Recite the multiplication table."
  - Explanation: Reciting the multiplication table is a Remember-level task. It involves no critical or creative thinking and is not calculus content.
  - Draft: "Analyze an engineering situation and justify the choice of differentiation technique used to solve it."
  - Pre-registered rule flags: Bloom escalation (Remember → Evaluate); replacement (keeps 0% of the original).
- **A2 run 2.** Source quote "Critical and Creative thinker" · target quote "Recite the multiplication table"
  - Explanation: Reciting the multiplication table is Remember-level rote recall. It involves no critical or creative thinking and has no connection to calculus.
  - Draft: "Analyze calculus problems critically and propose creative solution strategies, justifying the choice of method for finding derivatives."
  - Pre-registered rule flags: Bloom escalation (Remember → Create); replacement (keeps 0% of the original).
- **B2 run 1.** Source quote "Critical and Creative thinker" · target quote "Recite the multiplication table."
  - Explanation: The source EGA asks for critical and creative thinking. The target CLO asks only to recite the multiplication table, which is Remember level, involves no analysis, evaluation or creation, and is not about calculus or engineering. It should be rewritten as a calculus outcome that requires critical and creative thinking.
  - Draft: "Analyze an engineering problem and justify the choice of differentiation technique used to solve it."
  - Pre-registered rule flags: Bloom escalation (Remember → Evaluate); replacement (keeps 0% of the original).
- **B2 run 2.** Source quote "Critical and Creative thinker" · target quote "Recite the multiplication table."
  - Explanation: The EGA (source) calls for critical and creative thinking (Analyze/Evaluate/Create). The CLO (target) asks only to recite the multiplication table (Remember). That is rote recall with no analysis, judgement or creativity. It is also not a calculus competence, so it does not belong to Differential Calculus. The CLO itself must change.
  - Draft: "Analyze a given engineering situation and select an appropriate derivative-based approach to solve it, justifying the choice."
  - Pre-registered rule flags: replacement (keeps 0% of the original).

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite (Bloom escalation (Remember → Evaluate); replacement (keeps 0% of the original)); run 2 Not aligned, rewrite (Bloom escalation (Remember → Create); replacement (keeps 0% of the original)). B2: run 1 Not aligned, rewrite (Bloom escalation (Remember → Evaluate); replacement (keeps 0% of the original)); run 2 Not aligned, rewrite (replacement (keeps 0% of the original)). Both arms replaced the CLO; the level of a replacement is for faculty. Pre-registered remap candidate; provisional remedy REWRITE: "Reciting the multiplication table is not a college calculus outcome: weak in itself."

**Policy questions:** P5, re-mapping (re-tag) recommendations.

### MA7-14 · `d-any-ega-02` (Set 2)

- **Course context:** MA 7 Differential Calculus (BSIE, year 1); a test record. Description: "Limits, continuity, derivatives and their applications to engineering problems." BSIE 2022-2023 curriculum: MA 7 DIFFERENTIAL CALCULUS, year 1, 1st semester, 3 lecture and 0 laboratory units, prerequisite (blank in the source).
- **Relationship type:** CLO-anyEGA. Source: Expected graduate attributes (the whole list). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> 1. Critical and Creative thinker
> 2. Competent Catholic Augustinian-Marian Professional
> 3. Socially Responsive Steward
> 4. Transformative Lifelong learner

- **Target (verbatim):**

> Recite the multiplication table.

- **Provisional labels (developer-written, not faculty-reviewed):** Not aligned or Partially aligned · category whole-list. Rationale: "Fits none."
- **Faculty forms:** Part A MA7-14; Part B MA7-14-R1, MA7-14-R2, MA7-14-R3, MA7-14-R4.
- **Same CLO in:** MA7-13 (`d-ega-02`).

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Analyze → Remember | rewrite |
| A2 | 2 | Not aligned | agrees | Analyze → Remember | rewrite |
| B2 | 1 | Not aligned | agrees | Analyze → Remember | rewrite |
| B2 | 2 | Not aligned | agrees | Analyze → Remember | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "1. Critical and Creative thinker" · target quote "Recite the multiplication table."
  - Explanation: Closest is EGA 1 (Critical and Creative thinker), but reciting a multiplication table is Remember-level rote recall. It has no critical or creative thinking, and no link to any other attribute; it is also not a Differential Calculus skill.
  - Draft: "Analyze engineering problems and devise creative solutions using limits and derivatives."
  - Pre-registered rule flags: Bloom escalation (Remember → Create); replacement (keeps 0% of the original).
- **A2 run 2.** Source quote "1. Critical and Creative thinker" · target quote "Recite the multiplication table."
  - Explanation: No EGA fits. Reciting the multiplication table is a Remember-level rote task, below every attribute, which asks for thinking, professionalism, stewardship or lifelong learning. The subject is also elementary arithmetic and not Differential Calculus. The best-fitting item is 1 (Critical and Creative thinker), so the draft begins with its verb.
  - Draft: "Analyze engineering problems critically and creatively, using limits and derivatives to build and justify solutions."
  - Pre-registered rule flags: Bloom escalation (Remember → Analyze); replacement (keeps 0% of the original).
- **B2 run 1.** Source quote "Critical and Creative thinker" · target quote "Recite the multiplication table."
  - Explanation: The CLO (target) asks only for recall of the multiplication table (Remember). It does not develop critical or creative thinking, professional competence, social responsibility or lifelong learning, so it fits none of EGAs 1-4. The closest item is EGA 1, but the CLO involves no analysis or creativity and has no link to Differential Calculus.
  - Draft: "Analyze engineering problems and select appropriate differentiation techniques to solve them."
  - Pre-registered rule flags: Bloom escalation (Remember → Analyze); replacement (keeps 0% of the original).
- **B2 run 2.** Source quote "Critical and Creative thinker" · target quote "Recite the multiplication table."
  - Explanation: The CLO (target) asks only to recite the multiplication table, which is Remember level. It builds none of the graduate attributes: it shows no critical or creative thinking, no professional, social or lifelong-learning competence. It is also far below the level of a first-year Differential Calculus course. The nearest attribute is 1 (Critical and Creative thinker).
  - Draft: "Analyze engineering problems and select appropriate differentiation methods to solve them, justifying the chosen approach."
  - Pre-registered rule flags: Bloom escalation (Remember → Analyze); replacement (keeps 0% of the original).

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite (Bloom escalation (Remember → Create); replacement (keeps 0% of the original)); run 2 Not aligned, rewrite (Bloom escalation (Remember → Analyze); replacement (keeps 0% of the original)). B2: run 1 Not aligned, rewrite (Bloom escalation (Remember → Analyze); replacement (keeps 0% of the original)); run 2 Not aligned, rewrite (Bloom escalation (Remember → Analyze); replacement (keeps 0% of the original)).

**Policy questions:** none of P1–P7 directly; see I11 for limits on recommendations.

### MA7-18 · `ilo-clo-claims-more` (Set 2)

- **Course context:** MA 7 Differential Calculus (BSIE, year 1); a test record. Description: "Limits, continuity, derivatives and their applications to engineering problems." BSIE 2022-2023 curriculum: MA 7 DIFFERENTIAL CALCULUS, year 1, 1st semester, 3 lecture and 0 laboratory units, prerequisite (blank in the source).
- **Relationship type:** ILO-CLO. Source: Course learning outcome (CLO). Target: Intended learning outcome (ILO).
- **Source (verbatim):**

> Define limits of functions.

- **Target (verbatim):**

> Design and implement a numerical solver for limits.

- **Provisional labels (developer-written, not faculty-reviewed):** Partially aligned or Not aligned · category level-gap. Rationale: "The ILO asks for much more than the CLO."
- **Pre-registered level-gap note: "ILO above its CLO: a draft should lower the ILO; raising it further would be wrong."**
- **Faculty forms:** Part A MA7-18; Part B MA7-18-R1, MA7-18-R2, MA7-18-R3, MA7-18-R4.
- **Also in eval-1.1:** this case is an unchanged copy. A1 (same model, prompt alignment-10) answered run 1 Partially aligned, run 2 Partially aligned.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Partially aligned | agrees | Remember → Create | rewrite |
| A2 | 2 | Partially aligned | agrees | Remember → Create | rewrite |
| B2 | 1 | Partially aligned | agrees | Remember → Create | rewrite |
| B2 | 2 | Partially aligned | agrees | Remember → Create | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Define limits of functions." · target quote "Design and implement a numerical solver for limits."
  - Explanation: Both texts are about limits. However, the ILO asks to design and implement a numerical solver (Create), while the CLO only asks to define limits (Remember). The ILO therefore claims much more than the CLO. Implementing a solver is also programming work, not part of this CLO.
  - Draft: "Define the limit of a function using proper notation and describe it from a graph."
  - Pre-registered rule flags: replacement (keeps 20% of the original).
- **A2 run 2.** Source quote "Define limits of functions" · target quote "Design and implement a numerical solver for limits"
  - Explanation: The subject (limits) is the same, but the ILO asks to design and implement a numerical solver (Create). The CLO only asks to define limits (Remember), so the ILO claims far more than the CLO and does not build toward it as a smaller step.
  - Draft: "State the definition of the limit of a function using correct notation."
  - Pre-registered rule flags: replacement (keeps 20% of the original).
- **B2 run 1.** Source quote "Define limits of functions." · target quote "Design and implement a numerical solver for limits."
  - Explanation: The ILO is on the CLO's subject of limits but claims more than the CLO. The CLO asks only to "Define" limits (Remember). The ILO asks to "Design and implement" (Create) a numerical solver, and the CLO has no software or numerical-method component. The ILO is not a step toward the CLO and overreaches it in both Bloom level and scope.
  - Draft: "Define the limit of a function at a point."
  - Pre-registered rule flags: replacement (keeps 20% of the original).
- **B2 run 2.** Source quote "Define limits of functions." · target quote "Design and implement a numerical solver for limits."
  - Explanation: The ILO (target) is about limits, the same subject as the CLO (source). But it asks to "Design and implement" a numerical solver, which is Create level, while the CLO only asks to define (Remember). The ILO therefore claims more than the CLO, and building a solver is not a step toward defining limits.
  - Draft: "Define the limit of a function."
  - Pre-registered rule flags: replacement (keeps 20% of the original).

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Partially aligned, rewrite (replacement (keeps 20% of the original)); run 2 Partially aligned, rewrite (replacement (keeps 20% of the original)). B2: run 1 Partially aligned, rewrite (replacement (keeps 20% of the original)); run 2 Partially aligned, rewrite (replacement (keeps 20% of the original)). Pre-registered level-gap note: "ILO above its CLO: a draft should lower the ILO; raising it further would be wrong."

**Policy questions:** none of P1–P7 directly; see I11 for limits on recommendations.

### MA7-19 · `ilo-clo-unrelated` (Set 2)

- **Course context:** MA 7 Differential Calculus (BSIE, year 1); a test record. Description: "Limits, continuity, derivatives and their applications to engineering problems." BSIE 2022-2023 curriculum: MA 7 DIFFERENTIAL CALCULUS, year 1, 1st semester, 3 lecture and 0 laboratory units, prerequisite (blank in the source).
- **Relationship type:** ILO-CLO. Source: Course learning outcome (CLO). Target: Intended learning outcome (ILO).
- **Source (verbatim):**

> Apply differentiation rules to solve optimization problems in engineering.

- **Target (verbatim):**

> Describe the history of ancient Rome.

- **Provisional labels (developer-written, not faculty-reviewed):** Not aligned · category clear-negative. Rationale: "Unrelated subject."
- **Faculty forms:** Part A MA7-19; Part B MA7-19-R1, MA7-19-R2, MA7-19-R3, MA7-19-R4.
- **Same CLO in:** MA7-04 (`clo-po-calc-aligned`), MA7-15 (`d-ilo-01`), MA7-16 (`ilo-clo-calc-aligned`), MA7-17 (`d-ilo-14`).
- **Also in eval-1.1:** this case is an unchanged copy. A1 (same model, prompt alignment-10) answered run 1 Not aligned, run 2 Not aligned.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Apply → Understand | rewrite |
| A2 | 2 | Not aligned | agrees | Apply → Understand | rewrite |
| B2 | 1 | Not aligned | agrees | Apply → Understand | rewrite |
| B2 | 2 | Not aligned | agrees | Apply → Understand | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Apply differentiation rules to solve optimization problems" · target quote "Describe the history of ancient Rome."
  - Explanation: The ILO is about the history of ancient Rome. The CLO is about differentiation for engineering optimization. The ILO is therefore in a different subject and does not build toward the CLO.
  - Draft: "Apply differentiation rules to find the maximum or minimum of a function that models an engineering quantity."
  - Pre-registered rule flags: replacement (keeps 0% of the original).
- **A2 run 2.** Source quote "Apply differentiation rules to solve optimization problems in engineering" · target quote "Describe the history of ancient Rome"
  - Explanation: The ILO is about the history of ancient Rome, which has no connection to differentiation or engineering optimization. It also has the wrong subject and does not build toward the CLO's Apply level.
  - Draft: "Apply derivatives to find the maximum or minimum value of a quantity in a simple engineering situation."
  - Pre-registered rule flags: replacement (keeps 0% of the original).
- **B2 run 1.** Source quote "Apply differentiation rules to solve optimization problems in engineering." · target quote "Describe the history of ancient Rome."
  - Explanation: The CLO asks the student to apply differentiation rules to engineering optimization problems. The ILO describes the history of ancient Rome, which is a different subject with no calculus content. It is also only a Remember/Understand-level task and does not build the CLO. The ILO does not belong in this course and needs rewriting toward the CLO's subject.
  - Draft: "Apply the first-derivative test to find the maximum or minimum value of a function that models an engineering quantity."
  - Pre-registered rule flags: replacement (keeps 0% of the original).
- **B2 run 2.** Source quote "Apply differentiation rules to solve optimization problems in engineering." · target quote "Describe the history of ancient Rome."
  - Explanation: The ILO (target) is about the history of ancient Rome, which has nothing to do with the CLO (source), which applies differentiation rules to engineering optimization. It is also not a calculus outcome of this course, and it is only a Understand/Remember-level description, below the CLO's Apply level.
  - Draft: "Apply the power rule and product rule to differentiate functions that model engineering quantities."
  - Pre-registered rule flags: replacement (keeps 0% of the original).

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite (replacement (keeps 0% of the original)); run 2 Not aligned, rewrite (replacement (keeps 0% of the original)). B2: run 1 Not aligned, rewrite (replacement (keeps 0% of the original)); run 2 Not aligned, rewrite (replacement (keeps 0% of the original)).

**Policy questions:** none of P1–P7 directly; see I11 for limits on recommendations.

### MA7-20 · `d-ilo-12` (Set 2)

- **Course context:** MA 7 Differential Calculus (BSIE, year 1); a test record. Description: "Limits, continuity, derivatives and their applications to engineering problems." BSIE 2022-2023 curriculum: MA 7 DIFFERENTIAL CALCULUS, year 1, 1st semester, 3 lecture and 0 laboratory units, prerequisite (blank in the source).
- **Relationship type:** ILO-CLO. Source: Course learning outcome (CLO). Target: Intended learning outcome (ILO).
- **Source (verbatim):**

> Define the limit of a function.

- **Target (verbatim):**

> Prove the epsilon-delta definition of a limit for arbitrary functions.

- **Provisional labels (developer-written, not faculty-reviewed):** Partially aligned or Not aligned · category level-gap. Rationale: "The ILO goes far beyond the CLO's level."
- **Pre-registered level-gap note: "ILO above its CLO: a draft should lower the ILO; raising it further would be wrong."**
- **Faculty forms:** Part A MA7-20; Part B MA7-20-R1, MA7-20-R2, MA7-20-R3, MA7-20-R4.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Remember → Create | rewrite |
| A2 | 2 | Not aligned | agrees | Remember → Evaluate | rewrite |
| B2 | 1 | Not aligned | agrees | Remember → Create | rewrite |
| B2 | 2 | Not aligned | agrees | Remember → Create | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Define the limit of a function." · target quote "Prove the epsilon-delta definition of a limit for arbitrary functions."
  - Explanation: The ILO claims more than the CLO. The CLO asks only to define the limit (Remember), but the ILO asks to prove the epsilon-delta definition for arbitrary functions (Evaluate/Create level). That is far above the CLO's level and scope, so it is not a smaller step.
  - Draft: "State the definition of the limit of a function and explain it in terms of values approaching a number."
- **A2 run 2.** Source quote "Define the limit of a function." · target quote "Prove the epsilon-delta definition of a limit for arbitrary functions."
  - Explanation: The ILO is at Remember level (define) and the target text is a stronger Create/Evaluate-level proof claim. The pair is checked with the CLO as source: the CLO asks to define the limit of a function, while the ILO text (target) claims to prove the epsilon-delta definition for arbitrary functions. This claims far more than the CLO (it goes from Remember to Evaluate/Create), which fails the test that it does not claim more than the CLO. It is the same subject, limits, but the Bloom level is too high.
  - Draft: "State the definition of the limit of a function and explain it in words and with the epsilon-delta idea for simple functions."
- **B2 run 1.** Source quote "Define the limit of a function" · target quote "Prove the epsilon-delta definition of a limit for arbitrary functions"
  - Explanation: The source (CLO) only asks the student to define the limit of a function, which is Remember level. The target (ILO) asks the student to prove the epsilon-delta definition of a limit for arbitrary functions, which is Create/Evaluate level. This breaks the ILO-CLO test that the ILO must not claim more than the CLO. Gaps: (1) the Bloom level is far above the CLO's; (2) formal proof for arbitrary functions is beyond a first-year Differential Calculus ILO and beyond what the CLO asks; (3) the verb 'Prove' is not a step toward 'Define'. The subject is the same (limits), so the ILO needs rewriting rather than a retag.
  - Draft: "State the definition of the limit of a function, including the epsilon-delta form, and explain its meaning."
  - First-attempt refusals: quotes_swapped (re-asked; final answer verified).
- **B2 run 2.** Source quote "Define the limit of a function" · target quote "Prove the epsilon-delta definition of a limit for arbitrary functions"
  - Explanation: The source (CLO) asks only for defining the limit of a function (Remember). The target (ILO) asks students to prove the epsilon-delta definition for arbitrary functions (Create/Evaluate). Gaps: (1) the ILO's Bloom level is far above the CLO's, so it claims more than the CLO; (2) a formal epsilon-delta proof for arbitrary functions is beyond a first-year Differential Calculus course and beyond the CLO; (3) the ILO does not ask students to define the limit, which is what the CLO states.
  - Draft: "State the definition of the limit of a function and explain it using the epsilon-delta idea for simple functions."
  - First-attempt refusals: quotes_swapped (re-asked; final answer verified).

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite; run 2 Not aligned, rewrite. B2: run 1 Not aligned, rewrite; run 2 Not aligned, rewrite. Pre-registered level-gap note: "ILO above its CLO: a draft should lower the ILO; raising it further would be wrong."

**Policy questions:** none of P1–P7 directly; see I11 for limits on recommendations.

### IT204-03 · `d-po-04` (Set 2)

- **Course context:** IT 204 Computer Programming 2 (BSIT, year 2); a test record. Description: "Object-oriented programming, data structures and the design, implementation and testing of programs in a modern language." BSIT 2022-2023 curriculum: IT-204 COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING), year 2, 2nd semester, 2 lecture and 1 laboratory units, prerequisite IT 202.
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Analyze the local and global impact of computing on individuals, organizations and society.

- **Target (verbatim):**

> Write programs in Python that process text files.

- **Provisional labels (developer-written, not faculty-reviewed):** Not aligned or Partially aligned · category keyword-overlap. Rationale: "Shares the word 'computing' context only; no impact analysis."
- **Faculty forms:** Part A IT204-03; Part B IT204-03-R1, IT204-03-R2, IT204-03-R3.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Analyze → Apply | rewrite |
| A2 | 2 | Not aligned | agrees | Analyze → Apply | rewrite |
| B2 | 1 | Not aligned | agrees | Analyze → Apply | re-map (re-tag) |
| B2 | 2 | Not aligned | agrees | Analyze → Apply | re-map (re-tag) |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Analyze the local and global impact of computing on individuals, organizations and society." · target quote "Write programs in Python that process text files."
  - Explanation: The CLO is only about writing Python programs for text files (Apply). The PO asks to analyze local and global impact on individuals, organizations and society. The verb, level and subject are all missing.
  - Draft: "Analyze the local and global impact of programs that process personal text data on individuals, organizations and society."
  - Pre-registered rule flags: Bloom escalation (Apply → Analyze).
- **A2 run 2.** Source quote "Analyze the local and global impact of computing" · target quote "Write programs in Python that process text files."
  - Explanation: The CLO is only about writing Python programs for text files. It has no analysis, Bloom level is Apply rather than Analyze, and it says nothing of the local and global impact of computing on individuals, organizations or society.
  - Draft: "Analyze the local and global impact on individuals, organizations and society of programs that process text files, such as their effects on data privacy."
  - Pre-registered rule flags: Bloom escalation (Apply → Analyze).
- **B2 run 1.** Source quote "Analyze the local and global impact of computing on individuals, organizations and society." · target quote "Write programs in Python that process text files."
  - Explanation: The source PO asks students to analyze the local and global impact of computing on individuals, organizations and society (Analyze level, social-impact subject). The target CLO only states writing Python programs that process text files: it is an Apply-level programming skill. It has no analysis verb, no Analyze level and no societal-impact subject. The CLO is a sound programming outcome, so the PO tag does not fit.
  - Pre-registered rule flags: re-tag.
- **B2 run 2.** Source quote "Analyze the local and global impact of computing on individuals, organizations and society." · target quote "Write programs in Python that process text files."
  - Explanation: The source PO asks students to analyze the local and global impact of computing on individuals, organizations and society (Analyze level, social-impact subject). The target CLO only states writing Python programs that process text files: it is an Apply-level programming skill, its verb 'write' does not match 'analyze', and it says nothing about impact on people, organizations or society. The CLO is sound for this course, so the PO tag does not fit; retag it to a PO about developing or implementing programs.
  - Pre-registered rule flags: re-tag.

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite (Bloom escalation (Apply → Analyze)); run 2 Not aligned, rewrite (Bloom escalation (Apply → Analyze)). B2: run 1 Not aligned, re-map (re-tag); run 2 Not aligned, re-map (re-tag). A2's rewrites turn the Python CLO into impact analysis (Apply to Analyze); B2 run 2 suggests "a PO about developing or implementing programs".

**Policy questions:** P5, re-mapping (re-tag) recommendations.

### IT204-06 · `clo-po-prog-lower-level` (Set 2)

- **Course context:** IT 204 Computer Programming 2 (BSIT, year 2); a test record. Description: "Object-oriented programming, data structures and the design, implementation and testing of programs in a modern language." BSIT 2022-2023 curriculum: IT-204 COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING), year 2, 2nd semester, 2 lecture and 1 laboratory units, prerequisite IT 202.
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Design and evaluate computing solutions for real problems.

- **Target (verbatim):**

> List the keywords of the programming language.

- **Provisional labels (developer-written, not faculty-reviewed):** Partially aligned or Not aligned · category level-gap. Rationale: "Remember-level against design and evaluate."
- **Pre-registered level-gap note: "Year 2: raising "List the keywords" to design and evaluate changes its content; faculty to decide."**
- **Faculty forms:** Part A IT204-06; Part B IT204-06-R1, IT204-06-R2, IT204-06-R3, IT204-06-R4.
- **Also in eval-1.1:** this case is an unchanged copy. A1 (same model, prompt alignment-10) answered run 1 Not aligned, run 2 Not aligned.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Evaluate → Remember | rewrite |
| A2 | 2 | Not aligned | agrees | Create → Remember | rewrite |
| B2 | 1 | Not aligned | agrees | Create → Remember | rewrite |
| B2 | 2 | Not aligned | agrees | Create → Remember | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Design and evaluate computing solutions for real problems." · target quote "List the keywords of the programming language."
  - Explanation: The CLO only asks to list keywords (Remember), while the PO asks to design (Create) and evaluate (Evaluate). Neither key verb appears. The CLO's subject (language keywords) is not the PO's object (computing solutions to real problems).
  - Draft: "Design and evaluate object-oriented program solutions for real problems, justifying the choice of language constructs used."
  - Pre-registered rule flags: Bloom escalation (Remember → Create).
- **A2 run 2.** Source quote "Design and evaluate computing solutions for real problems." · target quote "List the keywords of the programming language."
  - Explanation: Gaps: 'List' is Remember, below the PO's Create/Evaluate level; the CLO has neither 'design' nor 'evaluate'; its object (language keywords) is not computing solutions for real problems.
  - Draft: "Design and evaluate object-oriented program solutions for real problems, using the constructs of the programming language."
  - Pre-registered rule flags: Bloom escalation (Remember → Create).
- **B2 run 1.** Source quote "Design and evaluate computing solutions for real problems." · target quote "List the keywords of the programming language."
  - Explanation: The CLO statement only asks students to list keywords (Remember), while the PO asks for design and evaluation (Create/Evaluate). The CLO has neither the design verb nor the evaluate verb, and it does not mention solving real problems. Its Bloom level is far lower than the PO's.
  - Draft: "Design and evaluate programs in the programming language that solve real problems, using its keywords and constructs correctly."
  - Pre-registered rule flags: Bloom escalation (Remember → Create).
- **B2 run 2.** Source quote "Design and evaluate computing solutions for real problems." · target quote "List the keywords of the programming language."
  - Explanation: The target CLO only asks to list keywords (Remember), while the source PO asks to design and evaluate (Create/Evaluate). Neither key verb appears, the Bloom level is far lower, and recalling keywords does not address real problems or solutions.
  - Draft: "Design and evaluate programs in the programming language that solve given problems."
  - Pre-registered rule flags: Bloom escalation (Remember → Create).

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite (Bloom escalation (Remember → Create)); run 2 Not aligned, rewrite (Bloom escalation (Remember → Create)). B2: run 1 Not aligned, rewrite (Bloom escalation (Remember → Create)); run 2 Not aligned, rewrite (Bloom escalation (Remember → Create)). B2's rewrites raise a Remember-level CLO to designing and evaluating solutions in both runs. Pre-registered level-gap note: "Year 2: raising "List the keywords" to design and evaluate changes its content; faculty to decide."

**Policy questions:** none of P1–P7 directly; see I11 for limits on recommendations.

### IT204-09 · `clo-ega-unrelated` (Set 2)

- **Course context:** IT 204 Computer Programming 2 (BSIT, year 2); a test record. Description: "Object-oriented programming, data structures and the design, implementation and testing of programs in a modern language." BSIT 2022-2023 curriculum: IT-204 COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING), year 2, 2nd semester, 2 lecture and 1 laboratory units, prerequisite IT 202.
- **Relationship type:** CLO-EGA. Source: Expected graduate attribute (EGA). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Competent Professional

- **Target (verbatim):**

> Recite the history of the institution.

- **Provisional labels (developer-written, not faculty-reviewed):** Not aligned or Partially aligned · category clear-negative. Rationale: "No professional competence is shown."
- **Pre-registered remap candidate; provisional remedy REWRITE: "Remember-level and off-subject for a programming course: weak in itself."**
- **Faculty forms:** Part A IT204-09; Part B IT204-09-R1, IT204-09-R2, IT204-09-R3, IT204-09-R4.
- **Also in eval-1.1:** this case is an unchanged copy. A1 (same model, prompt alignment-10) answered run 1 Not aligned, run 2 Not aligned.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Apply → Remember | rewrite |
| A2 | 2 | Not aligned | agrees | Apply → Remember | rewrite |
| B2 | 1 | Not aligned | agrees | Apply → Remember | rewrite |
| B2 | 2 | Not aligned | agrees | Apply → Remember | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Competent Professional" · target quote "Recite the history of the institution."
  - Explanation: Reciting institutional history is Remember level and has nothing to do with professional competence in programming. The subject is not the course's subject.
  - Draft: "Develop and test object-oriented programs to professional standards, applying good coding practice and documentation."
  - Pre-registered rule flags: Bloom escalation (Remember → Create); replacement (keeps 0% of the original).
- **A2 run 2.** Source quote "Competent Professional" · target quote "Recite the history of the institution."
  - Explanation: Reciting institutional history is Remember-level and has nothing to do with professional competence in programming; no competency action or computing subject is present.
  - Draft: "Apply professional programming practices to design, implement and test object-oriented programs that meet given requirements."
  - Pre-registered rule flags: Bloom escalation (Remember → Create); replacement (keeps 0% of the original).
- **B2 run 1.** Source quote "Competent Professional" · target quote "Recite the history of the institution."
  - Explanation: The CLO asks only to recite institutional history (Remember). It has no link to professional competence in computing or to this course's programming subject. It has no professional action and is below the Bloom level the EGA needs. The CLO itself must change.
  - Draft: "Develop and test object-oriented programs that meet given requirements, following accepted professional coding practices."
  - Pre-registered rule flags: Bloom escalation (Remember → Create); replacement (keeps 0% of the original).
- **B2 run 2.** Source quote "Competent Professional" · target quote "Recite the history of the institution."
  - Explanation: The CLO asks only for recall of institutional history (Remember). It has no professional competence in computing, so it does not develop being a Competent Professional. It also does not belong to the subject of Computer Programming 2. The CLO itself has to change.
  - Draft: "Develop and test object-oriented programs in a modern language that meet given requirements, following professional coding and documentation standards."
  - Pre-registered rule flags: Bloom escalation (Remember → Create); replacement (keeps 0% of the original).

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite (Bloom escalation (Remember → Create); replacement (keeps 0% of the original)); run 2 Not aligned, rewrite (Bloom escalation (Remember → Create); replacement (keeps 0% of the original)). B2: run 1 Not aligned, rewrite (Bloom escalation (Remember → Create); replacement (keeps 0% of the original)); run 2 Not aligned, rewrite (Bloom escalation (Remember → Create); replacement (keeps 0% of the original)). B2's replacements are object-oriented programming outcomes at Create, above the level B2 gave the attribute; the level of a replacement is for faculty. Pre-registered remap candidate; provisional remedy REWRITE: "Remember-level and off-subject for a programming course: weak in itself."

**Policy questions:** P5, re-mapping (re-tag) recommendations.

### IT204-13 · `d-ilo-03` (Set 2)

- **Course context:** IT 204 Computer Programming 2 (BSIT, year 2); a test record. Description: "Object-oriented programming, data structures and the design, implementation and testing of programs in a modern language." BSIT 2022-2023 curriculum: IT-204 COMPUTER PROGRAMMING 2(INTERMEDIATE PROGRAMMING), year 2, 2nd semester, 2 lecture and 1 laboratory units, prerequisite IT 202.
- **Relationship type:** ILO-CLO. Source: Course learning outcome (CLO). Target: Intended learning outcome (ILO).
- **Source (verbatim):**

> Design, implement and test object-oriented programs that solve given problems.

- **Target (verbatim):**

> Install the integrated development environment.

- **Provisional labels (developer-written, not faculty-reviewed):** Partially aligned or Not aligned · marked ambiguous · category keyword-overlap. Rationale: "A setup task that enables the work but develops none of the CLO's competencies."
- **Faculty forms:** Part A IT204-13; Part B IT204-13-R1, IT204-13-R2, IT204-13-R3.
- **Same CLO in:** IT204-02 (`clo-po-prog-aligned`), IT204-11 (`d-ilo-02`), IT204-12 (`ilo-clo-prog-aligned`).

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Create → Apply | rewrite |
| A2 | 2 | Not aligned | agrees | Create → Apply | rewrite |
| B2 | 1 | Not aligned | agrees | Create → Apply | rewrite |
| B2 | 2 | Not aligned | agrees | Create → Apply | re-map (re-tag) |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Design, implement and test object-oriented programs that solve given problems." · target quote "Install the integrated development environment."
  - Explanation: Installing the IDE is setup. It is not a step toward designing, implementing or testing OO programs. It is Apply or below and is not about the CLO's subject.
  - Draft: "Implement and run a simple object-oriented program in the integrated development environment."
- **A2 run 2.** Source quote "Design, implement and test object-oriented programs" · target quote "Install the integrated development environment."
  - Explanation: Installing the IDE is a setup task, Remember/Apply level at best. It is not a smaller step toward designing, implementing or testing object-oriented programs.
  - Draft: "Create and run a simple object-oriented program in the integrated development environment, and test its classes."
- **B2 run 1.** Source quote "Design, implement and test object-oriented programs that solve given problems." · target quote "Install the integrated development environment."
  - Explanation: The source CLO asks students to design, implement and test object-oriented programs that solve given problems (Create level). The target ILO only states installing the IDE, which is a setup task at Apply or lower. It involves no design, implementation, testing or object-oriented subject matter, so it does not build this CLO. The ILO as a setup step is not a step toward this CLO.
  - Draft: "Implement and run a simple object-oriented program in the integrated development environment."
- **B2 run 2.** Source quote "Design, implement and test object-oriented programs" · target quote "Install the integrated development environment."
  - Explanation: The target ILO, installing the integrated development environment, is a setup task (Apply/Remember level). It does not design, implement or test object-oriented programs and builds no competence the source CLO asks for. It only supports the work indirectly as a tool. The ILO may be sound for its week, but this CLO tag does not fit; retag it to a different outcome or to none.
  - Pre-registered rule flags: re-tag.

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite; run 2 Not aligned, rewrite. B2: run 1 Not aligned, rewrite; run 2 Not aligned, re-map (re-tag). B2 run 2 recommends re-mapping the ILO "to a different outcome or to none"; whether an installation task is an ILO at all is a faculty question.

**Policy questions:** P5, re-mapping (re-tag) recommendations.

### NCM101-01 · `clo-po-nurs-unrelated` (Set 2)

- **Course context:** NCM 101 Fundamentals of Nursing Practice (BSN, year 1); a test record. Description: "Basic nursing concepts, patient safety, vital signs assessment, hygiene care and therapeutic communication, with return demonstration in the skills laboratory." No curriculum or program outcomes for BSN are held (R-NONE).
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Provide safe, quality nursing care to individuals using the nursing process.

- **Target (verbatim):**

> Compute the derivative of polynomial functions.

- **Provisional labels (developer-written, not faculty-reviewed):** Not aligned · category wrong-program. Rationale: "Different discipline entirely."
- **Pre-registered remap candidate; provisional remedy REWRITE OR REMOVE: "A calculus CLO does not belong in NCM 101; no nursing PO fits it, so a re-tag cannot help."**
- **Faculty forms:** Part A NCM101-01; Part B NCM101-01-R1, NCM101-01-R2, NCM101-01-R3, NCM101-01-R4.
- **Also in eval-1.1:** this case is an unchanged copy. A1 (same model, prompt alignment-10) answered run 1 Not aligned, run 2 Not aligned.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Apply → Apply | rewrite |
| A2 | 2 | Not aligned | agrees | Apply → Apply | rewrite |
| B2 | 1 | Not aligned | agrees | Apply → Apply | rewrite |
| B2 | 2 | Not aligned | agrees | Apply → Apply | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Provide safe, quality nursing care to individuals using the nursing process." · target quote "Compute the derivative of polynomial functions."
  - Explanation: The CLO is about calculus, not nursing. It has no nursing action, no safe-care competency and no nursing process, so it fails the subject test and shows no equivalent of the PO's verb.
  - Draft: "Perform basic nursing procedures safely on a simulated patient using the steps of the nursing process."
  - Pre-registered rule flags: duplicates another CLO of the course (0.89); replacement (keeps 0% of the original).
- **A2 run 2.** Source quote "Provide safe, quality nursing care to individuals using the nursing process." · target quote "Compute the derivative of polynomial functions."
  - Explanation: The CLO is about calculus, not nursing. It has no nursing action, no nursing process and no patient care, so it fails the verb and subject tests. Its Bloom level (Apply) is acceptable but irrelevant to the subject.
  - Draft: "Perform basic nursing procedures safely on individuals using the nursing process on a simulated patient."
  - Pre-registered rule flags: duplicates another CLO of the course (0.89); replacement (keeps 0% of the original).
- **B2 run 1.** Source quote "Provide safe, quality nursing care to individuals using the nursing process." · target quote "Compute the derivative of polynomial functions."
  - Explanation: The target CLO is about calculus (computing derivatives of polynomials), which is not nursing. It has no nursing care, safety or nursing process content, so it does not build the source PO. It also does not belong to this nursing course's subject. The CLO itself must change.
  - Draft: "Perform basic nursing procedures safely using the nursing process on a simulated patient."
  - Pre-registered rule flags: duplicates another CLO of the course (1.00); replacement (keeps 0% of the original).
- **B2 run 2.** Source quote "Provide safe, quality nursing care to individuals using the nursing process." · target quote "Compute the derivative of polynomial functions."
  - Explanation: The CLO (target) is about computing derivatives of polynomials, a mathematics skill. It has no nursing care, safety or nursing process content, so it does not develop the PO (source). It also does not belong to this nursing course. The CLO text itself must change.
  - Draft: "Provide safe, quality basic nursing care to a simulated patient using the nursing process."
  - Pre-registered rule flags: replacement (keeps 0% of the original).

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite (duplicates another CLO of the course (0.89); replacement (keeps 0% of the original)); run 2 Not aligned, rewrite (duplicates another CLO of the course (0.89); replacement (keeps 0% of the original)). B2: run 1 Not aligned, rewrite (duplicates another CLO of the course (1.00); replacement (keeps 0% of the original)); run 2 Not aligned, rewrite (replacement (keeps 0% of the original)). A2's two drafts and B2's run-1 draft duplicate an existing nursing CLO of the course (B2 run 1 word for word); B2's run-2 draft restates the PO with a few words changed. Pre-registered remap candidate; provisional remedy REWRITE OR REMOVE: "A calculus CLO does not belong in NCM 101; no nursing PO fits it, so a re-tag cannot help."

**Policy questions:** P5, re-mapping (re-tag) recommendations.

### NCM101-04 · `d-po-06` (Set 2)

- **Course context:** NCM 101 Fundamentals of Nursing Practice (BSN, year 1); a test record. Description: "Basic nursing concepts, patient safety, vital signs assessment, hygiene care and therapeutic communication, with return demonstration in the skills laboratory." No curriculum or program outcomes for BSN are held (R-NONE).
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Communicate therapeutically with clients and collaboratively with the health team.

- **Target (verbatim):**

> Identify the anatomical structures of the heart.

- **Provisional labels (developer-written, not faculty-reviewed):** Not aligned · category clear-negative. Rationale: "Anatomy recall, not communication."
- **Pre-registered remap candidate; provisional remedy EITHER (faculty): "Heart anatomy recall is a plausible but low-level knowledge CLO for nursing fundamentals; the communication PO is the wrong mapping. Re-tag or raise it."**
- **Faculty forms:** Part A NCM101-04; Part B NCM101-04-R1, NCM101-04-R2, NCM101-04-R3, NCM101-04-R4.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Apply → Remember | rewrite |
| A2 | 2 | Not aligned | agrees | Apply → Remember | rewrite |
| B2 | 1 | Not aligned | agrees | Apply → Remember | rewrite |
| B2 | 2 | Not aligned | agrees | Apply → Remember | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Communicate therapeutically with clients and collaboratively with the health team." · target quote "Identify the anatomical structures of the heart."
  - Explanation: The CLO only identifies heart anatomy (Remember). It has no therapeutic communication, no collaboration with the health team, and a lower Bloom level than the PO's Apply-level communication.
  - Draft: "Communicate therapeutically with a simulated client about a cardiac condition and report findings collaboratively to the health team."
  - Pre-registered rule flags: Bloom escalation (Remember → Apply); replacement (keeps 0% of the original).
- **A2 run 2.** Source quote "Communicate therapeutically with clients and collaboratively with the health team." · target quote "Identify the anatomical structures of the heart."
  - Explanation: The CLO only identifies heart structures (Remember). It has no therapeutic communication or collaboration with the health team, so the verb is missing, the Bloom level is lower than Apply, and the subject differs.
  - Draft: "Communicate therapeutically with simulated patients and collaboratively with the health team when explaining basic care procedures in the skills laboratory."
  - Pre-registered rule flags: Bloom escalation (Remember → Apply); replacement (keeps 0% of the original).
- **B2 run 1.** Source quote "Communicate therapeutically with clients and collaboratively with the health team." · target quote "Identify the anatomical structures of the heart."
  - Explanation: The source PO asks to communicate therapeutically and collaboratively. The target CLO only asks to identify heart structures, which is a Remember-level anatomy task. It has no communication verb, a lower Bloom level than the Apply-level communication in the PO, and a different subject (anatomy, not therapeutic communication or teamwork). The CLO itself must change.
  - Draft: "Demonstrate therapeutic communication with a simulated client and collaborative communication with the health team during skills laboratory return demonstrations."
  - Pre-registered rule flags: Bloom escalation (Remember → Apply); replacement (keeps 0% of the original).
- **B2 run 2.** Source quote "Communicate therapeutically with clients and collaboratively with the health team." · target quote "Identify the anatomical structures of the heart."
  - Explanation: The PO (source) asks for therapeutic communication with clients and collaboration with the health team. The CLO (target) only asks to identify heart structures, which is Remember-level anatomy. It has no communication verb and no communication subject, so it does not reach the Apply level the PO asks for. The CLO text must change, and the choice of PO is not the only issue.
  - Draft: "Communicate therapeutically with simulated patients and collaboratively with the health team during basic nursing care in the skills laboratory."
  - Pre-registered rule flags: Bloom escalation (Remember → Apply); replacement (keeps 0% of the original).

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite (Bloom escalation (Remember → Apply); replacement (keeps 0% of the original)); run 2 Not aligned, rewrite (Bloom escalation (Remember → Apply); replacement (keeps 0% of the original)). B2: run 1 Not aligned, rewrite (Bloom escalation (Remember → Apply); replacement (keeps 0% of the original)); run 2 Not aligned, rewrite (Bloom escalation (Remember → Apply); replacement (keeps 0% of the original)). The rewrites replace the anatomy with communication, and B2's drop the cardiac topic. B2 considered re-mapping and rejected it ("the choice of PO is not the only issue"). Pre-registered remap candidate; provisional remedy EITHER (faculty): "Heart anatomy recall is a plausible but low-level knowledge CLO for nursing fundamentals; the communication PO is the wrong mapping. Re-tag or raise it."

**Policy questions:** P4, course fit and year level; P5, re-mapping (re-tag) recommendations.

### NCM101-05 · `d-po-13` (Set 2)

- **Course context:** NCM 101 Fundamentals of Nursing Practice (BSN, year 1); a test record. Description: "Basic nursing concepts, patient safety, vital signs assessment, hygiene care and therapeutic communication, with return demonstration in the skills laboratory." No curriculum or program outcomes for BSN are held (R-NONE).
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Apply the nursing process in providing safe, quality care to individuals, families and communities.

- **Target (verbatim):**

> Describe the steps of the nursing process.

- **Provisional labels (developer-written, not faculty-reviewed):** Partially aligned · category partial. Rationale: "Knowing the steps of the PO's own process is related and necessary, but it does not apply the process in care. The best answer here is PARTIAL; reviewers could argue for a different level."
- **Faculty forms:** Part A NCM101-05; Part B NCM101-05-R1, NCM101-05-R2, NCM101-05-R3.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Partially aligned | agrees | Apply → Understand | rewrite |
| A2 | 2 | Partially aligned | agrees | Apply → Understand | rewrite |
| B2 | 1 | Partially aligned | agrees | Apply → Understand | rewrite |
| B2 | 2 | Partially aligned | agrees | Apply → Understand | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Apply the nursing process in providing safe, quality care to individuals, families and communities." · target quote "Describe the steps of the nursing process."
  - Explanation: The CLO is about the nursing process, which is the PO's subject, but it only describes the steps (Understand), which is below the PO's Apply level. It does not show safe, quality care delivery or care for individuals, families or communities.
  - Draft: "Apply the steps of the nursing process to provide safe, quality care to an individual and his or her family in a simulated case."
  - Pre-registered rule flags: Bloom escalation (Understand → Apply).
- **A2 run 2.** Source quote "Apply the nursing process in providing safe, quality care to individuals, families and communities." · target quote "Describe the steps of the nursing process."
  - Explanation: The CLO is on the right subject (nursing process) but only describes its steps (Understand), which is lower than the PO's Apply. It also gives no care of individuals, families or communities and no safe, quality care.
  - Draft: "Apply the steps of the nursing process in providing safe, quality care to an individual patient and family in a simulated case."
  - Pre-registered rule flags: Bloom escalation (Understand → Apply).
- **B2 run 1.** Source quote "Apply the nursing process in providing safe, quality care" · target quote "Describe the steps of the nursing process."
  - Explanation: The source PO asks to apply the nursing process in providing safe, quality care. The target CLO shares the subject, the nursing process, but its verb 'Describe' is Understand level, below the PO's Apply. It does not state applying it in care, and it names no safe care or patient. The CLO needs rewriting to reach Apply.
  - Draft: "Apply the steps of the nursing process in providing safe care to a simulated patient."
  - Pre-registered rule flags: Bloom escalation (Understand → Apply).
- **B2 run 2.** Source quote "Apply the nursing process in providing safe, quality care" · target quote "Describe the steps of the nursing process."
  - Explanation: The source PO asks the student to apply the nursing process in providing safe, quality care to individuals, families and communities. The target CLO shares the subject, the nursing process, but only asks to describe its steps. Gaps: (1) the verb 'Describe' is Understand, below the PO's Apply; (2) it has no application to patient care; (3) it does not mention safe or quality care; (4) it does not mention individuals, families or communities.
  - Draft: "Apply the steps of the nursing process in providing safe care to a simulated patient."
  - Pre-registered rule flags: Bloom escalation (Understand → Apply).

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Partially aligned, rewrite (Bloom escalation (Understand → Apply)); run 2 Partially aligned, rewrite (Bloom escalation (Understand → Apply)). B2: run 1 Partially aligned, rewrite (Bloom escalation (Understand → Apply)); run 2 Partially aligned, rewrite (Bloom escalation (Understand → Apply)).

**Policy questions:** none of P1–P7 directly; see I11 for limits on recommendations.

### NCM101-06 · `d-po-12` (Set 2)

- **Course context:** NCM 101 Fundamentals of Nursing Practice (BSN, year 1); a test record. Description: "Basic nursing concepts, patient safety, vital signs assessment, hygiene care and therapeutic communication, with return demonstration in the skills laboratory." No curriculum or program outcomes for BSN are held (R-NONE).
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Apply knowledge of computing and mathematics appropriate to the discipline.

- **Target (verbatim):**

> Apply the nursing process to assess a patient's vital signs.

- **Provisional labels (developer-written, not faculty-reviewed):** Not aligned or Partially aligned · category wrong-program. Rationale: "A nursing CLO against a computing program's PO: the wrong program's outcome."
- **Pre-registered remap candidate; provisional remedy RETAG: "A sound nursing CLO in a nursing course, mapped to a computing program's PO. A rewrite toward computing would change the course's subject."**
- **Faculty forms:** Part A NCM101-06; Part B NCM101-06-R1, NCM101-06-R2, NCM101-06-R3.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Partially aligned | agrees | Apply → Apply | rewrite |
| A2 | 2 | Partially aligned | agrees | Apply → Apply | rewrite |
| B2 | 1 | Not aligned | agrees | Apply → Apply | re-map (re-tag) |
| B2 | 2 | Not aligned | agrees | Apply → Apply | re-map (re-tag) |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Apply knowledge of computing and mathematics appropriate to the discipline." · target quote "Apply the nursing process to assess a patient's vital signs."
  - Explanation: The CLO applies the nursing process to vital signs and is at Apply level. However, the PO asks for computing and mathematics knowledge, and the CLO shows no computation, calculation or use of computing tools. It shares only the Apply verb and the nursing context.
  - Draft: "Apply basic mathematics and computing skills to calculate, record and interpret a patient's vital signs, such as pulse rate and respiratory rate, using the nursing process."
- **A2 run 2.** Source quote "Apply knowledge of computing and mathematics appropriate to the discipline." · target quote "Apply the nursing process to assess a patient's vital signs."
  - Explanation: The CLO applies the nursing process to vital signs, which is nursing, but it shows no use of computing or mathematics (e.g., calculating, computing or recording values). It shares only the verb Apply and the assessment topic, so the PO's subject matter is not met.
  - Draft: "Apply basic mathematics and computing skills to measure, calculate, record and interpret a patient's vital signs using the nursing process."
- **B2 run 1.** Source quote "Apply knowledge of computing and mathematics appropriate to the discipline." · target quote "Apply the nursing process to assess a patient's vital signs."
  - Explanation: The source PO asks the student to apply knowledge of computing and mathematics in the discipline. The target CLO applies the nursing process to assess vital signs, a clinical competence. It does not state any computing or mathematics knowledge, so the PO's subject matter is missing. The Apply level matches, but the verb's object does not. The PO tag does not fit this CLO, which is sound for the course.
  - Pre-registered rule flags: re-tag.
- **B2 run 2.** Source quote "Apply knowledge of computing and mathematics" · target quote "Apply the nursing process to assess a patient's vital signs"
  - Explanation: The source PO asks for applying computing and mathematics knowledge. The target CLO applies the nursing process to assess vital signs and states no computing or mathematics competence, so the discipline and object of the action differ; only the verb 'Apply' is shared. The PO tag does not fit this CLO, which is a sound outcome for the course, so the choice of PO is what is wrong.
  - Pre-registered rule flags: re-tag.

**Reason for disagreement.** Both arms gave verdicts the provisional labels accept, but they differ: A2 answered PARTIALLY_ALIGNED with rewrites that bring computing into the nursing CLO; B2 answered NOT_ALIGNED and recommended re-mapping, keeping the CLO. The pre-registered provisional remedy is a re-tag. Neither arm's explanation says the PO comes from another program's list.

**Policy questions:** P5, re-mapping (re-tag) recommendations. **Case question:** When a sound nursing CLO is mapped to a computing PO, should the recommendation change the mapping, the text, or both?

### NCM101-09 · `d-ilo-05` (Set 2)

- **Course context:** NCM 101 Fundamentals of Nursing Practice (BSN, year 1); a test record. Description: "Basic nursing concepts, patient safety, vital signs assessment, hygiene care and therapeutic communication, with return demonstration in the skills laboratory." No curriculum or program outcomes for BSN are held (R-NONE).
- **Relationship type:** ILO-CLO. Source: Course learning outcome (CLO). Target: Intended learning outcome (ILO).
- **Source (verbatim):**

> Perform basic nursing procedures safely using the nursing process on a simulated patient.

- **Target (verbatim):**

> Recite the history of nursing in the Philippines.

- **Provisional labels (developer-written, not faculty-reviewed):** Not aligned or Partially aligned · category clear-negative. Rationale: "History recall, not a procedure."
- **Faculty forms:** Part A NCM101-09; Part B NCM101-09-R1, NCM101-09-R2, NCM101-09-R3.
- **Same CLO in:** NCM101-02 (`clo-po-nurs-aligned`), NCM101-11 (`d-ilo-04`).

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Apply → Remember | rewrite |
| A2 | 2 | Not aligned | agrees | Apply → Remember | rewrite |
| B2 | 1 | Not aligned | agrees | Apply → Remember | rewrite |
| B2 | 2 | Not aligned | agrees | Apply → Remember | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Perform basic nursing procedures safely using the nursing process on a simulated patient." · target quote "Recite the history of nursing in the Philippines."
  - Explanation: Reciting nursing history is a Remember task. It is not a step toward performing procedures safely and does not build toward Apply. It is about history, not the CLO's procedural subject.
  - Draft: "Demonstrate correct hand hygiene before and after contact with a simulated patient as part of a basic nursing procedure."
  - Pre-registered rule flags: replacement (keeps 25% of the original).
- **A2 run 2.** Source quote "Perform basic nursing procedures safely using the nursing process on a simulated patient." · target quote "Recite the history of nursing in the Philippines."
  - Explanation: Reciting nursing history is Remember-level recall and is not a step toward performing procedures safely on a simulated patient. The subject also differs (history vs. skills).
  - Draft: "Demonstrate correct hand hygiene and safe positioning of a simulated patient using the steps of the nursing process."
  - Pre-registered rule flags: replacement (keeps 25% of the original).
- **B2 run 1.** Source quote "Perform basic nursing procedures safely using the nursing process on a simulated patient." · target quote "Recite the history of nursing in the Philippines."
  - Explanation: The source CLO asks the student to perform basic nursing procedures safely using the nursing process on a simulated patient (Apply). The target ILO asks only to recite the history of nursing in the Philippines (Remember). Its subject is nursing history, not procedures or the nursing process. It is not a step toward this CLO, so the CLO tag does not fit. It also has no safe performance and no simulated patient. The ILO needs rewriting so it builds the CLO.
  - Draft: "Demonstrate a basic nursing procedure safely on a simulated patient, following the steps of the nursing process."
  - Pre-registered rule flags: ILO draft restates its CLO (0.50); replacement (keeps 25% of the original).
- **B2 run 2.** Source quote "Perform basic nursing procedures safely using the nursing process" · target quote "Recite the history of nursing in the Philippines."
  - Explanation: The source CLO asks the student to perform basic nursing procedures safely using the nursing process on a simulated patient (Apply). The target ILO asks only to recite the history of nursing in the Philippines (Remember). Gaps: (1) the subject is nursing history, not procedures or the nursing process; (2) the Bloom level is Remember, below the CLO's Apply; (3) it includes no safety or simulated-patient performance. Achieving it would not build this CLO, so the CLO tag does not fit. The ILO is a plausible outcome for a history lesson, but it is not a step toward this CLO, so the ILO text should be rewritten to fit the CLO.
  - Draft: "Demonstrate a basic nursing procedure safely on a simulated patient, following the steps of the nursing process."
  - Pre-registered rule flags: ILO draft restates its CLO (0.50); replacement (keeps 25% of the original).

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite (replacement (keeps 25% of the original)); run 2 Not aligned, rewrite (replacement (keeps 25% of the original)). B2: run 1 Not aligned, rewrite (ILO draft restates its CLO (0.50); replacement (keeps 25% of the original)); run 2 Not aligned, rewrite (ILO draft restates its CLO (0.50); replacement (keeps 25% of the original)). B2's drafts restate the CLO (word overlap 0.50) instead of giving a step toward it.

**Policy questions:** none of P1–P7 directly; see I11 for limits on recommendations.

### NCM101-10 · `d-ilo-15` (Set 2)

- **Course context:** NCM 101 Fundamentals of Nursing Practice (BSN, year 1); a test record. Description: "Basic nursing concepts, patient safety, vital signs assessment, hygiene care and therapeutic communication, with return demonstration in the skills laboratory." No curriculum or program outcomes for BSN are held (R-NONE).
- **Relationship type:** ILO-CLO. Source: Course learning outcome (CLO). Target: Intended learning outcome (ILO).
- **Source (verbatim):**

> Assess vital signs accurately.

- **Target (verbatim):**

> Define the term vital signs.

- **Provisional labels (developer-written, not faculty-reviewed):** Partially aligned · category partial. Rationale: "Defining the term is a low-level, peripheral step toward assessing them accurately."
- **Faculty forms:** Part A NCM101-10; Part B NCM101-10-R1, NCM101-10-R2, NCM101-10-R3, NCM101-10-R4.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Partially aligned | agrees | Apply → Remember | rewrite |
| A2 | 2 | Partially aligned | agrees | Apply → Remember | rewrite |
| B2 | 1 | Partially aligned | agrees | Apply → Remember | rewrite |
| B2 | 2 | Partially aligned | agrees | Apply → Remember | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Assess vital signs accurately." · target quote "Define the term vital signs."
  - Explanation: The ILO is on the same subject (vital signs) but only defines the term (Remember). The CLO requires accurate assessment at Apply level, so the ILO does not build toward the CLO's skill.
  - Draft: "Measure and record temperature, pulse, respiration and blood pressure accurately on a simulated patient."
  - Pre-registered rule flags: replacement (keeps 0% of the original).
- **A2 run 2.** Source quote "Assess vital signs accurately." · target quote "Define the term vital signs."
  - Explanation: Defining vital signs is the same subject and a prerequisite, but it is Remember-level, below the CLO's Assess (Apply). It does not build toward accurate measurement.
  - Draft: "Measure temperature, pulse, respiration and blood pressure correctly on a simulated patient and record the results."
  - Pre-registered rule flags: replacement (keeps 0% of the original).
- **B2 run 1.** Source quote "Assess vital signs accurately." · target quote "Define the term vital signs."
  - Explanation: The source CLO asks to assess vital signs accurately (Apply). The target ILO covers the same subject, vital signs, but only asks to define the term (Remember). It has no assessing action and no accuracy. It is a lower-level step and does not build the CLO's performance. The ILO needs rewriting to include measuring vital signs.
  - Draft: "Define vital signs and measure them accurately on a simulated patient."
- **B2 run 2.** Source quote "Assess vital signs accurately." · target quote "Define the term vital signs."
  - Explanation: The source CLO asks the student to assess vital signs accurately (Apply). The target ILO is on the same subject, vital signs, but only asks to define the term (Remember). Gaps: (1) the verb 'Define' is Remember, below the CLO's level; (2) it has no measurement or assessment performance; (3) it does not mention accuracy. It is a lower-level step toward the CLO, but it does not itself build the assessing skill.
  - Draft: "Measure and record vital signs accurately on a simulated patient."

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Partially aligned, rewrite (replacement (keeps 0% of the original)); run 2 Partially aligned, rewrite (replacement (keeps 0% of the original)). B2: run 1 Partially aligned, rewrite; run 2 Partially aligned, rewrite.

**Policy questions:** P2, ILO steps.

### EDUC105-01 · `d-po-14` (Set 2)

- **Course context:** EDUC 105 Assessment of Student Learning 1 (BSEd, year 3); a test record. Description: "Principles of assessment, the design of classroom tests and performance tasks, and the interpretation and use of assessment results to improve teaching and learning." No curriculum or program outcomes for BSEd are held (R-NONE).
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Demonstrate professional and ethical teaching practice.

- **Target (verbatim):**

> Name the provisions of the code of ethics for professional teachers.

- **Provisional labels (developer-written, not faculty-reviewed):** Partially aligned · category partial. Rationale: "Knowledge of the code supports ethical practice but is not the practice itself."
- **Faculty forms:** Part A EDUC105-01; Part B EDUC105-01-R1, EDUC105-01-R2, EDUC105-01-R3, EDUC105-01-R4.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Partially aligned | agrees | Apply → Remember | rewrite |
| A2 | 2 | Partially aligned | agrees | Apply → Remember | rewrite |
| B2 | 1 | Partially aligned | agrees | Apply → Remember | rewrite |
| B2 | 2 | Partially aligned | agrees | Apply → Remember | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Demonstrate professional and ethical teaching practice." · target quote "Name the provisions of the code of ethics for professional teachers."
  - Explanation: The CLO is on the right subject (the code of ethics for teachers) but only asks to 'name' provisions, which is Remember level. The PO asks to demonstrate professional and ethical teaching practice, which is Apply level or higher. No demonstrating, and no application of the provisions to teaching or assessment situations, is shown.
  - Draft: "Apply the provisions of the code of ethics for professional teachers to demonstrate ethical practice in classroom assessment, such as fair grading and confidentiality of student results."
  - Pre-registered rule flags: Bloom escalation (Remember → Apply).
- **A2 run 2.** Source quote "Demonstrate professional and ethical teaching practice." · target quote "Name the provisions of the code of ethics for professional teachers."
  - Explanation: The CLO shares the subject of the professional code of ethics for teachers. But 'Name' is a Remember-level verb, below the PO's 'Demonstrate' (Apply). It does not show professional and ethical teaching practice in action, such as applying the provisions to classroom assessment situations.
  - Draft: "Apply the provisions of the code of ethics for professional teachers to assessment situations, such as grading fairly and keeping student results confidential, and justify decisions as ethical teaching practice."
  - Pre-registered rule flags: Bloom escalation (Remember → Apply).
- **B2 run 1.** Source quote "Demonstrate professional and ethical teaching practice." · target quote "Name the provisions of the code of ethics for professional teachers."
  - Explanation: The source PO asks students to demonstrate professional and ethical teaching practice (Apply). The target CLO only asks students to name the provisions of the code of ethics (Remember). It has the right subject, the ethics of the teaching profession, but it has two gaps. Its Bloom level is lower than the PO's. It also has no action verb about practice, such as applying the code to teaching or assessment situations. Naming provisions shows knowledge, not demonstrated practice.
  - Draft: "Apply the provisions of the code of ethics for professional teachers to demonstrate ethical practice in classroom assessment situations."
  - Pre-registered rule flags: Bloom escalation (Remember → Apply).
- **B2 run 2.** Source quote "Demonstrate professional and ethical teaching practice." · target quote "Name the provisions of the code of ethics for professional teachers."
  - Explanation: The source PO asks students to demonstrate professional and ethical teaching practice (Apply). The target CLO only asks to name the provisions of the code of ethics (Remember). Gaps: (1) the CLO has no demonstration or practice verb; (2) its Bloom level (Remember) is below the PO's (Apply); (3) it covers knowledge of the code only, not its use in teaching practice. The topic is ethics, so it is related but not enough.
  - Draft: "Apply the provisions of the code of ethics for professional teachers to ethical decisions in classroom assessment practice."
  - Pre-registered rule flags: Bloom escalation (Remember → Apply).

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Partially aligned, rewrite (Bloom escalation (Remember → Apply)); run 2 Partially aligned, rewrite (Bloom escalation (Remember → Apply)). B2: run 1 Partially aligned, rewrite (Bloom escalation (Remember → Apply)); run 2 Partially aligned, rewrite (Bloom escalation (Remember → Apply)).

**Policy questions:** none of P1–P7 directly; see I11 for limits on recommendations.

### EDUC105-03 · `d-po-08` (Set 2)

- **Course context:** EDUC 105 Assessment of Student Learning 1 (BSEd, year 3); a test record. Description: "Principles of assessment, the design of classroom tests and performance tasks, and the interpretation and use of assessment results to improve teaching and learning." No curriculum or program outcomes for BSEd are held (R-NONE).
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Design, implement and evaluate assessments that measure student learning.

- **Target (verbatim):**

> Discuss the history of educational testing.

- **Provisional labels (developer-written, not faculty-reviewed):** Partially aligned or Not aligned · marked ambiguous · category level-gap. Rationale: "Related topic, but it does not design, implement or evaluate an assessment."
- **Pre-registered level-gap note: "Year 3, assessment course: a rewrite into assessment design stays in scope but drops the history topic; either."**
- **Faculty forms:** Part A EDUC105-03; Part B EDUC105-03-R1, EDUC105-03-R2, EDUC105-03-R3, EDUC105-03-R4.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Evaluate → Understand | rewrite |
| A2 | 2 | Not aligned | agrees | Create → Understand | rewrite |
| B2 | 1 | Not aligned | agrees | Create → Understand | rewrite |
| B2 | 2 | Not aligned | agrees | Create → Understand | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Design, implement and evaluate assessments that measure student learning." · target quote "Discuss the history of educational testing."
  - Explanation: Discussing the history of educational testing is Understand level, below the Create/Evaluate level of the PO. It has no designing, implementing or evaluating of assessments, and the subject (history of testing) is not the PO's object of action, assessments that measure student learning.
  - Draft: "Design, administer and evaluate classroom tests and performance tasks that measure student learning, using evidence from the results to judge their validity and to improve teaching."
  - Pre-registered rule flags: Bloom escalation (Understand → Create); replacement (keeps 0% of the original).
- **A2 run 2.** Source quote "Design, implement and evaluate assessments that measure student learning." · target quote "Discuss the history of educational testing."
  - Explanation: The CLO 'Discuss' is an Understand-level verb about the history of testing. The PO asks for design, implementation and evaluation (Create/Evaluate) of assessments that measure student learning. The CLO has no design, implement or evaluate action, and its subject (history) is not the PO's subject of assessments that measure learning.
  - Draft: "Design and administer a classroom assessment aligned with learning objectives, and evaluate how well it measures student learning using item analysis and score interpretation."
  - Pre-registered rule flags: Bloom escalation (Understand → Create); replacement (keeps 0% of the original).
- **B2 run 1.** Source quote "Design, implement and evaluate assessments that measure student learning." · target quote "Discuss the history of educational testing."
  - Explanation: The CLO (target) asks students to discuss the history of educational testing, which is Understand level and a historical topic. The PO (source) asks for designing, implementing and evaluating assessments that measure student learning, which is Create/Evaluate level. The CLO has none of these verbs and builds no assessment skill, so it falls below the PO's Bloom level and the subject differs. It only shares the topic of testing.
  - Draft: "Design, administer and evaluate classroom assessments that measure student learning, drawing on the principles of educational testing."
  - Pre-registered rule flags: Bloom escalation (Understand → Create).
- **B2 run 2.** Source quote "Design, implement and evaluate assessments that measure student learning." · target quote "Discuss the history of educational testing."
  - Explanation: The CLO (target) asks students to discuss the history of educational testing, which is Understand level recall of background knowledge. The PO (source) asks for design, implementation and evaluation of assessments, which is Create/Evaluate level. The CLO has none of these verbs and builds no competence in designing, implementing or evaluating assessments. It shares only the topic area of testing, so the CLO needs rewriting toward the PO's competence.
  - Draft: "Design and evaluate classroom assessments that measure student learning, drawing on lessons from the history of educational testing."
  - Pre-registered rule flags: Bloom escalation (Understand → Create).

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite (Bloom escalation (Understand → Create); replacement (keeps 0% of the original)); run 2 Not aligned, rewrite (Bloom escalation (Understand → Create); replacement (keeps 0% of the original)). B2: run 1 Not aligned, rewrite (Bloom escalation (Understand → Create)); run 2 Not aligned, rewrite (Bloom escalation (Understand → Create)). B2's rewrites turn the history CLO into assessment design and drop the history topic. Pre-registered level-gap note: "Year 3, assessment course: a rewrite into assessment design stays in scope but drops the history topic; either."

**Policy questions:** P4, course fit and year level.

### ACCTG201-01 · `d-po-10` (Set 2)

- **Course context:** ACCTG 201 Intermediate Accounting 1 (BSA, year 2); a test record. Description: "Recognition, measurement and presentation of cash, receivables, inventories and property, plant and equipment under the Philippine Financial Reporting Standards." No curriculum or program outcomes for BSA are held (R-NONE).
- **Relationship type:** CLO-PO. Source: Program outcome (PO). Target: Course learning outcome (CLO).
- **Source (verbatim):**

> Apply accounting principles and standards to record, measure and report financial transactions.

- **Target (verbatim):**

> Define accounting.

- **Provisional labels (developer-written, not faculty-reviewed):** Partially aligned or Not aligned · category level-gap. Rationale: "Recall of a definition, far below applying standards."
- **Pre-registered level-gap note: "Year 2, intermediate accounting: "Define accounting." is too basic; raising it to applying standards is appropriate."**
- **Faculty forms:** Part A ACCTG201-01; Part B ACCTG201-01-R1, ACCTG201-01-R2, ACCTG201-01-R3, ACCTG201-01-R4.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Apply → Remember | rewrite |
| A2 | 2 | Not aligned | agrees | Apply → Remember | rewrite |
| B2 | 1 | Not aligned | agrees | Apply → Remember | rewrite |
| B2 | 2 | Not aligned | agrees | Apply → Remember | rewrite |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Apply accounting principles and standards" · target quote "Define accounting."
  - Explanation: 'Define accounting' is Remember level, below the PO's Apply level. It has no recording, measuring or reporting action. It names no transactions, standards, receivables or inventories, so the subject is only the general topic word 'accounting'.
  - Draft: "Apply accounting principles and standards to record, measure and report cash, receivables, inventories and property, plant and equipment transactions."
  - Pre-registered rule flags: Bloom escalation (Remember → Apply).
- **A2 run 2.** Source quote "Apply accounting principles and standards to record, measure and report financial transactions" · target quote "Define accounting."
  - Explanation: 'Define accounting' is Remember level, while the PO asks for Apply. It has no record, measure or report action, and its subject is the general concept of accounting rather than applying standards to financial transactions. It is also not tied to the course content (cash, receivables, inventories, PPE).
  - Draft: "Apply Philippine Financial Reporting Standards to record, measure and report cash, receivables, inventories and property, plant and equipment transactions."
  - Pre-registered rule flags: Bloom escalation (Remember → Apply); replacement (keeps 0% of the original).
- **B2 run 1.** Source quote "Apply accounting principles and standards" · target quote "Define accounting."
  - Explanation: The CLO 'Define accounting' is a Remember-level verb, below the Apply level the PO asks for. It lacks the PO's actions (record, measure, report) and states no application of standards to financial transactions. It names only the discipline and does not develop the competence. It is also too generic for a second-year intermediate course covering cash, receivables, inventories and PPE.
  - Draft: "Apply accounting principles and Philippine Financial Reporting Standards to record, measure and report cash, receivables, inventories and property, plant and equipment."
  - Pre-registered rule flags: Bloom escalation (Remember → Apply).
- **B2 run 2.** Source quote "Apply accounting principles and standards" · target quote "Define accounting."
  - Explanation: The CLO statement 'Define accounting.' is a Remember-level outcome, lower than the PO's Apply level. It has none of the PO's verbs (record, measure, report) and states no standards or transactions. It is also too generic for a second-year intermediate course on cash, receivables, inventories and PPE.
  - Draft: "Record, measure and report cash, receivables, inventories and property, plant and equipment in accordance with the Philippine Financial Reporting Standards."
  - Pre-registered rule flags: Bloom escalation (Remember → Apply); replacement (keeps 0% of the original).

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite (Bloom escalation (Remember → Apply)); run 2 Not aligned, rewrite (Bloom escalation (Remember → Apply); replacement (keeps 0% of the original)). B2: run 1 Not aligned, rewrite (Bloom escalation (Remember → Apply)); run 2 Not aligned, rewrite (Bloom escalation (Remember → Apply); replacement (keeps 0% of the original)). Both B2 drafts name the Philippine Financial Reporting Standards, which the course description names. Pre-registered level-gap note: "Year 2, intermediate accounting: "Define accounting." is too basic; raising it to applying standards is appropriate."

**Policy questions:** none of P1–P7 directly; see I11 for limits on recommendations.

### ACCTG201-04 · `d-ilo-09` (Set 2)

- **Course context:** ACCTG 201 Intermediate Accounting 1 (BSA, year 2); a test record. Description: "Recognition, measurement and presentation of cash, receivables, inventories and property, plant and equipment under the Philippine Financial Reporting Standards." No curriculum or program outcomes for BSA are held (R-NONE).
- **Relationship type:** ILO-CLO. Source: Course learning outcome (CLO). Target: Intended learning outcome (ILO).
- **Source (verbatim):**

> Record and report receivables in accordance with the applicable financial reporting standards.

- **Target (verbatim):**

> Explain the history of the accounting profession.

- **Provisional labels (developer-written, not faculty-reviewed):** Not aligned or Partially aligned · category clear-negative. Rationale: "History does not contribute to recording receivables."
- **Faculty forms:** Part A ACCTG201-04; Part B ACCTG201-04-R1, ACCTG201-04-R2, ACCTG201-04-R3, ACCTG201-04-R4.

| Arm | Run | Verdict | Against the provisional labels | Bloom (source → target) | Remedy |
|---|---|---|---|---|---|
| A2 | 1 | Not aligned | agrees | Apply → Understand | rewrite |
| A2 | 2 | Not aligned | agrees | Apply → Understand | rewrite |
| B2 | 1 | Not aligned | agrees | Apply → Understand | rewrite |
| B2 | 2 | Not aligned | agrees | Apply → Understand | re-map (re-tag) |

**Evidence cited by each answer**

- **A2 run 1.** Source quote "Record and report receivables in accordance with the applicable financial reporting standards." · target quote "Explain the history of the accounting profession."
  - Explanation: The ILO asks for the history of the accounting profession, which is different subject matter from recording and reporting receivables under reporting standards. Its level is Understand, below the CLO's Apply level. It builds toward no part of the CLO.
  - Draft: "Record receivables, including uncollectible accounts, in accordance with the applicable Philippine Financial Reporting Standards."
  - Pre-registered rule flags: ILO draft restates its CLO (0.60); replacement (keeps 25% of the original).
- **A2 run 2.** Source quote "Record and report receivables in accordance with the applicable financial reporting standards." · target quote "Explain the history of the accounting profession."
  - Explanation: The history of the accounting profession is a different subject from recording and reporting receivables under the standards. It is Understand level (explain), below the CLO's Apply level, so it does not build toward the CLO, and it is not a step of receivables recording or reporting.
  - Draft: "Record trade receivables and the allowance for expected credit losses, and report them in the statement of financial position in accordance with the applicable financial reporting standards."
  - Pre-registered rule flags: ILO draft restates its CLO (0.55); replacement (keeps 0% of the original).
- **B2 run 1.** Source quote "Record and report receivables" · target quote "Explain the history of the accounting profession."
  - Explanation: The ILO asks the student to explain the history of the accounting profession, which is Understand-level and a different subject from recording and reporting receivables under reporting standards. The ILO does not build the CLO's competence (record, report, apply standards to receivables). The CLO is sound for the course, but this ILO is not a step toward it.
  - Draft: "Record receivables and report them in accordance with the applicable financial reporting standards."
  - Pre-registered rule flags: ILO draft restates its CLO (0.92); replacement (keeps 0% of the original).
- **B2 run 2.** Source quote "Record and report receivables" · target quote "Explain the history of the accounting profession."
  - Explanation: The ILO 'Explain the history of the accounting profession' is a Understand-level outcome about the history of the profession. The CLO asks for recording and reporting of receivables under the reporting standards (Apply). The ILO builds no recording or reporting skill, and is not about receivables. The CLO tag does not fit this ILO, though the ILO may be sound for another week or CLO.
  - Pre-registered rule flags: re-tag.

**Reason for disagreement.** Both arms' verdicts are within the provisional labels. A2: run 1 Not aligned, rewrite (ILO draft restates its CLO (0.60); replacement (keeps 25% of the original)); run 2 Not aligned, rewrite (ILO draft restates its CLO (0.55); replacement (keeps 0% of the original)). B2: run 1 Not aligned, rewrite (ILO draft restates its CLO (0.92); replacement (keeps 0% of the original)); run 2 Not aligned, re-map (re-tag). B2 run 2 says the ILO "may be sound for another week or CLO", though the course description has no history topic; B2's run-1 draft restates the CLO (word overlap 0.92), as A2's drafts do (0.60 and 0.55).

**Policy questions:** P5, re-mapping (re-tag) recommendations.

## Section 3. Cases without disagreement (Set 3, 14 cases)
In every Set 3 case, all four answers are within the provisional labels, give the same verdict, and carry no flagged recommendation. These cases still need faculty review (Part A), because the provisional labels are unreviewed. 5 of them have proposed changes. Those are in Part B with the rest, and their texts are also in `cases.json`.

| Code | Case id | Type | Provisional labels | All four answers | Remedies | Part B proposals |
|---|---|---|---|---|---|---|
| MA7-04 | `clo-po-calc-aligned` | CLO-PO | A | Aligned | no change | – |
| MA7-12 | `d-ega-01` | CLO-EGA | A | Aligned | no change | – |
| MA7-16 | `ilo-clo-calc-aligned` | ILO-CLO | A | Aligned | no change | – |
| MA7-17 | `d-ilo-14` | ILO-CLO | P | Partially aligned | rewrite | MA7-17-R1, MA7-17-R2, MA7-17-R3, MA7-17-R4 |
| IE310-01 | `d-ilo-13` | ILO-CLO | A | Aligned | no change | – |
| IT204-02 | `clo-po-prog-aligned` | CLO-PO | A | Aligned | no change | – |
| IT204-04 | `clo-po-prog-two-skills` | CLO-PO | P or N | Partially aligned | rewrite | IT204-04-R1, IT204-04-R2, IT204-04-R3, IT204-04-R4 |
| IT204-07 | `clo-ega-aligned` | CLO-EGA | A or P | Aligned | no change | – |
| NCM101-02 | `clo-po-nurs-aligned` | CLO-PO | A | Aligned | no change | – |
| EDUC105-04 | `d-ega-05` | CLO-EGA | A | Aligned | no change | – |
| EDUC105-05 | `d-ilo-07` | ILO-CLO | A or P | Partially aligned | rewrite | EDUC105-05-R1, EDUC105-05-R2, EDUC105-05-R3, EDUC105-05-R4 |
| ACCTG201-03 | `d-ilo-08` | ILO-CLO | A or P | Partially aligned | rewrite | ACCTG201-03-R1, ACCTG201-03-R2, ACCTG201-03-R3, ACCTG201-03-R4 |
| HM210-01 | `d-po-11` | CLO-PO | A | Aligned | no change | – |
| HM210-02 | `d-ilo-11` | ILO-CLO | N | Not aligned | rewrite | HM210-02-R1, HM210-02-R2, HM210-02-R3, HM210-02-R4 |

## Linked cases
- **The same CLO in several cases.** These are different relationships, not duplicates, but a reviewer should judge the shared CLO consistently:
  - MA7-04 (`clo-po-calc-aligned`), MA7-15 (`d-ilo-01`), MA7-16 (`ilo-clo-calc-aligned`), MA7-17 (`d-ilo-14`), MA7-19 (`ilo-clo-unrelated`)
  - IT204-02 (`clo-po-prog-aligned`), IT204-11 (`d-ilo-02`), IT204-12 (`ilo-clo-prog-aligned`), IT204-13 (`d-ilo-03`)
  - NCM101-02 (`clo-po-nurs-aligned`), NCM101-09 (`d-ilo-05`), NCM101-11 (`d-ilo-04`)
  - IT204-07 (`clo-ega-aligned`), IT204-10 (`d-any-ega-01`)
  - MA7-13 (`d-ega-02`), MA7-14 (`d-any-ega-02`)
  - EDUC105-05 (`d-ilo-07`), EDUC105-06 (`d-ilo-06`)
- **Copies of eval-1.1 cases.** 16 cases are unchanged copies of cases in the eval-1.1 dataset (`server/lib/syllabuscheck/eval/dataset.json`): IT204-02, IT204-04, IT204-05, IT204-06, IT204-07, IT204-09, IT204-12, MA7-01, MA7-02, MA7-04, MA7-06, MA7-16, MA7-18, MA7-19, NCM101-01, NCM101-02. One faculty decision should apply to both copies (procedure, section 7).
