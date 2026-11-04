# Improvement proposal: Policy V2 recommendation review

**Status: proposal only. Nothing is implemented, activated or sent.**

- **Paid requests:** none since the three-case smoke test. The spend register stands at $1.3525 of $10.
- **Policy V2:** stays inactive and nonofficial.
- **Unchanged:**
  - the Stage 1 prompts, contract and frozen bundle;
  - the 47 deterministic rules;
  - the passing mark of 79 and the official gates;
  - the institutional references, the benchmark and the historical reports.
- **Nothing else:** no commit, push, merge or deploy.

Prepared on 2026-10-29. All numbers in this document come from offline runs, with the network blocked, over the frozen benchmark and the smoke files. Supporting files in this folder:

| File | Content |
|---|---|
| `stage2-recommendation-review.DRAFT.md` | The proposed prompt, input, output schema, contract checks and gates (not wired) |
| `smoke-stage2-inputs.example.json` | The exact input the draft would receive for each smoke case |
| `split-manifest.proposed.json` | Development and protected sets with case hashes and leakage checks (not frozen) |
| `baseline-lock.json` | Baseline versions and hashes, re-verified today |
| `measurements.json` | Sizes, gate checks, request plans and the cost model |

## In short

1. **Baseline: ready, with one problem.**
   - The 21-case pilot covers all seven relationships, with 3 cases each.
   - The problem: 5 of those cases belong to Cyber Security SIA1, the only course the design has not seen. Running them now would leave no protected test set.
   - I recommend one baseline run of 15 requests:
     - the other 16 pilot cases (9 requests, byte-identical to the frozen plan);
     - 21 real-syllabus development cases (6 requests).
   - It uses the existing runner's `--bundle` option and needs no runner change. This is Decision 1.
2. **The three problems** (section 2):
   - IT 202 is weak recommendation constraints.
   - IE 402 is insufficient context, plus a root cause that contradicts its own remedy.
   - CpE 304 is insufficient context that led to wrong root-cause reasoning.
   - In IE 402 and CpE 304, the existing contract also forced a rewrite. A failing Content-ILO pair had to get a new ILO text, even where the evidence pointed elsewhere.
3. **Proposal** (section 3):
   - Keep Stage 1 exactly as it is: it produces the judgment and its evidence.
   - Add a versioned Stage 2, a "recommendation review". It produces the root cause, the cross-week and CLO dependencies, and either a correction or a faculty-review decision.
   - Code builds the context Stage 2 receives, and four deterministic gates check its output.
   - Offline, the gates alone withhold the IT 202 and CpE 304 drafts. IE 402 depends on Stage 2's reasoning, so only a paid run can show whether it helps there.
4. **Evaluation** (section 5):
   - Three arms, all built on the same Stage 1 outputs:
     - the baseline;
     - the baseline plus gates;
     - Stage 2 plus gates.
   - Faculty labels are the only reference answers.
   - The data: a 40-case development set and a protected set.
   - The limit: the protected synthetic set can show whether Stage 2 behaves on an unseen course, but it cannot estimate recommendation quality. That needs new real syllabi (Decision 2).
5. **Cost** (section 6):
   - The four required runs: about $1.21 expected, $4.03 if usage runs high.
   - The register would end near $2.57 of $10.
   - Each run fits under the register even with its full worst-case cap.

## 1. Baseline evaluation readiness

### 1.1 What is locked

Everything below was re-checked today. `baseline-lock.json` has the full hashes.

| Item | Value | Check |
|---|---|---|
| Policy | `academic-evaluation-v2-preview-1`, `official: false` | unchanged |
| Runner | `lcup-v2-controlled-evaluation-1` | unchanged |
| Frozen bundle | `prepared-final/bundle.json`, preparedHash `61ca8419…` | `verifyBundle` passed |
| Benchmark | BM1 `cases.json`, benchmarkHash `ebd12920…` | verified by `verifyBundle` |
| Prompt sources | the 7 fingerprinted files | same as at preparation and at the smoke |
| System prompt | sha256 `ce55c382…`, 43,177 characters | same as the smoke sent |
| Prompt version | `alignment-12ab34c1c2c3d1d2req1-r8-rubric-academic-evaluation-v2-preview-1` | unchanged |
| Model | `claude-sonnet-5-5`, requested and returned 3 of 3 times | unchanged |
| Smoke responses | 13 run files and the receipt | all 14 hashes unchanged |
| Smoke request IDs | `req_011CgVZZzHvkxbXAQTXiXGt4`, `req_011CgVZaZyiyDQryHUHHk7g5`, `req_011CgVZb4f9NLkpQhyeDYigh` | recorded |
| Context references | `inputHash` and `referenceHash` of each smoke course | recorded per case |

