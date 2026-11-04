# Stage E.2: final readiness report

Date: 2026-10-25.

- Nothing was committed, pushed, merged or deployed. No migration ran, no production data was touched, and no paid AI call was made.
- Every advisory stage is still **off by default**. The title policy is still **shadow** and `SYLLABUS_CHECK_PROVISIONAL_AI` is still **off**.

## 1. Decisions

| Decision | State |
|---|---|
| 1. Normalised titles | **Ready for controlled activation, not active.** The check and the submission gate now share one policy resolver (before, the gate always compared exactly). The impact is measured: only formatting-only titles change, from blocked to open. Different titles, other course numbers and missing parentheticals stay blocked. Steps and rollback: `docs/title-policy-activation.md`. |
| 2. Values | Six official core values stay canonical. The LCUP definitions are reference material marked *pending approval*. `values-lexicon.json` stays a proposed vocabulary. No supporting value is mapped without lesson evidence. Faculty text is never rewritten. Added: when the values question has answered, the generic Module-value draft is withheld, and the "needs your decision" entry names the supported value only when the lesson evidence supports it. |
| 3. Blind Compassion | **Removed.** The coded fallback ("Compassion" or a keyword-picked value, with a generic sentence) is gone. It also *displaced* any evidence-based AI draft for the same field, because coded suggestions win the field. The field is now listed as **NEEDS_REVIEW** ("Needs your decision") unless the model offers a draft grounded in the lesson. The official finding and its point are unchanged: score, pass, ready, deductions and summary are identical (tested against the old behaviour, which stays available as `SYLLABUS_CHECK_VALUE_SUGGESTION=legacy` for rollback). |
| 4. Wrong course code | Provisional AI stays off. Independent deterministic checks still report. With provisional feedback on, the course-specific relationships (Course-CLO, CLO-set, Content-course, Description-plan, Plan-sequence) can neither pass nor rewrite. |
| 5. Preservation | Hybrid-2, rule identifiers, official scoring and gates, stages, caching, offline checking and English/Tagalog are preserved. No new rule category. |

## 2. Automated verification

- **Tests:** 1156 server tests, 22, 52 UI and 12 other tests pass. The localization audit (2159 bilingual keys) and the production build pass.
- **Full pipeline (`stage-e2.test.js`, 64 tests):**
  - **Coverage:** every advisory stage on, on representative 18-week syllabi for BSIT IT 202, BSIE IE-402 and BSCpE CpE-304. These use the real curriculum identity, POs and EGAs, with a synthetic plan.
  - **Cases:** aligned, plus 15 deliberate-error cases each: weekly content, CLO mapping, ILO, ILO tag, activity, assessment, assessment level, value only named, supporting values without and with evidence, competency instead of a value, no value, references, title capitalisation, and combined.
  - **Assertions in every case:**
    - the official result is identical with all stages on and all off;
    - no recommendation contradicts another;
    - the advisory verdict is never positive for a defective syllabus.
  - **The contradiction checker is not vacuous:** it flags the two pre-E.2 behaviours when they are re-created.
- **Real browser:** Chrome headless rendered the real Verdict Panel and official check panel with the app stylesheet, in English and Tagalog, at desktop width and in a 390 px container, from real engine output. This is a static render: no login, database or live session (a live session would write to the configured database). Interactive behaviour was not exercised; manual steps are in `docs/stage-e-readiness.md` section D.

## 3. Defects found and corrected in this round

1. The submission gate ignored the title policy. An activation would have shown "ready" while blocking the submit.
2. **Browser check.** In shadow mode the advisory verdict said Pass / "formatting only" for a capitalisation-only title, while the official panel said "required, must be fixed". The advisory verdict now follows the policy in force.
3. The blind value template overrode evidence-based drafts.
4. With Stage B on, a correct weekly content could be rewritten to fit a wrong ILO (the scored ILO-content draft) while the ILO itself was also offered a rewrite.
5. With Stage B on and C or D off, activity, assessment and values drafts were offered for a lesson whose content or ILO was known to be off.
6. A Module-value draft could contradict the values question's answer. VAL-05 said "no replacement is proposed" while a draft was offered.
7. The verdict dropped the `withheld` field, so one rule of the contradiction checker could never fire. The reason a rewrite is withheld is now its own field and is shown in both languages.
8. The shadow-impact text said the title has no score effect. In fact a blocking title withholds the published score.
9. **Browser check.** The CUR-03 recommendation printed the whole course-code list as raw JSON. Also fixed: duplicate "Fixed rule" and "Provisional" pills, and a repeated "Academic alignment" result.
10. **Tagalog.** 33 of 53 sampled server sentences in the Verdict Panel were English-only (round 1 to Stage D). Now 0 of 55. Multi-issue APA explanations are shown sentence by sentence so each one translates. The audit runs as a test (`scripts/audit-verdict-i18n.mjs`).
11. A dictionary syntax error I introduced mid-round (an unescaped apostrophe) was caught by the tests and fixed before the final run.

## 4. Readiness

- **Software, for a controlled live evaluation: ready.** The plan, caps and stop conditions are in `docs/live-evaluation-plan.md`. It is about $0.25-$0.55 estimated if every phase runs, each phase separately capped. It needs your approval to start.
- **Normalised title policy: ready for controlled activation**, on your explicit approval.
- **Academic enforcement: not ready, and not requested.** Missing:
  - faculty review of `docs/academic-validation-package/` (0 reviewed);
  - institutional approval of the value definitions and the supporting-value vocabulary;
  - librarian confirmation of the APA rules (the official pages could not be fetched);
  - live accuracy evidence.
  - False-positive and false-negative rates cannot be stated until faculty labels exist.

## 5. Limitations and backlog

- **App-wide, not this round:** `body { min-width: 1100px }` makes every page scroll sideways on phones. The Verdict Panel itself wraps correctly at 390 px.
- **Translations:** the Tagalog wording added in E.1 and E.2 needs review by a Tagalog speaker. Model explanations stay in the model's language (English).
- **Backlog:** activity-to-assessment consistency, per-week reference relevance, a structured values field in the builder.
