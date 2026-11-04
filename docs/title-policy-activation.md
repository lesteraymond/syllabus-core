# Normalised course-title matching: controlled activation

Approved in Stage E.2 (Decision 1) for **controlled** activation. **It is not active**: the default policy is `shadow`. Activating it in production needs your explicit go-ahead.

## What the policy does

`SYLLABUS_CHECK_TITLE_POLICY=normalized` makes the official course-title check (CUR-FIELD `meta.title`) compare titles after:

1. Unicode NFKC normalisation (a no-break space, a full-width letter or a ligature compares as its plain form),
2. removal of zero-width characters,
3. letter-case folding,
4. collapsing whitespace and trimming the ends.

Nothing else changes:

- Punctuation, numbers, words and parentheses still count, and there is no fuzzy matching.
- A title without the parenthetical part of the approved title still fails. For example, "COMPUTER PROGRAMMING 1" fails against "COMPUTER PROGRAMMING 1 (FUNDAMENTALS OF PROGRAMMING)".
- The approved title is never changed. Course code, units, prerequisite, year level and curriculum year use their own comparisons, unchanged.

## Verified before activation (all offline)

| Check | Result |
|---|---|
| Complete regression | 1156 server tests, 22 + 52 UI tests and 12 other tests pass; localization audit and production build pass |
| Readiness and submission impact | `docs/title-normalization-impact.md`: on the three representative 18-week syllabi with a completed check, only capitalisation, spacing and Unicode-form differences change, from submit gate *blocked*, not ready, score withheld to gate *open*, ready, score 100. **No unexpected behaviour.** |
| Genuinely different titles | Still fail under both policies: a different title, another course number, and a missing parenthetical (`stage-e2.test.js`, `stage-e1.test.js`) |
| Check and gate agree | The submission gate (`compliance/service.js` `requireHybrid`) and the check now resolve the policy in one place (`titles.js titlePolicyOf`). Before Stage E.2 the gate always compared exactly, so an activation would have shown "ready" while blocking the submit. **Fixed.** |
| Points | The title check deducts no points, so the points total is unchanged. As a blocking finding it decides whether a score is published at all. |
| Advisory verdict | Follows the policy in force: in shadow mode a capitalisation-only title is a FAIL that asks for the approved spelling, exactly as the official panel does. Once the normalised policy is active it is a PASS with an informational note. (Earlier the advisory verdict said "pass" while the official panel said "required"; this was found in the Stage E.2 browser check and corrected.) |
| Stored reports | After a switch, a stored report whose own title would now be decided differently is shown as out of date (`titleDecisionChanged`), so no displayed result mixes the two policies. A re-check refreshes it. |

## Activation steps (only after your approval)

1. Choose a time when no submission deadline is running.
2. In `server/.env` set `SYLLABUS_CHECK_TITLE_POLICY=normalized` and restart the server. No migration and no data change is needed.
3. Re-check one syllabus whose title differs only in capitalisation. Its report should show `hybrid.titlePolicy.mode = "normalized"`, the title check PASS, and `hybrid.shadowCurriculum.mode = "active"` with `legacyStatus: "FAIL"` (what the old comparison would have said). The Verdict Panel should show only the informational spelling note.
4. Re-check one syllabus with a genuinely different title. It must still be blocked.
5. Watch the first week. In stored reports, count `shadowCurriculum.title.legacyStatus` against `officialStatus` (they differ only for formatting-only titles) and look for any title accepted that faculty consider a different course. There should be none, because only case, spacing and Unicode form are folded.

## Rollback

Set `SYLLABUS_CHECK_TITLE_POLICY=shadow` (or `exact`) and restart. Reports made under the normalised policy whose title would now fail are shown as out of date and must be re-checked. Nothing else needs to be undone.
