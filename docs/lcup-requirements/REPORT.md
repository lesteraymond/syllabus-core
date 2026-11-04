# Consolidated original-requirements verification

Date: 2026-10-29. Project: LCUP Syllabus Management System, Hybrid-2.

The consolidated verification and confirmed missing implementations are complete. **Production code does not yet provide active, comprehensive coverage of every original specification.** Most semantic paths exist, but the inspected local configuration disables them. APA checking and document-layout coverage have specific limits. Offline software tests establish execution and safety properties; they do not establish academic accuracy.

## One requirements matrix and execution evidence

The [requirements matrix](requirements-matrix.md) is the single mapping of original requirements to production files/functions, before/after status, actual configured execution, deterministic/Claude responsibility, official/advisory treatment and test coverage. It explicitly labels unused or disabled semantic checks as DISABLED.

Inspected production paths include:

- Builder: `PlanStep`, `ClosStep`, `InfoStep`, `parts.Auto`, `useDraft`, `syllabusModel`, `draftSave`, learning-plan headings and translated labels.
- Request/save/checking path: `routes/compliance`, `routes/syllabusCheck`, `routes/syllabusContent`, `compliance/service`, shared master resolution and saved report repository.
- Deterministic checks: `compliance/standard-v4.json`, `compliance/rules`, browser parity, `syllabuscheck/engine.coded`, `validation`, `quality`, `verdict`.
- Semantic execution: `gemini` (the provider-neutral alignment module despite its filename), `anthropicClient`, prompt variants, stage switches, pair builders, `lessonfit`, answer/evidence validation, recommendation precedence, values and reference parsing.
- Presentation/gating: `HybridProblem`, `VerdictPanel`, `hybridView`, compliance findings, scoring policy and submission gate paths.

[Sanitized local configuration](environment.json) shows all optional academic switches off, including C3 and the new advice switch. Anthropic is selected with `claude-sonnet-5-5`, but `SYLLABUS_CHECK_ANTHROPIC_APPROVED_MODEL` is unset. `providerConfig` therefore returns `configured:false, approved:false`. This is a local configuration inspection; a separately deployed process or external environment override was not observed.

A synthetic syllabus was also run through that actual local configuration with all network access rejected. [Configured execution evidence](configured-execution.json) records 153 deterministic check instances, zero academic judgments, zero provider attempts and `alignmentStatus:not_evaluated` with `failure.kind:not_configured`. A rule can produce multiple check instances: this does not change the count of **47 deterministic rules**. The AI gate remains the existing advisory default. No setting was changed to make a semantic check run.

The local values-definition file reports `pending_approval`, version `lcup-core-values-2026-10-25`; its supporting-values lexicon is `proposed`. These existing reference statuses were retained.

## Confirmed gaps implemented

**Content-first lesson authoring.** New instructional rows use `authoringOrder:1` and start without an ILO. The Builder requires nonempty Course Content before adding an ILO, an authored ILO before entering an empty learning-activity cell, and learning activities before entering an empty assessment cell. Clear, translated explanations describe these dependencies in English and Filipino. Markup-only content does not unlock an ILO.

Existing rows have no marker and remain editable. New rows appended to an older draft use the new policy. Duplication preserves all source text and mappings, gives the copy fresh row/ILO IDs, and applies the new policy to empty cells. Already populated text stays editable even when an earlier field is cleared. No downstream text, ILO or tag is automatically deleted. Examination rows keep their existing behavior. The marker survives the normal save payload and hydration/reopen path; no schema migration is needed.

These are Builder authoring controls, not new API or submission gates. A legacy row or another API client is not retroactively rejected for its creation order. The printed columns remain Week → ILO → Course Content → Suggested Learning Activities → Suggested Assessment Tasks → Expected Values. Authoring dependencies do not reorder that layout.

