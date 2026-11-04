# After faculty validation: development steps

**Status: a proposal. None of these steps is authorised, and none should be started yet.**
- Every step that sends a request to a model provider needs its own written approval and budget, as before.
- Claude stays evaluation-only throughout, and production stays locked.
- Throughout, nothing changes in the 47 deterministic rules, the official score, the pass mark of 79, the deductions or the submission gates. Nothing changes in the historical results, the provisional labels or the faculty datasets.

## Where things stand
Against provisional labels, not faculty-validated:

| Measure | A2 (`alignment-10`) | B2 (`alignment-12a3-r7`, Stage A + B3) |
|---|---|---|
| Permissive agreement | 96 of 116 | 87 of 116 |
| False approvals | 0 of 52 | 0 of 52 |
| False rejections | 18 of 50 | 27 of 50 |
| Remap candidates given the provisional remedy | 10 of 16 | 16 of 16 |
| Rewrites of provisionally aligned outcomes | 18 | 27 |

- **Small sample.** Two runs per arm. B2 changed its verdict between its own runs on 6 of 58 cases.
- **Most of the disagreement is policy, not error.** It rests on questions only the institution can answer (P1–P7).

## 1. Identify prompt weaknesses
- **Re-score first, offline.** Before changing anything, score the saved A2 and B2 answers against the approved faculty references; for the 16 copied cases, add A1. This needs no provider call and no budget. It shows:
  - how many of the provisional "false rejections" faculty consider false;
  - whether any provisional agreement was wrong;
  - which disagreements remain.
- **Trace each remaining disagreement to the prompt rule that produced it**, by policy question. The A2 report traced 13 of A2's 18 false rejections to two rules. Candidates already visible:
  - the multi-part rule ("every one must be shown"), if P1 adopts contribution;
  - the course-subject rule, which lets course fit decide the verdict, if P4 separates fit;
  - the ILO step test against the multi-part reading (P2);
  - word-by-word reading of EGA names (P3);
  - strict level readings: rating a multi-verb PO by a lower verb, or counting an ILO's lower level as a gap (P7);
  - first-attempt source/target swaps on ILO–CLO pairs (4 of 116 in B2, all recovered);
  - recommendation patterns: rewrites of aligned outcomes, raising to the PO's level, ILO drafts that restate their CLO, value wording, RETAG/REWRITE alternation, and re-mappings without a target.
- **Write each as a testable statement before any change is made.**

## 2. Make targeted changes using development data
- **One change per variant.** Each variant is named, versioned and hashed, and its expected effect is written down before it runs, as was done for B2.
- **Development data only.** Use the development split and, where needed, new development cases written for the purpose. Never use the held-out cases.
- **No case examples in the prompt.** Do not paste development cases into the prompt as examples. If examples are needed, write separate ones and check them for overlap with both splits.
- **The validator and its stop rule stay as they are**, at three invalid answers.

## 3. Preserve useful RETAG_OUTCOME behaviour
- **Keep Stage A's re-mapping contract:** a sound text with the wrong mapping gets a re-mapping with an empty draft.
- **Name the target if P5 requires it.** The re-mapping then names the target outcome from the program's list, and the validator checks it against the list.
- **Regression checks:**
  - re-mapping on the faculty-approved re-mapping cases;
  - no re-mapping where faculty choose removal or a rewrite (for example an off-subject CLO);
  - the same remedy in every run (B2 alternated on 4 cases).

## 4. Reduce unsupported false rejections
- **Align the verdict rules with P1–P4 as adopted.** For example, if contribution is adopted: a CLO that develops a substantial part of the PO at an appropriate level is ALIGNED, and the uncovered parts are noted, not scored as partial.
- **If P4 separates course fit**, report fit in its own advisory field and keep it out of the verdict.
- **Measure false rejections against the faculty references, by policy question.** False approvals must not rise: the 0 of 52, and the keyword traps, are hard gates.

## 5. Prevent unnecessary rewriting of aligned CLOs
- **No draft for an ALIGNED verdict.** That is already the contract.
- **An optional suggestion, not a required rewrite**, for a partial verdict whose only gap is optional under the adopted policy.
- **Drafts limited to the gap they fix.** They keep the author's subject, level and values unless the gap needs otherwise, and an ILO draft stays a step.
- **An advisory static draft review** for the patterns faculty reject in Part B: escalation, scope change, value changes, duplication.
- **Measures:** rewrites of faculty-aligned outcomes (the target is none), and the Part B-derived draft rules.

## 6. Repeat the relevant development evaluations
- **Each run needs its own approval and budget.** Run the A2-equivalent baseline and each changed variant on the same development cases, with the same model and settings.
- **Run enough to separate effect from variation.** Two runs per arm could not separate a change from run-to-run variation. Use at least three runs, more cases, or both.
- **Score against the faculty references first**, and report provisional agreement separately.
- **Keep the safeguards:** the spending guard, the request limits and the validation stop.

## 7. Lock the final evaluation configuration
- **Freeze everything:** the model id, the prompt version and hash, the contract, the stage flags, the batch size, the retries, the validator, the scoring script, the reference version and the analysis plan.
- **Pre-register what will be reported. Change nothing after the lock.**

## 8. Execute the protected held-out dataset once
- **Conditions:** only after step 7, with its own approval and budget, and after the held-out verdicts have been faculty-reviewed and sealed (procedure, section 8).
- **The run:** one run of the frozen configuration, reported in aggregate and appended to the held-out log.
- **Afterwards:** report the result whatever it is. Do not tune on the held-out cases afterwards.
