# Hybrid-2 AI Checker: P2 pilot (A3 and B1) with Claude Sonnet 5.5

**Status: the authorized pilot ran on 2026-10-28** (local time; 18:25–18:32 UTC on 2026-10-27). Only two evaluations ran: A3 (mode A, legacy) and then B1 (mode B, Stage A). A1, A2, B2, B3 and P3–P5 were not run. Claude stays evaluation-only: no official score, readiness check or submission gate used these answers.

**How to read the agreement figures.** Every "agreement" below is agreement with the dataset's **provisional** expected verdicts. A developer wrote them, and faculty have not reviewed them (`reviewStatus: unreviewed`). These figures are not faculty-validated accuracy.

## 1. Scope and limits

| | A3: legacy CLO-PO | B1: enhanced Stage A |
|---|---|---|
| Mode | A, legacy academic alignment benchmark (`alignment-10`, no stage on, no recommendation field) | B, enhanced staged semantic evaluation (`alignment-12a-r7`, Stage A on, with a recommendation field) |
| Dataset | `stage-a-2`, the 9 CLO-PO items (development data only) | `stage-a-2`, all 28 items: 14 Course-CLO, 5 CLO-set and 9 CLO-PO (development data only) |
| Model and settings | `claude-sonnet-5-5`, adaptive thinking, effort high, max_tokens 16,000, timeout 180 s, 2 adapter retries, prompt cache | the same |
| Runs | 2 | 2 |
| Requests without retries | 6 | 16 |
| Request limit, retries included | 15 | 40 |
| Cost cap (guard accounting) | $0.55 | $1.10 |
| Pilot cap over the spend register | $1.669372, which is P1's $0.019372 plus $1.65 | the same |
| Validation stop | the 3rd answer that fails validation | the same |

The evaluation's guard handled every request. Before sending, it checked the request against the request limit, the cost cap and the pilot cap, and reserved the request's worst case. When the answer came back, it settled the charge at the tokens Anthropic reported. Retries count toward every limit.

## 2. Pre-flight checks (before any paid request)

1. **The workspace's $10 spend limit and the credit balance:** you confirmed both in the Anthropic Console. The API cannot read either one.
2. **The key's workspace:** one unbilled model lookup (HTTP 200) showed that the key authenticates and resolves to the same workspace as P1. The workspace id is not recorded in this repository. The key is read from `server/.env`; no other environment supplies one.
3. **The local spend register:** it held $0.019372 (P1) of its $10 cap, with no stale lock.
4. **The guard:** the guard, harness and quality-metric tests pass offline.
5. **The planner:** `--plan` with the exact flags printed the caps with no warning. Each request's reserved worst case fit under its cap: $0.2157 for A3 and $0.2339 for B1.
6. **The production lock:** the application's approval switch is unset, and the server's official check reports `configured: false`. Both were checked again after the pilot.

The console output of each evaluation was saved to a scratch log. Before display, the log and every file the run wrote were scanned for the key, its last 12 characters and its body. None appeared.

## 3. Results, reported separately

