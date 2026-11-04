# Stage E.8: post-recovery integrity and reliability review

An offline review, 2026-10-26.
- **No provider call was made.** The ledger is unchanged at 25 requests / $0.0095186 (SHA-256 `fe656c72…`).
- There was no `.env` change, no migration and no change to a production record. Nothing was committed, pushed, merged or deployed.
- The twelve unseen Stage C cases were not evaluated, and Phase 3 was not started.

The work is stopped for approval.

| Priority | Result |
|---|---|
| 1. Recovery report | **12/12 exact quotations** (6 source, 6 target), each stored exactly as the model returned it. All 24 deliberately altered quotations were refused. The "9" is the field-agreement row (9/9 fields), not a quotation count. No mismatch, transcription error, reporting bug or validation defect was found. One loose sentence in the report was clarified. |
| 2. Resource grounding | Reviewer `resources-4` reads bench components, instrumentation, supplied data, faculty-confirmation conditions and draft-side negated resource lists in context. 17 of 18 saved drafts are unchanged. The live Sensors draft gains three advisory notes and is still released. All 8 withheld drafts stay withheld, and none is newly withheld. |
| 3. Stale ledger test | The replay read the live, growing ledger. It now reads the frozen post-r8 snapshot, the same bytes the first replay read. Cumulative accounting is tested separately. No ledger file was edited. |
| 4. ModelRun | **Keep A, the bounded corrective retry**, as the policy. B (`minItems`) and C (an endpoint restriction) are not recommended now. `eval-alignment.cjs` now records the already-fetched endpoint list (`prices.endpoints`, with `structuredOutputs`) in each evaluation result without changing routing or requests. |
| 5. Regression | **1,406 passed, 0 failed.** Both localization audits pass, the build passes and `git diff --check` is clean. Scoring, the passing mark 79, readiness, gates and prompt compatibility are unchanged. |

## 1. Recovery report: quotation verification

`stage-e8-recovery-quotations.test.js` (new) and `tmp/stage-e8-post-recovery-quotations.log` read the raw `message.content` of every request in the [recovery result](ai-eval-stage-e8-c-resource-recovery.json). Each quotation was checked three ways:
- it is a verbatim substring of the dataset text it quotes;
- the saved answer stores the identical string;
- `evidenceMatching` is `exact`.

| Request | Endpoint | Relationship | Source quotation | Target quotation |
|---|---|---|---|---|
| 22 | ModelRun | Empty list, refused as `empty_answer`; no quotation | — | — |
| 23 | ModelRun | af-prog1-passive | exact, 88 characters | exact, 89 |
| 23 | ModelRun | af-prog1-single-format | exact, 88 | exact, 82 |
| 23 | ModelRun | af-prog1-alternatives | exact, 88 | exact, 91 |
| 23 | ModelRun | as-prog1-recall-quiz | exact, 88 | exact, 57 |
| 24 | DigitalOcean | af-prog1-conceptual-lecture-ok | exact, 61 | exact, 109 |
| 25 | Wafer | af-sensors-passive | exact, 61 | exact, 36 |

**Result:** 12/12 exact, 0 mismatches.

**Negative controls.** Each quotation was altered two ways and resubmitted to the production validator (`gemini.validate`):
- one letter's case was flipped;
- the second-to-last character was dropped.

All 24 were refused with a `quote_*` code. The validator accepts an exact match, or a match that differs only in whitespace. Case and punctuation count, as E.6 #15 also tests. There is no bypass to fix.

**Where "9" comes from.** In the report's measures table, "Field agreement: 9/9 compared fields" sits directly above "Exact quotations: 12/12". The 9 fields are teaching 5, learnerSupport 2, measures 1 and level 1. No relationship ID has an expected/actual mismatch.

**Report edits.** No data changed, and a dated note now heads the [recovery report](stage-e8-resource-recovery.md):
- The two measures rows now break down their counts.
- The "Judgment accuracy" sentence said quotations "agree with the provisional labels". It now says quotations are checked against the texts, not against the labels.

No historical model response was altered.

## 2. Resource-grounding recognition (`resources-3` / `resources-4`)

