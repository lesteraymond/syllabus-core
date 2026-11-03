'use strict';
// Recommendation contract lcup-v2-recommendation-2 for the seven Policy V2 weekly relationships (POLICY.weeklyTypes). Evaluation only and never
// official: it is off unless an evaluation names it (gemini.js align, options.recommendation), and the baseline is the contract the Policy V2
// request already has, unchanged.
//
// Why: in the Policy V2 Claude smoke (docs/lcup-v2-evaluation/live-smoke-REVIEWED) a failing Content-ILO answer could only be an ILO rewrite. The
// pair-local draft rule (gemini.js PROMPT) and the contract (REVIEW_REQUIRED is refused for a rewritable relationship) allowed no other answer, and
// the request held only the two texts of the pair. The IT 202 draft dropped the printed [CLO1] label; the IE 402 draft turned the plan's only
// spirituality ILO into an orientation outcome; the CpE 304 draft narrowed an ILO that Weeks 7-8 also state.
//
// What it changes, inside the same request (no other stage, checker or relationship):
//   context   recommendation_context, copied by code from the syllabus for each weekly relationship of the request: the week's whole row, the fields
//             a correction may name, other weeks that state the same ILO, the CLOs the ILO is mapped to (PO and EGA mappings, the reference wording
//             only where academicV2Plan.referencesFor finds the reference usable) with every ILO mapped to each, and for Content-ILO an outline of
//             the plan. Never the whole syllabus, and never evidence for a label.
//   contract  a failing answer names the field its correction belongs to (correctionField) and why (correctionReason), and may ask for faculty review
//             instead of a rewrite (REVIEW_REQUIRED, which the baseline refuses for a rewritable relationship).
//   checks    deterministic, after every refusal check of gemini.js checkOne. A REWRITE_TEXT draft is withheld (draftReview), and the decision becomes
//             REVIEW_REQUIRED, when its field allows no draft, or the draft changes the ILO number or a printed outcome label, loses a term the ILO
//             shares with a CLO it is mapped to, or cuts text from a field the relationship does not own. An ILO stated in another week allows no
//             draft at all. Nothing here refuses an answer or reads its label, quotes, Bloom levels or explanation, so the judgement is exactly what
//             the baseline processing makes of the same answer. Nothing is ever applied automatically.
// The word checks are lexical (the stemming of gemini.js draftReviewOf): they can hold a sound draft for faculty review, and they cannot show that an
// offered draft is academically right.
const { POLICY, referencesFor } = require('./academicV2Plan');
const v2Activation = require('./academicV2Activation');
const { examLike, brief } = require('./planrows');
const { stems } = require('./answerReview');

const VERSION = 'lcup-v2-recommendation-2';
const FAILING = ['PARTIALLY_ALIGNED', 'NOT_ALIGNED'];
const FIELDS = ['none', 'course_content', 'ilo', 'learning_activity', 'assessment_task', 'clo_mapping', 'ilo_week', 'undetermined'];
// The fields a correction of each weekly relationship may name: the two texts it relates, the ILO's CLO tag (ILO-CLO) and the ILO's week
// (Content-ILO). A field's draft is full (the complete revised text of that field), sentence (the one-sentence advice of a Stage C3 link, never a
// replacement text) or none (no draft: the faculty decide, and `because` says why).
const SCOPE = {
  'Content-course': [['course_content', 'full']],
  'Content-ILO': [['ilo', 'full'], ['course_content', 'full'], ['ilo_week', 'none', 'relocation_needs_faculty_decision']],
  'ILO-CLO': [['ilo', 'full'], ['clo_mapping', 'none', 'mapping_needs_faculty_decision']],
  'ILO-activity': [['learning_activity', 'full'], ['ilo', 'none', 'ilo_also_serves_its_content_and_clo_links']],
  'Content-activity': [['course_content', 'sentence'], ['learning_activity', 'sentence']],
  'Content-assessment': [['course_content', 'sentence'], ['assessment_task', 'sentence']],
  'Activity-assessment': [['learning_activity', 'sentence'], ['assessment_task', 'sentence']],
};
const ILO_FIELDS = new Set(['ilo', 'clo_mapping', 'ilo_week']);
const ILO_TARGETS = new Set(['Content-ILO', 'ILO-CLO']), CLO_CONTEXT = new Set(['Content-ILO', 'ILO-CLO', 'ILO-activity']);
const ROW_FIELD = { course_content: 'contents', learning_activity: 'activities', assessment_task: 'tasks' };
const pathOf = (field, i, j) => (ROW_FIELD[field] ? `plan[${i}].${ROW_FIELD[field]}` : field === 'ilo' ? `plan[${i}].ilos[${j}].text` : field === 'clo_mapping' ? `plan[${i}].ilos[${j}].tags` : `plan[${i}].ilos[${j}]`);
const MAX_LISTED = 12, MAX_SAME_WEEKS = 4;

