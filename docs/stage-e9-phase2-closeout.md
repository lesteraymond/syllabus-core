# Stage E.9: Phase 2 closeout

An offline record, 2026-10-26.
- **No provider call was made.** There was no `.env` change, no migration and no commit, push, merge or deployment.
- No prompt, dataset, provisional label, saved result, ledger, official score, deduction, passing mark (79), readiness rule, submission gate or feature flag was changed.
- Every agreement figure below compares model answers with developer-written provisional labels. **None of them is faculty-verified academic accuracy.**

The Phase 3 preparation that follows from this record is in [stage-e9-phase3-evaluation-plan.md](stage-e9-phase3-evaluation-plan.md).

## Summary

| Question | Answer |
|---|---|
| Is Phase 2 complete in evaluation coverage? | **Yes for the approved Phase 2 scope; no for the checker as a whole.** [E.6 §10](stage-e6-evaluation-reliability.md) scoped Phase 2 to stage-d2, stage-d1 and stage-c, one run each. All three are complete on their current prompts: D2 and D1 on r7 (E.7), Stage C on r8 (E.8). That is 54 of 54 relationships verified. Outside that scope, Stages A, B1–B2, B3 and B4 have never been run live on their current r7 wording, and the new D1-2 and D2-2 items have no live answer. Every staged item has one run, and no staged dataset has a held-out split. |
| Which stages are academically validated? | **None.** No dataset item, saved answer or recommendation has a faculty verdict. This covers 12 dataset files and 355 items, the follow-up versions included. |
| Latest work (Stage C r8, all 28 relationships) | Every figure in the handoff was reproduced offline (section 1.3). |
| Key finding | With any stage on, the six scored relationship types are asked inside the staged prompt, and Stages A and B3 deliberately make two scored tests stricter. Offline tests prove that advisory answers never move the official score. Whether a live check's official result changes when stages are switched on has never been measured (section 3). |
| Open disagreement | `as-prog1-vague-evidence` is prepared for faculty adjudication (section 4). The expectation and the model answer are both unchanged. |

## 1. State recovered

### 1.1 Working tree

- Branch `Responsive-Design-2`, HEAD `68926cb`:
  - 56 tracked files modified (+1,759 / −392);
  - 176 untracked entries, the whole checker directory `server/lib/syllabuscheck/` among them.
  - Nothing is committed.
- The newest checker files date from 22:09–22:37 local time (UTC+8): the `resources-4` reviewer, its recognition test, the provider guard and its test, the evaluation runner (`scripts/eval-alignment.cjs`), and the ledger-accounting and retry-budget tests.
- Nothing under `server/lib/syllabuscheck/`, `scripts/` or `docs/` changed after the full test run at 22:55.

### 1.2 What earlier agents completed

The handoff names Claude Code, Codex and Gemini sessions on this tree. The reports name an author only in places; for example, the reviewer's neutral reading of contact units is Codex's design. In order (times UTC, 2026-10-26):

