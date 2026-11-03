'use strict';
// Conservative E.8 hints about a C-stage proposal, independent of its academic judgment. No model, I/O, availability inference or label changes.
const { competencyOf, CHAIN_TYPES } = require('./lessonfit');
const LESSON_TYPES = new Set(['Activity-fit', 'Assessment-fit']);
const UNAVAILABLE = /\b(?:unavailable|not available|not provided|no access|cannot access|lacks?|without|not permitted)\b|\bno\b/i;
const UNKNOWN = /\b(?:unknown|unconfirmed|unverified|not established|not specified|not stated|cannot confirm|cannot establish)\b/i;
const CONDITIONAL = /\b(?:if|where|provided that)\b[^.;\n]{0,140}\b(?:available|accessible|provided|confirmed|verified|permitted)\b|\bsubject to\b[^.;\n]{0,80}\b(?:availability|confirmation|permission)\b/i;
const RESOURCE_REVIEW_VERSION = 'resources-4'; // local review only; no change to the academic prompt or its cache key
// Data that learners analyse has to be supplied: given or sample values, a data set, simulated measurements (not results the learners record).
const DATA = String.raw`data ?sets?|sets? of (?:(?:measured|measurement|simulated|sample|experimental) )?(?:data|values|readings|measurements|results)` +
  String.raw`|(?:given|sample) (?:or simulated )?(?:measured|measurement|experimental|test|output) (?:data|values|readings|measurements|results)|(?:given|sample) data` +
  String.raw`|(?:instructor|faculty|teacher)[- ](?:provided|supplied|prepared) (?:(?:measured|measurement|simulated|experimental|test|sample) )?(?:data(?: ?sets?)?|values|readings|measurements|results)` +
  String.raw`|simulated (?:(?:measured|measurement|experimental|test) )?(?:data|values|readings|measurements)`;
