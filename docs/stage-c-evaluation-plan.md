# Stage C focused regression canary: executed and stopped for review

**Execution update (2026-10-26).** The user-approved 12-case r8 canary has run once and stopped for academic review. See the [r8 evaluation report](stage-e8-stage-c-r8-regression.md), [raw result](ai-eval-stage-e8-c-r8-regression.json) and [offline artifact audit](ai-eval-stage-e8-c-r8-regression-review.json). All 12 answers verified and matched provisional labels; the conceptual-lecture error was not reproduced, but the sensors draft still assumed unconfirmed resources and was flagged for withholding. Six new HTTP attempts cost $0.00289079; the preserved ledger now holds **13 attempts/$0.00583426**. The canary authorization has ended; the full 28-item evaluation remains unapproved and unexecuted.

## Original pre-execution plan retained for traceability

The balances and proposed command below describe the starting plan, not an active authorization or instruction to rerun it. The retained seven attempts/$0.00294347 were the balance before r8, now preserved in the [pre-r8 ledger snapshot](ai-eval-stage-e8-c-ledger-before-r8.json). Do not overwrite the completed r8 output or reset usage.

**Status (2026-10-26): offline corrections and planning only. No new provider call is authorized or executed.** The original [r7 eight-case canary](stage-e8-stage-c-canary.md) remains the baseline: its [raw result](ai-eval-stage-e8-c-canary-resume.json), [review](ai-eval-stage-e8-c-canary-review.json), and [same open ledger](ai-eval-stage-e8-c-ledger.json) are preserved. The ledger holds **7 counted HTTP attempts and $0.00294347 charged**, including the failed first key-status attempt. See the [offline corrections report](stage-e8-stage-c-corrections.md) for causes, safeguards and limitations.

The next proposed paid step is a focused regression canary after review and separate approval. It is not the remaining 28-item evaluation, another dataset run or Phase 3. Earlier E.3–E.5 smoke evaluations included some Stage C relationships; the completed r7 canary is not relabeled as a test of r8.

## Scope and unchanged expectations

One run of 12 existing development cases from `server/lib/syllabuscheck/eval/stage-c-dataset.json`, version **stage-c-2**. Their source, target, provisional labels and expected aspects remain unchanged. Six are Activity-fit and six Assessment-fit; eight belong to IT 202, one to IE 402 and three to CPE 304.

| Case | Regression purpose |
|---|---|
| `af-prog1-conceptual-lecture-ok` | Known false rejection: a conceptual ILO in a laboratory-bearing course must not require unnecessary coding. |
| `af-sensors-passive` | Known unverified laboratory assumption; preserve the need for practical learning while conditioning unknown resources. |
| `af-prog1-irrelevant` | Wrong subject and copied scaffold detail; distinguish useful correction from unsupported imported circumstances. |
| `as-prog1-recall-quiz` | Practical ILO versus syntax quiz; a same-competency replacement must not be withheld merely for sibling terminology. |
| `af-prog1-good` | Positive practical teaching control. |
| `as-prog1-good` | Positive practical assessment control. |
| `as-syseng-essay` | Wrong competency; a correction must not invent live interviews or external participants. |
| `as-prog1-too-high` | Excessive competency demand; correction must preserve the conceptual ILO. |
| `af-sensors-good` | Added practical positive control with an explicitly stated simulator/activity. |
| `as-sensors-good` | Added assessment control with observable practical evidence. |
| `af-prog1-lab-unused` | Added genuine lack-of-practice control; conceptual safeguards must not excuse missing practical learning. |
| `as-prog1-conceptual-ok` | Added conceptual assessment control at the appropriate cognitive demand. |

The first eight are the original canary cases; the last four broaden the controls. The runner preserves dataset order rather than the order of the `--ids` list. Across the two canaries this would be 20 case evaluations covering 12 distinct dataset cases, before retries.

