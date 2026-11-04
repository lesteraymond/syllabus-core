# Hybrid-2 AI Checker: P2 B2 (mode B enhanced) against A2, with Claude Sonnet 5.5

**Status: B2 ran on 2026-10-28** (local time; `ranAt` 2026-10-27T19:58:25Z) and took about four and a half minutes. Only B2 ran. B3, P3–P5 and any held-out evaluation were not run. Claude stays evaluation-only: no official score, readiness check or submission gate used these answers.

**This report keeps four kinds of evidence apart:**

| Kind | What it rests on | Sections |
|---|---|---|
| Technical validation | Checks done by code: JSON, the validator, verbatim quotes, model identity, retries, the guard's accounting | 1, D, F |
| Agreement with provisional expectations | The dataset's expected verdicts. A developer wrote them, and faculty have not reviewed them (`reviewStatus: unreviewed`) | A, B |
| Recommendation appropriateness | My developer review of B2's 75 drafts and 16 re-tags beside A2's 82 drafts, against rules fixed before the run. It is not a faculty review | C |
| Faculty-validated academic correctness | **None exists.** No A2 or B2 answer, draft or re-tag has been reviewed by faculty | — |

In this report, PARTIAL means PARTIALLY_ALIGNED and NOT means NOT_ALIGNED. "A2 PARTIAL, ALIGNED" means run 1 was PARTIAL and run 2 ALIGNED. A false rejection is an answer other than ALIGNED on an item whose only accepted verdict is ALIGNED: 25 items, 50 answers. A false approval is ALIGNED on an item that does not accept it: 26 items, 52 answers.

## Short answers

| # | Question | Answer (section E has the details) |
|---|---|---|
| 1 | Did B2 reduce false rejections? | **No.** 27 of 50 answers (54%) on 16 items, against A2's 18 (36%) on 11. B2 corrected 1 of the 11 items (`d-ilo-10`) and newly rejected 6 items that A2 accepted in both runs. Only a net 2 of the 9 extra answers repeat in both runs; 7 come from one-run flips |
| 2 | Did it introduce new false approvals? | **No.** 0 of 52, and 0 of 24 on the 12 keyword traps, as in A2 |
| 3 | Did it improve recommendations? | **Only where the contract changed.** On the 8 remap candidates, 16 of 16 remedies match the provisional one (A2: 10 of 16), and no sound CLO is bent toward the wrong outcome (A2: 6). But B2 rewrites 27 outcomes the labels call aligned (A2: 18). They include value wording added to `d-ega-07` and a replacement that removes `d-ega-03`'s community element |
| 4 | Which of the 11 remain problematic? | **10 of 11.** 9 repeat in both runs, and `d-any-po-03` is still 1 of 2. Only `d-ilo-10` is corrected. `d-ega-03` is worse: NOT in run 2, for course fit |
| 5 | Are the results consistent across runs? | **Slightly less than A2 for labels and remedies, slightly more for Bloom levels and drafts.** Labels match on 52 of 58 items (A2 54) and remedies on 49 (A2 54). Bloom levels match on 51 (A2 49), and draft wording overlaps 0.66 (A2 0.57) |
| 6 | Which academic risks need faculty validation? | **Seven policy questions.** The main one: must a CLO or ILO cover every part of the outcome above it, or only contribute to it? |
| 7 | Proceed to held-out evaluation? | **Not yet.** Faculty should rule first, and then a single configuration should be chosen for one held-out run |

**Engineering.**

- **Requests:** 36 in all, 34 batches plus 2 re-asks. Every one returned HTTP 200 from `claude-sonnet-5-5`, with 0 provider errors.
- **Answers and quotes:** 116 of 116 relationships verified, and 232 of 232 quotes verbatim.
- **Recovered refusals:** on the first attempt, 4 relationships came back with swapped quotes. The validator refused them, and the re-asks recovered all 4.
- **The stop:** this made 2 invalid answers, one short of the 3-answer stop.
- **Cost:** $0.4554 of the $1.90 cap. The register now holds $1.2840859 of $10.

## 1. Scope, configuration and pre-flight

### Configuration

| | A2 (the baseline, unchanged) | B2 |
|---|---|---|
| Mode | A, legacy: `alignment-10` (9,049 characters, sha256 `81d11a069d91ee47`). No stage, no recommendation field | B, enhanced: `alignment-12a3-r7` (14,448 characters, sha256 `373bd09b17e29775`). Stage A and Stage B3, with a recommendation field |
| Dataset | `align-1`, development split: 58 items. The 42 held-out items were excluded before any request was built | The same |
| Model and settings | `claude-sonnet-5-5`, adaptive thinking, effort high, max_tokens 16,000, timeout 180 s, 2 adapter retries, prompt cache | The same |
| Runs | 2 | 2 |
| Batches | 9 per run, up to 12 relationships each | 17 per run, up to 4 each (the staged batch size) |
| Re-asks | None were needed | A refused relationship is re-asked within its batch, with at most 3 attempts |
| Request limit, retries included | 40 | 75 |
| Cost cap (guard accounting) | $1.40 | $1.90 |
| Cap over the spend register | $1.903157 | $2.728710: the register's $0.8287104 plus $1.90, rounded down |
| Validation stop | The 3rd answer that fails validation | The same |

**What both prompts contain** (recorded from the prompt text before the run):

- **The multi-part rule:** "every one must be shown… When in doubt… choose PARTIALLY_ALIGNED".
- **The course-subject rule:** judge the pair "as part of THIS subject", and an off-course text is NOT_ALIGNED.
- **A rule on drafts:** a draft must fix every gap its explanation lists.
- **The ILO test:** whether the ILO is a "smaller step" toward its CLO.

**What B2 adds.**

- **Stage A's tail for CLO-PO and CLO-EGA.** It sets four rules:
  - a CLO is never aligned "merely because it names the course title, the program, or keywords of the PO/EGA";
  - "if the link needs an activity, skill or output that the CLO does not mention, that imagined connection is not evidence";
  - a sound CLO tagged to the wrong outcome gets RETAG_OUTCOME with an empty draft;
  - a rewrite must "add nothing from the PO that the CLO does not need".
- **Stage B3's tail** applies the same tests to ILO-CLO pairs, with an ILO re-tag.
- **The recommendation contract:** NO_CHANGE, REWRITE_TEXT, RETAG_OUTCOME or REVIEW_REQUIRED.

Nothing in the prompts, the contract, the validator or the dataset was changed for B2 (section F).

### Pre-flight (before any paid request)

1. **Workspace and credits.** You confirmed that the Console's limit is still $10 and that the credits cover $1.90.
2. **Guard.** 37 of 37 guard, harness and quality-metric tests passed offline. The spend register held $0.8287104 of $10, and no stale lock existed.
3. **Planner**, run with the exact flags:
   - 34 requests without retries, 17 batches per run;
   - worst case $0.2297 per request on average, and $0.2318 at most;
   - expected cost $0.44–2.14, which is an estimate, not a limit.
4. **No held-out cases.** The 42 held-out items were excluded and not stored. No held-out log exists, and every answered id is a development id.
5. **Scoring isolation.**
   - The run is evaluation-only.
   - The stage switches exist only in the script's own environment object. The result records `processEnvStageFlags: []` and `dataModulesLoaded: []`.
   - The production approval switch is unset.
6. **Historical files.** The B2 output files did not exist before the run. A hash snapshot of 656 files showed 0 differences from the one taken at the start of this session. Since the end of A2, the only change had been the A2 report itself.

**Fixed before the run.** `p2b2-preregistered.json` (sha256 `1415f75cfe12def3`) was written at 19:52:38Z. The first request went out at about 19:53:54Z. The file holds:

- the A2 baseline's hashes;
- the 11 disputed items, with their A2 causes;
- the groups of items;
- a noise-floor rule;
- the faculty flags F1–F6;
- every counting rule used below.

The comparison script was last changed at 19:58:22Z, three seconds before B2 wrote its result. Its self-test reproduces A2's published figures from A2's own files: strict 48/66, permissive 96/116, false approvals 0/52, false rejections 18/50, 2 duplicates, 30 escalations, and quotes 232/232.

**The prediction, written before the run:**

> "B2 keeps the multi-part rule and the course-subject rule that A2's report traced 13 of the 18 false rejections to, and Stage A adds a stricter CLO-PO tail (an imagined link is not evidence). The wording therefore gives no reason to expect fewer false rejections on the 11 items; Stage A and B3 change the recommendation contract (RETAG_OUTCOME, 'add nothing from the PO'), which is where a difference is expected."

## A. Overall comparison

| Measure | A2 | B2 |
|---|---|---|
| Relationships verified | 116 of 116 | 116 of 116 |
| Labels (ALIGNED / PARTIAL / NOT) | 34 / 36 / 46 | 25 / 44 / 47 |
| Strict agreement (the 33 single-verdict items) | 48 of 66 (72.7%) | 39 of 66 (59.1%) |
| Permissive agreement | 96 of 116 (82.8%) | 87 of 116 (75.0%) |
| False approvals | 0 of 52 (0 of 24 on the traps) | 0 of 52 (0 of 24 on the traps) |
| False rejections | 18 of 50 (36%), 11 items: 16 PARTIAL, 2 NOT | 27 of 50 (54%), 16 items: 26 PARTIAL, 1 NOT |
| The 16 items shared with A1 (A1: 31 of 32) | 31 of 32 | 29 of 32 |
| Same label in both runs | 54 of 58 | 52 of 58 |
| Same Bloom levels in both runs | 49 of 58 | 51 of 58 |
| Same remedy in both runs | 54 of 58 | 49 of 58 |
| Draft wording, run 1 against run 2 | 39 items, mean Jaccard 0.57 | 33 items, mean 0.66 |
| Final quotes verbatim | 232 of 232 | 232 of 232 |
| Relationships refused at the first attempt | 0 of 116 | 4 of 116, for swapped quotes; all recovered |
| Remedies (NO_CHANGE / REWRITE / RETAG) | 34 / 82 / — | 25 / 75 / 16 |
| Remap candidates given the provisional remedy | 10 of 16 | 16 of 16 |
| Rewrites of outcomes the labels call aligned | 18 | 27 |
| Requests | 18 | 36 (34 and 2 re-asks) |
| Guard charge | $0.3255532 | $0.4553755 |
| Per verified relationship | $0.0028 | $0.0039 |

