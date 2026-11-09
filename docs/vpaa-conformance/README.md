# VPAA Rule Conformance Testing Framework

A reproducible **software-conformance** test framework for the LCUP Hybrid AI Checker. It checks that the application implements the VPAA academic checking requirements correctly. It is **not** an academic validation study and it does **not** measure Claude's accuracy.

## What is here

| File | What it is |
|---|---|
| [`REPORT.md`](REPORT.md) | The final report: coverage, results, confirmed defects, the one corrective change, regression results, limitations and institutional decisions. Start here. |
| [`test-matrix.md`](test-matrix.md) / `.json` | The 35 controlled scenarios (7 relationships × aligned, misaligned, partial, insufficient evidence, adversarial), each with input, context, expected result, evidence and recommendation rules, source of the expectation and pass/fail criteria. |
| [`coded-rules-coverage.md`](coded-rules-coverage.md) / `.json` | The 47 deterministic rules: requirement, inputs, valid/invalid/missing-field behavior, recommendation behavior, existing tests, gaps. |
| [`traceability-matrix.md`](traceability-matrix.md) / `.json` | VPAA requirement → implementation → test cases → results → remaining limitations, with Implemented / Tested / Passed / Failed / Not Tested / Requires Clarification kept separate. |
| [`POLICY-V2-ACTIVATION.md`](POLICY-V2-ACTIVATION.md) | The exact configuration for an authorized Policy V2 staging test, what the report says when V2 is off, the staging procedure, rollback, and what must be decided before institutional activation. Hand-written. |
| [`STAGING-TEST-PLAN.md`](STAGING-TEST-PLAN.md) | The offline staging rehearsal, what it cannot show, the exact conditions required before a separately authorized live smoke test, and the four-level verdict (software conformance, staging configuration, live provider, production). Hand-written. |
| [`STAGING-SETUP-CHECKLIST.md`](STAGING-SETUP-CHECKLIST.md) | The system owner's manual checklist for the staging environment: credentials, database, origins, proxy and cookies, provider spending limit, and the post-deploy checks. Contains no secret and no invented domain. Hand-written. |
| [`CREDENTIAL-READINESS.md`](CREDENTIAL-READINESS.md) | What must be rotated or created by hand before staging, how the read-only credential report works, and what the server now enforces for secrets. Contains no secret. Hand-written. |
| `results.json` | Every test result from the generating run. |

All of the above except this README and the four hand-written documents (`POLICY-V2-ACTIVATION.md`, `STAGING-TEST-PLAN.md`, `CREDENTIAL-READINESS.md`, `STAGING-SETUP-CHECKLIST.md`) are **generated** by `scripts/vpaa-conformance-report.cjs`; do not edit them by hand.

## Run it

```
npm run test:vpaa                         # the conformance suites + the UI rendering test
npm test                                  # the whole repository (the suites are part of it)
node scripts/vpaa-conformance-report.cjs  # run the suites and regenerate these documents
node scripts/vpaa-conformance-report.cjs --full   # also run `npm test` as the regression run
node scripts/vpaa-v2-preflight.cjs --env-file <file>   # read-only: is this environment ready for a Policy V2 staging test?
node scripts/credential-readiness.cjs --env-file <file>   # read-only: what must be rotated or created by hand (never prints a value)
```

No API key, database or network is needed, and no model is ever called: the Claude transport is a scripted test double, and any non-loopback network call fails the suite.

## Where the code is

`server/lib/syllabuscheck/vpaa-conformance/` (the suites and their support code), `tests/vpaa-conformance-ui.test.jsx` with `scripts/test-vpaa-ui.mjs` (report rendering), `scripts/vpaa-conformance-report.cjs` with its template (the documents).

## How to read a result

A **PASS** means the software did the right thing with a scripted answer: it built the relationship from the right fields, refused a bad answer, mapped the answer to the right disposition, kept its evidence, never auto-applied a recommendation, and failed safe. A **known issue** is a reproduced defect or gap that is reported and deliberately not corrected; it runs as `todo`, so it is visible in every run and never silently passing or failing the suite. A scenario marked **requires rubric clarification** has no official expected label (the sources do not say where "aligned" ends), so only invariants are asserted.

Optional live-model testing is **not** part of this framework and stays disabled unless explicitly authorized.