| # | Measure | A3: mode A, legacy (CLO-PO) | B1: mode B, Stage A (all three types) |
|---|---|---|---|
| 1 | Academic cases | 9 items × 2 runs = 18 relationship judgements | 28 items × 2 runs = 56 |
| 2 | Successful evaluations | 18 of 18 verified; 6 of 6 requests HTTP 200 | 56 of 56 verified; 18 of 18 requests HTTP 200 (2 first answers refused, both recovered) |
| | Labels given | ALIGNED 6, PARTIALLY_ALIGNED 4, NOT_ALIGNED 8, INSUFFICIENT_EVIDENCE 0 | ALIGNED 15, PARTIALLY_ALIGNED 18, NOT_ALIGNED 21, INSUFFICIENT_EVIDENCE 2 |
| 3 | Strict agreement | 100%: 8 of 8 answers on single-verdict items | 100%: 22 of 22 |
| 4 | Permissive agreement | 100%: 18 of 18 | 100%: 56 of 56 |
| 5 | False alignment approvals | 0 of 10 | 0 of 34 |
| 6 | False rejections | 0 of 4 | 0 of 12 |
| | Insufficient evidence | 0 | 2, both on the unreadable CLO, where the dataset accepts it |
| 7 | Evidence validation | 36 of 36 quote sides verbatim; 0 refused | 112 of 112 final quote sides verbatim. 2 of 58 returned judgements were refused for `quote_not_found` (the same item in both runs); both were recovered on retry |
| 8 | Bloom disagreements | ALIGNED answers breaking the level rule: 0 of 6. Levels changed between runs on 1 of 9 items (one CLO: Apply versus Create). Invalid levels: 0 | Breaking the rule: 0 of 6. Changed between runs on 8 of 27 items, all on the course-description side (N/A versus Apply); every CLO's level was stable. Invalid levels: 0 |
| 11 | Consistency between runs | The same label on 9 of 9 items. Every answer came from `claude-sonnet-5-5` | The same label on 26 of 28 items; both changes stayed within the accepted verdicts. Every answer came from `claude-sonnet-5-5` |
| 12 | API requests | 6 (6 batches) | 18 (16 batches + 2 re-asks) |
| 13 | Retries and timeouts | 0 re-asks, 0 adapter retries, 0 timeouts, 0 rate limits or server errors | 2 re-asks after `quote_not_found`, 0 adapter retries, 0 timeouts, 0 rate limits or server errors |
| 14 | Tokens | input 3,096; cache write 3,728; cache read 18,640; output 4,611 | input 16,228; cache write 5,128; cache read 87,176; output 15,542 |
| 15 | Thinking tokens | 0, explicitly reported on 6 of 6 requests; 0 thinking blocks | 0, explicitly reported on 18 of 18; 0 blocks |
| 16 | Latency per request | median 5.2 s, p90 6.9 s, max 6.9 s (whole run 36 s) | median 6.9 s, p90 8.7 s, max 9.1 s (whole run 116 s) |
| 17 | Cost | estimated $0.063486 at the published prices; guard charge $0.065350 | estimated $0.209414; guard charge $0.218131 |

The guard charges slightly more than the estimate because it counts a cache read at $0.20 rather than the published $0.10 per million tokens.

## 4. Recommendation quality: rewrite versus re-tag

**Terms.** On a CLO-PO item, the checker's `REWRITE_TEXT` is your REWRITE_CLO: the CLO text should change. `RETAG_OUTCOME` keeps the CLO text and changes only which PO it is mapped to. Mode A has no recommendation field, so its proposal is inferred. Under the legacy contract, a failing CLO-PO answer must include a rewrite.

| | A3 (mode A) | B1 (mode B) |
|---|---|---|
| Proposals | NO_CHANGE 6, REWRITE 12 | NO_CHANGE 15, REWRITE 25, REVIEW_REQUIRED 10, RETAG 6 |
| As provisionally expected | 8 of 14 | 44 of 46 |
| Unsupported recommendations | 6, all a rewrite where a re-tag is expected (all 3 wrong-PO items, both runs) | 0 |

**The three wrong-PO items.** Each pairs a sound CLO with the wrong PO. Every run gave the same proposal.

| Item | Sound CLO | Wrong PO | A3 (legacy) | B1 (enhanced) |
|---|---|---|---|---|
| `cp-bscpe-wrongpo` | Calibrate a sensor and record its measurement tolerance. | Ability to communicate effectively | Rewrote the CLO into a communication outcome: "Communicate effectively the calibration procedure and measurement tolerance of a sensor through a clear written technical report and an oral presentation…" | RETAG_OUTCOME: "The CLO is sound for this course, so the PO tag does not fit and should be changed rather than the CLO text." |
| `cp-bsie-wrongpo` | Develop a system requirements specification and a functional decomposition for an engineered system. | Ability to function on multidisciplinary teams | Added teamwork: "Collaborate effectively in a multidisciplinary team to develop a system requirements specification…" | RETAG_OUTCOME. One run adds: "a design PO would fit better". |
| `cp-bsit-wrongpo` | Develop and test Java programs that use loops and conditional statements. | Preserve and promote "Filipino historical and cultural heritage | Forced the PO into the CLO: "…to preserve and promote Filipino historical and cultural heritage, such as a program that catalogs and displays Philippine heritage sites or festivals." | RETAG_OUTCOME: "the PO choice is wrong, not the CLO". |

**Findings.**