const IS_DATA = new RegExp(`^(?:${DATA})$`, 'i');
const MATERIALS = new RegExp(String.raw`\b(?:(?:syntax|lecture|class|course|study|reference) notes?|(?:the|these|those|existing|provided|available) notes|notes|worksheets?|starter files?|starter code|handouts?|(?:annotated )?code samples?|sample code|reference materials?|${DATA})\b`, 'i');
// A general noun names equipment only as the means of an activity and as a head noun ("using bench components and instrumentation"), never as a
// topic ("the lecture explains instrumentation", "an instrumentation amplifier"). This reads the context; it is not a list of banned words.
const AS_MEANS = String.raw`(?<=\b(?:using|use|uses|with|via)\s+(?:[\w-]+\s+){0,5})`;
const HEAD_NOUN = String.raw`(?!\s+(?!(?:and|or|if|where|when|to|for|in|from|that|which|is|are|as|at|on|of|with|during|while|but|unless|only|so)\b)[a-z])`;
const QUALIFIED = '(?:bench|test|testing|measuring|measurement|laboratory|lab|electronic|electrical)';
// A whole family of equipment. A statement about the family can rule out or condition its members; it never establishes a particular one.
const EQUIPMENT_FAMILY = new RegExp(String.raw`\b(?:(?:${QUALIFIED}|speciali[sz]ed) )?equipment\b|\b${QUALIFIED} (?:instruments?|instrumentation)\b|\binstrumentation\b${HEAD_NOUN}|\bbench components?\b`, 'i');
const RESOURCES = [
  ['laboratory', /\b(?:laborator(?:y|ies)|labs?|laboratory facilities|testing facilities|physical testing|hardware testing)\b/i],
  ['equipment', new RegExp(String.raw`\b(?:breadboards?|oscilloscopes?|multimeters?|(?:function|signal) generators?|soldering stations?|laboratory kits?|lab kits?|measurement equipment|speciali[sz]ed equipment|test rigs?|3d printers?` +
    String.raw`|bench (?:components?|equipment|instruments?|instrumentation|power suppl(?:y|ies)|setups?)|${QUALIFIED} (?:equipment|instruments?|instrumentation)|(?:laboratory|lab) power suppl(?:y|ies))\b|${AS_MEANS}\binstrumentation\b${HEAD_NOUN}`, 'i')],
  ['specialized software', /\b(?:simulators?|simulation software|circuit simulat\w*|matlab|multisim|proteus|ltspice|labview|solidworks|autocad|tinkercad|netbeans|eclipse|visual studio|vs code)\b/i],
  ['facility', /\b(?:computer rooms?|fabrication facilities|machine shops?|teaching facilities|workshop facilities|recording studios?|makerspaces?)\b/i],
  ['specific resource', /\b(?:printed manuals?|projectors?|laptops?|tablets?|smartphones?|paid subscriptions?|licensed software|learning platforms?|google classroom|moodle|zoom|github)\b/i],
  ['instructional material', MATERIALS],
];
const clauses = text => String(text || '').split(/[.;!?\n]/).map(s => s.trim()).filter(Boolean);
const matches = (re, text) => [...text.matchAll(new RegExp(re.source, 'gi'))];
const escaped = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function entityPattern(name) {
  if (/^(?:laborator(?:y|ies)|labs?)$/i.test(name)) return /\b(?:laborator(?:y|ies)|labs?)\b/i;
  // Instrumentation and physical instruments are the same equipment; an "instrumentation amplifier" or "assessment instruments" are not.
  if (/^instrumentation$/i.test(name)) return new RegExp(String.raw`\binstrumentation\b${HEAD_NOUN}|\b${QUALIFIED} instruments?\b`, 'i');
  const words = name.split(/\s+/).map(w => {
    const singular = w.length > 4 && /s$/i.test(w) ? w.slice(0, -1) : w;
    return escaped(singular) + (singular.length > 3 ? 's?' : '');
  });
  return new RegExp('\\b' + words.join('\\s+') + '\\b', 'i');
}
// Materials can be a proposal, a subject of discussion, or an assertion about an existing aid. A noun alone is not an availability claim.
// `negated`: the draft side decides negation itself (negatedInDraft); lesson evidence keeps statusAt's reading.
function materialIntent(clause, match, negated = null) {
  const state = statusAt(clause, match);
  if (negated ?? state === 'unavailable') return 'negated';
  if (state === 'unknown') return 'uncertain';
  const prefix = clause.slice(Math.max(0, clause.lastIndexOf(',', match.index - 1) + 1), match.index);
  const suffix = clause.slice(match.index + match[0].length);
  if (/^notes$/i.test(match[0]) && (/^\s+(?:that|how|whether)\b/i.test(suffix) || /\b(?:take|taking)\s*$/i.test(prefix))) return 'topic';
  if (/^notes$/i.test(match[0]) && /\b(?:instructor|teacher|faculty|model|author|checker)\s*$/i.test(prefix) && !/^\s+(?:is|are|will|have|has)\b/i.test(suffix)) return 'topic';
  if (/\b(?:whether|check if|confirm if|verify if)\b[^,;]{0,40}$/i.test(prefix)) return 'uncertain';
  const existing = /\b(?:existing|supplied|provided|available|accessible|pre[- ]?prepared)\s+(?:(?:the|a|an)\s+)?$/i.test(prefix) || /^(?:the|these|those|existing|provided|available) notes$/i.test(match[0]) && /^(?:existing|provided|available)/i.test(match[0]);
  const availability = /^\s*(?:(?:access|availability)\s+)?(?:(?:is|are|remain|remains|will be|has been|have been)\s+)?(?:(?:already|readily|explicitly)\s+)?(?:available|accessible|provided|supplied|on hand)\b/i.test(suffix);
  if (existing || availability) return 'assumed';
  // Read the governing action nearest THIS material. Preparing one aid does not authorize using another existing aid later in the clause.
  const actions = [...prefix.matchAll(/\b(?:prepare|prepares|preparing|create|creates|creating|draft|drafts|drafting|write|writes|writing|produce|produces|producing|compile|compiles|compiling|provide|provides|providing|develop|develops|developing|use|uses|using|consult|consults|read|reads|access|accesses|from|with)\b/gi)];
  const action = actions.at(-1);
  const creator = /\b(?:faculty|teachers?|instructors?|students?|learners?)\b/i.test(prefix) || /^\s*[-*]?\s*(?:(?:then|please)\s+)?(?:prepare|create|draft|write|produce|compile|provide|develop)\b/i.test(prefix);
  if (action && !/^(?:use|uses|using|consult|consults|read|reads|access|accesses|from|with)$/i.test(action[0]) && creator && prefix.length - action.index < 100) return 'proposed';
  if (/^\s+(?:(?:that|which)\s+)?(?:(?:the\s+)?(?:faculty|teacher|instructor)\s+(?:could|can|may|should|will|would)\s+(?:prepare|create|write|provide)|(?:to be|are to be|is to be|will be)\s+(?:prepared|created|written)\s+by\s+(?:the\s+)?(?:faculty|teacher|instructor))\b/i.test(suffix)) return 'proposed';
  // Given or sample data, or data the faculty supplies, is a faculty-created resource. Data that is only analysed or interpreted may exist or
  // may be proposed. Data a learner uses or reads is assumed to exist, as any other material.
  if (IS_DATA.test(match[0])) {
    if (/^(?:given|sample|(?:instructor|faculty|teacher)[- ])/i.test(match[0])) return 'proposed';
    const governor = [...prefix.matchAll(/\b(?:use|uses|using|consult|consults|read|reads|access|accesses|refer to|from|with|based on|analy[sz]\w*|interpret\w*|examin\w*|compar\w*|evaluat\w*)\b/gi)].at(-1);
    if (!governor || /^(?:analy|interpret|examin|compar|evaluat)/i.test(governor[0])) return 'uncertain';
  }
  if (/^\s*[-*]?\s*(?:explain|discuss|describe|compare|analy[sz]e|trace|illustrate)\b/i.test(prefix) && !/\b(?:students?|learners?)\s+(?:use|consult|read|access)\b/i.test(prefix)) return 'topic';
  if (/\b(?:could|may|might|consider)\b[^,;]{0,25}\b(?:use|using|consult|read)\b[^,;]{0,20}$/i.test(prefix)) return 'uncertain';
  if (/\b(?:use|uses|using|consult|consults|read|reads|access|accesses|refer to|from|with|without|based on)\b[^,;]{0,65}$/i.test(prefix)) return 'assumed';
  return 'uncertain';
}
function statusAt(clause, match) {
  const prefix = clause.slice(Math.max(clause.lastIndexOf(',', match.index - 1) + 1, 0), match.index);
  const suffix = clause.slice(match.index + match[0].length).split(',')[0];
  if (/\bnot\s*$|\bnot have\s+(?:(?:an?|the|any)\s+)?$/i.test(prefix)) return 'unavailable';
  if (/^\s*(?:is|are)?\s*not (?:required|necessary)\b/i.test(suffix)) return 'unknown';
  if (/\b(?:without|no|not using|not (?:use|need|require|add|introduce|include|build|implement|create|perform|write)|avoid|instead of|no access to)\s+(?:(?:an?|the|any|additional|required|speciali[sz]ed|physical|actual)\s+){0,4}$/i.test(prefix) || /^\s*(?:is|are|remains?)?\s*(?:unavailable|not available|not provided|not permitted|cannot be accessed)\b/i.test(suffix)) return 'unavailable';
  if (/\b(?:unknown|uncertain|unconfirmed|unverified|not established|cannot confirm|no (?:information|confirmation|evidence) (?:about|of|on)|no confirmed|to be confirmed)\s*:?\s*(?:(?:the|an?|whether|access|to)\s+){0,4}$/i.test(prefix) || /^\s*(?:access|availability)?\s*(?:is|are|remains?)?\s*(?:unknown|uncertain|unconfirmed|unverified|not known|not confirmed|not established|not specified|not stated)\b/i.test(suffix)) return 'unknown';
  return 'stated';
}
// A condition attached to a resource or to its list: "oscilloscopes if available", "bench components and instrumentation if faculty-confirmed
// available", "(if available)", "subject to faculty confirmation". A negative condition ("if not available") does not match.
const POSTFIX_CONDITION = new RegExp(String.raw`^\s*[(,]?\s*(?:only\s+)?(?:(?:if|where|when|provided(?:\s+that)?)\s+(?:(?:it|they|these|this|one)\s+(?:is|are)\s+)?` +
  String.raw`(?:(?:(?:faculty|instructor|teacher|department|school)[- ])?(?:confirmed|approved|verified)\s+(?:as\s+|to\s+be\s+)?)?(?:available|accessible|provided|permitted|confirmed)` +
  String.raw`|if\s+(?:the\s+)?(?:faculty|instructor|teacher|department|school)\s+(?:confirms?|approves?|verifies)` +
  String.raw`|subject\s+to\s+(?:(?:the\s+)?(?:faculty|instructor|teacher|department|school)(?:'s)?\s+)?(?:availability|confirmation|approval|permission))\b`, 'i');
