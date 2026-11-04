# Why the checker kept suggesting after suggestions were applied

Investigated 2026-10-23 from the stored runs of one syllabus (id 102, 73 stored checks, 1,157 AI text suggestions, 772 recorded decisions) and the code. Two different loops were found, plus a third flaw that fed the first.

## What the data showed

**Loop A: the same suggestion, 15 checks in a row (runs 366 to 383, Llama 4 Maverick).** The same two suggestions were offered and accepted every time; the number of non-aligned relationships stayed exactly 5; the saved content's hash was **identical in every run**. The "rewrite" was character-for-character the current text (267 characters against 267, and 354 against 354). The model judged the text PARTIALLY_ALIGNED and returned its own input as the fix. Accepting it changed nothing, and because verified verdicts are reused while the text is unchanged, the verdict (and the useless draft) came back each time.

Across all stored checks, 47 of 1,157 AI suggestions (4.1%, in 24 checks) were rewrites that change nothing (45 identical, 2 differing only in case or punctuation).

**Loop B: a new wave every round (runs 397 to 407, MiniMax).** After the author applied about 20 suggestions per round, each following check showed (relationships present in both):

| Round | Flagged and now ALIGNED | Still flagged | **Newly flagged (were fine)** | Relationships whose text changed |
|---|---|---|---|---|
| 397 to 398 | 15 | 23 | **18** | 69 of 117 |
| 398 to 399 | 16 | 25 | **10** | 66 of 117 |
| 399 to 400 | 7 | 10 | 2 | 53 of 53 |
| 400 to 401 | 8 | 13 | 4 | 26 of 68 |
| 401 to 402 | 19 | 21 | 3 | 46 of 144 |

One rewrite is written for one relationship but changes text that up to four others use (an ILO text is the source of its activity, content and assessment relationships and the target of its CLO relationships), so each round re-judges most of the syllabus. Some of the flips are genuine breakage, some are the model answering differently for the same pair in a different batch (seen directly in the evaluation work). Nothing recorded whether a correction had worked, and nothing limited how many times a field was rewritten.

**Flaw C, the group draft.** A CLO tagged to four POs had all four judged PARTIAL. The policy says one aligned PO is enough, but the rewrite was written from the *most serious* tag, and where they tied from the first, so it tried to serve all four at once. This is the likely source of the degenerate no-op draft in loop A.

## Why this is not simply "the AI is strict"

The strictness (a PARTIAL for most multi-part outcomes) feeds both loops, but the cycle itself came from missing controls: no filter for a rewrite that changes nothing, no memory of what was already applied, no limit, and no distinction between "required" and "nice to have" in what was presented.

## What changed

| Principle | Change |
|---|---|
| 1, 9 Distinguish the kinds; keep optional apart | Every recommendation has a `tier`: **mandatory** (required rules), **material** (a scored relationship, or a lesson with no core value), **optional** (advisory relationships, reference pages, quality notes). Shown as a label on the card. Scoring is untouched. |
| 3 Acceptance criteria | `acceptance.js` states, for each relationship type, when it is accepted and its tier; restated from the existing prompt tests and policy, nothing new. Printed in the rules document. |
| 2, 6, 8 No marginal rewrites; preserve valid content | A proposed text that is identical, differs only in case or punctuation, only reorders the same words, or only changes function words is **never offered** (`stewardship.isTrivialRewrite`). The finding and its points stay. Adding one real content word is still a change. "Check & improve" refuses the same no-ops. |
| 4 Verify the correction | The saved decisions are read back (`repository.correctionHistory`). Each applied correction is reported as `resolved`, `improved`, `unresolved` or `regressed` against the verdicts it was for. |
| 11 Limit attempts | At most **2 rewrites per field** (`policy.maxRewriteAttempts`), counted since the field last passed. After that the field is listed under "Needs your decision" with the reason; the problem is not hidden and keeps its points. |
| 7 Fluctuating verdicts | A relationship that passed at the previous check and is flagged now gets a **second look, on its own**; the milder verdict stands. A flag is raised only when two looks agree. Reused and already-flagged relationships are not second-guessed. |
| Flaw C | Inside a group of tags where one has to pass, the draft is written from the tag **closest to aligned**. All tags still show their findings and cost their points. |
| 5, 10 A clear result | `summary.status`: `mandatory_open`, `incomplete`, `material_open` or `no_changes_needed`. An unfinished AI check is never "no changes needed"; optional advice never keeps it from being so. Shown at the top of the panel. |
| 12 Preserve the rest | Program POs, the CLO and ILO mappings, the API shapes (only fields added), the cache and the official score and pass mark are unchanged. A test asserts that stopping a rewrite never removes a deduction. |

## Evidence it works as designed

- `revision-cycles.test.js` (12 tests) covers each case asked for: a clean syllabus gets no corrective suggestion and a "no changes needed"; a valid correction is reported resolved; a real violation keeps being reported (another attempt, then a stop with the explanation); optional advice is labelled optional; repeated checks produce the same recommendations and no provider call; a fluctuating verdict is overturned by the second look; a correction that breaks another relationship is detected as regressed and charged.
- The tests were checked against mutations: with the no-op filter and the attempt cap switched off, tests 4 and 5 fail; with the second look switched off, test 7b fails.
- Replayed on the real stored data, the no-op filter withholds the 47 suggestions described above. The history loader, run against the real database, finds that this syllabus's description has already had 2 corrections (so it is now at the limit) and 10 other fields have had 1.

## What is not proven

- **The second look and the closest-tag draft have not been measured on a live model.** The provider credit is exhausted, so their effect on real flip rates (the 18 and 10 new flags per round) is untested. The tests use a scripted model. The expected effect is a smaller wave, not none: a genuine rewrite that breaks a neighbour is still detected, by design.
- **The cap is a bound, not a cure.** At most 2 rewrites per field means the cycle ends, but a syllabus can still take several rounds across many fields, and a field the checker stops on needs a human decision.
- **Rewrites are still written by the model.** Whether a draft really fixes the gap is judged only by the next check (or by "Check & improve", which is manual). Nothing verifies a draft before it is offered; that would cost several requests per suggestion.
- **Row ids are positional.** Reordering lesson rows changes relationship ids, so the history for those rows is lost and they start again.
- **The history covers the last 8 checks.** A correction older than that is forgotten.
- **Strictness is unchanged.** The doubt rule ("when in doubt choose PARTIAL") is still in the prompt; testing alternatives needs provider credit (see `docs/ai-alignment-accuracy.md`). Until then the number of material findings per syllabus will stay high.
- **The screen was built and its translations pass the localization audit, but I did not run it in a browser.**
