'use strict';
// Developer edits to the compliance standard. The standard is standard-v4.json; edits are kept in the database (app_settings 'standard_overrides')
// and laid over it when the server starts and each time they are saved, so a change takes effect at once and "Reset" returns to the file.
//
//   effective(doc)            the standard with the edits `doc` applied, as plain data (does not touch the live standard)
//   validate(input)           -> { doc, errors }: only values that differ from the file are kept; anything unknown or out of range is an error
//   apply(doc, rev)           lays the edits over the live standard object (the one every checker module shares)
//   describe(before, after)   -> [{ target, field, from, to }] for the change history
//
// What can be edited: pass mark, score bands, area weights, a handful of numeric constants, and per rule its points, severity, message,
// fix text, numeric parameters, and whether it counts at all. New rules and new kinds of check need code, so they are not editable here.
// Every save gets a new version label (v7.1, v7.2, ...) so a stored check made under older rules is never reused as current.
const standard = require('./standard-v4.json'); // the same object the checker reads
const base = structuredClone(standard);

const CONSTANTS = ['weeksPerTerm', 'hoursPerLectureUnit', 'hoursPerLabUnit', 'maxUnitsPerPart', 'minDescriptionWords', 'minIloWords', 'minReferences', 'referenceMaxAgeYears'];
const SEVERITIES = ['blocking', 'major', 'minor'];
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const holes = (s) => new Set(String(s).match(/\{[^}]+\}/g) || []);

// The editable parameters of a rule: the numeric ones in the file.
const numericParams = (params) => Object.fromEntries(Object.entries(obj(params)).filter(([, v]) => isNum(v)));

function effective(doc = {}) {
  const d = obj(doc);
  const rules = base.rules.map((r) => {
    const e = obj(obj(d.rules)[r.id]);
    return {
      ...structuredClone(r),
      weight: isNum(e.weight) ? e.weight : r.weight,
      severity: SEVERITIES.includes(e.severity) ? e.severity : r.severity,
      message: typeof e.message === 'string' && e.message.trim() ? e.message : r.message,
      fix: typeof e.fix === 'string' ? e.fix : (r.fix || ''),
      params: { ...structuredClone(obj(r.params)), ...Object.fromEntries(Object.entries(obj(e.params)).filter(([k, v]) => isNum(v) && isNum(obj(r.params)[k]))) },
      enabled: e.enabled === false ? false : true,
    };
  });
  return {
    passThreshold: isNum(d.passThreshold) ? d.passThreshold : base.passThreshold,
    bands: Array.isArray(d.bands) && d.bands.length === base.bands.length ? d.bands.map((b) => ({ min: b.min, label: b.label })) : structuredClone(base.bands),
    areas: base.areas.map((a) => ({ key: a.key, name: a.name, stage: a.stage, weight: isNum(obj(obj(d.areas)[a.key]).weight) ? obj(d.areas)[a.key].weight : a.weight })),
    constants: Object.fromEntries(CONSTANTS.map((k) => [k, isNum(obj(d.constants)[k]) ? d.constants[k] : base.constants[k]])),
    rules,
  };
}

const int = (x, lo, hi) => isNum(x) && Number.isInteger(x) && x >= lo && x <= hi;

