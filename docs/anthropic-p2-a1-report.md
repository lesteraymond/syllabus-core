# Hybrid-2 AI Checker: P2 A1 (general academic alignment, legacy) with Claude Sonnet 5.5

**Status: A1 ran on 2026-10-28** (local time; `ranAt` 2026-10-27T18:50:34Z) and took 103 seconds. Only A1 ran. A2, B2, B3 and P3–P5 were not run. Claude stays evaluation-only: no official score, readiness check or submission gate used these answers.

**How to read the agreement figures.** Every "agreement" below is agreement with the dataset's **provisional** expected verdicts. A developer wrote them, and faculty have not reviewed them (`reviewStatus: unreviewed`). These figures are not faculty-validated accuracy.

## 1. Scope and limits

| | A1: general academic alignment |
|---|---|
| Mode | A, the legacy academic alignment benchmark (`alignment-10`, no stage on, no recommendation field) |
| Dataset | `eval-1.1` (`server/lib/syllabuscheck/eval/dataset.json`): 41 items, 10 relationship types, 3 courses (calculus 25 items, programming 12, nursing 4). It has no held-out split, and none of its items matches one of the 42 held-out items by id, by source and target pair, or by target text. |
| Model and settings | `claude-sonnet-5-5`, adaptive thinking, effort high, max_tokens 16,000, timeout 180 s, 2 adapter retries, prompt cache |
| Runs | 2 |
| Requests without retries | 10 (5 batches per run, at most 12 relationships each) |
| Request limit, retries included | 25 |
| Cost cap (guard accounting) | $1.00 |
| Cap over the spend register | $1.302853: the register's $0.3028532 plus $1.00, rounded down |
| Validation stop | the 3rd answer that fails validation |

The evaluation's guard handled every request. Before sending, it checked the request against the request limit, the cost cap and the register cap, and reserved the request's worst case. When the answer came back, it settled the charge at the tokens Anthropic reported. Retries count toward every limit.

## 2. Pre-flight checks (before any paid request)

1. **The workspace and its spend limit:** one unbilled model lookup (HTTP 200) showed that the key authenticates and resolves to the same workspace as P1 and the pilot. You confirmed the $10 limit in the Anthropic Console. The workspace id is not recorded in this repository.
2. **Credits:** you confirmed that the remaining credits cover $1.00. The API cannot read the balance.
3. **The model:** the lookup returned `claude-sonnet-5-5` ("Claude Sonnet 5.5"). The harness allows no other model for evaluation and stops if an answer comes from one.
4. **The guard:** 37 of 37 guard, harness and quality-metric tests pass offline. The spend register held $0.3028532 of its $10 cap, with no stale lock.
5. **The planner:** `--plan` with the exact flags printed the caps with no warning. It planned 10 requests, with a worst case of $0.2182 per request on average and $0.2236 at most. The expected cost was $0.21–0.80, an estimate, not a limit.
6. **The request count:** 10 planned. The limit of 25 is the preparation plan's A1 budget, retries included.
7. **No effect on official scores:** the run is marked evaluation-only, and the stage switches live only in the script's own environment object. The application's approval switch is unset, and the server's official check reports `configured: false`. Both were checked again after A1.
8. **Historical files:** the A1 output files did not exist, and the harness refuses to overwrite an existing result. A hash snapshot of 649 files was taken before the run and compared after it (section 10).

**Keyword traps were fixed in advance.** Before the run, a script listed the clear not-aligned items whose source and target share a content word. It found 6, saved with the dataset's hash, so the false-approval check on them was not chosen after seeing the answers.

**Key scan.** The console output was saved to a scratch log. Before display, the log and every file the run wrote were scanned for the key, its last 12 characters and its body. None appeared.

## 3. Results

