# Stage E.7: offline academic reliability follow-up

Date: 2026-10-26. Scope: complete the interrupted D1/D2 follow-up only. The completed live evaluations remain in [the original E.7 record](stage-e7-phase2-evaluation.md); this work makes no paid call and does not start Phase 3.

## Existing work preserved

The working tree already contained the Hybrid-2 implementation, extensive tracked edits and untracked evaluation/documentation files. `server/lib/syllabuscheck/answerReview.js` was retained and continued as the starting point. The checker was not rebuilt or reset. Original baseline datasets, saved D1/D2 answers and request ledgers are retained so the historical measurements remain interpretable.

The module reviews what an answer says and proposes, beside the existing contract, quote and structured-field checks. A verified quotation shows where a quoted phrase occurred; it does not verify the explanation, establish academic truth or approve a proposed rewrite.

## Safeguards and their limits

After contract validation, staged explanations can receive advisory codes for wording from another relationship, an unsupported week, unsupported publisher/journal/website quality, unsupported source metadata, an overstated venue basis or a basis inconsistent with the relevance field. These cautions retain the matched phrase for faculty/librarian review. They do not reject the answer, change labels or structured fields, retry a model call or replace D2's official relevance verdict.

Draft review covers copied relationship wording, added participants or weeks, and—for values drafts—added activities/resources or a rejected value attached to a purely technical step. Values-draft activity and participant claims are grounded in the lesson source alone: course-wide laboratory units, general course activities or an invalid value statement cannot establish that this lesson actually has that activity. A suspicious draft is withheld from application and its reason is displayed. This protects the faculty's original text while leaving the academic judgment available for review. Shared terminology or a heuristic warning is not proof that a valid judgment is wrong.

| Saved D1 case | Concern to review |
|---|---|
| `vm-prog1-respect-supported` | Explanation copies test-log reporting behavior from another relationship; retain the lesson's own listening/learning evidence separately. |
| `vu-prog1-unrelated` | Draft introduces a classmate from another section absent from this lesson. |
| `vu-sensors-silly` | Draft retains Compassion while proposing technical checking/re-measurement without showing compassionate behavior. |
| `vu-prog1-name-only` | Draft copies another lesson's value statement. |
| `vu-prog1-no-activity` | A hidden draft invents laboratory activity where no activity or task was written. |

The checks are conservative English word-pattern heuristics. They can miss paraphrases, unlisted activities and non-English reasoning, and can flag legitimate shared context. Venue word overlap cannot establish a publisher's expertise, source authenticity, peer-review status or relevance. Faculty and librarian review remain necessary. The institution's value definitions, supporting-value mappings, integration categories and APA interpretation still require institutional review.

The live evidence behind these patterns is 17 D1 and nine D2 relationships from one run each on unreviewed synthetic examples. Regression matches on those answers are not measured precision, recall or faculty agreement. No new live measurement, held-out validation or repeatability measurement is included. The `vu-prog1-no-activity` insufficient-versus-generic interpretation remains an academic decision; no heuristic settles it. Stage B's previously flagged worked example is outside this follow-up and is unchanged.

## Versioned evaluation datasets

The original `stage-d1-dataset.json` (`stage-d1-1`, 17 items) and `stage-d2-dataset.json` (`stage-d2-1`, nine items) remain the live-evaluation baselines.

- `stage-d1-followup-dataset.json`, **stage-d1-2**, 29 items: the original 17 plus 12 new synthetic cases. Programming, systems engineering and a thermistor laboratory each distinguish a value merely named, a possible opportunity, demonstrated instructional integration and insufficient evidence. New wording is independent of worked prompt examples. Every expected label/field remains provisional and unreviewed.
- `stage-d2-followup-dataset.json`, **stage-d2-2**, 13 items: the original nine retain their labels/relevance expectations and gain provisional evidence-basis expectations. Four added venue cases test a subject-specific journal, a misleading keyword in another discipline's journal, a subject-named web publisher, and a generic title with a telling venue. The last is a **pending policy diagnostic**, excluded from agreement: the current basis enum has no `venue_only` value. No new official verdict or enum value is introduced.

Offline runner aliases are `--dataset stage-d1-followup` and `--dataset stage-d2-followup`. New examples have not been sent to a model. Saved E.7 results must never be relabeled as evaluations of the expanded datasets. Follow-up result reporting includes advisory codes/evidence so reviewers can inspect what triggered them.

The [academic validation package](academic-validation-package/README.md) was regenerated from its maintained exporter, using existing saved answers only. It includes the new provisional examples, current E.7 provenance, historical context for the named-only dispute, and clearly marked unverified model explanations/drafts. No reviewer decisions or notes existed in the generated JSON/CSV before regeneration. Source PDFs and faculty-authored syllabus content were not changed.

