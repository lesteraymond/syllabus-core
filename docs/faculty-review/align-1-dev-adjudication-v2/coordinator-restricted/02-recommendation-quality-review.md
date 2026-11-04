# Recommendation-quality review (restricted)

> **Version 2 copy (restricted).** This is Version 1's `coordinator/02-recommendation-quality-review.md` (sha256 `67bcf03e6e35d554`), carried over with its case codes, evidence, verdicts and drafts unchanged. Only the corrections listed in `06-changes-from-v1.md` were applied (none for this file). File paths in it follow Version 1's layout; `00-coordinator-guide.md` maps them to Version 2.

**Restricted to the review coordinator:** it names the arms and their answers. **This is a developer review against rules fixed before B2 ran (`p2b2-preregistered.json`). It is not a faculty review.** The faculty review of the same recommendations is Part B. Counts follow the B2 report (`docs/anthropic-p2-b2-report.md`, section C) and were recomputed here from the saved records.

## 1. Two separate questions
Whether a verdict is right and whether a recommendation is appropriate are different questions. The evaluations show all four combinations (the verdict columns compare with the provisional labels only):

| | The recommendation looks appropriate | The recommendation is questionable |
|---|---|---|
| **The verdict is within the provisional labels** | B2 on MA7-02 (`clo-po-calc-unrelated`): not aligned; keep the calculus CLO and re-map it | A2 on NCM101-06 (`d-po-12`): partially aligned is accepted, but the rewrite brings computing into a nursing CLO |
| **The verdict is outside the provisional labels** | B2 on ACCTG201-02 (`d-po-09`): partially aligned, with a one-word addition ("measure") | B2 on NCM101-07 (`d-ega-03`) run 2: not aligned on course fit, and the replacement removes the community element that links the CLO to its attribute |

**How the faculty review keeps them apart**
- Part A asks faculty for the verdict and the type of remedy.
- Part B asks them to rate each proposed change.
- The reference records keep the two apart (procedure, section 7).

A rewrite of an outcome that faculty judge aligned is unnecessary whatever its quality, so Part A decides whether a change was needed, and Part B how good the change is.

## 2. Sets 1 and 2 at a glance
Verdicts against the provisional labels: FR = false rejection, ✗ = otherwise outside them. The flags are the pre-registered rules, per arm and run, in the case records.

