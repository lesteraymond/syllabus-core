# AI Checker re-plan

Plan agreed with the owner on 2026-11-12. Goal: the checker reads the **whole syllabus**, finds every misalignment and conflict, and gives **one set of recommendations that agree with each other**, so a re-check after accepting them shows no misalignment or conflict.

Status: **Phases 1–3 built and tested offline** (2026-11-12), with scripted model answers only. No real AI model has run it.
- The server can run it in **shadow mode**, behind a switch that is off by default, for comparison only. The current checker (`engine.js`) and the official score are unchanged.
- The **first paid run is prepared but not run**. It needs the owner's approval of a budget.

## 1. The owner's rules

- **EGA** is fixed, given by the school, and rarely changes.
- **PO** is given by the school per program and based on the EGAs.
- **CLO** is written by faculty and aligned to the course title, PO and EGA. There are exactly four, in order, each with a fixed classification:
  - CLO 1 Introductory (Foundational Knowledge)
  - CLO 2 Enabling (Skill Development / Evaluate)
  - CLO 3 Demonstrating (Application / Create; verb levels apply, analyze, evaluate, create since 2026-11-17)
  - CLO 4 Integration of Values (Ethics & Responsibility / Evaluate & Create)
- **Course Content** is per week, based on the course title, and written before the ILO.
- **ILO** is based on the week's content and aligned to a CLO.
- **Suggested Learning Activities** are based on the content, accommodate diverse learners, and align to the ILO.
- **Suggested Assessment Tasks** are based on the content and the activities.
- **Expected Values**: the week's ILO names which of the six Augustinian-Marian values (Compassion, Courage, Community-orientedness, Humility, Interiority, Missionary Spirit) it integrates.
- **Week 1** is orientation, and **Week 2** starts the first topic.
- **References** follow APA 7th, and the checker checks the references, links, books and journals.
- Outcome-Based Education throughout.

### Answers to the rule questions (2026-11-12)