| Step | Result | Record |
|---|---|---|
| E.7 D2 (04:39, resumed 05:01), `alignment-12d2-r7` | The first attempt stopped at HTTP 401 (expired key), nothing evaluated. Resumed: 9/9 verified, 9/9 agreement, 18/18 exact quotations | [stage-e7-phase2-evaluation.md](stage-e7-phase2-evaluation.md) |
| E.7 D1 (05:22), `alignment-12d1-r7` | 17/17 verified, 15/17 agreement, one corrective retry after an empty list | same |
| E.7 offline follow-up | D1-2 (29 items) and D2-2 (13 items) datasets, a D2 explanation and basis validation proposal, the Stage C plan | [follow-up](stage-e7-academic-reliability-follow-up.md), [proposal](stage-e7-d2-validation-proposal.md), [Stage C plan](stage-c-evaluation-plan.md) |
| E.8 Stage C canary (07:22, resumed 07:23), `r7` | The first attempt stopped at the key check (network). Resumed: 8/8 verified | [stage-e8-stage-c-canary.md](stage-e8-stage-c-canary.md) |
| E.8 corrections | The r8 prompt, with an offline replay; no paid request | [stage-e8-stage-c-corrections.md](stage-e8-stage-c-corrections.md) |
| E.8 r8 regression (08:22) | 12/12 verified. An operator stop followed: a Sensors draft assumed an unconditional resource | [stage-e8-stage-c-r8-regression.md](stage-e8-stage-c-r8-regression.md) |
| E.8 r8 remaining (08:44) | 4 of 16 attempted. An operator stop on an unsupported resource bypass (`af-prog1-single-format`) | [stage-e8-stage-c-r8-coverage.md](stage-e8-stage-c-r8-coverage.md) |
| E.8 resource grounding | Reviewer `resources-2`, with an offline replay | [stage-e8-resource-grounding-fix.md](stage-e8-resource-grounding-fix.md) |
| E.8 resource regression (09:49) | Stopped at an empty answer (ModelRun) under `--max-invalid 1` | [stage-e8-resource-regression.md](stage-e8-resource-regression.md) |
| E.8 recovery (10:37) | 6/6 verified, one corrective retry | [stage-e8-resource-recovery.md](stage-e8-resource-recovery.md) |
| E.8 post-recovery review (offline) | Reviewer `resources-3`/`resources-4`; ledger-accounting, retry-budget and quotation tests; endpoint diagnostics in `eval-alignment.cjs`; 1,406 tests | [stage-e8-post-recovery-review.md](stage-e8-post-recovery-review.md) |
| E.8 twelve unseen cases (14:32) | 12/12 verified, 11/12 agreement, one corrective retry after an empty InferenceNet answer | [result](ai-eval-stage-e8-c-heldout.json) only. **This closeout is its first written report.** |

### 1.3 What was verified in this session

The latest r8 answer of each Stage C relationship was taken from the four r8 result files. Each was replayed through the current validator (`gemini.validate`) and draft reviewer (`resources-4`). The replay made no provider call.

| Handoff claim | Verified | Detail |
|---|---|---|
| 28/28 verified | **Yes** | Latest answers by file: r8 regression 9, r8 remaining 1, recovery 6, unseen cases 12. Every saved label, explanation, quotation and draft is reproduced. The four result files are byte-identical before and after. |
| 27/28 agreement | **Yes** | Only `as-prog1-vague-evidence` differs (section 4) |
| 56/56 exact quotations | **Yes** | Source and target, `evidenceMatching` exact/exact |
| 71/71 required fields assessed | **Yes** | Activity-fit: teaching and learnerSupport (13 × 2). Assessment-fit: measures, evidence and level (15 × 3). |
| 40/40 field expectations matched | **Yes** | Compared wherever an expectation exists |
| Two unsupported drafts withheld | **Yes** | `af-prog1-irrelevant` and `af-prog1-single-format`, each `assumes_resource` + `copies_other_relationship` |
| 12/14 recommendations survived withholding; no unsupported reviewer bypass | **Yes**, by the reviewer's codes | No released draft carries a withholding code. Four released drafts carry advisory notes:<br>- `af-sensors-passive`: `conditional_resource` ×2 and `proposed_resource`;<br>- `as-prog1-essay`: `proposed_resource`;<br>- `af-syseng-irrelevant` and `as-prog1-too-high`: `borrowed_wording`.<br>Observation 2 below is a reviewer-policy question, not a bypass. |
| Ledger 32 requests / $0.01214202 | **Yes** | Conservative $0.0334797. Counters: transient 1, invalid 3, unproductive 0. This run's window is requests 26–32: key check, price lookup and 5 model requests, $0.00262342 reported and charged (reconciled). |
| One recovered empty response from InferenceNet | **Yes** | Request 29 (InferenceNet) was HTTP 200 with `finish_reason: stop`: 6 completion tokens, `{"judgements":[]}`, billed $0.00043008. The corrective retry, request 30 (InferenceNet), verified all four. |
| Regression | **1,406 passed, 0 failed** | `tmp/stage-e9-full-test.log`, network blocked |
| Whole-pipeline volume (free plan) | 423 model requests minimum for the 9 syllabi | `tmp/stage-e9-pipeline-plan.log`; no provider call |

### 1.4 Observations from the verification

Nothing was changed because of these.

1. **"Held-out" is a file name, not a split.**
   - The twelve cases are `split: dev` in stage-c-2. They had never been sent to the model, and the r8 wording was not revised on them, but the same developer wrote them and the prompt.
   - No staged dataset has a held-out split.
   - The only held-out split in the repository (`alignment-dataset.json`: 42 of 100 items, legacy relationship types) has never been run. `docs/ai-eval-heldout-log.jsonl` does not exist.