| Code | Case | Provisional labels | A2 verdicts | B2 verdicts | A2 remedies | B2 remedies | Rule flags (either arm) |
|---|---|---|---|---|---|---|---|
| MA7-01 | `clo-po-calc-lower-level` | P or N | N / N | N / N | rewrite / rewrite | rewrite / re-map (re-tag) | Bloom escalation |
| MA7-02 | `clo-po-calc-unrelated` | N or P | N / N | N / N | rewrite / rewrite | re-map (re-tag) / re-map (re-tag) | – |
| MA7-03 | `d-po-02` | N or P | N / N | N / N | rewrite / rewrite | re-map (re-tag) / re-map (re-tag) | Bloom escalation; replacement |
| MA7-05 | `d-po-01` | A | P (FR) / P (FR) | P (FR) / P (FR) | rewrite / rewrite | rewrite / rewrite | rewrite of a provisionally aligned outcome |
| MA7-06 | `clo-po-calc-vague` | P or N | P / P | P / P | rewrite / rewrite | rewrite / rewrite | Bloom escalation; replacement |
| MA7-07 | `d-any-po-01` | A | A / P (FR) | P (FR) / P (FR) | no change / rewrite | rewrite / rewrite | rewrite of a provisionally aligned outcome; replacement |
| MA7-08 | `d-any-po-03` | A | A / P (FR) | P (FR) / A | no change / rewrite | rewrite / no change | rewrite of a provisionally aligned outcome |
| MA7-09 | `d-any-po-02` | N or P | N / N | N / N | rewrite / rewrite | rewrite / rewrite | Bloom escalation; replacement |
| MA7-10 | `d-ega-04` | N or P | N / N | N / N | rewrite / rewrite | re-map (re-tag) / re-map (re-tag) | – |
| MA7-11 | `d-ega-06` | N or P | N / N | N / N | rewrite / rewrite | re-map (re-tag) / rewrite | replacement; Bloom escalation |
| MA7-13 | `d-ega-02` | N or P | N / N | N / N | rewrite / rewrite | rewrite / rewrite | Bloom escalation; replacement |
| MA7-14 | `d-any-ega-02` | N or P | N / N | N / N | rewrite / rewrite | rewrite / rewrite | Bloom escalation; replacement |
| MA7-15 | `d-ilo-01` | A | N (FR) / N (FR) | P (FR) / P (FR) | rewrite / rewrite | rewrite / rewrite | rewrite of a provisionally aligned outcome; ILO draft restates its CLO |
| MA7-18 | `ilo-clo-claims-more` | P or N | P / P | P / P | rewrite / rewrite | rewrite / rewrite | replacement |
| MA7-19 | `ilo-clo-unrelated` | N | N / N | N / N | rewrite / rewrite | rewrite / rewrite | replacement |
| MA7-20 | `d-ilo-12` | P or N | N / N | N / N | rewrite / rewrite | rewrite / rewrite | – |
| IT204-01 | `d-po-03` | A | P (FR) / P (FR) | P (FR) / P (FR) | rewrite / rewrite | rewrite / rewrite | rewrite of a provisionally aligned outcome; Bloom escalation |
| IT204-03 | `d-po-04` | N or P | N / N | N / N | rewrite / rewrite | re-map (re-tag) / re-map (re-tag) | Bloom escalation |
| IT204-05 | `clo-po-prog-interdisciplinary` | A | P (FR) / A | P (FR) / P (FR) | rewrite / no change | rewrite / rewrite | rewrite of a provisionally aligned outcome |
| IT204-06 | `clo-po-prog-lower-level` | P or N | N / N | N / N | rewrite / rewrite | rewrite / rewrite | Bloom escalation |
| IT204-08 | `d-ega-08` | A or P | N (✗) / N (✗) | N (✗) / N (✗) | rewrite / rewrite | re-map (re-tag) / re-map (re-tag) | value wording |
| IT204-09 | `clo-ega-unrelated` | N or P | N / N | N / N | rewrite / rewrite | rewrite / rewrite | Bloom escalation; replacement |
| IT204-10 | `d-any-ega-01` | A | A / A | A / P (FR) | no change / no change | no change / rewrite | rewrite of a provisionally aligned outcome; Bloom escalation |
| IT204-11 | `d-ilo-02` | A | A / A | A / P (FR) | no change / no change | no change / rewrite | rewrite of a provisionally aligned outcome |
| IT204-12 | `ilo-clo-prog-aligned` | A | A / A | P (FR) / A | no change / no change | rewrite / no change | rewrite of a provisionally aligned outcome |
| IT204-13 | `d-ilo-03` | P or N | N / N | N / N | rewrite / rewrite | rewrite / re-map (re-tag) | – |
| NCM101-01 | `clo-po-nurs-unrelated` | N | N / N | N / N | rewrite / rewrite | rewrite / rewrite | duplicates another CLO of the course; replacement |
| NCM101-03 | `d-po-05` | A | P (FR) / P (FR) | P (FR) / P (FR) | rewrite / rewrite | rewrite / rewrite | rewrite of a provisionally aligned outcome |
| NCM101-04 | `d-po-06` | N | N / N | N / N | rewrite / rewrite | rewrite / rewrite | Bloom escalation; replacement |
| NCM101-05 | `d-po-13` | P | P / P | P / P | rewrite / rewrite | rewrite / rewrite | Bloom escalation |
| NCM101-06 | `d-po-12` | N or P | P / P | N / N | rewrite / rewrite | re-map (re-tag) / re-map (re-tag) | – |
| NCM101-07 | `d-ega-03` | A | P (FR) / A | P (FR) / N (FR) | rewrite / no change | rewrite / rewrite | rewrite of a provisionally aligned outcome; replacement |
| NCM101-08 | `d-ega-07` | A | A / A | P (FR) / P (FR) | no change / no change | rewrite / rewrite | rewrite of a provisionally aligned outcome; value wording |
| NCM101-09 | `d-ilo-05` | N or P | N / N | N / N | rewrite / rewrite | rewrite / rewrite | replacement; ILO draft restates its CLO |
| NCM101-10 | `d-ilo-15` | P | P / P | P / P | rewrite / rewrite | rewrite / rewrite | replacement |
| NCM101-11 | `d-ilo-04` | A | A / A | P (FR) / A | no change / no change | rewrite / no change | rewrite of a provisionally aligned outcome |
| EDUC105-01 | `d-po-14` | P | P / P | P / P | rewrite / rewrite | rewrite / rewrite | Bloom escalation |
| EDUC105-02 | `d-po-07` | A | P (FR) / P (FR) | P (FR) / P (FR) | rewrite / rewrite | rewrite / rewrite | rewrite of a provisionally aligned outcome |
| EDUC105-03 | `d-po-08` | P or N | N / N | N / N | rewrite / rewrite | rewrite / rewrite | Bloom escalation; replacement |
| EDUC105-06 | `d-ilo-06` | A | A / A | P (FR) / P (FR) | no change / no change | rewrite / rewrite | rewrite of a provisionally aligned outcome |
| ACCTG201-01 | `d-po-10` | P or N | N / N | N / N | rewrite / rewrite | rewrite / rewrite | Bloom escalation; replacement |
| ACCTG201-02 | `d-po-09` | A | P (FR) / P (FR) | P (FR) / P (FR) | rewrite / rewrite | rewrite / rewrite | rewrite of a provisionally aligned outcome |
| ACCTG201-04 | `d-ilo-09` | N or P | N / N | N / N | rewrite / rewrite | rewrite / re-map (re-tag) | ILO draft restates its CLO; replacement |
| HM210-03 | `d-ilo-10` | A | P (FR) / P (FR) | A / A | rewrite / rewrite | no change / no change | rewrite of a provisionally aligned outcome |

