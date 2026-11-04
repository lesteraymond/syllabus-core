# Stage E.7: Phase 2 evaluation (D2, then D1)

The historical results below are preserved. The subsequent [offline academic reliability follow-up](stage-e7-academic-reliability-follow-up.md) adds advisory safeguards and versioned datasets without rewriting these measurements; the [Stage C plan](stage-c-evaluation-plan.md) remains prepared, not executed.

Status: evaluation record for review. Nothing in it changes the checker, its prompts, the datasets, the official score, the submission gates or any
production setting. The provisional labels are developer-written and unreviewed: agreement with them is **not** faculty-verified accuracy.

## Safeguards (both evaluations)

- **Provider and prompt.** OpenRouter `minimax/minimax-m3.1-flash`, temperature 0, strict JSON schema, `max_tokens` 8192. The full r7 prompt of the one
  stage under test, switched on only inside the evaluation process (`scripts/eval-alignment.cjs`); no trim, no `minItems`, no production flag set.
- **Guard** (`server/lib/syllabuscheck/eval/providerGuard.js`). Every request is counted and checked before it is sent:
  - a request cap and a dollar cap, both carried by a ledger file;
  - the worst case of each model request is reserved before it is sent, and settled at the provider-reported cost when that report is reliable;
  - HTTP 401/402/403 stop the run at once;
  - so do 3 transient errors, 9 answers in a row that verify nothing, and a final unresolved rate above 20% once 8 relationships were attempted.
- **Key check** (`--check-key`, added in Stage E.7). The first live D2 attempt stopped at HTTP 401 ("API key expired"), and the price lookup turned out
  to be answered even for an expired key. Each run now first asks OpenRouter's key-status address, one counted request that bills nothing: a refused
  key stops the run before anything is paid. Only the status and fields that say nothing about the key are kept (never its label, which shows part of
  the key). Tested in `provider-guard.test.js`.
- **Isolation.** The scripts refuse to run when a database, route, repository or service module is loaded; each result records the check.
- **Secrets.** No key, part of a key or `Authorization` header appears in any result, ledger or log (scanned after each run).

## 1. D2: reference relevance (`stage-d2-1`, 9 items)

Approved: 1 run, at most 21 requests across both attempts, at most $0.05.

| Attempt | Requests | Outcome |
|---|---|---|
| First (2026-10-26 04:39 UTC) | 2: price lookup, 1 model request refused with HTTP 401 | Expired key. Nothing evaluated, $0. Not counted as an academic error. |
| Resumed (2026-10-26 05:01 UTC), same ledger | 5: key check (200), price lookup, 3 model requests | Complete |

Resumed results (`docs/ai-eval-stage-e7-d2-resume.json`; ledger `docs/ai-eval-stage-e7-d2-ledger.json`, 7 of 21 requests):

| Measure | Value |
|---|---|
| Relationships | 9 planned, 9 attempted, 9 verified on the first attempt; 0 recovered, 0 unresolved |
| Retries / refused judgements | 0 / 0 |
| Labels and relevance field equal to the provisional expectation | 9 of 9 and 9 of 9 |
| Quotes | 18 of 18 exact; every course-context quote from the course text, every entry quote from the entry |
| Tokens | 10,364 prompt (2,688 cached), 1,051 completion, 0 reasoning |
| Cost | $0.00182232 reported and charged (reconciled); $0.0043704 under the conservative rule |

Against earlier stages: `rr-prog1-relevant` (quotes swapped 3 of 3 times in E.4) and `rr-syseng-unrelated` (refused for a re-capitalised quote in
E.5) both verified on the first attempt. E.4 and E.5 ran every stage at once (30k-character prompt, mixed batches), so the change cannot be credited to
the r7 wording alone.

### Recorded finding: `rr-sensors-relevant`, an accepted but academically unsupported explanation

