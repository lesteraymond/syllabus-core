'use strict';
// Stage E.7 follow-up: a static, advisory review of what an answer SAYS (its explanation) and PROPOSES (its draft), beside the quote checks of gemini.js,
// which verify only what it QUOTES. No model call. Nothing here refuses an answer or changes its label, fields, score, gate or retries: gemini.js records
// the codes on the judgement after its last refusal (explanationReview; draftReview, next to the checks it already had) with the phrase that raised each
// (reviewEvidence). Explanation notes never change verdicts. Hard draft notes withhold a suggestion; E.8 advisory draftWarnings do not. Checks follow the E.7/E.8
// answers (docs/stage-e7-phase2-evaluation.md, docs/stage-e7-d2-validation-proposal.md) and the cases in stage-e7.test.js. The word lists are English
// only, and nothing here shows that an explanation or a draft is academically right.
//
// The explanation of a lesson relationship of Stages C and D (Activity-fit, Assessment-fit, the Stage C3 links, Value-use, Value-map, Ref-relevance):
//   explanation_from_other_pair  it repeats wording of another relationship of the same request: 4-word sequences of that relationship's texts, in none
//                                of its own texts (its source, its target, the course), holding at least two content words its own texts do not have.
//                                A term two lessons legitimately share is in the relationship's own text, or is one word, so it never counts.
//   cites_other_week             it names a week its lesson does not cover
//   venue_claim                  (Ref-relevance) it calls the press, publisher, journal or website technical, reputable, peer-reviewed, academic and the
//                                like, in words the entry does not contain
//   metadata_claim               (Ref-relevance) it states a year, an author's standing or the work's standing (indexed, widely cited, a standard
//                                textbook) that neither the entry nor the course context shows
//   basis_overstated             (Ref-relevance) relevant on basis title_and_venue, though the name of the venue shares no content word with the course
//   basis_contradicts_relevance  (Ref-relevance) a definite relevance (relevant, tangential, unrelated) resting on basis insufficient
//   cites_outcome                (Stage C3) it rests the judgement of a link on an ILO, a CLO or another outcome, which these links never involve
// A draft (values drafts: Value-use, Module-value; activity and assessment drafts: Activity-fit, Assessment-fit; the one-sentence recommendation of a
// failing Stage C3 link, read with recommendationReview.js chainDraftNotes: asks_for_outcome, adds_scope, not_one_sentence and the resource notes):
//   copies_other_relationship    legacy values-draft wording check; a Stage C draft also needs an independently unsupported detail before copying withholds
//   borrowed_wording             Stage C wording similarity without such a detail: advisory only, not a judgment of unsuitability
//   assumes_resource             Stage C resource/facility access not established in the lesson, checked independently of course credit units
//   unnecessary_practical        Stage C draft adds practical performance to a clearly conceptual ILO
//   expands_competency           Stage C draft introduces unsupported project or competency scope
//   adds_participant             people from beyond the class that the lesson does not mention: another section or school, the community or families,
//                                and (values drafts) clients, stakeholders or experts. A partner, a classmate or a group of the class is never counted.
//   adds_activity                (values drafts) an activity the lesson does not have: a laboratory, pair or group work, a presentation, an interview, a
//                                survey, a trip or outreach, service or fundraising, a competition, a written or media product, an event, tutoring, or
//                                grading the value
//   adds_resource                (values drafts) money, an online platform, a device, a software tool or printed material the lesson does not mention
//   adds_week                    a week the lesson does not cover: a numbered week, the next or previous week, or an ordinal week beyond its span
//   value_not_expressed          (values drafts) the answer found the value unrelated to the lesson or clashing with it (Value-use valueUse unrelated or
//                                valueFit clashes; Module-value NOT_ALIGNED), and the draft keeps that value while describing nothing a person does
//                                with, for or toward others or themselves: a technical step with a value's name attached
// A values draft's activities and participants are read against this lesson alone (the source without the definitions and lists the engine adds).
// Course context may ground resources and terminology, but cannot turn course-wide laboratory provision into an activity in this lesson. Never use
// the values statement it replaces: a statement judged off the lesson cannot ground its own rewrite. An activity or assessment draft is read against the
// lesson, the text it revises and the course. Value names are left out before the word lists are read ("Community-orientedness" is no community), and so
// is what a draft rules out ("rather than a contest", "without a prize").
const { VALUE_NAMES, namedValues } = require('./values');
const { parseReference } = require('./references');
const { weeksIn } = require('./planrows');
const { lessonDraftNotes, lessonExplanationNotes, chainDraftNotes, chainExplanationNotes } = require('./recommendationReview');
const { C3 } = require('./stages');