2. **A released draft relies on supplied material the lesson does not establish.**
   - `as-prog1-keywords` asks students to "run it on the provided test cases".
   - `resources-4` gives no note for "the provided test cases" or "the provided test data", although it withholds "the provided simulated measurement data" as an assumption (offline probe).
   - Programming test material is outside the reviewer's vocabulary. Whether a faculty-provided test set needs an advisory note is decision 6 in section 6.
3. **`level: too_low` without a stated level.** The model answered `level: too_low` for both "Quiz" and "Submit your work.", although the r8 test says "The format name alone does not establish cognitive difficulty". The field has no "cannot tell" value (section 4, Q3).
4. **Contact hours.** The E.8 decision was that contact hours change only with institutional approval. No dedicated rule enforces it (offline probe, re-run today):
   - "Add two more lecture hours for guided practice." gets no note;
   - "Convert one lecture hour into a laboratory hour." is withheld, but only as an assumed laboratory, even when the draft makes the change subject to department approval.

   A `changes_contact_hours` reviewer code was proposed during E.8 preparation and is not implemented.
5. **The academic validation package is stale for Stage C.**
   - `scripts/export-validation-package.cjs` maps Stage C to `docs/ai-eval-stage-c-baseline.json`, which does not exist.
   - Its README still says the Stage C run was not executed.
   - Proposed, not done: point Stage C at the r8 results, flag `as-prog1-vague-evidence`, then regenerate the package.
6. **Endpoint reliability now covers 28 responses with a recorded endpoint, 4 of them empty lists.**
   - Empty: InferenceNet 2 of 11, ModelRun 2 of 3.
   - Never empty: Wafer 5, DigitalOcean 3, Together 3, Nebius 2, Parasail 1.
   - All 3 empty answers that received their corrective retry were then answered in full. The fourth (E.8 regression) was not retried; that run stopped by design.

## 2. Completion matrix

### 2.1 Status

Scored relationship types are in **bold**. Every other type is advisory: no points and never blocking (`policy.js`).

| Stage | Relationship types | Implemented | Offline tests pass | Live evaluation done | Live-tested on the current prompt | Academic accuracy |
|---|---|---|---|---|---|---|
| Legacy check (all stages off) | **CLO-PO, CLO-EGA, ILO-CLO, ILO-activity, ILO-assessment, Module-value**; CLO-anyPO, CLO-anyEGA, ILO-content, Description-plan; REF-plan (advice only) | Yes | Yes | Yes: `eval-1`, 41 items × 3 runs (2026-10-23) | Yes, `alignment-10` | Unverified |
| A: Course–CLO, CLO–PO/EGA | Course-CLO, CLO-set; a stricter tail on the scored CLO-PO / CLO-EGA test | Yes | Yes | Yes: `stage-a-2`, 28 × 2 (2026-10-24) | **No.** Run as `alignment-11` and `alignment-12a`; the current wording is `alignment-12a-r7` | Unverified |
| B1–B2: content relevance, sequence, ILO alignment | Content-course, Plan-sequence, Content-ILO | Yes | Yes | Yes: `stage-b-1`, 36 × 2, run twice (2026-10-24) | **No.** Run as `alignment-12ab`; current `alignment-12b-r7` | Unverified |
| B3: ILO–CLO | ILO-anyCLO; a stricter tail on the scored ILO-CLO test | Yes | Yes | Yes: `stage-b3-1`, 22 × 2 (2026-10-24) | **No.** Run as `alignment-123`; current `alignment-123-r7` | Unverified |
| B4: CLO coverage | CLO-coverage | Yes | Yes | Yes: `stage-b4-1`, 15 × 2 (2026-10-24) | **No.** Run as `alignment-124`; current `alignment-124-r7` | Unverified |
| C1–C2: activities, assessments | Activity-fit, Assessment-fit | Yes | Yes | Yes: `stage-c-2`, 28 × 1 (2026-10-26) | Yes, `alignment-12c1c2-r8` | Unverified |
| D1: values | Value-use, Value-map; values classification | Yes | Yes | Yes: `stage-d1-1`, 17 × 1 (2026-10-26) | Yes, `alignment-12d1-r7`. The 12 new D1-2 items are not run. | Unverified |
| D2: references | Ref-relevance (AI); APA 7 format and parts (coded) | Yes | Yes | Relevance: `stage-d2-1`, 9 × 1 (2026-10-26). Format: 17 offline fixtures | Yes, `alignment-12d2-r7`. The 4 new D2-2 items are not run. | Unverified; the APA rules are not checked by a librarian |
| E: integration | Advisory report (`verdict-1`), recommendation precedence, contradictions, evidence validation, draft review, provider guard and retries | Yes | Yes, with deterministic stand-ins | **No whole-syllabus run.** Only all-stage smoke runs on dataset items: E.3 r4 (8 relationships), E.4 r5 (12), E.5 r6 (8) | **No.** `alignment-12ab34c1c2d1d2-r8` has never been sent | Unverified |