| # | Measure | A1 |
|---|---|---|
| 1 | Academic cases | 41 items: CLO-PO 10, ILO-assessment 5, ILO-CLO 4, ILO-activity 4, ILO-content 4, Description-plan 4, Module-value 3, REF-plan 3, CLO-EGA 2, CLO-anyPO 2 |
| 2 | Evaluated relationships | 82 (41 items × 2 runs); 82 verified, 0 unresolved; completion `complete` |
| | Labels given | ALIGNED 31, PARTIALLY_ALIGNED 28, NOT_ALIGNED 23, INSUFFICIENT_EVIDENCE 0 |
| 3 | Strict agreement | 97.7%: 43 of 44 answers on single-verdict items |
| 4 | Permissive agreement | 98.8%: 81 of 82 |
| 5 | False approvals | 0 of 44 answers on clear not-aligned items (0 of 12 on the 6 keyword traps) |
| | False rejections | 1 of 28 answers on clear-ALIGNED items: `clo-po-prog-interdisciplinary`, run 1, PARTIALLY_ALIGNED |
| 6 | Evidence validation | Final answers: 164 of 164 quote sides verbatim in their own text. The validator and an independent check agree. 1 of 83 returned judgements was refused for its quote. |
| 7 | Bloom | 0 of 13 ALIGNED answers break the level rule. 0 of 22 repeated statements got different levels. 0 of 41 items changed level between runs. 0 answers refused for an invalid level. |
| 8 | Run-to-run consistency | The same label on 39 of 41 items (95.1%); the same Bloom levels on 41 of 41 |
| 9 | Failed first answers, recovery | 1 of 11 answers and 1 of 82 relationships (1.2%) refused at the first attempt; recovered by 1 re-ask; 0 unresolved |
| 10 | Requests and retries | 11 of the 25 allowed (10 batches plus 1 re-ask). All HTTP 200 with `end_turn`; 0 adapter retries, 0 timeouts, 0 transient errors. |
| 11 | Tokens | input 10,019; cache write 3,728; cache read 37,280; output 16,349. Thinking 0, reported explicitly on 11 of 11 requests (0 thinking blocks). |
| 12 | Latency | median 12.9 s, p90 14.6 s, max 15.2 s. By relationships per request: 12 took 12.9–15.2 s, 4 took 5.6–5.8 s, 1 took 2.2–3.1 s. |
| 13 | Cost | Estimate at published prices $0.196576; guard charge $0.200304; the conservative rule would have charged $0.320163. That is $0.0024 per verified relationship. |
| 14 | Remaining budget | A1 left $0.7997 of its $1.00 unused, which does not carry over. The register holds $0.5031572 of $10, leaving $9.4968428. |
| 15 | Comparison with MiniMax | Section 6 |
| 16 | Recommendation on A2 | Section 9 |

**Model and format.** Every answer came from `claude-sonnet-5-5` (11 of 11). All 11 answers are valid JSON, and re-running the validator on the saved answers gives the same verdicts.

## 4. Academic review

All 82 explanations and all 51 draft texts were read.

### Keyword overlap and false approvals

None of the 6 keyword traps was approved: all 12 answers were PARTIALLY_ALIGNED or NOT_ALIGNED.

| Trap | Shared word | Answers |
|---|---|---|
| `clo-po-prog-two-skills` | design, solution | PARTIALLY_ALIGNED, PARTIALLY_ALIGNED |
| `ilo-clo-claims-more` | limits | PARTIALLY_ALIGNED, PARTIALLY_ALIGNED |
| `ilo-activity-calc-passive` | derivative | PARTIALLY_ALIGNED, PARTIALLY_ALIGNED |
| `ilo-assess-prog-mcq-for-design` | database | NOT_ALIGNED, NOT_ALIGNED |
| `ilo-assess-nurs-knowledge-for-skill` | hand hygiene | PARTIALLY_ALIGNED, PARTIALLY_ALIGNED |
| `desc-calc-too-narrow` | limits, continuity | PARTIALLY_ALIGNED, PARTIALLY_ALIGNED |

The explanations name the shared word and still withhold ALIGNED:
- "The CLO shares only the topic word calculus."
- "The subject is right, but the product is a written answer, not an observed performance."
- "The subject (limits) is the same, but the ILO claims more than the CLO."

Across all 22 clear not-aligned items, 0 of 44 answers were ALIGNED. The cooking-with-herbs reference, which MiniMax once approved under `alignment-9`, was NOT_ALIGNED in both runs.

### Reasoning

- Every explanation names concrete evidence: the verb and its level, the object, the audience or the missing skill. Every explanation agrees with its label, and the advisory answer review flagged none.
- The one disagreement is on the item the dataset already disputes, `clo-po-prog-interdisciplinary`. Its diagnosis reads "disputed - awaiting faculty" and proposes accepting ALIGNED or PARTIALLY_ALIGNED.
  - Run 1 answered PARTIALLY_ALIGNED: the CLO covers one software system's users, not organizations and society.
  - Run 2 answered ALIGNED.
  - MiniMax answered PARTIALLY_ALIGNED in 3 of 3 runs.