// ---- words ----
// The content words of a text, lightly stemmed (programs -> program, testing -> test). gemini.js uses them for role confusion and the draft checks.
const STOP = new Set(['about', 'also', 'among', 'another', 'been', 'being', 'both', 'does', 'each', 'either', 'every', 'from', 'have', 'here', 'into', 'just', 'many', 'more', 'most', 'much', 'must', 'only', 'other', 'over', 'same', 'should', 'some', 'such', 'than', 'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'under', 'upon', 'very', 'what', 'when', 'where', 'which', 'while', 'whose', 'will', 'with', 'within', 'would', 'your', 'course', 'student', 'students', 'learner', 'learners', 'able', 'ability', 'week', 'outcome', 'outcomes']);
const wordsIn = text => String(text ?? '').toLowerCase().match(/\p{L}+/gu) || [];
const stemOf = w => {
  for (const end of ['ing', 'ed', 'es', 's']) if (w.endsWith(end) && w.length - end.length >= 4) { const s = w.slice(0, -end.length); return /([^aeiouls])\1$/.test(s) ? s.slice(0, -1) : s; } // programming -> program
  return w;
};
const stems = text => new Set(wordsIn(text).filter(w => w.length >= 4 && !STOP.has(w)).map(stemOf));
// Words for the sequence checks: letters and digits, an apostrophe kept inside a word ("partner's").
const sequenceWords = text => String(text ?? '').toLowerCase().replace(/[’‘]/g, "'").match(/[\p{L}\p{N}]+(?:'\p{L}+)*/gu) || [];
const SEQUENCE = 4, MAX_PHRASE = 12;
const GENERIC_CLASSROOM = new Set(['work', 'together', 'class', 'classroom', 'lesson', 'learning', 'activity', 'activiti', 'task']);
const gramsOf = words => { const out = new Set(); for (let i = 0; i + SEQUENCE <= words.length; i++) out.add(words.slice(i, i + SEQUENCE).join(' ')); return out; };
const courseText = course => (course ? [course.code, course.title, course.program, course.description, ...(Array.isArray(course.outcomes) ? course.outcomes : [])].filter(Boolean).join('\n') : '');

// ---- wording from another relationship of the same request ----
// The sibling whose wording the text repeats most, with the longest repeated run of words (up to MAX_PHRASE) as the evidence, or null.
function borrowedWording(text, pair, pairs, course) {
  const words = sequenceWords(text), siblings = (pairs || []).filter(p => p && p.id !== pair.id);
  if (words.length < SEQUENCE || !siblings.length) return null;
  const ownText = [pair.source, pair.target, courseText(course)].join('\n');
  const own = gramsOf(sequenceWords(ownText)), ownStems = stems(ownText);
  let best = null;
  for (const sibling of siblings) {
    const theirs = gramsOf(sequenceWords(`${sibling.source ?? ''}\n${sibling.target ?? ''}`)), covered = new Set();
    for (let i = 0; i + SEQUENCE <= words.length; i++) {
      const gram = words.slice(i, i + SEQUENCE).join(' ');
      if (theirs.has(gram) && !own.has(gram)) for (let k = i; k < i + SEQUENCE; k++) covered.add(k);
    }
    if (!covered.size || [...stems([...covered].map(k => words[k]).join(' '))].filter(s => !ownStems.has(s) && !GENERIC_CLASSROOM.has(s)).length < 2) continue;
    let run = [], longest = [];
    for (let k = 0; k <= words.length; k++) { if (covered.has(k)) run.push(words[k]); else { if (run.length > longest.length) longest = run; run = []; } }
    if (!best || covered.size > best.words) best = { from: sibling.id, phrase: longest.slice(0, MAX_PHRASE).join(' '), words: covered.size };
  }
  return best;
}

// ---- weeks ----
// The weeks a lesson covers, from the label its source begins with ("Week 4-5 course content: ...", for Stage C3 also "Week 4-5 learning activities: ..."),
// or for a reference the weekly topics of the course context ("Week 3: ..."); null when the source names none (a Module-value source carries no week).
function weeksOfPair(pair) {
  const source = String(pair.source ?? '');
  const lesson = /^Week\s+([^\n]*?)\s+(?:course content|learning activities):/i.exec(source);
  if (lesson) return weeksIn(lesson[1]);
  const listed = [...source.matchAll(/^Week\s+([\d\s,–-]+):/gim)].flatMap(m => weeksIn(m[1]));
  return listed.length ? listed : null;
}
// The first mention of a numbered week ("Week 5", "weeks 6 and 7") that names a week outside `weeks` (planrows.js citedWeeks reads them the same way).
const WEEK_REF = /\bweeks?\s+(\d{1,2}(?:\s*[-–]\s*\d{1,2})?(?:\s*(?:,|and|&|or)\s*\d{1,2}(?:\s*[-–]\s*\d{1,2})?)*)/gi;
function otherWeek(text, weeks) {
  for (const m of String(text ?? '').matchAll(WEEK_REF)) if (weeksIn(m[1].replace(/\s*(and|&|or)\s*/gi, ',')).some(w => !weeks.includes(w))) return m[0];
  return null;
}
const RELATIVE_WEEK = /\b(?:next|following|previous|coming|subsequent|succeeding|last)\s+weeks?\b/i;
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const ORDINAL_WEEK = new RegExp(`\\b(${ORDINALS.join('|')})\\s+week\\b`, 'gi');
function weekBeyond(draft, pair, ground) {
  const weeks = weeksOfPair(pair);
  const numbered = weeks && weeks.length ? otherWeek(draft, weeks) : null;
  if (numbered) return numbered;
  const relative = RELATIVE_WEEK.exec(draft);
  if (relative && !RELATIVE_WEEK.test(ground)) return relative[0];
  if (weeks && weeks.length) for (const m of String(draft).matchAll(ORDINAL_WEEK)) { const n = ORDINALS.indexOf(m[1].toLowerCase()) + 1; if (n > weeks.length && !weeks.includes(n)) return m[0]; }
  return null;
}

// ---- references (Ref-relevance) ----
const QUALITY = String.raw`technical|specialist|speciali[sz]ed|reputable|respected|renowned|well[- ]known|leading|authoritative|scholarly|academic|peer[- ]reviewed|established|prestigious|credible|trusted|reliable|official`;
const VENUE_NOUN = String.raw`press|publisher|publishing house|journal|website|site|venue|publication|source`;
const VENUE_CLAIM = new RegExp(String.raw`\b(?:${QUALITY})(?:\s+\w+){0,2}?\s+(?:${VENUE_NOUN})\b|\b(?:${VENUE_NOUN})\s+(?:is|was)\s+(?:an?\s+)?(?:${QUALITY})\b`, 'gi');
const STANDING = new RegExp(String.raw`\bpeer[- ]reviewed\b|\bindexed\s+(?:in|by)\b|\b(?:highly|widely|frequently|often|much|heavily)\s+cited\b|\bwidely\s+(?:used|adopted|read|recogni[sz]ed|accepted)\b|\bbest[- ]?sell(?:ing|er)\b|\baward[- ]winning\b|\b(?:standard|classic|seminal|landmark|definitive)\s+(?:textbook|text|book|reference|work|paper)\b|\b(?:textbook|book|text|work)\s+(?:is|was)\s+(?:a\s+|the\s+)?(?:standard|classic|seminal|landmark|definitive)\b`, 'gi');
const CREDENTIAL = String.raw`experts?|professors?|specialists?|authorit(?:y|ies)|researchers?|practitioners?|scholars?|engineers?`;
const AUTHOR_STANDING = new RegExp(String.raw`\b(?:author|authors|writer|writers)\s+(?:is|are|was|were)\s+(?:an?\s+|the\s+)?(?:well[- ]known\s+|leading\s+|recogni[sz]ed\s+|renowned\s+|respected\s+|experienced\s+)?(?:${CREDENTIAL}|renowned|respected|experienced|well[- ]known|leading|recogni[sz]ed)\b|\bwritten\s+by\s+(?:an?\s+|the\s+)?(?:well[- ]known\s+|leading\s+|renowned\s+|respected\s+|experienced\s+)?(?:${CREDENTIAL})\b|\b(?:experts?|specialists?|authorit(?:y|ies))\s+(?:in|on)\s+(?:the\s+)?(?:field|subject|area|topic)\b`, 'gi');
const YEAR = /\b(?:1[5-9]\d\d|20\d\d)\b/g;
// Explicit names only: a claim to have been published/hosted by a named organisation absent from the supplied entry. This does not check that
// organisation's existence, reputation or subject coverage. Lowercase descriptions and indirect paraphrases remain outside this heuristic.
const NAMED_VENUE = /\b(?:published|issued|hosted)\s+by\s+((?:[A-Z][\w&-]*(?:\s+(?:of|and|the|[A-Z][\w&-]*))*)|[A-Z]{2,})|\b(?:published|appears|appeared)\s+in\s+(?:the\s+)?((?:[A-Z][\w&-]*(?:\s+(?:of|and|the|[A-Z][\w&-]*))*))/g;
// A claim inside a clause that says it is NOT known ("the entry does not say whether the publisher is reputable") is not a claim.
const HEDGED = /\b(?:not|no|never|cannot|whether|unknown|unclear|without|nothing|neither|nor)\b|n['’]t\b/i;
const clauseAt = (text, index) => { const start = Math.max(...['.', ';', ':', '!', '?'].map(c => text.lastIndexOf(c, index - 1))) + 1; const ends = ['.', ';', ':', '!', '?'].map(c => text.indexOf(c, index)).filter(i => i >= 0); return text.slice(start, ends.length ? Math.min(...ends) : text.length); };
function unstatedClaim(text, re, entry) {
  for (const m of String(text).matchAll(re)) if (!entry.toLowerCase().includes(m[0].toLowerCase()) && !HEDGED.test(clauseAt(text, m.index))) return m[0];
  return null;
}
const normalizedWords = text => wordsIn(text).join(' ');
function unstatedVenue(text, entry) {
  for (const m of String(text).matchAll(NAMED_VENUE)) {
    const name = m[1] || m[2];
    if (!normalizedWords(entry).includes(normalizedWords(name)) && !HEDGED.test(clauseAt(text, m.index))) return m[0];
  }
  return null;
}
// The venue an entry names: what follows the title (a journal or a publisher), or a group author and the host of its web address
// (references.js parseReference). Its content words, lightly de-pluralised, are compared with the course context's.
const hostOf = url => { try { return new URL(url).hostname; } catch { return ''; } };
function venueOf(entry) {
  const c = parseReference(entry).components || {};
  return [c.rest, c.groupAuthor ? c.authors : '', ...(c.urls || []).map(hostOf)].filter(Boolean).join(' ').trim();
}
const VENUE_STOP = new Set('a an and the of in on for to with by at from is are be as or its it this that these those example press university publisher publishing books inc ltd web page https http www com org net edu gov info ed'.split(' '));
const venueWords = text => new Set(String(text ?? '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !VENUE_STOP.has(w) && !/^\d+$/.test(w)).map(w => w.replace(/(ies|es|s)$/, '')));
function referenceClaims(text, pair, aspects) {
  const out = [], entry = String(pair.target ?? ''), context = String(pair.source ?? '');
  const venue = unstatedClaim(text, VENUE_CLAIM, entry) || unstatedVenue(text, entry);
  if (venue) out.push({ code: 'venue_claim', evidence: venue });
  const standing = unstatedClaim(text, STANDING, entry) || unstatedClaim(text, AUTHOR_STANDING, entry) || unstatedClaim(text, YEAR, `${entry}\n${context}`);
  if (standing) out.push({ code: 'metadata_claim', evidence: standing });
  const v = (aspects && aspects.values) || {};
  if (v.relevance === 'relevant' && v.basis === 'title_and_venue') {
    const named = venueOf(entry), course = venueWords(context);
    if (![...venueWords(named)].some(w => course.has(w))) out.push({ code: 'basis_overstated', evidence: named });
  }
  if (v.basis === 'insufficient' && ['relevant', 'tangential', 'unrelated'].includes(v.relevance)) out.push({ code: 'basis_contradicts_relevance', evidence: `${v.relevance} / insufficient` });
  return out;
}

// ---- the explanation ----
// Stage C3's three links are reviewed too: their batches carry the other links of the same lesson, whose wording an explanation must not borrow.
const REVIEWED_TYPES = new Set(['Activity-fit', 'Assessment-fit', 'Value-use', 'Value-map', 'Ref-relevance', ...C3.types]);
// [{ code, evidence }] for one verified answer; [] for a relationship type this review does not cover.
function reviewExplanation(j, pair, pairs = [], course = null, aspects = null) {
  const text = String((j && j.explanation) || '');
  if (!REVIEWED_TYPES.has(pair.type) || !text.trim()) return [];
  const out = [], borrowed = borrowedWording(text, pair, pairs, course);
  if (borrowed) out.push({ code: 'explanation_from_other_pair', evidence: borrowed.phrase, from: borrowed.from });
  const weeks = weeksOfPair(pair), cited = weeks && weeks.length ? otherWeek(text, weeks) : null;
  if (cited) out.push({ code: 'cites_other_week', evidence: cited });
  if (pair.type === 'Ref-relevance') out.push(...referenceClaims(text, pair, aspects));
  out.push(...lessonExplanationNotes(j, pair), ...chainExplanationNotes(j, pair));
  return out;
}

// ---- the draft ----
const VALUE_DRAFT_TYPES = new Set(['Value-use', 'Module-value']), LESSON_DRAFT_TYPES = new Set(['Activity-fit', 'Assessment-fit']), CHAIN_DRAFT_TYPES = new Set(C3.types);
// The lesson part of a values source: the engine appends the institution's definitions and, for Value-map, the official list and the faculty's
// expressions; they describe the values, not what the lesson does.
const lessonPart = source => String(source ?? '').split(/\n(?=Definitions of the values named|No institutional definition of the values named|The six official core values|Expressions the faculty wrote)/)[0];
const VALUE_NAME = new RegExp(`\\b(?:${VALUE_NAMES.flatMap(name => (name === 'Community-orientedness' ? ['community-orientedness', 'community orientedness'] : [name.toLowerCase()])).map(s => s.replace(/[-\s]/g, '[-\\s]?')).join('|')})\\b`, 'gi');
const NEGATED = /\b(?:rather than|instead of|without|not|never|no longer|avoid(?:s|ed|ing)?)\b[^,.;:!?]*/gi;
const plain = text => String(text ?? '').replace(VALUE_NAME, ' ').replace(NEGATED, ' ');
// People from beyond the class (first two groups for every draft, the third for values drafts only).
const PARTICIPANTS = [
  ['outside', /\b(?:another|other|different|neighbou?ring)\s+(?:sections?|schools?|campus(?:es)?|colleges?|departments?|year levels?|batch(?:es)?|universit(?:y|ies))\b|\boutside\s+(?:of\s+)?(?:their|the|his|her|its)?\s*(?:own\s+)?(?:pairs?|groups?|teams?|sections?|schools?|campus)\b|\b(?:visitors?|guests?|younger students|high school students|elementary pupils|pupils)\b/i],
  ['community', /\b(?:barangays?|communit(?:y|ies)|residents?|neighbou?rs?|neighbou?rhoods?|famil(?:y|ies)|parents?|guardians?|the public|general public|local government|lgus?|ngos?|charit(?:y|ies)|orphan(?:s|ages?)?|the elderly|senior citizens|the poor|the needy|beneficiar(?:y|ies)|parish(?:es|ioners)?|out-of-school youth)\b/i],
  ['clients', /\b(?:clients?|stakeholders?|industry partners?|employers?|compan(?:y|ies)|firms?|experts?|alumni|guest speakers?|resource (?:speakers?|persons?)|consultants?)\b/i],
];
const ACTIVITIES = [
  ['laboratory', /\b(?:laborator(?:y|ies)|labs?)\b/i],
  ['pair work', /\b(?:pairs?|paired|partners?)\b/i],
  ['group work', /\b(?:groups?|teams?|teammates?|groupmates?|team ?members?|small[- ]group)\b/i],
  ['presentation', /(?<!\bat\s)\bpresent(?:s|ed|ing)?\b|\bpresentations?\b|\bshow-and-tell\b|\breport(?:s|ed|ing)?\s+to\s+the\s+class\b/i],
  ['interview', /\binterview\w*/i],
  ['survey', /\b(?:surveys?|surveyed|surveying|questionnaires?|polls?)\b/i],
  ['trip or outreach', /\b(?:trips?|excursions?|immersions?|outreach|exposure (?:trip|visit)s?|mission (?:trips?|work)|missions to|(?:site|field|home|community|school) visits?)\b/i],
  ['service or fundraising', /\b(?:community service|service[- ]learning|volunteer\w*|donat\w*|fund[- ]?rais\w*|charity drives?|relief (?:drives?|goods|operations?)|feeding programs?)\b/i],
  ['competition', /\b(?:compet(?:e|es|ed|ing|ition|itions|itive)|contests?|tournaments?|hackathons?)\b/i],
  ['written or media product', /\b(?:journals?|journaling|diar(?:y|ies)|essays?|reflection (?:papers?|essays?|logs?|journals?)|written reflections?|posters?|videos?|vlogs?|blogs?|podcasts?|infographics?|portfolios?|brochures?|scrapbooks?|social media)\b/i],
  ['event', /\b(?:seminars?|workshops?|symposi(?:um|a)|(?:science|job|tech|research) fairs?|exhibitions?|celebrations?|ceremon(?:y|ies)|concerts?)\b/i],
  ['tutoring', /\b(?:tutor\w*|mentor\w*|peer[- ]teach\w*)\b/i],
  ['grading of the value', /\b(?:graded|scored|rated|marked)\s+(?:on|for)\b|\brubrics?\b|\bextra\s+credit\b|\bbonus\s+points?\b/i],
];
const RESOURCES = [
  ['money', /\b(?:money|funds?|fees?|budgets?|donations?|pesos?|cash|payments?|pa(?:y|id|ying)\s+for|purchas\w*|buy(?:s|ing)?|bought|sponsor\w*|prizes?)\b|₱/i],
  ['online platform', /\b(?:online|internet|websites?|web ?pages?|apps?|platforms?|lms|google (?:classroom|forms?|docs?|meet|drive)|facebook|messenger|zoom|youtube|moodle|github|e-?mails?|group ?chats?|forums?|discussion boards?)\b/i],
  ['device', /\b(?:laptops?|tablets?|smart ?phones?|cell ?phones?|mobile phones?|gadgets?|printers?|projectors?|cameras?)\b/i],
  ['software tool', /\b(?:simulat\w*|spreadsheets?|excel|matlab|multisim|proteus|ltspice|tinkercad|netbeans|eclipse|vs ?code|visual studio)\b/i],
  ['printed material', /\b(?:handouts?|worksheets?|printouts?|printed|manuals?|booklets?|textbooks?|readings)\b/i],
];
// Something a person does with, for or toward others or themselves: without one, a value is only a name on a technical step.
const PERSONAL = /\b(?:partners?|peers?|classmates?|teammates?|groupmates?|teams?|groups?|pairs?|each other|one another|others|other students|people|persons?|someone|everyone|anyone|community|communities|stakeholders?|users?|clients?|readers?|audiences?|neighbou?rs?|famil(?:y|ies)|help\w*|assist\w*|support\w*|shar(?:e|es|ed|ing)|listen\w*|feedback|respect\w*|care|cares|cared|caring|kindness|kindly|serv(?:e|es|ed|ing|ice)|collaborat\w*|cooperat\w*|reflect\w*|own|admit\w*|acknowledg\w*|confess\w*|honest\w*|truth\w*|mistakes?|assumptions?|speak(?:s|ing)? up|ask(?:s|ed|ing)? for help|thank\w*|encourag\w*|patien\w*|humbl\w*|apologi[sz]\w*|forgiv\w*|credit\w*|needs|feelings?|empath\w*|risk\w*|uncertain\w*|unfinished|fair(?:ly|ness)?|integrity|responsib\w*)\b/i;
const firstAdded = (groups, text, ground) => { for (const [, re] of groups) { const m = re.exec(text); if (m && !re.test(ground)) return m[0]; } return null; };
const valueJudgedOff = (j, pair, aspects) => (pair.type === 'Module-value' ? j.label === 'NOT_ALIGNED' : !!(aspects && aspects.values && (aspects.values.valueUse === 'unrelated' || aspects.values.valueFit === 'clashes')));
// [{ code, evidence }] for one draft; [] for a relationship type this review does not cover (gemini.js keeps its own two checks for every type).
function reviewDraft(j, pair, course = null, { pairs = [], aspects = null } = {}) {
  const values = VALUE_DRAFT_TYPES.has(pair.type), chain = CHAIN_DRAFT_TYPES.has(pair.type), draft = String((j && j.draft) || '');
  if ((!values && !chain && !LESSON_DRAFT_TYPES.has(pair.type)) || !draft.trim()) return [];
  // A Stage C3 link shows its recommendation only when it fails: a draft beside a pass is never shown, so it is not reviewed either.
  if (chain && !['PARTIALLY_ALIGNED', 'NOT_ALIGNED'].includes(j.label)) return [];
  const out = [], borrowed = borrowedWording(draft, pair, pairs, course);
  if (borrowed && values) out.push({ code: 'copies_other_relationship', evidence: borrowed.phrase, from: borrowed.from });
  const ground = plain(values ? `${lessonPart(pair.source)}\n${courseText(course)}` : `${pair.source}\n${pair.target}\n${courseText(course)}`), text = plain(draft);
  const actionGround = values ? plain(lessonPart(pair.source)) : ground;
  const people = firstAdded(values ? PARTICIPANTS : PARTICIPANTS.slice(0, 2), text, actionGround);
  if (people) out.push({ code: 'adds_participant', evidence: people });
  if (values) {
    const activity = firstAdded(ACTIVITIES, text, actionGround), resource = firstAdded(RESOURCES, text, ground);
    if (activity) out.push({ code: 'adds_activity', evidence: activity });
    if (resource) out.push({ code: 'adds_resource', evidence: resource });
  }
  const week = weekBeyond(draft, pair, ground);
  if (week) out.push({ code: 'adds_week', evidence: week });
  const kept = values && valueJudgedOff(j, pair, aspects) ? namedValues(draft).filter(name => namedValues(pair.target).includes(name)) : [];
  if (kept.length && !PERSONAL.test(text)) out.push({ code: 'value_not_expressed', evidence: kept.join(', ') });
  if (!values) {
    out.push(...(chain ? chainDraftNotes(j, pair) : lessonDraftNotes(j, pair)));
    // A shared way to assess the same ILO is not proof of an inappropriate correction. For C drafts, copying withholds only when an independent
    // unsupported detail was found too. Ambiguous reuse is a visible caution, and does not suppress an otherwise eligible suggestion.
    if (borrowed) {
      const origin = pairs.find(p => p.id === borrowed.from), originText = sequenceWords(`${origin?.source || ''}\n${origin?.target || ''}`).join(' ');
      const detail = out.some(n => !n.advisory && originText.includes(sequenceWords(n.evidence).join(' ')));
      out.push({ code: detail ? 'copies_other_relationship' : 'borrowed_wording', evidence: borrowed.phrase, from: borrowed.from, ...(!detail ? { advisory: true } : {}) });
    }
  }
  return out;
}
// These findings are suspicions for faculty review, never a reason to invalidate an academic judgement.
module.exports = { reviewExplanation, reviewDraft, borrowedWording, weeksOfPair, venueOf, lessonPart, REVIEWED_TYPES, VALUE_DRAFT_TYPES, LESSON_DRAFT_TYPES, CHAIN_DRAFT_TYPES, VENUE_CLAIM, STOP, wordsIn, stemOf, stems };
