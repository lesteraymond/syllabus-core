# r2 smoke comparison: `lcup-v2-recommendation-2` against the original smoke run

Nonofficial relationship evaluation. ACADEMIC ACCURACY: NOT YET MEASURED. Every judgement and recommendation below still needs independent faculty review; nothing here is applied to a syllabus, a score or a gate.

| | Original smoke | r2 smoke |
|---|---|---|
| Run (first request sent to last answer) | `live-smoke-REVIEWED`, 2026-10-29 00:13:37.7–00:13:57.8 UTC | `live-smoke-r2-REVIEWED`, 2026-10-29 09:02:59.0–09:03:21.1 UTC |
| Contract | baseline Policy V2 | baseline + `lcup-v2-recommendation-2` (evaluation only) |
| Bundle | `prepared-final` (`61ca8419…`) | `prepared-r2` (`d6e2f2f5…`) |
| Receipt | `authorization.smoke.REVIEWED.json` | `authorization.smoke-r2.REVIEWED.json` (receiptId `lcup-v2-smoke-r2-2026-10-29-01`) |
| Requests | 3, all HTTP 200, 3/3 verified | 3, all HTTP 200, 3/3 verified, no retry, no stop |

Both runs used the same three cases and the same request settings: model `claude-sonnet-5-5`, `max_tokens` 4096, adaptive thinking, effort `high`. The r2 requests are the original requests plus the contract, and nothing else. A field-by-field diff of each pair of request bodies shows exactly three differences:
- The system prompt gains 3,355 characters at its end (the contract section).
- The user message gains a `recommendation_context` block. It holds:
  - the pair's row, with its activities, tasks, values and ILOs;
  - the fields a correction may name, and whether each may be drafted;
  - the printed ILO number and labels, and ILOs stated in other weeks;
  - each mapped CLO, with its PO and EGA mappings and every ILO mapped to it;
  - the plan outline.
- The answer schema gains two required fields, `correctionField` and `correctionReason`.

There is one sample per run, so a difference between the two combines the effect of r2 with ordinary run-to-run variation.

Before execution, 18/18 preflight checks passed with the network blocked (`preflight.json`, 09:02:36 UTC, 23 seconds before the first request):
- the bundle: its recorded hash, its content hash, `verifyBundle`, and the r2 smoke scope (three cases, no pilot, nonofficial);
- all 8 prompt fingerprints;
- all 6 source-document hashes (three fixtures, three PDFs);
- the benchmark hash;
- the receipt: it authorizes exactly this run and names the r2 contract and the approved limits;
- the model is in the evaluation allowlist;
- the request bodies are identical to the prepared plan, each to `claude-sonnet-5-5` with `max_tokens` 4096, adaptive thinking and no streaming;
- the initial plan fits the limits;
- `ANTHROPIC_MAX_RETRIES=0`, a 90-second timeout, prompt cache on;
- the guard stops at the first transient, invalid or unproductive answer;
- the spend register has room for the worst case;
- the API key has the expected format (the value was not printed);
- the output directory is free.

After the run:
- None of the 12 files scanned (the run folder, the receipt and the register) contains the key or a 24-character fragment of it (`postcheck.json`). The files written after that scan were checked the same way (`changed-files.json`).
- The register rose by exactly the ledger's charge, $0.0896475 (`postcheck.json`).
- Between a snapshot taken before the receipt was written and one taken after the run, only the receipt, the 10 run files and the register changed (`changed-files.json`).

## Part A. Academic judgement (item 1)

| Case | Label: original → r2 | Bloom (source → target): original / r2 | Evidence quotes |
|---|---|---|---|
| IT 202 | PARTIALLY_ALIGNED → PARTIALLY_ALIGNED | Remember → Understand / **Understand** → Understand | verified in both |
| IE 402 | NOT_ALIGNED → NOT_ALIGNED | Remember → Apply / Remember → Apply | verified in both |
| CpE 304 | PARTIALLY_ALIGNED → PARTIALLY_ALIGNED | Understand → Create / Understand → Create | verified in both |

Aspects were all `not_assessed` in both runs, and neither run had an explanation-review flag.

- **IT 202.** Both runs find the same main gaps:
  - Week 1 (orientation) teaches no Java concepts, real-world IT challenges or professional ethics, which the ILO asks for.
  - "Demonstrate a clear understanding" is not an observable performance.

  The original also named the Bloom level as too high for an orientation and the ILO as too broad. r2 does not repeat those two points, and rates the source one Bloom level higher.