- **Insufficient evidence was never used** (0 of 82). The dataset has no missing or unreadable text, so this handling is untested here. On bare texts ("Quiz", "Chain rule.") the model answered PARTIALLY_ALIGNED, as the prompt intends.

### Bloom classification

- **Consistency:** 0 rule breaks, 0 statements at different levels, 0 changes between runs. In B1, by contrast, course-description levels alternated between N/A and Apply.
- **Caveat: some levels are inferred.** Texts without a verb get inferred levels:
  - "Competent Professional": Apply.
  - "Critical and Creative thinker": Analyze.
  - "Chain rule.": Remember.
  - "Listen to a lecture on derivative rules.": Remember.
  - "Quiz": N/A.

  No dataset states a Bloom level, so these figures show consistency, not correctness.

### Recommendations (mode A gives drafts only)

The harness derived these remedies from each answer's label and draft:
- NO_CHANGE 31, REWRITE_TEXT 49, REVIEW_REQUIRED 2.
- The 2 REVIEW_REQUIRED answers are the herbs reference, which is a type that cannot be rewritten; its text advises replacing it.
- 71 of 72 match the provisional expectation.
- The harness counts 1 unsupported recommendation: the run-1 rewrite of the disputed clear-ALIGNED item.

Reading the drafts found four patterns that the harness does not count:

| Pattern | Answers | What happened |
|---|---|---|
| A sound CLO rewritten toward a mis-mapped PO | `clo-po-calc-unrelated`, both runs | "Evaluate limits of rational functions" (Differential Calculus) was mapped to "Communicate effectively with a range of audiences". The draft became "Communicate the evaluation of limits of rational functions effectively to a range of audiences…". A re-tag would keep the CLO, but mode A cannot propose one. P1 and A3 showed the same thing. |
| A low-level CLO raised to the PO's design level | `clo-po-calc-lower-level`, both runs | "Define the derivative of a function" became "Design solutions to engineering problems … by applying derivatives …", which takes it from Remember to Create. Faculty should decide between raising the CLO and mapping it to a lower-level PO. |
| A replacement that duplicates the course's existing CLO | `clo-anypo-none`, both runs; `clo-po-nurs-unrelated`, run 2 | The off-subject CLO would be replaced by a verbatim copy of the course's own listed CLO, giving the syllabus a duplicate. Removing the off-subject CLO is the better remedy, and mode A cannot express it. |
| The draft changes the module's value | `value-calc-unconnected`, run 2 | The module names Missionary Spirit, but the draft is written for Compassion. Run 1 kept Missionary Spirit. |

The other drafts are specific and grounded in the source:
- The hand-hygiene written exam becomes an observed return demonstration with a checklist.
- The multiple-choice quiz for a design ILO becomes the schema project.
- The generic course description names the plan's topics.
- The passive lecture gains a design task.

### CLO rewrite versus PO re-tag

Of the 51 answers with a draft, 19 rewrite a failing CLO-PO, CLO-EGA or ILO-CLO. In 15 of the 19, the draft brings in two or more content words from the PO, EGA or CLO that the item maps to. By hand:

| The draft… | Answers | Items |
|---|---|---|
| fits, because the statement is off-subject or weak in itself | 10 | `clo-po-calc-vague`, `clo-po-nurs-unrelated`, `clo-ega-unrelated`, `ilo-clo-unrelated` and `clo-po-prog-lower-level` ("List the keywords" in a year-2 course), × 2 each |
| adds the PO's missing part to a partly aligned CLO | 3 | `clo-po-prog-two-skills` × 2, `clo-po-prog-interdisciplinary` run 1 |
| lowers an ILO that claims more than its CLO | 2 | `ilo-clo-claims-more` × 2 |
| pushes a sound CLO toward the PO | 4 | `clo-po-calc-unrelated` × 2; arguably `clo-po-calc-lower-level` × 2 |

**A gap in the harness.** Its mapping-remedy measure found no remap candidates in A1. Its rule keys on a `category` field that `dataset.json` does not have. A1's three remap candidates were therefore reviewed by hand, above:
- `clo-po-calc-unrelated`
- `clo-po-nurs-unrelated`
- `clo-ega-unrelated`

All 58 alignment development items carry categories, so A2 would measure its 8 candidates automatically.

## 5. Validation reliability

