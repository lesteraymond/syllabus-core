# Deterministic rule verification appendix

Each named rule has an executed positive, negative and boundary case (141 assertions). The boundary is relative to that rule, not an assertion that the whole synthetic syllabus is compliant. Malformed-root robustness, markup-only probes and semantic separation add six assertions; two markup probes fail. No rule definition was changed.

| Rule | Function/check | Severity | Positive | Negative | Boundary | Evidence |
|---|---|---|---|---|---|---|
| T-01 | nonEmpty | blocking | PASS | PASS | PASS | deterministic-cases.json / T-01 |
| T-02 | nonEmpty | blocking | PASS | PASS | PASS | deterministic-cases.json / T-02 |
| T-03 | nonEmpty | blocking | PASS | PASS | PASS | deterministic-cases.json / T-03 |
| T-04 | nonEmpty | blocking | PASS | PASS | PASS | deterministic-cases.json / T-04 |
| T-05 | nonEmpty | blocking | PASS | PASS | PASS | deterministic-cases.json / T-05 |
| T-06 | nonEmpty | blocking | PASS | PASS | PASS | deterministic-cases.json / T-06 |
| T-07 | nonEmpty | blocking | PASS | PASS | PASS | deterministic-cases.json / T-07 |
| T-08 | nonEmpty | blocking | PASS | PASS | PASS | deterministic-cases.json / T-08 |
| T-09 | equalsCatalog | blocking | PASS | PASS | PASS | deterministic-cases.json / T-09 |
| T-10 | equalsCatalog | blocking | PASS | PASS | PASS | deterministic-cases.json / T-10 |
| T-11 | equalsCatalog | blocking | PASS | PASS | PASS | deterministic-cases.json / T-11 |
| T-12 | equalsCatalog | blocking | PASS | PASS | PASS | deterministic-cases.json / T-12 |
| T-13 | tagsResolve | blocking | PASS | PASS | PASS | deterministic-cases.json / T-13 |
| T-14 | tagsResolve | blocking | PASS | PASS | PASS | deterministic-cases.json / T-14 |
| T-15 | columnsFilled | blocking | PASS | PASS | PASS | deterministic-cases.json / T-15 |
| T-16 | columnsFilled | major | PASS | PASS | PASS | deterministic-cases.json / T-16 |
| T-17 | iloNumbering | minor | PASS | PASS | PASS | deterministic-cases.json / T-17 |
| T-18 | weeksOrder | minor | PASS | PASS | PASS | deterministic-cases.json / T-18 |
| T-19 | numberedRequirements | blocking | PASS | PASS | PASS | deterministic-cases.json / T-19 |
| T-20 | numberedRequirements | minor | PASS | PASS | PASS | deterministic-cases.json / T-20 |
| T-21 | referenceGroups | blocking | PASS | PASS | PASS | deterministic-cases.json / T-21 |
| T-22 | referenceGroups | minor | PASS | PASS | PASS | deterministic-cases.json / T-22 |
| T-23 | nonEmpty | blocking | PASS | PASS | PASS | deterministic-cases.json / T-23 |
| T-24 | gradingTotal | blocking | PASS | PASS | PASS | deterministic-cases.json / T-24 |
| T-25 | gradingFormula | blocking | PASS | PASS | PASS | deterministic-cases.json / T-25 |
| T-26 | gradingFormula | major | PASS | PASS | PASS | deterministic-cases.json / T-26 |
| T-27 | signoffRoles | minor | PASS | PASS | PASS | deterministic-cases.json / T-27 |
| C-01 | textLength | major | PASS | PASS | PASS | deterministic-cases.json / C-01 |
| C-02 | textLength | minor | PASS | PASS | PASS | deterministic-cases.json / C-02 |
| C-03 | textLength | minor | PASS | PASS | PASS | deterministic-cases.json / C-03 |
| C-04 | referenceAge | minor | PASS | PASS | PASS | deterministic-cases.json / C-04 |
| P-01 | cloConventions | blocking | PASS | PASS | PASS | deterministic-cases.json / P-01 |
| P-02 | cloConventions | blocking | PASS | PASS | PASS | deterministic-cases.json / P-02 |
| P-03 | cloConventions | major | PASS | PASS | PASS | deterministic-cases.json / P-03 |
| P-04 | cloConventions | minor | PASS | PASS | PASS | deterministic-cases.json / P-04 |
| P-05 | cloCoverage | major | PASS | PASS | PASS | deterministic-cases.json / P-05 |
| A-01 | columnsFilled | major | PASS | PASS | PASS | deterministic-cases.json / A-01 |
| A-02 | cloCoverage | major | PASS | PASS | PASS | deterministic-cases.json / A-02 |
| A-03 | examRowsPerTerm | major | PASS | PASS | PASS | deterministic-cases.json / A-03 |
| A-04 | gradingHasExam | major | PASS | PASS | PASS | deterministic-cases.json / A-04 |
| H-01 | contactUnits | major | PASS | PASS | PASS | deterministic-cases.json / H-01 |
| H-02 | weeksCover | major | PASS | PASS | PASS | deterministic-cases.json / H-02 |
| H-03 | weeksCover | major | PASS | PASS | PASS | deterministic-cases.json / H-03 |
| H-04 | weeksCover | minor | PASS | PASS | PASS | deterministic-cases.json / H-04 |
| R-01 | referenceAge | major | PASS | PASS | PASS | deterministic-cases.json / R-01 |
| R-02 | referenceAge | minor | PASS | PASS | PASS | deterministic-cases.json / R-02 |
| R-03 | referenceAge | major | PASS | PASS | PASS | deterministic-cases.json / R-03 |

Failure detail: `** **` and `- ** **` pass trim-only presence checks for title and lesson content. See REPORT.md issue D1 and new-targeted-final.log.