- **Mode A rewrote the sound CLO in all 6 answers.** Each draft pulls the wrong PO's wording into the CLO, which is exactly what the evaluation requirements prohibit. The cause is structural: the legacy contract offers no re-tag, and it refuses a failing answer that has no draft. The application uses this mode today, because Stage A is off.
- **Mode B re-tagged all 6 and left the CLO text unchanged.** Its explanations say the CLO is sound and the PO does not fit.
- **Mode B did not overuse the re-tag.** It used `RETAG_OUTCOME` nowhere else:
  - The keyword-overlap CLOs, which are weak in themselves ("Memorize the keywords and syntax of the Java language", "Discuss experiments in the history of sensor technology"), still got rewrites.
  - The clear-positive items got NO_CHANGE.

  On these items, then, it separates "the CLO needs improvement" from "the mapping is wrong".
- **Mode B does not name the replacement PO.** In the application, Stage A's mapping advice would suggest one from the approved list. That advice was not evaluated here.

**Other recommendations.**

- **Off-subject Course-CLO items.** These are a database CLO in a Java course, a queueing-theory CLO in a sensors course and a Java CLO in a systems engineering course. B1 drafted a new CLO on the course's own subject. That matches the provisional expectation, but it replaces the CLO rather than improving it; faculty may prefer "remove or move this CLO".
- **The unreadable CLO.** B1 answered INSUFFICIENT_EVIDENCE with REVIEW_REQUIRED and no draft. The provisional recommendation rule expected a rewrite, but REVIEW_REQUIRED is arguably the better remedy for meaningless text. These two answers are the only 2 mismatches out of 46. The expectation was not changed.
- **CLO-set items.** The 8 answers on the four flawed CLO sets were REVIEW_REQUIRED with advice, as expected; the sound set got NO_CHANGE. Example: "Merge CLOs 1-4 into one loop CLO and add CLOs on logical problem formulation…".
- **Evidence-grounded explanations.** All 74 explanations were read (18 in A3, 56 in B1). Each names the specific verbs, objects or missing elements of the two texts. One A3 label sits uneasily with its explanation: `cp-bscpe-keyword` was PARTIALLY_ALIGNED, yet the explanation says the CLO "shares only the word 'experiments'". B1 judged the same item NOT_ALIGNED in both runs. The dataset accepts both labels.
- **The advisory answer review** flagged 0 answers in either evaluation.

## 5. A3 and B1 on the shared academic cases

**Are the cases identical?**

- Both evaluations used the same dataset file and version, `stage-a-2`, and the file was unchanged across both runs (hash checked).
- All 9 CLO-PO items of A3 are in B1, with identical texts and accepted verdicts: each comes from one dataset entry.
- Three things differ:
  - the prompt (`alignment-10` versus `alignment-12a-r7`);
  - the answer contract (only B1 has a recommendation field);
  - the batching: A3 asked each course's CLO-PO items together, while B1 asked up to four items of a course of any Stage A type.

  Any difference therefore reflects the whole mode, not the prompt alone.
- B1's other 19 items (Course-CLO and CLO-set) have no A3 counterpart and are not compared.

**Paired outcomes, per item and run (18 pairs):**

| Outcome | Pairs |
|---|---|
| Both agree with the expected verdict | 18 |
| Only A3 agrees | 0 |
| Only B1 agrees | 0 |
| Neither agrees | 0 |

Verdict agreement did not differ, so this pilot claims no accuracy improvement.

**Differences recorded on the shared items:**

- **Recommendation:** 6 of 18 paired answers differ, all on the wrong-PO items (rewrite versus re-tag; section 4).
- **Label:** on `cp-bscpe-keyword`, A3 answered PARTIALLY_ALIGNED in both runs and B1 answered NOT_ALIGNED in both runs. Both labels are accepted, and B1's label fits its own explanation better.
- **Bloom levels:** identical on 17 of 18 paired answers. The one difference is `cp-bsit-wrongpo` in run 2: A3 gave Apply → Create, B1 gave Apply → Apply.
- **Drafts on items that need a rewrite** (keyword-overlap and real-faculty): both modes rewrite, and B1's drafts are shorter.

## 6. Budget

| | Amount |
|---|---|
| Pilot ceiling | $1.65 |
| Charged by the guard (A3 + B1) | $0.065350 + $0.218131 = **$0.283481** (17% of the ceiling) |
| Estimated at the published prices | $0.063486 + $0.209414 = $0.272900 |
| Unused pilot authorization | $1.366519. It does not carry over without a new authorization |
| Spend register (every Claude ledger) | $0.302853 of $10, leaving $9.697147 |
| Anthropic's invoice | The Console's usage page is the authority; it should show about $0.27 for the pilot |