## 3. The seven review areas

### 3.1 REWRITE_TEXT against RETAG_OUTCOME
- **A2 cannot re-map.** Its prompt has no re-mapping option, so every A2 remedy is a rewrite.
- **B2 re-mapped 16 answers on 10 cases.**
- **On the 8 remap candidates** (16 answers per arm), the remedy matches the pre-registered provisional remedy in 16 of 16 B2 answers and 10 of 16 A2 answers.
- **No re-mapping names its target.** Every B2 re-mapping explanation says that the mapping does not fit, but none names the outcome to move to.
- **B2 alternates between runs** on 4 cases: ACCTG201-04, IT204-13, MA7-01, MA7-11.
- **Doubtful re-mappings:**
  - IT204-13 run 2 ("to a different outcome or to none");
  - ACCTG201-04 run 2 ("may be sound for another week or CLO", though the course has no history topic).
- **One re-mapping keeps a level gap:** MA7-01 run 2 (a recall-level CLO under an Apply-level PO).

| Code | Case | Pre-registered remedy or note | A2 run 1 / 2 | B2 run 1 / 2 |
|---|---|---|---|---|
| MA7-01 | `clo-po-calc-lower-level` | level gap: Year 1: raising "Define the derivative" to design is a faculty decision; re-tagging to the apply-mathematics PO keeps it. | rewrite / rewrite | rewrite / re-map (re-tag) |
| MA7-02 | `clo-po-calc-unrelated` | RETAG | rewrite / rewrite | re-map (re-tag) / re-map (re-tag) |
| MA7-03 | `d-po-02` | level gap: Year 1: a sound Apply-level calculus CLO; raising it to design to fit a design PO is escalation; a re-tag keeps it. | rewrite / rewrite | re-map (re-tag) / re-map (re-tag) |
| MA7-10 | `d-ega-04` | RETAG | rewrite / rewrite | re-map (re-tag) / re-map (re-tag) |
| MA7-11 | `d-ega-06` | EITHER (faculty) | rewrite / rewrite | re-map (re-tag) / rewrite |
| MA7-13 | `d-ega-02` | REWRITE | rewrite / rewrite | rewrite / rewrite |
| IT204-03 | `d-po-04` | – | rewrite / rewrite | re-map (re-tag) / re-map (re-tag) |
| IT204-08 | `d-ega-08` | – | rewrite / rewrite | re-map (re-tag) / re-map (re-tag) |
| IT204-09 | `clo-ega-unrelated` | REWRITE | rewrite / rewrite | rewrite / rewrite |
| IT204-13 | `d-ilo-03` | – | rewrite / rewrite | rewrite / re-map (re-tag) |
| NCM101-01 | `clo-po-nurs-unrelated` | REWRITE OR REMOVE | rewrite / rewrite | rewrite / rewrite |
| NCM101-04 | `d-po-06` | EITHER (faculty) | rewrite / rewrite | rewrite / rewrite |
| NCM101-06 | `d-po-12` | RETAG | rewrite / rewrite | re-map (re-tag) / re-map (re-tag) |
| ACCTG201-04 | `d-ilo-09` | – | rewrite / rewrite | rewrite / re-map (re-tag) |

