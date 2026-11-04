# BSIE MA 7 test versions

Both versions were saved and checked through the normal faculty API as draft
#101 for Jp Del Rosario. The subject lock allows one active MA 7 draft, so these
are two saved versions of one draft, not two simultaneous syllabus records.
The aligned version is left in the builder. Neither version was submitted.

- `aligned.builder.json`: calculus CLOs, ILOs, activities and assessments designed
  to support one another; mathematical verification and community impact are
  integrated in the lessons.
- `misaligned.builder.json`: the same official course identity, institutional
  text, grading and structural coverage, but unrelated cosmetics, costumes,
  flowers and cooking CLOs, dance activities and flower-name quizzes.
- `builder-check-results.json`: persisted normal Re-Check run IDs and results.
- `*.diagnostic.json`: full live semantic diagnostics against isolated,
  explicitly synthetic references. These cannot authorize a submission.
- `diagnostic-comparison.json`: live diagnostic completion, labels and deductions.
  A diagnostic score is unavailable when evidence validation fails.

Both normal checks have a 100% **coded baseline** and no final score: official
approved BSIE curriculum references and official program outcomes are missing.
The test POs in the forms are explicitly labeled provisional and are never
installed as official program outcomes.

Reproduce preparation using faculty credentials in `FILL_EMAIL` and
`FILL_PASSWORD` (this backs up and replaces the existing MA 7 draft):

```powershell
node scripts/create-bsie-test-versions.cjs
```

Reproduce the live diagnostic using the server's configured AI provider:

```powershell
node scripts/create-bsie-test-versions.cjs --diagnose
```

Live calls use the configured provider quota. Official records remain unchanged.