### The gap

The recovery released the Sensors draft "…using bench components and instrumentation if faculty-confirmed available; otherwise a paper-based design with analysis of given or simulated measured values" with no note. `resources-2` had three gaps:
- it did not know "bench components" or "instrumentation";
- it did not read "simulated measured values" as data someone must supply;
- it did not recognize "if faculty-confirmed available" as a condition.

### What changed

All changes are in `server/lib/syllabuscheck/recommendationReview.js`, Codex's file. Only the reviewer heuristics changed.

- **Equipment.**
  - Bench components, equipment, instruments, instrumentation, power supplies and setups.
  - Test, testing, measuring, measurement, laboratory, lab, electronic and electrical equipment, instruments or instrumentation.
  - Laboratory power supplies.
  - Bare "instrumentation" counts only when it is the means of an activity ("using …", "with …") and the head noun. "An instrumentation amplifier", "the lecture explains instrumentation" and "assessment instruments" are therefore not equipment. This is a rule about context, not a blacklist of words.
- **Supplied data.** Data sets, sets of measured values, given or sample values, data provided by the instructor or faculty, and simulated measurement data all count as material someone must supply. How the draft introduces them decides the note:
  - "given …", or data the faculty provides or prepares: a proposal (advisory);
  - "analyse simulated measured values", origin not stated: needs confirmation (advisory);
  - "analyse the provided simulated measurement data" or "use simulated data": an assumption (withheld).
- **Conditions.**
  - Recognized: "if faculty-confirmed available", "if the faculty confirms…", "subject to faculty confirmation", "where … are available", "(if available)" and similar.
  - A condition placed after a list covers that list, including an Oxford-comma list, and nothing else.
  - A general condition (faculty confirmation) or a condition on a family of equipment covers its clause.
  - A condition about something else ("if they finish the design early") does not condition the resource.
- **Lesson evidence.**
  - Availability is read narrowly: only a statement about the resource itself establishes it.
  - Unavailability is read broadly: a statement about a family ("No bench components or measurement instruments are available") or about a list rules out every member.
  - Availability the lesson itself states only conditionally does not count as availability.
- **Explicit unavailability is never softened.** A resource the lesson says is unavailable is withheld even when the draft adds "if available" or a hedge.
- **Draft-side negation (`resources-4`).** A resource the draft rules out ("do not use breadboards or oscilloscopes", "without breadboards, multimeters, or oscilloscopes", "breadboards and oscilloscopes are not needed") is not proposed, across the strict list it governs (`listEnd`). Clause boundaries, bare commas and positive uses after a negation ("do not use breadboards, but use a multimeter") stay outside the negation scope, and double negatives ("cannot complete the test without an oscilloscope", "cannot complete the exercise without syntax notes") still require the resource.
- **No new note codes**, so no new interface text. The rules document regenerated from the code is byte-identical to `docs/ai-checker-rules.md`.
- **Version** `resources-2` → `resources-3` → `resources-4`. A cached judgment is re-reviewed locally when its version differs. That needs no provider call and changes neither the prompt nor the cache key, as the existing grounding test shows.

### The five categories

Examples use the Sensors lesson (lecture 3, laboratory 0). Each is pinned by `stage-e8-resource-recognition.test.js`.

| Category | Example draft | `resources-3` |
|---|---|---|
| 1. Existing resource supported by lesson evidence | Lesson: "Bench components, a dual-trace oscilloscope and a function generator are available." Draft: "…with the bench components and … the oscilloscope." | No note; released |
| 2. Unsupported claim that a resource exists | "…using bench components and instrumentation." · "…on the available bench equipment." · "…with test instruments in class." · "Students analyse the provided simulated measurement data." | `assumes_resource`; **withheld** |
| 3. Conditional proposal | "…using bench components and instrumentation if faculty-confirmed available." · "Subject to faculty confirmation, …" · "…with an oscilloscope (if available)." | `conditional_resource`, advisory; released with a warning |
| 4. Faculty-created or faculty-provided resource | "…analyse given measured values…" · "The instructor provides a set of measured values…" · "…given or simulated measured values." | `proposed_resource`, advisory; released with a warning |
| 5. Alternative that needs no confirmed equipment | "Students complete a paper-based design … and calculate the resistor values for the specified gain." | No note; released |
| Explicitly unavailable, even with a condition | Lesson: "No bench components or measurement instruments are available." Draft: "…bench components and instrumentation if faculty-confirmed available." | `assumes_resource`; **withheld** |

