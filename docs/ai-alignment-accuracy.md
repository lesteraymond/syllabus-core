# AI alignment accuracy: status, protocol and what is still needed

Status on 2026-10-23: **no accuracy improvement has been demonstrated yet.** The prompt in production is unchanged since the clarification of the source/target direction (`alignment-10`). The comparison of prompt wordings could not be run because the OpenRouter credit is exhausted (HTTP 402). Everything needed to run it is in place.

## 1. Baseline (before this pass)

Model `minimax/minimax-m3.1-flash`, prompt `alignment-10`, the 41-item `dataset.json` (unreviewed labels), 3 runs, run before the credit ran out. Stored in `docs/ai-eval-baseline-prompt10.json`.

| Relationship type | Items | Answers | Agreement with the author's accepted verdicts |
|---|---|---|---|
| CLO → PO | 10 | 30 | 90.0% (the only disagreements: the disputed interdisciplinary item) |
| CLO → EGA | 2 | 6 | 100% |
| CLO → any PO | 2 | 6 | 100% |
| ILO → CLO | 4 | 12 | 100% (75% before the direction fix) |

Overall for all 10 types: agreement 97.5%, false rejections 7.5% (3/40), false approvals 0% (0/66), never-verified answers 3.3% (4/123), repeatability 94.9%. These came from one model, one dataset, and 3 runs; they are a baseline, not a claim of faculty agreement. Results by discipline, partial-alignment accuracy and retry rates were **not** recorded in that run (the harness did not compute them); the harness now does.

## 2. What was built for the comparison

- `server/lib/syllabuscheck/eval/alignment-dataset.json` (`align-1`): 100 items on ILO-CLO, CLO-EGA, CLO-PO and the whole-list pairs; 8 courses in 6 disciplines; a **development** split (58) and a **held-out** split (42); 8 items whose single best answer is PARTIAL; categories for different wording, keyword overlap, broad CLO / narrow ILO, specific CLO / broad PO, interdisciplinary, wrong-program, contradictory and level-gap cases. The 16 older items are included unchanged with their origin. **Written by the assistant, not by faculty.**
- `variants.js`: `current`, `calibrated` (only the verdict boundaries; drops "when in doubt choose PARTIAL"), `rubric` (calibrated + a relationship rubric based on "does it contribute", where different wording is fine and a specific CLO can support a broad PO), `rubric-ordered` (rubric + the model writes its explanation before its label). Production uses `current` unless `SYLLABUS_CHECK_PROMPT_VARIANT` says otherwise, and the variant is part of the cache key.
- `scripts/eval-alignment.cjs`: runs a split through the app's own retry path; reports agreement, false approvals, false rejections, partial accuracy, repeatability, the confusion matrix, results by type, discipline and category, and the retry rate. The held-out split prints aggregates only and every run is logged in `docs/ai-eval-heldout-log.jsonl`.
- `scripts/eval-compare.cjs`: runs the variants one after another and prints them side by side.
- `scripts/export-eval-review.cjs --dataset alignment`: the spreadsheet for faculty (`docs/ai-eval-faculty-review-alignment.csv`).

## 3. Decision rule, fixed before any variant is run

1. Run `node scripts/eval-compare.cjs --runs 3` on the **development** split (about 58 items × 4 variants × 3 runs: roughly 10 to 20 US cents on the paid model, an estimate from earlier usage, not a measurement). Do not look at the held-out split yet.
2. A variant is a candidate only if, compared with `current` on the same runs, **all** of these hold:
   - agreement is higher by at least 3 points;
   - the false-approval rate is not higher by more than 2 points;
   - no relationship type loses more than 10 points of agreement;
   - the never-verified rate and retry rate are not higher;
   - repeatability is not lower by more than 5 points.
3. Among candidates choose the **simplest** one (`calibrated` before `rubric` before `rubric-ordered`). If none qualifies, nothing changes and the result is reported as "no improvement shown".
4. Run the chosen variant and `current` **once** each on the held-out split (`--split heldout`). Adopt the variant only if its held-out false-approval rate is not worse than `current`'s and its agreement is not lower. A held-out result that disagrees with the development result is reported as such, and the variant is not adopted.
5. Even then, a prompt change is a change to what counts as aligned for every syllabus. Show the faculty the cases whose verdict changed before it goes to production, and bump the prompt version (the variant name already does this for a trial).

## 4. What would make the numbers trustworthy

- **Credit.** The paid model has roughly $0.004 left (estimated from the "can only afford 7349 tokens" error), which is less than one dev-split run. A few dollars of OpenRouter credit is enough for the whole protocol; it needs nothing else.
- **Faculty labels.** Both CSV files need faculty verdicts. Until then every agreement, false-approval and false-rejection figure is measured against the assistant's own judgement. The most important to settle: the 8 PARTIAL items, the 7 ambiguous items, and the interdisciplinary CLO that the model keeps calling partial.
- **EGA definitions.** CLO → EGA is judged from a name of a few words. If the school has an official description of each graduate attribute, adding it to the data would help more than any prompt wording. It must come from the school; it has not been invented here.
- **More items.** Per-type and per-discipline samples are small (some cells have fewer than 5 items). Treat any per-discipline difference as a hint only.

## 5. What was changed in the application in this pass

All of it keeps the official score, the pass mark, the blocking rules and the API shapes unchanged.

- Empty source or target: reported as insufficient text without a provider call (it used to be sent to the AI, which could only guess), never reused.
- The panel shows ILO-content, Description-plan and the whole-list CLO checks as advisory ("improve"), as the server already treats them.
- Prompt variants for testing, off by default.
- Tests: `alignment-safety`, `variants`, additions to `eval`, `hybridView`.