### 2.2 Evidence, known problems and pending approvals

**Legacy check (`alignment-10`)**
- **Evidence:** 41 items × 3 runs. Agreement 0.975, stability 0.949, invalid answers 3.3%, false-positive rate 0.075, false-negative rate 0. One disagreement: `clo-po-prog-interdisciplinary`. The `alignment-9` baseline was 0.935.
- **Problems:**
  - `dataset.json` has since been revised to `eval-1.1`.
  - `alignment-dataset.json` (100 items, 42 held out) has never been run.
  - The behaviour of the scored types under the staged prompt is unmeasured (section 3).
- **Pending:** the BSIT outcomes (9 in the PDF, 10 in the database), the truncated engineering PO12, and the missing PO–EGA crosswalks.

**Stage A**
- **Evidence:**
  - `alignment-11`: 0.946, stability 0.821.
  - `alignment-12a`: 0.982, stability 0.857, 29% of first attempts invalid, retry rate 3.0, $0.009785.
  - By type: Course-CLO 28/28, CLO-set 10/10, CLO-PO 17/18 (`cp-bscpe-wrongpo`).
- **Problems:**
  - Never measured: E.4's recommendation and re-tag contract (r5), and the E.5–E.6 changes (r6, r7).
  - The retry rates come from the retry cascade that existed before E.4.
  - Stability is below 0.9.
  - The scored CLO-PO / CLO-EGA test is worded differently when A is on.
- **Pending:** the expected CLO count (4) and the level names are proposals (`verdict.js` `CONFIG`); the PO–EGA crosswalks.

**Stage B1–B2**
- **Evidence:**
  - `alignment-12ab`, baseline and regression: both 1.0 (Content-course 32/32, Content-ILO 26/26, Plan-sequence 14/14 and 13/13); stability 0.944 / 0.943.
  - First attempts invalid: 9%, then 37%; one relationship never verified in the regression.
- **Problems:**
  - Perfect agreement on easy synthetic contrasts is a ceiling effect.
  - Plan-sequence has only 7 items.
  - **Stage B's prompt example is the prog1 topic** ("Java conditional statements"). It shares its phrase with 10 item targets and 33 item sources (E.6 #10), and with weeks 7–8 of the BSIT representative syllabus.
  - The Week 1 orientation is not an AI question. PLAN-02 is deterministic:
    - a missing or empty Week 1 fails;
    - an orientation keyword gives NEEDS_REVIEW;
    - otherwise it fails as MINOR.
- **Pending:** the neutral Stage B wording proposed in E.6 (§11) has not been approved.

**Stage B3**
- **Evidence:** `alignment-123`: 0.953 (ILO-CLO 25/27, with one invalid; ILO-anyCLO 16/16), stability 0.952. One disagreement: `ic-prog1-values`.
- **Problems:** B3 adds a stricter tail to the scored ILO-CLO test.

**Stage B4**
- **Evidence:** `alignment-124`: 0.867 (26/30), false-positive rate 0.125, stability 1.0. Disagreements: `cv-prog1-clo3-gap` and `cv-syseng-clo3`. **This is the lowest agreement of any stage.**
- **Problems:** one question per CLO has to reason over 15 lesson rows.
- **Pending:** what counts as adequate coverage of a CLO is not an institutional rule.

**Stage C1–C2**
- **Evidence:** the cumulative r8 figures in section 1.3. Ledger: 32 requests, $0.01214202 for the whole of E.8.
- **Problems:**
  - `as-prog1-vague-evidence` (section 4).
  - One run per item, all on the dev split.
  - Gaps in the reviewer's vocabulary: test cases, contact hours, synonyms ("scope", "DMM", "SPICE") and Tagalog.
  - Explanations are not validated.
  - 4 of 28 responses with a recorded endpoint were empty lists.
