# Stage E.7: proposal to strengthen D2 explanation and basis validation

**Offline follow-up status (2026-10-26).** The original proposal below is retained as the historical design. Its dataset/basis and advisory-check portions are now implemented in the [academic reliability follow-up](stage-e7-academic-reliability-follow-up.md), with a separate versioned dataset and a venue-only diagnostic excluded from agreement pending policy review. D2 labels/verdicts and original live results are unchanged. The paid re-evaluation and r8 prompt changes proposed below have **not** been executed or applied.

Status: a recommendation for review, prepared after the D1 evaluation as asked. Nothing in it is implemented: no checker code, prompt, dataset, label,
result file, score, gate or production setting was changed. Every check proposed here is advisory: it adds a note to an answer and never refuses the
answer, changes its label or fields, or touches a score. The measurements in section 2 were made offline on the saved E.7 results, at no cost, with
scratch scripts kept outside the repository. The provisional labels are developer-written and unreviewed: nothing here is faculty-verified.

## 1. Why

`rr-sensors-relevant` was accepted with the explanation "…and the publisher named is a technical press" and the basis `title_and_venue`, while the
entry names only "Example Press" (`docs/stage-e7-phase2-evaluation.md`, section 1). The checker accepted it because it never compares an explanation
or a basis with the entry. For a D2 answer, `checkOne` in `server/lib/syllabuscheck/gemini.js` checks:

| Checked today | Not checked |
|---|---|
| The JSON shape, the id, the label and a non-empty explanation | Whether the explanation states only what the entry and the course context show |
| Both quotes: copied exactly, each from its own text | Whether the basis value is supported by the entry |
| `relevance` and `basis` take values from their lists, and the label agrees with `relevance` (`aspects.js`; a contradictory answer is shown for review, not trusted) | Whether `basis` agrees with `relevance`: no rule reads the basis |
| | Whether wording came from another relationship of the same request |

Beyond being non-empty, an explanation meets one check, role confusion, and only in the ILO-CLO, CLO-PO and CLO-EGA pairs. The dataset `stage-d2-1`
sets no expected basis, so the basis is not scored either.

Two more observations from E.7:

- The only other `title_and_venue` answer, `rr-sensors-web`, gives as the venue's support only that "the entry names a website hosting it". Naming a
  website is not support.
- In D1, wording travelled between the relationships of one request in 2 of 17 answers. D2 requests also hold several references of one course; no
  case was found in D2.

## 2. What the proposed checks would have flagged

Measured offline on the saved answers. The venue of an entry is taken with the repository's own parser (`parseReference` in
`server/lib/syllabuscheck/references.js`): the part of the entry after the title, or a group author and the host of its web address.

| Check | Fires when | E.7 D2 (9 answers) | E.7 D1 (17 answers) |
|---|---|---|---|
| `basis_overstated` | relevance `relevant` with basis `title_and_venue`, and the venue shares no content word with the course context | 2: `rr-sensors-relevant` (correct: "Example Press."); `rr-sensors-web` (debatable, below) | Not applicable |
| `basis_contradicts_relevance` | relevance `relevant`, `tangential` or `unrelated` with basis `insufficient` | 0 | Not applicable |
| `venue_claim` | the explanation calls a press, publisher, journal or website technical, reputable, peer-reviewed, academic, specialised or the like, in words the entry does not contain | 1: `rr-sensors-relevant`, "technical press" (correct) | 0 |
| `explanation_from_other_pair` | the explanation holds a 4-word sequence of another relationship of the same request that is in neither of its own texts | 0 | 1: `vm-prog1-respect-supported` (correct) |
| `draft_from_other_pair` | the same, for a draft (D2 drafts are empty) | 0 | 1: `vu-prog1-name-only`, 24 sequences (correct) |

Both D1 cases are the ones already found by hand in the evaluation record.

- **False alarms.** `venue_claim` matched nothing else in the 42 distinct explanations kept by E.3 (run 2), E.4, E.5 and E.7, of every relationship
  type, and it classed 6 synthetic phrases as intended. `basis_overstated` stays silent on a venue that names the subject (a synthetic article in an
  "Example Journal of Sensors and Signal Conditioning") and fires on a venue of another field ("Example Journal of Marketing").
- **`rr-sensors-web` is debatable.** Its venue is an instrument maker's website, and its explanation gives no reason why that venue supports the
  judgement. But the dataset's own note calls it "a vendor note on interfacing sensors", and whether a maker of instruments is a telling venue is a
  librarian's call. The expectation proposed in Step 1 accepts either basis for this item, so against it this flag counts as a false alarm.
- **First versions failed, which is why each check needs tests.** A list of quality words without venue nouns flagged "cannot be established" in
  `rr-prog1-cannot-tell`. Splitting the entry at ". " took the year and title of `rr-prog1-relevant` as its venue (its authors have two initials),
  which would have hidden an overstated basis there; the repository's parser replaced it.
- **Limits.**
  - Word overlap is only a proxy: a venue can name the field in words the course text does not use, or share a word without supporting the
    judgement.
  - The word list misses paraphrases ("a publisher known for engineering titles") and is English only.
  - Five-word sequences missed the paraphrased D1 case; three-word sequences matched common phrases.
  - All of this rests on 26 answers from one run on unreviewed synthetic items. It shows that the checks find the known cases without false alarms
    here; it is not an estimate of precision or recall.