**For faculty:** the re-mapping proposals in Part B, Part A question 5, and policy P5.

### 3.2 Incorrect PO mappings
By the developer's provisional reading, a mapping question arises in these cases:
- **a PO from another program's list, mapped to a sound CLO:** NCM101-06 (`d-po-12`);
- **a CLO from another discipline, which no PO of the program fits, so a re-mapping cannot help:** NCM101-01 (`clo-po-nurs-unrelated`);
- **remap candidates whose provisional remedy is a re-tag or either:** MA7-02, MA7-10, MA7-11, NCM101-04, NCM101-06;
- **level gaps where the pre-registered note says a re-tag would keep the outcome:** MA7-01, MA7-03;
- **re-mapped by B2 with no pre-registered note:** IT204-03, IT204-08, and the two doubtful ILO re-mappings in 3.1.

What each arm did:
- **A2 bent the CLO toward the wrong outcome in 6 answers:** MA7-02, MA7-10, NCM101-06, two each.
- **B2 did so in none.**
- **Neither arm's explanation of NCM101-06 says that the PO belongs to another program's list.**

Whether the right remedy is to change the mapping, the text or both is P5. It is not settled here.

### 3.3 Rewriting already-aligned CLOs
Drafts written for cases whose only provisional label is ALIGNED: **A2 18, B2 27**. Each follows from a verdict in Set 1, so the faculty verdict in Part A decides whether any change was needed. Part B then rates the draft.

- **A2:** MA7-05 run 1, MA7-05 run 2, MA7-07 run 2, MA7-08 run 2, MA7-15 run 1, MA7-15 run 2, IT204-01 run 1, IT204-01 run 2, IT204-05 run 1, NCM101-03 run 1, NCM101-03 run 2, NCM101-07 run 1, EDUC105-02 run 1, EDUC105-02 run 2, ACCTG201-02 run 1, ACCTG201-02 run 2, HM210-03 run 1, HM210-03 run 2
- **B2:** MA7-05 run 1, MA7-05 run 2, MA7-07 run 1, MA7-07 run 2, MA7-08 run 1, MA7-15 run 1, MA7-15 run 2, IT204-01 run 1, IT204-01 run 2, IT204-05 run 1, IT204-05 run 2, IT204-10 run 2, IT204-11 run 2, IT204-12 run 1, NCM101-03 run 1, NCM101-03 run 2, NCM101-07 run 1, NCM101-07 run 2, NCM101-08 run 1, NCM101-08 run 2, NCM101-11 run 1, EDUC105-02 run 1, EDUC105-02 run 2, EDUC105-06 run 1, EDUC105-06 run 2, ACCTG201-02 run 1, ACCTG201-02 run 2

### 3.4 Unnecessary Bloom escalation
**The rule (pre-registered):** a CLO draft is flagged when the level of its leading verb is above the level the arm gave the CLO and at or above the level it gave the PO or EGA. An ILO draft is flagged when it is above its CLO.

**Counts:**
- CLO drafts: **A2 30, B2 25**;
- ILO drafts above their CLO: A2 0, B2 0.

The rule cannot tell a needed raise from an unnecessary one. The groups below follow the B2 report, and faculty decide in Part B:

| Group | A2 | B2 |
|---|---|---|
| the raise is the remedy the case calls for | 8: MA7-06 r1, MA7-06 r2, NCM101-05 r1, NCM101-05 r2, EDUC105-01 r1, EDUC105-01 r2, ACCTG201-01 r1, ACCTG201-01 r2 | 8: MA7-06 r1, MA7-06 r2, NCM101-05 r1, NCM101-05 r2, EDUC105-01 r1, EDUC105-01 r2, ACCTG201-01 r1, ACCTG201-01 r2 |
| an off-subject or below-course outcome rewritten; faculty set the level | 9: MA7-09 r1, MA7-09 r2, MA7-11 r2, MA7-13 r1, MA7-13 r2, MA7-14 r1, MA7-14 r2, IT204-09 r1, IT204-09 r2 | 8: MA7-09 r1, MA7-09 r2, MA7-11 r2, MA7-13 r1, MA7-14 r1, MA7-14 r2, IT204-09 r1, IT204-09 r2 |
| raised to match the PO where a re-tag or a smaller change could keep the outcome | 13: MA7-01 r1, MA7-01 r2, MA7-03 r1, MA7-03 r2, IT204-01 r1, IT204-03 r1, IT204-03 r2, IT204-06 r1, IT204-06 r2, NCM101-04 r1, NCM101-04 r2, EDUC105-03 r1, EDUC105-03 r2 | 8: MA7-01 r1, IT204-01 r2, IT204-06 r1, IT204-06 r2, NCM101-04 r1, NCM101-04 r2, EDUC105-03 r1, EDUC105-03 r2 |
| a provisionally aligned outcome raised to add the other half of an EGA name | 0: – | 1: IT204-10 r2 |