**Permissive agreement by relationship type:**

| Type | Items | A2 | B2 |
|---|---|---|---|
| CLO-PO | 24 | 37 of 48 | 36 of 48 |
| ILO-CLO | 19 | 34 of 38 | 31 of 38 |
| CLO-EGA | 10 | 17 of 20 | 14 of 20 |
| CLO-anyPO | 3 | 4 of 6 | 3 of 6 |
| CLO-anyEGA | 2 | 4 of 4 | 3 of 4 |

**By category.** Both arms agree on every answer in these categories:

- clear-negative (18 of 18);
- level-gap (16 of 16);
- partial (8 of 8);
- wrong-program (4 of 4);
- keyword-overlap (4 of 4);
- broad-CLO-narrow-ILO (4 of 4);
- contradictory (2 of 2).

B2 is lower in four categories and higher in none:

| Category | A2 | B2 |
|---|---|---|
| different-wording | 6 of 14 | 3 of 14 |
| name-only EGA | 9 of 12 | 6 of 12 |
| whole-list | 8 of 10 | 6 of 10 |
| interdisciplinary | 3 of 4 | 2 of 4 |

Clear-positive is 12 of 16 in both, but on different items. B2 gained `d-ilo-10` and lost one answer each on `ilo-clo-prog-aligned` and `d-ilo-04`. Specific-CLO-broad-PO is 2 of 4 in both, because `d-po-05` is rejected in every answer.

**Item-level pairing.** This was pre-registered as the primary table. It counts the agreeing answers per arm, 0 to 2 of 2.

| Outcome | Items | Which |
|---|---|---|
| Both right | 40 | — |
| Only A2 right (2 against 0) | 2 | `d-ega-07`, `d-ilo-06` |
| A2 better (otherwise unequal) | 7 | `clo-po-prog-interdisciplinary`, `ilo-clo-prog-aligned`, `d-ega-03`, `d-ilo-02`, `d-ilo-04`, `d-any-po-01`, `d-any-ega-01` |
| Only B2 right | 1 | `d-ilo-10` |
| B2 better (otherwise unequal) | 0 | — |
| Equal, 1 of 2 each | 1 | `d-any-po-03` |
| Both wrong | 7 | `d-po-01`, `d-po-03`, `d-po-05`, `d-po-07`, `d-po-09`, `d-ega-08`, `d-ilo-01` |

At the answer level, run r is paired with run r by index only. Both agree on 84 answers, only A2 on 12, only B2 on 3, and neither on 17.

**How to read this:**

- **Where the arms differ, the direction is consistent.** They differ on 10 items: 9 favour A2 and 1 favours B2.
- **The size of the gap is less certain.** Two runs per arm are few:
  - Under the pre-registered noise floor, a one-run difference on an item where A2 itself changed between runs is not read as an effect of the wording. That covers `clo-po-prog-interdisciplinary`, `d-ega-03`, `d-any-po-01` and `d-any-po-03`.
  - On 4 more items, B2 flipped between its own runs: `ilo-clo-prog-aligned`, `d-ilo-02`, `d-ilo-04` and `d-any-ega-01`.
- **The changes that repeat in both runs:**
  - B2 rejects `d-ega-07` and `d-ilo-06`, which A2 accepted;
  - it accepts `d-ilo-10`, which A2 rejected;
  - it moves `d-ilo-01` from NOT to PARTIAL.
- **This is not a model comparison.** Both arms used the same model and are scored against the same provisional labels. The differences belong to the prompts and contracts, and agreement is not accuracy.

**Evidence.** All 232 final quote sides in B2 are verbatim, case-sensitive substrings of their own text. The validator confirms this, and so does an independent script. On the first attempt, 4 relationships came back with the source and target quotes swapped. The validator refused them, and the re-asks returned valid quotes (section D). Validation was not weakened.

**Cost.**

- **Total:** B2 cost $0.4553755, 40% more than A2 for the same 116 relationships.
- **Why:**
  - most of the difference is output tokens: 37,047 against 27,811;
  - B2 also sent twice as many requests, each reading the cached prompt again.
- **Against the plan:** the cost is at the low end of the planner's $0.44–2.14.

## B. Case-level findings

### B1. The 11 items behind A2's 18 false rejections

| Item | Type | A2's cause (A2 report) | A2 | B2 | B2's reason | Outcome |
|---|---|---|---|---|---|---|
| `clo-po-prog-interdisciplinary` | CLO-PO | a broad PO, part covered | PARTIAL, ALIGNED | PARTIAL, PARTIAL | the same; run 2 adds course fit | repeated (A2 unstable here) |
| `d-po-01` | CLO-PO | the CLO is outside the course | PARTIAL, PARTIAL | PARTIAL, PARTIAL | the same, plus no "complex" problems and no science | repeated |
| `d-po-03` | CLO-PO | a multi-part PO | PARTIAL, PARTIAL | PARTIAL, PARTIAL | the same; run 2 adds a Bloom gap | repeated |
| `d-po-05` | CLO-PO | a broad PO, part covered | PARTIAL, PARTIAL | PARTIAL, PARTIAL | the same, plus a course-description note | repeated |
| `d-po-07` | CLO-PO | a multi-part PO | PARTIAL, PARTIAL | PARTIAL, PARTIAL | the same | repeated |
| `d-po-09` | CLO-PO | a multi-part PO | PARTIAL, PARTIAL | PARTIAL, PARTIAL | the same ("measure") | repeated |
| `d-ega-03` | CLO-EGA | the EGA name read literally | PARTIAL, ALIGNED | PARTIAL, NOT | course fit and year level | repeated; the NOT is new (A2 unstable here) |
| `d-ilo-01` | ILO-CLO | an ILO step judged against the whole CLO | NOT, NOT | PARTIAL, PARTIAL | the same | repeated; the label now matches its explanation |
| `d-ilo-10` | ILO-CLO | an ILO step judged against the whole CLO | PARTIAL, PARTIAL | ALIGNED, ALIGNED | accepted as a smaller step | **corrected in both runs** |
| `d-any-po-01` | CLO-anyPO | the CLO is outside the course | ALIGNED, PARTIAL | PARTIAL, PARTIAL | no engineering context; run 2 adds course fit | repeated (A2 unstable here) |
| `d-any-po-03` | CLO-anyPO | the CLO is outside the course | ALIGNED, PARTIAL | PARTIAL, ALIGNED | course fit, in run 1 | corrected in one run, lost in the other |

On these 11 items, A2's 18 false-rejection answers became 19 in B2: 18 PARTIAL and 1 NOT. B2 answered ALIGNED in the same run on 3 of A2's 18: `d-ilo-10` in both runs and `d-any-po-03` in run 2. Every one of the 11 remains a dispute over the provisional label, which neither arm can settle (flag F1).

Each record below gives:

- the exact texts;
- the provisional label and its rationale;
- the four verdicts with their Bloom levels;
- the evidence for each reading;
- the recommendations.

#### `clo-po-prog-interdisciplinary` · CLO-PO · interdisciplinary · IT 204 Computer Programming 2, BSIT year 2

- **PO (source):** "Analyze the impact of computing on individuals, organizations and society."
- **CLO (target):** "Evaluate the ethical and social implications of a software system on its users."
- **Provisional label:** ALIGNED. Its rationale already marks the item as disputed: "Valid interdisciplinary outcome that matches the PO. DISPUTED: the model judged PARTIAL in every run because the CLO narrows the PO's object to one system and its users; faculty to decide."
- **Verdicts:** A2 PARTIAL, ALIGNED; B2 PARTIAL, PARTIAL. Bloom levels were Analyze → Evaluate in all four answers. These are false rejections in A2 run 1 and in both B2 runs.
- **For PARTIAL:** the CLO covers "only users, not the individuals, organizations and society the PO names" (B2 run 2). B2 also records that the level is not the problem: "the gap is in scope only" (run 1).
- **For ALIGNED:** evaluating a system's social implications for its users is one instance of analysing computing's impact on individuals, at a higher level. Nothing in the PO requires one CLO to cover all three groups.
- **Course fit enters:** B2 run 2 adds "It is also not a programming outcome for this course". That is true of IT 204's description. But it brings the course-subject rule into the verdict on an interdisciplinary CLO.
- **Drafts:** both arms widen the CLO toward the PO.
  - B2 run 1: "Analyze and evaluate the ethical and social impact of a software system on its users, organizations and society." A2 run 1's draft is almost word for word the same.
  - B2 run 2: "Evaluate the ethical and social impact of a software system on individuals, organizations and society."
- **Noise floor:** A2 itself changed on this item, so B2's one-run difference is not read as an effect of the wording.
- **Faculty:** flags F1, F2 and F3. MiniMax, A1, A2 and B2 have all disagreed with this label.

#### `d-po-01` · CLO-PO · different-wording · MA 7 Differential Calculus, BSIE year 1

- **PO:** "Apply knowledge of mathematics and science to solve complex engineering problems."
- **CLO:** "Use integration techniques to compute areas and volumes that arise in engineering problems."
- **Provisional label:** ALIGNED. "Different words ('use integration to compute' vs 'apply knowledge to solve') for the same competency."
- **Verdicts:** A2 PARTIAL, PARTIAL; B2 PARTIAL, PARTIAL. Bloom levels were Apply → Apply in all four answers. All four are false rejections.
- **For PARTIAL:**
  - Both arms place integration "outside Differential Calculus (limits, continuity, derivatives)".
  - B2 adds that the CLO "does not show the PO's 'complex engineering problems' or any use of science".
  - B2 run 2 adds that the CLO "states only routine computation".
- **For ALIGNED:** using integration to compute engineering quantities is applying mathematics to engineering problems.
- **Two questions are mixed here.**
  - **Course fit:** the objection is a real curriculum point. MA 7's description reads "Limits, continuity, derivatives and their applications to engineering problems".
  - **The PO:** course fit answers whether the CLO belongs in this course. It does not answer whether the CLO fits the PO.
