# Stage E.8: controlled recovery after the empty provider response

> **Update (2026-10-26, post-recovery review):** an offline re-verification from the raw model content confirmed **12/12 exact quotations** (6 source, 6 target), each stored exactly as returned, and refused 24/24 deliberately altered quotations. The quotation count was never 9: that figure is the adjacent field-agreement row (9/9 compared fields). Two wordings in section 6 are clarified accordingly; no data changed. Under the `resources-3` reviewer the Sensors draft now carries advisory `conditional_resource` and `proposed_resource` notes and is still not withheld. See the [post-recovery review](stage-e8-post-recovery-review.md).

Executed once on 2026-10-26 (10:27–10:31 UTC), after the retry guard had been proved offline. **The run completed: all six planned relationships were attempted and verified, every quotation is exact, and the six labels fall within the provisional accepted labels.** The first model answer was again an empty judgements list from the endpoint ModelRun. It was refused as invalid and received exactly one corrective retry, which the same endpoint answered in full. The reviewer withheld the one unsupported draft and kept its finding. No unsupported recommendation was released. One conditional recommendation was released without the advisory note the resource policy calls for: this is a reviewer detection gap, described in section 5. Nothing further was run; the work is stopped for review.

The provisional labels are developer-authored and unreviewed by faculty. Agreement with them is not agreement with faculty.

## Evidence

- [Raw result](ai-eval-stage-e8-c-resource-recovery.json) and the [last batch checkpoint snapshot](ai-eval-stage-e8-c-resource-recovery.json.progress.json).
- [Cumulative ledger](ai-eval-stage-e8-c-ledger.json), with its [byte snapshot taken before this run](ai-eval-stage-e8-c-ledger-before-resource-recovery.json).
- Logs in `tmp/`:
  - `stage-e8-resource-recovery-dryrun.log`: the offline proof.
  - `-plan.log`: the free plan.
  - `-preflight-tests.log`: offline checker tests.
  - `-run.log`: the run console, with each batch review and decision.
  - `-preservation.json`: 168 SHA-256 hashes taken before the run.
- Earlier history, unchanged: the [stopped regression](stage-e8-resource-regression.md), its [result](ai-eval-stage-e8-c-resource-regression.json) and the [fix report](stage-e8-resource-grounding-fix.md).

## 1. Offline proof of the retry guard (before any paid call)

The ledger carried `invalid` 1 and `unproductive` 1 from request 19.

- **Guard** (`eval/providerGuard.js`):
  - `noteInvalid` adds one and stops at `invalid >= maxInvalid`.
  - `noteAnswer` adds one to `unproductive` for an answer that verified nothing, resets it otherwise, and stops at `unproductive >= maxUnproductive`.
  - The runner calls `noteAnswer` once per answer, before the retry is requested, and passes no `check` hook. A stop refuses the next request locally.
- **Retry policy** (`gemini.js` `judgeStaged`):
  - An empty list is refused as `empty_answer` for every relationship in the batch.
  - The batch is asked once more with a correction for each relationship.
  - The same problem after its correction ends the relationships as `repeated_coverage_error`.
  - Timeouts and provider errors are never retried there.

**Level 1, the guard alone**, on copies of the ledger with an empty answer next:

| `--max-invalid` / `--max-unproductive` | Counters after the empty answer | Corrective retry |
|---|---|---|
| 2 / 2 | 2 / 2, stop at `invalid` | Refused locally |
| 3 / 2 | 2 / 2, stop at `unproductive` | Refused locally |
| 2 / 3 | 2 / 2, stop at `invalid` | Refused locally |
| **3 / 3** | 2 / 2, no stop | Sent. A valid retry resets `unproductive` to 0. A second empty answer brings both counters to 3 and stops the run. |

**Level 2, the planned command end to end.** The runner, `judgeStaged`, validation, the resource reviewer and the batch checkpoint all ran as real code. Only `fetch` was replaced, by a fake OpenRouter that answers with the saved r8 judgments. Each scenario ran on its own ledger copy, with placeholder keys:

