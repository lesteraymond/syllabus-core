# Proposed adjudication and validation procedure

**Status: a proposal for institutional approval (decision I2). Nothing in it is in force until approved.**

## 1. Principles
1. **Faculty judgment is the reference.** The software's answers are never evidence that a case is right or wrong, and agreement with the software is never a reason to accept a judgment.
2. **The provisional verdicts stay as they are.** The developer's provisional verdicts are not changed by any faculty decision, automatically or by hand. Approved references are recorded separately (section 7).
3. **No judgment is created on anyone's behalf.** A blank stays blank, and a case without enough faculty input stays unresolved.
4. **Policies are decided on academic grounds.** They are decided before the software's results are shown to the panel, and never so that the software scores better.
5. **Disagreement is information.** If reviewers cannot agree, the case is recorded as unresolved with both positions. It is not forced.
6. **Reviews are blinded.** Case reviewers see no software answers, no developer verdicts and no one else's forms until they have returned their own.

## 2. Roles
The institution names the people.

| Role | Who | Does | Does not |
|---|---|---|---|
| Coordinator | A staff member who reviews no cases | Assigns reviewer codes and cases; sends and collects forms; holds the coordinator folder; counts agreement | Judge cases; edit returned forms |
| Case reviewer | Two per course, from the discipline: mathematics or engineering (MA 7, IE 310), information technology (IT 204), nursing (NCM 101), education (EDUC 105), accountancy (ACCTG 201), hospitality (HM 210) | Completes Part A, then Part B, for the assigned cases | See the software's answers before both parts are returned |
| Adjudicator | One per discipline, for example the program chair or a designee who did not review the case | Settles cases on which the reviewers disagree, with a written reason | Overrule a policy the panel adopted |
| Policy panel | Quality assurance, academic affairs and the program chairs; for P3 and P6 also the office responsible for the institution's Catholic Augustinian-Marian identity and core values | Decides P1–P7 and the institutional decisions | Judge individual cases in place of the reviewers |
| Data steward | The developer | Records approved decisions as references exactly as decided, and logs every step | Change, interpret or complete a decision |

## 3. Sequence

| Step | What happens | Output |
|---|---|---|
| 0. Approve | The institution approves this procedure and names the people (I1, I2) | Approval record |
| 1. Prepare | The coordinator assigns reviewer codes and cases. It sends the reviewer guide, the curriculum references and Part A. It withholds Part B, the institution folder and the coordinator folder | Assignment list |
| 2. Part A | Each reviewer judges the assigned cases alone | Returned Part A, dated. The coordinator keeps a signed copy or checksum, after which the form is not edited |
| 3. Part B | Once a reviewer's Part A is returned, the reviewer rates the proposed changes for the same cases | Returned Part B |
| 4. Policy | The panel decides P1–P7 and the institutional decisions. It may see a summary of the faculty judgments (how often reviewers agreed, which readings they applied) but not the software's answers | A versioned, dated policy record |
| 5. Agreement | For each case the coordinator compares the two reviewers: verdict, recommendation type, and the reading each applied | Agreement table |
| 6. Adjudication | Some cases go to the adjudicator, who records a decision with a reason or marks the case unresolved. These are cases where the reviewers disagree, where a judgment rests on a reading the panel did not adopt, or where a reviewer chose "insufficient evidence" | Adjudication record |
| 7. Reference | The data steward records the decisions as a new, separate reference version (section 7) | Reference file and change log |
| 8. Report | The coordinator reports: how many cases are agreed, adjudicated, unresolved or excluded; how the references differ from the provisional verdicts; what the panel decided | Summary |

## 4. Case states
| State | Meaning |
|---|---|
| Pending | Not all forms are returned |
| Agreed | Both reviewers give the same verdict, and the reading each applied is consistent with the adopted policy |
| Adjudicated | The adjudicator decided, with a written reason |
| Unresolved | No decision could be reached; all positions are recorded (section 6) |
| Excluded | The reviewers or the adjudicator found the case ill-posed, for example texts that cannot be judged; recorded with the reason |

## 5. Agreement rules
- **Same option.** Two reviewers agree on a verdict only when they choose the same option; Aligned against Partially aligned is a disagreement.
- **A different reading.** Suppose a judgment was made under a reading the panel did not adopt. For example, P1 adopts contribution, and a reviewer chose Partially aligned only because the CLO did not show every part of the PO. The adjudicator, not the data steward, decides the verdict under the adopted reading. The reviewer's original answer stays on record.
- **Insufficient evidence.** If either reviewer chooses insufficient evidence, the adjudicator decides whether the case can be judged or should be excluded (see also I8).
- **More than one accepted answer.** A case gets two accepted verdicts only if the adjudicator records why reasonable experts differ under the adopted policy (I9). Otherwise it gets one.
- **Recommendation type.** It is compared the same way. Two re-mappings agree only if they name the same target outcome, or if both leave the target open.
- **Statistics.** Percent agreement is reported per course and overall, with Cohen's kappa where the number of cases allows it. With one to twenty cases per course these figures describe this review only.

## 6. Recording an unresolved disagreement
For each unresolved case, record:
- the case code;
- every judgment, with its reason and the reading applied;
- the adjudicator's note on why the case could not be settled;
- what would settle it, for example a policy decision, an EGA description or another reviewer.

Unresolved cases are left out of headline agreement figures and reported separately. They are never settled by the software's answer.

## 7. Turning decisions into approved evaluation references
1. **Never edit the dataset in place.** The provisional verdicts stay unchanged in `server/lib/syllabuscheck/eval/alignment-dataset.json`. Faculty decisions go into a new, separate record, for example `alignment-faculty-references-v1.json` or a new dataset version, as approved.
2. **What each reference record holds:**
   - the dataset version and item, and the case code;
   - a hash of the two texts;
   - the final verdict, or verdicts with the reason for more than one;
   - the recommendation type, and for a re-mapping the target outcome;
   - the policy version applied;
   - the reviewer and adjudicator codes, and the dates;
   - the rationale and the state.

   Unresolved and excluded cases are listed with their state but carry no verdict.
3. **Only agreed and adjudicated cases are marked faculty-reviewed.** Every other case keeps its previous status.
4. **Part B ratings are not reference answers for future drafts.** The software will write different drafts next time. The ratings are used to write and test rules for drafts, each approved by the panel. Examples of such rules: keep the author's values; do not raise a recall outcome to a design outcome when a re-mapping would keep it.
5. **The data steward records decisions mechanically and logs every step.** A clerical error, such as a wrong code, is fixed with a logged note. A change to a decision needs the adjudicator.
6. **Copies get the same decision.** Sixteen of the cases are copies of cases in an earlier test dataset (eval-1.1). Each copy gets the same decision, recorded through a mapping table.
7. **Later changes make a new version.** A change to an approved reference follows this procedure again and produces a new version; old versions are kept.
8. **Each evaluation names its reference version.** Results measured against provisional verdicts and against faculty references are never combined in one figure.

## 8. The protected held-out cases (later)
The held-out cases are a separate set kept for one final test. Their verdicts are also developer-written. Before they are used:
- faculty review them in a separate package, without any software output;
- the decisions are recorded and sealed, for example by placing a checksum in the repository, so that they cannot be used to tune the software;
- the developer does not see the sealed decisions until the frozen configuration has been run on the held-out cases once;
- the result is reported in aggregate, as the dataset's rules require.

This package neither uses nor reveals the held-out cases.

## 9. Small numbers
The review covers 58 cases, with one to four in four of the seven courses. Its agreement figures describe these cases. They are not estimates for the institution's syllabi.