**CLO classification coverage.** The advisory verdict already checked four CLOs and whether each label was valid. Four CLOs all marked Enabling could pass label validity while omitting three required classifications. `verdict.cloChecks` now independently reports missing classifications among Introductory, Enabling, Demonstrating and Integration of Values. It does not assign a classification, rewrite CLOs, add a scored rule or change a submit condition. The existing exactly-four finding remains advisory rather than a newly imposed hard gate.

**Title-to-description advice.** A new `Title-description` relationship compares the selected course identity with the faculty description. Existing `Description-plan` checks whether the description fits the taught plan; it could not independently catch a description and plan that agree with each other about the wrong subject. The new check supplies that separate question without replacing curriculum identity checks.

**Specific Week 1 introduction advice.** Existing `weekOneCheck` detects orientation keywords conservatively but cannot establish that Week 1 introduces this course and its objectives. New `Week1-introduction` advice compares the supplied title/CLO objective context with Week 1 content, ILOs and activities. The Builder has no separate formal course-objectives field, so the supplied CLO statements are explicit objective context; no additional institutional objectives are invented. Faculty must assess that interpretation during academic evaluation.

The two new semantic types use **`SYLLABUS_CHECK_REQUIREMENTS_ADVICE=on`**, which is unset/off by default. This is one optional switch inside the existing alignment service, not a new checking engine or development phase. It does not activate C3, other optional stages or a provider. No `.env` or `.env.example` change was made.

Both types are advisory, cost zero points, never block submission, and have no rewrite target. Recommendations are displayed for faculty review rather than applied as replacement text. A nonaligned answer without a recommendation is rejected as incomplete. Existing quotation, schema and provider-failure checks remain responsible for answer integrity; specificity/academic correctness of a plausible recommendation still needs faculty evaluation.

The new pair pass has its own prompt/cache identity and uses the same Claude adapter, schemas, retries and findings as existing checks. Its wording is kept out of the scored and existing staged requests, preserving their prompt/schema/cache identity even when the new switch is enabled. All-off prompt and earlier C3 prompt hashes remain unchanged.

Missing fields become insufficient evidence or NOT_CHECKED, never an inferred pass. A grouped row containing Week 1 cannot prove which week contains the introduction; even an AI ALIGNED answer is surfaced as NEEDS_REVIEW with a timing-confirmation recommendation. For these new types, a side exceeding 6,000 characters is not sent as a truncated excerpt and certified; it becomes NOT_CHECKED with a complete-text review explanation.

## Seven relationships and separate ILO–Assessment impact

All seven requested relationships have independent pair execution paths. No duplicate semantic implementation was added where one already existed:

1. Title ↔ Content: Stage B `Content-course`.
2. Content ↔ ILO: core `ILO-content` and optional explicit content-first `Content-ILO`.
3. ILO ↔ CLO: core `ILO-CLO`, with optional B3 mapping advice.
4. Content ↔ Activities: C3 `Content-activity`.
5. ILO ↔ Activities: core `ILO-activity`.
6. Content ↔ Assessment: C3 `Content-assessment`.
7. Activities ↔ Assessment: C3 `Activity-assessment`.

Their existence is not active production semantic verification: B/C3 are off here, and the provider guard prevents core Claude calls as well. Tests enable those existing switches only in isolated environment objects with scripted responses.

The existing direct **ILO–Assessment** relationship remains separate from those seven. Its scored type, cardinality and deductions are unchanged: NOT_ALIGNED costs 3 points; PARTIALLY_ALIGNED costs 1. No new ILO–Assessment pair or requirement was added. A regression isolates its three-point impact and confirms the new advisory switch does not change it.

Existing recommendation dependencies are retained: fix off-course content before proposing conflicting ILO rewrites, then review CLO mappings, activities and assessments. Independent raw judgments are still retained. When content itself is off-course, an ILO-related display finding may be NEEDS_REVIEW with upstream responsibility rather than a second independent FAIL; that is existing precedence, not suppression of the underlying NOT_ALIGNED judgment. Stage C3 still evaluates its three links independently of the ILO result.

## Verification results

