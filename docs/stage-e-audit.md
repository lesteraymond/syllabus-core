# Stage E - AI Checker architecture audit

Date: 2026-10-25. Scope: Stages A, B1-B4, C1-C2, D1-D2 on top of the Hybrid-2 engine. Nothing was rebuilt; two small integration fixes were made (marked **FIXED**). No provider was called, no migration run, nothing committed.

## 1. The pipeline as one flow

```
Course identity (coded CUR-*, curriculum record)            official, deterministic
  -> CLO            Course-CLO, CLO-set                      A  (advisory)
  -> PO / EGA       CLO-PO, CLO-EGA, CLO-anyPO/EGA (scored)  + mapping advice            A
  -> Weekly content Content-course                           B1 (advisory)
  -> ILO            Content-ILO, ILO-content (scored)        B2
  -> ILO -> CLO     ILO-CLO (scored), ILO-anyCLO             B3
  -> CLO coverage   CLO-coverage                              B4
  -> Activity       ILO-activity (scored), Activity-fit      C1
  -> Assessment     ILO-assessment (scored), Assessment-fit  C2
  -> Values         Module-value (scored), Value-use         D1   + VAL-04 (course profile)
References          REF-02/03/04 deterministic; Ref-relevance (AI)   D2
```

Each deeper question is asked only after its scored question was answered ALIGNED and the fields before it are not known to be wrong. A rewrite is offered only for the field responsible; when an earlier field is wrong or unverified, later rewrites are withheld (`lessonfit.draftWithheld`).

## 2. Findings

| # | Area | Finding | Evidence | Status |
|---|---|---|---|---|
| 1 | Duplicate evaluations | No relationship id is asked twice in a clean run. Value/Activity/Assessment have a scored and an advisory question about the same field by design; the advisory one is skipped unless the scored one is ALIGNED. A reference already judged by its page (REF-plan) is not asked again. | `stage-e.test.js` "one question per relationship" | No action |
| 2 | Missing relationship checks | Not checked anywhere: activity -> assessment consistency; values -> ILO directly; reference -> a specific week (relevance is course-level only); co-requisite and semester (the transcribed curriculum records hold them, the checker's curriculum shape does not carry them). | `local-curriculum-data.cjs` rows have `corequisite`, `semester` | **Reported** (new checks would need approval) |
| 3 | Contradictory findings | Structured answers whose label contradicts their own fields are shown as NEEDS_REVIEW with no rewrite and no derived rule. Across the 256 flag combinations and 15 scenarios no contradictory pair was produced. The scored Module-value can say ALIGNED while Value-use says "name only": intended (the advisory layer is stricter) and labelled. | `stage-e.test.js` scenarios | No action |
| 4 | Inconsistent status handling | (a) The verdict silently cut its list at 200 findings in list order, so a NOT_CHECKED row could displace a FAIL. (b) A title that differed from the curriculum only in capitalisation was FAIL (2 of the 3 real syllabi: "Systems Engineering" vs "SYSTEMS ENGINEERING"). | real-syllabus run, `export-validation-package` | (a) **FIXED**: FAIL and NEEDS_REVIEW are kept first and `omitted` is reported and shown. (b) **FIXED in the advisory verdict only** (NEEDS_REVIEW, says why). The **official** exact comparison is unchanged and still counts it: changing it needs your decision. |
| 5 | Recommendation precedence | Order content -> ILO -> CLO tag -> activity -> assessment -> values. Values previously could be rewritten while the assessment was invalid. | `lessonfit.draftWithheld` | **FIXED** in Stage D (`assessment_invalid`); tested in Stage E |
| 6 | Missing curriculum evidence | No approved curriculum gives NEEDS_REVIEW, never PASS (tested on the real syllabi). A failing course code is a CRITICAL official gate and skips every AI question, so the verdict is "offline" with 29 NOT_CHECKED rules; correct, but a code typo hides all semantic feedback. | sensors run before the code was taken from the catalogue | **Reported** |
| 7 | Unsupported semantic assumptions | The six value definitions are the university website's wording, pending institutional approval. The VAL-04 thresholds (50% integrated, 60% copied over 4+ lessons) are proposals. The reference kind is read from the text (heuristic); relevance is judged from the citation only. The official APA pages could not be retrieved here, so the APA rules are not verified against them. | `server/config/marian-values.json` | **Reported**; findings stay advisory |
| 8 | Provider requests | 13-19 requests and 127-202 questions per syllabus with everything on, against 7-11 requests and 76-124 questions today. Input rises about 5x (30k -> 150k tokens, about $0.011-0.015 per check at the blended rate) because the fixed instructions (66-82% of the input) are repeated in every request. | `docs/stage-e-provider-efficiency.md` | **Reported** with options (section 4) |
| 9 | Feature-flag interactions | All 256 combinations run, leave the official score, deductions and pass flag identical, and ask only what their flags allow. D1 without B/C works but every values rewrite is withheld as "upstream unverified", so D1 is meaningful only with B and C on. | `stage-e.test.js` sweep | Documented |
| 10 | Backward compatibility | All additions are optional fields in `report_json`. A report saved before C/D rebuilds its verdict without them and invents no D result. With every flag off the prompt is byte-identical to alignment-10 and the cache keys are unchanged. | `stage-e.test.js` saved-reports test | No action |

## 3. Observations from the real syllabi (data, not defects)

These are properties of the faculty text the checker correctly reports; they are policy questions for the institution.

- The values columns mostly list generic words ("Respect", "Obedience", "Critical Thinking"), often none of the six core values; several rows fail VAL-01 (an existing scored rule).
- Reference lists use mixed styles (MLA-like "Accessed 2 Aug. 2024", quoted titles, library call numbers); the APA validator flags them.
- IT 202 has overlapping week labels ("3-4" and "4-5").
- Prerequisite wording differs from the curriculum record ("4 Year Standing" vs "4th Yr").
- The course code spelling differs between PDF and catalogue ("CpE 304" vs "CpE-304"); the checker compares after trimming and case folding only.

## 4. Provider efficiency options (none enabled)

1. Provider-side prompt caching: the system prompt is identical across the requests of one check; keeping it as a stable prefix lets a provider that caches prefixes charge less. Not measurable without a live call.
2. Larger batches (now 12 questions): fewer repeats of the instructions, but a larger blast radius per failure and weaker per-answer attention. Needs an accuracy comparison.
3. The trimmed prompt (type-grouped, only the needed instructions): about 65% fewer input tokens in simulation. **Not enabled**; the full prompt remains the baseline until accuracy and recommendation quality are compared.

HTTP 402 and 403: one refusal stops new batches; batches already in flight finish (at most the concurrency, default 3); no retry; nothing is sent during the cooldown (`SYLLABUS_CHECK_AI_COOLDOWN_SEC`, 300 s). Tested for 401, 402 and 403, including a strict single-request case.
