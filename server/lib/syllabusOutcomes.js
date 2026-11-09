// Syllabus-owned learning outcomes. Legacy catalog data is copied only on first edit.
const { httpError } = require('./http');
const { LEVELS } = require('./courses');
const { assertContentBasis, hasPoMappings, sameBasis } = require('./programPoReferences');
const { hasContent } = require('../../shared/contentPresence.cjs');
const blankOutcomes = () => ({ vision: '', mission: { lead: '', items: [] }, egas: [], pos: [] });
function outcomesFrom(content, course) {
  if (content.outcomes) return content.outcomes;
  if(course?.standards?.poReference && !content.catalog?.program?.pos) assertContentBasis(content,course.standards.poReference);
  const snapshot = content.catalog;
  const source = snapshot?.institution ? {
    ...snapshot.institution,
    egas: snapshot.program?.egas || snapshot.institution.egas || [],
    pos: snapshot.program?.pos || [],
  } : course?.standards || blankOutcomes();
  return JSON.parse(JSON.stringify({ vision: source.vision || '', mission: { lead: source.mission?.lead || '', items: source.mission?.items || [] }, egas: source.egas || [], pos: content.catalog?.program?.pos || source.pos || [] }));
}
function validateOutcomes(outcomes, clos, plan = [], { complete = false } = {}) {
  const object = v => v && typeof v === 'object' && !Array.isArray(v);
  const text = (v, max) => typeof v === 'string' && v.length <= max;
  const nums = v => Array.isArray(v) && v.length <= 50 && v.every(n => Number.isInteger(n) && n > 0) && new Set(v).size === v.length;
  const fail = () => { throw httpError(400, 'Invalid learning outcomes. Check the fields and outcome mappings in step 2.'); };
  if (!object(outcomes) || !text(outcomes.vision, 10000) || !object(outcomes.mission) || !text(outcomes.mission.lead, 10000) || !Array.isArray(outcomes.mission.items) || outcomes.mission.items.length > 50 || !outcomes.mission.items.every(t => text(t, 10000))) fail();
  for (const [key, max] of [['egas', 20], ['pos', 50]]) {
    const rows = outcomes[key];
    if (!Array.isArray(rows) || rows.length > max || !nums(rows.map(r => r?.no))) fail();
    for (const r of rows) if (!object(r) || !text(r.short, 120) || !text(key === 'egas' ? r.name : r.text, key === 'egas' ? 255 : 2000)) fail();
  }
  const egas = new Set(outcomes.egas.map(r => r.no));
  const pos = new Set(outcomes.pos.map(r => r.no));
  for (const p of outcomes.pos) if (!nums(p.egas) || p.egas.some(n => !egas.has(n))) fail();
  if (!Array.isArray(clos) || clos.length > 20) fail();
  const ids = new Set();
  for (const c of clos) {
    if (!object(c) || typeof c.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(c.id) || ids.has(c.id) || !text(c.title, 255) || !text(c.statement, 10000) || !LEVELS.includes(c.level) || !nums(c.egas) || !nums(c.pos) || c.egas.some(n => !egas.has(n)) || c.pos.some(n => !pos.has(n))) fail();
    ids.add(c.id);
  }
  // Do not allow a removed outcome to leave dangling references in the learning plan.
  if (!Array.isArray(plan)) fail();
  for (const row of plan) {
    if (!object(row) || !Array.isArray(row.ilos)) fail();
    for (const il of row.ilos) if (!object(il) || !Array.isArray(il.tags) || il.tags.some(tag => typeof tag !== 'string')) fail();
  }
  for (const row of plan) for (const il of row.ilos) for (const tag of il.tags) {
    const [kind, id] = tag.split(':');
    if ((kind === 'clo' && !ids.has(id)) || (kind === 'ega' && !egas.has(Number(id))) || (kind === 'po' && !pos.has(Number(id)))) fail();
  }
  if (complete && (!hasContent(outcomes.vision) || !hasContent(outcomes.mission.lead) || !outcomes.mission.items.length || outcomes.mission.items.some(t => !hasContent(t)) || !outcomes.egas.length || outcomes.egas.some(e => !hasContent(e.name) || !hasContent(e.short)) || !outcomes.pos.length || outcomes.pos.some(p => !hasContent(p.text) || !hasContent(p.short)) || !clos.length || clos.some(c => !hasContent(c.statement) || !c.egas.length || !c.pos.length))) {
    throw httpError(409, 'Complete Vision, Mission, EGA, PO and CLO in step 2 before submitting.');
  }
}
// The vision, mission, EGAs and program outcomes an administrator set on a subject are the subject's own constants: a faculty member's syllabus takes them as they are and
// cannot change them (the CLOs and their mapping to the EGAs and POs stay the author's). True once the administrator has set anything.
const standardsAreSet = (standards) => !!standards && (hasContent(standards.vision) || hasContent(standards.mission?.lead) || (standards.mission?.items || []).some(hasContent) || (standards.egas || []).length > 0 || (standards.pos || []).length > 0);
// A syllabus with CLO-PO mappings keeps the PO statements it was mapped against until its author reviews and adopts the changed ones (POST /syllabi/:id/po-review/adopt). `stored` is the content read
// from the database under the save's row lock, never the request. A draft with no mappings has nothing to review, and takes the subject's POs as it always has.
function poReviewPending(stored, standards) {
  const pos = stored?.outcomes?.pos, next = standards?.pos;
  return Array.isArray(pos) && pos.length > 0 && Array.isArray(next) && next.length > 0 && hasPoMappings(stored) && !sameBasis(pos, next);
}
function forceStandards(outcomes, standards, stored = null) {
  // decided and copied first: on a partial save `outcomes` IS the stored object
  const kept = poReviewPending(stored, standards) ? JSON.parse(JSON.stringify(stored.outcomes)) : null;
  const own = JSON.parse(JSON.stringify({ vision: standards.vision || '', mission: { lead: standards.mission?.lead || '', items: standards.mission?.items || [] }, egas: standards.egas || [], pos: standards.pos || [] }));
  outcomes.vision = own.vision; outcomes.mission = own.mission; outcomes.egas = own.egas; outcomes.pos = own.pos;
  if (standards.poReference) outcomes.poReference = JSON.parse(JSON.stringify(standards.poReference));
  if (kept) { // the stored statements stay; so does the EGA list if they still point at an EGA the subject no longer has
    outcomes.pos = kept.pos;
    if (kept.pos.some((p) => (p.egas || []).some((n) => !outcomes.egas.some((e) => e.no === n)))) outcomes.egas = kept.egas;
    if (kept.poReference) outcomes.poReference = kept.poReference; else delete outcomes.poReference;
  }
  return outcomes;
}
module.exports = { blankOutcomes, outcomesFrom, validateOutcomes, standardsAreSet, forceStandards, poReviewPending };