- **Drafts:** both arms replace integration with differentiation to fit the course title. B2: "Apply differentiation techniques to solve engineering problems involving rates of change and optimization." Whether to move the CLO or change it is a content decision for faculty.
- **Faculty:** F1, F3.

#### `d-po-03` · CLO-PO · different-wording · IT 204, BSIT year 2

- **PO:** "Design, implement and evaluate computing-based solutions to meet desired needs."
- **CLO:** "Develop and test a web application that meets the requirements of a client."
- **Provisional label:** ALIGNED. "Develop and test a solution for a client's requirements is the PO's competency in other words."
- **Verdicts:**

  | Arm | Run 1 | Run 2 |
  |---|---|---|
  | A2 | PARTIAL, Create → Apply | PARTIAL, Create → Create |
  | B2 | PARTIAL, Create → Create | PARTIAL, Evaluate → Apply |

  All four are false rejections.
- **For PARTIAL:** "The PO's design verb is missing, and the CLO does not say how the solution is evaluated against the needs" (B2 run 1).
  - B2 matches the verbs one for one: "develop (equivalent to implement)".
  - It does not accept that developing an application for a client includes designing it.
  - Nor does it accept that testing against the client's requirements is evaluating.
- **For ALIGNED:** this is the label's reading. Developing and testing a solution for a client is the PO's competency in other words.
- **A Bloom reading stricter than the level rule needs.** B2 run 2 writes: "Its Bloom level is Apply/Create, below the Evaluate the PO asks for."
  - It rates the PO by "evaluate" rather than by "design", which is Create, the higher level.
  - It rates "develop… a web application" as Apply.
  - The other three answers rate the PO Create.
- **Drafts:** both arms add design and evaluation.
  - B2 run 1: "Design, develop and evaluate a web application that meets the requirements of a client."
  - B2 run 2: "Design, develop and test a web application that meets the requirements of a client, and evaluate the finished application against those requirements." The escalation rule flags this draft.
- **Faculty:** F1, F3.

#### `d-po-05` · CLO-PO · specific-CLO-broad-PO · NCM 101 Fundamentals of Nursing Practice, BSN year 1

- **PO:** "Apply the nursing process in providing safe, quality care to individuals, families and communities."
- **CLO:** "Prepare and administer oral medications safely following the five rights of medication administration."
- **Provisional label:** ALIGNED. "A specific skill that clearly develops one real part of broad safe-care practice."
- **Verdicts:** A2 PARTIAL, PARTIAL; B2 PARTIAL, PARTIAL. Bloom levels were Apply → Apply. All four are false rejections.
- **For PARTIAL:** the CLO "does not mention the nursing process", and "it also does not reach families and communities" (B2 run 1).
  - B2 also notes that the CLO "exceeds the course description, which does not list medication administration". It calls this "secondary".
  - The note is accurate. NCM 101's description lists "basic nursing concepts, patient safety, vital signs assessment, hygiene care and therapeutic communication".
- **For ALIGNED:** safe administration by the five rights is a real part of safe, quality care.
- **Drafts:** B2's drafts are narrower than A2's.
  - Both B2 runs: "Apply the nursing process in safely preparing and administering oral medications to a simulated patient, following the five rights of medication administration." This adds the nursing process only.
  - A2 added patient and family teaching in run 1, and families in run 2.
  - Here B2 follows the rule to "add nothing from the PO that the CLO does not need".
- **Faculty:** F1, F3.

#### `d-po-07` · CLO-PO · different-wording · EDUC 105 Assessment of Student Learning 1, BSEd year 3

- **PO:** "Design, implement and evaluate assessments that measure student learning."
- **CLO:** "Construct a table of specifications and write test items that match the stated learning objectives."
- **Provisional label:** ALIGNED. "Constructing a test blueprint and items is designing an assessment."
- **Verdicts:** A2 PARTIAL (Evaluate → Create), PARTIAL (Create → Create); B2 PARTIAL, PARTIAL (Create → Create in both). All four are false rejections.
- **For PARTIAL:** "two of the PO's three verbs are missing" (B2 run 1). Both arms accept that the CLO is the PO's design part.
- **For ALIGNED:** a CLO that develops the design part of a multi-part PO contributes to that PO. Administering and analysing tests may belong to other CLOs.
- **Drafts:** both arms turn one outcome into three, in nearly the same words. B2 run 2: "Construct a table of specifications, write test items that match the stated learning objectives, administer the test, and evaluate its quality using item analysis."
  - Stage A's rule to "add nothing from the PO that the CLO does not need" did not prevent this.
  - Under the multi-part rule, the CLO does "need" the verbs it lacks.
- **Faculty:** F1, F3.

#### `d-po-09` · CLO-PO · clear-positive · ACCTG 201 Intermediate Accounting 1, BSA year 2

- **PO:** "Apply accounting principles and standards to record, measure and report financial transactions."
- **CLO:** "Record and report receivables and inventories in accordance with the applicable financial reporting standards."
- **Provisional label:** ALIGNED. "Records and reports under the standards."
- **Verdicts:** A2 PARTIAL, PARTIAL; B2 PARTIAL, PARTIAL. Bloom levels were Apply → Apply. All four are false rejections.
- **For PARTIAL:** "it never states 'measure', which the PO asks for" (B2 run 1).
- **For ALIGNED:** receivables and inventories cannot be reported "in accordance with the applicable financial reporting standards" without being measured.
  - The course description itself is "Recognition, measurement and presentation of cash, receivables, inventories… under the Philippine Financial Reporting Standards".
  - So this item turns on a single missing word, not a missing competence.
- **Drafts:** B2's two drafts are identical and minimal: "Record, measure and report receivables and inventories in accordance with the applicable financial reporting standards."
  - A2 added "Philippine Financial Reporting Standards", which the course description supports. B2 did not.
  - Even if faculty keep the ALIGNED label, this one-word change is low-risk.
- **Faculty:** F1, F3.

#### `d-ega-03` · CLO-EGA · name-only EGA · NCM 101, BSN year 1

- **EGA:** "Socially Responsive Steward"
- **CLO:** "Design a community outreach activity that addresses a local health need and evaluate its results."
- **Provisional label:** ALIGNED. "Serves a community need and reflects on the result."
- **Verdicts:** A2 PARTIAL, ALIGNED (Apply → Create in both); B2 PARTIAL (Apply → Create), **NOT** (N/A → Create). The run-2 NOT is the only NOT among B2's 27 false rejections.
- **For not aligned:** B2's reason is course fit, not the EGA.
  - Run 1: the outreach "is not in the course description… The CLO is not a sound outcome for this course".
  - Run 2: "That is a Create/Evaluate outcome that may fit the EGA, but it does not belong to this course… too advanced for year 1."
- **For ALIGNED:** designing and evaluating an outreach for a local health need is social responsiveness in practice. Both B2 runs concede the link: "may fit the EGA", and "shares the community and social-responsiveness theme".
- **A consistency concern (F5).** Run 2's explanation concedes that the CLO fits the EGA, yet its label denies alignment because of course fit. The prompt's off-course rule permits this. But the label then answers a different question from the one asked.
- **Drafts:** B2 replaces the outcome; A2's run-1 draft kept the outreach and narrowed it to basic nursing care.
  - **Run 1**, keeping 30% of the CLO: "Explain how basic nursing care, patient safety and therapeutic communication respond to the health needs of patients and the community." This lowers a Create/Evaluate outcome to Understand.
  - **Run 2**, keeping 20%: "Demonstrate safe, patient-centered basic nursing care, including patient safety and therapeutic communication, that responds to the needs of individual patients and their families." It drops the community, the element that links the CLO to "Socially Responsive Steward".
- **Faculty:** F1, F2, F3, F5, F6. The year-level question is also for faculty.

#### `d-ilo-01` · ILO-CLO · different-wording · MA 7, BSIE year 1

- **CLO (source):** "Apply differentiation rules to solve optimization problems in engineering."
- **ILO (target):** "Differentiate polynomial and trigonometric functions."
- **Provisional label:** ALIGNED. "A needed step toward applying the rules; different wording."
- **Verdicts:** A2 NOT, NOT; B2 PARTIAL, PARTIAL. Bloom levels were Apply → Apply in all four answers.
- **For PARTIAL:** B2 says the ILO "builds toward the CLO as a smaller step, so it is not an overclaim". It then lists gaps: "it never mentions solving optimization problems… it has no engineering context".
  - B2's label now matches its explanation, where A2's NOT contradicted its own.
  - It is still a false rejection against the label.
- **For ALIGNED:** a smaller step is what an ILO is meant to be. The ILO test asks whether the ILO builds toward the CLO and claims no more than it. Both arms' explanations answer yes to both.
- **A stricter reading than the levels support:** B2 run 1 adds that "its verb 'Differentiate' is at the level of procedural skill, not applying rules to a problem". Yet it rated both statements Apply.
- **Direction:** on the first attempt of both runs, B2 quoted the ILO as the source and the CLO as the target. The validator refused this, and the re-ask corrected it (section D).
- **Drafts:** B2's drafts restate the CLO, so the ILO stops being a step toward it.
  - Run 1: "Apply differentiation rules to polynomial and trigonometric functions to solve simple optimization problems in engineering." Its Jaccard with its own CLO is 0.58.
  - Run 2: "…to set up and solve simple engineering optimization problems." Jaccard 0.54.
  - A2's drafts kept "as a step toward".
- **Faculty:** F1, F2, F3, F6.

#### `d-ilo-10` · ILO-CLO · clear-positive · HM 210 Food and Beverage Service, BSHM year 2

