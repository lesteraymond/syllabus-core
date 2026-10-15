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
module.exports = { blankStandards, readStandards, updateStandards };