const GENERAL_CONDITION = /\b(?:required resources|resource availability|faculty confirmation|appropriate facilities|faculty[- ]confirm\w*|(?:faculty|instructor|teacher|department)\s+(?:confirms?|approves?|verifies))\b/i;
const ARTICLE = String.raw`(?:(?:an?|the|any|some)\s+)?`;
const COMMA = new RegExp(String.raw`^\s*,\s*${ARTICLE}$`, 'i'), AND = new RegExp(String.raw`^\s+(?:and|or|nor)\s+${ARTICLE}$`, 'i'), COMMA_AND = new RegExp(String.raw`^\s*,\s*(?:and|or|nor)\s+${ARTICLE}$`, 'i');
const LOOSE_GAP = new RegExp(String.raw`^(?:\s*,\s*(?:(?:and|or|nor)\s+)?|\s+(?:and|or|nor|and/or|as well as|plus)\s+)${ARTICLE}(?:[\w-]+\s+){0,2}$`, 'i');
// Every resource named in a clause; where two overlap, the longer ("laboratory instrumentation", not "laboratory").
function resourceSpans(clause) {
  const spans = [];
  for (const m of RESOURCES.flatMap(([, re]) => matches(re, clause)).sort((a, b) => a.index - b.index || b[0].length - a[0].length)) {
    if (!spans.length || m.index >= spans.at(-1).end) spans.push({ start: m.index, end: m.index + m[0].length });
  }
  return spans;
}
// Draft side, read strictly: where the list this resource begins ends ("breadboards, multimeters and oscilloscopes"). A bare comma joins items
// only once a later "and"/"or" closes the list, and ", and" only after an earlier comma, so a following clause is never absorbed.
function listEnd(clause, match) {
  const spans = resourceSpans(clause), own = spans.find(s => s.start <= match.index && match.index < s.end), before = own && spans.filter(s => s.end <= own.start).at(-1);
  let end = Math.max(own ? own.end : 0, match.index + match[0].length), last = end, commas = before && COMMA.test(clause.slice(before.end, own.start)) ? 1 : 0;
  for (const span of spans) {
    if (span.start < last) continue;
    const gap = clause.slice(last, span.start);
    if (COMMA.test(gap)) { commas++; last = span.end; }
    else if (AND.test(gap) || (commas && COMMA_AND.test(gap))) { commas = 0; end = last = span.end; }
    else break;
  }
  return end;
}
// Draft side: a resource the draft rules out ("do not use breadboards or oscilloscopes", "instead of using an oscilloscope", "breadboards and
// oscilloscopes are not needed") is not proposed, so it is neither withheld nor flagged. The negation covers the list it governs, read as strictly
// as a condition (listEnd), so "but use …" or the next clause stays outside it. A negation that is itself negated demands the resource ("students
// cannot complete the test without an oscilloscope"), so it rules nothing out. Lesson evidence keeps statusAt's reading.
const NOT_USED = new RegExp(String.raw`(?:\bnot|n't|\bnever|\bcannot|\bwithout|\bno|\bneither|\black(?:s|ing)?|\binstead\s+of|\brather\s+than|\bavoid(?:s|ing)?)` +
  String.raw`(?:\s+(?:ask|asking|require|requiring|expect|expecting)\s+(?:students|learners|them)\s+to)?(?:\s+(?:have|has|need|needs|needing|required|expected|asked)\s+to)?` +
  String.raw`(?:\s+(?:use|uses|using|need|needs|needing|require|requires|requiring|rely\s+on|relying\s+on|depend\s+on|access|accessing|book|reserve|bring|add|introduce|include|build|implement|create|perform|write|(?:have|has)\s+access\s+to|have|[a-z]+ing\s+(?:with|on|in|using|from|via|through))|\s+access\s+to|\s+need\s+(?:for|of))?` +
  String.raw`\s+(?:(?:an?|the|any|additional|required|speciali[sz]ed|physical|actual|real)\s+){0,4}$`, 'i');