| Scenario | Fake replies | Model requests | Outcome | Ledger copy |
|---|---|---|---|---|
| A, 2/2 | empty | 1 | Stopped; retry refused locally; 2 relationships never attempted | 22 requests, invalid 2 |
| B, 3/3 | empty, valid, valid, valid | 4 | One retry carrying corrections `empty_answer` for the same 4 IDs; 6/6 verified; complete | 25, invalid 2, unproductive 0 |
| C, 3/3 | empty, empty | 2 | Retry sent once; 4 × `repeated_coverage_error`; stop; no third request | 23, invalid 3 |
| D, 3/3 | valid × 3 | 3 | Complete | 24, invalid 1 |
| E, 3/3 | empty, valid, valid, empty | 4 | The second empty answer (batch 3) stops the run with no retry | 25, invalid 3 |

Results across all five scenarios:
- Every request body had temperature 0, `max_tokens` 8192, a strict `json_schema` without `minItems`, and `provider.require_parameters: true`.
- The fake key label never appeared in any output.
- The real ledger was byte-identical before and after.

**Conclusions:**
- **`--max-invalid 3 --max-unproductive 3 --warn-invalid 2` is the smallest safe setting.** It lets one more empty answer get its one corrective retry, and allows at most one corrective retry in the whole run.
- **The earlier report's option A (`--max-invalid 2 --max-unproductive 2`) was wrong.** Scenario A shows it would have stopped on the first empty answer again, with no retry. A correction note has been added to that report.
- The production guard was not changed.

The dry run also found that the runner keeps waiting on stdin after its last checkpoint. The driver therefore closes stdin once the result is written.

## 2. Authorization, preflight and command

| Check | Result |
|---|---|
| Not already run | No recovery output or progress file existed. Ledger at 19 requests / $0.00733556, transient 1, invalid 1, unproductive 1, open; last entry n=19 (09:49:07 UTC) |
| Ledger snapshot | `docs/ai-eval-stage-e8-c-ledger-before-resource-recovery.json`, byte-identical when taken |
| Code since the last full suite | 164 of the 165 hashes recorded before the regression are unchanged. The one change is the execution notice in the fix report, a document. The code is byte-identical to the build that passed 1,385 tests. |
| Offline checker tests, network blocked | 602 of 603 passed. The failure is `stage-e8-resource-grounding.test.js:121`, which asserts that the **live** ledger holds 16 requests. The authorized regression made it 19, and the ledger now holds 25. This is a stale data assertion, not a code defect. It was left unchanged; section 8 proposes a fix. |
| Free plan (no HTTP) | 6 items, 3 batches, `alignment-12c1c2-r8`, C1/C2 only, trim and `minItems` off, 90 s, budget 27, $0.03733556, invalid warn 2 / stop 3 |
| Configuration (no HTTP, no key shown) | OpenRouter `minimax/minimax-m3.1-flash`, batch size 4; key present, read by the runner from `server/.env` |
| Preservation baseline | 168 SHA-256 hashes: checker, compliance and scoring code, `server/.env`, the dataset, the runner, all `docs/ai-eval-*.json` results (the stopped regression included) and the E.8 reports |

The command was the planned one, with `--confirm-paid --check-key` added:

```text
node scripts/eval-alignment.cjs --confirm-paid --check-key --dataset stage-c --runs 1
  --ids af-prog1-single-format,af-prog1-passive,af-prog1-alternatives,af-prog1-conceptual-lecture-ok,af-sensors-passive,as-prog1-recall-quiz
  --budget 27 --max-cost 0.03733556 --accounting reconcile --max-transient 3 --max-invalid 3 --max-unproductive 3 --warn-invalid 2
  --max-unresolved 0.2 --min-sample 4 --ledger docs/ai-eval-stage-e8-c-ledger.json --out docs/ai-eval-stage-e8-c-resource-recovery.json --review-between-batches
```