**For faculty:** Part B ("raises the cognitive level more than warranted"), and I11.

### 3.5 Duplicate learning outcomes
- **CLO drafts that duplicate another CLO of the course** (pre-registered: word-stem overlap of 0.8 or more):
  - A2 2: NCM101-01 run 1, NCM101-01 run 2;
  - B2 1: NCM101-01 run 1.
- **ILO drafts that restate their own CLO** (word overlap of 0.5 or more), so that they are no longer a step toward it:
  - A2 2: ACCTG201-04 run 1, ACCTG201-04 run 2;
  - B2 5: MA7-15 run 1, MA7-15 run 2, NCM101-09 run 1, NCM101-09 run 2, ACCTG201-04 run 1.
- **A CLO draft that restates the PO** (read by hand): NCM101-01 B2 run 2, "Provide safe, quality basic nursing care to a simulated patient using the nursing process." The PO reads "Provide safe, quality nursing care to individuals using the nursing process."

**For faculty:** Part B ("duplicates or restates another outcome"); for NCM101-01, whether removal is the better remedy (P5).

### 3.6 Changes to institutional values
**The rule (pre-registered):** a draft is flagged when it names a core value or another value term, or drops a value reference that the original had. Flagged drafts:
- A2 2: IT204-08 run 1, IT204-08 run 2;
- B2 2: NCM101-08 run 1, NCM101-08 run 2.

Read by hand:
- **NCM101-08 (`d-ega-07`)** is the only CLO in the cases that names values ("the Augustinian values of community and truth").
  - A2 left it unchanged.
  - B2 run 1 relabels them "Augustinian-Marian values of community, truth and compassion".
  - B2 run 2 keeps them and adds "the Marian value of compassion".
  - Compassion is one of the six core values. "Truth" is not, and no source in the system assigns values to an Augustinian or a Marian tradition.
- **IT204-08 (`d-ega-08`):**
  - A2's drafts add value terms to a purely technical CLO ("integrity", "humility", "service to others").
  - B2 re-maps instead and adds none.
- **No explanation in either arm proposes changing an EGA, a PO, a value or any institutional policy.**

**For faculty:** P6, and Part B ("adds, removes or changes values or attributes").

### 3.7 Changes to course scope
**The rule (pre-registered):** a draft is a replacement, not a revision, when it keeps under a third of the original's content stems. Replacements:
- A2 30;
- B2 24.

Many are expected, because they replace off-subject outcomes. Those that change a plausible outcome's subject (read by hand, B2 report C6):
- **content replaced to fit the course description:**
  - MA7-05: integration becomes differentiation;
  - NCM101-07: the outreach becomes basic care;
  - NCM101-04: anatomy becomes communication.
- **content added to fit the course description:**
  - calculus in a team-design CLO (MA7-08 B2 run 1);
  - differentiation in a linear-algebra CLO (MA7-07 B2 run 2).
- **multi-part widening:**
  - EDUC105-02: construct, administer and evaluate;
  - IT204-01: design and evaluation;
  - IT204-05: organizations and society.
- **ILO drafts grown toward their CLO:**
  - MA7-15;
  - IT204-12 B2 run 1 adds testing;
  - IT204-11 B2 run 2 adds implementation.

**For faculty:** Part B ("changes the course's subject matter or scope"), P4 and I11.

## 4. Draft counts
| | A2 | B2 |
|---|---|---|
| Drafts | 82 | 75 |
| Re-mappings | 0 | 16 |
| Remap candidates given the provisional remedy (of 16) | 10 | 16 |
| Rewrites of provisionally aligned outcomes | 18 | 27 |
| Bloom escalation (CLO drafts) | 30 | 25 |
| Duplicate CLOs | 2 | 1 |
| ILO drafts restating their CLO | 2 | 5 |
| Replacements (under a third kept) | 30 | 24 |
| Value wording flagged | 2 | 2 |