// `input` is a full or partial set of values; the result keeps only what differs from the file.
function validate(input) {
  const errors = [];
  const i = obj(input);
  const doc = {};
  if (i.passThreshold !== undefined) {
    if (!int(i.passThreshold, 0, 100)) errors.push('The pass mark must be a whole number from 0 to 100.');
    else if (i.passThreshold !== base.passThreshold) doc.passThreshold = i.passThreshold;
  }
  if (i.bands !== undefined) {
    const b = i.bands;
    const ok = Array.isArray(b) && b.length === base.bands.length && b.every((x, k) => int(obj(x).min, 0, 100) && typeof x.label === 'string' && x.label.trim() && x.label.length <= 40 && (k === 0 || x.min < b[k - 1].min)) && b[b.length - 1].min === 0;
    if (!ok) errors.push('The score bands must be ' + base.bands.length + ' bands, highest first, each with a label, and the last one starting at 0.');
    else if (JSON.stringify(b.map((x) => ({ min: x.min, label: x.label.trim() }))) !== JSON.stringify(base.bands)) doc.bands = b.map((x) => ({ min: x.min, label: x.label.trim() }));
  }
  if (i.areas !== undefined) {
    const out = {};
    Object.entries(obj(i.areas)).forEach(([key, v]) => {
      const a = base.areas.find((x) => x.key === key);
      if (!a) errors.push('Unknown area "' + key + '".');
      else if (!int(obj(v).weight, 0, 100)) errors.push('Area "' + key + '": the weight must be a whole number from 0 to 100.');
      else if (v.weight !== a.weight) out[key] = { weight: v.weight };
    });
    if (Object.keys(out).length) doc.areas = out;
    const total = base.areas.reduce((s, a) => s + (isNum(obj(obj(i.areas)[a.key]).weight) ? i.areas[a.key].weight : a.weight), 0);
    if (!errors.length && total <= 0) errors.push('At least one area must have a weight above 0.');
  }
  if (i.constants !== undefined) {
    const out = {};
    Object.entries(obj(i.constants)).forEach(([k, v]) => {
      if (!CONSTANTS.includes(k)) errors.push('Unknown constant "' + k + '".');
      else if (!isNum(v) || v < 0 || v > 1000) errors.push('Constant "' + k + '" must be a number from 0 to 1000.');
      else if (v !== base.constants[k]) out[k] = v;
    });
    if (Object.keys(out).length) doc.constants = out;
  }
  if (i.rules !== undefined) {
    const out = {};
    Object.entries(obj(i.rules)).forEach(([id, v]) => {
      const r = base.rules.find((x) => x.id === id);
      if (!r) { errors.push('Unknown rule "' + id + '".'); return; }
      const e = obj(v);
      const mine = {};
      if (e.weight !== undefined) { if (!int(e.weight, 0, 20)) errors.push(id + ': the points must be a whole number from 0 to 20.'); else if (e.weight !== r.weight) mine.weight = e.weight; }
      if (e.severity !== undefined) { if (!SEVERITIES.includes(e.severity)) errors.push(id + ': the severity must be blocking, major or minor.'); else if (e.severity !== r.severity) mine.severity = e.severity; }
      if (e.message !== undefined) {
        const m = typeof e.message === 'string' ? e.message.trim() : '';
        const extra = [...holes(m)].filter((h) => !holes(r.message).has(h));
        if (!m || m.length > 300) errors.push(id + ': the message must be 1 to 300 characters.');
        else if (extra.length) errors.push(id + ': the message uses ' + extra.join(', ') + ', which this rule does not provide. Allowed: ' + ([...holes(r.message)].join(', ') || 'none') + '.');
        else if (m !== r.message) mine.message = m;
      }
      if (e.fix !== undefined) { if (typeof e.fix !== 'string' || e.fix.length > 200) errors.push(id + ': the fix text must be at most 200 characters.'); else if (e.fix.trim() !== (r.fix || '')) mine.fix = e.fix.trim(); }
      if (e.enabled !== undefined) { if (typeof e.enabled !== 'boolean') errors.push(id + ': enabled must be true or false.'); else if (e.enabled === false) mine.enabled = false; }
      if (e.params !== undefined) {
        const ps = {};
        const own = numericParams(r.params);
        Object.entries(obj(e.params)).forEach(([k, pv]) => {
          if (!(k in own)) errors.push(id + ': "' + k + '" is not an editable number of this rule.');
          else if (!isNum(pv) || pv < 0 || pv > 1000) errors.push(id + ': "' + k + '" must be a number from 0 to 1000.');
          else if (pv !== own[k]) ps[k] = pv;
        });
        if (Object.keys(ps).length) mine.params = ps;
      }
      if (Object.keys(mine).length) out[id] = mine;
    });
    if (Object.keys(out).length) doc.rules = out;
  }
  return { doc, errors };
}

// Lay the edits over the live standard. Every module holds this one object, so replacing its properties is enough.
function apply(doc = {}, rev = 0) {
  const eff = effective(doc);
  const edited = Object.keys(obj(doc)).length > 0;
  standard.passThreshold = eff.passThreshold;
  standard.bands = eff.bands;
  standard.areas = base.areas.map((a) => ({ ...structuredClone(a), weight: eff.areas.find((x) => x.key === a.key).weight }));
  standard.constants = { ...structuredClone(base.constants), ...eff.constants };
  standard.rules = eff.rules.filter((r) => r.enabled).map(({ enabled, ...r }) => r);
  standard.version = edited ? base.version + '.' + rev : base.version;
  return standard;
}

// A readable list of what changed between two edit sets, for the history.
function describe(before, after) {
  const a = effective(before);
  const b = effective(after);
  const out = [];
  const note = (target, field, from, to) => { if (JSON.stringify(from) !== JSON.stringify(to)) out.push({ target, field, from, to }); };
  note('standard', 'passThreshold', a.passThreshold, b.passThreshold);
  note('standard', 'bands', a.bands, b.bands);
  a.areas.forEach((x, k) => note('area ' + x.key, 'weight', x.weight, b.areas[k].weight));
  CONSTANTS.forEach((k) => note('constant', k, a.constants[k], b.constants[k]));
  a.rules.forEach((x, k) => {
    const y = b.rules[k];
    ['weight', 'severity', 'message', 'fix', 'enabled'].forEach((f) => note(x.id, f, x[f], y[f]));
    Object.keys(numericParams(x.params)).forEach((p) => note(x.id, 'params.' + p, x.params[p], y.params[p]));
  });
  return out;
}

module.exports = { base, standard, effective, validate, apply, describe, CONSTANTS, SEVERITIES, numericParams };