- **Pending:** institutional facts about facilities, laboratory hours and resources. A laboratory-0 course stays neutral for evaluation (E.8 decision): no laboratory is assumed and contact hours are not changed.

**Stage D1**
- **Evidence:** 17/17 verified, 15/17 agreement, 34/34 exact quotations, one corrective retry after an empty list. Of 6 offered drafts:
  - one introduces an arrangement the lesson lacks (`vu-prog1-unrelated`);
  - one ties Compassion to re-measuring a gain (`vu-sensors-silly`);
  - one copies another lesson's statement (`vu-prog1-name-only`).

  One explanation borrows another lesson's behaviour (`vm-prog1-respect-supported`).
- **Problems:**
  - The 12 new D1-2 items have no answer.
  - D1-1 has no `opportunity` item.
  - Two items were answered INSUFFICIENT_EVIDENCE, which their expectations do not accept.
- **Pending:**
  - the value definitions (`server/config/marian-values.json`, `pending_approval`);
  - the 50% and 60% thresholds, which are proposals;
  - the policy on generic value words.

**Stage D2**
- **Evidence:** 9/9 verified and in agreement, 18/18 exact quotations.
- **Problems:**
  - `rr-sensors-relevant` has an unsupported explanation and the basis `title_and_venue`.
  - The 4 venue items of D2-2 have no answer.
  - The format rules come from the assistant's knowledge of APA 7, tested on 17 synthetic fixtures. Italics cannot be checked, and Crossref is off.
- **Pending:**
  - a librarian's confirmation of the APA rules;
  - how the `basis` field should represent venue-only evidence;
  - the [validation proposal](stage-e7-d2-validation-proposal.md).

**Stage E (integration)**
- **Evidence:**
  - Offline whole-pipeline tests (`stage-e2.test.js`) on the three representative syllabi use deterministic stand-ins:
    - the aligned syllabus passes officially with every stage on;
    - title policies behave as specified;
    - a wrong course code sends no AI request.
  - E.6 simulations of one syllabus: 49 requests when every answer is valid, 97 when corrections are needed.
- **Problems:**
  - In the all-stage smoke runs on r4–r6, most answers failed validation in whole or in part:
    - E.4: 4 of 5 answers, with 7 of 12 relationships verified;
    - E.5: 3 of 4 answers, with 7 of 8 relationships verified.
  - The r8 all-stage prompt is unmeasured.
  - Official invariance is unmeasured live (section 3).
  - E.2's production estimate (19–20 requests and 175k–183k tokens per check) predates the batch-of-4 policy and is out of date. The current figure is 48–49 requests and about 394k–481k prompt tokens with every stage on, against 9 requests and about 29k tokens with every stage off.
- **Pending:**
  - the rubric weights (`approved: false`);
  - the expected CLO count;
  - a native speaker's review of the Tagalog wording;
  - any production activation of a stage, which is an institutional decision.

**Cross-cutting**
| Item | State |
|---|---|
| Title policy | `shadow`. Normalized matching awaits approval ([title-policy-activation.md](title-policy-activation.md)) |
| Provisional AI | Off |
| Trimmed prompt | Off. Never evaluated live (E.2 Phase 4) |
| `minItems` | Off. Never sent live. E.8 kept the bounded corrective retry. |
| English / Tagalog | 55 of 55 Verdict Panel sentences have a translation (audit). The wording is not reviewed by a native speaker. The draft reviewer is English-only. |
| Saved reports | Prompt labels keep answers made under one wording apart from another. A cached judgment whose reviewer version differs is re-reviewed locally, with no provider call. |

## 3. Key finding: scored relationships are judged by the staged prompt