The reviewer runs after validation. It writes only `draftReview`, `draftWarnings`, `reviewEvidence` and `resourceReviewVersion`, so a warning or a withheld draft never changes a label, explanation, quotation, field, recommendation or score.

### Results

**Saved drafts.** There are 18 drafts across the E.8 Stage C results.
- 17 drafts are unchanged.
- One changed, recovery request 25 (`af-sensors-passive`). It had no note and now has three advisory notes:
  - `conditional_resource` [bench components];
  - `conditional_resource` [instrumentation];
  - `proposed_resource` [given or simulated measured values].

  It is **still released**.
- All 8 drafts withheld before stay withheld, and none is newly withheld. The 8 are:
  - canary-resume n4 irrelevant, n5 conceptual-lecture-ok and n7 sensors;
  - r8 n10 irrelevant and n13 sensors;
  - r8-remaining n16 passive and n16 single-format;
  - recovery n23 single-format.
- Replaying recovery requests 23–25 through validation reproduces every label, explanation, quotation, matching record, draft, recommendation and field. The single-format draft stays withheld for `assumes_resource` and `copies_other_relationship`.
- The 16-judgment r8 replay gives the same summary as under `resources-2`.

**Synthetic drafts.** There are 72 in all.

The 41 probe cases include the probes from the recovery report. 22 changed, every one an intended correction:

| Change | Cases |
|---|---|
| No note → withheld (unsupported claim) | bench components and instrumentation; the available bench equipment; test instruments; bench power supply and signal generator; provided simulated measurement data |
| Withheld [laboratory] → also [laboratory instrumentation] | laboratory instrumentation |
| No note → advisory, needs confirmation | simulated measured values of unstated origin |
| Withheld → advisory conditional | oscilloscope "if faculty-confirmed available"; prefix "If the faculty confirms…"; "breadboards, multimeters, and oscilloscopes if available" (two items were withheld); "(if available)"; a conditional laboratory in the lab-0 course (decision 1 in section 7) |
| No note → advisory conditional | bench list "if faculty-confirmed available"; "subject to faculty confirmation"; "where bench instruments are available" |
| No note → withheld (explicitly unavailable) | unavailable bench components with a conditional draft; an unavailable family with "test instruments if available" |
| No note → advisory proposal | four faculty-provided data cases |
| No note → three advisory notes | the live draft |

The other 19 probe cases are unchanged:
- two supported uses (no note);
- "run a circuit simulation" (withheld);
- "oscilloscope if available" (advisory);
- a condition about something else (withheld);
- an unavailable laboratory with a conditional draft (withheld);
- two equipment-free alternatives (no note);
- six topics or modifiers (no note);
- five earlier laboratory, simulator and notes checks.

31 boundary cases behaved as designed, apart from the one known limitation in section 6. They cover condition scope, topics, data intent, lesson evidence, materials and equipment.

## 3. Stale ledger test

**Root cause.**
- `scripts/replay-stage-e8-resources.cjs` used the live ledger, `docs/ai-eval-stage-e8-c-ledger.json`, as a replay input and reported its request count.
- `stage-e8-resource-grounding.test.js:121` asserted that count was 16, which was true when the replay was written after r8.
- The ledger is append-only. Authorized runs took it to 19 (the resource regression) and then 25 (the recovery), so the assertion failed: 25 ≠ 16.
- The history was correct; the test's input was not reproducible.
- A second assertion (`:137`) compared against the literal `'resources-2'` and would fail on any version change.