**529 tests passed, zero failed in the final targeted runs.** Exact arguments and log names are in [test-commands.json](test-commands.json). Reproduce the consolidated offline suite from the repository root:

```powershell
node scripts/lcup-requirements/run-tests.mjs
node scripts/lcup-requirements/verify.mjs
```

| Group | Passed | Log |
|---|---:|---|
| New consolidated requirements and mocked Claude path | 21 | [requirements](requirements-tests-final.log) |
| New bilingual React lesson authoring | 6 | [lesson UI](lesson-ui-final.log) |
| Existing C3, verdict and model | 80 | [core](core-regressions.log) |
| Existing academic stages, validation, scoring and providers | 223 | [alignment](alignment-regressions.log) |
| Deterministic parity, rules, routes/gates, findings and save workflow | 161 | [workflow](workflow-regressions.log) |
| Existing importer UI | 16 | [importer](importer-ui-regressions.log) |
| Catalog/content HTTP tests, including new marker preservation | 22 | [catalog](catalog-regressions.log) |

Coverage includes every requested link failing independently, all seven failing together, all fields populated with unrelated subjects, preserved ambiguous/missing CLO tags, absent inputs, grouped weeks, examination rows, provider unavailability, an outage limited to the new advisory request, missing recommendation rejection and long-text context limits. One all-populated example deliberately combines geography content, violin performance ILO, programming CLO, pastry activity and astronomy assessment. Scripted answers exercise the findings pipeline; they are not fabricated faculty judgments or evidence of Claude's actual accuracy.

React tests operate real Builder components in Happy DOM in both languages and cover authoring order, unchanged headings, legacy editing, source-preserving duplication, exam rows, clearing upstream text and serialized save/reopen. HTTP tests exercise the production content routes through an in-memory adapter, capture the save payload and reopen it; another synthetic syllabus is unchanged. These are offline integration tests, not a real browser plus disposable SQL end-to-end run. No database connection or migration was used in this task.

Earlier test attempts are retained: [initial requirements log](requirements-tests.log), [initial core log](initial-regressions.log), [initial UI log](lesson-ui.log). Initial test failures exposed a too-strong assertion expecting FAIL where existing upstream precedence returns NEEDS_REVIEW, an old fixture assumption that a fresh lesson already contains an ILO, and a UI selector that did not account for StableButton's hidden sizing labels. Assertions/setup/selectors were corrected to the intended behavior; final tests were then executed successfully. No application behavior was weakened to make these pass.

The full `npm test` command was not run because it includes evaluation/export tests that can rewrite protected artifacts. No accuracy evaluation, paid provider request or protected dataset replay was started.

## Exact implementation changes and preservation

Modified pre-existing files, relative to the task-start working tree:

| File | Change |
|---|---|
| `server/lib/syllabuscheck/stages.js` | Optional advice flag, prompt segments/identity and type trimming; old defaults/labels retained |
| `server/lib/syllabuscheck/gemini.js` | New optional prompt wording, advisory/no-rewrite type recognition and required recommendation validation |
| `server/lib/syllabuscheck/engine.js` | Separate existing-service advice pass; scored/staged prompts isolated; honest missing/unavailable/long-context reporting |
| `server/lib/syllabuscheck/acceptance.js` | New types classified as optional |
| `server/lib/syllabuscheck/identity.js` | New course-specific advice cannot claim a curriculum-verified pass without course identity |
| `server/lib/syllabuscheck/verdict.js` | Classification coverage and new typed advisory findings, grouped timing review, recommendations and responsibility |
| `src/lib/syllabusModel.js` | New instructional rows start content-first with optional policy metadata; legacy hydration unchanged |
| `src/views/builder2/PlanStep.jsx` | Dependency-aware controls and localized guidance without column changes or destructive updates |
| `src/views/builder2/parts.jsx` | `Auto` supports disabled state and accessible hint descriptions |
| `src/i18n/index.js` | Load new English/Filipino authoring messages |
| `src/lib/syllabusModel.test.js` | New-row expectation and explicit setup of a legacy authored-ILO fixture |
| `server/routes/catalog.routes.test.js` | Marker/save/reopen preservation test; fake unmigrated DB recognizes previously introduced optional PO support tables |