- **IE 402.** Both runs say the orientation teaches nothing about the Augustinian-Marian spirituality or value webbing that ILO10 asks for, and that the performance is above what the week can teach.
  - r2 adds: "The same ILO10 number also appears in weeks 12-14 for a different outcome." This is true; Weeks 12-14 have "ILO10: Evaluate essential management considerations…".
  - The original ended with "The ILO should be about the orientation content". That sentence matches the orientation draft the original then offered. r2 does not say it.
- **CpE 304.** Both runs say two things:
  - "both analog and digital circuits" is broader than the week, which has no digital topic;
  - "develop skills" is not observable.

  Both also question the level, from different angles:
  - the original says the history, notation and classification topics support analysis and design only at a lower level;
  - r2 says the content lists topic names without showing circuits analysed or designed, so the Analyze/Create level is not supported.

  Each run adds one point:
  - The original adds that the ILO names none of the week's topics, so it is too vague to guide teaching and assessment.
  - r2 adds: "The ILO text is also shared with Week 7-8, so changing it could affect that week."

All three labels are unchanged and the explanations agree in substance. Whether the labels are academically correct is not measured: there are no faculty labels yet.

## Part B. Recommendation safety (items 2–7)

The outcome terms used below:
- **Accepted** means the draft passed every safeguard and is shown to faculty as a draft. It is never applied automatically (`canAutoApply: false`).
- **Withheld** means a safeguard kept the draft back.
- **Referred** means the decision became faculty review.

### IT 202: Week 1 orientation against "ILO 1: Demonstrate a clear understanding of the course structure, expectations, and key programming concepts in Java, including how these skills align with real- world IT challenges and professional ethical standards. [CLO1]"

2. **Recommendation.**
   - Original (offered by the baseline): REWRITE_TEXT, "ILO 1: Describe the course structure, objectives, requirements, grading system and policies on absences, tardiness and examinations, and state what is expected of students in learning Java programming." This draft drops the printed [CLO1].
   - r2: REWRITE_TEXT, "ILO 1: Explain the course structure, objectives, requirements, grading system and policies, and state their own expectations of the course. [CLO1]"
3. **Field identified.** `ilo` (`plan[0].ilos[0].text`), the target. Reason given: "The content is a legitimate orientation, and the mismatch comes from the ILO adding Java concepts, real-world challenges and ethics that Week 1 does not teach. Revising the ILO to fit the orientation fixes this without touching the content or the week's activities and tasks. The ILO keeps its [CLO1] label."
4. **CLO mapping.** Preserved: the draft keeps the printed "ILO 1:" and [CLO1], and CLO 1's PO and EGA mappings are untouched. For faculty: the revised ILO is orientation-only. CLO 1 reads "Define and analyze the computing requirements needed for an effective solution…". The original ILO shares no topic terms with CLO 1. `weakens_mapped_clo` compares only those terms, so it could not fire here and cannot tell whether the rewrite still serves CLO 1.
5. **Cross-week dependencies.** No other week states this ILO, so no other week depends on it.
   - ILO number 1 is reused for different outcomes in Weeks 2, 3-4, 4-5, 9-11, 14 and 16-17, and the draft keeps the number.
   - The Java element removed from Week 1 is covered from Week 2 ("LO1. Explain the basic concepts and principles of Java programming, [CLO 1]").
6. **Outcome.** Accepted: it passed every safeguard and is offered as a draft for faculty review.
7. **Unsupported or unsafe.** None found. "state their own expectations" matches the week's activity "Setting and sharing of Expectations from the Course" and the task "Statement of Expectations". The rest restates the Week 1 content.

### IE 402: Week 1 orientation against "ILO10: Demonstrate the Augustinian, Marian and missionary Christ- centered Spirituality through value webbing. [CLO 4]"

2. **Recommendation.**
   - Original (offered by the baseline): REWRITE_TEXT, "ILO10: Explain the course objectives, requirements, grading system and policies on absences, tardiness and examinations of Systems Engineering, including how Marian Augustinian values are integrated into the course. [CLO 4]" This draft turns the only ILO that states CLO 4's spirituality competence into an orientation outcome.
   - r2: REWRITE_TEXT, "ILO10: Describe the Augustinian, Marian and missionary Christ-centered Spirituality and the course's Marian Augustinian values as presented in the course orientation, and state how these values will guide your work in Systems Engineering. [CLO 4]"