The runner refuses to start if a prompt source, case, context or source document changes. It also refuses to write into an existing folder.

### 1.2 The seven relationships in the 21-case pilot

Cases marked * belong to the protected course, Cyber Security SIA1.

| Relationship | Coherent | Partial scope | Unrelated |
|---|---|---|---|
| Content-course | S01-003 | S08-003 * | S15-003 |
| Content-ILO | S07-004 * | S14-004 | S21-004 |
| ILO-CLO | S13-001 | S20-001 | S03-001 |
| Content-activity | S19-005 | S02-005 | S09-005 * |
| ILO-activity | S01-002 | S08-002 * | S15-002 |
| Content-assessment | S07-006 * | S14-006 | S21-006 |
| Activity-assessment | S13-007 | S20-007 | S03-007 |

Each relationship has its own judgment and its own validation. Without the five marked cases, all seven relationships are still covered, with 2 or 3 cases each.

### 1.3 Decision 1: keep the protected course out of the baseline

**The problem.** The three real syllabi and their synthetic families shaped this design:

- IT 202 with S01–S06;
- IE 402 with S13–S18;
- CpE 304 with S19–S24.

Cyber Security SIA1 (S07–S12) is the only course whose results have not been seen. If the frozen pilot runs as prepared, its five Cyber cases would show me Claude's output on that course. That course would then be "seen" as well, and no protected synthetic set would remain.

**Option A (recommended): a 15-request baseline run, R1.** It contains:

- the 16 non-Cyber pilot cases. These are 9 of the 12 frozen requests, and the bodies are byte-identical, checked offline today;
- the 21 real-syllabus development cases that have no output yet, in 6 requests. They use the same frozen prompt and settings.

The five Cyber cases run once, later, in the protected run. This option needs:

- no change to Codex's runner: `run.cjs` already takes `--bundle`;
- one small new script that filters the frozen bundle, without changing any prompt or case;
- a new receipt.

**Option B: run the frozen 21-case pilot as prepared.** That is 12 requests, with the command in `../pilot-readiness/REPORT.md`. No synthetic protected set would then remain, and every independent claim would wait for new real syllabi (Decision 2).

### 1.4 R1 under option A (not prepared yet; runs only after approval)

```bash
node scripts/lcup-v2-evaluation/prepare-dev-baseline.cjs   # new; writes docs/lcup-v2-evaluation/prepared-dev-baseline/bundle.json
ANTHROPIC_API_KEY="$(grep -m1 '^ANTHROPIC_API_KEY=' server/.env | cut -d= -f2- | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')" node scripts/lcup-v2-evaluation/run.cjs --bundle docs/lcup-v2-evaluation/prepared-dev-baseline/bundle.json --scope pilot --model claude-sonnet-5-5 --max-requests 15 --max-input-tokens 1800000 --max-input-tokens-per-request 120000 --max-output-tokens 61440 --max-output-tokens-per-request 4096 --max-cost 3 --out docs/lcup-v2-evaluation/live-dev-baseline-REVIEWED --live --confirm-paid --authorization-file docs/lcup-v2-evaluation/authorization.dev-baseline.REVIEWED.json
node scripts/lcup-v2-evaluation/report.cjs docs/lcup-v2-evaluation/live-dev-baseline-REVIEWED
```

| Item | Value |
|---|---|
| Requests | 15: 9 synthetic (2 relationships each, or 1) and 6 real (3–4 relationships each, all from the same course) |
| Expected cost | about $0.33, or $0.70 if usage runs high |
| Cost cap | $3.00. The worst-case reservation is $2.84, and the runner refuses a lower cap. |
| Controls | Same as the smoke: preflight with the network blocked, stop at the first invalid answer, no retries, post-check |
| Known risk | <ul><li>A 4-relationship request needs about 2,400 output tokens.</li><li>If Claude also thinks for more than about 1,700 tokens, the answer is cut off at 4,096 tokens and the run stops.</li><li>The smoke used no thinking tokens.</li><li>A stop costs at most that one request, and nothing is retried.</li></ul> |

## 2. The three observed problems

The full evidence is in `../pilot-readiness/recommendation-safety.md`.

- The faculty texts are not assumed to be wrong.
- All three labels are defensible within their relationship. The problems are in the recommendations.