All expected labels and fields are **developer-authored, provisional and unreviewed by faculty**. Agreement is not faculty-verified accuracy. The dataset has no missing-upstream model case; that remains an explicitly separate offline engine regression. Broader Analysis/Evaluate distinctions also require offline regression coverage and are not exhaustively validated by this live selection.

## Model, prompt and isolation

- OpenRouter `minimax/minimax-m3.1-flash`, one run, temperature 0, strict JSON schema, `max_tokens` 8192 and a 90-second model timeout.
- Full C1/C2 prompt **`alignment-12c1c2-r8`**; trimming and optional `minItems` remain disabled. The old Stage C r7 answers are incompatible with this prompt's cache key. D-only r7 and all-off alignment-10 behavior are preserved.
- Only the evaluation's child-process settings enable C1/C2. Production flags, `server/.env`, curriculum references, title matching, scores, deductions, passing mark, readiness and gates are not changed.
- The runner must reject loaded DB, route, repository, compliance-service and DB-driver modules before preflight. Every HTTP attempt passes through the existing reservation guard; redirects are refused to avoid hidden HTTP hops.
- Key acceptance and current endpoint prices must be checked inside the retained counted ledger before the first paid model request. No key or authorization header is printed. No key-status or price request was made during this offline preparation.

## Proposed cumulative limits

The additional canary allowance is proposed, not granted:

| Measure | Limit or retained value |
|---|---:|
| Retained Stage C attempts / charged cost | 7 / $0.00294347 |
| Proposed additional attempts / charged allowance | At most 15 / $0.03 |
| Enforced cumulative command limits | **22 attempts / $0.03294347** |
| Initial model requests | 4 batches of up to 4 relationships |
| New preflight requests | 1 key check + 1 price lookup, inside the 15 new attempts |
| Bounded retry exposure without the caps | 28 model requests: 4 + 2 × 12; plus the 2 lookups |
| Retained transient counter | 1; with maximum 3, two additional transient errors reach the stop |
| Overall Stage C ceiling across all authorized work | 65 attempts / $0.09 |

The request and charge counters are compared directly by reusing **`docs/ai-eval-stage-e8-c-ledger.json`**. Do not create a fresh ledger, truncate it, change its counters, or use `--previous-ledger` as if a link alone enforced a combined cap. The guard's successor link preserves history but its cap comparison is local to that successor; a closed-ledger successor would require explicit remaining allowances or verified cumulative enforcement first.

Any later full 28-item evaluation still needs separate approval after the regression canary is reviewed. Its allowance must include both canaries. The pre-correction arithmetic remainder of 58 attempts/$0.08705653 is not an additional authorization.

## Offline planning command

Run only this free planning form during offline review. It makes no HTTP request:

```powershell
powershell.exe -NoProfile -Command {
  $env:SYLLABUS_CHECK_AI_PROVIDER = 'openrouter'
  $env:OPENROUTER_MODEL = 'minimax/minimax-m3.1-flash'
  foreach ($stageName in 'A', 'B', 'B3', 'B4', 'D1', 'D2') {
    Set-Item -LiteralPath ('Env:SYLLABUS_CHECK_STAGE_' + $stageName) -Value 'off'
  }
  $env:SYLLABUS_CHECK_STAGE_C1 = 'on'
  $env:SYLLABUS_CHECK_STAGE_C2 = 'on'
  $env:SYLLABUS_CHECK_PROMPT_TRIM = 'off'
  $env:SYLLABUS_CHECK_PROMPT_VARIANT = 'current'
  $env:SYLLABUS_CHECK_SCHEMA_MIN_ITEMS = 'off'
  $env:SYLLABUS_CHECK_AI_TIMEOUT_SEC = '90'
  node scripts/eval-alignment.cjs --plan --dataset stage-c --runs 1 --ids af-prog1-good,af-prog1-irrelevant,af-sensors-passive,af-prog1-conceptual-lecture-ok,as-prog1-good,as-syseng-essay,as-prog1-recall-quiz,as-prog1-too-high,af-sensors-good,as-sensors-good,af-prog1-lab-unused,as-prog1-conceptual-ok --budget 22 --max-cost 0.03294347 --accounting reconcile --max-transient 3 --max-unproductive 3 --max-invalid 3 --max-unresolved 0.2 --min-sample 4 --warn-invalid 2 --ledger docs/ai-eval-stage-e8-c-ledger.json --out docs/ai-eval-stage-e8-c-r8-regression.json
}
```

