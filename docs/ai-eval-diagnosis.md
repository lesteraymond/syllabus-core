# AI checker: evaluation diagnosis (prompt `alignment-10`, dataset `eval-1.1`)

Everything here is an **unreviewed baseline**. The dataset (`server/lib/syllabuscheck/eval/dataset.json`) was written by the developer and has not been checked by faculty, so none of these numbers measure agreement with faculty. They show how the checker behaves and let two prompts or models be compared with each other.

Model for all runs below: `openrouter/minimax/minimax-m3.1-flash`. The OpenRouter credit ran out during this work (HTTP 402), so the last runs could not be repeated.

## 1. Results

| | prompt 9 (2 runs, 82 answers) | prompt 10 (3 runs, 123 answers) |
|---|---|---|
| Agreement with the author's accepted verdicts | 93.5% | 97.5% |
| False positives (clear ALIGNED judged otherwise) | 14.8% (4/27) | 7.5% (3/40) |
| False negatives (clear not-aligned judged ALIGNED) | 2.4% (1/41) | 0.0% (0/66) |
| Invalid answers (raw, before the app's retries) | 6.1% (5/82) | 3.3% (4/123) |
| Run-to-run stability | 100% (2 runs) | 94.9% (3 runs) |
| ILO-CLO agreement | 75.0% | 100.0% |
| REF-plan invalid answers | 3 of 6 | 4 of 9 |

The two columns use different numbers of runs, so differences of a few points are within what one more run could change. The one result that is not noise: ILO-CLO went from 75% to 100% and the cooking-book false negative disappeared, both after the prompt change below. REF-plan is **not** fixed.

Per-type results and the disagreements are in `docs/ai-eval-baseline-prompt9.json` and `docs/ai-eval-baseline-prompt10.json` (the first has no per-item answers; later runs of `scripts/eval-alignment.cjs` store them).

## 2. The four failures, with the evidence

| Failure | What the model's own output showed | Cause | Action |
|---|---|---|---|
| **Cooking book judged ALIGNED** | Alone, 4 of 4 runs: label `ALIGNED`, explanation "…has no plausible bearing on limits, derivatives… so it **cannot support** the weekly topics". In a batch it said `NOT_ALIGNED`. | **Model limitation**: its label contradicted its own explanation. The prompt had no test list for REF-plan, which made it easier to slip. | REF-plan got tests like the other types and a rule that the label must agree with the explanation. Not provable as fixed (false negatives 1 → 0 across different run counts). The REF item could not be re-run after the credit ran out. |
| **REF-plan answers refused** | In a batch of 3, all three answers had `sourceQuote` copied from the **target** ("Differential Calculus\nWeek 1: …"), 3 runs of 3. | **Prompt gap**: the prompt never said which side is the source. Validation was right to refuse them. | The prompt now says what source and target are for every type and that each quote comes from its own side. Still 4 of 9 REF answers invalid with prompt 10; the reasons were not captured (see below). |
| **ILO-CLO answered INSUFFICIENT_EVIDENCE** | "No ILO is supplied… the source text is the course's own CLO statement". It was looking at the CLO in the source and, not told the direction, concluded no ILO was given. | **Prompt defect**, and a real one: INSUFFICIENT_EVIDENCE blocks the score. | Fixed by the direction paragraph. ILO-CLO 75% → 100%. Regression test added. |
| **Clearly-aligned programming ILO-CLO judged PARTIAL** | Alone it was ALIGNED 2 of 2; in the batch PARTIAL twice. | **Batch-context variation** (a model limitation). Not reproduced after the prompt change (ILO-CLO 100%). | None beyond the above. |
| **Interdisciplinary CLO judged PARTIAL** | PARTIAL in 3 of 3 runs. Reason: the PO asks to analyze the impact of computing on individuals, organizations **and society**; the CLO evaluates the ethics of **one software system on its users**. | **Ambiguous label** (the model is defensible). | The expected verdict was **not** changed. The item carries a `diagnosis` proposing it be called ambiguous, awaiting faculty. |

What I could not establish: why the REF-plan batch is still refused with prompt 10. The reasons were not recorded. The harness and the checker now record them (`rejected: [{ id, reason }]`, e.g. "source quote"), so the next run will say exactly which quote failed.

### Distinguishing the causes

- **Prompt problems** (confirmed, fixed): the direction of source and target; no REF-plan tests.
- **Output-validation problems**: none found. Every refusal was correct; the message now names which quote failed.
- **Model limitations**: label contradicting explanation; verdict changing between a pair asked alone and in a batch.
- **Ambiguous test labels**: the interdisciplinary CLO; the five items already marked ambiguous.

## 3. Review of the dataset

- 41 items, no duplicates. Calculus is 25 items, programming 12, nursing 4.
- ILO-content, Module-value, Description-plan, REF-plan and CLO-anyPO are tested in calculus only. CLO-EGA has 2 items and no clear-ALIGNED example.
- 13 clear-ALIGNED against 21 clear not-aligned items: the false-positive rate rests on little data.
- Missing: INSUFFICIENT_EVIDENCE (empty text), Filipino text, year 3–4 courses, other disciplines, mixed batches, multi-tag cases.
- Expected labels are pinned by a hash in `eval.test.js`: changing one fails the test until it is logged in `dataset.changeLog`.
- For faculty: `docs/ai-eval-faculty-review.csv` (made by `scripts/export-eval-review.cjs`) has the source text, relationship type, expected verdict, rationale, ambiguity and diagnosis, the model's answers, and empty columns for the faculty verdict and notes.

## 4. Institutional alignment: verified intact

Covered by `institutional.test.js` (8 tests, all passing), on top of the existing `validation.test.js` and `engine.test.js`:

| Rule | Verified by |
|---|---|
| Each program uses its own PO definitions | The CLO-PO source is the program **master** text, not the copy in the syllabus; a syllabus with another program's POs is blocked (`PO-EXACT`) and the suggested fix is the master list. |
| No official POs for the program | Reported as `PO-MASTER` (blocking); no PO text is invented or sent to the AI. |
| CLO → EGA / PO tags follow the official lists | A tag that does not exist, or a CLO with none, is `CLO-MAP` (blocking); the missing text is empty and not sent. |
| Each ILO has at least one existing CLO | `ILO-MAP` (blocking); a tag to a CLO that does not exist is not judged and no CLO text is invented. |
| Meaning on top of tag existence | With every tag valid, a NOT_ALIGNED answer still produces a finding and a rewrite of the CLO statement. |
| Authors never edit official text | AI suggestions can only target description, CLO statements, ILO texts and the lesson's contents, activities, tasks and values; never tags, vision, mission, EGAs, POs or meta. |

No deterministic rule was duplicated or replaced.

## 5. Phase 4: plan for an advisory course-level AI review

Goal: a whole-syllabus review (coherence, progression, coverage, assessment opportunities) that is advisory, off by default and adds no required field.

1. **A new module, `course-review.js`, beside `quality.js`.** Same shape of finding (`id`, `category`, `severity` minor/info, `confidence`, `affected`, `evidence`, `impact`, `action`), appended to `hybrid.quality.findings` with check ids `course.*`. The panel already renders them, so there is no UI work.
2. **A compact course map built in code**, not sent as raw syllabus: course context; the CLO list with ids; one line per lesson with week, ILO, CLO tags, contents, activities and tasks (each trimmed); the grading rows; and facts already computed (which weeks build each CLO, first practice week, first assessment week). About 3–5k tokens.
3. **One extra AI call per check** with its own `COURSE_REVIEW_PROMPT` and version `course-review-1`. The prompt asks for specific findings only, forbids rewrites and drafts, and says an absence is not a defect.
4. **Server validation of the output**: fixed categories and severities; at most 8 findings; every id must exist in the map; every evidence quote must appear in the map; unknown fields refused. A finding that fails is dropped, not repaired.
5. **Reuse**: the call is skipped when the hash of (prompt version, model, course map) is unchanged, using the same history as the pair reuse.
6. **Isolation**: a provider failure stores `courseReview: { status: 'unavailable', failure: { kind } }`; it can never change the score, the gate, `ready`, or whether a check is complete.
7. **Rollout**: `SYLLABUS_CHECK_COURSE_REVIEW=off` by default → `shadow` (stored, not shown) → `on`. Nothing changes for anyone until it is switched on.
8. **Tests**: map builder is deterministic; validation rejects invented ids and quotes; reuse; failure isolation; prompt-injection text in a lesson changes nothing; with the flag off, a full check is byte-identical to today's (golden test).
9. **Evaluation**: it needs course-level cases written and reviewed by faculty. I did not invent any.

Open questions for faculty: what counts as adequate practice before an assessment; whether a CLO built in one lesson only is acceptable; and what workload standard to use.
