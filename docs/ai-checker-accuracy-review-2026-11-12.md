# AI Checker accuracy review, 2026-11-12

Why the AI Checker's results look poor, traced to code and configuration, using the one recorded **real** Claude run on a real syllabus (IT 202 Computer Programming 1, `docs/ai-checker-sample-comparison-2026-11-05/attempt-2/`) and the switches in `server/.env` (only the `SYLLABUS_CHECK_*` lines were read; no secret). Offline only: no provider request, no paid run. No checker code was changed; three tests were added (section 6).

## 1. Short answer

The AI is mostly doing what the code tells it. The poor results come from **what it is asked, which rules it is asked with, and how the answers are scored**, not from a single broken line:

1. **Your server does not run your VPAA rules.** They are implemented in the Policy V2 path, which is off. Your server runs the older legacy prompt with seven extra advisory stages switched on.
2. **The scoring floors a real syllabus at 0.** Every partly aligned relationship costs a point, with no cap: the real run lost 118 points over 143 relationships.
3. **Some rule wording makes "partly aligned" almost certain**, so 107 of 143 answers were partial and 61 rewrites were proposed.
4. **Two features you asked for disagree** on whether the week's content or the ILO comes first.
5. **No faculty-reviewed answer key exists**, so "accuracy" cannot be measured yet, only consistency.

## 2. What your server actually runs

| Setting (`server/.env`) | Effect |
|---|---|
| `SYLLABUS_CHECK_ACADEMIC_V2` not set | **Policy V2 off**: the seven VPAA relationships, the fixed CLO classes (VR-08) and the V2 dispositions are not used |
| `STAGE_A, STAGE_B, STAGE_C1, STAGE_C2, STAGE_C3, STAGE_D2, REQUIREMENTS_ADVICE` = on | Seven advisory stages on top of the legacy prompt |
| `SYLLABUS_CHECK_WHOLE_PLAN=on` | The whole-syllabus plan rewrites dependent fields together (more requests) |
| `COURSE_CONTEXT=scoped`, `OUTPUT_FIELDS=scoped`, `CACHE_WARMUP=on` | Cost settings; `scoped` also keeps the course description out of CLO questions, so rule M14 holds on this machine |
| `SYLLABUS_CHECK_AI_GATE` not set | Advisory gate: AI results never block |

Measured offline on the IT 202 syllabus: **139 questions per check with every stage off, 240 with your switches** (73% more), before the whole-syllabus plan's own requests. Every extra stage is advisory (no points) but each produces findings and rewrite suggestions, which is a large part of the "too many suggestions" experience.

## 3. What the real run shows (IT 202, Claude Sonnet 5.5, every stage off)

| Relationship | Aligned | Partial | Not aligned | Points lost |
|---|---:|---:|---:|---:|
| ILO-CLO | 0 | 20 | 10 | 50 |
| ILO-assessment | 1 | 15 | 4 | 27 |
| ILO-activity | 2 | 17 | 1 | 20 |
| Module-value | 0 | 10 | 0 | 10 (+1 rule) |
| CLO-EGA | 2 | 6 | 3 | 6 |
| CLO-PO | 1 | 12 | 6 | 2 |
| ILO-content (advisory) | 0 | 19 | 1 | 0 |
| Others | | | | 2 (one link) |
| **Total** | **11** | **107** | **25** | **118 → score 0** |

Reading the explanations, most are internally consistent. Some partials are deserved: the imported PDF really has a wrong prerequisite, orientation-week ILOs, and ILOs written as teacher actions. The pattern behind the rest is below.

## 4. Causes, with evidence