- **CLO:** "Deliver table service to industry standards."
- **ILO:** "Set a cover for a three-course meal following the standard layout."
- **Provisional label:** ALIGNED. "A standard step of table service."
- **Verdicts:** A2 PARTIAL, PARTIAL; B2 ALIGNED, ALIGNED. Bloom levels were Apply → Apply.
- **For ALIGNED (B2):** "a concrete Apply-level step toward the source CLO of delivering table service to standard". This is the smaller-step test.
- **For PARTIAL (A2):** the ILO "does not show the delivery of service itself". This is the multi-part reading.
- **The change:** in both runs, B2 applied the smaller-step test here. In the same runs, though, it applied the multi-part reading to four other ILO steps (B2). B3's wording moves the conflict A2 found between the two tests; it does not resolve it.
- **Recommendation:** NO_CHANGE. A2's drafts grew the ILO into the whole CLO ("serve it to guests").
- **Faculty:** F1, F2. Agreeing with the provisional label is not faculty validation.

#### `d-any-po-01` · CLO-anyPO · whole-list · MA 7, BSIE year 1

- **POs (source):**
  1. "Apply knowledge of mathematics and science to solve complex engineering problems."
  2. "Design solutions for complex engineering problems that meet specified needs."
  3. "Function effectively as a member or leader of a team."
  4. "Communicate effectively on complex engineering activities with the engineering community and society."
  5. "Recognize the need for, and engage in, independent and lifelong learning."
- **CLO:** "Solve systems of linear equations using matrix methods."
- **Provisional label:** ALIGNED. "Fits PO 1; it need not fit the others."
- **Verdicts:** A2 ALIGNED, PARTIAL; B2 PARTIAL, PARTIAL. Bloom levels were Apply → Apply.
- **For PARTIAL:** "PO 1 is the best fit", but the CLO "names no engineering problem… states no complexity… shows no application" (B2 run 1). Run 2 adds that the CLO lies "outside this differential calculus course".
- **For ALIGNED:** solving linear systems by matrix methods applies mathematics to solve problems. A whole-list item needs only one fitting PO.
- **Drafts:** B2's keep more of the CLO.
  - Run 1 adds context only: "Apply matrix methods to solve systems of linear equations that model engineering problems."
  - Run 2 adds differentiation.
  - A2's run-2 draft replaced the linear algebra.
- **Noise floor:** A2 was unstable on this item, so the one-run difference is not read as a wording effect.
- **Faculty:** F1, F2, F3.

#### `d-any-po-03` · CLO-anyPO · whole-list · MA 7, BSIE year 1

- **POs:** the five above.
- **CLO:** "Collaborate with a team to design a prototype that meets stated requirements."
- **Provisional label:** ALIGNED. "Fits PO 2 and PO 3."
- **Verdicts:** A2 ALIGNED (Apply → Create), PARTIAL (Create → Create); B2 PARTIAL (Apply → Create), ALIGNED (Apply → Create).
- **For PARTIAL (B2 run 1):** "it states no calculus content, so it does not belong to this course's subject". This is the course-subject rule, as in A2 run 2.
- **For ALIGNED:** "PO 3 is met… it also designs a prototype, which fits PO 2" (B2 run 2).
- **Net:** equal. Each arm disagreed in one run, A2 in run 2 and B2 in run 1: run-to-run variation.
- **Draft (B2 run 1):** "Collaborate with a team to design a solution to an engineering problem by applying derivatives to meet stated requirements." Like A2's run-2 draft, it brings calculus into a team-design CLO.
- **Faculty:** F1, F2, F3.

### B2. New false rejections: 8 answers on 6 items that A2 accepted in both runs

| Item | Type | B2 | In both runs? | The reason in B2's explanation |
|---|---|---|---|---|
| `ilo-clo-prog-aligned` | ILO-CLO | PARTIAL, ALIGNED | no | the CLO's other verbs (design, test) |
| `d-ega-07` | CLO-EGA | PARTIAL, PARTIAL | **yes** | words of the EGA name ("Catholic", "Marian") |
| `d-ilo-02` | ILO-CLO | ALIGNED, PARTIAL | no | the CLO's other verbs, and the ILO's lower level |
| `d-ilo-04` | ILO-CLO | PARTIAL, ALIGNED | no | the CLO's other parts (the nursing process, a simulated patient) |
| `d-ilo-06` | ILO-CLO | PARTIAL, PARTIAL | **yes** | the CLO's qualifiers ("valid and reliable") |
| `d-any-ega-01` | CLO-anyEGA | ALIGNED, PARTIAL | no | half of an EGA name ("Creative"), and course fit |

Two patterns cover all 8 answers:

- **An ILO step judged against the whole CLO:** 5 answers. This is A2's cause on `d-ilo-10`, now appearing on other items.
- **An EGA name read word by word:** 3 answers. This is A2's cause on `d-ega-03`.

#### `ilo-clo-prog-aligned` · ILO-CLO · clear-positive · IT 204, BSIT year 2

- **CLO:** "Design, implement and test object-oriented programs that solve given problems."
- **ILO:** "Implement a class hierarchy using inheritance in the chosen language."
- **Provisional label:** ALIGNED. "A concrete step of the CLO."
- **Verdicts:** A2 ALIGNED, ALIGNED; B2 PARTIAL, ALIGNED. Bloom levels were Create → Apply in all four answers.
- **B2 run 1 (PARTIAL):** "the CLO also asks to design and test programs, and the ILO shows neither. It also does not say what problem the hierarchy solves."
- **B2 run 2 (ALIGNED):** "a smaller step toward the CLO's design and implementation".
- **Draft (run 1):** "Implement and test a class hierarchy using inheritance in the chosen language to solve a given problem." It adds testing and a problem.
- **Note:** this is one of the 16 items shared with A1, and A1 and A2 accepted it in every run.
- **Faculty:** F2, F3.

#### `d-ega-07` · CLO-EGA · name-only EGA · NCM 101, BSN year 1

- **EGA:** "Competent Catholic Augustinian-Marian Professional"
- **CLO:** "Perform nursing procedures to professional standards and show the Augustinian values of community and truth in patient care."
- **Provisional label:** ALIGNED. "Professional competence together with named Augustinian values."
- **Verdicts:** A2 ALIGNED, ALIGNED; B2 PARTIAL (Apply → Apply), PARTIAL (N/A → Apply).
- **For PARTIAL:**
  - Run 1: "it does not state any Catholic or Marian element, which the EGA names. It does not show how the values are shown in practice".
  - Run 2: "the EGA also asks for a 'Catholic' and 'Marian' dimension".
  - This reads the attribute's name as a list of parts. It also applies Stage A's "imagined connection" test to "show… values".
- **For ALIGNED:** professional competence together with the Augustinian values the CLO names makes up the attribute. An integrated graduate attribute need not be spelled out word by word in each CLO.
- **A change in both runs, on an item where A2 was stable.** Stage A's wording plausibly causes it, though this design cannot prove that.
- **Drafts**, which change institutional value wording (section C7):
  - Run 1: "Perform basic nursing procedures to professional standards in the skills laboratory, showing Augustinian-Marian values of community, truth and compassion in patient care."
  - Run 2: "Perform basic nursing procedures to professional standards and demonstrate the Augustinian values of community and truth and the Marian value of compassion in patient care, such as through honest reporting and respectful, caring interaction with patients."
- **Faculty:** F2, F3, F6.

#### `d-ilo-02` · ILO-CLO · different-wording · IT 204, BSIT year 2

- **CLO:** "Design, implement and test object-oriented programs that solve given problems."
- **ILO:** "Write unit tests for a class and run them."
- **Provisional label:** ALIGNED. "Testing is one of the three things the CLO asks for."
- **Verdicts:** A2 ALIGNED, ALIGNED; B2 ALIGNED, PARTIAL. Bloom levels were Create → Apply.
- **B2 run 2 (PARTIAL):** "the ILO covers only testing: it does not design or implement anything… Its Bloom level (Apply) is lower than the CLO's Create."
- **A Bloom reading stricter than the level rule.** For ILO-CLO pairs, the level test forbids only an ILO above its CLO. An ILO below its CLO is the normal shape of a smaller step.
- **Draft:** "Implement a class for a given problem, write unit tests for it and run them to verify that the program works." It adds implementation.
- **Faculty:** F2, F3.

#### `d-ilo-04` · ILO-CLO · clear-positive · NCM 101, BSN year 1

- **CLO:** "Perform basic nursing procedures safely using the nursing process on a simulated patient."
- **ILO:** "Demonstrate correct hand hygiene before and after patient contact."
- **Provisional label:** ALIGNED. "A basic procedure performed safely."
- **Verdicts:** A2 ALIGNED, ALIGNED; B2 PARTIAL, ALIGNED. Bloom levels were Apply → Apply.
- **B2 run 1 (PARTIAL):** "a smaller step in the same subject… builds toward safe performance… But the ILO does not show the nursing process or a simulated patient that the CLO states. It also covers only one procedure."
- **Draft:** "Demonstrate correct hand hygiene before and after contact with a simulated patient as part of safe care within the nursing process." A light addition.
- **Faculty:** F2, F3.

#### `d-ilo-06` · ILO-CLO · different-wording · EDUC 105, BSEd year 3

- **CLO:** "Construct valid and reliable classroom tests."
- **ILO:** "Write multiple-choice items with plausible distractors."
- **Provisional label:** ALIGNED. "Item writing is a core step of constructing a test."
- **Verdicts:** A2 ALIGNED, ALIGNED (Create → Create in both); B2 PARTIAL (Create → Create), PARTIAL (Create → Apply).
- **For PARTIAL:** "the CLO requires tests that are both 'valid and reliable', and the ILO says nothing about validity… or reliability. The ILO also covers only one item format."
- **For ALIGNED:** item writing is a core step of test construction, and plausible distractors are themselves a matter of item quality.
- **A change in both runs, on an item where A2 was stable.**
- **Drafts:** both are light, and run 1 keeps the step framing.
  - Run 1: "Write multiple-choice items with plausible distractors that match the stated learning objectives, as a step toward a valid and reliable classroom test."
  - Run 2: "Write multiple-choice items with plausible distractors that support the validity and reliability of a classroom test."
- **Faculty:** F2, F3.

#### `d-any-ega-01` · CLO-anyEGA · whole-list · IT 204, BSIT year 2