// "Not used" needs its verb ("oscilloscopes are not used"); without one it may describe a resource the draft still uses ("an oscilloscope not used before").
const NOT_NEEDED = /^\s*(?:(?:is|are|remains?)\s+)?(?:not\s+(?:needed|required|necessary|available|provided|permitted)|unnecessary|unavailable|cannot be accessed)\b|^\s*(?:(?:is|are)\s+not|will\s+not\s+be|need\s+not\s+be)\s+(?:used|needed|required)\b/i;
const DOUBLE_NEGATIVE = /\b(?:not|never|cannot|unable|impossible)\b|n't\b/i;
function ruledOut(clause, span) {
  const head = { index: span.start, 0: clause.slice(span.start, span.end) }, prefix = clause.slice(Math.max(clause.lastIndexOf(',', span.start - 1) + 1, 0), span.start);
  const cue = NOT_USED.exec(prefix);
  if (cue) return !DOUBLE_NEGATIVE.test(prefix.slice(0, cue.index).split(/\b(?:and|or|but|then|so|while|whereas)\b/i).at(-1));
  return statusAt(clause, head) === 'unavailable' || NOT_NEEDED.test(clause.slice(listEnd(clause, head)).split(',')[0]);
}
function negatedInDraft(clause, match) {
  const spans = resourceSpans(clause), own = spans.find(s => s.start <= match.index && match.index < s.end) || { start: match.index, end: match.index + match[0].length };
  return [own, ...spans.filter(s => s.start < own.start)].some(s => (s === own || listEnd(clause, { index: s.start, 0: clause.slice(s.start, s.end) }) >= own.end) && ruledOut(clause, s));
}
// Evidence side, read loosely ("no bench components or digital multimeters are available"). A loose reading only ever weakens evidence:
// a negation or condition that may cover a resource is taken to cover it.
function listAround(clause, match) {
  const spans = resourceSpans(clause), i = spans.findIndex(s => s.start <= match.index && match.index < s.end);
  if (i < 0) return { start: match.index, end: match.index + match[0].length };
  let a = i, b = i;
  while (a > 0 && LOOSE_GAP.test(clause.slice(spans[a - 1].end, spans[a].start))) a--;
  while (b < spans.length - 1 && LOOSE_GAP.test(clause.slice(spans[b].end, spans[b + 1].start))) b++;
  return { start: spans[a].start, end: Math.max(spans[b].end, match.index + match[0].length) };
}
// Evidence side: a resource's status read together with its list ("no bench components or measurement instruments are available").
function listStatus(clause, match) {
  const { start, end } = listAround(clause, match), states = [statusAt(clause, match), statusAt(clause, { index: start, 0: clause.slice(start, end) })];
  return states.includes('unavailable') ? 'unavailable' : states.includes('unknown') ? 'unknown' : 'stated';
}
function conditionalFor(clause, re, kind, evidence = false) {
  if (matches(re, clause).some(m => POSTFIX_CONDITION.test(clause.slice(evidence ? listAround(clause, m).end : listEnd(clause, m))))) return true;
  const m = /\b(?:if|where|provided that)\b([^,;.\n]{0,150}\b(?:available|accessible|provided|confirmed|verified|permitted)\b[^,;.\n]{0,15})|\bsubject to\b([^,;.\n]{0,100}\b(?:availability|confirmation|permission)\b)/i.exec(clause);
  const condition = m && (m[1] || m[2]);
  if (!condition || /\b(?:no|not|unavailable)\b/i.test(condition)) return false;
  if (re.test(condition)) return true;
  // A general condition, or one about a family of equipment, covers the clause, unless it is written right after the resource it belongs to.
  const attached = resourceSpans(clause).some(s => s.end <= m.index && /^\s*[(,]?\s*(?:only\s+)?$/.test(clause.slice(s.end, m.index)));
  return !attached && (GENERAL_CONDITION.test(condition) || (kind === 'equipment' && EQUIPMENT_FAMILY.test(condition)));
}
// Old dataset context and new pair builders both label the course credits; neither proves actual resource access.
const withoutUnits = text => String(text || '').replace(/^(?:Contact units stated by the syllabus|Course-wide contact units)[^\n]*/gim, '');
function availabilityEvidence(pair) {
  // Stage C3: a link is judged on its two texts alone, and its recommendation may use only what either of them states (stages.js C3.tests), so both
  // texts are its evidence. The heading the engine adds ("Week 3 course content:") is not.
  if (CHAIN_TYPES.has(pair.type)) return [pair.source, pair.target].map(text => ({ text: String(text || '').replace(/^Week [^:\n]*:\s*/, ''), inventory: false }));
  // An ILO's demand or a course-content topic is not an inventory. Actual lesson activities and explicit resource statements are the evidence.
  const fields = [], source = withoutUnits(pair.source);
  let inField = false, inventory = false;
  for (const line of source.split('\n')) {
    const field = /^(?:Learning activities|Resources?|Equipment|Facilities|Software|Availability|Access|Instructional resources)\s*:\s*(.*)$/i.exec(line);
    if (field) { inField = true; inventory = !/^Learning activities\s*:/i.test(line); fields.push({ text: field[1], inventory }); }
    else if (/^[\w][^:]{0,90}:/.test(line)) inField = false;
    else if (inField) fields.push({ text: line, inventory });
  }
  if (pair.type === 'Activity-fit') fields.push({ text: String(pair.target || ''), inventory: false });
  return fields;
}
const availabilityGround = pair => availabilityEvidence(pair).map(f => f.text).join('\n');
function resourceState(re, ground, kind) {
  const all = clauses(ground), found = all.flatMap(c => matches(re, c).map(m => conditionalFor(c, re, kind, true) ? 'unknown' : listStatus(c, m)));
  if (found.includes('unavailable')) return 'unavailable'; // contradictory availability statements require faculty review
  if (found.includes('stated')) return 'stated';
  // "No measurement instruments are available" also rules out an oscilloscope, though only the oscilloscope itself can establish one.
  if (kind === 'equipment' && all.some(c => matches(EQUIPMENT_FAMILY, c).some(m => listStatus(c, m) === 'unavailable'))) return 'unavailable';
  return 'unknown';
}
function materialState(re, evidence) {
  const found = evidence.flatMap(f => clauses(f.text).flatMap(c => matches(re, c).map(m => {
    if (conditionalFor(c, re, 'instructional material', true)) return 'unknown';
    const state = listStatus(c, m);
    if (state !== 'stated') return state;
    const intent = materialIntent(c, m);
    const planned = intent === 'proposed' && !/\b(?:could|may|might|should|consider|propos\w*)\b/i.test(c);
    const listed = f.inventory && intent === 'uncertain' && !/\b(?:whether|could|may|might|should|consider|confirm|check|verify|potential|possible|suggested|proposed|pending|needed)\b/i.test(c);
    return intent === 'assumed' || planned || listed ? 'stated' : 'unknown';
  })));
  if (found.includes('unavailable')) return 'unavailable';
  return found.includes('stated') ? 'stated' : 'unknown';
}
function resourceNotes(text, pair) {
  const evidence = availabilityEvidence(pair), ground = evidence.map(f => f.text).join('\n'), out = [];
  for (const [kind, re] of RESOURCES) {
    for (const clause of clauses(text)) {
      for (const match of matches(re, clause)) {
        // An anaphoric "the notes" may refer to earlier syntax/lecture notes in this draft. It never borrows evidence from another pair.
        const priorNotes = [...String(text).slice(0, String(text).indexOf(clause) + match.index).matchAll(/\b(?:syntax|lecture|class|course|study|reference) notes?\b/gi)].at(-1);
        const name = /^(?:(?:the|these|those|existing|provided|available) )?notes$/i.test(match[0]) ? priorNotes?.[0] || 'notes' : match[0];
        const entity = entityPattern(name), material = kind === 'instructional material';
        // Negation is scoped to this resource and the list it heads, not to an unrelated 'without' or 'no' elsewhere in the sentence.
        if (negatedInDraft(clause, match)) continue;
        const conditional = conditionalFor(clause, entity, kind), intent = material && materialIntent(clause, match, false);
        if (!material && statusAt(clause, match) === 'unknown' && !conditional) continue;
        const state = material ? materialState(entity, evidence) : resourceState(entity, ground, kind);
        if (state === 'stated') continue;
        if (material && intent === 'proposed') out.push({ code: 'proposed_resource', evidence: match[0], advisory: true });
        else if (state === 'unknown' && conditional) out.push({ code: 'conditional_resource', evidence: match[0], advisory: true });
        else if (material && intent === 'topic') continue;
        // Explicit unavailability is never softened, by a condition or by a hedge.
        else if (material && intent === 'uncertain' && state !== 'unavailable') out.push({ code: 'resource_needs_confirmation', evidence: match[0], advisory: true });
        else out.push({ code: 'assumes_resource', evidence: match[0] });
      }
    }
  }
  return out.filter((n, i) => out.findIndex(p => p.code === n.code && p.evidence.toLowerCase() === n.evidence.toLowerCase()) === i);
}
const PRACTICAL_ADDITION = /\b(?:laboratory (?:practice|testing|work|sessions?)|hands[- ]on (?:practice|work|coding|testing)|(?:write|build|implement|develop|run|test)(?:\s+[\w'-]+){0,7}\s+(?:programs?|applications?|circuits?|prototypes?)|(?:programs?|circuits?|prototypes?)(?:\s+[\w'-]+){0,5}\s+(?:build|implement|run|test))\b/i;
const EXTRA_SCOPE = /\b(?:complete|full[- ]scale|production[- ]ready)\s+(?:applications?|systems?|platforms?)\b|\b(?:databases?|user interfaces?|deploy(?:ment)?|capstone|fieldwork|field trips?|external interviews?)\b/i;
function performanceAdded(text) {
  for (const clause of clauses(text)) {
    const added = PRACTICAL_ADDITION.exec(clause);
    if (!added) continue;
    if (statusAt(clause, added) !== 'stated') continue;
    if (/\b(?:laboratory (?:practice|testing|work|sessions?)|hands[- ]on (?:practice|work|coding|testing))\b/i.test(clause) ||
      !/\b(?:teacher|instructor|demonstrat\w*|worked examples?)\b/i.test(clause) || /\b(?:students|learners)\b/i.test(clause)) return added;
  }
  return null;
}
function lessonDraftNotes(j, pair) {
  if (!LESSON_TYPES.has(pair.type)) return [];
  const draft = String(j.draft || ''), out = resourceNotes(draft, pair), demand = competencyOf(pair.source);
  // A target activity may already be a legitimate demonstration; only a newly introduced performance is a hint of expansion.
  const prior = `${demand.text}\n${pair.target || ''}`, added = performanceAdded(draft);
  if (demand.conceptualOnly && added && !performanceAdded(prior)) out.push({ code: 'unnecessary_practical', evidence: added[0] });
  const expanded = clauses(draft).flatMap(c => matches(EXTRA_SCOPE, c).filter(m => statusAt(c, m) === 'stated')).find(m => !entityPattern(m[0]).test(pair.source || ''));
  if (expanded) out.push({ code: 'expands_competency', evidence: expanded[0] });
  for (const clause of clauses(draft)) {
    const contact = /\b(?:interview|invite|contact|visit|meet with|recruit)\b[^.;\n]{0,70}\b(?:stakeholders?|clients?|experts?|industry partners?|employers?|alumni|guest speakers?)\b/i.exec(clause);
    if (contact && statusAt(clause, contact) === 'stated' && !/\b(?:interview|invite|contact|visit|meet with|recruit)\b/i.test(availabilityGround(pair))) out.push({ code: 'adds_participant', evidence: contact[0] });
  }
  return out;
}
function lessonExplanationNotes(j, pair) {
  if (!LESSON_TYPES.has(pair.type)) return [];
  const text = String(j.explanation || ''), demand = competencyOf(pair.source), out = [];
  // A model may discuss practical alternatives without demanding them. Only explicit necessity or the saved course-unit override is reviewed.
  const requirement = /\b(?:must|requires?|required|needs?|necessary)\b[^.;\n]{0,100}\b(?:laboratory|hands[- ]on|coding|practical work)\b|\b(?:laboratory|hands[- ]on|coding|practical work)\b[^.;\n]{0,70}\b(?:required|necessary|must)\b|\b(?:laboratory|lab)\s+\d+\s+for this lesson\b/i.exec(text);
  const requirementPrefix = requirement && text.slice(Math.max(0, requirement.index - 30), requirement.index);
  const negatedRequirement = requirement && (/\b(?:not|never|doesn't|does not|cannot)\s+(?:\w+\s+){0,2}$/i.test(requirementPrefix) || /\bnot\s+(?:strictly\s+)?(?:required|necessary)\b/i.test(requirement[0]));
  if (demand.conceptualOnly && requirement && !negatedRequirement) out.push({ code: 'practical_requirement', evidence: requirement[0] });
  const assumed = /\b(?:available|provided|equipped|accessible)\b[^.;\n]{0,60}\b(?:laboratory|equipment|simulator|software)\b|\b(?:laboratory|equipment|simulator|software)\b[^.;\n]{0,60}\b(?:is|are)\s+(?:available|provided|accessible)\b/i.exec(text);
  const context = assumed && clauses(text).find(c => c.includes(assumed[0]));
  if (assumed && !UNKNOWN.test(context) && !UNAVAILABLE.test(context) && !CONDITIONAL.test(context)) {
    if (resourceNotes(assumed[0], pair).some(n => !n.advisory)) out.push({ code: 'resource_assumption', evidence: assumed[0] });
  }
  return out;
}
// ---- Stage C3: one link of the weekly chain (Content-activity, Content-assessment, Activity-assessment) ----
// The C3 wording (stages.js C3.tests) asks for ONE sentence that says what to change in the activities or the tasks, using only topics and kinds of
// work the two texts already state; never a rewrite, never an added resource, tool, participant, product or requirement, and never a request to assess
// an ILO: the outcomes are judged in other relationships. Each note is read against the link's two texts alone.
//   asks_for_outcome   the recommendation asks the activities or tasks to address an ILO, a CLO, a PO, an EGA or a learning outcome
//   adds_scope         it adds project or system scope (a complete application, a database, a deployment, fieldwork...) neither text states
//   not_one_sentence   (advisory) more than one sentence, or a list: a replacement text rather than one recommendation
//   resource notes     what resourceNotes finds, with the two texts as the evidence (availabilityEvidence)
// The explanation:
//   cites_outcome      it rests the judgement on an ILO, a CLO or another outcome, which this link must neither raise nor lower its label for
const OUTCOME_TERMS = [/\b(?:ILO|CLO|PO|EGA)s?\b/g, /\b(?:intended\s+)?(?:learning|course|program|programme)\s+outcomes?\b/gi];
// A phrase that sets the outcome aside ("the ILO is judged in another relationship", "without changing the ILO") is not a claim about it. Only the
// phrase around the mention is read (up to the nearest commas), so "practise no parameters, so the ILO is only partly met" still counts.
const OUTCOME_ASIDE = /\b(?:not|never|no|without|neither|nor|separately|elsewhere|(?:an)?other relationships?|outside|rather than|instead of)\b|n't\b/i;
function outcomeNamed(text, ground) {
  for (const clause of clauses(text)) for (const re of OUTCOME_TERMS) for (const m of clause.matchAll(re)) {
    const end = clause.indexOf(',', m.index + m[0].length), phrase = clause.slice(clause.lastIndexOf(',', m.index) + 1, end < 0 ? clause.length : end);
    if (!OUTCOME_ASIDE.test(phrase) && !new RegExp(`\\b${escaped(m[0])}\\b`, 'i').test(ground)) return m[0];
  }
  return null;
}
// A list marker, a second line or a second sentence. "e.g. the" is not a sentence break: a break needs a capital or a digit after it.
const SEVERAL = /^\s*(?:[-•*]|\d+[.)])\s|\n\s*\S|[.!?]["')\]]?\s+(?=["'(]?[A-Z0-9])/;
function chainDraftNotes(j, pair) {
  if (!CHAIN_TYPES.has(pair.type)) return [];
  const draft = String(j.draft || '').trim(), ground = `${pair.source || ''}\n${pair.target || ''}`, out = resourceNotes(draft, pair);
  const outcome = outcomeNamed(draft, ground);
  if (outcome) out.push({ code: 'asks_for_outcome', evidence: outcome });
  const scope = clauses(draft).flatMap(c => matches(EXTRA_SCOPE, c).filter(m => statusAt(c, m) === 'stated')).find(m => !entityPattern(m[0]).test(ground));
  if (scope) out.push({ code: 'adds_scope', evidence: scope[0] });
  const several = SEVERAL.exec(draft);
  if (several) out.push({ code: 'not_one_sentence', evidence: draft.slice(Math.max(0, several.index - 30), several.index + several[0].length + 30).trim(), advisory: true });
  return out;
}
function chainExplanationNotes(j, pair) {
  if (!CHAIN_TYPES.has(pair.type)) return [];
  const outcome = outcomeNamed(String(j.explanation || ''), `${pair.source || ''}\n${pair.target || ''}`);
  return outcome ? [{ code: 'cites_outcome', evidence: outcome }] : [];
}
module.exports = { lessonDraftNotes, lessonExplanationNotes, chainDraftNotes, chainExplanationNotes, resourceNotes, availabilityGround, withoutUnits, resourceState, LESSON_TYPES, RESOURCE_REVIEW_VERSION };