| Case | What went wrong | Primary cause | Contributing causes |
|---|---|---|---|
| IT 202, Week 1 → ILO 1 [CLO1], `PARTIALLY_ALIGNED` | The draft drops the printed `[CLO1]` label | Weak recommendation constraints | Minor reasoning inconsistency |
| IE 402, Week 1 → ILO10 [CLO 4], `NOT_ALIGNED` | The draft turns the plan's only spirituality ILO into an orientation outcome | Insufficient context | Incorrect root-cause reasoning; forced rewrite (another demonstrable cause) |
| CpE 304, Weeks 2–3 → ILO1 [CLO1], `PARTIALLY_ALIGNED` | The draft narrows an ILO that Weeks 7–8 also state | Insufficient context | Incorrect root-cause reasoning; forced rewrite; partly weak constraints |

### IT 202: weak recommendation constraints

- **Context is not the cause.** The `[CLO1]` label was inside the target text Claude received:
  > "ILO 1: Demonstrate a clear understanding … professional ethical standards. [CLO1]"
- **What failed is the constraint.** The draft starts "ILO 1: Describe the course structure…" and ends without the label. Nothing enforced keeping it:
  - the Policy V2 prompt says "Preserve source wording and mappings" (`academicV2Plan.js:18`);
  - no rule names printed labels;
  - no check verifies that the label is kept.
- **Minor reasoning inconsistency.** The explanation says "the Bloom level is too high for an orientation". Its own fields give Remember → Understand, one level apart.

### IE 402: insufficient context, plus a root cause that contradicts the remedy

**Context Claude did not receive:**

- the week's values, "Interiority, Respect, Obedience";
- the activity "Discussion on the Vision, Mission and Goals of LCUP and of CITE";
- how CLO 4 is covered across the plan. None of the 10 other ILOs tagged CLO 4 (Weeks 10–18) mentions spirituality or values. They cover project planning, modelling, risk, experiments and robust design, and one Week 18 entry holds only the labels. ILO10 is therefore the only statement of CLO 4's competence: "Demonstrate the Filipino- Catholic Augustinian Spirituality through value webbing."

**Incorrect root-cause reasoning.** Claude's explanation places the problem outside the ILO: "It belongs to a later value-integration lesson or to the course CLO, not to the orientation." Yet the recommendation rewrites the ILO.

### CpE 304: insufficient context that led to wrong root-cause reasoning

**Context Claude did not receive:**

- the same ILO1 statement is used again in Weeks 7–8, whose content is analog-to-digital and digital-to-analog conversion;
- Weeks 2–3 also have ILO2, "Understand the design process of electronic circuits and systems."

**Incorrect root-cause reasoning.** Without that context, Claude treated an objective that spans two units as a defect: "'both analog and digital circuits' is broader than the source content … and teaches no digital circuit content."

**Partly weak constraints.** The course description Claude did receive mentions signal converters and digital processing, yet the draft dropped the digital scope. It also added the design process, which ILO2 already covers.

### The shared cause: the contract forces a rewrite (another demonstrable cause)

**What the existing response contract and objective require** for a failing relationship whose target field can be rewritten:

- **The objective** (`gemini.js:116`): "For every partial/not aligned judgement provide a complete draft that rewrites ONLY the permitted targetPath and fixes EVERY gap you listed, so that the same pair is ALIGNED when it is checked again."
- **The contract** (`gemini.js:354`): `REVIEW_REQUIRED` is refused for such a relationship: "it needs REWRITE_TEXT with a draft".
- **Re-tagging:** `RETAG_OUTCOME` is allowed only for ILO-CLO.

**The effect.** For Content-ILO, the only valid answer to a failing pair was a new ILO text, whatever the root cause. "The fix belongs elsewhere" and "the text is fine as authored; faculty should confirm" could not be expressed. This explains why IE 402 and CpE 304 rewrote the ILO although their own evidence pointed elsewhere.

**Why it is not changed in place.** This contract is shared with Hybrid-2 in production. The proposal therefore leaves it untouched and adds the missing outcomes in a separate stage.

## 3. Proposed improvement: Stage 2 recommendation review

### 3.1 Design

**Stage 1** stays exactly as frozen:

- the same prompt, contract, bundle, settings and verifier;
- it produces the judgment and its supporting evidence.

**Stage 2** is new and versioned (`lcup-v2-recommendation-review-r1`):

- **When:** it runs only for relationships that Stage 1 judged `PARTIALLY_ALIGNED` or `NOT_ALIGNED`.
- **Shape:** one relationship per request.
- **Input:**
  - the pair, exactly as Stage 1 saw it;
  - Stage 1's output;
  - a dependency context that code builds from the frozen syllabus.
- **Output:** a root cause, the effect of each dependency, and one decision: a correction, a re-tag suggestion, or a faculty-review request.
- **Checks:** deterministic gates check the decision afterwards. Everything stays advisory.