The child-process environment set:
- OpenRouter and `minimax/minimax-m3.1-flash`;
- stages A, B, B3, B4, D1 and D2 off, and C1 and C2 on;
- trim off, prompt variant `current`, `minItems` off, and a 90-second timeout.

`NODE_OPTIONS` was removed, so no offline blocker or fake provider was loaded. `server/.env`, the shell environment, the prompt, the schema, provider routing and the dataset labels were not changed. The guard checked the request cap and the cost cap before every request.

## 3. What happened

| Request | Purpose | Endpoint | Outcome | Tokens (prompt / cached / completion) | Charged |
|---|---|---|---|---|---:|
| 20 | Key check | — | HTTP 200, accepted; expires 2026-11-25 | — | $0 |
| 21 | Price lookup | — | Highest of 12 endpoints: $0.30/M input, $1.20/M output, $0 per request | — | $0 |
| 22 | Batch 1, first attempt (passive, single-format, alternatives, recall-quiz) | **ModelRun** | HTTP 200, 1,785 ms, `finish_reason: stop`, reply `{"judgements":[]}` | 4,387 / 4,352 / 6 | $0.00007413 |
| 23 | Batch 1, corrective retry, same 4 IDs | **ModelRun** | HTTP 200, 1,095 ms, `stop`; 4 judgments, all verified | 4,569 / 4,352 / 834 | $0.00059823 |
| 24 | Batch 2 (conceptual-lecture-ok) | DigitalOcean | HTTP 200, 2,248 ms, `stop`; verified | 4,044 / 384 / 188 | $0.00066756 |
| 25 | Batch 3 (sensors-passive) | Wafer | HTTP 200, 943 ms, `stop`; verified | 4,044 / 128 / 423 | $0.00084312 |

There were no reasoning tokens and no transient errors. All four model charges were reconciled at the reported cost; the conservative comparison is $0.0068544. Batch reviews were held after batches 1, 2 and 3, and each decision was `continue`.

## 4. Empty response and corrective retry

- **Response structure:** HTTP 200, `finish_reason: stop`, `message.content` exactly `{"judgements":[]}` (6 completion tokens). It is schema-valid because `minItems` is off.
- **Validation:** all four relationships were refused as `empty_answer` ("not answered: the judgements list is empty"). It counted as one invalid answer: the ledger counter went to 2, the run warned at 2 and did not stop. No verdict, quotation or draft came from it.
- **Retry:**
  - One request for the same four relationships, carrying a correction for each: "The refused answer had an empty judgements list: return exactly one judgement for this id, as for every id in document_data." The live body was not logged. The offline trace showed the same corrections on this code path, and the prompt grew by 182 tokens.
  - It verified all four, so `unproductive` reset to 0.
  - It was the only retry in the run. Any further invalid answer would have stopped the run without a retry (scenario E).
- **The endpoint:**
  - ModelRun has now returned an empty list twice, to the identical first-attempt body for batch 1 (requests 19 and 22, about 38 minutes apart). It answered correctly once the correction changed the body.
  - At temperature 0 this looks repeatable for that endpoint and request, not a one-off glitch. Two observations are not a measured rate.
  - This ledger holds 14 model requests. The only empty ones are ModelRun's two first attempts. The other 12 were non-empty: Wafer 3, InferenceNet 4, Nebius 2, Together 1, DigitalOcean 1, and ModelRun's corrective retry.

## 5. Academic review

### Judgments, fields and quotations

All 12 quotations are exact substrings of their texts, and `evidenceMatching` is `exact` for every one.