3. **Field identified.** `ilo` (`plan[0].ilos[0].text`), the target. Reason given: "The Week 1 content is a legitimate orientation and other relationships (activities, tasks) rely on it, while the ILO is the text that does not fit the week; the ILO is the target and a full draft is allowed. The CLO 4 tag stays, since the revised ILO still builds the introductory CLO 4 competence. Relocating the ILO to another week would need a faculty decision."
4. **CLO mapping.** Partly preserved.
   - Kept: "ILO10:", [CLO 4], and spirituality as the outcome's subject. The original draft had reduced it to how values are integrated into the course.
   - Weakened: CLO 4 is "Demonstrate the Filipino- Catholic Augustinian Spirituality through value webbing."
     - The draft drops value webbing, which `weakens_mapped_clo` flagged (evidence "CLO 4: web").
     - It also lowers the performance from Demonstrate to Describe. The check leaves out action verbs by design, so this second point is my reading of the text, not a check result.
5. **Cross-week dependencies.** Considered.
   - The explanation notes that ILO number 10 is reused in Weeks 12-14 for another outcome.
   - The reason names moving the ILO to another week as a faculty decision.
   - No other week states this ILO.
6. **Outcome.** Withheld and referred for faculty review. Two safeguards withheld the draft:
   - `weakens_mapped_clo` (r2);
   - `keeps_off_subject`, the existing check that flags a rewrite of a text judged not to belong to its week that keeps most of its off-subject wording.

   The decision became REVIEW_REQUIRED. The review report shows no draft: `recommendedCorrection` is null and `facultyReviewRequired` is true.

   The withheld draft stays in `results.json` for audit. There, the judgement's own `recommendation` field still reads REWRITE_TEXT. The outcome is `correction.decision`.
7. **Unsupported or unsafe.** Yes, in the withheld draft:
   - "as presented in the course orientation" is not supported. The Week 1 content does not present the spirituality, and r2's own explanation says the orientation "teaches nothing about Augustinian-Marian spirituality". Only the activity "Discussion on the Vision, Mission and Goals of LCUP and of CITE" is related.
   - It weakens the CLO 4 competence (item 4).

   Claude did not use the other route its context allowed: adding to the Week 1 content. That choice, adding to the content or moving the ILO, is now faculty's.

### CpE 304: Weeks 2-3 content against "ILO1: To develop skills in analysis and design of both analog and digital circuits [CLO1]" (the same ILO is stated in Weeks 7-8)

2. **Recommendation.**
   - Original (offered by the baseline): REWRITE_TEXT, "ILO1: Analyze the differential gain, common mode gain and CMRR of a differential amplifier configuration, and apply the electronic system design process to specify a simple analog circuit. [CLO1]" Rewriting the shared ILO would also change Weeks 7-8, whose content is analog-to-digital and digital-to-analog conversion.
   - r2: REWRITE_TEXT of the week's course content, not the ILO. It keeps all 16 existing lines (two headings and 14 topics, with the PDF's line breaks rejoined), extends "Design of Electronic Circuits" to "Design of Electronic Circuits (analog and digital)", and adds two items:
     - "Analysis and design of basic analog and digital circuits: worked examples";
     - "Analysis of differential amplifier circuits: computing differential gain, common mode gain and CMRR".
3. **Field identified.** `course_content` (`plan[1].contents`), a non-target field. Reason given: "The same ILO1 text is stated in Week 7-8, so the ilo field has no draft and rewriting it would affect that week. Adding to the week's content (analysis of differential amplifier circuits, digital circuit design) supports the ILO without removing anything other relationships rely on."
4. **CLO mapping.** Preserved: the ILO, its [CLO1] tag and Weeks 7-8 are untouched.
5. **Cross-week dependencies.** Considered.
   - Weeks 7-8 are cited in both the explanation and the reason, and the shared ILO was left alone.
   - Partly: the reason does not use the Weeks 7-8 content (sampling, quantization, encoding) to decide where the digital part of the ILO belongs.
6. **Outcome.** Accepted: it passed every safeguard (nothing removed), offered as a content draft for faculty review.
7. **Unsupported or unsafe.** Nothing removed or contradicted. Three points need faculty judgement:
   - The digital-circuit additions are new scope for Weeks 2-3. The current content has no digital topic. In the plan outline Claude received, only Weeks 7-8 name one (analog-to-digital and digital-to-analog conversion).
   - "worked examples" goes beyond the listed activity (lecture-discussion using PowerPoint) and task (a quiz).
   - The judgement's other gap remains: "develop skills" is not observable. Only faculty can revise the shared ILO, for both weeks.

### Recommendation summary

| Case | Original | r2 field | r2 outcome | Known smoke problem |
|---|---|---|---|---|
| IT 202 | ILO draft offered, [CLO1] dropped | `ilo` | accepted: draft keeps "ILO 1:" and [CLO1] | not repeated |
| IE 402 | ILO draft offered, spirituality competence lost | `ilo` | withheld, referred to faculty | not offered; Claude's own draft still weakens CLO 4 and is not supported by the content |
| CpE 304 | ILO draft offered, would change Weeks 7-8 | `course_content` | accepted: content additions, shared ILO untouched | not repeated; the additions' scope needs faculty judgement |

