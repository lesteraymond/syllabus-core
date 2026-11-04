# Stage E.8: instructional-resource reviewer bypass fix

Status: completed offline on 2026-10-26; stopped for review. **No provider request, paid evaluation, migration or production write was performed.** The twelve unseen Stage C cases remain unattempted. The historical ledger remains at **16 requests/$0.00669119**, with every entry unchanged.

**Execution update (2026-10-26, 09:49 UTC).** The proposed six-case live regression at the end of this report was approved and ran once. It stopped at its first model answer, when an OpenRouter endpoint returned an empty judgements list (`empty_answer`) and the prescribed first-invalid limit stopped the run. No judgment or draft was produced. It made 3 HTTP requests and cost $0.00064437; the ledger now holds 19 requests/$0.00733556. See the [regression report](stage-e8-resource-regression.md). The rest of this report is unchanged.

## Exact failure and academic field disagreement

The [coverage report](stage-e8-stage-c-r8-coverage.md), [remaining-case review](ai-eval-stage-e8-c-r8-remaining-review.json), [exploratory summary](ai-eval-stage-e8-c-r8-exploratory-summary.json) and [ledger](ai-eval-stage-e8-c-ledger.json) were inspected before changes. Original responses and reviews remain historical evidence.

`af-prog1-single-format` supplies:

```text
Source:
Week 3 course content: Java conditional statements: if, if-else, nested if and switch
ILOs:
- Develop and test Java programs that use if-else and switch statements to make decisions.
Contact units stated by the syllabus: lecture 2, laboratory 1

Target:
- Individual timed coding test in which students write if-else programs from memory.
```

The original model draft is:

> - Individual coding exercise in which students write if-else and switch programs from worked examples and syntax notes, then run and test each program against several inputs and correct any faulty logic; students who prefer not to work under time pressure may complete the same exercise untimed with the notes available.

The verified-response path is `gemini.checkOne` -> `answerReview.reviewDraft(j, pair, course, { pairs, aspects })` -> `recommendationReview.lessonDraftNotes` -> `resourceNotes`. The current pair above, its structured fields, course context and sibling pairs were supplied. Resource availability is intentionally grounded only in the current lesson's activities or explicit resource fields. The ILO, course topic, units and sibling arrangements cannot establish an inventory.

**The actual miss was lexical coverage combined with an insufficient distinction between material use and material creation.** The old resource patterns included laboratories, simulators, handouts, worksheets and starter files, but no syntax notes, lecture notes or code samples. No matching resource meant no grounding check, so both `draftReview` and `draftWarnings` were absent. The claim "with the notes available" was unverified. It does not establish that notes are unavailable or that faculty could not prepare them. Similar teaching terminology elsewhere is not proof that this draft was copied.

A separate cache weakness was found during this fix: prompt-compatible cached judgments were rebound without refreshing local draft-review codes. That was not the cause of the fresh live response, but could preserve a missed warning during reuse.

The structured mismatch is **`teaching=weak` versus provisional `teaching=sound`**, while both records retain PARTIALLY_ALIGNED and `learnerSupport=limited`. These are valid enums and not a response-contract contradiction. The provisional case treats coding practice as a sound method with limited support; the model additionally treats the absence of switch/testing detail as a teaching-method deficiency. Its categorical "no opportunity" to run/test is stronger than the target establishes. This is a meaningful academic interpretation difference in an underspecified task, with an ambiguous, faculty-unreviewed expectation. Faculty need to clarify the actual task before resolving it. No label, field expectation or explanation was edited to remove the disagreement.

## Local safeguard changes

The resource reviewer now distinguishes these situations using the resource's clause, governing action, availability wording and current-lesson evidence:

| Situation | Handling |
|---|---|
| Current lesson explicitly supplies the same material or lists it as a resource | No unsupported-resource finding. This records a stated plan, not external inventory verification. |
| Unqualified use of supplied/existing materials, or a factual availability assertion, without current-lesson support | `assumes_resource`; withhold that draft for faculty review. |
| Faculty or students explicitly prepare/create/provide the material as a proposal | Advisory `proposed_resource`; no withholding solely for that material. Faculty must confirm preparation and feasibility. |
| Resource use explicitly depends on availability/faculty confirmation | Advisory `conditional_resource` when availability is unknown. A condition cannot override explicitly stated unavailability. |
| Tentative or ambiguous material reference, including a question about availability | Advisory `resource_needs_confirmation`; no assertion of academic error and no withholding from this caution alone. |
| Subject terminology, discussion of materials, note-taking, or the verb "notes" | No availability claim inferred solely from those words. |
| Evidence appears only in a sibling, ILO, topic or course description | It cannot ground this lesson's resources. Independent unsupported details still permit a contamination finding; shared wording alone remains advisory. |

Instructional materials include syntax/lecture/study/reference notes, worksheets, starter files/code, handouts, code samples and reference materials. The nearest relevant action matters: **writing programs from notes is not preparing the notes**. A preparation proposal for one material does not authorize an existing handout elsewhere in the clause. A confirmation question in a resource field does not establish availability. Clear proposals to create a material remain proposals even when an existing copy is unavailable.

The independent local review version is **`resources-2`**. Stage C cached drafts are reviewed again against their current pair on reuse, without a provider call or mutation of the saved judgment. Labels, fields, explanation, quotations, Bloom values and raw draft remain intact. The provider schema, abstractions, retries and academic prompt cache keys are unchanged.

`reportSafety.withholdReviewedDrafts` filters stale actionable copies at the engine return and saved-report read/write boundaries. It removes the affected proposal from suggestions and clears its recommendation and `detail.change` in both displayed and complete verdict findings. It preserves an independently justified, different proposal for the same field. Raw model drafts remain diagnostic evidence. API acceptance/refinement reads the filtered saved report rather than a stale suggestion list. The Verdict Panel also refuses to render a recommendation carrying withholding metadata, even if an older payload includes a stale recommendation string.

English and Tagalog explanations cover the two new advisory codes. The printable panel uses the same rendering guard, verified in both languages. This repository has no separate checker-report PDF generator to patch; browser printing of the panel cannot include a correction absent from its markup. Syllabus uploads and faculty-authored form output were not rewritten.

## Exact offline replay

[Derived replay artifact](ai-eval-stage-e8-c-resource-replay.json), generated with:

```text
node scripts/replay-stage-e8-resources.cjs --write
```

This script reads only the two saved r8 response cohorts, dataset and ledger, validates their original response batches, and writes a separate derived review. It imports no DB or dotenv loader and blocks provider fetch in its executable path. Input hashes are checked before/after replay. It does not evaluate the twelve unseen cases or repair historical model output.

| Measure | Offline result |
|---|---:|
| Saved relationships replayed / original academic judgments preserved | 16 / 16 |
| Exact quotations preserved | 32 / 32 |
| Original structured fields, Bloom values and raw drafts preserved | 16 / 16 |
| Agreement with unchanged provisional labels | 16 / 16 |
| Compared field expectations | 23 / 24, unchanged disagreement |
| Generated drafts in saved responses | 8 |
| Withheld before / after local review | 3 / 4 |
| Newly withheld | 1: `af-prog1-single-format` |
| Previously withheld drafts released | 0 |
| Previously usable proposals newly withheld | 0 |
| Remaining plausible proposals | 4 / 8 generated, still requiring faculty approval |
| Changed review records | 2 |
| Changed explanation-review codes | 0 |
| Provider requests / cost | 0 / $0 |

Every changed warning/withholding decision:

| Case | Before | After |
|---|---|---|
| `af-prog1-single-format` | No warning or withholding. | Adds `draftReview: assumes_resource` with evidence `syntax notes` and `the notes`. Draft is withheld; PARTIALLY_ALIGNED and all original fields/evidence remain unchanged. These are two evidence spans for one withholding reason, not two rejected drafts. |
| `af-prog1-passive` | Withheld for `assumes_resource` (`Laboratory`). | Remains withheld for the same laboratory assumption; adds advisory `proposed_resource` for `annotated code samples`, which the instructor proposes providing. The new advisory does not release or add a hard reason to this draft. |