const flat = text => String(text ?? '').replace(/\s+/g, ' ').trim();
// Printed outcome labels ("[CLO1]", "[CLO 4]", "[CLO 1-2]", "(CLO 2, CLO 3)", "[PO 1]") and the ILO number the author wrote ("ILO 1:", "ILO10:").
const LABEL = /[[(]\s*(?:CLO|PO|EGA)\s*\d+(?:\s*(?:,|&|\/|-|–|and)\s*(?:(?:CLO|PO|EGA)\s*)?\d+)*\s*[\])]/gi;
const NUMBER = /^\s*(I?LO\s*(\d+)\s*[:.)]?)/i;
const labelsOf = text => (String(text ?? '').match(LABEL) || []).map(flat);
const labelKey = label => label.replace(/\s+/g, '').toUpperCase();
const numberOf = text => NUMBER.exec(String(text ?? ''))?.[2] ?? null;
const prefixOf = text => { const m = NUMBER.exec(String(text ?? '')); return m ? flat(m[1]) : null; };
// The outcome itself, without its number and labels: two weeks state the same ILO when these agree.
const statementOf = text => flat(String(text ?? '').replace(LABEL, ' ').replace(NUMBER, ' ')).toLowerCase();
const sameStatement = (a, b) => !!a && a.split(' ').length >= 3 && a === b;
// Content words, lightly stemmed as the static draft checks of gemini.js stem them; a final e is dropped so "value" and "values" agree. Topic terms
// leave out action verbs, which a correction may legitimately change (the ILO-CLO test lets an ILO's level build toward its CLO's).
const termKey = stem => stem.replace(/e$/, '');
const topicTerms = text => new Set([...require('./gemini').topicStems(text)].map(termKey)); // late import: gemini.js loads this module from align
const allTerms = text => new Set([...stems(text)].map(termKey));

const PROMPT = `
Recommendation contract ${VERSION} (faculty-review advisory; never automatically applied). The request also carries "recommendation_context": facts copied by code from this syllabus for the relationships named in its "pairs". Each entry names the week's row (its whole text is in "rows", with every ILO of that week and the ILO's CLO tags) and the fields a correction may name ("fields"). For an ILO it also gives its printed number and labels ("printed"), other weeks that state the same ILO ("sameIloOtherWeeks"), other statements that carry the same ILO number ("sameNumberOtherStatements"), and the CLOs it is mapped to ("clos": statement, level, PO and EGA mappings, the reference wording only where that reference is usable, and every ILO mapped to the CLO). A request with a Content-ILO relationship also has "planOutline". This context is evidence for the recommendation only: judge the label, the quotes, the Bloom levels and the explanation exactly as before, from each pair's own source and target. Never quote recommendation_context, never let it raise or lower a label, and mention what it shows only in correctionReason.
For every relationship named in recommendation_context.pairs these rules replace the earlier draft and recommendation rules:
- A PARTIALLY_ALIGNED or NOT_ALIGNED label does not show that the target text is the one to change. Decide where the mismatch lies, and set correctionField to one field of that relationship's "fields": course_content, ilo, learning_activity, assessment_task, clo_mapping (the ILO's CLO tag) or ilo_week (the week the ILO is taught in). Set undetermined when the evidence does not show which field should change; never name a field the list does not give.
- correctionReason, in one to three sentences, says from the supplied texts why that field is a reasonable place to correct and what a change elsewhere would affect, or why no safe correction can be determined.
- REWRITE_TEXT only when the evidence shows what to change and the field's "draft" is "full". The draft is then the complete revised text of THAT field, which is the pair's target only when the field is marked "target". Keep the ILO number and every printed [CLO n] label exactly as written; keep every competence the ILO shares with a CLO it is mapped to; and revise a field that is not the target only by adding to it, never removing what it states, because other relationships of the week rely on it.
- RETAG_OUTCOME only where the ILO-CLO test allows it, with correctionField clo_mapping and an empty draft: faculty review the tag, and nothing is re-tagged automatically.
- REVIEW_REQUIRED, with an empty draft, when the field's "draft" is "none" ("because" says why), when correctionField is ilo_week or undetermined, or when any rewrite could weaken a CLO, a mapping or another relationship of the week. Requesting faculty review instead of a rewrite is a complete and valid answer. A field whose "draft" is "sentence" keeps the one-sentence advice the earlier rules ask for.
- For ALIGNED and INSUFFICIENT_EVIDENCE, and for every relationship not named in recommendation_context.pairs, set correctionField to none and correctionReason to an empty string, and follow the earlier rules.
Name only weeks, fields, CLOs, POs and EGAs that the request supplies. Every correction is a proposal for faculty acceptance; nothing is applied automatically.`;