**Facts**
1. A check has one system prompt (`gemini.js` `systemPromptOf`). With any stage on, every relationship of the check is asked under the staged prompt in batches of 4, the six scored types included. With every stage off, they are asked under `alignment-10` in batches of 12.
2. `engine.js:299-305` deducts points for any non-advisory type, whatever prompt answered it. The penalties are: alignment 3, partial alignment 1.
3. Stage A appends a stricter tail to the scored CLO-PO / CLO-EGA test, and Stage B3 to the scored ILO-CLO test.
4. The offline invariance tests (E.6 #18, the compliance and revision-cycle tests) answer the scored relationships identically in both runs. They therefore prove that advisory answers never move the score. They do not prove that the model answers a scored relationship the same way under both prompts.

**Measured offline**, per representative syllabus (`e9-volume`, stand-in transport, no network):

| | Every stage off | Every stage on |
|---|---|---|
| Prompt | `alignment-10` | `alignment-12ab34c1c2d1d2-r8` |
| Requests | 9 | 48 |
| Questions | 100. **76 scored:** CLO-PO 8, CLO-EGA 8, ILO-CLO 15, ILO-activity 15, ILO-assessment 15, Module-value 15 | 189, the same 76 scored ones included |
| Prompt tokens (bytes ÷ 4.89; characters ÷ 4 gives about 20% more) | about 29k | about 394k |

**Consequence.** Switching any stage on in production could change official scores, pass or fail at 79, and readiness, with no change to the scoring code. This has never been measured.

**Options.** This is your decision; none is implemented.
- (a) Keep the stages off in production. This is the current default.
- (b) Measure first: Phase 3 pairs every all-stage run with an all-off run of the same syllabus.
- (c) Change the architecture: always ask the scored types under `alignment-10`, in their own requests, and use the staged prompt only for the advisory types. Invariance would then hold by construction, at about 9 more requests per check. This needs approval and its own regression.

**Recommendation:** (b) now, and (c) if any divergence appears.

## 4. Disagreement prepared for faculty adjudication: `as-prog1-vague-evidence`

**Status: open.** The provisional expectation and the model answer are both preserved unchanged. Neither is treated as correct until faculty decide.

### 4.1 The relationship

The item is in `stage-c-2` with `origin: stage-c-1`, `split: dev`, `reviewStatus: unreviewed` and `facultyVerdict: null`.

| | |
|---|---|
| Type | Assessment-fit (Stage C2; advisory: no points, never blocking) |
| Course | `prog1`: the synthetic Week 3 lesson of a BSIT Computer Programming 1 course |
| Source (the lesson) | Week 3 course content: Java conditional statements: if, if-else, nested if and switch<br>ILO: "Develop and test Java programs that use if-else and switch statements to make decisions."<br>Contact units stated by the syllabus: lecture 2, laboratory 1<br>Learning activities: "- Guided Java coding exercise in the laboratory: demonstration, then pair programming." |
| Target (the assessment task) | "- Submit your work." |

### 4.2 Developer expectation (provisional, unchanged)

- Accepts `PARTIALLY_ALIGNED` only.
- Reason: "Says neither what is submitted nor how it is marked."
- Expected field: `evidence: vague`.

### 4.3 Model answer (unchanged)

The answer came from the unseen-cases run (2026-10-26 14:32 UTC, `alignment-12c1c2-r8`), request 30 at InferenceNet. That request was the corrective retry after request 29 returned an empty list for the same four relationships.

| Field | Answer |
|---|---|
| Label | **NOT_ALIGNED** |
| measures / evidence / level | no / vague / too_low |
| responsible | assessment |
| Quotations | Source: the ILO sentence, exact. Target: "Submit your work.", exact. |
| Explanation | "The task names no evidence: it does not say what is submitted or answered, so it collects no observable evidence of developing and testing if-else and switch programs." |
| Draft (released, no reviewer note) | "- Submit the Java program you developed in the laboratory exercise, together with its test output showing the results of the if-else and switch decisions." |

The expected field (`evidence: vague`) agrees. The label differs because the model answered `measures: no`.

### 4.4 Why both readings are defensible under the r8 wording

The quotations below are from the Assessment-fit test in `server/lib/syllabuscheck/stages.js`.
- "The label must agree with the fields: ALIGNED only when measures is yes, evidence is observable and level is matches; NOT_ALIGNED when measures is no; otherwise PARTIALLY_ALIGNED."
  - Once the model answered `measures: no`, the contract required NOT_ALIGNED. The label is consistent with the model's own field.
- "A bare task name ("Quiz", "Exercise") with no hint of what is assessed is PARTIALLY_ALIGNED."
  - "Submit your work." is an instruction, not a task name, so the rule does not literally apply. The expectation treats it as if it did.
- "The assessment concerns this lesson's content and identifies an observable answer, artifact, result or demonstration that can be marked."
  - The task identifies none. That supports `evidence: vague` (both sides agree) and arguably `measures: no`.
- **Context.** In this lesson, "your work" can only mean the guided coding exercise, which would partly evidence the ILO. That reading supports `measures: partly` and PARTIALLY_ALIGNED.

### 4.5 Comparator in the same run

`as-prog1-bare-name` is the same lesson with the target "- Quiz", answered in request 28 at Wafer.
- Its answer is PARTIALLY_ALIGNED with measures partly, evidence vague and level too_low.
- That agrees with its expectation.
- The two answers differ only in `measures`, that is, in whether the bare-name rule applies.

### 4.6 Questions for faculty

- **Q1 Label.** For this lesson, is "Submit your work." PARTIALLY_ALIGNED or NOT_ALIGNED? Or are both acceptable, as for `as-prog1-keywords`, whose expectation accepts either?
- **Q2 Measures.** Does an instruction that names no product still partly measure the ILO when the lesson has exactly one practical activity (`partly`)? Or does it not measure it at all (`no`)?
- **Q3 Level.** Both answers above set `level: too_low` for a task that states no level, and the r8 test says the format name alone does not establish difficulty. Should the contract allow "cannot tell" for the level? That would be a contract change. Or is `too_low` acceptable?
- **Q4 Rule scope.** Should the bare-name rule also cover bare instructions, such as "Submit your work." and "Answer the questions."? If so, that is a prompt revision (r9). It needs approval and a regression on all 28 Stage C relationships.
- **Q5 Draft.** The proposed rewrite uses only the lesson's own laboratory exercise. Is it acceptable as a suggestion, acceptable with edits, or not acceptable?

### 4.7 Adjudication form

Use one form per reviewer.

| Field | Entry |
|---|---|
| Reviewer, role, program | |
| Date | |
| Q1 label (PARTIALLY_ALIGNED / NOT_ALIGNED / either / other) | |
| Q2 measures (yes / partly / no) | |
| Q3 level (matches / too_low / too_high / cannot tell) | |
| Q4 extend the bare-name rule? (yes / no / unsure) | |
| Q5 draft (acceptable / acceptable with edits / not acceptable), and the edits | |
| Notes | |
| Second reviewer agrees? (yes / no; if no, the adjudicator's decision) | |

### 4.8 How a decision is recorded

- The decision goes into a new dataset version, `stage-c-3`, with `facultyVerdict`, `facultyNotes`, the reviewer and the date.
- `stage-c-2`, its `accept` list and every result file stay as they are, so the r8 figure of 27/28 remains reproducible.
- A "yes" to Q4 becomes a separate, approved prompt task (r9).

## 5. Missing live evaluations, by priority

Request counts are model requests before retries, at 4 relationships per staged request. Nothing below has been run.

| # | Evaluation | Why it matters | Size |
|---|---|---|---|
| 1 | The integrated pipeline on whole 18-week syllabi | It has never been run, and the all-stage r8 prompt has never been sent | Phase 3, Layer B |
| 2 | Official invariance: all stages on against all off, same syllabus | Section 3 | 9 requests per syllabus, in Phase 3 |
| 3 | Stages A, B1–B2, B3 and B4 on the current r7 wording | Their only live results come from older wording, before the re-tag contract | About 26 requests (28 + 36 + 22 + 15 items). The decision on Stage B's example comes first. |
| 4 | The new D1-2 items (12) and D2-2 items (4) | Opportunity, laboratory and venue cases | About 4 requests |
| 5 | Stability: a second run of Stage C, D1 and D2 | Every staged result is a single run. Under the same r8 prompt, in a different batch, `af-sensors-passive` was NOT_ALIGNED in the r8 regression and PARTIALLY_ALIGNED in the recovery; its expectation accepts both. | About 15 requests |
| 6 | The held-out split of `alignment-dataset.json` (42 items) | The only true held-out test in the repository | About 4 requests with `--legacy` (`alignment-10`, 12 per request); prints aggregates only |
| 7 | The three real syllabi | The only faculty-written text | 132 requests (free plan). Needs data-governance consent first (Phase 3 plan, B7). |
| 8 | Trimmed prompt; `minItems` probe | Efficiency and reliability options | Deferred, not recommended now |

Items 3–6 together come to about 50 model requests: an estimated $0.03–$0.08, retries included. Each still needs its own approval and budget.

## 6. Known academic limitations and unresolved decisions

| # | Item | Decided by | What it blocks |
|---|---|---|---|
| 1 | The label and contract questions of `as-prog1-vague-evidence` (Q1–Q5) | Faculty (BSIT) | Stage C label policy; r9 only if approved |
| 2 | D1:<br>- `vu-prog1-name-only` (open since E.6);<br>- for `vu-prog1-no-activity` and `vm-prog1-respect-no-evidence`, accept INSUFFICIENT_EVIDENCE or narrow the wording | Faculty, values or formation office | How D1 is read |
| 3 | D2:<br>- `title_and_venue` against `title_only` when only the title supports the judgment;<br>- the venue-only diagnostic;<br>- validating explanations and the basis (proposal) | Librarian, faculty | D2 basis metrics |
| 4 | Replacing Stage B's example (the neutral wording proposed in E.6) | You | The r7 regressions for A, B, B3 and B4; BSIT content-relevance results in Phase 3 |
| 5 | Drafts that change contact hours (`changes_contact_hours`, proposed) | You, then the institution | Reviewer policy |
| 6 | Drafts that rely on supplied test material ("the provided test cases") | Faculty | Reviewer policy |
| 7 | Scored types judged under the staged prompt (section 3) | You (architecture) | Any production activation of a stage |
| 8 | Outcomes:<br>- BSIT has 9 in the PDF and 10 in the database;<br>- BSIE and BSCpE PO12 ends mid-sentence;<br>- no PO–EGA crosswalk for the engineering programs | Program chairs, registrar | Ground truth for CLO–PO and CLO–EGA |
| 9 | BSIT-Cyber Security inherits BSIT's POs and EGAs: the policy is unconfirmed and the migration has not been run | Institution, then a database administrator | Cyber Security PO checks |
| 10 | Value definitions (`pending_approval`), the lexicon, and the policy on generic value words | Values or formation office | Ground truth for D1 and Module-value |
| 11 | APA 7 rules unconfirmed; italics cannot be checked | Librarian | D2 format |
| 12 | Activating normalized title matching (now `shadow`) | You | Title gate behaviour |
| 13 | Proposed thresholds:<br>- 4 CLOs and the level names;<br>- 50% integrated values;<br>- 60% copied over 4 lessons;<br>- rubric weights (`approved: false`) | Institution | Verdict wording |
| 14 | Curricula and outcomes transcribed from images, not re-verified | Registrar | Every curriculum identification |
| 15 | Empty provider answers (4 of 28): keep the corrective retry; `minItems` is untested | You | Retry budgets |
| 16 | Tagalog wording not reviewed by a native speaker; the reviewer is English-only | Language reviewer | Bilingual release |
| 17 | Method limit: an exact quotation proves where the evidence came from, not that it is relevant; explanations are not validated | n/a | How every metric is read |
| 18 | Method limit: developer-written labels, one run, the dev split | n/a | Every agreement figure |

## 7. Production dependencies

These are documented here, not executed.

- **`program_outcome_sources` migration** (`server/db/migrate-program-outcome-sources.js`): **not run.**
  - Without the table, `outcomeSource` (`server/lib/programs.js:42-47`) returns the program itself.
  - A BSIT-CYBERSECURITY syllabus would then be checked against the outcomes stored for BSIT-CYBERSECURITY, if any, not BSIT's.
  - The institution has not yet confirmed the inheritance policy.
- **Approved curricula.** Production records are imported through `POST /api/syllabus-check/references` with `confirmedAgainstSource`. The repository transcriptions are not approved records.
- **Checker tables on a fresh install** (`server/db/migrate-syllabuscheck.js`, untracked). Nothing here records whether it has been run on any database; do not assume it has.
- **Value definitions:** approval of `server/config/marian-values.json`.
- **The provider key:** check it with `--check-key` before any paid run. Only its status and expiry are read, never its label.

## 8. Files

- **Added:** this file and [stage-e9-phase3-evaluation-plan.md](stage-e9-phase3-evaluation-plan.md).
- **Unchanged:** every result, ledger, dataset, checker module, script, rules document and validation package, and `server/.env`. SHA-256 hashes were compared before and after this session.
- **Scratch scripts, outside the repository:** the replay, volume, prices, reviewer probes and inventory.
