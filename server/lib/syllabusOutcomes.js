// Syllabus-owned learning outcomes. Legacy catalog data is copied only on first edit.
const { httpError } = require('./http');
const { LEVELS } = require('./courses');
const blankOutcomes = () => ({ vision: '', mission: { lead: '', items: [] }, egas: [], pos: [] });
function outcomesFrom(content, course) {
  if (content.outcomes) return content.outcomes;
  const snapshot = content.catalog;
  const source = snapshot?.institution ? {
    ...snapshot.institution,
    egas: snapshot.program?.egas || snapshot.institution.egas || [],
    pos: snapshot.program?.pos || [],
  } : course?.standards || blankOutcomes();
  return JSON.parse(JSON.stringify({ vision: source.vision || '', mission: { lead: source.mission?.lead || '', items: source.mission?.items || [] }, egas: source.egas || [], pos: source.pos || [] }));
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
  if (complete && (!outcomes.vision.trim() || !outcomes.mission.lead.trim() || !outcomes.mission.items.length || outcomes.mission.items.some(t => !t.trim()) || !outcomes.egas.length || outcomes.egas.some(e => !e.name.trim() || !e.short.trim()) || !outcomes.pos.length || outcomes.pos.some(p => !p.text.trim() || !p.short.trim()) || !clos.length || clos.some(c => !c.statement.trim() || !c.egas.length || !c.pos.length))) {
    throw httpError(409, 'Complete Vision, Mission, EGA, PO and CLO in step 2 before submitting.');
  }
}
module.exports = { blankOutcomes, outcomesFrom, validateOutcomes };
