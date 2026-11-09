# Activation and execution matrix

All counts below come from a synthetic syllabus and a scripted model. Catalogue entries include aliases; use the per-namespace counts in runs.json. These are not paid calls, production activation, real academic accuracy, or a percentage of 47. Executed includes handler/predicate receipts, attempted means an evaluation was attempted, verified means the required response/evidence was available, and failed means a verified negative result.

| Configuration | Catalogued | Implemented | Enabled | Executed | Attempted | Verified | Failed | Needs review | N/A | Not checked | Partial | Test-double requests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| aiDisabled | 195 | 184 | 113 | 99 | 90 | 90 | 6 | 2 | 10 | 95 | 0 | 0 |
| legacy | 195 | 184 | 113 | 113 | 105 | 102 | 6 | 2 | 10 | 83 | 0 | 13 |
| policyV2 | 195 | 184 | 131 | 131 | 123 | 120 | 6 | 2 | 10 | 65 | 0 | 29 |
| comprehensive | 195 | 184 | 180 | 162 | 155 | 153 | 8 | 3 | 22 | 19 | 1 | 38 |
| providerUnavailable | 195 | 184 | 180 | 121 | 112 | 111 | 8 | 3 | 21 | 62 | 1 | 0 |

## Model relationship instances (separate denominator)

| Configuration | Planned/reported instances | Attempted | Verified | Not checked |
| --- | --- | --- | --- | --- |
| aiDisabled | 100 | 0 | 0 | 100 |
| legacy | 100 | 100 | 100 | 0 |
| policyV2 | 231 | 223 | 223 | 8 |
| comprehensive | 287 | 278 | 278 | 9 |
| providerUnavailable | 272 | 0 | 0 | 272 |

Five modes: AI disabled runs deterministic checks; legacy adds existing scored/advisory types; V2 adds the seven links and classifications; comprehensive selects distinct stages plus V2; unavailable provider retains deterministic/APA receipts and NOT_CHECKED academic instances. External DOI lookups remain off.