// The contract for one syllabus. The live application path is available only to the shared checker when its explicit Policy V2 flag is on and Claude
// is the configured, approved provider. Standalone evaluation still requires its isolated evaluation-only environment.
function prepare(content, masters, { version, academicPolicy, evaluationOnly, integratedAcademic, env, provider, recommend } = {}) {
  if (version !== VERSION) throw Error(`Unknown recommendation contract (${String(version).slice(0, 80)}); the only one is ${VERSION}.`);
  const integrated = v2Activation.integrated({ integratedAcademic, academicPolicy, evaluationOnly, env }, env || process.env);
  const isolatedEvaluation = evaluationOnly === true && !!env;
  if ((!integrated && !isolatedEvaluation) || provider !== 'anthropic' || academicPolicy !== POLICY.id || !recommend) throw Error(`${VERSION} needs an approved Claude request under ${POLICY.id} with its recommendation contract enabled.`);
  const plan = Array.isArray(content?.plan) ? content.plan : [], clos = Array.isArray(content?.clos) ? content.clos : [];
  const reference = referencesFor(content, masters);
  const ilos = plan.flatMap((row, i) => (Array.isArray(row?.ilos) ? row.ilos : []).map((ilo, j) => ({ i, j, ilo, week: String(row.week ?? ''), path: `plan[${i}].ilos[${j}].text`, text: String(ilo?.text ?? ''), statement: statementOf(ilo?.text), number: numberOf(ilo?.text) })));
  const cloOf = tag => { const k = clos.findIndex(clo => 'clo:' + clo?.id === tag); return k < 0 ? null : { clo: clos[k], title: flat(clos[k].title) || `CLO ${k + 1}` }; };
  const mappedOf = ilo => (Array.isArray(ilo?.tags) ? ilo.tags : []).filter(tag => typeof tag === 'string' && tag.startsWith('clo:')).map(cloOf).filter(Boolean);
  const cache = new Map();

  // The weekly relationship a pair is, its row and ILO, and the fields its correction may name; null for any other pair (it keeps the baseline).
  function scopeOf(pair) {
    if (cache.has(pair.id)) return cache.get(pair.id);
    const spec = SCOPE[pair.type], m = /^plan\[(\d+)\](?:\.ilos\[(\d+)\])?/.exec(String(pair.path || '')), i = m ? Number(m[1]) : -1, row = plan[i];
    let scope = null;
    if (spec && row && !examLike(row)) {
      const j = m[2] === undefined ? null : Number(m[2]), ilo = j === null ? null : row.ilos?.[j] ?? null, target = pair.targetPath || pair.path;
      const statement = ilo ? statementOf(ilo.text) : '', shared = ilo ? ilos.filter(o => !(o.i === i && o.j === j) && sameStatement(statement, o.statement)) : [];
      const fields = spec.filter(([field]) => !ILO_FIELDS.has(field) || ilo).map(([field, draft, because]) => {
        const path = pathOf(field, i, j), blocked = field === 'ilo' && draft === 'full' && shared.length ? 'shared_across_weeks' : null;
        return { field, path, draft: blocked ? 'none' : draft, ...(blocked || because ? { because: blocked || because } : {}), ...(path === target ? { target: true } : {}), original: String((ROW_FIELD[field] ? row[ROW_FIELD[field]] : ilo?.text) ?? '') };
      });
      scope = { type: pair.type, i, j, row, ilo, fields, shared, mapped: ilo ? mappedOf(ilo) : [] };
    }
    cache.set(pair.id, scope);
    return scope;
  }

  const rowCard = i => { const row = plan[i]; return { week: String(row.week ?? ''), contents: String(row.contents ?? ''), activities: String(row.activities ?? ''), tasks: String(row.tasks ?? ''), values: String(row.values ?? ''), ilos: (row.ilos || []).map((ilo, j) => ({ path: `plan[${i}].ilos[${j}].text`, text: String(ilo?.text ?? ''), clos: mappedOf(ilo).map(c => c.title) })) }; };
  // A CLO as the syllabus maps it. PO wording only when the PO reference is usable (otherwise the numbers, marked held); EGA names when the
  // institutional list is supplied. Every ILO mapped to the CLO, in plan order, so a correction can see what else carries its competence.
  function cloCard({ clo }) {
    const pos = Array.isArray(clo.pos) ? clo.pos : [], egas = Array.isArray(clo.egas) ? clo.egas : [], institutional = masters?.institution?.egas || [];
    const mapped = ilos.filter(o => Array.isArray(o.ilo?.tags) && o.ilo.tags.includes('clo:' + clo.id));
    return { level: clo.level || null, statement: String(clo.statement ?? ''), pos, poReference: reference.poUsable ? 'usable' : 'held',
      ...(reference.poUsable ? { poTexts: pos.map(no => ({ po: no, text: (masters.pos || []).find(p => p.no === no)?.text ?? null })) } : { poReferenceIssues: reference.issues.filter(issue => issue.code !== 'ega_reference_unavailable').map(issue => issue.code) }),
      egas: egas.map(no => ({ ega: no, name: reference.egaUsable ? institutional.find(e => e.no === no)?.name ?? null : null })), egaReference: reference.egaUsable ? 'usable' : 'unavailable',
      ilos: mapped.slice(0, MAX_LISTED).map(o => ({ week: o.week, path: o.path, text: o.text })), ...(mapped.length > MAX_LISTED ? { ilosNotListed: mapped.length - MAX_LISTED } : {}) };
  }
  // recommendation_context for the pairs of one request: only their rows and CLOs, each sent once. null when no pair of the request is weekly.
  function contextFor(pairs) {
    const out = { contract: VERSION, pairs: {}, rows: {}, clos: {} };
    let outline = false;
    for (const pair of pairs) {
      const s = scopeOf(pair);
      if (!s) continue;
      const entry = { row: `plan[${s.i}]`, fields: s.fields.map(({ field, path, draft, because, target }) => ({ field, path, draft, ...(because ? { because } : {}), ...(target ? { target } : {}) })) };
      if (s.ilo && ILO_TARGETS.has(s.type)) {
        const number = prefixOf(s.ilo.text), labels = labelsOf(s.ilo.text), digits = numberOf(s.ilo.text), statement = statementOf(s.ilo.text);
        entry.ilo = `plan[${s.i}].ilos[${s.j}].text`;
        if (number || labels.length) entry.printed = { ...(number ? { number } : {}), ...(labels.length ? { labels } : {}) };
        if (s.shared.length) {
          entry.sameIloOtherWeeks = s.shared.slice(0, MAX_SAME_WEEKS).map(o => ({ week: o.week, path: o.path, contents: String(plan[o.i].contents ?? '') }));
          if (s.shared.length > MAX_SAME_WEEKS) entry.sameIloMoreWeeks = s.shared.slice(MAX_SAME_WEEKS).map(o => o.week);
        }
        const renumbered = digits === null ? [] : ilos.filter(o => o.number === digits && o.statement !== statement);
        if (renumbered.length) entry.sameNumberOtherStatements = { number, weeks: [...new Set(renumbered.map(o => o.week))] };
      }
      if (s.ilo && CLO_CONTEXT.has(s.type)) {
        entry.clos = s.mapped.map(c => c.title);
        for (const c of s.mapped) if (!out.clos[c.title]) out.clos[c.title] = cloCard(c);
      }
      if (!out.rows[entry.row]) out.rows[entry.row] = rowCard(s.i);
      if (s.type === 'Content-ILO') outline = true;
      out.pairs[pair.id] = entry;
    }
    if (!Object.keys(out.pairs).length) return null;
    if (!Object.keys(out.clos).length) delete out.clos;
    if (outline) out.planOutline = plan.map(row => (examLike(row) ? `Week ${row.week}: EXAMINATION` : `Week ${row.week}: ${brief(row.contents)}`));
    return out;
  }

  // The deterministic checks of a full draft for its field ({ code, evidence } each).
  function draftChecks(entry, draft, scope) {
    const out = [], original = entry.original, kept = allTerms(draft);
    // The ILO number and every printed outcome label stay as the author wrote them: a label prints a mapping, which is not the AI's to drop.
    const lost = labelsOf(original).filter(label => !labelsOf(draft).some(found => labelKey(found) === labelKey(label)));
    const number = numberOf(original), renumbered = number !== null && numberOf(draft) !== number;
    if (lost.length || renumbered) out.push({ code: 'changes_printed_label', evidence: [...lost, ...(renumbered ? [prefixOf(original)] : [])].join(', ') });
    // An ILO keeps the terms it shares with each CLO it is mapped to: losing one could weaken a valid ILO-CLO relationship.
    if (entry.field === 'ilo') {
      const own = topicTerms(statementOf(original));
      for (const c of scope.mapped) {
        const gone = [...topicTerms(c.clo.statement)].filter(term => own.has(term) && !kept.has(term));
        if (gone.length) out.push({ code: 'weakens_mapped_clo', evidence: `${c.title}: ${gone.join(', ')}` });
      }
    }
    // A field the relationship does not own (the week's content, for a Content-ILO pair) serves the week's other relationships: add to it, never cut.
    if (!entry.target) {
      const gone = [...topicTerms(original)].filter(term => !kept.has(term));
      if (gone.length) out.push({ code: 'removes_field_content', evidence: gone.slice(0, 8).join(', ') });
    }
    return out;
  }
  // The correction of one verified answer: the field and path it concerns, the reason, the recommendation the contract accepted (stated) and the
  // decision after the checks. gemini.js checkOne merges `withheld` into draftReview and then calls settle. Never changes the judgement.
  function review(j, pair, scope, recommendation) {
    const named = typeof j.correctionField === 'string' ? j.correctionField : '', reason = typeof j.correctionReason === 'string' ? j.correctionReason.trim().slice(0, 2000) : '';
    const out = { contract: VERSION, stated: recommendation, decision: recommendation, field: 'none', path: null, target: false, reason, draftOffered: false, canAutoApply: false, withheld: [], checks: [], notes: [] };
    if (!FAILING.includes(j.label)) {
      if (named && named !== 'none') out.notes.push('field_without_correction');
      return out;
    }
    const entry = scope.fields.find(f => f.field === named) || null;
    if (!entry && named !== 'undetermined') out.notes.push(FIELDS.includes(named) ? 'field_outside_relationship' : 'invalid_correction_field');
    if (!reason) out.notes.push('missing_correction_reason');
    // A re-tag (allowed by the existing contract only where the ILO-CLO test allows it) always concerns the ILO's CLO tag, whatever field was named.
    if (recommendation === 'RETAG_OUTCOME' && named !== 'clo_mapping') out.notes.push('retag_names_another_field');
    const chosen = recommendation === 'RETAG_OUTCOME' ? scope.fields.find(f => f.field === 'clo_mapping') || entry : entry;
    Object.assign(out, { field: chosen ? chosen.field : 'undetermined', path: chosen ? chosen.path : null, target: !!chosen?.target });
    if (recommendation === 'REWRITE_TEXT') {
      const checks = !entry ? [{ code: 'correction_field_unidentified', evidence: named }] : entry.draft !== 'full' ? [{ code: entry.because || 'no_draft_for_field', evidence: entry.field }] : draftChecks(entry, String(j.draft || ''), scope);
      if (!reason) checks.push({ code: 'missing_correction_reason', evidence: '' });
      out.checks = checks;
      out.withheld = [...new Set(checks.map(c => c.code))];
    }
    return out;
  }
  return { version: VERSION, prompt: PROMPT, fields: FIELDS, scopeOf, contextFor, review, settle };
}
// The decision once every check has run (the baseline draft checks included): a held draft is not offered, and faculty review it instead.
function settle(correction, held) {
  correction.withheld = [...new Set(held)];
  if (correction.decision === 'REWRITE_TEXT' && correction.withheld.length) correction.decision = 'REVIEW_REQUIRED';
  correction.draftOffered = correction.decision === 'REWRITE_TEXT';
  return correction;
}
module.exports = { VERSION, FIELDS, SCOPE, PROMPT, prepare, settle, labelsOf, numberOf, statementOf };