- **EGAs (source):**
  1. "Critical and Creative thinker"
  2. "Competent Catholic Augustinian-Marian Professional"
  3. "Socially Responsive Steward"
  4. "Transformative Lifelong learner"
- **CLO:** "Analyze alternative designs and justify the selection of one for a given problem."
- **Provisional label:** ALIGNED. "Fits EGA 1."
- **Verdicts:** A2 ALIGNED, ALIGNED (Analyze → Evaluate); B2 ALIGNED (Evaluate → Evaluate), PARTIAL (Create → Evaluate).
- **B2 run 2 (PARTIAL):** "It does not state any creative element… so the 'Creative' half of EGA 1 is not shown. It also names no subject in this course."
- **Draft:** "Design alternative object-oriented solutions to a given programming problem, analyze their data structures and trade-offs, and justify the selection of one." It raises the CLO to Create, which the escalation rule flags, and adds course content.
- **Faculty:** F2, F3, F6.

### B3. New false approvals

**None.**

- **Clear not-aligned items:** B2 gave ALIGNED to 0 of 52 answers.
- **Keyword traps:** 0 of the 24 answers on the 12 traps were ALIGNED.
- **Categories:** it agrees on every answer in clear-negative (18), level-gap (16), wrong-program (4), keyword-overlap (4) and contradictory (2).

Misalignment detection is preserved.

### B4. Items where both arms disagree with the provisional label

There are 11 such items:

- 10 of the 11 items above: all except `d-ilo-10`;
- `d-ega-08`.

#### `d-ega-08` · CLO-EGA · name-only EGA · ambiguous · IT 204, BSIT year 2

- **EGA:** "Competent Catholic Augustinian-Marian Professional"
- **CLO:** "Write a Python function that sorts a list."
- **Provisional label:** ALIGNED or PARTIAL, marked ambiguous: "Technical competence only; whether that is enough for this EGA depends on a definition the system does not hold (the EGA is a name only)."
- **Verdicts:**
  - A2: NOT, NOT (Apply → Apply), each with a rewrite that adds value words.
  - B2: NOT, NOT (N/A → Apply), each with RETAG_OUTCOME.
- **For NOT:** the CLO has "no professional, ethical or faith-related element", and "the link would rest on an imagined connection the CLO does not state" (B2).
- **For ALIGNED or PARTIAL:** technical competence is the "Competent… Professional" part of the attribute.
- **Recommendations:** B2's re-tag avoids A2's problem, which presented "integrity" and "service to others" as Augustinian-Marian values. But whether this EGA should be taken off a technical CLO is the same question of definition.
- **Faculty:** F3, F4. Rule on this item and `d-ega-07` together.

### B5. The other disagreement record: the arms differ, both agree with the label

#### `d-po-12` · CLO-PO · wrong-program · NCM 101, BSN year 1 · remap candidate

- **PO:** "Apply knowledge of computing and mathematics appropriate to the discipline."
- **CLO:** "Apply the nursing process to assess a patient's vital signs."
- **Provisional label:** NOT or PARTIAL. "A nursing CLO against a computing program's PO: the wrong program's outcome." The provisional remedy is RETAG.
- **Verdicts:**
  - A2 PARTIAL, PARTIAL, each with a rewrite that adds computing to the nursing CLO.
  - B2 NOT, NOT, each with RETAG_OUTCOME, which keeps the CLO as written.
  - Bloom levels were Apply → Apply.
- **B2's explanation:** "The PO tag does not fit this CLO, which is a sound outcome for the course, so the choice of PO is what is wrong." It notes that "the discipline and object of the action differ". It does not say that the PO comes from another program's list.
- **Faculty:** F2, F4.

### B6. The false-rejection investigation, by the five questions asked

**1. Meaningful alignment.**

- **What the explanations name:** all 27 of B2's false-rejection explanations name what the two outcomes share. None says the texts are unrelated.
- **Why they reject:** each rejects for one of three reasons:
  - a missing part of the source;
  - the course description;
  - a word of an EGA name.
- **What follows:** neither arm misses the link. The disagreement is over the threshold for ALIGNED, and B2's threshold is stricter.

**2. Overly strict Bloom readings.**

- **The false rejections that cite the level.** There are three, and the level rule requires none of them:
  - `d-po-03` run 2 rates the PO by "evaluate" rather than "design", and rates "develop… a web application" as Apply.
  - `d-ilo-02` run 2 counts the ILO's lower level as a gap.
  - `d-ilo-01` run 1 calls "Differentiate" a "procedural skill", below its own rating of Apply.
- **The level rule itself held.** The rule covers 23 of B2's ALIGNED answers. In none of them does a CLO sit below its PO or EGA, or an ILO above its CLO. One of them, on `d-ega-05`, rated the EGA N/A and could not be checked. A2 had 30 covered ALIGNED answers, also with no break. Level-gap items show the gap in 16 of 16 answers in both arms.
- **EGA names.** B2 rated 7 of its 20 CLO-EGA answers N/A; A2 rated none N/A. It did so inconsistently: on `d-ega-03`, `d-ega-05` and `d-ega-07`, one run gave N/A and the other a level.

**3. Valid relationships without identical wording.**

- **Agreement:** the different-wording category fell from 6 of 14 to 3 of 14.
- **Synonyms are not the problem.** B2 accepts them one for one: "develop (equivalent to implement)" (`d-po-03`), and writing items as designing an assessment (`d-po-07`).
- **What B2 does not accept:**
  - one word that covers two of the source's, such as "develop" for "design and implement";
  - a competence that is implied but unstated, such as "measure" when reporting under the standards (`d-po-09`).
- **Both arms do this.** B2 does it more often.

**4. Partial against complete misalignment.**

- **B2's false rejections:** 26 of the 27 are PARTIAL.
- **The clear cases:** both arms separate partial from complete misalignment there. The partial category is 8 of 8 and clear-negative 18 of 18.
- **The moves:**
  - B2 moved `d-ilo-01` from NOT to PARTIAL, which its explanation supports.
  - It moved `d-ega-03` run 2 from ALIGNED to NOT, on course fit rather than on the EGA.

**5. The direction of outcome relationships.**

- **Roles within a pair.**
  - **The swaps:** on the first attempt, B2 swapped the source and target quotes for 4 ILO-CLO relationships, `d-ilo-01` and `d-ilo-12`, in the same batch of both runs. In these pairs the source is the CLO.
  - **The recovery:** the validator refused all 4 and the re-asks fixed them. The final explanations name the roles correctly.
- **The direction of the test.** The two readings of alignment differ:
  - The provisional labels read it as **contribution:** the CLO or ILO develops a real part of the outcome above it.
  - The prompt's multi-part rule reads it as **coverage:** the target must show every part of the source.
  - This is the first policy question in section E.
- **The direction of the drafts.** 5 B2 ILO drafts restate their own CLO (Jaccard ≥ 0.5), against 2 in A2. An ILO rewritten to cover its CLO is no longer a step toward it. No ILO draft and no ALIGNED answer puts an ILO above its CLO.

### B7. Faculty-review cases

By the pre-registered flags:

| Flag | Items |
|---|---|
| F1–F3: an academic-relationship dispute | 19: the 11, plus `ilo-clo-prog-aligned`, `d-ega-07`, `d-ilo-02`, `d-ilo-04`, `d-ilo-06`, `d-any-ega-01`, `d-ega-08` and `d-po-12` |
| F4: a remap candidate or a B2 re-tag | 14: the 8 remap candidates, plus `clo-po-calc-lower-level`, `d-po-02`, `d-po-04`, `d-ega-08`, `d-ilo-03` and `d-ilo-09` |
| F5: an explanation that contradicts its label, read by hand | 1: `d-ega-03` run 2. The pre-registered heuristic found no B2 hit |
| F6: a B2 draft flagged by a draft rule | Listed in section C. The drafts that would most mislead a faculty author are on `d-ega-03`, `d-ega-07`, `d-ilo-01`, `clo-po-nurs-unrelated` and the escalated level-gap items |

The policy questions these turn on are in section E, question 6.

## C. Academic recommendation analysis (developer review, not faculty review)

I read B2's 116 explanations, its 75 drafts and its 16 re-tags alongside A2's. I checked each against the rules fixed before the run, against the course, and against its year level.

### C1. The developer review