| Case | Label (accepted) | Fields vs expectation | Source quote | Target quote |
|---|---|---|---|---|
| af-prog1-passive | NOT_ALIGNED (PARTIAL/NOT) | teaching weak ✓ | "Develop and test Java programs that use if-else and switch statements to make decisions." | "Lecture on Java conditional statements using slides; students listen and copy the syntax." |
| af-prog1-single-format | PARTIALLY_ALIGNED (PARTIAL) | teaching sound ✓, learnerSupport limited ✓ | same ILO sentence | "Individual timed coding test in which students write if-else programs from memory." |
| af-prog1-alternatives | ALIGNED (ALIGNED) | teaching sound ✓, learnerSupport adequate ✓ | same ILO sentence | "Guided demonstration of if-else and switch in Java, then pair programming in the laboratory" |
| as-prog1-recall-quiz | NOT_ALIGNED (PARTIAL/NOT) | measures no ✓, level too_low ✓ (evidence observable) | same ILO sentence | "Ten-item multiple-choice quiz on Java conditional syntax." |
| af-prog1-conceptual-lecture-ok | ALIGNED (ALIGNED) | teaching sound ✓ | "Explain the difference between if-else and switch statements." | "Lecture-discussion with worked examples, followed by a short class discussion of when each statement is used." |
| af-sensors-passive | PARTIALLY_ALIGNED (PARTIAL/NOT) | teaching weak ✓ | "Design and test an inverting amplifier with a specified gain." | "- Lecture on operational amplifiers." |

**Results**
- **Labels:** 6/6 within the provisional accepted labels. 4 PARTIAL/NOT-flagged cases were flagged and 2 ALIGNED cases were judged ALIGNED, so there were no false positives or false negatives against the provisional labels.
- **Fields:** all 9 compared fields agree: teaching 5, learnerSupport 2, measures 1, level 1. The dataset sets no expectation for `evidence`.
- **single-format teaching field:** it now agrees (`sound`). The saved r8 answer had `weak`, the disagreement recorded in the fix report.

**Compared with the saved r8 answers**
- Five labels are unchanged.
- `af-sensors-passive` moved from NOT_ALIGNED (InferenceNet) to PARTIALLY_ALIGNED (Wafer). Both are accepted, but the case is borderline. The explanation calls the lecture "a suitable conceptual support" for the theory. Meanwhile the analogous `af-prog1-passive` lecture case was judged NOT_ALIGNED because "nothing in the activities develops the skill". A faculty reviewer should decide whether a lecture-only practical ILO is NOT or PARTIAL. The provisional dataset accepts both.

**Explanation notes**
- **single-format:** "no opportunity to test or debug programs" and "the 'test' half of the ILO ... is not practised" are inferences. The activity text neither states nor excludes testing, so this is a mild overstatement. It is the same academic-review item as before; the label and fields are right.
- **sensors:** "the student must construct the circuit" is an inference from "design and test". Its quotation of the contact units ("lecture 3, laboratory 0") is exact and correctly used.
- **conceptual-lecture-ok:** this Activity-fit answer also filled two assessment-only fields (`evidence` observable, `level` matches). Validation accepted them. The runner's field accounting ignores them for Activity-fit, and no contradiction was counted. This is a minor structured-output observation, not an academic error.

### Drafts: generated, withheld and released

