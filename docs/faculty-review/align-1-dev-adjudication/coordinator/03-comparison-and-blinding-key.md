# Comparison document and blinding key (restricted)

**Restricted to the review coordinator.** This is the only document that links the blinded forms to the evaluations. Keep it, and the rest of the coordinator folder, away from case reviewers until they have returned Parts A and B.

## 1. Evaluations compared
| Arm | Model (as recorded; Anthropic's direct API) | Prompt | Mode | Dataset | Runs | Ran (UTC) | Saved record |
|---|---|---|---|---|---|---|---|
| A2 | `anthropic/claude-sonnet-5-5` | `alignment-10` | A (legacy academic alignment benchmark) | align-1, development split (58) | 2 | 2026-10-27T19:11:27.945Z | `docs/ai-eval-anthropic/p2-a2-cases.json` (sha256 `73c27948f75cb1b7`) |
| B2 | `anthropic/claude-sonnet-5-5` | `alignment-12a3-r7` | B (enhanced staged semantic evaluation; stages a, b3) | align-1, development split (58) | 2 | 2026-10-27T19:58:25.397Z | `docs/ai-eval-anthropic/p2-b2-cases.json` (sha256 `ef984e44cd49667a`) |
| A1 | `anthropic/claude-sonnet-5-5` | `alignment-10` | A (legacy) | eval-1.1 (41 cases; 16 copied into align-1) | 2 | 2026-10-27T18:50:34.142Z | `docs/ai-eval-anthropic/p2-a1-result.json` (sha256 `ba3866e00e330cd7`) |

- **Model, settings and cases are the same.** A2 and B2 used the same model and settings on the same 58 cases; they differ in prompt and recommendation contract. Their differences belong to the prompts, not to the model.
- **Every verdict is compared with provisional, developer-written labels**, which are not faculty-validated.

## 2. Case key
| Code | Dataset id | Set | Type | Category | Ambiguous | Provisional labels | Copy of an eval-1.1 case |
|---|---|---|---|---|---|---|---|
| MA7-01 | `clo-po-calc-lower-level` | 2 | CLO-PO | level-gap |  | Partially aligned or Not aligned | yes |
| MA7-02 | `clo-po-calc-unrelated` | 2 | CLO-PO | clear-negative |  | Not aligned or Partially aligned | yes |
| MA7-03 | `d-po-02` | 2 | CLO-PO | level-gap |  | Not aligned or Partially aligned |  |
| MA7-04 | `clo-po-calc-aligned` | 3 | CLO-PO | clear-positive |  | Aligned | yes |
| MA7-05 | `d-po-01` | 1 | CLO-PO | different-wording |  | Aligned |  |
| MA7-06 | `clo-po-calc-vague` | 2 | CLO-PO | level-gap |  | Partially aligned or Not aligned | yes |
| MA7-07 | `d-any-po-01` | 1 | CLO-anyPO | whole-list |  | Aligned |  |
| MA7-08 | `d-any-po-03` | 1 | CLO-anyPO | whole-list |  | Aligned |  |
| MA7-09 | `d-any-po-02` | 2 | CLO-anyPO | whole-list |  | Not aligned or Partially aligned |  |
| MA7-10 | `d-ega-04` | 2 | CLO-EGA | clear-negative |  | Not aligned or Partially aligned |  |
| MA7-11 | `d-ega-06` | 2 | CLO-EGA | clear-negative |  | Not aligned or Partially aligned |  |
| MA7-12 | `d-ega-01` | 3 | CLO-EGA | name-only-ega |  | Aligned |  |
| MA7-13 | `d-ega-02` | 2 | CLO-EGA | clear-negative |  | Not aligned or Partially aligned |  |
| MA7-14 | `d-any-ega-02` | 2 | CLO-anyEGA | whole-list |  | Not aligned or Partially aligned |  |
| MA7-15 | `d-ilo-01` | 1 | ILO-CLO | different-wording |  | Aligned |  |
| MA7-16 | `ilo-clo-calc-aligned` | 3 | ILO-CLO | different-wording |  | Aligned | yes |
| MA7-17 | `d-ilo-14` | 3 | ILO-CLO | partial |  | Partially aligned |  |
| MA7-18 | `ilo-clo-claims-more` | 2 | ILO-CLO | level-gap |  | Partially aligned or Not aligned | yes |
| MA7-19 | `ilo-clo-unrelated` | 2 | ILO-CLO | clear-negative |  | Not aligned | yes |
| MA7-20 | `d-ilo-12` | 2 | ILO-CLO | level-gap |  | Partially aligned or Not aligned |  |
| IE310-01 | `d-ilo-13` | 3 | ILO-CLO | interdisciplinary |  | Aligned |  |
| IT204-01 | `d-po-03` | 1 | CLO-PO | different-wording |  | Aligned |  |
| IT204-02 | `clo-po-prog-aligned` | 3 | CLO-PO | clear-positive |  | Aligned | yes |
| IT204-03 | `d-po-04` | 2 | CLO-PO | keyword-overlap |  | Not aligned or Partially aligned |  |
| IT204-04 | `clo-po-prog-two-skills` | 3 | CLO-PO | specific-clo-broad-po | yes | Partially aligned or Not aligned | yes |
| IT204-05 | `clo-po-prog-interdisciplinary` | 1 | CLO-PO | interdisciplinary |  | Aligned | yes |
| IT204-06 | `clo-po-prog-lower-level` | 2 | CLO-PO | level-gap |  | Partially aligned or Not aligned | yes |
| IT204-07 | `clo-ega-aligned` | 3 | CLO-EGA | name-only-ega | yes | Aligned or Partially aligned | yes |
| IT204-08 | `d-ega-08` | 1 | CLO-EGA | name-only-ega | yes | Aligned or Partially aligned |  |
| IT204-09 | `clo-ega-unrelated` | 2 | CLO-EGA | clear-negative |  | Not aligned or Partially aligned | yes |
| IT204-10 | `d-any-ega-01` | 1 | CLO-anyEGA | whole-list |  | Aligned |  |
| IT204-11 | `d-ilo-02` | 1 | ILO-CLO | different-wording |  | Aligned |  |
| IT204-12 | `ilo-clo-prog-aligned` | 1 | ILO-CLO | clear-positive |  | Aligned | yes |
| IT204-13 | `d-ilo-03` | 2 | ILO-CLO | keyword-overlap | yes | Partially aligned or Not aligned |  |
| NCM101-01 | `clo-po-nurs-unrelated` | 2 | CLO-PO | wrong-program |  | Not aligned | yes |
| NCM101-02 | `clo-po-nurs-aligned` | 3 | CLO-PO | clear-positive |  | Aligned | yes |
| NCM101-03 | `d-po-05` | 1 | CLO-PO | specific-clo-broad-po |  | Aligned |  |
| NCM101-04 | `d-po-06` | 2 | CLO-PO | clear-negative |  | Not aligned |  |
| NCM101-05 | `d-po-13` | 2 | CLO-PO | partial |  | Partially aligned |  |
| NCM101-06 | `d-po-12` | 2 | CLO-PO | wrong-program |  | Not aligned or Partially aligned |  |
| NCM101-07 | `d-ega-03` | 1 | CLO-EGA | name-only-ega |  | Aligned |  |
| NCM101-08 | `d-ega-07` | 1 | CLO-EGA | name-only-ega |  | Aligned |  |
| NCM101-09 | `d-ilo-05` | 2 | ILO-CLO | clear-negative |  | Not aligned or Partially aligned |  |
| NCM101-10 | `d-ilo-15` | 2 | ILO-CLO | partial |  | Partially aligned |  |
| NCM101-11 | `d-ilo-04` | 1 | ILO-CLO | clear-positive |  | Aligned |  |
| EDUC105-01 | `d-po-14` | 2 | CLO-PO | partial |  | Partially aligned |  |
| EDUC105-02 | `d-po-07` | 1 | CLO-PO | different-wording |  | Aligned |  |
| EDUC105-03 | `d-po-08` | 2 | CLO-PO | level-gap | yes | Partially aligned or Not aligned |  |
| EDUC105-04 | `d-ega-05` | 3 | CLO-EGA | name-only-ega |  | Aligned |  |
| EDUC105-05 | `d-ilo-07` | 3 | ILO-CLO | broad-clo-narrow-ilo | yes | Aligned or Partially aligned |  |
| EDUC105-06 | `d-ilo-06` | 1 | ILO-CLO | different-wording |  | Aligned |  |
| ACCTG201-01 | `d-po-10` | 2 | CLO-PO | level-gap |  | Partially aligned or Not aligned |  |
| ACCTG201-02 | `d-po-09` | 1 | CLO-PO | clear-positive |  | Aligned |  |
| ACCTG201-03 | `d-ilo-08` | 3 | ILO-CLO | broad-clo-narrow-ilo | yes | Aligned or Partially aligned |  |
| ACCTG201-04 | `d-ilo-09` | 2 | ILO-CLO | clear-negative |  | Not aligned or Partially aligned |  |
| HM210-01 | `d-po-11` | 3 | CLO-PO | clear-positive |  | Aligned |  |
| HM210-02 | `d-ilo-11` | 3 | ILO-CLO | contradictory |  | Not aligned |  |
| HM210-03 | `d-ilo-10` | 1 | ILO-CLO | clear-positive |  | Aligned |  |

## 3. Part B proposal key
| Proposal | Kind | Proposed by (arm, run, that answer's verdict) | Pre-registered rule flags |
|---|---|---|---|
| MA7-01-R1 | re-mapping | B2 run 2 (Not aligned) | – |
| MA7-01-R2 | rewrite | A2 run 2 (Not aligned) | Bloom escalation (Remember → Create) |
| MA7-01-R3 | rewrite | B2 run 1 (Not aligned) | Bloom escalation (Remember → Create) |
| MA7-01-R4 | rewrite | A2 run 1 (Not aligned) | Bloom escalation (Remember → Create) |
| MA7-02-R1 | rewrite | A2 run 1 (Not aligned) | – |
| MA7-02-R2 | re-mapping | B2 run 1 (Not aligned); B2 run 2 (Not aligned) | – |
| MA7-02-R3 | rewrite | A2 run 2 (Not aligned) | – |
| MA7-03-R1 | rewrite | A2 run 2 (Not aligned) | Bloom escalation (Apply → Create); replacement (keeps 20% of the original) |
| MA7-03-R2 | rewrite | A2 run 1 (Not aligned) | Bloom escalation (Apply → Create) |
| MA7-03-R3 | re-mapping | B2 run 1 (Not aligned); B2 run 2 (Not aligned) | – |
| MA7-05-R1 | rewrite | A2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome |
| MA7-05-R2 | rewrite | B2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome |
| MA7-05-R3 | rewrite | A2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome |
| MA7-05-R4 | rewrite | B2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome |
| MA7-06-R1 | rewrite | A2 run 1 (Partially aligned) | Bloom escalation (Understand → Apply); replacement (keeps 0% of the original) |
| MA7-06-R2 | rewrite | A2 run 2 (Partially aligned) | Bloom escalation (Understand → Apply); replacement (keeps 0% of the original) |
| MA7-06-R3 | rewrite | B2 run 1 (Partially aligned); B2 run 2 (Partially aligned) | Bloom escalation (Understand → Apply); replacement (keeps 0% of the original) |
| MA7-07-R1 | rewrite | B2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome |
| MA7-07-R2 | rewrite | A2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome; replacement (keeps 17% of the original) |
| MA7-07-R3 | rewrite | B2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome |
| MA7-08-R1 | rewrite | B2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome |
| MA7-08-R2 | rewrite | A2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome |
| MA7-09-R1 | rewrite | B2 run 1 (Not aligned) | Bloom escalation (Understand → Apply); replacement (keeps 0% of the original) |
| MA7-09-R2 | rewrite | A2 run 2 (Not aligned) | Bloom escalation (Understand → Apply); replacement (keeps 0% of the original) |
| MA7-09-R3 | rewrite | B2 run 2 (Not aligned) | Bloom escalation (Understand → Apply); replacement (keeps 0% of the original) |
| MA7-09-R4 | rewrite | A2 run 1 (Not aligned) | Bloom escalation (Understand → Apply); replacement (keeps 0% of the original) |
| MA7-10-R1 | rewrite | A2 run 1 (Not aligned) | – |
| MA7-10-R2 | rewrite | A2 run 2 (Not aligned) | – |
| MA7-10-R3 | re-mapping | B2 run 1 (Not aligned); B2 run 2 (Not aligned) | – |
| MA7-11-R1 | re-mapping | B2 run 1 (Not aligned) | – |
| MA7-11-R2 | rewrite | B2 run 2 (Not aligned) | Bloom escalation (Apply → Evaluate) |
| MA7-11-R3 | rewrite | A2 run 1 (Not aligned) | replacement (keeps 0% of the original) |
| MA7-11-R4 | rewrite | A2 run 2 (Not aligned) | Bloom escalation (Apply → Evaluate) |
| MA7-13-R1 | rewrite | B2 run 2 (Not aligned) | replacement (keeps 0% of the original) |
| MA7-13-R2 | rewrite | A2 run 2 (Not aligned) | Bloom escalation (Remember → Create); replacement (keeps 0% of the original) |
| MA7-13-R3 | rewrite | A2 run 1 (Not aligned) | Bloom escalation (Remember → Evaluate); replacement (keeps 0% of the original) |
| MA7-13-R4 | rewrite | B2 run 1 (Not aligned) | Bloom escalation (Remember → Evaluate); replacement (keeps 0% of the original) |
| MA7-14-R1 | rewrite | A2 run 2 (Not aligned) | Bloom escalation (Remember → Analyze); replacement (keeps 0% of the original) |
| MA7-14-R2 | rewrite | B2 run 1 (Not aligned) | Bloom escalation (Remember → Analyze); replacement (keeps 0% of the original) |
| MA7-14-R3 | rewrite | B2 run 2 (Not aligned) | Bloom escalation (Remember → Analyze); replacement (keeps 0% of the original) |
| MA7-14-R4 | rewrite | A2 run 1 (Not aligned) | Bloom escalation (Remember → Create); replacement (keeps 0% of the original) |
| MA7-15-R1 | rewrite | A2 run 2 (Not aligned) | rewrite of a provisionally aligned outcome |
| MA7-15-R2 | rewrite | B2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome; ILO draft restates its CLO (0.54) |
| MA7-15-R3 | rewrite | A2 run 1 (Not aligned) | rewrite of a provisionally aligned outcome |
| MA7-15-R4 | rewrite | B2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome; ILO draft restates its CLO (0.58) |
| MA7-17-R1 | rewrite | B2 run 2 (Partially aligned) | – |
| MA7-17-R2 | rewrite | B2 run 1 (Partially aligned) | – |
| MA7-17-R3 | rewrite | A2 run 2 (Partially aligned) | – |
| MA7-17-R4 | rewrite | A2 run 1 (Partially aligned) | – |
| MA7-18-R1 | rewrite | A2 run 1 (Partially aligned) | replacement (keeps 20% of the original) |
| MA7-18-R2 | rewrite | A2 run 2 (Partially aligned) | replacement (keeps 20% of the original) |
| MA7-18-R3 | rewrite | B2 run 1 (Partially aligned) | replacement (keeps 20% of the original) |
| MA7-18-R4 | rewrite | B2 run 2 (Partially aligned) | replacement (keeps 20% of the original) |
| MA7-19-R1 | rewrite | A2 run 1 (Not aligned) | replacement (keeps 0% of the original) |
| MA7-19-R2 | rewrite | B2 run 2 (Not aligned) | replacement (keeps 0% of the original) |
| MA7-19-R3 | rewrite | B2 run 1 (Not aligned) | replacement (keeps 0% of the original) |
| MA7-19-R4 | rewrite | A2 run 2 (Not aligned) | replacement (keeps 0% of the original) |
| MA7-20-R1 | rewrite | A2 run 1 (Not aligned) | – |
| MA7-20-R2 | rewrite | B2 run 2 (Not aligned) | – |
| MA7-20-R3 | rewrite | A2 run 2 (Not aligned) | – |
| MA7-20-R4 | rewrite | B2 run 1 (Not aligned) | – |
| IT204-01-R1 | rewrite | B2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome |
| IT204-01-R2 | rewrite | A2 run 1 (Partially aligned); A2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome; Bloom escalation (Apply → Create) |
| IT204-01-R3 | rewrite | B2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome; Bloom escalation (Apply → Create) |
| IT204-03-R1 | rewrite | A2 run 1 (Not aligned) | Bloom escalation (Apply → Analyze) |
| IT204-03-R2 | rewrite | A2 run 2 (Not aligned) | Bloom escalation (Apply → Analyze) |
| IT204-03-R3 | re-mapping | B2 run 1 (Not aligned); B2 run 2 (Not aligned) | – |
| IT204-04-R1 | rewrite | A2 run 2 (Partially aligned) | – |
| IT204-04-R2 | rewrite | B2 run 1 (Partially aligned) | – |
| IT204-04-R3 | rewrite | A2 run 1 (Partially aligned) | – |
| IT204-04-R4 | rewrite | B2 run 2 (Partially aligned) | – |
| IT204-05-R1 | rewrite | B2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome |
| IT204-05-R2 | rewrite | B2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome |
| IT204-05-R3 | rewrite | A2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome |
| IT204-06-R1 | rewrite | A2 run 2 (Not aligned) | Bloom escalation (Remember → Create) |
| IT204-06-R2 | rewrite | B2 run 2 (Not aligned) | Bloom escalation (Remember → Create) |
| IT204-06-R3 | rewrite | A2 run 1 (Not aligned) | Bloom escalation (Remember → Create) |
| IT204-06-R4 | rewrite | B2 run 1 (Not aligned) | Bloom escalation (Remember → Create) |
| IT204-08-R1 | rewrite | A2 run 2 (Not aligned) | value wording (augustinian, marian, integrity, service to others) |
| IT204-08-R2 | rewrite | A2 run 1 (Not aligned) | value wording (Humility, integrity) |
| IT204-08-R3 | re-mapping | B2 run 1 (Not aligned); B2 run 2 (Not aligned) | – |
| IT204-09-R1 | rewrite | A2 run 2 (Not aligned) | Bloom escalation (Remember → Create); replacement (keeps 0% of the original) |
| IT204-09-R2 | rewrite | B2 run 2 (Not aligned) | Bloom escalation (Remember → Create); replacement (keeps 0% of the original) |
| IT204-09-R3 | rewrite | B2 run 1 (Not aligned) | Bloom escalation (Remember → Create); replacement (keeps 0% of the original) |
| IT204-09-R4 | rewrite | A2 run 1 (Not aligned) | Bloom escalation (Remember → Create); replacement (keeps 0% of the original) |
| IT204-10-R1 | rewrite | B2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome; Bloom escalation (Evaluate → Create) |
| IT204-11-R1 | rewrite | B2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome |
| IT204-12-R1 | rewrite | B2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome |
| IT204-13-R1 | re-mapping | B2 run 2 (Not aligned) | – |
| IT204-13-R2 | rewrite | A2 run 2 (Not aligned) | – |
| IT204-13-R3 | rewrite | A2 run 1 (Not aligned); B2 run 1 (Not aligned) | – |
| NCM101-01-R1 | rewrite | A2 run 2 (Not aligned) | duplicates another CLO of the course (0.89); replacement (keeps 0% of the original) |
| NCM101-01-R2 | rewrite | A2 run 1 (Not aligned) | duplicates another CLO of the course (0.89); replacement (keeps 0% of the original) |
| NCM101-01-R3 | rewrite | B2 run 1 (Not aligned) | duplicates another CLO of the course (1.00); replacement (keeps 0% of the original) |
| NCM101-01-R4 | rewrite | B2 run 2 (Not aligned) | replacement (keeps 0% of the original) |
| NCM101-03-R1 | rewrite | B2 run 1 (Partially aligned); B2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome |
| NCM101-03-R2 | rewrite | A2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome |
| NCM101-03-R3 | rewrite | A2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome |
| NCM101-04-R1 | rewrite | B2 run 2 (Not aligned) | Bloom escalation (Remember → Apply); replacement (keeps 0% of the original) |
| NCM101-04-R2 | rewrite | A2 run 2 (Not aligned) | Bloom escalation (Remember → Apply); replacement (keeps 0% of the original) |
| NCM101-04-R3 | rewrite | B2 run 1 (Not aligned) | Bloom escalation (Remember → Apply); replacement (keeps 0% of the original) |
| NCM101-04-R4 | rewrite | A2 run 1 (Not aligned) | Bloom escalation (Remember → Apply); replacement (keeps 0% of the original) |
| NCM101-05-R1 | rewrite | B2 run 1 (Partially aligned); B2 run 2 (Partially aligned) | Bloom escalation (Understand → Apply) |
| NCM101-05-R2 | rewrite | A2 run 1 (Partially aligned) | Bloom escalation (Understand → Apply) |
| NCM101-05-R3 | rewrite | A2 run 2 (Partially aligned) | Bloom escalation (Understand → Apply) |
| NCM101-06-R1 | rewrite | A2 run 2 (Partially aligned) | – |
| NCM101-06-R2 | rewrite | A2 run 1 (Partially aligned) | – |
| NCM101-06-R3 | re-mapping | B2 run 1 (Not aligned); B2 run 2 (Not aligned) | – |
| NCM101-07-R1 | rewrite | B2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome; replacement (keeps 30% of the original) |
| NCM101-07-R2 | rewrite | B2 run 2 (Not aligned) | rewrite of a provisionally aligned outcome; replacement (keeps 20% of the original) |
| NCM101-07-R3 | rewrite | A2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome |
| NCM101-08-R1 | rewrite | B2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome; value wording (Compassion, augustinian, truth, marian) |
| NCM101-08-R2 | rewrite | B2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome; value wording (Compassion, augustinian, marian, truth) |
| NCM101-09-R1 | rewrite | B2 run 1 (Not aligned); B2 run 2 (Not aligned) | ILO draft restates its CLO (0.50); replacement (keeps 25% of the original) |
| NCM101-09-R2 | rewrite | A2 run 2 (Not aligned) | replacement (keeps 25% of the original) |
| NCM101-09-R3 | rewrite | A2 run 1 (Not aligned) | replacement (keeps 25% of the original) |
| NCM101-10-R1 | rewrite | A2 run 2 (Partially aligned) | replacement (keeps 0% of the original) |
| NCM101-10-R2 | rewrite | A2 run 1 (Partially aligned) | replacement (keeps 0% of the original) |
| NCM101-10-R3 | rewrite | B2 run 2 (Partially aligned) | – |
| NCM101-10-R4 | rewrite | B2 run 1 (Partially aligned) | – |
| NCM101-11-R1 | rewrite | B2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome |
| EDUC105-01-R1 | rewrite | A2 run 1 (Partially aligned) | Bloom escalation (Remember → Apply) |
| EDUC105-01-R2 | rewrite | A2 run 2 (Partially aligned) | Bloom escalation (Remember → Apply) |
| EDUC105-01-R3 | rewrite | B2 run 1 (Partially aligned) | Bloom escalation (Remember → Apply) |
| EDUC105-01-R4 | rewrite | B2 run 2 (Partially aligned) | Bloom escalation (Remember → Apply) |
| EDUC105-02-R1 | rewrite | A2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome |
| EDUC105-02-R2 | rewrite | B2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome |
| EDUC105-02-R3 | rewrite | B2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome |
| EDUC105-02-R4 | rewrite | A2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome |
| EDUC105-03-R1 | rewrite | A2 run 1 (Not aligned) | Bloom escalation (Understand → Create); replacement (keeps 0% of the original) |
| EDUC105-03-R2 | rewrite | A2 run 2 (Not aligned) | Bloom escalation (Understand → Create); replacement (keeps 0% of the original) |
| EDUC105-03-R3 | rewrite | B2 run 1 (Not aligned) | Bloom escalation (Understand → Create) |
| EDUC105-03-R4 | rewrite | B2 run 2 (Not aligned) | Bloom escalation (Understand → Create) |
| EDUC105-05-R1 | rewrite | A2 run 1 (Partially aligned) | – |
| EDUC105-05-R2 | rewrite | A2 run 2 (Partially aligned) | – |
| EDUC105-05-R3 | rewrite | B2 run 1 (Partially aligned) | – |
| EDUC105-05-R4 | rewrite | B2 run 2 (Partially aligned) | – |
| EDUC105-06-R1 | rewrite | B2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome |
| EDUC105-06-R2 | rewrite | B2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome |
| ACCTG201-01-R1 | rewrite | B2 run 2 (Not aligned) | Bloom escalation (Remember → Apply); replacement (keeps 0% of the original) |
| ACCTG201-01-R2 | rewrite | A2 run 2 (Not aligned) | Bloom escalation (Remember → Apply); replacement (keeps 0% of the original) |
| ACCTG201-01-R3 | rewrite | A2 run 1 (Not aligned) | Bloom escalation (Remember → Apply) |
| ACCTG201-01-R4 | rewrite | B2 run 1 (Not aligned) | Bloom escalation (Remember → Apply) |
| ACCTG201-02-R1 | rewrite | B2 run 1 (Partially aligned); B2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome |
| ACCTG201-02-R2 | rewrite | A2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome |
| ACCTG201-02-R3 | rewrite | A2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome |
| ACCTG201-03-R1 | rewrite | A2 run 2 (Partially aligned) | – |
| ACCTG201-03-R2 | rewrite | A2 run 1 (Partially aligned) | – |
| ACCTG201-03-R3 | rewrite | B2 run 1 (Partially aligned) | – |
| ACCTG201-03-R4 | rewrite | B2 run 2 (Partially aligned) | – |
| ACCTG201-04-R1 | rewrite | A2 run 1 (Not aligned) | ILO draft restates its CLO (0.60); replacement (keeps 25% of the original) |
| ACCTG201-04-R2 | rewrite | A2 run 2 (Not aligned) | ILO draft restates its CLO (0.55); replacement (keeps 0% of the original) |
| ACCTG201-04-R3 | rewrite | B2 run 1 (Not aligned) | ILO draft restates its CLO (0.92); replacement (keeps 0% of the original) |
| ACCTG201-04-R4 | re-mapping | B2 run 2 (Not aligned) | – |
| HM210-02-R1 | rewrite | A2 run 1 (Not aligned) | – |
| HM210-02-R2 | rewrite | A2 run 2 (Not aligned) | – |
| HM210-02-R3 | rewrite | B2 run 2 (Not aligned) | – |
| HM210-02-R4 | rewrite | B2 run 1 (Not aligned) | – |
| HM210-03-R1 | rewrite | A2 run 1 (Partially aligned) | rewrite of a provisionally aligned outcome |
| HM210-03-R2 | rewrite | A2 run 2 (Partially aligned) | rewrite of a provisionally aligned outcome |

## 4. How the codes and order were made
- **Case codes.** Cases are coded by course and numbered by relationship type (CLO-PO, CLO-anyPO, CLO-EGA, CLO-anyEGA, ILO-CLO), then by sha256 of the salt and the dataset id. The salt is `align-1-dev-adjudication/2026-10-28`.
- **Part B proposals.** Every rewrite or re-mapping that A2 or B2 proposed is included, for every case that has one. That covers Set 3 cases too, so Part B does not reveal the sets. Identical texts (after collapsing white space) are merged, and all re-mappings of a case are merged into one proposal. Proposals are ordered by sha256 of the salt, the case code, the kind and the text.
- **Nothing in a code or an order depends on the provisional label, the category or any verdict.**