**Correction.**
- The replay now reads `docs/ai-eval-stage-e8-c-ledger-before-resource-regression.json`, the byte snapshot taken after r8 (16 requests, $0.00669119).
  - Its SHA-256 (`45b1c69f…`) equals the ledger hash recorded in the saved replay artifact, so the replay reads the same bytes as the first replay did.
  - The assertion at line 121 is unchanged and passes.
- Line 137 now uses the exported `RESOURCE_REVIEW_VERSION`.
- No ledger, snapshot or saved artifact was edited or reset. [`ai-eval-stage-e8-c-resource-replay.json`](ai-eval-stage-e8-c-resource-replay.json) keeps its `resources-2` record as history.

**Cumulative accounting, tested separately.** `stage-e8-ledger-accounting.test.js` (new) is read-only. It checks the live ledger only by invariants and prefixes, never by its current totals, so a later authorized run cannot make it stale.

| File | Requests | Charged | Conservative | SHA-256 |
|---|---:|---:|---:|---|
| Snapshot before r8 | 7 | $0.00294347 | $0.006396 | `275bf07a…` |
| Snapshot before r8-remaining | 13 | $0.00583426 | $0.0139077 | `dce1a47a…` |
| Snapshot before the resource regression | 16 | $0.00669119 | $0.0161598 | `45b1c69f…` |
| Snapshot before the resource recovery | 19 | $0.00733556 | $0.0174831 | `0d7891e5…` |
| Live ledger | 25 | $0.0095186 | $0.0243375 | `fe656c72…` |

1. **Consistency** of each file:
   - one entry per request, numbered contiguously;
   - only model requests are charged;
   - the charged and conservative totals equal the sums of the entries;
   - the transient counter covers every error, 429 and 5xx entry.
2. **Append-only history:** each snapshot is an unchanged prefix of the next file and of the live ledger.
3. **Each run's usage** equals the window it appended to the ledger. The six runs are canary (1 request), canary-resume (6), r8-regression (6), r8-remaining (3), resource regression (3) and resource recovery (6). For each run the test checks:
   - the request kinds;
   - the cumulative charged and conservative totals;
   - the reported cost, reconciled;
   - the relationship IDs of each request.

   The chain ends at 25.
4. **The replay itself:** it reads the snapshot and not the live ledger, makes no provider request, and leaves the live ledger byte-identical.

## 4. ModelRun reliability

### Evidence

Empty answers with a recorded endpoint. Each was HTTP 200 with `finish_reason: stop` and a 6-token completion, `{"judgements":[]}`:

| Run, request | Endpoint | Prompt / cached tokens | Cost | What followed |
|---|---|---|---:|---|
| E.7 D1, 4 | InferenceNet | 3,839 / 3,200 | $0.0000992 | Corrective retry, request 5 (InferenceNet): 4/4 verified, $0.00044337 |
| E.8 regression, 19 | ModelRun | 4,387 / 128 | $0.00064437 | Retry refused locally (`--max-invalid 1`); run stopped |
| E.8 recovery, 22 | ModelRun | 4,387 / 4,352 | $0.00007413 | Corrective retry, request 23 (ModelRun): 4/4 verified, $0.00059823 |

In E.5, attempt 3 was also an empty list, but endpoints were not recorded per attempt. Its corrective retry verified 3 of 4; the fourth was refused for its quotation.

Model responses with a recorded endpoint across E.7 and E.8:

| Endpoint | Responses | Empty |
|---|---:|---:|
| InferenceNet | 8 | 1 |
| Wafer | 4 | 0 |
| Together | 3 | 0 |
| ModelRun | 3 | 2 |
| DigitalOcean | 2 | 0 |
| Nebius | 2 | 0 |
| Parasail | 1 | 0 |
| **Total** | **23** | **3** |