The full draft is in `stage2-recommendation-review.DRAFT.md`:

- the system prompt: 5,034 characters, about 1,800 tokens;
- the input format;
- the output schema;
- contract checks C1–C8 and gates G1–G4.

The prompt contains no case text: an offline scan found no 8-word run from any development or protected case.

### 3.2 The five parts stay separate

| Part | Produced by | Stored as | Can Stage 2 change it? |
|---|---|---|---|
| 1. Judgment | Stage 1 | `label` | No |
| 2. Supporting evidence | Stage 1 (existing verifier) | `sourceQuote`, `targetQuote`, `explanation` | No |
| 3. Root cause | Stage 2 | `rootCause`: locus, summary, 1–4 verbatim quotes | Its own output |
| 4. Cross-week and CLO dependencies | Code (facts) and Stage 2 (the effect of each fact) | `dependencies` | Its own output |
| 5. Correction or faculty-review decision | Stage 2, then the gates | `decision`, `gatesFired`, `finalRecommendation`, `draftOffered` | Its own output |

The root-cause loci are:

| Locus | Meaning |
|---|---|
| `rewritable_field` | The rewritable field itself falls short |
| `other_side_of_pair` | The other text of the pair falls short |
| `another_field_same_week` | The fix belongs in another field of the same week |
| `another_week` | The missing part is, or belongs, in another week |
| `mapping_or_label` | A tag, printed label or number is the issue |
| `none_text_sound` | The text looks sound as authored; faculty should confirm |
| `unclear` | The context does not allow a decision |

`none_text_sound` exists because the faculty texts are not presumed wrong.

### 3.3 The context Stage 2 receives that Stage 1 did not

Code builds each dependency from the frozen benchmark context, and only when it applies. None of them is an AI output.

| Kind | Content | Sent for |
|---|---|---|
| `printed_labels` | the `ILO n:` prefix and the printed `[CLO n]` labels in the rewritable field | Content-ILO, ILO-CLO |
| `same_text_other_weeks` | other weeks that state the same ILO, with their content | Content-ILO, ILO-CLO |
| `same_number_other_statement` | weeks where the same ILO number names a different statement | Content-ILO, ILO-CLO |
| `week_row` | the week's other fields and ILOs, with their CLO numbers | all seven relationships |
| `mapped_clos` | for each CLO the ILO is tagged to: <ul><li>the CLO's number, level and statement;</li><li>its PO numbers and EGA names;</li><li>the PO wording, only when the PO reference is usable (otherwise marked `held` and never inferred)</li></ul> | Content-ILO, ILO-CLO, ILO-activity |
| `clo_coverage` | every other ILO in the plan tagged to the same CLO | Content-ILO, ILO-CLO |

The request also carries the course card with numbered CLOs. In all three smoke courses the PO reference is held, so no PO wording would be sent.

What the three smoke cases would receive (exact objects in `smoke-stage2-inputs.example.json`):

| Case | Size of user message | Context that would have mattered |
|---|---|---|
| IT 202 | 6,277 characters | <ul><li>D1: the prefix "ILO 1:" and the label `[CLO1]`.</li><li>D2: "1" names other statements in six other weeks.</li></ul> |
| IE 402 | 7,560 characters | <ul><li>D3: the week's values and its Vision-Mission-Goals activity.</li><li>D4: CLO 4's spirituality statement.</li><li>D5: the 10 other CLO 4 ILOs, none about spirituality.</li></ul> |
| CpE 304 | 5,921 characters | <ul><li>D2: the same ILO1 in Weeks 7–8 (A/D and D/A conversion).</li><li>D4: ILO2 of the same week.</li></ul> |

Typical user-message sizes: real syllabi have a median of 4,967 characters (largest 10,950); synthetic cases have a median of about 3,000.

### 3.4 Decisions and gates

**The decisions Stage 2 can return:**

- **`REWRITE_TEXT`.** Allowed only when all of these hold:
  - the root cause is the rewritable field itself;
  - when that field is an ILO, no other week states the same ILO;
  - the draft keeps the printed labels and the prefix;
  - the draft keeps every mapped CLO's competence;
  - the context is enough to write the draft.
- **`RETAG_OUTCOME`.** For ILO-CLO only. It names the tag faculty should check and never patches it.
- **`REVIEW_REQUIRED`.** Used in every other case, with one reason:
  - `fix_belongs_elsewhere`;
  - `target_shared_across_weeks`;
  - `would_change_mapping_or_label`;
  - `would_weaken_mapped_clo`;
  - `insufficient_context`;
  - `faculty_intent_plausible`.

