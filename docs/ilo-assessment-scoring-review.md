# ILO–Assessment scoring: impact assessment and migration proposal

Date: 2026-10-29. Status: **proposal only**. No scoring, deduction, policy or submission-gate code was changed. The 47 deterministic rules, the pass mark of 79 and the Program Outcomes are untouched.

Scope: the scored `ILO-assessment` relationship (verdict rule ALN-07), which compares each ILO with its lesson's Suggested Assessment Tasks.

## Summary

- **Today the check is scored.** Each NOT_ALIGNED answer costs 3 points and each PARTIALLY_ALIGNED answer 1. One unanswered pair leaves the whole check incomplete, with no official score.
- **The required architecture has no direct ILO → Assessment relationship.** Assessment tasks are judged against the course content (Stage C3, ALN-12) and against the learning activities (C3, ALN-13). The activities are judged against the ILO by the scored ILO-activity check (ALN-05).
- **Recommendation: make it advisory-only, not removed, under a new policy version, after a shadow comparison.**
- **Consider removal only after Stage C3 passes a faculty-reviewed evaluation and is switched on, and after Stage C2 is rebased.** Removing it now would leave assessment tasks with no semantic check at all while C3 is off, which is its default. It would also silently stop Stage C2.

## 1. What the check does today

| Aspect | Behaviour | Code |
|---|---|---|
| Pairs | One per ILO per lesson: the ILO text against the lesson's tasks. The three LCUP fixtures would produce 20, 15 and 15 pairs. | `gemini.js:169`; counts from `docs/lcup-evaluation-readiness/academic-readiness.md` |
| Question asked | The task collects evidence of the ILO's own action verb, reaches its Bloom level, covers its subject and says what is produced. | `gemini.js:112`, `acceptance.js:17` |
| Scored | It is not in `POLICY.advisoryTypes`. | `policy.js:10` |
| Points | −3 for NOT_ALIGNED, −1 for PARTIALLY_ALIGNED, with no cap. | `policy.js:6`, `engine.js:335`, `engine.js:338` |
| Unanswered pair | It is re-asked and then recorded as INSUFFICIENT_EVIDENCE. That gives a blocking `SEM` finding, keeps the alignment from completing (`AI-REQUIRED`, blocking) and leaves no official score (`status: 'incomplete'`). | `engine.js:337`, `gemini.js:887-888`, `engine.js:462`, `engine.js:470`, `engine.js:491`, `service.js:215` |
| Verdict | ALN-07, shown as FAIL/MAJOR for NOT_ALIGNED. **`verdict.js` keeps its own hard-coded advisory list**, separate from the policy. | `verdict.js:20`, `verdict.js:161`, `verdict.js:166` |
| Tier | `material`, derived from the policy, so it would follow a policy change automatically. | `acceptance.js:42` |
| Submission gate | The coded hard gates always apply. The AI result is required only when `SYLLABUS_CHECK_AI_GATE=required`. The default, and this installation (the variable is unset), is `advisory`, so **this check does not block submission today**. It does affect the score, `ready`, `passed` and the verdict. | `service.js:34-50`, `policy.js:19-21` |
| Stage C2 | C2 asks its deeper Assessment-fit question only for a lesson whose scored ILO-assessment answers are all ALIGNED. C2's findings also report under ALN-07. | `lessonfit.js:103-120`, `engine.js:186-191`, `verdict.js:20` |
| Recommendation order | A NOT_ALIGNED answer marks the tasks as invalid, which holds back the values drafts (Value-use, and Module-value when D1 is on) until the tasks are fixed. | `lessonfit.js:70`, `lessonfit.js:98` |
| Recorded policy | Every report stores `scoring.official.policy` (`syllabus-policy-2`), so past deductions stay explainable after a policy change. | `engine.js:497` |

## 2. Measured impact (offline)

Method: `scripts/whatif-ilo-assessment.cjs` runs the synthetic fixture (15 ILOs, so 15 of the 100 pairs per check) through the real engine.
- Each proposed policy is applied in memory, in that process only.
- The model is scripted: the ILO-assessment pairs get the labels in the table, every other pair is ALIGNED.
- Fetch is blocked. Nothing is written and nothing is sent, so the runs have no cost.
- `server/lib/syllabuscheck/ilo-assessment-whatif.test.js` pins these figures.

Score with a base of 100 (pass mark 79):

| ILO-assessment answers | Current | Advisory (policy list only) | Advisory (policy + verdict list) | Removed |
|---|---|---|---|---|
| all ALIGNED | 100 | 100 | 100 | 100 |
| one NOT_ALIGNED | 97 | 100 | 100 | 100 |
| three NOT_ALIGNED | 91 | 100 | 100 | 100 |
| all 15 NOT_ALIGNED | **55, fails** | 100 | 100 | 100 |
| all 15 PARTIALLY_ALIGNED | 85 | 100 | 100 | 100 |
| one unanswered | **no score: blocking SEM + AI-REQUIRED** | 100, completes | 100, completes | 100 |
| ALN-07 severity of a failure | MAJOR | **still MAJOR** | MINOR | ALN-07 left NOT_CHECKED |
| Pairs sent per check | 100 | 100 | 100 | 85 |
| Stage C2 questions (C2 on, all aligned) | 15 | 15 | 15 | **0** |

At the LCUP fixtures' size (20 pairs), the current worst case is −60 points.

Under both advisory variants, the recommendation is unchanged: the same proposed rewrite of the tasks text, for faculty to accept or not.

## 3. Evidence from real models