## 3. Recommendation, in order

### Step 1. Score the basis (dataset only; no cost)

- **A new dataset version, `stage-d2-2`.** `stage-d2-1` stays as it is, so the E.7 results remain comparable. No label or relevance expectation
  changes.
- **Provisional `basis` expectations, written from the entries by one stated rule:**
  - `title_and_venue` only when the venue's own name states or plainly implies the subject (or, for an unrelated entry, the other subject);
  - `title_only` when the title shows the subject and the venue does not;
  - `insufficient` when the title does not show it.

  For the current 9 items:
  - the 7 entries from "Example Press" or "Example University Press" whose title shows the subject → `title_only`;
  - `rr-prog1-cannot-tell` ("Essentials") → `insufficient`;
  - `rr-sensors-web` → either value.

  Scored retrospectively, the E.7 answers would agree on 8 of 9, the difference being `rr-sensors-relevant`. The rule comes from the entries, not from
  the answers.
- **Four new items,** because no current entry has a venue that adds anything:

| Purpose | Entry (invented) | Provisional expectation |
|---|---|---|
| A venue that states the subject (CPE 304) | "Lopez, C. (2021). Conditioning circuits for strain gauges. Example Journal of Sensors and Signal Conditioning, 4(2), 1–10." | ALIGNED; relevant; `title_and_venue` |
| A keyword trap whose venue shows another field (CPE 304) | "Reyes, D. (2020). Sensor data in retail analytics. Example Journal of Marketing, 7(1), 15–30." | PARTIALLY_ALIGNED or NOT_ALIGNED; tangential or unrelated; `title_and_venue` or `title_only` |
| A web page whose publisher names the subject, with a vague title (CPE 304) | "Example Sensor Standards Association. (2022). Interfacing guide [Web page]. https://www.example.org/interfacing" | ALIGNED; relevant; `title_and_venue` |
| An uninformative title with a telling venue (IE 402) | "Santos, R. (2019). Essentials. Example Journal of Systems Engineering, 2(3), 40–52." | A decision is needed: the basis list has no "venue only" value (section 5) |

### Step 2. Advisory checks in the checker (no model call; no cost)

- A function `explanationReviewOf(j, pair, pairs)` in `gemini.js`, beside `draftReviewOf`. `checkOne` calls it after its last refusal, so it can never
  refuse an answer. Its codes are recorded on the judgement as `explanationReview`, as `draftReview` is.
- The checks of section 2, with the venue from `parseReference`. `draft_from_other_pair` runs only where drafts exist, so not in D2.
- No effect on the label, fields, recommendation, verdict, score, gates or retries. `eval-alignment.cjs` reports a count per code and lists the
  flagged answers. Production shows nothing until a separate decision, and D2 itself stays off by default.
- Tests built from the E.7 answers: the 5 flags above must fire, and the other 22 answers must stay unflagged. The synthetic phrases and venues are
  tested too.

### Step 3. A bounded D2 re-evaluation under r7 (paid; needs its own approval)

- `stage-d2-2` (13 items) in 2 runs, which measures repeatability for the first time. Same model and settings as E.7, `--check-key`, a fresh ledger.
- Proposed limits: at most 21 requests and $0.05. Batches hold up to 4 relationships of one course, so about 4 model requests per run. E.7's D2 run
  reported $0.0018 for 3 requests, which puts 2 runs at about $0.005.
- Report as before, plus basis agreement (scored once Step 1 is in) and the count of each advisory code. Unsupported claims are still read by hand.
- The current key expires 2026-11-25.

### Step 4. r8 wording, only if Step 3 shows the problem again

Candidate wording for the D2 test (not applied):

- "basis is title_and_venue only when the name of the journal, publisher or website itself states or plainly implies the subject (or, for an
  unrelated entry, another subject); a venue that is only named, or whose name says nothing about the subject, gives title_only."
- "Say only what the entry and the course context show; never describe a journal, publisher or website as technical, reputable, peer-reviewed,
  academic or specialised unless the entry says so."

A new prompt version makes earlier answers non-comparable, so r8 would get its own bounded, D2-only evaluation and its own approval.

## 4. What this does not do

- It does not make the checker verify that an explanation is true. It catches the patterns seen in E.7; reading the answers by hand stays part of every
  evaluation.
- It changes no label, field value, recommendation, verdict, score, gate or production flag, and no answer is refused or retried because of a note.
- Whether references are authentic or correctly formatted stays outside D2.
- In D1 the same carry-over checks flag both E.7 cases. Withholding a D1 draft copied from another relationship, as `draftReviewOf` withholds some
  drafts today, is a separate decision.

## 5. Decisions needed

1. The basis rule of Step 1, ideally reviewed by a librarian.
2. Whether a venue alone can support a relevance judgement. The basis list has no "venue only" value, and the answer decides the fourth new item.
3. Approval of `stage-d2-2` and of Step 2 (code and tests only, no paid call).
4. Later, approval of the Step 3 evaluation (paid, bounded).