| | |
|---|---|
| Item | `rr-sensors-relevant` (CPE 304, clear-positive; provisional ALIGNED, relevance `relevant`) |
| Entry | "Cruz, A., & Tan, B. (2022). Operational amplifiers and sensor signal conditioning. Example Press." |
| Answer | ALIGNED, relevance `relevant`, basis `title_and_venue`; both quotes exact and on their own side |
| Explanation | "The entry's title names operational amplifiers and sensor signal conditioning, which are the course's Week 1 and Week 3 topics, and the publisher named is a technical press." |

- **Classification: accepted but academically unsupported explanation.** The answer is structurally valid and its label and relevance agree with the
  provisional expectation, but its explanation states something the entry does not show: the entry names "Example Press" and nothing about it says
  it is a technical publisher.
- **The basis overstates the evidence.** The prompt defines `title_and_venue` as "the title and the journal, publisher or website named in the entry
  both support the judgement". Here only the title does, so `title_only` was the supported value.
- **Why the checker accepted it.** The contract checks the quotes, the field values and the agreement of the label with the fields. It does not check
  whether an explanation or the basis is supported by the entry, and the dataset sets no expected basis, so the basis is not scored.
- **Effect.** The label and relevance results stand. The run has 1 unsupported explanatory claim and 1 unsupported basis value among 9 answers.
- **Not changed.** No D2 label, dataset item, prompt or result file was altered. A separate proposal for stronger explanation and basis validation is in
  `docs/stage-e7-d2-validation-proposal.md`.

## 2. D1: Marian-Augustinian values (`stage-d1-1`, 17 items: 12 Value-use, 5 Value-map)

Approved: 1 run, at most 41 requests (key check, price lookup and retries included), at most $0.07, a fresh ledger. Run 2026-10-26 05:21 UTC with
prompt `alignment-12d1-r7` (13,873 characters). Result `docs/ai-eval-stage-e7-d1.json`; ledger `docs/ai-eval-stage-e7-d1-ledger.json`. The result now
also keeps each answer's draft (`answers[].draft`).

### 2.1 Structural validity (what the checker verifies)

| Measure | Value |
|---|---|
| Relationships | 17 planned, 17 attempted, 17 verified |
| First-attempt failures | 4 of 17 (23.5%), all from one request answered with an empty judgements list (6 completion tokens) |
| Recovered | 4 of 4, by the one corrective retry |
| Final unresolved | 0 (0%); completion `complete` |
| Quotes | 34 of 34 exact and on their own side. The checker matched 15 answers `exact`/`exact`; it does not evaluate the quotes of the 2 INSUFFICIENT_EVIDENCE answers, which are exact as well. |
| Structured fields | All 41 required fields assessed in the 15 answers that enter the field metrics; 0 `not_assessed`, 0 missing, 0 malformed, 0 contradictory. The 2 INSUFFICIENT_EVIDENCE answers also assessed every field but are left out of the field metrics by design. `responsible` (not required) was answered in all 12 Value-use answers. |
| Drafts | Present in all 6 failing Value-use answers; empty in all 5 Value-map answers, as the prompt requires |
| Requests | 8 of 41: key check (200), price lookup, 6 model requests (5 batches and 1 retry) |

### 2.2 Academic reasoning quality (read by hand against the lesson texts; the checker does not verify this)