| Result | A2 drafts (82) | B2 drafts (75) |
|---|---|---|
| No concern: the expected remedy, keeping the course's subject and level | 30 | 28 |
| A rewrite of an off-subject or below-college statement; faculty should set the level | 9 | 8 |
| **Flagged for faculty review** | **43** | **39** |
| — rewrites an outcome the provisional label calls aligned | 18 | 27 |
| — bends a sound CLO toward the wrong PO or EGA | 6 | 0 |
| — replaces a plausible CLO's content (`d-po-06`) | 2 | 2 |
| — duplicates an existing CLO, or restates the PO as the CLO | 2 | 2 |
| — raises an outcome to the PO's level where a re-tag or a smaller change could keep it | 10 | 5 |
| — adds value terms (A2: `d-ega-08`. B2's, on `d-ega-07`, are counted in the first row) | 2 | 0 |
| — an ILO draft repeats another ILO or restates its CLO | 3 | 3 |

Each draft is counted once, under its main reason.

| B2's 16 re-tags | Answers |
|---|---|
| Matches the provisional remedy on a remap candidate | 7 |
| Follows a level-gap note written before the run ("a re-tag keeps it") | 3 |
| Plausible, though no provisional remedy exists (`d-po-04`) | 2 |
| Depends on how the EGA is defined (`d-ega-08`) | 2 |
| Doubtful (`d-ilo-03` run 2, `d-ilo-09` run 2) | 2 |

**The balance:**

- **Fixed:** B2 fixes what the contract change was meant to fix.
  - Forced fits fell from 6 to 0.
  - Drafts flagged mainly for raising an outcome to the PO's level fell from 10 to 5. By the escalation rule in C5 the fall is 13 to 8; this table counts each draft once, under its main reason.
- **Added:** it adds rewrites of aligned outcomes (18 to 27), because it rejects more.

### C2. REWRITE_TEXT against RETAG_OUTCOME, and the 8 remap candidates

The remap candidates are never scored. Their provisional remedies were fixed in A2's pre-registration.

| Item | Course, year | The CLO, and the outcome it is tagged to | Provisional remedy | A2 | B2 | Assessment |
|---|---|---|---|---|---|---|
| `clo-po-calc-unrelated` | MA 7, 1 | "Evaluate limits of rational functions." Tagged to the PO "Communicate effectively with a range of audiences." | RETAG | NOT and a rewrite, both runs (communication added) | NOT and RETAG, both runs | **Fixed.** The sound calculus CLO is kept, and both explanations say the tag does not fit |
| `clo-po-nurs-unrelated` | NCM 101, 1 | "Compute the derivative of polynomial functions." Tagged to "Provide safe, quality nursing care to individuals using the nursing process." | REWRITE OR REMOVE | NOT and a rewrite, both runs (both duplicates) | NOT and a rewrite, both runs | Matches, but run 1 copies an existing CLO exactly and run 2 restates the PO (C4). Removal looks like the better remedy. B2 rightly did not re-tag a calculus CLO in a nursing course |
| `clo-ega-unrelated` | IT 204, 2 | "Recite the history of the institution." Tagged to "Competent Professional" | REWRITE | NOT and a rewrite, both runs | NOT and a rewrite, both runs | Matches: replaced with an object-oriented programming CLO. Its level, Create, is above the EGA's Apply, and faculty should set it |
| `d-po-06` | NCM 101, 1 | "Identify the anatomical structures of the heart." Tagged to "Communicate therapeutically with clients and collaboratively with the health team." | EITHER | NOT and a rewrite, both runs | NOT and a rewrite, both runs | Matches, but the anatomy is replaced by communication in both runs, and B2 drops the cardiac topic both times. B2 considered a re-tag and rejected it: "the choice of PO is not the only issue". Faculty should choose: re-tag, raise or replace |
| `d-po-12` | NCM 101, 1 | "Apply the nursing process to assess a patient's vital signs." Tagged to "Apply knowledge of computing and mathematics appropriate to the discipline." | RETAG | PARTIAL and a rewrite, both runs (computing added) | NOT and RETAG, both runs | **Fixed.** No explanation says the PO belongs to another program |
| `d-ega-02` | MA 7, 1 | "Recite the multiplication table." Tagged to "Critical and Creative thinker" | REWRITE | NOT and a rewrite, both runs | NOT and a rewrite, both runs | Matches: replaced with a calculus analysis CLO, "Analyze an engineering problem and justify the choice of differentiation technique used to solve it." Faculty should set the level |
| `d-ega-04` | MA 7, 1 | "Compute the derivative of trigonometric functions." Tagged to "Socially Responsive Steward" | RETAG | NOT and a rewrite, both runs (community service added) | NOT and RETAG, both runs | **Fixed.** The note written before the run warned that adding social service "would force the fit" |
| `d-ega-06` | MA 7, 1 | "Solve quadratic equations." Tagged to "Transformative Lifelong learner" | EITHER | NOT and a rewrite, both runs | NOT and RETAG; NOT and a rewrite | Both accepted, but inconsistent. The run-1 re-tag keeps a CLO the note calls "below Differential Calculus". Run 2's rewrite fixes both the level and the attribute, so it is the better recommendation |

On the 3 re-tag candidates, B2 re-tagged in 6 of 6 answers; A2 re-tagged in none. On the other 5 candidates, both arms' remedies match.

**The 9 re-tags outside the candidates** (none is assumed right because it is a re-tag):

| Answers | Category | The CLO or ILO, and its tag | Assessment |
|---|---|---|---|
| `d-po-02` × 2 | level-gap | "Compute the derivative of a polynomial using the power rule." Tagged to "Design solutions for complex engineering problems that meet specified needs." | **Supported.** The pre-registered note says "raising it to design to fit a design PO is escalation; a re-tag keeps it". A2 raised it to design in both runs |
| `clo-po-calc-lower-level` run 2 | level-gap | "Define the derivative of a function." Tagged to the same design PO | Follows the note ("re-tagging to the apply-mathematics PO keeps it"). But a Remember-level CLO would still sit below an Apply PO. Run 1 raised the CLO to design instead |
| `d-po-04` × 2 | keyword-overlap | "Write programs in Python that process text files." Tagged to "Analyze the local and global impact of computing on individuals, organizations and society." | Plausible: a sound IT 204 CLO on the wrong PO. Run 2 suggests "a PO about developing or implementing programs". A2 rewrote it into impact analysis, raising Apply to Analyze |
| `d-ega-08` × 2 | name-only EGA, ambiguous | "Write a Python function that sorts a list." Tagged to "Competent Catholic Augustinian-Marian Professional" | Depends on the EGA's definition (B4). Better than A2's value additions, but it removes a mapping the label may accept |
| `d-ilo-03` run 2 | keyword-overlap | The ILO "Install the integrated development environment." Tagged to the CLO "Design, implement and test object-oriented programs that solve given problems." | Doubtful: "retag it to a different outcome or to none". Whether an installation task is an ILO at all is for faculty. Run 1 rewrote it instead |
| `d-ilo-09` run 2 | clear-negative | The ILO "Explain the history of the accounting profession." Tagged to the CLO "Record and report receivables in accordance with the applicable financial reporting standards." | Doubtful: "the ILO may be sound for another week or CLO". ACCTG 201's description has no history topic, so a re-tag would keep an off-subject ILO. Run 1 rewrote it to restate its CLO (Jaccard 0.92) |

**What a re-tag does not say.**

- **What it says:** all 16 re-tag explanations say the tag does not fit. The pre-registered check matched all 16.
- **What it leaves out:** none names the outcome to re-tag to.
- **Why:** the contract asks only that the explanation "say… that the tag does not fit", and each pair carries a single PO, EGA or CLO.
- **What that means in the application:** faculty would have to choose the new tag themselves.

**Instability.** On 4 items, RETAG and REWRITE alternated between the runs: `clo-po-calc-lower-level`, `d-ega-06`, `d-ilo-03` and `d-ilo-09`. A user who ran the check twice could get either recommendation.

### C3. Unsupported recommendations (pre-registered)

| Kind | A2 | B2 |
|---|---|---|
| A rewrite of a clear-ALIGNED outcome | 18 | 27 |
| A rewrite where the provisional remedy is a re-tag | 6 | 0 |
| A re-tag of a clear-ALIGNED outcome | — | 0 |
| A re-tag where the provisional remedy is a rewrite | — | 0 |
| A draft held back by the advisory review, or a contract refusal | 0 | 0 |

The advisory answer review flagged 0 B2 answers, as it flagged 0 in A2. It caught none of the issues in this section.

### C4. Duplicates, and drafts that restate another outcome

- **Duplicate CLOs** (Jaccard ≥ 0.8 with another CLO of the course): B2 has 1, against A2's 2.
  - The B2 duplicate is `clo-po-nurs-unrelated` run 1: "Perform basic nursing procedures safely using the nursing process on a simulated patient."
  - It copies the course's existing CLO word for word (Jaccard 1.00). That CLO belongs to `clo-po-nurs-aligned`, `d-ilo-04` and `d-ilo-05`.
- **A CLO that restates the PO.**
  - **The draft:** `clo-po-nurs-unrelated` run 2: "Provide safe, quality basic nursing care to a simulated patient using the nursing process."
  - **The PO:** "Provide safe, quality nursing care to individuals using the nursing process." The draft is this PO with a few words changed.
  - **The remedy:** the provisional remedy is "rewrite or remove". Neither draft adds an outcome the course lacks, so removal is the likelier remedy.
- **ILO drafts that restate their own CLO** (Jaccard ≥ 0.5): 5 in B2, against 2 in A2.
  - `d-ilo-01` × 2 (0.58 and 0.54), discussed in B1.
  - `d-ilo-05` × 2 (0.50): "Demonstrate a basic nursing procedure safely on a simulated patient, following the steps of the nursing process."
  - `d-ilo-09` run 1 (0.92): "Record receivables and report them in accordance with the applicable financial reporting standards."
- **ILO against ILO:** no ILO draft reaches 0.8 against another ILO.

### C5. Bloom escalation

The rule, fixed before the run, flags a CLO draft whose verb level is above the CLO's and at or above the PO's or EGA's. It flagged 25 B2 drafts, against 30 in A2.

| Group | A2 | B2 | The B2 drafts |
|---|---|---|---|
| The raise is the remedy the item calls for | 8 | 8 | `clo-po-calc-vague` × 2, `d-po-10` × 2, `d-po-13` × 2, `d-po-14` × 2 |
| An off-subject or below-college statement rewritten; faculty should set the level | 9 | 8 | `clo-ega-unrelated` × 2 (to Create, above the EGA's Apply), `d-ega-02` run 1, `d-any-ega-02` × 2, `d-any-po-02` × 2, `d-ega-06` run 2 |
| **Raised to match the PO, where a re-tag or a smaller change could keep the outcome** | 13 | 8 | `clo-po-calc-lower-level` run 1 (year 1: "Define the derivative" raised to design), `clo-po-prog-lower-level` × 2 (list the keywords, raised to design and evaluate), `d-po-08` × 2 (the history of testing, raised to design and evaluate), `d-po-06` × 2 (heart anatomy replaced by communication), `d-po-03` run 2 |
| A clear-ALIGNED CLO raised to add the other half of an EGA name | 0 | 1 | `d-any-ega-01` run 2 (Evaluate to Create) |

**What the re-tags removed and what they left:**

- **Removed:** re-tags removed 5 of A2's 13 raises: `d-po-02` × 2, `d-po-04` × 2 and `clo-po-calc-lower-level` run 2.
- **Still raised:**
  - `clo-po-calc-lower-level` in run 1;
  - `clo-po-prog-lower-level` and `d-po-08`, which B2 re-tagged in neither run.
- **Lowering:** the rule does not count it. The run-1 draft for `d-ega-03` takes a Create/Evaluate outreach CLO down to "Explain…", which is Understand.

### C6. Scope changes and added detail

- **Stage A's "add nothing from the PO": a measurable but modest effect.**
  - CLO drafts that bring in two or more of the PO's or EGA's content stems fell from 43 of 56 (77%) to 32 of 48 (67%).
  - On the 63 answers with a draft in both arms, B2's drafts are shorter: 16.7 words, against 19.4.
  - They keep more of the original: 53% of its content stems, against 47%.
  - They bring in fewer PO stems: 118, against 137.
  - B2 is clearly narrower on `d-po-05` (no families or communities) and `d-po-09` (one added word).
- **Multi-part widening is unchanged.** Where the multi-part rule finds a missing part, B2's drafts add it, as A2's did:
  - `d-po-07` × 2: construct, administer and evaluate;
  - `d-po-03` × 2: design and evaluation;
  - `clo-po-prog-interdisciplinary` × 2: organizations and society.
- **ILO drafts grow toward their CLO:**
  - `d-ilo-01` × 2;
  - `ilo-clo-prog-aligned` run 1, which adds testing;
  - `d-ilo-02` run 2, which adds implementation.
- **Content replaced to fit the course description:**
  - `d-po-01` × 2: integration becomes differentiation;
  - `d-ega-03` × 2: the outreach becomes basic care;
  - `d-po-06` × 2: anatomy becomes communication.
- **Content added to fit the course description:**
  - calculus, added to a team-design CLO (`d-any-po-03` run 1);
  - differentiation, added to a linear-algebra CLO (`d-any-po-01` run 2).
- **Added detail:** "Philippine Financial Reporting Standards" appears only in `d-po-10` × 2, against 4 drafts in A2. ACCTG 201's own description names these standards, so the course supports the wording.

### C7. Institutional values

- **No explanation proposes changing an EGA, a PO, a Marian or Augustinian value, or any institutional policy.** Re-tags change a mapping, never the outcome itself.
- **`d-ega-07` is the only CLO in the dataset that names values.**
  - **The author's text:** "show the Augustinian values of community and truth in patient care".
  - **What each arm did:** A2 judged it ALIGNED in both runs and left it unchanged. B2 judged it PARTIAL in both runs and rewrote it both times.
  - **Run 1** relabels the author's "Augustinian values" as "Augustinian-Marian values of community, truth and compassion".
  - **Run 2** keeps the author's values and adds "the Marian value of compassion".
  - **The six core-value names** in `values.js` are Compassion, Courage, Community-orientedness, Humility, Interiority and Missionary Spirit.
    - Compassion is one of them.
    - "Truth" is not.
    - "Community" is the author's word, not the core-value name.
  - **For the institution and faculty:** whether compassion counts as a Marian value, and whether a checker may add a value to a CLO that already names values. Both drafts keep the author's two values in some form, but run 1 changes their attribution.
- **`d-ega-08`:** B2 re-tags instead of adding value words (A2 added "integrity", "humility" and "service to others"). So B2 added no value term there.
- **The other EGA drafts** add the EGA's ideas rather than named values: `d-ega-03` (community and patient-centred care) and `d-any-ega-01` (design).

## D. Engineering findings

| # | Check | Result |
|---|---|---|
| 1 | JSON validity | 36 of 36 answers are valid JSON. Re-running the validator on the saved answers verifies the same 116 judgements: 112 from the 34 fully valid answers, and 4 kept from the 2 partly refused ones |
| 2 | Exact quotes | All 232 final quote sides are verbatim, case-sensitive substrings of their own text, checked independently. None is empty and none is on the wrong side |
| 3 | First-attempt failures | 4 of 116 relationships (3.4%), on 2 of 36 answers: `quotes_swapped` on `d-ilo-01` and `d-ilo-12`, in requests #4 and #22, the same calculus batch in each run. The source quote came from the ILO and the target quote from the CLO |
| 4 | Recovery | 4 of 4 at the second attempt, by re-asking only the refused relationships (#5 and #23). 0 unresolved; completion `complete`, coverage 100% |
| 5 | Model identity | All 36 answers came from `claude-sonnet-5-5`. The ledger's 36 request ids match the result's |
| 6 | Tokens | Input 15,658; cache write 5,641, by #1 only; cache read 197,435, by the other 35 requests, so the cache stayed warm across both runs; output 37,047. That is 319 output tokens per relationship, or 268 without thinking (A2: 240 and 210) |
| 7 | Thinking tokens | 5,934, on 4 of 36 requests: #2 (1,045), #4 (1,701), #20 (1,067) and #22 (2,121). These are calculus batches 2 and 4 in each run, so the same inputs both times. They cost about $0.059. The other 32 requests reported 0, and every request reported a count |
| 8 | Latency | Median 6.5 s, p90 14.0 s, max 22.7 s. The four thinking requests took 14.0–22.7 s and the others 1.8–8.7 s. Requests ran one at a time, 264 s in all |
| 9 | Provider errors | None: 36 HTTP 200 answers with `end_turn`, 0 adapter retries, 0 timeouts, 0 rate limits or server errors, 0 refusal categories. Inference geo `global` and service tier `standard` on all 36 |
| 10 | Spending safeguards | The worst case ($0.2279–0.2318) was reserved before each request was sent and released when it settled. All 36 requests were reconciled; none was charged conservatively or at its worst case. The guard charged $0.4553755 of the $1.90 cap (24%). The register stood at $1.2840859 against the total cap of $2.728710. The validation stop was reached at 2 of its 3 answers. The register lock was released, and no held-out log was created |

**The validation stop.** B2 came within one invalid answer of stopping.

- **The cause:** both invalid answers were the same failure, on the same 2 relationships in the same batch.
- **That batch:** it is also where adaptive thinking engaged most (#4 and #22). That is a correlation; one batch cannot show the cause.
- **A2:** it had no such failure on these items, with a different prompt and batches of 12.
- **The contract:** it already tells the model that "for ILO-CLO the source is the CLO and the target is the ILO".
- **The validator:** it refused the swap rather than repair it, as it should.

**Requests by batch:**

| Batch | Relationships | Run 1: request, latency, output (thinking) | Run 2 |
|---|---|---|---|
| calculus 1 | 4 | #1, 7.1 s, 966 | #19, 5.8 s, 894 |
| calculus 2 | 4 | #2, 14.0 s, 2,070 (1,045) | #20, 14.5 s, 2,041 (1,067) |
| calculus 3 | 4 | #3, 5.7 s, 913 | #21, 6.0 s, 899 |
| calculus 4 | 4 | #4, 18.6 s, 2,717 (1,701); re-ask #5, 6.3 s, 766 | #22, 22.7 s, 3,175 (2,121); re-ask #23, 5.1 s, 703 |
| calculus 5 | 4 | #6, 8.4 s, 1,131 | #24, 6.9 s, 1,026 |
| operations research | 1 | #7, 2.3 s, 180 | #25, 2.4 s, 167 |
| programming 1 | 4 | #8, 6.0 s, 969 | #26, 5.6 s, 895 |
| programming 2 | 4 | #9, 7.3 s, 944 | #27, 6.0 s, 853 |
| programming 3 | 4 | #10, 6.5 s, 922 | #28, 7.9 s, 1,113 |
| programming 4 | 1 | #11, 1.8 s, 183 | #29, 3.2 s, 354 |
| nursing 1 | 4 | #12, 7.2 s, 1,026 | #30, 7.2 s, 1,041 |
| nursing 2 | 4 | #13, 8.7 s, 1,231 | #31, 8.1 s, 1,161 |
| nursing 3 | 3 | #14, 5.7 s, 836 | #32, 6.0 s, 964 |
| education 1 | 4 | #15, 7.3 s, 1,063 | #33, 7.3 s, 1,069 |
| education 2 | 2 | #16, 6.6 s, 669 | #34, 5.6 s, 694 |
| accounting | 4 | #17, 7.3 s, 1,091 | #35, 7.0 s, 1,054 |
| hospitality | 3 | #18, 4.7 s, 642 | #36, 4.8 s, 625 |

**Cost:**

- **The two figures:** the estimate at published prices is $0.435632, and the guard charged $0.4553755.
- **The difference** is $0.0197435, exactly the guard's cache-read margin: $0.20 instead of $0.10 per million, on 197,435 tokens.
- **The conservative rule** would have charged $1.0090355.
- **Unit costs:** $0.0039 per verified relationship and $0.013 per request, at the low end of the planner's $0.44–2.14.
- **Against A2:** B2 cost 40% more, $0.1298 at the guard's rates. Of that:
  - $0.0924 comes from 33% more output;
  - $0.0268 from the extra requests' cache reads;
  - $0.0107 from input and cache writes.

**Remaining budget.**

- **This run:** B2 used $0.4554 of its $1.90 cap and 36 of its 75 requests. The unused $1.4446 does not carry over.
- **The spend register:** it holds **$1.2840859 of $10**, leaving **$8.7159141**:

  | Run | Charge |
  |---|---|
  | P1 | $0.019372 |
  | A3 | $0.06535 |
  | B1 | $0.2181312 |
  | A1 | $0.200304 |
  | A2 | $0.3255532 |
  | B2 | $0.4553755 |

- **Whose figures:** these are the guard's figures, not Anthropic's invoice. The Console's usage page is what counts.

**Comparisons that are not possible.** B1 ran a different dataset (`stage-a-2`, 28 items) and shares no item with `align-1`. No MiniMax result exists for this split.

**A harness figure not used here.** The harness counts recommendations "as expected": A2 84 of 102, B2 62 of 102. It takes the expected remedy from the label alone, so it counts every re-tag as unexpected. That makes it unfit for judging recommendation quality, and this report does not use it.

## E. Final decision questions

**1. Did B2 reduce false rejections?**

**No**, against the provisional labels.

- **Overall:** 27 of 50 answers (54%) on 16 items, against 18 (36%) on 11.
- **On the 11 items:** 19 of 22 answers are still false rejections, against 18. Only `d-ilo-10` was corrected in both runs.
- **New:** B2 added 8 false rejections on 6 items that A2 accepted in both runs.
- **How much of the rise is repeatable:**
  - Changes that repeat in both runs account for a net +2 answers: +4 on `d-ega-07` and `d-ilo-06`, and −2 on `d-ilo-10`.
  - The other +7 come from flips confined to one run.
  - So "no reduction" is clear, but the size of the increase is not.
- **The prediction held.** It said the prompt text gave no reason to expect fewer false rejections, because B2 keeps the multi-part and course-subject rules.
- **Where the rejections come from:**
  - Stage A's stricter test ("that imagined connection is not evidence") plausibly explains the new rejections on EGA names.
  - B3's tail does not settle whether an ILO step must cover its whole CLO.

**2. Did it introduce new false approvals?**

**No.** B2 approved 0 of 52 clear not-aligned answers, and 0 of 24 on the keyword traps. The misalignment detection A2 showed is intact in every clear category.

**3. Did it improve recommendations?**

**In part.**

- **Better:**
  - the right remedy on all 16 remap-candidate answers (A2: 10);
  - no forced fits (A2: 6);
  - escalations to the PO's level down from 13 to 8 by the pre-registered rule;
  - less PO wording copied into drafts;
  - no value terms added on `d-ega-08`;
  - narrower drafts on `d-po-05` and `d-po-09`;
  - one fewer duplicate.
- **Worse:**
  - 27 rewrites of outcomes the labels call aligned (A2: 18). They include value wording added to the only CLO that names values (`d-ega-07`), and a replacement that removes `d-ega-03`'s community element.
  - 5 ILO drafts restate their CLO (A2: 2).
  - RETAG and REWRITE alternate between runs on 4 items.
  - No re-tag says which outcome to use.
  - 2 ILO re-tags are of doubtful fitness.
- **Net:** the contract is better, but it is applied to more answers that should not have been rejected.

**4. Which of the 11 remain problematic?**

**Ten.**

- **Multi-part or broad POs:** `d-po-03`, `d-po-05`, `d-po-07`, `d-po-09` and `clo-po-prog-interdisciplinary` are repeated in both runs.
  - They turn on whether a CLO must cover the PO or only contribute to it.
  - `d-po-09` turns on a single implied word.
- **Course fit mixed into the alignment verdict:** `d-po-01` and `d-any-po-01` in both runs, and `d-any-po-03` in one.
- **Worse than in A2:** `d-ega-03` is NOT in run 2 because of course fit, and its drafts remove the link to the EGA.
- **Better in form, still rejected:** `d-ilo-01`. Its label now matches its explanation, but its drafts restate the CLO and its quotes were swapped at the first attempt.
- **Corrected:** `d-ilo-10` only. The correction is against the provisional label, so it needs faculty confirmation like the rest.

**5. Are the results consistent across runs?**

**Moderately**, and slightly less than A2 on labels.

- **Labels:** the same on 52 of 58 items (A2: 54).
  - The 6 changes are all on clear-ALIGNED items.
  - Five went between ALIGNED and PARTIAL, and `d-ega-03` between PARTIAL and NOT.
- **Remedies:** the same on 49 of 58 (A2: 54).
- **Bloom levels:** the same on 51 of 58 (A2: 49). The unstable ones are mostly EGA names, which B2 now sometimes rates N/A.
- **Drafts:** closer between runs (Jaccard 0.66, against A2's 0.57).
- **Changes that repeat in both runs:** these can be attributed to B2's wording:
  - `d-ilo-10`, `d-ilo-01`, `d-ega-07`, `d-ilo-06` and `d-po-12`;
  - the re-tags on `d-po-02`, `d-po-04`, `d-ega-04`, `d-ega-08` and `clo-po-calc-unrelated`.
- **The rest** falls within the run-to-run variation that each arm shows on its own.

**6. Which academic risks still need faculty validation?**

**Every agreement figure in this report**, because the labels are provisional. These questions decide most of the disagreement:

1. **Coverage or contribution.** Is a CLO that develops one real part of a multi-part or broad PO ALIGNED, or only PARTIALLY_ALIGNED? (`d-po-03`, `d-po-05`, `d-po-07`, `d-po-09`, `clo-po-prog-interdisciplinary`, `d-any-po-01`.) In common outcome-based curriculum mapping, a course outcome is mapped to the program outcomes it contributes to, and several courses together develop each PO. Whether the checker should use that reading is for faculty to decide.
2. **ILO steps.** Is an ILO that is a smaller step of its CLO ALIGNED when it does not show the CLO's other verbs or qualifiers? (`d-ilo-01`, `d-ilo-02`, `d-ilo-04`, `d-ilo-06`, `d-ilo-10`, `ilo-clo-prog-aligned`.)
3. **EGA names.** Is a graduate attribute developed as a whole? Or must a CLO reflect each word of its name, such as "Catholic", "Marian" or "Creative"? (`d-ega-03`, `d-ega-07`, `d-ega-08`, `d-any-ega-01`.)
4. **Course fit.** Should a CLO's fit with the course description change its verdict against a PO or EGA, or be reported separately? (`d-po-01`, `d-any-po-01`, `d-any-po-03`, `d-ega-03`, and the remarks on `d-po-05` and `clo-po-prog-interdisciplinary`.) A related question for `d-ega-03`: is designing and evaluating a community outreach too advanced for year-1 nursing?
5. **Re-tags.** Which of the 16 re-tags are appropriate, and to which outcome each CLO or ILO should move. The ones needing most care:
   - `d-ilo-09` (a re-tag keeps an off-subject ILO);
   - `d-ilo-03` (is an installation task an ILO?);
   - `clo-po-calc-lower-level` (re-tagged to an Apply PO, a recall CLO is still below it);
   - `d-ega-06` (a below-course CLO re-tagged in one run);
   - `d-ega-08`.
6. **Values wording.** May a draft add value terms to a CLO that already names values? And are "Augustinian-Marian values of community, truth and compassion" and "the Marian value of compassion" acceptable? (`d-ega-07`.)
7. **Bloom levels for EGA names.** Should a noun phrase such as "Socially Responsive Steward" get a Bloom level, or N/A? The level test for CLO-EGA pairs depends on the answer.

**Record the rulings apart from the dataset**, so that they apply equally to A1, A2 and B2. Two further risks remain:

- **The sample is small:** 58 items over 2 runs, with only 1–4 items in four of the seven courses.
- **The insufficient-evidence path is still untested.**

**7. Should the approach proceed to held-out evaluation?**

**Not yet.** I recommend against a held-out run now, for B2 or for A2.

- **The result would not be readable.** The held-out split is the one protected test.
  - Today, its main disagreement with the labels would come from the open policy question.
  - A false rejection there could be a checker error or simply the policy.
  - Spent now, the split would measure the question, not the checker.
- **Neither configuration is the one to confirm.**
  - A2 cannot recommend a re-tag.
  - B2 re-tags well but rejects more aligned outcomes.
  - The likely candidate combines B2's contract with verdict rules that faculty have settled. That would be a new prompt version, and it would need its own development run first.
- **The order I suggest:**
  1. Faculty rule on the questions above, recorded separately. This step is free.
  2. You decide whether any prompt change follows. It needs your approval, and none was made during B2.
  3. If a change is made, run a development comparison under a separate authorization.
  4. Only then use the held-out split, once, on the frozen configuration.
- **For any later run:** B2 reached 2 of the 3 invalid answers allowed. A longer run may stop early for review. That would be the stop working as designed, not a reason to weaken validation.
- **Not recommended:**
  - any production change (Claude stays locked: `configured: false`);
  - any use of the held-out split;
  - any prompt change before faculty review.

## F. Files and integrity

**New files (nothing was overwritten):**

| File | What it holds | Size | sha256 (first 16) |
|---|---|---|---|
| `docs/ai-eval-anthropic/p2-b2-result.json` | the harness's result, including the raw answers | 266,740 bytes | `4980e7eec5ce6a8a` |
| `docs/ai-eval-anthropic/p2-b2-ledger.json` | the guard's ledger | 29,638 bytes | `368d186f18d236ae` |
| `docs/ai-eval-anthropic/p2-b2-cases.json` | a read-only case record built offline from the two files above and the development split, with their hashes; shaped like `p2-a2-cases.json` | 187,245 bytes | `ef984e44cd49667a` |
| `docs/anthropic-p2-b2-report.md` | this report | — | — |

The harness also updated `docs/ai-eval-anthropic/spend-register.json`, which now has sha256 `6223494d2ec26a04`.

**The A2 baseline is unchanged.** Its files still match the hashes in A2's report and pre-registration:

- `p2-a2-result.json`: `082284ac04284ac1`;
- `p2-a2-ledger.json`: `23709c09c1ef83b9`;
- `p2-a2-cases.json`: `73c27948f75cb1b7`.

**Snapshot comparison.** 656 files were hashed before the run and 659 after.

- **Differences:** there are 4: the 3 new B2 files and the spend register.
- **Unchanged:**
  - the `.env` hash prefix (`9e8eb0103c0aae56`);
  - HEAD (`68926cb`);
  - the git diff hash, so no tracked file changed.
- **The git status hash:** it changed only because the 3 new files are untracked. Without their 3 lines, today's status hashes to the pre-run value.

**Unchanged:**

- the alignment dataset and its labels (`align-1`, sha256 `ab282a107df8c73b…`);
- the general dataset;
- the MiniMax results;
- the P1, A3, B1, A1 and A2 results;
- the faculty-review data;
- the prompts and the validator;
- the 47 rules and their pass mark of 79;
- the scoring, deductions, submission gates and curriculum policies;
- `server/.env`.

**Production lock.** The approval switch (`SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL`) is unset everywhere. The official check reports `configured: false`, even with a valid-format key in place. This was checked again after B2.

**Key scan.** Six places were scanned for the key, its last 12 characters and its body: the console log, the result, the ledger, the case record, the spend register and the background task outputs. None of the three appears in any of them, and no `sk-ant-` token appears either. The console log was displayed only after the scan, with tokens masked.

**Housekeeping.**

- No held-out log exists.
- No spend-register lock remains.
- Nothing is staged or committed.
- Every offline check ran under the network blocker, which logged no network attempt.