The original run offered all three drafts, and each had the known problem.

r2 offered two drafts, and neither repeats a known smoke problem: neither drops a printed label, removes content or changes another week, and neither tripped `weakens_mapped_clo`. That check cannot judge the IT 202 rewrite (see IT 202, item 4).

## Part C. Token usage and cost (item 8)

| Case | Run | Input (uncached) | Cache write (5 min) | Cache read | Output (thinking) | Cost, cache reads at $0.20 (= guard charge) | Cost, cache reads at $0.10 (repository estimate) | Latency |
|---|---|---|---|---|---|---|---|---|
| IT 202 | original | 796 | 15,553 | 0 | 548 (0) | $0.0459545 | $0.0459545 | 8.1 s |
| IT 202 | r2 | 3,120 | 16,815 | 0 | 594 (0) | $0.0542175 | $0.0542175 | 8.0 s |
| IE 402 | original | 872 | 0 | 15,553 | 668 (0) | $0.0115346 | $0.0099793 | 6.7 s |
| IE 402 | r2 | 3,191 | 0 | 16,815 | 768 (0) | $0.0174250 | $0.0157435 | 7.5 s |
| CpE 304 | original | 958 | 0 | 15,553 | 591 (0) | $0.0109366 | $0.0093813 | 5.3 s |
| CpE 304 | r2 | 2,756 | 0 | 16,815 | 913 (0) | $0.0180050 | $0.0163235 | 6.6 s |
| **Total** | original | 2,626 | 15,553 | 31,106 | 1,807 | $0.0684257 | $0.0653151 | |
| **Total** | r2 | 9,067 | 16,815 | 33,630 | 2,275 | $0.0896475 | $0.0862845 | |

**Prices.** The API returns token counts, not prices, so these costs are computed from the returned usage. Anthropic's billing records were not checked.
- Input is $2, output $10 and 5-minute cache writes $2.50 (1.25 × input) per million tokens. Every cache write in both runs was a 5-minute write (`ephemeral_1h_input_tokens` 0).
- Two sources give different cache-read prices:
  - **$0.20 per million:** the Claude API reference bundled with Claude Code 2.1.310 (`shared/models.md`). It gives Sonnet 5.5 "the same prices" as Sonnet 5, and the repository's own table also has $0.20 for Sonnet 5.
  - **$0.10 per million:** the repository's table for Sonnet 5.5 (`server/lib/syllabuscheck/anthropicClient.js:77`, pinned 2026-10-27, `pricesVerifiedCurrent: false`). A comment at `server/lib/syllabuscheck/eval/providerGuard.js:60` calls it the published 0.05 × input.
- The guard charges cache reads at no less than 0.1 × input, which is $0.20. So the spend register recorded the higher figure, and neither the caps nor the authorization limits were understated. The original run's estimate ($0.0653151) also used $0.10.
- The price table was not changed, because implementation changes were out of scope.

**Effect of r2:**
- The shared cached prefix grew by 1,262 tokens.
- Each request's uncached input grew by about 1.8–2.3k tokens.
- Output grew by 46–322 tokens.
- The total cost grew by $0.0212 (+31%) at $0.20 cache reads, or by $0.0210 (+32%) at $0.10.

**Against the authorization:** the run's worst case was $0.646 and its cap $1. The spend register went from $1.3525116 to $1.4421591 of $10.

## Limitations

- There are three cases and one sample per run, with no faculty labels. Agreement between the runs is not evidence of accuracy, and these cases do not show how r2 behaves on other syllabi or relationship types.
- The safeguards are lexical and structural. They caught IE 402. They cannot judge whether an accepted draft (IT 202, CpE 304) is the right academic change; that remains faculty's decision.
- The 21-case pilot was not run and is not authorized.

## Files

**Run:**
- `docs/lcup-v2-evaluation/authorization.smoke-r2.REVIEWED.json`;
- `docs/lcup-v2-evaluation/live-smoke-r2-REVIEWED/`:
  - `authorization.json`, `plan.json`, `raw/` (requests and responses), `results.json`, `ledger.json`;
  - from `report.cjs`: `review-report.json`, `review-report.md`, `benchmark-model-input.json`.

**This comparison:**
- `REPORT.md`;
- `comparison.json` (every value above, extracted from the two run folders);
- `preflight.json`;
- `postcheck.json`;
- `changed-files.json` (file snapshots before and after the run, and the key scan of the files written after it).

**Unchanged during the evaluation** (`changed-files.json`): prompts and implementation, production configuration, faculty content, official scores and submission gates. Nothing was committed, pushed or deployed.