**Agreement with the provisional labels** (developer-written, unreviewed): 15 of 17 labels. Every field with an expectation agrees: `valueUse` 10/10,
`valueFit` 6/6, `carriedBy` 2/2, `coreValue` 5/5, `integration` 5/5 (the 2 INSUFFICIENT_EVIDENCE answers' fields included). False approvals 0 of 9;
false rejections 0 of 4. The two differing labels are discussed in 2.3.

**The four distinctions.**

| Distinction | Items | Result |
|---|---|---|
| Value merely named | `vu-prog1-name-only` | `name_only`, PARTIALLY_ALIGNED: "the lesson's peer code review activity is not tied to Humility in the text" |
| Potential opportunity | None of the 17 items is an opportunity case | Not directly tested. The model never answered `opportunity`; in `vu-prog1-generic` it named the lesson's activity as "only an opportunity" in the explanation, as the prompt allows. |
| Integration supported by evidence | 5 Value-use items expecting `integrated`, 3 Value-map items expecting `demonstrated` | 8 of 8, each pointing to the behaviour the value statement or the lesson describes |
| Insufficient evidence | `vu-prog1-no-activity` (activities and tasks "(none written)") | `insufficient`, with the label INSUFFICIENT_EVIDENCE (2.3) |

The generic (2), unrelated (2) and clash (1) items were also placed as expected.

**Opportunity classified as integration: none.** No answer calls a value `integrated` or `demonstrated` (or ALIGNED) where the provisional label does not
accept it.

**The disputed `vu-prog1-name-only`.** Under prompt r5 (E.4: every stage on, and a worked example that described the sibling item) it was ALIGNED,
`integrated`: "Students review each other's code during pair programming, which can express Humility…", an opportunity read as an integration. Under r7
it is PARTIALLY_ALIGNED, `name_only`, and the explanation infers no behaviour. The faculty decision asked for in E.6 is still open.

**Unsupported explanatory claims.**
- **`vm-prog1-respect-supported` (one clear case).** "…and the laboratory task has them report every failing test case truthfully including cases they
  cannot fix." This lesson has no such task: the behaviour belongs to `vm-prog1-honesty-supported`, which was in the same request. The label (ALIGNED),
  core value (Humility) and integration (`demonstrated`) still rest on this lesson's own listening-and-learning activity, but the explanation states a
  student behaviour the lesson does not establish. The checker accepted it: quotes are checked against the pair's texts, explanations are not.
- **Minor wording, no invented behaviour.**
  - `vu-syseng-community` attributes "rather than their own preferences" to the workshop, though only the value statement says it.
  - `vu-prog1-week1` calls the match "exactly" what the statement describes.
  - `vu-prog1-unrelated` says no activity could express the value, while its own draft proposes one.
  - `vm-sensors-patience-weak` says the lesson shows "only building and measuring": it also has a design example and a simulation. It also calls the
    link "plausible but weak" while answering `coreValue: none`.

**Recommendations (drafts).** 6 drafts would be offered to the author, all for failing Value-use answers.

| Draft | Assessment |
|---|---|
| `vu-prog1-name-only` | Within the lesson's own peer code review. It is, word for word, the value statement of `vu-prog1-humility-review`, the other item of the same request: copied, not proposed. |
| `vu-prog1-generic` | Within the lesson's pair programming and testing |
| `vu-prog1-unrelated` | **Introduces an arrangement the lesson does not have**: sharing the program "with a classmate from another section" |
| `vu-prog1-clashes` | Within the lesson's pair programming and review; the order of steps is muddled ("before writing and testing their own") |
| `vu-syseng-interiority-generic` | Within the lesson's requirements document; "the stakeholder's stated needs" rests on the course content ("stakeholder needs"), although this lesson has no interview |
| `vu-sensors-silly` | **Academically unsound**: it keeps Compassion but attaches it to checking the gain and re-measuring, which shows diligence, not compassion. The steps themselves are within the practical. |

- **Suppressed:** the raw answer for `vu-prog1-no-activity` carried a draft that invents "the Week 3 laboratory" and pair work for a lesson whose activities and tasks are "(none written)". The checker drops the draft of an INSUFFICIENT_EVIDENCE answer, so no author would see it.
- **Totals:** 1 of the 6 offered drafts introduces unsupported instructional behaviour, and 1 more attaches the value to a behaviour that does not express it.

**Carry-over between the relationships of one request.** Four-word sequences that come from another item of the same request and are not in the item's own
texts were found in 2 D1 answers (the explanation and the draft above) and in no D2 answer. Batches hold relationships of the same course, so a sibling's
activity can travel into an explanation or a draft.

### 2.3 The two label differences

| Item | Answer | Provisional | Reading |
|---|---|---|---|
| `vu-prog1-no-activity` | INSUFFICIENT_EVIDENCE; `valueUse: insufficient`, `carriedBy: none`, `responsible: activity` | PARTIALLY_ALIGNED or NOT_ALIGNED | The explanation is accurate (no activity or task; a generic statement). The r7 wording allows both readings: INSUFFICIENT_EVIDENCE is for source text that is "missing, empty or unreadable", and two parts of this source are "(none written)"; the Value-use test also offers `insufficient` ("the lesson text is too thin to tell"), and says that a lesson without activities cannot integrate a value. |
| `vm-prog1-respect-no-evidence` | INSUFFICIENT_EVIDENCE; `coreValue: none`, `integration: absent` | PARTIALLY_ALIGNED or NOT_ALIGNED | The fields equal the expectation. The Value-map test itself allows this label: "NOT_ALIGNED or INSUFFICIENT_EVIDENCE when the lesson shows no such link". The model followed the prompt; the provisional label does not accept it. |

Neither label was changed. Each needs a decision: accept INSUFFICIENT_EVIDENCE for these cases, or narrow the wording (an r8 candidate). In the advisory
verdict (E.6), `insufficient` with INSUFFICIENT_EVIDENCE is NOT_CHECKED, neither a pass nor a failure.

### 2.4 Requests, tokens and cost

| Request | Relationships | Provider | Time | Tokens in (cached) / out | Reported = charged |
|---|---|---|---|---|---|
| 3 | 4 prog1 Value-use | InferenceNet | 1.7 s | 3,887 (128) / 715 | $0.00077043 |
| 4 | 4 prog1 Value-use | InferenceNet | 2.2 s | 3,839 (3,200) / 6: empty list | $0.0000992 |
| 5 | the same 4, with corrections | InferenceNet | 1.4 s | 4,018 (3,712) / 683 | $0.00044337 |
| 6 | 3 prog1 Value-map | DigitalOcean | 1.5 s | 3,850 (384) / 457 | $0.00079986 |
| 7 | 2 syseng Value-use, 1 Value-map | Parasail | 0.9 s | 3,707 (128) / 468 | $0.00081957 |
| 8 | 2 sensors Value-use, 1 Value-map | InferenceNet | 0.9 s | 3,729 (3,200) / 494 | $0.0003566 |

- Totals: 23,030 prompt tokens (10,752 cached), 2,823 completion, 0 reasoning. $0.00328903 reported and charged (6 reconciled); $0.0102966 under the
  conservative rule. The E.6 plan expected $0.0045–0.0193.
- Retries: 1 (retry rate 20%: 6 requests for 5 batches). Invalid answers: 1 (the empty list).
- The key check before the run reported $249.99817768 of the key's $250 limit left: $0.00182232 used, exactly the cost OpenRouter reported for D2.

### 2.5 Compared with earlier stages

- `vu-prog1-name-only`: ALIGNED / `integrated` in E.4, now PARTIALLY_ALIGNED / `name_only`.
- `vu-syseng-community`: ALIGNED / `integrated` in E.5 with `carriedBy` not assessed; now `carriedBy: activity`.
- Empty answers persist at a lower rate: 1 of 6 answers (several in E.5). `minItems` stays off, as approved; the corrective retry recovered all 4.
- E.4 and E.5 ran every stage at once (about 30k characters, mixed batches, prompts r5/r6 with a worked example taken from a dev item); E.7 ran D1 alone
  with r7, which has no examples. The difference cannot be credited to one change.

### 2.6 Limitations

- 17 synthetic, unreviewed items; 1 run, so no repeatability; no faculty verdict.
- No item tests `opportunity`: the D1 dataset predates the r7 kinds.
- A verified quote proves only that the evidence was copied; the reasoning around it was read by hand, and the drafts were judged against the lesson texts
  only.