| # | Cause | Evidence | Type |
|---|---|---|---|
| C-1 | **Your VPAA rules are not the path in use.** VR-01 to VR-08 and VR-16 are implemented and tested in Policy V2, which is off. The legacy path judges different pairs, for example the reverse ILO-content, and ILO-assessment as a scored relationship, which VPAA lists as "optional diagnostic only". | `docs/vpaa-conformance/traceability-matrix.md`; `docs/lcup-policy-v2-implementation/requirements-matrix.md` row "Direct ILO ↔ Assessment outside the seven" | configuration and owner decision |
| C-2 | **Uncapped per-relationship deductions.** 1 point per partial, 3 per not aligned, for every ILO × tag. A 13-week syllabus with 20 ILOs and 30 ILO-CLO tags can lose 50 points on ILO-CLO alone. VR-10 says "authorized deductions unchanged", so this is the approved design, but it makes any real syllabus score 0. | `policy.js` (`partialAlignment: 1`, `alignment: 3`); real run: 85 deductions, 118 points | owner policy |
| C-3 | **ILO-content asks the contents to show application.** Criterion (2): the contents must reach the ILO's Bloom level, "not only a list of topic names". A Course Contents field is a topic list by design, so 19 of 20 came back partial. Advisory (no points), but each produces a finding and, with Stage B off, a rewrite of the contents. | `gemini.js` prompt, ILO-content criterion (2) | prompt wording |
| C-4 | **ILO-CLO pushes every ILO toward the CLO's own words.** Criterion (1), "a smaller step of the CLO, in the same subject", was read as "mention the CLO's object". The real run rewrote week after week of Java ILOs to begin "Analyze the computing requirements…", the wording of CLO 2. | `attempt-2/suggestions.json` (16 ILO rewrites) | prompt wording |
| C-5 | **An ILO tagged to two CLOs is scored against both.** An ILO about Java syntax tagged to CLO 2 and to the ethics CLO 3 loses 3 points for CLO 3. VPAA says "supported mapping plus disputed extras needs faculty review". The code treats a disputed extra as a mapping finding only when another tag is fully ALIGNED, which never happened in the real run (0 of 30 aligned). | `engine.js` line 313 (`supported` = ALIGNED only); requirements matrix row 3 | code vs VPAA wording |
| C-6 | **Content-first conflict.** VPAA VR-14 puts Course Content before the ILO. With Stage B on, the code respects it: an ILO-content rewrite of the contents is withheld while the contents fit the course (pinned by the new tests). With Stage B off, and inside the whole-syllabus plan, the contents are treated as fitted to the ILO and rewritten to match it. The real run (Stage B off) rewrote 10 weeks of contents this way. Changing it breaks six tests that encode the whole-plan design, so it is an owner decision, not a silent fix. | `engine.js` precedence block; `wholeSyllabusPlan.test.js` lines 73, 147; `suggestionOrder.test.js` line 113 | design conflict |
| C-7 | **No answer key.** The Phase 3 evaluation records are unreviewed drafts (`reviewStatus: "unreviewed"`, `facultyVerdict: null`), and the earlier dataset is author-written. Any "accuracy" number is agreement with our own expectations. | `eval/phase3/manifest-phase3-1.json` | missing evidence |

## 5. What I recommend, and what each needs

| Step | Change | Effect on scores | Needs |
|---|---|---|---|
| R-1 | **Turn off the stages you have not evaluated** (C1, C2, D2, requirements advice, and the whole-syllabus plan until C-6 is decided). Keep A, B, C3, which map to VPAA relationships. | none (advisory) | your decision; settings only |
| R-2 | **Decide C-6**: content first everywhere (the plan fits ILOs to contents) or keep the plan's ILO-first design. | none (advisory) | your decision; then I implement and update the six tests |
| R-3 | **Rewrite two criteria** behind a switch, off by default. ILO-content judges topic coverage only. ILO-CLO accepts a step that contributes to the CLO without restating its subject. Both change the prompt version. | none until switched on | your approval; offline replay, then a small paid comparison |
| R-4 | **Scoring proposals** behind a switch, off by default, compared with the shadow score: ILO-assessment advisory (as VPAA says), a disputed extra CLO tag goes to review instead of −3, and per-area caps. | official score unchanged until approved | your approval (institutional policy) |
| R-5 | **Policy V2 as the main path**, if that is the target: re-prepare its evaluation data, then the authorized staging test. | V2 is advisory-only | your decision and a paid staging test |
| R-6 | **Build a real answer key**: 20 to 30 relationships from two or three real syllabi, judged by faculty. It is the only way to measure accuracy and to know whether R-3 helps. | none | faculty time |