| Case | Draft | Reviewer | Academic review |
|---|---|---|---|
| af-prog1-passive | Generated: keep the slide lecture, explaining "if, if-else, nested if and switch", and add a guided coding exercise in which each student writes, runs, tests and revises a short program | No note → released | Grounded. The terms come from the week's content, running programs is part of the ILO, the syllabus states laboratory 1, and no material is assumed. **Faculty-usable.** Unlike the saved r8 draft, which assumed a laboratory and was withheld, this one does not. |
| af-prog1-single-format | Generated: an untimed exercise to write, run and test if-else and switch programs, where "students may use the recorded demonstration and annotated code samples for review" | `assumes_resource` ("annotated code samples") and `copies_other_relationship` ("recorded demonstration and annotated code samples", from `af-prog1-alternatives`) → **withheld** | **Correctly withheld.** Those resources belong to another relationship's activity; neither the syllabus nor this activity provides them. The finding is preserved: label, explanation, quotations and fields are all unchanged. Not a false positive. Without the borrowed clause, the rest of the draft would be useful. |
| af-prog1-alternatives | None (ALIGNED) | — | — |
| as-prog1-recall-quiz | Generated: a practical task in which each student writes a decision program, runs it with several test inputs, and submits the source with the recorded outputs | No note → released | Grounded. The "recorded outputs" are the student's own program output, not a teaching resource, and laboratory work is stated by the syllabus. The task measures the Apply-level ILO. **Faculty-usable.** |
| af-prog1-conceptual-lecture-ok | None (ALIGNED) | — | It correctly does not demand hands-on work for a conceptual ILO. |
| af-sensors-passive | Generated, three lines: (1) keep the lecture; (2) a guided design exercise (choose resistor values for a specified gain and justify them); (3) a guided test exercise "using bench components and instrumentation if faculty-confirmed available; otherwise a paper-based design with analysis of given or simulated measured values" | **No note → released** | Supported but conditional. The explanation recognizes "laboratory 0", every equipment mention is explicitly conditional on faculty confirmation, and a fallback needing no equipment is given. The fallback depends on measured values the faculty supplies, which is a faculty-created resource. The weaker "simulated" option implies a simulation the syllabus does not mention. **Usable with care:** faculty must confirm equipment or supply the values, and analysing given values tests the design only indirectly. |

**Totals**
- Drafts generated: 4.
- Withheld: 1 (single-format, correctly).
- Released: 3 (passive, recall-quiz, sensors).
- Unsupported recommendations released: none.
- Possible false-positive withholding: none.

### The reviewer detection gap (af-sensors-passive)

Under `resources-2` a conditional resource is advisory: the draft is released with a `conditional_resource` warning. The sensors draft was released with no note at all, so the faculty-confirmation requirement is visible only in the draft text itself. Offline probes of `resourceNotes` on this case found two vocabulary gaps and one phrasing gap:

| Draft text probed | Reviewer result |
|---|---|
| The live draft | none |
| "using bench components and instrumentation" (no condition) | **none**: the equipment list lacks "bench components" and "instrumentation" |
| "analyse simulated measured values" | **none**: the software list matches "simulator", "simulation software" and "circuit simulat…", but not "simulated" |
| "with an oscilloscope if faculty-confirmed available" | **withheld** as `assumes_resource`: the conditional pattern misses "if faculty-confirmed available" |
| "with an oscilloscope if available" | advisory `conditional_resource` ✓ |
| "in the laboratory" / "in a circuit simulator" (no condition) | withheld ✓ |

**Judgment:** this is not a bypass of an unsupported recommendation. The released draft is conditional and offers a fallback, which is the policy's own advisory case, so no next-batch stop applied; it was also the last batch. But the first two probes show that the same words without a condition would also pass unflagged, and the fourth shows the hedge would have been treated as unconditional. The resource reviewer therefore needs a targeted offline fix before any recommendation from it reaches faculty (section 8).

## 6. Completion-report measures

| Measure | Result |
|---|---:|
| Relationships planned / attempted / verified | 6 / 6 / 6 (4 recovered by the retry; 0 unresolved; completion `complete`) |
| Model responses and endpoints | 22 ModelRun (empty), 23 ModelRun (retry, valid), 24 DigitalOcean, 25 Wafer |
| Empty responses / invalid answers | 1 / 1 (request 22) |
| Corrective retries sent / recovered | 1 / 4 of 4 relationships |
| Requests refused locally / transient errors | 0 / 0 |
| Provisional-label agreement | 6/6 (developer-authored, unreviewed labels) |
| Field agreement | 9/9 compared fields (teaching 5, learnerSupport 2, measures 1, level 1) |
| Exact quotations | 12/12 (6 source, 6 target; each a verbatim copy of its text) |
| Drafts generated / withheld / released | 4 / 1 / 3 |
| Unsupported reviewer bypasses | 0. One reviewer detection gap: a conditional draft released without its advisory note |
| Possible false-positive withholding | 0 |
| Faculty-usable recommendations | 2 directly (passive, recall-quiz), 1 with faculty confirmation (sensors) |
| HTTP requests this run | 6: key check 1, price lookup 1, model 4 (3 first attempts + 1 retry) |
| Tokens this run | 17,044 prompt (9,216 cached), 1,451 completion, 0 reasoning |
| Cost this run | **$0.00218304**, reported and reconciled (conservative comparison $0.0068544) |
| Cumulative ledger | **25 requests / $0.0095186** of 27 / $0.03733556 (conservative $0.0243375); transient 1, invalid 2, unproductive 0; open |
| Unused allowance | 2 requests / $0.02781696, not an authorization to run anything |