The only labelled evidence is the five ILO-assessment items of the alignment dataset. Their labels were written by the developer and are provisional; they are not faculty-reviewed.

| Run | Answers | Agree |
|---|---|---|
| MiniMax, prompt alignment-9 (`docs/ai-eval-baseline-prompt9.json`) | 8 (2 invalid) | 8 |
| MiniMax, prompt alignment-10 (`docs/ai-eval-baseline-prompt10.json`) | 15 | 15 |
| Claude Sonnet 5.5, A1 (`docs/ai-eval-anthropic/p2-a1-result.json`) | 10 | 10 |

The model agrees with these five author labels, but five items say nothing about faculty agreement or about how often real syllabi would lose points. This evidence neither justifies keeping a −3 penalty nor removing it. The deciding question is academic (section 4).

## 4. The academic question

In outcome-based education, constructive alignment treats the ILO–assessment link as central: the task is where the ILO is demonstrated. The required architecture covers it **indirectly**:

- ILO → Learning Activities (scored, ALN-05) checks that the activities practise the ILO's action and level.
- Learning Activities → Assessment Tasks (C3, ALN-13) checks that the tasks assess what the activities practised.
- Course Content → Assessment Tasks (C3, ALN-12) checks that the tasks cover the week's topics.

Two gaps follow:

1. **Level mismatch becomes advice.** Suppose the activities practise the ILO and the task assesses only a lower part of that work, for example a recall quiz after a design activity. Today that costs points (ALN-07). Under the required architecture it surfaces only as advisory ALN-13 advice.
2. **With C3 off, there is no semantic check of tasks at all.** C3 is off by default and has not been evaluated with faculty-reviewed labels; `eval/stage-c3-dataset.json` is a draft. If ILO-assessment were removed now, tasks would only be checked for presence (rule T-16). The advisory option keeps the check running as advice, so this gap does not arise.

## 5. Options compared

| | A. Keep scored | B. Advisory only (recommended next step) | C. Remove |
|---|---|---|---|
| Points / pass mark | −3 / −1, can fail a syllabus | none | none |
| Unanswered pair | blocks completion, no score | does not hold the check open | not asked |
| Faculty still see the advice | yes | yes (ALN-07 as MINOR) | no |
| Stage C2 | works | works | **stops** unless its trigger is rebased |
| Values-draft order (D1) | works | works | relies on C2/C3 answers only |
| Cost | 15–20 pairs per syllabus | unchanged | 15–20 fewer pairs |
| Tasks checked semantically with C3 off | yes | yes (advice) | **no** |
| Reversible | n/a | yes: switch back to policy 2 | yes: build the pair again (checks run meanwhile have no ILO-assessment answers) |
| Fits the required six relationships | no | yes: no direct ILO → Assessment scoring | yes |

## 6. Proposed migration (each step needs your approval)

0. **Now:** nothing changes. This document and the offline what-if are the deliverable.
1. **Shadow comparison.** Compute a second, never-official score without ILO-assessment deductions, next to the official one, as `scoring.js` already does for `shadow-1`. Read it from the checks the system already runs, with no extra paid calls. Count how many syllabi would change pass/fail and which ALN-07 findings would stop costing points.
2. **Advisory under `syllabus-policy-3`**, behind an explicit switch that defaults to policy 2:
   - add `'ILO-assessment'` to `POLICY.advisoryTypes` and bump the version;
   - add it to `verdict.js`'s own advisory list (`verdict.js:161`). Without this, failures stay MAJOR, as the what-if shows. The cleaner fix is to make `verdict.js` read the policy list;
   - the acceptance tier follows automatically.

   Reports keep their own policy version. With `SYLLABUS_CHECK_AI_GATE=required`, the gate reuses a cached report keyed by content and standard version, not by policy version, for up to 30 minutes (`service.js:43-46`). Either add the policy version to that key or accept a 30-minute overlap at the switch.
3. **Removal, only if still wanted, after C3 has passed a faculty-reviewed evaluation and is on:**
   - rebase C2's trigger on the C3 answers or ask it without one (`lessonfit.js:103-120`);
   - keep ALN-07 for C2's Assessment-fit findings or retire it;
   - stop building the pair (`gemini.js:169`).

Rollback at any step is switching back to policy 2.

## 7. What each option would need to change (not changed)

- **Option B:** `policy.js:5`, `policy.js:10`, `verdict.js:161`, plus tests that pin the current lists:
  - `advisory.test.js:23` (the advisory list);
  - `stage-e9-phase3.test.js:1204` (A9.2: 6 scored types, which also regenerates the Phase 3 faculty package);
  - `ilo-assessment-whatif.test.js` (its "current" figures).
- **Option C:** the above plus `gemini.js:169`, `lessonfit.js:103-120`, `verdict.js:20`, and 46 references in 16 test files: `stage-c3.test.js` 14, `stage-c.test.js` 7, `stage-e9-phase3.test.js` 4 and others.
- **Both options:** `docs/ai-checker-rules.md` lists ILO-assessment as `material` (`:341`). It is hash-pinned (`stage-e9-phase3.test.js` A8.2), so it can only be regenerated with `scripts/export-checker-rules.cjs`, with approval and a new pin.

## 8. Decisions needed

1. Does the institution accept indirect coverage (ILO → Activities → Assessment) in place of a scored direct ILO → Assessment check? This is an academic decision for faculty, not a software one.
2. Approve step 1 (shadow comparison) and/or step 2 (advisory policy 3).
3. If C3 is later switched on, should the advisory ALN-07 advice still be shown next to C3's ALN-12/ALN-13 advice on the same tasks field? Showing both may duplicate advice.