| # | Question | Decision |
|---|---|---|
| 1 | CLO links | Each CLO aligns to the course title, **at least one PO and at least one EGA**. An extra tag that does not fit goes to faculty review, no penalty. |
| 2 | Assessment Tasks | Scored against **Content + Activities**. The ILO link is shown as advice, no points. |
| 3 | Diverse learners | Each topic week offers **at least 2 alternative activity options** that fit the ILO. Confirmed strict on 2026-11-15 after the first official check: it applies to weeks made of required sequential steps too (for example capstone manuscript and defense weeks). |
| 4 | Values | **Every week, including Week 1 and exam weeks**, names at least one of the six values, and it must fit the ILO. |
| 5 | References | Mostly **within 5 years**. Older classics are allowed but flagged for faculty confirmation, not penalized. Existence is looked up on **Crossref (DOI) and Open Library (ISBN)**, plus live link checks. A source that cannot be confirmed shows as "not verified", never "fake". Only the reference text is sent. |
| 6 | Scoring | Keep −1 partial and −3 not aligned, with a **maximum deduction per area**. The cap values are **not chosen yet**. |
| 7 | Constructive alignment (2026-11-17) | Following the CHED Handbook on Typology, Outcomes-Based Education, and Institutional Sustainability Assessment: an outcome's verb must match its **teaching-learning activities and its assessment tasks** (both). If an outcome says "apply", students solve problems, perform tasks or use concepts in real scenarios, and are assessed doing so; a memorization quiz alone does not assess it. Checked **each week** (activities and tasks reach the level of the week's ILO verb: a `level` item in ACTIVITY-FIT and TASK-FIT; TASK-FIT now also reads the ILOs) and **each CLO** (CLO-EVIDENCE: the CLO's own verb level is reached by the activities and the tasks of at least one week mapped to it). A mismatch is **partly aligned, −1**, inside the area caps. The repair plan fixes the weeks; it never lowers a CLO's verb for CLO-EVIDENCE, which goes to the faculty. This refines answer 2: the tasks are now also scored against the ILO's level; whether they fully measure the ILO stays advice (TASK-ILO). |
| 8 | ILO level against the CLO (2026-11-17) | An ILO is judged against its **CLO's own main verb as written**, not the highest level the CLO's classification allows. Under a CLO 1 (Introductory) that says "Define and explain ...", an "apply" ILO (for example "Write and run a simple program") is above the CLO: ILO-CLO `level` = no, partly aligned (−1). Under a CLO 1 that says "Apply ...", the same ILO fits. Introductory still allows remember, understand and apply for the CLO itself (CLO-LEVEL). |
| 9 | Weeks with several ILOs (2026-11-17) | A week may have two or three ILOs tagged to different CLOs (for example ILO 1 → CLO 1, ILO 2 → CLO 2 and 3, ILO 3 → CLO 4). The week still has one activities field and one tasks field. **Every ILO** of the week needs at least one activity and at least one task at **its own verb's level** (one task may cover several ILOs). The **two alternatives** for diverse learners are for the **week as a whole**, not two per ILO. Each ILO keeps its own CLO question (an extra tag that does not fit goes to review), and the week counts as evidence for every CLO one of its ILOs is tagged to. A repair draft is one activities list and one tasks list written with all the week's ILOs in view. |
| 10 | One observable verb per outcome (2026-11-17) | Following the CHED Implementation Handbook for OBE and ISA (writing learning outcomes, rule 7): "Choose only one observable verb/behavior in a statement of outcome; choose the behavior that is of a higher dimension of complexity." A no-AI rule, OUTCOME-ONE-VERB, finds a CLO or ILO that opens with two or more joined verbs ("Define and explain …", "Design, implement, and test …", "Analyze/evaluate …"); a verb later in the sentence does not count. The finding names the higher verb to keep when both have a Bloom level. Like the new checker's other no-AI rules it costs no points; the repair plan drafts a one-verb rewrite, and a rewrite that still opens with two verbs is refused. |

## 2. Dependency chain

Judging and repairing both follow this order, top-down. A field is never rewritten to suit a field below it.

| Layer | Field | Aligns to | Rewritable |
|---|---|---|---|
| 0 | EGA, PO | (school masters) | no |
| 1 | CLO 1–4 | course title, PO, EGA, fixed classification (never the course description) | yes |
| 2 | Content (per week) | course title | yes (never to fit an ILO) |
| 3 | ILO (per week) | that week's content, one CLO | yes |
| 4 | Activities | content, ILO; at least 2 options | yes |
| 5 | Tasks | content, activities (ILO as advice) | yes |
| 6 | Values | the week's ILO | yes |
| 7 | References | course title | no (format repairs only from the reference's own characters) |

Source of truth: `server/lib/syllabuscheck/pipeline/rules.js` (`CHAIN`).

## 3. Pipeline

1. **Extract** (`pipeline/extract.js`): turn the syllabus into one map (course, masters, CLOs, weeks, references). Every field carries a fingerprint of its normalized text.
2. **Fixed rules, no AI** (`pipeline/fixedRules.js`): CLO count and fixed level, at least one PO and one EGA per CLO, unknown tags, each CLO reached by an ILO, Week 1 orientation, Week 2 first topic, content first, ILO tagged to a CLO, at least 2 activity options, tasks present, a named value every week, APA 7th format, and recency over 5 years (review only).
3. **AI judgment as checklists** (Phase 2): the AI answers yes/no/unclear per checklist item with a quote, and code sets the verdict (`rules.verdictOf`):
   - every item yes: ALIGNED;
   - a critical item no: NOT_ALIGNED;
   - any other no: PARTIALLY_ALIGNED;
   - missing or unclear: INSUFFICIENT_EVIDENCE.

   Questions are grouped one request per week (content, ILOs, activities, tasks and values together), plus one for the CLOs and one for the whole syllabus (coverage and sequence).
4. **Root causes** (Phase 2): when a parent fails, its children are not marked wrong for that reason. They are judged again once the parent is fixed.
5. **One repair plan** (Phase 2): top-down. Each rewrite receives the failed items of its parent and its children together.
6. **Verify before showing** (Phase 2): apply the plan to a copy and re-check the changed fields and their dependents with the same checklist, for at most 2–3 rounds. A fix that does not settle goes to "needs faculty review".
7. **Make a re-check match** (Phase 2): the verification answers are stored by fingerprint. A re-check of the accepted text reuses them, so a new misalignment cannot appear unless the text changed.
8. **References lookup** (Phase 2): Crossref, Open Library and link checks. "Not verified" when a source cannot be reached.

## 4. Rollout

| Phase | Work | Paid AI | Status |
|---|---|---|---|
| 1 | Rules as data, extraction, fixed rules, tests | no | **done 2026-11-12** |
| 2 | Checklist prompts and response formats, per-week judging with scripted answers, root causes, repair plan, verification, fingerprint reuse, reference lookups; convergence test (re-check of the plan's output = 0 misalignments) | no | **done 2026-11-12** |
| 3 | A provider adapter (Claude) with a cost cap, shadow mode next to the current checker, a guarded paid-run script on a synthetic syllabus | the run itself **needs approval and a budget** | **built 2026-11-12; paid run not done** |
| 4 | Faculty answer key of 20–30 relationships to measure accuracy; choose the area caps | faculty time | — |

## 5. Phase 1 result on the real IT 202 syllabus (offline)

Run on `docs/ai-checker-sample-comparison-2026-11-05/attempt-2/original.json`, which gave 21 findings and 2 review items:

- CLO 2–4 are saved as "Introductory" (the PDF importer's default); each has a mechanical fix to its fixed level.
- No ILO is tagged to CLO 4, and four ILOs have no CLO tag (one of them is the values ILO in Weeks 16–17).
- Weeks 4–5, 6, 12 and 18 name values that are not among the six (for example "Critical Thinking" or "Honesty").
- 9 references are not in APA 7th format, and 2 from 2019 are flagged for review.

The plan also lists Weeks 3–4 and 4–5 as overlapping rows. The current form checks already report this, so the pipeline does not repeat it.

## 6. Phase 2: how it works

**Questions** (`judge.js` `questionsOf`). The checker asks these questions, each tied to the field it judges and to that field's parents:

| Group | Relationships |
|---|---|
| CLOs | CLO-TITLE, CLO-LEVEL, CLO-PO (each tagged PO), CLO-EGA (each tagged EGA) |
| Each topic week | CONTENT-TITLE, ILO-CONTENT, ILO-CLO, ACTIVITY-FIT, TASK-FIT, TASK-ILO (advice), VALUE-ILO |
| Week 1 orientation | ILO-CONTENT, VALUE-ILO |
| Exam weeks | VALUE-ILO only |
| Whole syllabus | CONTENT-SEQUENCE (advice: order and repeats), REF-RELEVANCE |

**Requests.** Each group goes in one request: the CLOs, each week, and the whole syllabus (at most 25 questions per request). A text that several questions use, such as the weekly topic list, is sent once per request. The system prompt is the same for every request and holds the owner's rules. The course description is never sent.

**Answers** (`prompt.js`). The AI answers yes/no/unclear for each checklist item, with a quote and an explanation. An answer is refused when:
- an item is missing, invented or not yes/no/unclear;
- the explanation is missing;
- the question is answered twice;
- the quote is not found in the question's texts.

A refused answer is asked once more. Provider errors are not retried. Whatever is still unanswered is `not_checked`: never a pass, never a deduction, never stored.

**Statuses** (code, not AI):

| Status | Meaning |
|---|---|
| `ok` | aligned |
| `failing` | a root misalignment |
| `waiting` | its parent field is failing; judged again after the parent is fixed |
| `review` | an extra tag that does not fit beside one that does (CLO-PO, CLO-EGA and ILO-CLO count the best tag); no penalty |
| `advice` | an unscored relationship |
| `not_checked` | not answered |

**Reuse.** An answer is stored under a key made of:
- the rules version and prompt version;
- the model;
- the course;
- the relationship;
- the exact texts on both sides.

A re-check asks only the questions whose texts changed. Editing one ILO re-asks only its own week.

**Repair plan** (`plan.js`):
1. Apply the mechanical fixes first: the fixed CLO classification, and APA repairs built from the reference's own characters.
2. Each round, rewrite the root fields: fields with their own misalignment whose parents are all fine. Each rewrite is given:
   - its parents;
   - the failed checklist items with the AI's reasons;
   - the fixed-rule messages;
   - its children to keep fitting.
3. A rewrite is refused when it is empty, unchanged or too long, has fewer than 2 activity options, names none of the six values, or has no task.
4. Re-check the copy, reusing every answer whose text is unchanged.
5. Stop after 3 rounds. A field gets at most 2 rewrites.

The result covers:
- `changes`: each change marked VERIFIED, NEEDS_FACULTY_REVIEW or NOT_CHECKED;
- `unresolved`: with the reason;
- `manual`: what only the author can fix (tags, schedule, CLO count, APA problems without a mechanical repair, broken links);
- `regressions`: anything that was aligned and got worse;
- `clean`: no misalignment left.

`applyPlan` applies all changes or only the accepted ones. Nothing is saved, and the AI never approves anything.

**Reference lookups** (`lookup.js`). These run only when the caller passes `lookup`:
- a DOI is checked on Crossref, with the title compared;
- an ISBN is checked on Open Library;
- a book without an ISBN is searched on Open Library by title and first author's surname;
- links go through the existing SSRF-safe link checker.

Results and severity:

| Result | Severity |
|---|---|
| Broken link (`REF-LINK`) | finding |
| Not found, or DOI/ISBN belongs to another work (`REF-EXISTS`) | review |
| Lookup failure | not verified, no finding |

At most 30 references are looked up, four at a time. Only the reference text is sent.

**Measured offline:**

| Syllabus | Result |
|---|---|
| 18-week test syllabus | 142 questions in 20 requests |
| Real IT 202 syllabus | 153 questions in 13 requests (the recorded real run used 22 requests); largest request about 16,000 characters |
| Test syllabus with 13 misalignments across the chain | the plan made 5 AI rewrites and 1 mechanical fix in 1 round; the re-check after `applyPlan` asked **0** questions and showed **0** misalignments |

**Not done in Phase 2.** These are left for Phase 3:
- the adapter to a real provider (Claude) and its cost cap;
- shadow mode in the server, plus routes and UI;
- any real model run.

The area cap values are still open.

## 7. Phase 3: provider, shadow mode, paid-run script

### Provider (`pipeline/provider.js`)

The provider uses the existing direct Claude transport (`anthropicClient.js`), which already provides:
- verified models only;
- a key that is never logged;
- schemas checked before sending;
- bounded retries;
- a timed-out question never sent again.

It adds the following:
- **A required cost cap.** Without a positive cap, nothing is sent. Each request is reserved against the per-run budget (`gemini.js` `createRequestBudget`) before sending and settled at the tokens reported. The request that would pass the cap is refused before it is sent.
- **A usage record:** requests, tokens and an estimate at the published prices. This is not the invoice.
- **A reuse key that includes the model's thinking mode and effort**, so an answer made under one configuration is never reused under another.

The answer format is now a list of `{id, answer}` per item, because Anthropic's structured outputs need `additionalProperties: false` on every object. Both schemas pass `anthropicSchema.js` offline.

### Shadow mode (`pipeline/shadow.js`, hooked into `server/lib/compliance/service.js`)

| Setting | Values |
|---|---|
| `SYLLABUS_CHECK_REPLAN` | `off` (default), `shadow` (check), `plan` (check and repair plan, display only) |
| `SYLLABUS_CHECK_REPLAN_MAX_COST_USD` | **required** when on: the shadow's own cap, apart from the normal check's |
| `SYLLABUS_CHECK_REPLAN_MAX_REQUESTS` | default 60 |

How it behaves:
- It runs on the direct Anthropic provider only, after the official result is built.
- It is attached as `hybrid.replanShadow`, which holds the summary, misalignments by rule, usage and the official score and counts beside it.
- It never changes the official findings, deductions, score, suggestions, gate or status. A failure is caught and recorded.
- Answers are kept in memory per server process (bounded at 20,000), so nothing is written to the database. Reuse does not survive a server restart.
- It is documented in `server/.env.example`. `production.env.template` sets it to `off`.

### Paid-run script (`scripts/replan-paid-run.cjs`)

The script uses **one synthetic syllabus** (`pipeline/eval/synthetic.js`: SYN 101 Introduction to Python Programming, with invented outcomes and invented masters) that has 8 planted problems:

| # | Planted problem | Expected to be caught by |
|---|---|---|
| P1 | a CLO about baking bread | CLO-TITLE |
| P2 | CLO 4 saved as Introductory | CLO-LEVEL-LABEL |
| P3 | a Week 5 ILO about databases in a conditionals week | ILO-CONTENT |
| P4 | Week 8 offers one activity only | ACTIVITY-OPTIONS |
| P5 | Week 10 names "Honesty" | VALUES-WEEKLY |
| P6 | a Week 11 Roman-history essay in a strings week | TASK-FIT |
| P7 | a 2015 reference | REF-RECENCY (review) |
| P8 | a Week 14 ILO written as what the teacher does | ILO-CLO |

The fixed rules catch P2, P4, P5 and P7. The real model must catch P1, P3, P6 and P8.

The run has three steps: check the syllabus, build the repair plan, then re-check with the plan applied. It reports which planted problems were found and fixed, the convergence (questions the re-check asked and misalignments left), and the guard's ledger.

Safeguards:
- **Dry run by default.** A live run needs `--live --confirm-paid --max-cost <usd>` (at most $5).
- **Refusals before `server/.env` is read**, for a missing confirmation, a bad cap, or an output folder that already holds a result.
- **The evaluation guard** (`providerGuard.js`, Anthropic mode): worst case reserved before each request, one transient error stops the run, and a ledger file is kept.
- **The spend register** (`docs/ai-eval-anthropic/spend-register.json`, $10 total, $2.92 already charged): its lock stops two paid runs at the same time.
- **The pipeline's own cost cap**, as a second independent limit.
- **Network locked down:** global `fetch` is blocked, and no database or route module may be loaded.

The dry run (`node scripts/replan-paid-run.cjs`) shows 138 questions in 20 requests for the check, with no schema problems.

### Prompt caching layout and the cost cap (v1.88.0)

**What each judge request sends:**

| Part | Content | Cached |
|---|---|---|
| System block 1 | The rules, plus every relationship's checklist written once | yes, the same for every check |
| System block 2 | The SYLLABUS CONTEXT: course title, POs, EGAs, fixed CLO classifications, CLOs and the weekly topic list (never the course description) | yes, the same for every request of one check |
| Request | Compact JSON. A question refers to a text in the context by its label (`inContext`) instead of repeating it | no |

`anthropicClient.js` now accepts a list of system texts (at most 4), each with its own cache marker. A single text is sent exactly as before. The prompt version is `replan-prompt-3`.

**Estimated input cost of one check's judge requests.** This is offline: about 4 characters per token, Sonnet 5.5 prices, the first request writing the cache:

| Syllabus | Before | Checklists once + compact JSON | Plus the context block |
|---|---:|---:|---:|
| IT 202 (real) | $0.0622 | $0.0385 | $0.0377 |
| SYN 101 (synthetic) | $0.0503 | $0.0299 | $0.0309 |

**About 39% less input cost**, almost all from writing the checklists once and dropping the JSON indentation. The context block itself is about cost-neutral (between −2% and +4%). It is kept because every request then sees the whole syllabus (all CLOs and the full topic sequence) at no extra cost.

Input was about 12% of the last real run's cost and output about 86%, so the whole check is about 5% cheaper from this change. The real lever is output (short checklist answers instead of full drafts), and it is unmeasured until the paid run.

**Cost cap fixed.** The Phase 3 provider used the main checker's reservation budget, which adds every request's worst case and never releases it. A $2 cap therefore allowed only about 10 requests (each reserves about $0.18 for 16,000 output tokens) even when they cost a cent: a real run would have stopped halfway.

The provider now has its own cap (`provider.js` `spendCap`). A request is sent only while the amount already spent plus its own worst case fits the cap. Its reservation is released when the answer settles at the reported cost, and a timeout settles at its worst case.

### Prompt fixes (v1.89.0, `replan-prompt-4`)

| # | Gap | Fix |
|---|---|---|
| 1 | Orientation and examination weeks would fail the values question (no ILO or activities to practise a value through) | VALUE-ILO accepts the orientation or the examination itself (for example Interiority through honest self-assessment). Rule 7 says so, and an example shows it. |
| 2 | Bloom levels were asked about but never defined | The Bloom scale with typical verbs, and the Bloom levels of each CLO classification (`rules.js` `BLOOM_ORDER`, `CLO_LEVELS`) |
| 3 | "Do not guess" could turn many answers into "unclear" (not checked) | "no" = the text is there and lacks it; "unclear" only for a missing, cut-short or ambiguous text; a short text is not a reason for "unclear" |
| 4 | The rewrite had no format, and could copy its parent's wording (the old C-4 problem) | A FIELD FORMAT per field, the checklists, and "do not copy a parent's wording". A rewrite is refused when an outcome runs over several lines, an ILO is written for the teacher, or a CLO or ILO is a word-for-word copy of its parent. |
| 5 | No examples | Five invented worked examples (fit without repeating the CLO, a teacher-centred ILO, an off-week ILO, "no" versus "unclear", a value in an examination week), plus an answer-format example |

The cached rules block grew (judge prompt about 7,700 characters, rewrite prompt about 6,900). The estimated input cost of one IT 202 check went from $0.0377 to $0.0402, still well below the original $0.0622. Tests: `pipeline/prompt.test.js` (8).

**The Bloom mapping, confirmed by the owner on 2026-11-12** (`BLOOM_SOURCE`). It was derived from the classification labels:

| CLO | Bloom levels | CHED meaning (Implementation Handbook for OBE and ISA, 2014) |
|---|---|---|
| CLO 1 Introductory | remember, understand, apply (apply added by the owner on 2026-11-15) | the course introduces students to the outcome |
| CLO 2 Enabling | apply, analyze, evaluate | the course strengthens the outcome through practice with supervision |
| CLO 3 Demonstrating | apply, analyze, evaluate, create (analyze and evaluate added by the owner on 2026-11-17) | students demonstrate the outcome independently, without supervision, in a product, performance or solution |
| CLO 4 Integration of Values | evaluate, create; or the affective levels value, organize, internalize (added by the owner on 2026-11-17) | LCUP's own classification; not a CHED stage |

**Affective levels for CLO 4 (2026-11-17).** The CHED handbook tells faculty to "consider the three domains of learning" and lists affective verbs in Annex 4. A values outcome is often affective ("Advocate …", "Practice …", "Commit to …"), so CLO 4 takes the top three affective levels besides evaluate and create (`rules.js` `AFFECTIVE_ORDER`, `AFFECTIVE_SOURCE`):

| Affective level | Meaning | CHED's sample verbs |
|---|---|---|
| value | attaches value or worth to something | adopt, assume responsibility, behave according to, choose, commit, express, initiate, justify, propose, show concern |
| organize | conceptualizes the value and resolves conflict between it and other values | adapt, adjust, arrange, balance, classify, conceptualize, formulate, organize, prepare, rank, theorize |
| internalize | integrates the value into a value system that controls behavior | act upon, advocate, defend, exemplify, influence, perform, practice, serve, support |

Receive and respond are listed for the AI as the lower levels, but no CLO takes them. Under an affective CLO 4, an affective ILO at or below its level fits, and so does a cognitive ILO (the thinking a value rests on). Constructive alignment for an affective outcome: it is practised in role-plays, case discussions, service or group work where students act on the value, and assessed by observed behavior or performance with a rubric, a reflection on one's own conduct, or a defended position; a written quiz about the value alone does not assess it (worked example I).

CHED defines the curriculum-map stages as "I (introductory course to an outcome), E (enabling course or a course that strengthens the outcome), or D (demonstrative course or a course that demonstrates an outcome)", with a second legend "Introduce, Practice skills with supervision, Demonstrate skills without supervision". It ties no Bloom range to a stage; the ranges above are LCUP's. The rules text sends each CHED meaning with its CLO.

ILO-CLO asks that an ILO sit at or below the level of its CLO's own main verb (2026-11-17).

In the first paid run, the original CLO 1 mapping (remember, understand) made the model rewrite "Write and run a simple Python program" as "Describe the steps for installing Python...". The owner therefore added **apply** to CLO 1 on 2026-11-15 (`replan-prompt-5`). An introductory week may now ask students to write and run code.

### Viewing shadow results (v1.90.0)

Shadow mode was switched on in the development `server/.env` on 2026-11-15 (`SYLLABUS_CHECK_REPLAN=shadow`, `SYLLABUS_CHECK_REPLAN_MAX_COST_USD=2`). It takes effect after a server restart.

`scripts/replan-shadow-report.cjs` shows the stored shadow results next to the official numbers of the same checks. It runs only SELECT statements inside a read-only transaction, sends nothing to any AI provider, and prints no setting from `server/.env`:

```
node scripts/replan-shadow-report.cjs                  latest 10 checks with a shadow result
node scripts/replan-shadow-report.cjs --syllabus 12    one syllabus
node scripts/replan-shadow-report.cjs --run 345        everything the new checker found in one check
```

Add `--json` for machine-readable output. A check whose shadow was skipped or failed shows the reason on its own line.

The formatting lives in `pipeline/shadowReport.js`, tested by `pipeline/shadowReport.test.js` (4 tests) on shadow results made by the real `shadow.js` with the scripted model.

### Stored answers (v1.91.0)

The second shadow check of CAPSPRO1 (check 445) repeated the 5 main findings of check 444, but 3 borderline findings flipped. The cause was that the stored answers lived only in server memory, which a server reload clears. The answers are now kept in the database:

- **Table `replan_answers`** (`server/db/replan-answers-ddl.js`, also in `schema.sql`). One row per checklist question:
  - keyed by a SHA-256 of the rules version, prompt version, model, course and the exact texts;
  - holding the verified answer (items, quote, explanation);
  - never an INSUFFICIENT_EVIDENCE answer;
  - not linked to a syllabus.
- **Migration:** `npm run migrate-replan-answers` (from `server/`), additive and idempotent, with `--dry-run`. Rollback: `DROP TABLE replan_answers;`, after which the checker simply asks again.
- **Applied to the development database on 2026-11-15**, after a full backup:
  - backup `LCUP-DB-Backups/2026-11-15-pre-replan-answers-migration`, sha256 `835fdcdf…`, 56 tables, 958 rows, unchanged during the backup;
  - afterwards 57 tables: `replan_answers` added, no existing table changed.
- **`pipeline/answerStore.js`:** a memory store in front of the database store. One read and one write per check. A missing table or a database error never breaks a check: the shadow then runs from memory and says why.
- **Shadow:** the shadow now gets the server's database from `service.js`. The report's `--run` view shows where the answers were kept, and how many were reused from or saved to the database.
- **Pruning:** `answerStore.js` `pruneUnused(db, days)` deletes answers not written for a number of days (default 180). It is never automatic. Because answers are not linked to a syllabus, deleting a syllabus does not delete them.
- **Tests:** `pipeline/answerStore.test.js` (7), including a simulated restart where the second check reuses all 142 answers and asks the AI nothing.

### Official mode (v1.92.0)

The owner chose on 2026-11-15 to make the new checker official, behind a switch, with **at most 5 points lost per area**.

| Setting | Effect |
|---|---|
| `SYLLABUS_CHECK_REPLAN=official` | The new checker makes the official AI findings, points and drafts |
| `shadow` / `plan` | Comparison only (old checker official) |
| `off` | Old checker only |

Official mode is used only when AI checking is on, the provider is the direct Anthropic one, and `SYLLABUS_CHECK_REPLAN_MAX_COST_USD` is set. Otherwise, and whenever Policy V2 is on, the old checker runs exactly as before.

How an official check runs (`pipeline/official.js`, hooked into `compliance/service.js`):

1. **The old engine runs with its AI step off.** It supplies the no-AI rules, the base score, reference links and the rest of the report, at no AI cost.
2. **The new checker checks the syllabus, then builds its verified repair plan.**
3. **The report is filled in the shape the app already shows:**
   - `alignment` holds the new checker's answers;
   - `deductions` are the old no-AI deductions plus the new checker's points, at most 5 per area;
   - `suggestions` are the old no-AI suggestions plus the plan's drafts, which authors accept, edit or reject with the existing buttons;
   - score, ready, status, band, conformance and summary are recomputed.
4. **Extra tags, advice and the new checker's no-AI rules are advisory:** shown, no points. A draft that fixes a rule is linked to it.
5. **A failure never makes a score.** The report stays the no-AI report, marked incomplete, with the reason.

The old checker's whole-syllabus plan and coordinated plan are skipped in official mode. Stored answers (`replan_answers`) make an unchanged re-check reuse its answers.

**Check & improve (fixed in v1.93.0):** before, the route refused every new-checker draft ("made by an older checker version"), because it compared the report's `replan-prompt-N` with the old checker's prompt version; past that check it would have used the old checker's refine step. A new-checker draft now goes to `pipeline/refine.js`: the field is checked with the new checker's rules, prompt and stored answers, the draft passes when its field has no misalignment left and no scored relationship got worse, and otherwise the new rewriter gets one try with the plan's own job. Its own small cap: `SYLLABUS_CHECK_REFINE_MAX_COST_USD` (default the smaller of $0.50 and the check's cap) and `SYLLABUS_CHECK_REFINE_MAX_REQUESTS` (1-60, default 12).

**Tests:** `pipeline/official.test.js` (7). They run the real old engine with AI off plus the new checker on a scripted model, and they include the app's own `src/lib/hybridView.js`: problems shown, drafts linked, every draft applyable.

To switch: set `SYLLABUS_CHECK_REPLAN=official` in `server/.env` and restart the backend. To switch back: set `shadow` or `off` and restart.

### What remains

1. The **paid run** (owner's approval of a budget; a suggested cap of $3). The Anthropic credit was too low on 2026-11-09, so check the balance first.
2. **Faculty review** of its output, and a faculty answer key of 20–30 relationships (Phase 4).
3. ~~The area caps~~: 5 points per area (owner, 2026-11-15).
4. ~~Persisting the shadow's answers across restarts~~: done in v1.91.0 (`replan_answers`).
5. **Showing the shadow in the UI**.
6. **Making it the main path** (owner decision after the evaluation).

## 8. Files

- `server/lib/syllabuscheck/pipeline/rules.js`: chain, checklists, verdict, deductions and caps.
- `server/lib/syllabuscheck/pipeline/extract.js`: syllabus to map.
- `server/lib/syllabuscheck/pipeline/fixedRules.js`: rules without AI.
- `server/lib/syllabuscheck/pipeline/prompt.js`: system prompts, request messages, answer and rewrite validation.
- `server/lib/syllabuscheck/pipeline/judge.js`: questions, grouped requests, reuse, statuses.
- `server/lib/syllabuscheck/pipeline/check.js`: one whole check (extract, fixed rules, optional lookups, judge).
- `server/lib/syllabuscheck/pipeline/plan.js`: repair plan, verification, `applyPlan`.
- `server/lib/syllabuscheck/pipeline/lookup.js`: Crossref, Open Library and link lookups.
- `server/lib/syllabuscheck/pipeline/index.js`: exports all of the above.
- `server/lib/syllabuscheck/pipeline/provider.js`: Claude provider with a required cost cap.
- `server/lib/syllabuscheck/pipeline/shadow.js`: shadow mode.
- `server/lib/syllabuscheck/pipeline/eval/synthetic.js`: the synthetic syllabus and the planted-problem report.
- `scripts/replan-paid-run.cjs`: the guarded paid run (dry run by default).
- `server/lib/compliance/service.js`: the shadow hook (11 lines).
- `server/lib/syllabuscheck/pipeline/testSyllabus.js`: test helpers (conforming syllabus, scripted judge and rewriter).
- Tests, all in `npm test` (56 in all):
  - `rules.test.js` (6)
  - `extract.test.js` (5)
  - `fixedRules.test.js` (8)
  - `judge.test.js` (11)
  - `plan.test.js` (10)
  - `lookup.test.js` (5)
  - `phase3.test.js` (11)
