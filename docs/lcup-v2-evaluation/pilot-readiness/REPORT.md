# Pilot readiness report: Policy V2 21-case Claude pilot

**Status: ready for your decision.** The pilot has not run, and no paid request has been made since the smoke test. Policy V2 stays inactive and nonofficial.

Prepared on 2026-10-29. Details are in `readiness.json` and `recommendation-safety.md` in this folder.

## Tasks

| # | Task | Result |
|---|---|---|
| 1 | Preserve the smoke results | **Done.** See the list after this table. |
| 2–3 | Review the three recommendations | **Done.** IT 202 is a recommendation-quality problem. IE 402 is both a quality and a context problem. CpE 304 is mainly a context problem. The faculty texts are not assumed to be wrong. |
| 4 | Safety assessment | **Done.** A field-level correction needs five kinds of context: the whole week row, cross-week reuse, numbered mappings, the CLO's coverage across the plan, and numbering conventions. Until a request carries them, a draft is a prompt for faculty review, not replacement text. |
| 5 | Keep judgment and recommendation separate | **Confirmed.** They are separate fields in `report.cjs` and separate sections in `measure.cjs`. |
| 6 | Cover all seven relationships | **Confirmed.** Each relationship has 3 synthetic cases (coherent, partial-scope and unrelated) across 4 programs. Each relationship gets its own judgment and its own validation. |
| 7 | Request count, caps, receipt and budget | **Appropriate.** See "Budget and controls" below. |
| 8 | No automatic rewrite of content or mappings | **Confirmed in code.** One risk remains: a person who accepts a draft as written could drop a `[CLO n]` label typed into the ILO text. |
| 9 | Keep the current prompts as a baseline | **Confirmed.** See the list after this table. |

What task 1 preserved, all recorded in `readiness.json`:

- SHA-256 hashes of all 14 smoke files (the run folder and its receipt);
- the system prompt hash `ce55c382…` and the 7 prompt-source fingerprints;
- the 3 request IDs and the model, `claude-sonnet-5-5` (3 of 3 responses);
- the costs: $0.0653 at list prices and $0.0684 charged.

The runner refuses to write into an existing folder, and the pilot writes to a different one.

What task 9 confirmed:

- All 12 pilot requests use the system prompt the smoke sent (sha256 `ce55c382…`, 43,177 characters).
- The request bodies equal Codex's frozen `dry-pilot-final/plan.json`.
- The runner refuses to run if any of the 7 prompt source files changes.

## Budget and controls

| Item | Value | Why |
|---|---|---|
| Requests | 12 | These are the plan's 12 requests. No correction request can be sent, because the run stops at the first invalid answer. |
| `max_tokens` per request | 4,096 | Same as the smoke. The largest request (2 relationships) should need about 1,336 output tokens, or 3,336 with 2,000 thinking tokens. |
| Input cap | 1,440,000 total, 120,000 per request | The worst-case input bound is 615,408 tokens in total and about 51,600 for the largest request. |
| Output cap | 49,152 | 12 × 4,096. |
| Cost cap | $2.50 | See the notes after this table. |
| Spend register | now $1.35 of $10; $3.59 after a worst-case run | The register is the $10 Claude budget across all evaluations. |
| Receipt | a new `authorization.pilot.REVIEWED.json` | A test showed the runner refuses the smoke receipt for the pilot and accepts a pilot-shaped receipt. The unapproved template is `authorization.pilot.template.json`. |

Notes on the $2.50 cost cap:

- Before each request, the runner reserves that request's worst-case cost ($0.187 for the largest). The reservations total $2.233.
- The runner refuses a cap below that total.
- Based on the smoke's actual usage, I expect about $0.19, or up to $0.45 if the model uses thinking tokens.

Stop controls, tested with mock responses. The network was blocked and the real register did not change.

| Scenario | Requests sent | Result |
|---|---|---|
| All answers valid | 12 | 21 verified |
| One of two answers invalid in request 1 | 1 | Stopped; no correction request |
| Answer cut off at `max_tokens` in request 2 | 2 | Stopped |
| HTTP 529 (overloaded) in request 1 | 1 | Stopped; charged the $0.187 worst case |

## One difference from the smoke

The smoke sent one relationship per request. The frozen pilot plan groups relationships differently:

- **Requests 1–9:** two relationships of different types from the same synthetic week:
  - Content-course with ILO-activity;
  - Content-ILO with Content-assessment;
  - ILO-CLO with Activity-assessment.
- **Requests 10–12:** one Content-activity relationship each.

Each relationship still gets its own judgment and validation. An answer that quotes the other relationship's text is rejected (`quote_from_other_pair`).

Sending one relationship per request would need a runner change and 21 requests, with a worst case of about $3.90. I recommend keeping the frozen plan for this baseline.

## After your approval

1. I write `docs/lcup-v2-evaluation/authorization.pilot.REVIEWED.json` from the template, with `approved: true`, your name, a new receipt ID and a one-hour expiry. The limits stay as above unless you change them.
2. I run the preflight with the network blocked. It checks that:
   - the receipt, command, bundle and limits match;
   - the key is present (it is not printed);
   - the spend-register lock is free;
   - the case and source hashes match;
   - no database module loads.
3. I run the pilot once, in Git Bash from the repository root:

```bash
ANTHROPIC_API_KEY="$(grep -m1 '^ANTHROPIC_API_KEY=' server/.env | cut -d= -f2- | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')" node scripts/lcup-v2-evaluation/run.cjs --scope pilot --model claude-sonnet-5-5 --max-requests 12 --max-input-tokens 1440000 --max-input-tokens-per-request 120000 --max-output-tokens 49152 --max-output-tokens-per-request 4096 --max-cost 2.5 --out docs/lcup-v2-evaluation/live-pilot-REVIEWED --live --confirm-paid --authorization-file docs/lcup-v2-evaluation/authorization.pilot.REVIEWED.json
```

4. I build the review report offline:

```bash
node scripts/lcup-v2-evaluation/report.cjs docs/lcup-v2-evaluation/live-pilot-REVIEWED
```

5. I run the post-check:
   - scan the outputs for the key;
   - confirm the register's increase equals the run's ledger;
   - confirm that only the run folder, the receipt and the register changed.

   Then I stop and report.

## Unchanged

- **Not modified:**
  - the 47 deterministic rules and the scoring weights;
  - the passing mark of 79 and the submission gates;
  - the curriculum references and historical reports;
  - faculty data and the production database;
  - `server/.env` and the production settings.
- **Not done:** no commit, push or deploy.

Files added in this step:

- in `docs/lcup-v2-evaluation/pilot-readiness/`: `readiness.json`, `recommendation-safety.md`, `authorization.pilot.template.json` and this report;
- in `tmp/`: the mock and dry-run outputs.
