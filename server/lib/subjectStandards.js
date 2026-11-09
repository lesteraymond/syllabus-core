const { httpError } = require('./http');
const blankStandards = () => ({ vision: '', mission: { lead: '', items: [] }, egas: [], pos: [], versions: { vision: 1, egas: 1, pos: 1 } });
function readStandards(raw) {
  if (!raw) return blankStandards();
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return { ...blankStandards(), ...value };
}
function updateStandards(current, section, value, version, clos) {
  if (!['vision','egas','pos'].includes(section)) throw httpError(400, 'Invalid subject setup section.');
  if (!Number.isInteger(version) || version !== current.versions[section]) throw httpError(409, 'This was changed by someone else. Reload to see the latest.');
  const text = (v, max) => typeof v === 'string' && v.length <= max;
  const nums = arr => Array.isArray(arr) && arr.every(n => Number.isInteger(n) && n > 0) && new Set(arr).size === arr.length;
  const next = JSON.parse(JSON.stringify(current));
  if (section === 'vision') {
    if (!value || !text(value.vision,10000) || !value.mission || !text(value.mission.lead,10000) || !Array.isArray(value.mission.items) || value.mission.items.length>50 || !value.mission.items.every(v=>text(v,10000))) throw httpError(400,'Invalid subject vision or mission.');
    next.vision=value.vision; next.mission=value.mission;
  } else {
    if (!Array.isArray(value) || value.length > (section==='egas'?20:50) || !nums(value.map(v=>v?.no))) throw httpError(400,'Invalid subject outcomes.');
    for (const row of value) {
      if (!text(row.short,120) || !row.short.trim() || !text(section==='egas'?row.name:row.text,section==='egas'?255:2000) || !(section==='egas'?row.name:row.text).trim()) throw httpError(400,'Invalid subject outcome text.');
      if (section==='pos' && (!nums(row.egas) || row.egas.some(n=>!current.egas.some(e=>e.no===n)))) throw httpError(400,'A subject PO refers to an unknown EGA.');
    }
    const retained = new Set(value.map(v=>v.no));
    const used = section==='egas' ? [...current.pos,...clos] : clos;
    if (used.some(row=>(row[section==='egas'?'egas':'pos']||[]).some(n=>!retained.has(n)))) throw httpError(409,'An outcome is still used by this subject. Update its dependent tags first.');
    next[section] = value.map(row=>section==='egas'?{no:row.no,name:row.name,short:row.short}:{no:row.no,short:row.short,text:row.text,egas:row.egas});
  }
  next.versions[section]++;
  return next;
}
// The standards a NEW subject starts with: a snapshot of its program's masters (EGAs and POs) and the school's vision and mission, so what an administrator set up for the
// program is what faculty see when they pick the program and subject. It is the subject's own copy from then on (later edits of the masters do not change it; see
// applyMasters). The argument is { institution: { vision, mission }, egas: [{ no, name, short }], pos: [{ no, short, text, egas }] }. A program without EGAs yet gives the blank copy.
function standardsFromMasters(masters) {
  if (!masters || !Array.isArray(masters.egas) || !masters.egas.length) return blankStandards();
  const inst = masters.institution || {};
  return {
    ...blankStandards(),
    vision: String(inst.vision || ''),
    mission: { lead: String((inst.mission && inst.mission.lead) || ''), items: ((inst.mission && inst.mission.items) || []).map(String) },
    egas: masters.egas.map((e) => ({ no: e.no, name: e.name, short: e.short })),
    pos: (masters.pos || []).map((p) => ({ no: p.no, short: p.short, text: p.text, egas: [...p.egas] })),
  };
}

// Explicit sync of an existing subject with the masters (an administrator's action, never automatic). Returns { next, changed: [sections], conflict: string|null }. Nothing is
// forced: when a CLO of the subject still points at an EGA or PO the masters no longer have, the subject is left as it is and the reason is given.
function applyMasters(current, masters, clos) {
  const incoming = standardsFromMasters(masters);
  const keepEgas = new Set(incoming.egas.map((e) => e.no)), keepPos = new Set(incoming.pos.map((p) => p.no));
  for (const clo of clos || []) {
    const lostEga = (clo.egas || []).find((n) => !keepEgas.has(n));
    if (lostEga !== undefined) return { next: current, changed: [], conflict: 'EGA ' + lostEga + ' is still used by a CLO of this subject' };
    const lostPo = (clo.pos || []).find((n) => !keepPos.has(n));
    if (lostPo !== undefined) return { next: current, changed: [], conflict: 'PO ' + lostPo + ' is still used by a CLO of this subject' };
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const next = JSON.parse(JSON.stringify(current)), changed = [];
  if (!same({ v: current.vision, m: current.mission }, { v: incoming.vision, m: incoming.mission })) { next.vision = incoming.vision; next.mission = incoming.mission; next.versions.vision = (current.versions.vision || 1) + 1; changed.push('vision'); }
  if (!same(current.egas, incoming.egas)) { next.egas = incoming.egas; next.versions.egas = (current.versions.egas || 1) + 1; changed.push('egas'); }
  if (!same(current.pos, incoming.pos)) { next.pos = incoming.pos; next.versions.pos = (current.versions.pos || 1) + 1; changed.push('pos'); }
  return { next, changed, conflict: null };
}

module.exports = { blankStandards, readStandards, updateStandards, standardsFromMasters, applyMasters };
