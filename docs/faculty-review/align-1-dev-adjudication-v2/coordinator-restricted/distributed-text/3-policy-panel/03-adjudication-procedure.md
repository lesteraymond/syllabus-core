# Proposed adjudication and validation procedure

**Status: a proposal for institutional approval (decision I2). Nothing in it is in force until approved.**

## 1. Principles

- **Faculty judgment is the reference.** The software's answers are never evidence that a case is right or wrong, and agreement with the software is never a reason to accept a judgment.
- **The provisional verdicts stay as they are.** The developer's provisional verdicts are not changed by any faculty decision, automatically or by hand. Approved references are recorded separately (section 9).
- **No judgment is created on anyone's behalf.** A blank stays blank, and a case without enough faculty input stays unresolved.
- **Special answers are recorded as given.** "Outside my expertise", "Insufficient information" and "Cannot judge" are never converted into a judgment (section 5).
- **Policies are decided on academic grounds.** They are decided before the software's results are shown to the panel, and never so that the software scores better.
- **Disagreement is information.** If reviewers cannot agree, the case is recorded as unresolved with both positions. It is not forced (section 6).
- **Reviews are blinded.** Case reviewers see no software answers, no developer verdicts and no one else's forms until they have returned their own.

## 2. Roles

The institution names the people.

| Role | Who | Does | Does not |
| --- | --- | --- | --- |
| Coordinator | A staff member who reviews no cases | Assigns reviewer codes and cases; sends each bundle and collects the forms; reassigns cases outside a reviewer's expertise; asks reviewers to clarify unclear answers; holds the coordinator's records; counts agreement | Judge cases; edit or complete returned forms |
| Case reviewer | Two per course, from the discipline: mathematics or engineering (MA 7, IE 310), information technology (IT 204), nursing (NCM 101), education (EDUC 105), accountancy (ACCTG 201), hospitality (HM 210) | Completes Part A, then Part B, for the assigned cases | See the software's answers before both parts are returned |
| Adjudicator | One per discipline, for example the program chair or a designee who did not review the case | Settles the cases sent to adjudication, with a written reason | Overrule a policy the panel adopted |
| Policy panel | Quality assurance, academic affairs and the program chairs; for P3 and P6 also the office responsible for the institution's Catholic Augustinian-Marian identity and core values | Decides P1–P7 and the institutional decisions | Judge individual cases in place of the reviewers |
| Data steward | The developer | Records approved decisions as references exactly as decided, and logs every step | Change, interpret or complete a decision |

## 3. Sequence

| Step | What happens | Output |
| --- | --- | --- |
| 0. Approve | The institution approves this procedure, names the people and records the decisions needed before sending (I1, I2, I5, I12, I15) | Approval records |
| 1. Prepare | The coordinator assigns reviewer codes and cases, and sends each reviewer the Part A bundle only: the Part A guide, the references, and the Part A form and response sheet for the reviewer's course | Assignment list |
| 2. Part A | Each reviewer judges the assigned cases alone. A case marked outside a reviewer's expertise is reassigned (section 5) | Returned Part A, dated. The coordinator keeps a signed copy or checksum, after which the form is not edited |
| 3. Part B | Once a reviewer's Part A is returned, the coordinator sends that reviewer the Part B bundle: the Part B guide and the Part B form and response sheet. The reviewer rates the proposed changes for the same cases | Returned Part B |
| 4. Policy | The panel decides P1–P7 and the institutional decisions. It may see a summary of the faculty judgments (how often reviewers agreed, which readings they applied) and the list of cases each question affects, but not the software's answers | A versioned, dated policy record |
| 5. Agreement | For each case the coordinator compares the two reviewers: verdict, recommendation type, the reading each applied, course fit, and whether course fit affected the verdict | Agreement record |
| 6. Adjudication | The cases listed in section 6 go to the adjudicator, who records a decision with a reason, or marks the case unresolved or excluded | Adjudication record |
| 7. Reference | The data steward records the decisions as a new, separate reference version (section 9) | Reference file and change log |
| 8. Report | The coordinator reports how many cases are agreed, adjudicated, unresolved or excluded; how many special answers were given; how the references differ from the provisional verdicts; and what the panel decided | Summary |

## 4. Case states

| State | Meaning |
| --- | --- |
| Pending | Not all forms are returned, or a decision the case depends on is not yet made |
| Reassigning | A reviewer marked the case outside their expertise; it awaits another qualified reviewer |
| Agreed | Both reviewers give the same verdict, and the reading each applied is consistent with the adopted policy |
| Adjudicated | The adjudicator decided, with a written reason |
| Unresolved | No decision could be reached; all positions are recorded (section 8) |
| Excluded | The case cannot be used, for example because its texts cannot be judged or no qualified reviewer is available; recorded with the reason |

## 5. Special answers

| Answer | What happens | Counted as a judgment? |
| --- | --- | --- |
| "No, it is outside my expertise" (Part A, question 0) | The coordinator reassigns the case to another qualified reviewer of the same discipline and logs the reassignment. If no qualified reviewer can be found, the case is excluded with that reason. | No |
| "Insufficient information to judge" (question 1) | The case goes to the adjudicator, who decides whether it can be judged, for example once information is supplied, or should be excluded (I8). | Recorded as given; the adjudicator decides |
| "Unsure" or "Insufficient information to judge" (question 4); "Insufficient information to recommend" (question 5); "Cannot tell" (question 6) | Recorded as given. Not a disagreement by itself. | Yes, as given |
| "Yes" at question 4b (course fit affected the alignment answer) | The adjudicator reads the verdict under the adopted P4 policy. The reviewer's answer stays on record. | Yes, read under P4 |
| "Cannot judge" (Part B) | Recorded with its reason. Left out of the rating counts and reported as a count by reason. | No |
| Two boxes ticked where one is asked, or a required answer left blank | The coordinator asks the reviewer to clarify and records the clarification with its date. The coordinator never guesses or completes an answer. | After clarification |