**Contract checks.** Checks C1–C8 reject a malformed answer, and the run then stops. They check:

- the relationship ID;
- that every quote is verbatim, using the existing whitespace-tolerant matcher;
- that every dependency ID that was sent is accounted for;
- that each decision has the fields it needs;
- the length limits.

**Gates.** A gate withholds a draft. It never invalidates the answer and never touches the label.

| Gate | Withholds a `REWRITE_TEXT` draft when… | Needs a model call? |
|---|---|---|
| G1 | the draft drops a printed `[CLO n]` label or changes the `ILO n:` prefix | No |
| G2 | the target ILO's statement is also used in another week | No |
| G3 | Stage 2's root cause is not the rewritable field | Yes (Stage 2) |
| G4 | the existing static draft review holds it (`draftReviewOf`, `gemini.js:304`) | No |

A withheld draft stays visible to faculty, but it is not offered as a fix.

### 3.5 Offline result on the three smoke drafts

The "baseline + gates" arm applies G1, G2 and G4 to Stage 1's own drafts at no cost. This is what it does to the three smoke drafts.

| Case | Gates on Stage 1's draft | What remains for Stage 2 |
|---|---|---|
| IT 202 | G1 fires (`[CLO1]` dropped), so the draft is withheld | Stage 2 can propose a draft that keeps the label, or ask for review |
| IE 402 | No gate fires, so the draft would still be offered | Only Stage 2 can withhold it, by reading D3–D5 as "the fix belongs elsewhere" or "would weaken CLO 4". Whether it does is unknown until a paid run. This is the main thing the evaluation must measure. |
| CpE 304 | G2 fires (ILO1 is also stated in Weeks 7–8), so the draft is withheld | Stage 2 adds the root cause and a faculty note |

### 3.6 Why not change the Stage 1 prompt instead

- **Comparability.** It would change the judgment's inputs, so judgment results could no longer be compared with the smoke and the baseline.
- **Independence.** Week and CLO context inside the judgment would invite one relationship's pass to carry over to another. The Policy V2 prompt forbids this: "A passing link never makes another link pass."
- **Production.** It would have to change the pair-local objective and the contract (`gemini.js:116`, `:354`), which production Hybrid-2 shares.
- **The frozen bundle.** Any change to the 7 fingerprinted files invalidates the frozen bundle ("Prompt source changed since preparation").

### 3.7 Safety

- **Advisory only.** No draft is ever applied.
- **No mapping changes.** Stage 2 has no code path to change a label, tag or mapping, and it never targets Vision, Mission, EGA or PO texts.
- **No production path.** It runs only in the evaluation namespace, under its own receipt, caps and the same spend register. It does not touch the database or the app.
- **Policy V2:** stays inactive and nonofficial.

## 4. Exact files that would change

**Modified: none.** Everything below is a new file, created only after the approval named in its row.

| New file | When | Purpose |
|---|---|---|
| `scripts/lcup-v2-evaluation/prepare-dev-baseline.cjs` | Decision 1 = A | Filters the frozen bundle to the R1 cases. Prompts and cases are unchanged. Writes with flag `wx`. |
| `docs/lcup-v2-evaluation/prepared-dev-baseline/bundle.json` | Decision 1 = A | Generated by the script above. Passes the existing `verifyBundle`. |
| `docs/lcup-v2-evaluation/improvement-proposal/authorization.dev-baseline.template.json` | Decision 1 = A | Receipt template with `approved: false` |
| `scripts/lcup-v2-evaluation/recommendation-review.cjs` | Decision 3 | Builds the dependencies. Holds the Stage 2 prompt (hash-pinned to the reviewed draft) and its schema. Implements contract checks C1–C8, gates G1–G4 and the request body. |
| `scripts/lcup-v2-evaluation/stage2.cjs` | Decision 3 | Stage 2 command line; see the notes after this table |
| `scripts/lcup-v2-evaluation/compare.cjs` | Decision 3 | Offline comparison; see the notes after this table |
| `scripts/lcup-v2-evaluation/{recommendation-review,stage2,compare}.test.cjs` | Decision 3 | Offline tests with mocked responses and the network blocked |
| `docs/lcup-v2-evaluation/faculty-review/part-c-root-cause.template.json` and a short guide | Before faculty review | A new versioned form for rating root causes and review decisions. The BM1 Part A and Part B forms stay unchanged. |
| `docs/lcup-v2-evaluation/labels/faculty-confirmed.json` | After adjudication | Built only from adjudication records |
| `docs/lcup-v2-evaluation/labels/developer-proposed.json` | Only if you supply developer labels | Kept apart from faculty labels |
| `docs/lcup-v2-evaluation/preregistration.stage2.json` | Before the protected run | Freezes hashes, metrics and thresholds |