**First attempts, kept separate from final answers.**
- **At first attempt:** the 82 relationships were asked in 10 batches, and 81 verified. The one refusal was `clo-po-nurs-unrelated`, run 1, its target quote not found in the text.
- **Final:** 82 of 82 verified. The refused relationship verified as NOT_ALIGNED on its first re-ask, request 6.
- **Validation stop:** with 1 invalid answer, the stop at the 3rd was never close.

**Quotation paraphrases across P2.** Of 159 judgements returned in A3, B1 and A1, 3 were refused for their quote (A3: 0 of 18; B1: 2 of 58; A1: 1 of 83).

| Run | Item and side | Quoted | The text says |
|---|---|---|---|
| B1, runs 1 and 2 | `cc-sensors-real3`, source | "development of signal conversion circuits" | "developing signal conversion circuits" |
| A1, run 1 | `clo-po-nurs-unrelated`, target | "Compute the derivative of polynomials functions." | "Compute the derivative of polynomial functions." |

- **What changed:** each refusal changes the form of one word: a gerund made into a noun, or a plural "s" added. None invents content, quotes the other side, or swaps the sides.
- **Recurrence:** B1's change repeated on the same item in both runs. A1's appeared in one run only.
- **Outcome:** the validator caught each one, and one re-ask fixed each. None reached a final answer. A1's re-ask cost about $0.004.
- **What was not changed:** evidence validation, the expectations and the prompts. At 1–3% of judgements, a strict check followed by a re-ask works as intended.

## 6. Comparison with the MiniMax baseline on record

| | MiniMax M3.1 Flash, `alignment-10` (2026-10-23) | Claude Sonnet 5.5, A1 |
|---|---|---|
| Provider | OpenRouter | Anthropic direct API |
| Dataset version | `eval-1` | `eval-1.1` |
| Runs; relationships | 3; 123 | 2; 82 |
| Verified | 119; 4 never verified, all REF-plan | 82 |
| Agreement | 97.5% | 98.8% |
| False rejections (`falsePositiveRate`) | 7.5%: 3 of 40 | 3.6%: 1 of 28 |
| False approvals (`falseNegativeRate`) | 0%: 0 of 66 | 0%: 0 of 44 |
| Stability across runs | 94.9% | 95.1% |
| Disagreements | `clo-po-prog-interdisciplinary`, PARTIALLY_ALIGNED in 3 of 3 runs | the same item: PARTIALLY_ALIGNED, then ALIGNED |
| REF-plan | 5 of 5 verified answers agree; 4 of 9 never verified | 6 of 6 verified and agree |

The MiniMax figures are from `docs/ai-eval-baseline-prompt10.json` and are unchanged. Methodological differences:

1. **Model and provider differ.** Claude was asked with adaptive thinking at high effort, but it used no thinking.
2. **Run counts differ** (3 against 2). One answer moves Claude's rates by 1.2 points and MiniMax's by 0.8. Stability over 3 runs also has more chances to change.
3. **Dataset version.** The `eval-1.1` change log says the change was metadata only and no expected verdict changed, so both runs are scored against the same accepted verdicts.
4. **Prompt and checker.** Both carry the version label `alignment-10`. However, the MiniMax run kept no copy or hash of its wording, and the checker's validation and retry code has changed since. Identical wording and validation cannot be confirmed.
5. **Scoring.** Both runs use the same `metrics.js` fields. Strict agreement and the Bloom, quote and recommendation measures did not exist for the MiniMax run. Its per-item labels were not kept, only its disagreements, so the two cannot be compared label by label.
6. **Invalid answers.** MiniMax's "invalid 4" counts relationships still unverified after the app's retries: 119 answered plus 4 makes 123. Its first-attempt refusals were not recorded. The docs describe that figure two ways: as raw invalid answers (`ai-eval-diagnosis.md`) and as never-verified answers (`ai-alignment-accuracy.md`). The file's counts fit the second.
7. **Batch size.** Today's code uses 12 for both models. The MiniMax file does not record its batch size.

**Conclusion.** Against the same accepted verdicts, Claude's A1 results equal or exceed the MiniMax baseline on every recorded measure, and both disagree only on the item the dataset already disputes. The differences are one or two answers, within what one more run could change. The exception is REF-plan verification (4 of 9 never verified against 0 of 6), and there the validation code and run counts differ as well as the model. **This is not evidence of a model-quality improvement.**

## 7. Budget

| | Requests | Estimate (published prices) | Guard charge | Cap |
|---|---|---|---|---|
| A1 | 11 | $0.196576 | $0.200304 | $1.00 |