New implementation/support files:

```text
server/lib/syllabuscheck/requirementsAdvice.js
src/lib/lessonAuthoring.js
src/i18n/lessonAuthoring.js
tests/lesson-authoring.test.jsx
scripts/lcup-requirements/requirements.test.cjs
scripts/lcup-requirements/test-ui.mjs
scripts/lcup-requirements/run-tests.mjs
scripts/lcup-requirements/verify.mjs
```

New verification artifacts are under `docs/lcup-requirements/`; retained compiled test output is under `tmp/lcup-requirements/`. No existing files were deleted. This work creates no database tables and changes no database records.

[Integrity verification](integrity.json) compares 1,067 original files with the task-start [baseline](before.json): **1,055 unchanged, 12 intended modifications, zero missing files and zero unexpected modifications**. HEAD remains `68926cb392756c07bb0b999538d098d1038be368`. Existing uncommitted work was preserved. [Final Git status](after-status.txt) includes that pre-existing work and must not be mistaken for this task's change list.

Protected unchanged files include the 47-rule data/engine and browser counterpart, policy/deductions/scoring, passing mark 79 and submission-gate implementations, C3 lesson-fit implementation, Program Outcomes/seeds/curriculum references, `server/.env`, approved PDFs/fixtures, all prior correction/readiness reports, historical evaluations and protected datasets. Existing semantic/scoring responses are still subject to the unchanged policy. The new classification finding can affect the advisory verdict and its unapproved descriptive rubric, but cannot affect official score or submission.

## Remaining limitations and final assessment

- **Active coverage is incomplete.** The configured provider is not approved, all optional academic flags remain off, and actual local-config execution produced no semantic judgments. The newly added semantic checks also remain off. No claim is made about a separately deployed environment.
- **Whole-syllabus coverage has boundaries.** Structural validation checks schema fields, headers/column presence, required cells, mappings and week schedules. Many headings are fixed by the Builder rather than faculty-editable text. It does not prove every arbitrary statement true or academically appropriate, inspect every exported PDF/DOCX layout detail, or independently certify each long field's entire text. Existing semantic request limits remain unchanged; new advice explicitly reports its own context-limit omissions.
- **APA 7 is partial and disabled here.** D2 provides text-based author/date/components/punctuation/DOI/URL checks and source-type uncertainty. Plain text does not establish hanging indents, italics or full correctness for every source type. Relevance and authenticity are separate; no DOI lookup or reference website fetch was performed here.
- **Diverse-learner review already exists but is conditional.** C1 asks for learner-support evidence when its existing core/upstream conditions allow the deeper question. It does not unconditionally audit accommodation for every row. No additional universal accommodation checklist or learner-profile assumptions were introduced.
- **Values evidence needs its existing review.** Approved core names are retained, but local narrative definitions and the supporting lexicon have pending/proposed statuses. This task did not approve them or infer an institutional interpretation. Core Module-value and D1 have different scoring/advisory roles, preserved in the matrix.
- **Faculty meaning and chronology are not invented.** CLOs provide course-objective context because there is no separate objectives field. Grouped Week 1 timing needs confirmation. Ambiguous mappings stay intact. Existing drafts are not forced through a new authoring order or automatically reprocessed.
- **Earlier PO correction rollout is outside this work.** No PO data was edited and no migration was applied. This task does not assert that a separate existing-database rollout has occurred.
- **Software test success is not academic validation.** Mocked model answers establish independent execution, preservation, failure handling, scoring isolation and display behavior. They cannot establish false acceptance/rejection rates, educational appropriateness or faculty agreement.

The next step is review of this matrix, implementation and evidence, followed only when authorized by faculty evaluation of controlled semantic cases and explicit operator decisions about provider approval/feature flags. No switches were enabled, and no live Claude evaluation was begun. Work stops for review.