## 6. Handling disagreement

| Situation | Action | Recorded as |
| --- | --- | --- |
| Both reviewers give the same verdict, and their readings are consistent with the adopted policy | None | Agreed |
| The reviewers give different verdicts | The adjudicator decides with a written reason, or records the case as unresolved | Adjudicated or Unresolved |
| The same verdict, but one rests on a reading or a course-fit treatment the panel did not adopt | The adjudicator decides the verdict under the adopted policy; the original answers stay on record | Adjudicated |
| Either reviewer chose "Insufficient information to judge" | The adjudicator decides whether the case can be judged or is excluded | Adjudicated, Unresolved or Excluded |
| The recommendation types differ | Both are recorded side by side. A reference recommendation is decided only if the panel decides that recommendations become references (I10, I11) | Recorded; adjudicated only if required |
| The Part B ratings differ | Both ratings are recorded. They are not adjudicated, because ratings are used to write drafting rules, not reference answers (section 9) | Recorded as given |
| The adjudicator cannot decide | All positions are recorded (section 8) | Unresolved |
| A policy decision the case depends on is not made | The case waits | Pending |

A disagreement is never settled by the software's answer, by the coordinator or by the data steward. The coordinator keeps record templates for tracking, reassignment, agreement, adjudication and Part B ratings.

## 7. Agreement rules

- **Same option.** Two reviewers agree on a verdict only when they choose the same option; Aligned against Partially aligned is a disagreement.
- **A different reading.** Suppose a judgment was made under a reading the panel did not adopt. For example, P1 adopts one reading, and a reviewer chose Partially aligned only because of the other. The adjudicator, not the data steward, decides the verdict under the adopted reading. The reviewer's original answer stays on record.
- **Insufficient information.** If either reviewer chooses "Insufficient information to judge", the adjudicator decides whether the case can be judged or should be excluded (see also I8).
- **More than one accepted answer.** A case gets two accepted verdicts only if the adjudicator records why reasonable experts differ under the adopted policy (I9). Otherwise it gets one.
- **Recommendation type.** It is compared the same way. Two re-mappings agree only if they name the same target outcome, or if both leave the target open.
- **Statistics.** Percent agreement is reported per course and overall, with Cohen's kappa where the number of cases allows it. With one to twenty cases per course these figures describe this review only.

## 8. Recording an unresolved disagreement

For each unresolved case, record:

- the case code;
- every judgment, with its reason and the reading applied;
- the adjudicator's note on why the case could not be settled;
- what would settle it, for example a policy decision, an EGA description or another reviewer.

Unresolved cases are left out of headline agreement figures and reported separately. They are never settled by the software's answer.

## 9. Turning decisions into approved evaluation references

- **Never edit the dataset in place.** The provisional verdicts stay unchanged in `server/lib/syllabuscheck/eval/alignment-dataset.json`. Faculty decisions go into a new, separate record, for example `alignment-faculty-references-v1.json` or a new dataset version, as approved.
- **What each reference record holds:**
  - the dataset version and item, and the case code;
  - a hash of the two texts;
  - the final verdict, or verdicts with the reason for more than one;
  - the recommendation type, and for a re-mapping the target outcome;
  - the policy version applied;
  - the reviewer and adjudicator codes, and the dates;
  - the rationale and the state.
- Unresolved and excluded cases are listed with their state but carry no verdict.
- **Only agreed and adjudicated cases are marked faculty-reviewed.** Every other case keeps its previous status.
- **Part B ratings are not reference answers for future drafts.** The software will write different drafts next time. The ratings are used to write and test rules for drafts, each approved by the panel. Examples of such rules: keep the author's values; do not raise a recall outcome to a design outcome when a re-mapping would keep it.
- **The data steward records decisions mechanically and logs every step.** A clerical error, such as a wrong code, is fixed with a logged note. A change to a decision needs the adjudicator.
- **Copies get the same decision.** Sixteen of the cases are copies of cases in an earlier test dataset (eval-1.1). Each copy gets the same decision, recorded through a mapping table.
- **Later changes make a new version.** A change to an approved reference follows this procedure again and produces a new version; old versions are kept.
- **Each evaluation names its reference version.** Results measured against provisional verdicts and against faculty references are never combined in one figure.

## 10. The protected held-out cases (later)

The held-out cases are a separate set kept for one final test. Their verdicts are also developer-written. Before they are used:

- faculty review them in a separate package, without any software output;
- the decisions are recorded and sealed, for example by placing a checksum in the repository, so that they cannot be used to tune the software;
- the developer does not see the sealed decisions until the frozen configuration has been run on the held-out cases once;
- the result is reported in aggregate, as the dataset's rules require.

This package neither uses nor reveals the held-out cases.

## 11. Small numbers

The review covers 58 cases, with one to four in four of the seven courses. Its agreement figures describe these cases. They are not estimates for the institution's syllabi.