These facts decide between the options:
- **Every paid request already sends `provider.require_parameters: true`.** OpenRouter therefore routes it only to endpoints that declare every requested parameter, structured outputs included.
- **ModelRun declares structured outputs.** In E.5's list of 13 endpoints, 9 declare it, ModelRun among them; Relace, GMICloud, Novita and Minimax do not. So the empty lists came from inside the declared-support set.
- **Both ModelRun empties answered the identical first-attempt body** (requests 19 and 22, about 38 minutes apart), and the corrected body was answered in full. InferenceNet's one empty came among 8 responses.
- **`minItems` (E.6, `SYLLABUS_CHECK_SCHEMA_MIN_ITEMS=on`) sets `minItems: 1`.** It asks for a non-empty list, not one judgment per ID, and it has never been sent to a live endpoint. `require_parameters` filters on declared structured-output support, not on single JSON-schema keywords, so an endpoint may enforce, ignore or reject it.
- **E.7 and E.8 results store only the highest endpoint price, not the endpoint list.** The recovery's price lookup saw 12 endpoints, a day after E.5 saw 13.

### Comparison

| Axis | A. Bounded corrective retry (current) | B. Optional schema `minItems` | C. Only endpoints verified for the contract |
|---|---|---|---|
| Compatibility | Works with every endpoint; the request is unchanged | Unmeasured. An endpoint may enforce, ignore or reject the keyword, and a rejection fails the request | Declared support cannot exclude ModelRun. Doing so needs an observed allowlist (`provider.only` or `ignore`), a routing change that production does not use |
| Reliability evidence | Every empty answer that got its retry was answered: 3 of 3. 11 of 12 relationships were verified; the twelfth was refused for its quotation | None live. At most it prevents an empty list; a partial list is still possible | Excluding ModelRun would have avoided 2 of the 3 empties, but an allowlist drawn from 23 responses is a weak sample |
| Operational complexity | The run thresholds must be the carried counters + 2, and getting this wrong stopped the regression. A test now pins the rule | One flag, plus a compatibility probe per endpoint and a new baseline | An allowlist to maintain as endpoints change; risk that no allowed endpoint is up; evaluations would no longer reflect production routing |
| Prompt and cache versioning | None (`alignment-12c1c2-r8`) | The `-mi1` suffix creates a new cache namespace, so every relationship is asked again, and results cannot be compared with r8 without a bridge | None: the cache key does not include the endpoint |
| Failure handling | The empty list is refused as `empty_answer` and retried once with corrections. A repeat ends as `repeated_coverage_error` and the guard stops. Cost: one extra request (about $0.0004–0.0006) | The server still verifies coverage (E.6 #9), so A is needed anyway | A is still needed for every other invalid answer. An allowlist with no endpoint up turns into transient failures |

### Recommendation

1. **Keep A as the policy for evaluations and production.**
   - It is the only option with live evidence.
   - It needs no change to the prompt, the cache or the routing.
   - It is already the production code path.
2. **Do not enable B or adopt C now.**
   - B is untested live and would cost the r8 cache and comparability with r8.
   - C based on declared support would not have excluded ModelRun, and an observed allowlist would depart from production routing on a very small sample.
3. **Implemented evaluation-only endpoint diagnostics:** `eval-alignment.cjs` now records `guard.state.prices` (already fetched by the guarded `price-lookup` call in `readPrices`, including each endpoint's `provider`, `tag`, `status`, `uptime30m`, pricing and `structuredOutputs`) in `result.prices`, `stoppedResult.prices` and batch-review `snapshot.prices`, with secret redaction and no change to production routing or request counts.
4. **Revisit later only on evidence.**
   - Consider B only through a separately approved and budgeted compatibility probe.
   - Revisit C if empty answers keep concentrating on one endpoint over a larger sample.

**Offline evidence for A.** `stage-e8-retry-budget.test.js` (new) runs the guard on temporary copies of the ledger:
- with the recovery's carried counters (1/1), limits of 2/2 refuse the retry;
- limits of 3/3 allow exactly one retry and reproduce the counters the recovery recorded (invalid 2, unproductive 0);
- a second empty answer stops the run;
- for carried counts 0–3, carried + 1 on either limit refuses the retry, and carried + 2 on both allows it;
- on a temporary copy of the current live ledger (25 requests, $0.0095186, invalid 2, unproductive 0, transient 1), the proposed 4-batch next evaluation (`--budget 33 --max-cost 0.0395186 --max-invalid 4 --max-unproductive 2 --warn-invalid 3`) completes cleanly or with one corrective retry, stops on a second empty answer, and leaves the live ledger untouched.

`stage-e6.test.js` #8, #9 and #17 still cover the behaviour of `minItems`.

## 5. Regression verification

| Check | Result |
|---|---|
| New targeted tests: resource recognition 11, ledger accounting 4, retry budget 4, recovery quotations 2 | 21/21 passed |
| Existing `stage-e8-resource-grounding.test.js` | Passes, including the ledger assertion at line 121 |
| `npm test`, network blocked | **1,406 passed, 0 failed**: server 1,317, localization 22, UI 55, PDF-import UI 12 (`tmp/stage-e8-post-recovery-full-test.log`) |
| `npm run audit:i18n` | Passed: 2,213 bilingual keys, 1,164 interface key references, no hardcoded display strings |
| `node scripts/audit-verdict-i18n.mjs`, without `--write` | 0 of 55 Verdict Panel sentences untranslated |
| `npm run build` | Passed, 208 modules; only the existing chunk-size warning |
| `git diff --check` | Clean; line-ending notices only |
| Rules document | Regenerated to a scratch file; byte-identical to `docs/ai-checker-rules.md` |

**Verified invariants**
- **Academic judgments are unchanged.** The recovery replay and the r8 replay both reproduce them.
- **Correctly withheld drafts remain withheld.** All 8 are.
- **Legitimate conditional proposals are not withheld.** The Sensors draft is released with advisory warnings, and the conditional probe cases are advisory.
- **Official scores, deductions, the passing mark 79, readiness and gates are unchanged.**
  - No engine, policy, compliance or standard file changed. Hash-verified: `gemini.js`, `engine.js`, the policy, the compliance service, `standard-v4.json`, the dataset, the guard and the runner.
  - The invariance tests pass, including E.6 #18 and the compliance and revision-cycle tests.
- **Prompt compatibility is preserved.** `alignment-10` (all stages off), the D1/D2-only `-r7` prompts and Stage C `r8` are unchanged, and their tests pass, including E.6 #17.
- **Preservation.** 164 of the 168 hashes taken before the recovery are unchanged. The 4 changed files are:
  - the previous task's note in `docs/stage-e8-resource-regression.md`;
  - this review's changes to the replay script, the reviewer and the grounding test.

  Every `docs/ai-eval-*` result and snapshot is unchanged, as are `server/.env` and the dataset.

## 6. Remaining limitations

1. **The reviewer is a conservative English heuristic.** It does not recognize synonyms such as "scope", "DMM", "probe", "SPICE" or "trainer kit", nor Tagalog drafts. An unrecognized resource gets no note.
2. **Draft negation follows strict list syntax (`resources-4`).** Coordinated lists ("do not use breadboards or oscilloscopes", "breadboards and oscilloscopes are not needed") are ruled out, while bare comma pairs ("do not use breadboards, oscilloscopes") still withhold the second item rather than guessing list boundaries across clauses.
3. **Ambiguous condition scope withholds rather than releases.** For example, in "breadboards, oscilloscopes if available", a bare comma pair, the first item is withheld.
4. **Contact units are not availability evidence** (Codex's design). Two policy choices for faculty follow from this (decision 1 in section 7):
   - in the lab-0 Sensors course, a conditional laboratory proposal is now advisory rather than withheld;
   - "No laboratory is available" does not rule out bench equipment.
5. **Data intent depends on wording.** "Given …" is a proposal, "analyse simulated measured values" needs confirmation, and "use simulated data" is withheld.
6. **The validation scope is small.**
   - 18 saved drafts and 99 synthetic cases.
   - The synthetic cases and the provisional labels are developer-authored, and no faculty member has reviewed them.
7. **The endpoint evidence is thin:** 23 responses and 3 empties. Historical E.7 and E.8 results did not store endpoint lists; future runs of `eval-alignment.cjs` now record `prices.endpoints`.
8. **An exact quotation proves provenance, not relevance.** A verbatim quotation can still be selectively chosen.
9. **The Sensors draft's "simulated" option** implies a simulation the syllabus does not mention. The draft is now flagged as a faculty-provided proposal, which is the right advisory note, but that is not a judgment of whether the option suits the course.

## 7. Proposed next controlled evaluation (not executed)

This needs your approval before anything runs.

- **Scope:** the 12 unseen Stage C cases, in 4 batches:
  - Systems Engineering, 3 cases in 1 batch: `af-syseng-good`, `af-syseng-irrelevant`, `as-syseng-good`.
  - Programming 1, 8 cases in 2 batches: `as-prog1-essay`, `as-prog1-bare-name`, `as-prog1-keywords`, `as-prog1-accessible`, `as-prog1-week1`, `af-prog1-multiweek`, `as-prog1-vague-evidence`, `as-prog1-multiweek`.
  - Sensors, 1 case in 1 batch: `as-sensors-quiz`.
- **Configuration, unchanged:** `alignment-12c1c2-r8`, C1/C2 only, trim off, `minItems` off, production routing (`require_parameters`), reviewer `resources-4`, 90-second timeout, batch size 4.
- **Thresholds:** the live counters at run time plus 2. Today the ledger carries invalid 2 and unproductive 0, which gives `--max-invalid 4 --max-unproductive 2 --warn-invalid 3 --max-transient 3`.
  - This allows one corrective retry.
  - A second invalid answer of any kind (empty, contract or quotation) stops the run.
  - Each further retry would need +1 on both limits and +1 request in the budget.
- **Budget:** 8 more requests / $0.03, so cumulative caps of 33 requests / $0.0395186. Expected use is 7 requests: a key check, a price lookup, 4 batches and at most 1 retry.
- **Command:**

  ```text
  node scripts/eval-alignment.cjs --confirm-paid --check-key --dataset stage-c --runs 1
    --ids af-syseng-good,af-syseng-irrelevant,as-syseng-good,as-prog1-essay,as-prog1-bare-name,as-prog1-keywords,as-prog1-accessible,as-prog1-week1,af-prog1-multiweek,as-prog1-vague-evidence,as-prog1-multiweek,as-sensors-quiz
    --budget 33 --max-cost 0.0395186 --accounting reconcile --max-transient 3 --max-invalid 4 --max-unproductive 2 --warn-invalid 3
    --max-unresolved 0.2 --min-sample 4 --ledger docs/ai-eval-stage-e8-c-ledger.json --out docs/ai-eval-stage-e8-c-heldout.json --review-between-batches
  ```

- **Before the run**, as for the recovery: a free plan, an offline dry run of the thresholds on a ledger copy, a preservation baseline, a ledger snapshot and the offline test suite.
- **Decisions needed first:**
  1. **Laboratory-0 policy.** Should "laboratory 0" contact units count as explicit unavailability, so that a conditional laboratory proposal is withheld, or stay neutral, so that it is advisory?
  2. Whether one corrective retry is enough, or a second should be budgeted.
  3. Approval of `resources-4` and the endpoint diagnostics recording in `eval-alignment.cjs`. Both are local and uncommitted.

## Files changed by this review

- `server/lib/syllabuscheck/recommendationReview.js`: `resources-3` / `resources-4`.
- `scripts/eval-alignment.cjs` and `server/lib/syllabuscheck/eval/providerGuard.js`: evaluation-only endpoint diagnostics recording (`prices.endpoints`) with secret redaction.
- `scripts/replay-stage-e8-resources.cjs`: the ledger input is pinned to the snapshot.
- `server/lib/syllabuscheck/stage-e8-resource-grounding.test.js`: the version constant (two lines).
- `server/lib/syllabuscheck/provider-guard.test.js`: endpoint diagnostics and redaction assertions.
- New tests in `server/lib/syllabuscheck/`:
  - `stage-e8-resource-recognition.test.js`;
  - `stage-e8-ledger-accounting.test.js`;
  - `stage-e8-retry-budget.test.js`;
  - `stage-e8-recovery-quotations.test.js`.
- `docs/stage-e8-resource-recovery.md`: a dated update note, two measures rows and one sentence clarified.
- This report, and the logs `tmp/stage-e8-post-recovery-*`.

Nothing was committed.