**Measured cost per verified relationship:** A3 $0.0035, B1 $0.0037. At these rates, with no thinking, the next evaluations would cost roughly:

| Evaluation | Relationships | Estimated cost | Planned cap |
|---|---|---|---|
| A1 | 82 | $0.29 | $1.00 |
| A2 | 116 | $0.41 | $1.40 |
| B2 | 116 | $0.43 | $1.90 |
| **Total** | | **about $1.1** | **$4.30** |

Each 1,500 thinking tokens would add about $0.015 per request.

## 7. Observed defects and limitations

**Defects:**

1. **The legacy contract forces rewrites of sound CLOs.** All 6 wrong-PO answers were rewrites (section 4). This affects production as it stands, because Stage A is off in the application.
2. **One quote was paraphrased, and the same paraphrase recurred.** In both runs, the first answer for `cc-sensors-real3` quoted "development of signal conversion circuits", while the course text says "developing signal conversion circuits". The validator refused it, and a re-ask fixed it each time, costing 2 extra requests (about $0.014 by the guard's count).
3. **Bloom levels on course descriptions are unstable.** On 8 items, the description was N/A in one run and Apply in the other. No verdict changed, since no level rule applies to Course-CLO, but the field is not stable for texts that are not outcomes.
4. **One recommendation flipped on an ambiguous real-faculty CLO.** On `cc-syseng-real2`, run 1 answered PARTIALLY_ALIGNED with a rewrite, and run 2 answered ALIGNED with no change.

**Limitations:**

5. **Agreement is not accuracy.** The expected verdicts are provisional, so agreement is not faculty-validated accuracy.
6. **Samples are small:** 9 and 28 items, 2 runs each. Two answers to the same item are not independent. With no errors on 9 items, the true error rate could still be up to about 33% (rule of three); on 28 items, up to about 11%.
7. **The re-tag finding rests on 3 wrong-PO items.** It held consistently, but on only those three.
8. **Thinking never engaged:** 0 thinking tokens on all 24 requests. Harder items may change cost, latency and answers.
9. **The re-tag target was not evaluated**, meaning which PO would fit instead.
10. **Only the stage-a dataset was used:** no CLO-EGA, ILO-CLO or level-gap items.

## 8. Recommendation on A1, A2 and B2

**Proceed, under a separate authorization, in the planned order: A1 → A2 → checkpoint → B2.**

- **Reliability supports it.** No request failed, no answer came from another model, every JSON answer was valid, every final quote was verbatim, and the pilot used 17% of its ceiling.
- **A2 ↔ B2 tests the main question at scale.** Remap versus rewrite has a clear but small signal here. The paired A2 ↔ B2 comparison tests it on 58 items, including CLO-EGA and ILO-CLO and the 8 remap candidates.
- **One setting to decide before B2:** with `--max-invalid 3`, B2 would probably stop early. B1 had 2 recovered quote refusals in 18 requests, and B2 sends about 34, so a third recovered refusal is plausible. The options:
  - keep 3, and accept an early stop followed by review; or
  - scale the stop to the run (for example 5 for B2), and rely on the academic stop and the unproductive-answer stop to catch systematic failure.
- **Caps:** the planned caps (A1 $1.00, A2 $1.40, B2 $1.90) are ample against about $1.1 expected. Lower caps are possible, but each must stay above the expected spend plus one worst-case reservation (about $0.23).
- **No production change yet.** Turning Stage A on in the application, or activating Claude, needs its own decision. The pilot supports the direction, but faculty validation is missing.

## 9. Files and integrity

- **New results:**
  - `docs/ai-eval-anthropic/p2-a3-result.json` and `p2-a3-ledger.json`;
  - `docs/ai-eval-anthropic/p2-b1-result.json` and `p2-b1-ledger.json`;
  - the updated `spend-register.json`;
  - this report.
- **Nothing else changed.** Snapshots taken before and after the pilot show no other change in `docs`, `server`, `scripts`, `src` or `tests`. Unchanged files include:
  - the MiniMax results and the P1 files;
  - the faculty-review data and the datasets;
  - the 47-rule standard with its pass mark of 79, the scoring and the gates.
- **Repository state:** HEAD is still `68926cb` and `server/.env` is unchanged. Nothing is staged or committed.
- **No key exposure:** the key appears in none of the files the pilot wrote.