Only after separate paid-canary approval, use that exact selection, configuration, retained ledger, new output path and limits, replacing `--plan` with **`--confirm-paid --check-key`**. Do not run that paid form as part of these corrections. Verify the free plan prints 12 selected items, C1/C2 only, full r8, no trimming and no `minItems`; stop on any mismatch. Never overwrite the original r7 canary result.

## Cost estimate and reservation

Offline request-body capture used explicit nonsecret settings, blocked global network access and an injected transport that throws before sending. It did not read `server/.env` or query current prices.

| Planning observation | Value |
|---|---:|
| Full r8 system prompt | 17,888 characters |
| Initial request bodies | 20,611–22,282 bytes |
| Approximate input tokens, characters/4 | 19,983 across four initial requests |
| Historical maximum input / output endpoint price | $0.30 / $1.20 per million tokens |
| Historical worst reservation per initial request | $0.01609–$0.01659 |
| Historical expected bill estimate | **$0.004–$0.012** |
| Additional charge cap | **$0.03**, inside $0.03294347 cumulative |

The rate is the completed E.8 canary's historical highest endpoint price, not a current quote. The estimate scales the observed $0.00294347 four-request bill for a larger prompt and selection and allows some retry variability; it is not a completion guarantee or a precision forecast. At a future approved run the guard fetches current prices and reserves input bytes plus 256 as input tokens, 8192 output tokens and any request fee before each send. Reliable reported cost reconciles the reservation. Missing usage or a timeout consumes its worst case; one abandoned request can prevent the next request fitting the additional $0.03 cap.

## Stop and review conditions

- Stop immediately on 401/402/403, another model-request 4xx except 429, failed key verification, unavailable prices, or violated token/price bounds.
- Stop before exceeding **22 cumulative attempts** or **$0.03294347 charged plus reservations**, preserving all seven previous attempts and their charge.
- Retain the transient count of one; stop at three cumulative transient errors, three consecutive unproductive answers, or three invalid model answers. Warn at two invalid answers. A recoverable refused answer is reported separately from a finally unresolved relationship.
- Between batches, stop if final unresolved relationships exceed 20% after four distinct relationships have been attempted.
- Stop after this 12-case canary regardless of its outcome. Do not automatically run the complete dataset.
- Manually review every conceptual/practical judgment, every explanation and draft, all conditional resource assumptions, every withheld draft and every advisory similarity warning. An unsupported approval, repeated conceptual-to-practical overreach, unconfirmed resource requirement or systematic validation failure prevents academic approval to proceed.
- Compare findings separately from recommendation quality. A genuine practical competency must remain practically supported; unknown equipment does not itself prove misalignment. A shared phrase does not prove an academically invalid rewrite.
- Keep every expectation provisional, preserve the raw model judgment, and record matched evidence/reasons. No field changes automatically.

## Metrics to retain

Record planned, attempted, verified, first-attempt failures, recovered, unresolved and never-attempted relationships; exact source/target quotation matches; required-field coverage/contradictions; provisional-label agreement and false approvals/rejections; unsupported explanation claims; unsafe, irrelevant or unnecessarily expanded corrections; drafts withheld with reasons; advisory warnings and human false-positive/over-withholding review; requests, retries, prompt/cache/completion/reasoning tokens, reservations, reported/reconciled/conservative charges and the stop reason.

Keep `draftWarnings` separate from withholding `draftReview`. Read valid quotations as evidence of copying from the supplied text, not proof of the surrounding reasoning. Record the conditional-resource and mixed-competency cases needing faculty confirmation. No repeatability run, prompt-trim comparison, other dataset or Phase 3 work is included.