Academic judgment accuracy and recommendation quality are separate results:
- **Judgment accuracy:** all 6 labels and all 9 compared fields agree with the provisional expectations, and all 12 quotations are exact copies of their texts. Quotations are checked against the texts, not against the labels.
- **Recommendation quality:** mixed. Two drafts are directly usable and one needs faculty confirmation. One draft was correctly withheld. The reviewer has a demonstrated detection gap.

## 7. Preservation and integrity

**Ledger**
- The first 19 entries are identical to the byte snapshot, and entries 20–25 were appended with contiguous numbering.
- $0.00733556 + $0.00218304 = $0.0095186, and the conservative totals add up exactly. The result file agrees with the ledger, and both caps held.

**Files**
- All 168 protected hashes are unchanged after the run, including the stopped regression's result and both ledger snapshots.
- No key, 12-character key fragment or key label appears in the result, progress snapshot, ledgers, logs or hash files (15 files scanned).
- The 56 modified tracked files are the same as before the run.
- New files: this report, the result and its progress snapshot, the ledger snapshot, and the `tmp/stage-e8-resource-recovery-*` logs.
- The only edit to an existing file is the correction note in the regression report.

**What did not happen**
- No migration, and no change to `server/.env`, the prompt, the schema, D1/D2, scoring, the passing mark 79, readiness, gates, routing or the title policy.
- No Phase 3 work, commit, push, merge or deployment. The twelve unseen Stage C cases remain unattempted.

## 8. Findings for review (nothing scheduled)

1. **Resource reviewer gaps (recommended next, offline only).**
   - Add "bench" components, "instrumentation" and test-equipment phrases to the equipment list.
   - Add "simulated" / "simulation" to the software list.
   - Accept "if faculty-confirmed available" and "if confirmed by the faculty" as conditions.
   - Each needs regression tests, including the three probes above, so that an unhedged mention is withheld and a hedged one is advisory. This changes reviewer heuristics only, not the prompt, the schema or any score, but it needs your approval.
2. **The empty-list endpoint.** ModelRun twice returned `{"judgements":[]}` for the same request. The corrective retry handles it at one extra request (about $0.0001 for the empty answer). Remedies that need approval:
   - the E.6 optional `minItems`, which changes the prompt version to `-mi1`;
   - an evaluation-only provider exclusion.
   Neither was used here.
3. **Ledger counters.** The ledger now carries `invalid` 2. A later run on it with `--max-invalid 3` would stop at its first invalid answer with no retry. A later evaluation should either close this ledger and start a linked successor (`--previous-ledger`), or set thresholds by the same offline proof.
4. **Stale test assertion (Codex's file, left unchanged).** `stage-e8-resource-grounding.test.js:121` checks `historicalLedger.requests === 16` against the live ledger. Suggested fix: have the replay read the frozen `docs/ai-eval-stage-e8-c-ledger-before-resource-regression.json`, or assert at least 16.
5. **Academic review items for faculty.**
   - Is a lecture-only practical ILO NOT_ALIGNED or PARTIALLY_ALIGNED? This bears on the sensors-versus-passive consistency.
   - The single-format explanation infers that testing is excluded.
   - Whether drafts may rely on faculty-supplied data, as the sensors fallback does.
   - The provisional labels remain unreviewed by faculty.