The other fourteen review records are unchanged, including their evidence:

| Cases | Retained result |
|---|---|
| `af-prog1-irrelevant`, `af-sensors-passive` | Resource-dependent/copying drafts remain withheld. |
| `as-prog1-recall-quiz`, `as-prog1-too-high` | Plausible drafts remain eligible with advisory `borrowed_wording` only. |
| `af-prog1-lab-unused`, `as-syseng-essay` | Plausible drafts remain eligible. |
| `af-prog1-good`, `as-prog1-good`, `as-prog1-conceptual-ok`, `af-prog1-conceptual-lecture-ok`, `af-sensors-good`, `as-sensors-good`, `af-prog1-alternatives`, `af-prog1-week1` | ALIGNED; no correction generated. |

The new checker review now matches the earlier manual decision that the notes draft was unusable. This is a software-safeguard result, not new model accuracy evidence. The earlier exploratory summary is deliberately unchanged: it continues to record the reviewer failure at the time it happened.

## Verification and preservation

| Check | Result |
|---|---|
| Targeted resource/corrections/verdict/reuse/prompt tests | **57 passed**, zero failures |
| Complete `npm test` | **1,296 main tests + 22 localization tests + 55 UI tests + 12 PDF-import UI tests passed**; 1,385 total executions, zero failures/skips |
| General localization audit | Passed: 2,213 bilingual keys, 1,164 interface references, no hardcoded display strings |
| Verdict localization audit | Passed: **0/55** server sentences untranslated |
| Production build | Passed; existing large-chunk advisory remains |
| `git diff --check` and new-file whitespace check | Passed |
| Saved-input/ledger integrity and prompt comparison | Passed |

The new regressions cover the exact saved failure; unknown/supported/unavailable materials; creation, conditional and uncertain wording; sibling-only evidence; ordinary syntax; previous laboratory/simulator assumptions; legitimate shared wording and genuine contamination; missing upstream evidence; offline fallback; cached judgment reuse; final report/saved-report/API JSON filtering; and English/Tagalog printable-panel output.

Official scores, deductions, passing mark **79**, readiness, conformance, submission gates, title policy, default feature flags and faculty content are compared in the scripted engine tests and remain unchanged. Missing-upstream withholding retains its precedence. Offline fallback makes no model call or invented pass. Existing Hybrid-2 architecture and approved references remain intact.

The final integrity check compared 561 existing text/configuration files with the pre-edit snapshot. **554 are byte unchanged**, including all historical evaluation artifacts, ledger entries, dataset expectations, production environment, curriculum/scoring/gate policy and academic prompt definitions. The seven changed existing files are listed below. The full Stage C r8, C1-only r8, C2-only r8, D1-only r7, D2-only r7 and all-off legacy prompts and versions also compare byte-for-byte with the pre-edit implementation. There is no academic prompt revision or cache invalidation: the local draft review is refreshed instead.

Logs and preservation snapshots are under `tmp/stage-e8-resource-*`, including `stage-e8-resource-full-test-final.log`, `stage-e8-resource-targeted.log`, `stage-e8-resource-replay-final.log`, both audit logs, the build log, final integrity audit and free live-plan output. These do not contain provider responses from a new evaluation.

## Files changed for this fix