Steps R-1 and R-2 need no paid run. R-3 and R-4 can be built and tested offline now, switched off, so nothing changes until you approve.

## 6. What was changed and verified

- **No checker code changed.** I tried a fix for C-6 limited to Stage B off. It made the new content-first test pass (and that test failed against the original code), but it broke six whole-syllabus-plan and ordering tests that encode the opposite design. I reverted it; `engine.js` and `gemini.js` are byte-for-byte as committed.
- **Added `server/lib/syllabuscheck/content-first.test.js`** (3 tests), pinning today's correct Stage B behaviour:
  - the contents are not rewritten while they fit the course;
  - they may be rewritten when off-course;
  - ILO-content costs no points.
- **`npm test`: 2,441 of 2,441.**

## 7. Limits

- One real run on one imported syllabus, with every stage off; your live configuration (stages on) has never been run with the real model.
- I judged the AI's explanations as a reader, not as faculty.
- Policy V2 behaviour was not examined in depth here (see `docs/ai-checker-audit-2026-11-12.md`).

## 8. Decision and fix: content first (C-6), 2026-11-12

The owner chose content first everywhere. Implemented the same day (CHANGELOG v1.83.0):

- **With Stage B off**, an ILO-content answer no longer rewrites the week's course contents (`engine.js`). Stage B on was already correct.
- **The whole-syllabus plan** re-fits an ILO it rewrote to its week's content and its CLO together, and never rewrites the content to suit the ILO (`wholeSyllabusPlan.js`).
- **No score, deduction, finding, gate or prompt changed.**
- **Verification:** `npm test` 2,443 of 2,443; conformance 276 of 276; build passes.
- **Limits:** tested with scripted answers only. With the real model, the ILO-content criterion (C-3) still marks many contents "partial", so a plan may try to re-fit an ILO twice and then list it for review (each field is bounded to two rewrites).

## 9. Reliability refactor, rules unchanged (CHANGELOG v1.84.0)

The owner asked for a refactor of the code, pipeline, scripts and prompt that keeps the rules, the relationships and how recommendations follow from them unchanged.

| Change | Why | Effect on results |
|---|---|---|
| A request never mixes CLO relationships with relationships that read the course description, when CLO questions go without it (`SYLLABUS_CHECK_CLO_DESCRIPTION=off`, M14) | A mixed request lost the description for every relationship in it, so Content-course or Description-plan was judged blind, and its answer was reused as if the description had been sent | The description relationships are judged with their text again. A few more requests with the switch off (51 to 53 in the benchmark). Default unchanged |
| `SYLLABUS_CHECK_AI_MAX_COST_USD` required in staging and production with a provider configured; a malformed value stops the server | Audit A-2: without it one check could reserve tens of dollars | None on results. Your development server is unaffected (checked as a yes/no only) |
| `real-run-replay.test.js`: the recorded real Claude answers for IT 202 replayed offline through today's engine | The only real run is now a regression guard for any future refactor | Pins 143 relationships asked, 85 deductions and 118 points exactly, no contents rewrite from ILO-content, and no other proposed rewrite lost |
| `--legacy` evaluation scripts and the harness tests ignore the developer's own `SYLLABUS_CHECK_*` switches (v1.82.1) | The tests had been reading `server/.env` and failing on this machine | None |

The replay also explains why the IT 202 check now shows 14 rewrites instead of 61: 10 were contents rewrites (content first), and the rest are listed as **waiting** for the CLO or ILO above them (the top-down suggestion order, on by default since bb02153), not dropped.

**Deliberately not changed** (each changes what the checker concludes, so each needs your approval): the M14 default; the ILO-content and ILO-CLO prompt wording (R-3); the scoring (R-4); the stages on in `server/.env` (R-1); Policy V2 (R-5). `docs/ai-checker-rules.md` is pinned by hash and was not regenerated.

**Verification:** `npm test` 2,454 of 2,454 plus the UI suites; conformance 276 of 276; VPAA UI 28 of 28; `npm run build` passes. No real AI model was run.