**`stage2.cjs`:**

- **Input:** reads one or more Stage 1 run folders (the smoke folder and R1) and verifies their hashes.
- **Default:** dry run.
- **Live mode:** requires `--live`, `--confirm-paid` and a Stage 2 receipt bound to those Stage 1 runs and the prompt hash.
- **Controls:** its own caps, the existing provider guard and the same spend register.
- **Output:** a new folder each time; it never overwrites one.

**`compare.cjs`:**

- builds arms A, B and C;
- computes the deterministic metrics;
- imports the faculty Part A, B and C forms.

In protected mode it:

- requires `--confirm-protected`;
- prints aggregates only;
- logs each look, in the same way as `scripts/eval-alignment.cjs` handles held-out data.

**Unchanged:**

- **Evaluation scripts:** `pipeline.cjs`, `run.cjs`, `prepare.cjs`, `report.cjs` and `measure.cjs`.
- **Prompt files:** the 7 fingerprinted prompt files.
- **Production code:** all of it in `server/` and `src/`.
- **Rules and settings:** the 47 rules, the passing mark of 79, the gates, the institutional references and `server/.env`.
- **Data and earlier work:** the BM1 package, `prepared-final/`, `live-smoke-REVIEWED/` and `pilot-readiness/`.

## 5. Evaluation methodology

### 5.1 Data sets (`split-manifest.proposed.json`, status: proposed, not frozen)

**The leakage unit is the course.** A real syllabus and every synthetic sibling written for the same course always fall on the same side of the split.

| Set | Cases | Content | Use |
|---|---|---|---|
| Development | 40 | <ul><li>24 real: 3 smoke, 4 linked weeks the analysis inspected, 17 from the BM1 76-case selection.</li><li>16 synthetic: the pilot without Cyber.</li><li>Courses: IT 202, IE 402 and CpE 304.</li><li>All 7 relationships, 4–9 each.</li></ul> | Development, diagnostics and the development report |
| Protected, P-core | 16 (9 distinct pairs) | Cyber Security SIA1. Neither text appears in any other benchmark case. All 7 relationships. | Primary protected check, run once |
| Protected, P-shared | 20 | Cyber Security SIA1. At least one text also appears in another benchmark case. | Secondary, reported separately |
| Not usable | 8 | The 7 S12 cases (missing evidence) and BM1-CPE304-049 (held) | — |
| P-real | none yet | New approved syllabi not used in this design | Needed for any independent claim (Decision 2) |

**Leakage checks, all offline:**

- No course or context is shared between development and protected.
- Context similarity is low across the split and high within the protected course:

  | Comparison | Word-trigram overlap |
  |---|---|
  | Highest, development vs protected | 0.185 |
  | Lowest, within the protected course | 0.733 |

- No P-core text equals a development text. Every P-core text overlaps other cases by at most 29%, and every P-shared case has a full match. The split is therefore clear-cut.
- No development or protected case text appears in the Stage 2 prompt.

**Limits to read with any result:**

- **The protected set is small for recommendations.** P-core has 16 cases but 9 distinct pairs, because the incorrect-mapping family repeats the coherent family's pairs. Of the 9:
  - 7 are coherent-candidate and are likely to pass, so they get no Stage 2 request;
  - only about 2 P-core relationships are expected to reach Stage 2.

  The protected set can check that Stage 2 behaves on an unseen course. It cannot estimate recommendation quality.
- **The gates can only be measured on real syllabi.** Synthetic ILOs have no printed labels, so G1 never fires on them. Also, 9 of the 16 synthetic ILOs under test are repeated in 13 other weeks, a generator artifact, so G2 holds every rewrite of those 9. On real syllabi:
  - 10 development cases have a printed CLO label or ILO prefix (9 have a CLO label);
  - 3 have a genuinely shared ILO.
- **Development results are not independent.** The development set contains the cases that motivated the design.

### 5.2 Labels

**Claude's output is never a label, a reference answer or ground truth.**

| Channel | Who | Stored in | Used for | Never used for |
|---|---|---|---|---|
| Faculty-confirmed | At least two faculty reviewers (BM1 Part A) and an adjudicator | adjudication records → `labels/faculty-confirmed.json` | All agreement, false-approval and false-rejection figures | — |
| Developer-proposed | A named person, not Claude, on the development set only | `labels/developer-proposed.json`, `labelerRole: developer` | Early development diagnostics, marked provisional | Accuracy claims; the protected set; merging with faculty labels |
| Construction intent | The benchmark generator | `coordinator-only.json` | Describing the synthetic families; cost planning | A reference answer |