## Integration and invariants

Advisory codes and bounded matched evidence accompany existing findings into the Verdict Panel in English and Tagalog. Passing findings with explanation cautions remain available to review; cautions do not create duplicate failures or contradictory applicable recommendations. Unsupported drafts use the existing withholding path. Faculty-authored content remains unchanged until an authorized author explicitly accepts an eligible suggestion.

Older reports without review metadata remain readable. Offline review does not require cache invalidation, a new prompt version or another provider request. When a cached judgment already records contamination evidence, its `reviewEvidence.from` can refer to a sibling from the original request; that historical context is retained even when the current request grouping differs. Older reports lacking that context cannot prove the absence of contamination. The Hybrid-2 architecture and independent flags remain in place. This follow-up activates no stage, normalized title policy, schema `minItems` or advisory-stage enforcement. Official scores, deductions, the passing mark of 79, readiness and submission gates are unchanged.

No database migration, production-data write, `server/.env` edit, commit, push, merge or deployment is part of this work.

## Files changed in this follow-up

These are the follow-up's files, separate from the many pre-existing working-tree edits retained at takeover.

| Group | Files |
|---|---|
| Checker | `server/lib/syllabuscheck/answerReview.js` (continued existing module), `gemini.js`, `engine.js`, `verdict.js` |
| Checker regressions | `server/lib/syllabuscheck/stage-e7.test.js`, `stage-e7-verdict.test.js`, `stage-e7-datasets.test.js`; existing `stage-d.test.js` expectation updated for a displayed passing finding with an advisory warning |
| Evaluation | `server/lib/syllabuscheck/eval/stage-d1-followup-dataset.json`, `stage-d2-followup-dataset.json`, `answerReviews.js`, `metrics.js`; `scripts/eval-alignment.cjs` |
| Verdict UI and localization | `src/components/VerdictPanel.jsx`, `src/i18n/hybrid.js`, `src/lib/complianceView.js`, `src/lib/complianceView.test.js`, `tests/i18n-ui.test.jsx` |
| Documentation generators | `scripts/export-checker-rules.cjs`, `scripts/export-validation-package.cjs` |
| Documentation | `docs/stage-e7-academic-reliability-follow-up.md`, `stage-c-evaluation-plan.md`, `stage-e7-phase2-evaluation.md`, `stage-e7-d2-validation-proposal.md`, generated `ai-checker-rules.md` |
| Generated faculty package | `docs/academic-validation-package/README.md`, `validation-package.json`, `validation-package.csv`, `validation-package.html` |

## Verification record

All final checks passed after the last implementation changes:

| Check | Result |
|---|---|
| Targeted E.7 regression tests | 37/37 passed |
| Full `npm.cmd test` | 1,244 core + 22 localization + 53 rendered UI + 12 PDF UI = **1,331 passed**, zero failures/skips |
| `npm.cmd run audit:i18n` | 2,202 bilingual keys, 1,164 references; no hardcoded-string findings |
| `node scripts/audit-verdict-i18n.mjs` | Zero missing translations among 55 audited verdict sentences |
| `npm.cmd run build` | Passed, 208 modules; existing >500 kB bundle warning (approximately 1,024.18 kB JavaScript) |
| `git diff --check` | Passed; only existing line-ending conversion warnings |

Regressions exercise the five saved D1 cases, D2 metadata/basis warnings, valid shared wording, lesson-only activity grounding, retained cached contamination context, legacy report reading, flags off, withheld proposals and unchanged official scoring/verdict aggregates/gates.

Documentation exports ran offline with network APIs blocked; both exporters and their syntax checks passed. The package contains 253 records: 65 real text records and 188 synthetic records, with no duplicate IDs. The PDF importer printed its existing `TT: undefined function: 21` font warning during extraction; the export completed successfully.

## Stage C prepared, not executed

The [updated Stage C plan](stage-c-evaluation-plan.md) proposes one standalone r7 run of stage-c-2: 28 provisional items, C1/C2 only, seven initial model batches, at most 63 model requests under bounded retries plus one free key check and one price lookup. Proposed total cap: **65 requests and $0.09**. The historical expected bill is **$0.0070–$0.0295**, not a current quote. Current prices would be fetched and enforced only during a separately approved live run. Stop controls cover access/refusal errors, cost/request bounds, transient/unproductive responses and unresolved distinct relationships. Earlier E.3–E.5 smoke evaluations included some Stage C relationships; no standalone Stage C r7 dataset evaluation or provider call of any kind was executed in this follow-up.