- **The spend register:**

  | Run | Guard charge |
  |---|---|
  | P1 | $0.019372 |
  | A3 | $0.06535 |
  | B1 | $0.2181312 |
  | A1 | $0.200304 |
  | **Total** | **$0.5031572 of $10** |

  $9.4968428 remains.
- **Unused A1 budget:** $0.7997, which does not carry over. Not yet run from the core P2 plan: A2 (cap $1.40) and B2 (cap $1.90).
- **A2 projection** (an estimate, not a limit): 58 items × 2 runs = 116 relationships in 18 requests, about 6–7 per request. Measured cost per verified relationship was $0.0024 in A1 (batches of 12) and $0.0035 in A3 (batches of 3). That puts A2 at about $0.30–0.45 plus any re-asks. The planned $1.40 cap is ample. A cap must stay above the expected spend plus one worst-case reservation, about $0.22.

## 8. Defects and limitations

1. **Mode A forces a rewrite on a sound but mis-mapped CLO** (`clo-po-calc-unrelated`, 2 answers). This is structural: the legacy contract has no re-tag option. It is the remedy the application uses today, because Stage A is off. P1, A3 and A1 all show it.
2. **Some replacement drafts are not usable as given.**
   - 3 answers duplicate the course's existing CLO.
   - 1 answer swaps the module's institutional value.

   The advisory review flags neither.
3. **Single-word quote changes recur:** 3 across P2. Each was caught and recovered, and validation was not weakened.
4. **The harness's remap measure skips `dataset.json`** because that file has no categories. A1 was reviewed by hand; A2 is unaffected.
5. **No thinking:** Sonnet 5.5 used no thinking in any of the 36 Claude requests so far (P1 1, A3 6, B1 18, A1 11). These results measure it at high effort without extended reasoning.
6. **A small, narrow dataset:**
   - 41 items over 3 courses, mostly calculus.
   - 2 CLO-EGA items, neither clear-ALIGNED.
   - No missing-text item.
   - Developer-written and unreviewed, with one item disputed.

   Zero false approvals on 22 clear not-aligned items still allows a true rate up to about 14% (95% bound, rule of three; the two runs of an item are not independent).
7. **Bloom levels have no ground truth.** Levels for texts without a verb are inferred.
8. **Latency rose with batch size:** 12 relationships per request against 3–4 in the pilot, a median of 12.9 s per request.

## 9. Recommendation on A2

**Proceed with A2 when you authorize it.** It is not authorized now. Keep the same settings:
- `--dataset alignment --split dev --legacy`, 2 runs.
- A request budget of 40.
- A cost cap of $1.40, or lower, for example $1.00.
- `--total-cap` set to the register total plus that cap.
- `--max-invalid 3`.

Reasons:
- **A1 was clean.** No model drift, no stop, 1 refused first answer recovered, 0 false approvals, and 20% of its cap spent.
- **A2 is broader.** It has 58 items over 7 courses, including education, accounting and hospitality management, and it is the legacy half of the paired A2 ↔ B2 comparison.
- **A2 tests rewrite versus re-tag automatically.** It measures 8 remap candidates and 8 level-gap items: the rewrite-or-re-tag question in legacy mode.
- **A2 checks A1's consistency.** It re-tests 16 of A1's items verbatim (the same ids, texts and accepted verdicts) in different batches.

To watch:
- **The validation stop at 3.** A1 had 1 invalid answer in 11 requests and B1 had 2 in 18. A2 sends about 18–20, so a third invalid answer could stop it early. The stop is safe: completed answers are kept. You asked to keep the threshold at 3, and I would keep it.
- **No production change is recommended.**

## 10. Files and integrity

- **New:**
  - `docs/ai-eval-anthropic/p2-a1-result.json`
  - `docs/ai-eval-anthropic/p2-a1-ledger.json`
  - this report
- **Changed by the harness:** `docs/ai-eval-anthropic/spend-register.json`.
- **Unchanged** (hash snapshots before and after A1):
  - every other file under `docs/`, `server/lib/` (including the datasets and the 47-rule standard with its pass mark of 79), `server/routes/`, `server/db/`, `scripts/`, `src/` and `tests/`;
  - the MiniMax results;
  - the P1, A3 and B1 files;
  - the faculty review data;
  - `server/.env` (its hash prefix);
  - HEAD `68926cb` and the tracked diff.
- **Repository state:** nothing is staged or committed. The register lock was released, and no held-out log exists.
- **Production lock:** the approval switch is unset, and the official check reports `configured: false`.