**Current state:**

- No case has a reference answer yet. All 83 have `expectedJudgment: null`, and the faculty response files are unassigned templates.
- 20 development cases and 7 protected cases are already in the BM1 76-case faculty selection.
- Protected labels, once collected, are kept sealed until the protected run.

### 5.3 Three arms on the same Stage 1 outputs

| Arm | Recommendation | Extra cost |
|---|---|---|
| A, baseline | Stage 1's draft as returned | none |
| B, baseline + gates | Stage 1's draft after G1, G2 and G4 | none |
| C, Stage 2 + gates | Stage 2's decision after G1–G4 | Stage 2 requests |

**The judgment is identical in all three arms by construction**, because all three use the same Stage 1 output. Any difference in recommendations comes only from the gates or from Stage 2.

**How faculty rate them:**

- Faculty see arm A and arm C outputs in random order, without arm names.
- Arm B needs no extra ratings. A withheld draft counts as correct when faculty rated arm A's draft unsafe.

### 5.4 Metrics

| Metric | How it is measured | Arms | Reference | Role |
|---|---|---|---|---|
| Judgment agreement | Stage 1 label vs faculty label | same for all arms | faculty-confirmed | guard rail |
| False approvals / false rejections | Stage 1 `ALIGNED` where faculty say partial or not aligned / the reverse | same for all arms | faculty-confirmed | guard rail |
| Label stability | Same label on a repeat run (R4) and on the repeated protected pairs | — | none | noise floor |
| Quote validity | <ul><li>Stage 1: the existing verifier;</li><li>Stage 2: contract check C3;</li><li>plus the existing faculty evidence review</li></ul> | A, C | deterministic, plus faculty | guard rail |
| Root-cause quality | <ul><li>Part C "root cause correct" (yes, partly, no, cannot judge);</li><li>a blind human coder maps each arm's stated cause and the faculty's `incorrectFieldOrRelationship` to the seven loci, and agreement is reported</li></ul> | A vs C | faculty | primary |
| Unsafe draft offered | An offered draft that fails G1, G2 or G4, or that faculty rate `preservesSoundMappings = no` or `recommendationAppropriate = no` | A vs B vs C | deterministic, plus faculty | primary |
| Unnecessary withhold | A withheld draft that faculty rated appropriate and mapping-preserving, or a review decision they rate inappropriate (Part C) | B vs C | faculty | primary, as the counterweight |
| Quality of offered drafts | The existing Part B ratings: appropriate, grounded, preserves mappings, specific | A vs C | faculty | secondary |
| Author wording kept | Share of the target's content words kept in the draft | A vs C | none | descriptive |
| Tokens and cost | The run ledgers | A and B (Stage 1 only); C (Stage 1 + Stage 2) | none | reported |

### 5.5 Procedure

1. **R1, baseline** (paid; approval 1).
2. **Offline:** arms A and B, and the deterministic metrics.
3. **Build the Stage 2 tools** (Decision 3), with offline tests only.
4. **R2, Stage 2 on the development set** (paid; approval 2). It covers the 3 smoke cases and the non-aligned relationships from R1.
5. **Faculty review of the development set:**
   - Part A for the 40 cases;
   - Parts B and C for arm A and arm C, blind;
   - adjudication.
6. **Development report.** It stays provisional until adjudication is complete. You review it. Optional runs at this point:
   - R3, a prompt revision;
   - R4 and R5, the noise floor.
7. **Freeze the candidate** in `preregistration.stage2.json`, before any protected run. It records:
   - the Stage 1 and Stage 2 prompt hashes;
   - the gate version;
   - the manifest hashes;
   - the metrics and thresholds.
8. **R6 and R7, the protected run** (paid; approval 3), run once:
   - the protected scorer prints aggregates only and logs every look;
   - no prompt may change after the protected results are seen. A revised prompt needs a new protected set.
9. **Final report.**

**Stop rules:** every run stops at the first invalid answer, error or timeout. There are no automatic retries and no correction requests.

**Reporting rules:**

- **Before adjudication:** label results "provisional; not faculty-validated".
- **Small numbers:** give counts with exact 95% intervals, and claim no significance. A difference smaller than the noise floor is not a finding.
- **"Independently verified accuracy":** never claim it until an unseen, faculty-labelled set exists (P-real).

**Proposed thresholds** (you confirm or change them in the pre-registration). Stage 2 moves on to further faculty review, still inactive and advisory, only if all of these hold.

On the faculty-reviewed development set:

- arm C offers fewer unsafe drafts than arm A, and no more than arm B;
- unnecessary withholds stay at or below 20% of non-aligned relationships;
- the root cause is rated "yes" or "partly" at least 70% of the time;
- no answer fails the contract;
- Stage 2 costs no more than $0.03 per relationship.

On the protected set:

- no answer fails the contract;
- arm C offers no unsafe draft where arm B would have withheld it.

## 6. Cost estimate

The estimate uses the repository's price table for `claude-sonnet-5-5` (as of 2026-10-27; not a current quote):

| Item | Rate per million tokens |
|---|---|
| Input | $2 |
| Output | $10 |
| 5-minute cache write | $2.50 |
| Cache read, as the guard charges it | $0.20 |

It is calibrated on the smoke's actual usage:

- about 3.01 characters per token for the user message;
- about 600 output tokens per relationship;
- no thinking tokens.

| Run | What | Requests | Expected | High | Cap needed |
|---|---|---|---|---|---|
| R1 | Baseline, frozen Stage 1, 37 development cases | 15 | $0.33 | $0.70 | $2.84 |
| R2 | Stage 2, development, iteration 1 | 26 expected, 40 at most | $0.32 | $1.47 | $3.48 |
| R3 (optional) | Stage 2, iteration 2 | 26 / 40 | $0.32 | $1.47 | $3.48 |
| R4 (optional) | Noise floor: repeat Stage 1 on all 40 development cases | 18 | $0.36 | $0.79 | $3.41 |
| R5 (optional) | Noise floor: repeat Stage 2 | 26 / 40 | $0.32 | $1.47 | $3.48 |
| R6 | Protected: Stage 1, 36 cases | 10 | $0.30 | $0.56 | $1.88 |
| R7 | Protected: Stage 2 | 23 / 36 | $0.27 | $1.30 | $3.01 |
| **Required (R1, R2, R6, R7)** | | | **$1.21** | **$4.03** | |
| **All runs** | | | **$2.22** | **$7.77** | |

How to read the columns:

- **Expected:** the smoke's usage. Stage 2 is assumed to run for 65% of relationships, with about 450 output tokens each.
- **High:**
  - Stage 1: 30% more output plus 2,000 thinking tokens per request;
  - Stage 2: every relationship sent, with 2,900 output tokens each.
- **Cap needed:** the sum of the guard's worst-case reservations. The runner refuses a lower cap. It is a ceiling, not a forecast. Stage 2's caps assume every relationship is sent; the real list, known after Stage 1, will be shorter.

**The register.** It holds back one request's worst case at a time, so the caps are never spent together.

| Scenario | Register after the required runs | Every run fits with its full cap? |
|---|---|---|
| Required runs, expected | about $2.57 of $10 | Yes |
| Required runs, high | about $5.38 | Yes |
| All runs, expected | about $3.57 | Yes |
| All runs, high | about $9.12 | No: R7's full $3.01 cap would not fit after about $7.82; it would need the shorter real list |

**Faculty time is the real constraint, not money:**

- Part A for 40 development cases and 36 protected cases (29 distinct);
- Parts B and C for about 26 development and about 20 protected relationships, in two arms each.

## 7. Decisions needed

1. **Decision 1, the baseline:**
   - **A (recommended):** a 15-request R1 that keeps the protected course out.
   - **B:** the frozen 21-case pilot as prepared, with no synthetic protected set.
2. **Decision 2, real held-out data (P-real):**
   - Option 1: supply new approved syllabi that played no part in this design, and authorize sending them to the API. This excludes IT 202, IE 402 and CpE 304. It also excludes the three VPAA-approved PDFs, which stay local-only under your standing rule.
   - Option 2: accept development-only claims for now.
3. **Decision 3, building the Stage 2 tools:** the new files in section 4, with offline tests and no paid calls. Alternatively, ask for design changes first.
4. **Decision 4, faculty review:**
   - who reviews the development set (Parts A, B and C) and who adjudicates;
   - whether you want to enter developer-proposed labels in the meantime.

Every paid run (R1, R2, R6, R7 and any optional run) still needs its own explicit approval and receipt.

## Unchanged in this step

Only this folder was added. A before-and-after hash of every repository file confirmed it.

- **Not modified:**
  - the 47 deterministic rules, the scoring weights and the passing mark of 79;
  - the official gates;
  - the Stage 1 prompts and contract, the frozen bundle and the runner;
  - the institutional references and the benchmark data;
  - the smoke run, the pilot-readiness files and other historical reports;
  - faculty data, the production database and `server/.env`.
- **Not done:**
  - no paid request;
  - no activation;
  - no automatic rewrite of any content;
  - no commit, push, merge or deploy.