- `server/lib/syllabuscheck/recommendationReview.js`: contextual material grounding and proposal/uncertainty classification.
- `server/lib/syllabuscheck/gemini.js`: local review version and Stage C cache refresh; academic prompt unchanged.
- `server/lib/syllabuscheck/reportSafety.js` (new): final/saved-report withholding filter.
- `server/lib/syllabuscheck/engine.js`, `server/lib/syllabuscheck/repository.js`: use that filter at output and serialization boundaries.
- `src/components/VerdictPanel.jsx`, `src/i18n/hybrid.js`: defensive rendering and bilingual advisory explanations.
- `server/lib/syllabuscheck/stage-e8-resource-grounding.test.js` (new), `tests/i18n-ui.test.jsx`: false-negative, false-positive, cache/output, invariant and printable-panel regressions.
- `scripts/replay-stage-e8-resources.cjs` (new): reproducible saved-response-only replay.
- `docs/ai-eval-stage-e8-c-resource-replay.json` and this report (new): derived evidence, findings and future plan.

No original evaluation, ledger, expectation, faculty text or unrelated unfinished implementation was overwritten. No migration, production setting change, commit, push, merge, deployment, normalized-title activation or Phase 3 work occurred.

## Limitations and proposed targeted live regression

The reviewer is still a conservative English-language heuristic. It cannot verify real inventory or guarantee interpretation of all synonyms, pronouns and complex clauses. New soft cautions can add faculty-review work; the regression controls found no new hard false positive or over-withholding among the sixteen saved answers. That is not a measured population precision estimate. The existing field disagreement and explanation overstatement remain unresolved academic issues. UI localization does not translate or certify model-authored reasoning.

Reading an old report filters its recorded withholding codes; reusing a cached judgment reruns current local review against the full current pair. Historical reports lacking their full original pair context cannot be exhaustively re-grounded merely from partial quotations, and are not silently rewritten. A current checker review and faculty confirmation remain necessary before treating an older unreviewed proposal as usable.

**Proposed only, requiring separate approval:** one small six-case live regression, using existing unchanged cases that have already been evaluated:

| Case | Purpose |
|---|---|
| `af-prog1-single-format` | Known bypass: any newly assumed notes must be withheld; a genuine preparation/conditional proposal may remain advisory. |
| `af-prog1-passive` | Practical learning must remain supported; distinguish a laboratory assumption from a proposal to provide samples. |
| `af-prog1-alternatives` | Own-lesson stated resources and learner alternatives remain supported. |
| `af-prog1-conceptual-lecture-ok` | Preserve the correction of unnecessary practical work for a conceptual ILO. |
| `af-sensors-passive` | Preserve equipment/software/handout grounding and contamination protection. |
| `as-prog1-recall-quiz` | Preserve practical assessment and legitimate shared-wording suggestions. |

The free `--plan` check confirms six items, three initial model batches, C1/C2 only, full `alignment-12c1c2-r8`, trimming/minItems off and a 90-second timeout. No prompt change is warranted by this reviewer failure. The twelve unseen cases are explicitly outside this proposal. A live output that contains no preparation/conditional recommendation cannot establish model compliance with those particular instructions; retain the offline controls separately.

Suggested limits are **eight additional HTTP attempts and $0.03 additional charge**, enforced by reusing the unchanged ledger with cumulative ceilings of **24 attempts/$0.03669119**. The five initial requests would be one counted key check, one counted price lookup and three model requests, leaving at most three further attempts inside the cap. Retries are not a completion guarantee. At historical rates, the free plan estimates approximately **$0.0021-$0.0058** for the full prompt; this is not a current price quote. Current endpoint bounds must be fetched through the guard only after approval, with worst-case reservations and reconciliation before every send. A timeout or missing usage can consume a reservation and stop the run early.

Retain the historical transient counter, all ledger entries, `--accounting reconcile`, `--max-transient 3`, first-invalid/unproductive stop limits, unresolved-coverage checks and `--review-between-batches`. Stop at any access/billing refusal, cap, serious schema/quote problem, repeated academic error, or unflagged unsupported correction. Review every batch before the next request. Use a new output path, `docs/ai-eval-stage-e8-c-resource-regression.json`; do not overwrite either r8 cohort. Report model-output quality separately from reviewer containment, unchanged provisional-label agreement and structural validity.

This plan has not run. The original remaining-case run remains stopped, no new paid request is authorized by this document, and no model evaluation is scheduled.
