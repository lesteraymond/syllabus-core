import { weekNums, parseTag, lines, stripMarkup, abbr, examName } from './syllabusModel.js';
// The compliance rule engine: pure, deterministic, no database, no network, no clock.
//   evaluate(content, standard, ctx) -> result
//
// `content`   the syllabus content the builder stores (meta, description, clos, plan, reqs, refs, grading, and after a submit
//             `catalog`, the vision, mission, EGAs and POs it was submitted with).
// `standard`  standard-v4.json, injected: the rules are data ({id, area, step, severity, weight, check, params, message}) and
//             this file only implements each `check`. The PDF is never read at runtime.
// `ctx`       { year, catalog, preparedBy? }. `year` is the school start year reference age is measured from (never today's
//             date, so the same content always scores the same). `catalog` is the live { institution: { vision, mission },
//             program: { egas, pos } }, used to check a submitted syllabus still matches it; without it that rule is skipped.
//
// Scoring: a rule's score is the share of its items that pass (a rule with no items is not applicable and is skipped); an area's
// score is the weighted mean of its rules; the overall is the weighted mean of the areas. Findings are one per failed item.
// 'blocking' findings stop a submit; 'major' and 'minor' only warn.
//
// This is the browser copy of server/lib/compliance/rules.js: the same rules and the same output. Keep them in sync;
// src/lib/complianceRules.parity.test.js runs both on the same fixtures and fails if they differ.

// ---- helpers: the builder's own week, tag and exam-name rules (src/lib/syllabusModel.js) ----
// iloClos is the same rule as the model's, but tolerates an ILO without a tags list (stored content can be partial).
const iloClos = (il) => (il.tags || []).filter((t) => String(t).indexOf('clo:') === 0).map((t) => parseTag(t).id);

const arr = (x) => (Array.isArray(x) ? x : []);
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
const text = (x) => (x == null ? '' : String(x));
const blank = (x) => !text(x).trim();
const words = (s) => text(s).trim().split(/\s+/).filter(Boolean).length;
const at = (o, path) => path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);
const clip = (s, n) => text(s).replace(/\s+/g, ' ').trim().slice(0, n);
const same = (a, b) => canonical(a) === canonical(b);
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
const fill = (msg, vars) => String(msg).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? String(vars[k]) : m));
const weekLabel = (r) => 'Week ' + (text(obj(r).week).trim() || '?');

// An item is one thing a rule looked at. `f` is how well it passed: true/false, or a fraction from 0 to 1.
const item = (f, path, vars, evidence, message) => ({ f: f === true ? 1 : f === false ? 0 : Math.max(0, Math.min(1, f)), path, vars: vars || {}, evidence: evidence || {}, message });

// ---- the checks. Each returns the items it looked at, or [] when it does not apply. ----
export const CHECKS = {
  nonEmpty(X, p) {
    if (p.paths) {
      const ok = p.paths.every((path) => { const v = at(X.c, path); return p.numeric ? !isNaN(parseFloat(v)) : !blank(v); });
      return [item(ok, p.paths[0], {}, { paths: p.paths })];
    }
    const v = at(X.c, p.path);
    if (p.where === 'lessonWithIlo') {
      const n = X.lessons.filter(({ r }) => arr(r.ilos).some((il) => !blank(obj(il).text))).length;
      return [item(n >= (p.minItems || 1), p.path, {}, { have: n })];
    }
    if (p.items) return [item(Array.isArray(v) && v.some((x) => !blank(obj(x)[p.items])), p.path)];
    if (p.minItems) return [item(Array.isArray(v) && v.length >= p.minItems, p.path, {}, { have: Array.isArray(v) ? v.length : 0, need: p.minItems })];
    return [item(!blank(v), p.path)];
  },

  // The vision, mission, EGAs and POs stored with a submitted syllabus must be the catalog's, verbatim. Skipped for a draft
  // (it has no stored copy and always shows the live text) and when the live catalog is not supplied.
  equalsCatalog(X, p) {
    const snap = X.snapshot;
    const live = X.live;
    if (!snap || !live) return [];
    const pick = {
      vision: (s) => text(obj(s.institution).vision),
      mission: (s) => ({ lead: text(obj(obj(s.institution).mission).lead), items: arr(obj(obj(s.institution).mission).items).map(text) }),
      egas: (s) => arr(obj(s.program).egas).map((e) => ({ no: obj(e).no, name: obj(e).name, short: obj(e).short })),
      pos: (s) => arr(obj(s.program).pos).map((o) => ({ no: obj(o).no, short: obj(o).short, text: obj(o).text, egas: arr(obj(o).egas) })),
    }[p.field];
    const a = pick(snap);
    const b = pick(live);
    return [item(same(a, b), 'catalog.' + p.field, {}, { field: p.field, stored: clip(JSON.stringify(a), 160), current: clip(JSON.stringify(b), 160) })];
  },

  tagsResolve(X, p) {
    const out = [];
    X.lessons.forEach(({ r, i }) => arr(r.ilos).forEach((il0, j) => {
      const il = obj(il0);
      const where = weekLabel(r) + ', ILO' + (j + 1);
      const path = 'plan[' + i + '].ilos[' + j + ']';
      const tags = arr(il.tags);
      if (p.mode === 'cloTagPresent') {
        if (!blank(il.text)) out.push(item(iloClos(il).length > 0, path, { where }));
        else if (tags.length) out.push(item(false, path, { where }, {}, where + ' is tagged but has no text.'));
      } else {
        tags.forEach((t, k) => {
          let ok = X.tagRe.test(String(t));
          if (ok) {
            const g = parseTag(t);
            if (g.kind === 'clo') ok = X.cloIds.has(g.id);
            else if (g.kind === 'po' && X.poNos) ok = X.poNos.indexOf(g.id) > -1;
            else if (g.kind === 'ega' && X.egaNos) ok = X.egaNos.indexOf(g.id) > -1;
          }
          out.push(item(ok, path + '.tags[' + k + ']', { where, tag: text(t) }, { tag: text(t) }));
        });
      }
    }));
    return out;
  },

  columnsFilled(X, p) {
    const title = (k) => (X.K.planColumns.find((c) => c.key === k) || { title: k }).title;
    if (p.mode === 'present') {
      return X.plan.map((row, i) => {
        const r = obj(row);
        const missing = p.columns.filter((k) => (k === 'ilos' ? !Array.isArray(r[k]) : typeof r[k] !== 'string')).map(title);
        return item(missing.length === 0, 'plan[' + i + ']', { row: i + 1, missing: missing.join(', ') }, { missing });
      });
    }
    return X.lessons.map(({ r, i }) => {
      const empty = p.columns.filter((k) => blank(r[k]));
      return item((p.columns.length - empty.length) / p.columns.length, 'plan[' + i + ']' + (p.columns.length === 1 ? '.' + p.columns[0] : ''), { where: weekLabel(r), missing: empty.map(title).join(', ') }, { empty });
    });
  },

  iloNumbering(X) {
    return X.lessons.map(({ r, i }) => {
      const filled = arr(r.ilos).map((il) => !blank(obj(il).text));
      const firstBlank = filled.indexOf(false);
      const gap = firstBlank > -1 && filled.slice(firstBlank).some(Boolean);
      return item(!gap, 'plan[' + i + '].ilos', { where: weekLabel(r) });
    });
  },

  weeksOrder(X) {
    const firsts = X.plan.map((row, i) => ({ i, w: weekNums(obj(row).week)[0] })).filter((x) => x.w !== undefined);
    let out = -1;
    for (let k = 1; k < firsts.length; k++) if (firsts[k].w < firsts[k - 1].w) { out = firsts[k].i; break; }
    return [item(out < 0, out < 0 ? 'plan' : 'plan[' + out + ']', { row: out + 1 }, { row: out + 1 })];
  },

  numberedRequirements(X, p) {
    const reqs = arr(X.c.reqs).map((r) => text(obj(r).t)).filter((t) => t.trim());
    if (p.mode === 'count') return [item(reqs.length >= p.min, 'reqs', { have: reqs.length, need: p.min }, { have: reqs.length, need: p.min })];
    return reqs.map((t, i) => item(!/^\s*\d+\s*[.)]\s/.test(t), 'reqs[' + i + ']', { text: clip(t, 50) }));
  },

  referenceGroups(X, p) {
    const refs = obj(X.c.refs);
    const out = [];
    X.K.refGroups.forEach((g) => {
      const grp = obj(refs[g.key]);
      const has = arr(grp.items).some((x) => !blank(obj(x).t));
      if (p.mode === 'filledOrNa') out.push(item(!!grp.na || has, 'refs.' + g.key, { letter: g.letter, title: g.title }));
      else if (grp.na) out.push(item(!has, 'refs.' + g.key, { letter: g.letter, title: g.title }));
    });
    return out;
  },

  gradingTotal(X, p) {
    const total = arr(obj(X.c.grading).rows).reduce((s, g) => s + (Number(obj(g).pct) || 0), 0);
    return [item(Math.abs(total - p.total) < 1e-9, 'grading.rows', { total, need: p.total }, { total, need: p.total })];
  },

  gradingFormula(X, p) {
    const g = obj(X.c.grading);
    const rows = arr(g.rows).map(obj);
    const o = obj(g.override);
    if (p.mode === 'overrideFilled') return o.on ? [item(!blank(o.term) && !blank(o.final), 'grading.override')] : [];
    const exams = X.plan.filter((r) => obj(r).kind === 'exam').map((r) => examName(obj(r)));
    const termGen = 'Term Grade = ' + (rows.length ? rows.map((r) => (r.abbr || abbr(r.label)) + ' (' + (Number(r.pct) || 0) + '%)').join(' + ') : '(add grading components)');
    const finalGen = 'Final Rating = ' + (exams.length ? exams.join(' + ') : '(add exam rows in step 3)');
    const term = o.on ? text(o.term) : termGen;
    const fin = o.on ? text(o.final) : finalGen;
    const out = [];
    if (rows.length) {
      const missing = rows.filter((r) => { const t = term.toLowerCase(); return !(t.indexOf(text(r.label).toLowerCase()) > -1 || t.indexOf(text(r.abbr || abbr(r.label)).toLowerCase()) > -1) || t.indexOf((Number(r.pct) || 0) + '%') < 0; }).map((r) => text(r.label));
      out.push(item(missing.length === 0, 'grading.override.term', { which: 'Term Grade', missing: missing.join(', ') }, { missing }));
    }
    if (exams.length) {
      const missing = exams.filter((n) => fin.toLowerCase().indexOf(n.toLowerCase()) < 0);
      out.push(item(missing.length === 0, 'grading.override.final', { which: 'Final Rating', missing: missing.join(', ') }, { missing }));
    }
    return out;
  },

  // The preparer comes from the owner's account and the other two roles are added by the system, so this only fails when the
  // preparer is unknown or the stored sign-off holds names a faculty member should not have entered.
  signoffRoles(X) {
    const out = [];
    if (X.ctx.preparedBy !== undefined) out.push(item(!blank(X.ctx.preparedBy), 'signoff', { problem: 'the preparer\'s name is missing' }));
    const entered = Object.keys(obj(X.c.signoff)).filter((k) => !blank(obj(X.c.signoff)[k]));
    if (entered.length) out.push(item(false, 'signoff', { problem: 'names were entered by hand (' + entered.join(', ') + '); the system adds them' }, { entered }));
    return out;
  },

  textLength(X, p) {
    if (p.target === 'description') {
      const n = arr(X.c.description).reduce((s, x) => s + words(obj(x).t), 0);
      return [item(n / p.minWords, 'description', { words: n, nouns: n === 1 ? 'word' : 'words', need: p.minWords }, { words: n, need: p.minWords })];
    }
    if (p.target === 'ilo') {
      const out = [];
      X.lessons.forEach(({ r, i }) => arr(r.ilos).forEach((il, j) => {
        const n = words(obj(il).text);
        if (n > 0) out.push(item(n >= p.minWords, 'plan[' + i + '].ilos[' + j + ']', { where: weekLabel(r) + ', ILO' + (j + 1), words: n, nouns: n === 1 ? 'word' : 'words' }, { words: n, need: p.minWords }));
      }));
      return out;
    }
    return X.clos.map((k0, i) => {
      const k = obj(k0);
      const missing = blank(k.title) ? 'title' : blank(k.statement) ? 'statement' : '';
      return item(!missing, 'clos[' + i + ']', { n: i + 1, missing });
    });
  },

  referenceAge(X, p) {
    const list = [];
    X.K.refGroups.forEach((g) => arr(obj(obj(X.c.refs)[g.key]).items).forEach((x, k) => { if (!blank(obj(x).t)) list.push({ g: g.key, k, t: text(obj(x).t) }); }));
    const yearOf = (t) => { const m = t.match(/\b(19|20)\d{2}\b/); return m ? +m[0] : null; };
    // Only an entry that reads like a citation counts: long enough, several words, and a year or a link. "test" does not.
    const longEnough = (t) => t.trim().length >= X.K.minReferenceChars && words(t) >= X.K.minReferenceWords;
    const real = list.filter((r) => longEnough(r.t) && (yearOf(r.t) !== null || /https?:\/\//i.test(r.t)));
    if (p.mode === 'count') return [item(real.length >= p.min, 'refs', { have: real.length, need: p.min }, { have: real.length, need: p.min })];
    if (p.mode === 'any') return [item(real.length > 0, 'refs')];
    if (p.mode === 'citation') return list.map((r) => item(longEnough(r.t), 'refs.' + r.g + '.items[' + r.k + ']', { text: clip(r.t, 60) }, { reference: clip(r.t, 120) }));
    if (p.mode === 'dated') return list.map((r) => item(yearOf(r.t) !== null, 'refs.' + r.g + '.items[' + r.k + ']', { text: clip(r.t, 60) }, { reference: clip(r.t, 120) }));
    if (X.year === null) return [];
    const limit = p.maxAgeYears || X.K.referenceMaxAgeYears;
    return list.filter((r) => yearOf(r.t) !== null).map((r) => {
      const year = yearOf(r.t);
      const age = X.year - year;
      return item(age <= limit, 'refs.' + r.g + '.items[' + r.k + ']', { age, year, limit, text: clip(r.t, 60) }, { year, age, limit });
    });
  },

  cloConventions(X, p) {
    return X.clos.map((k0, i) => {
      const k = obj(k0);
      const path = 'clos[' + i + ']';
      const egas = arr(k.egas).map(String);
      const pos = arr(k.pos).map(String);
      const n = i + 1;
      if (p.mode === 'egaTagged') return item(egas.length > 0 && (!X.egaNos || egas.every((e) => X.egaNos.indexOf(e) > -1)), path + '.egas', { n }, { egas });
      if (p.mode === 'poTagged') return item(pos.length > 0 && (!X.poNos || pos.every((o) => X.poNos.indexOf(o) > -1)), path + '.pos', { n }, { pos });
      if (p.mode === 'format') {
        const inc = (a) => a.every((v, j) => j === 0 || Number(v) > Number(a[j - 1]));
        return item(inc(egas) && inc(pos), path, { n, format: X.K.cloTagFormat });
      }
      // poImpliesEga: the EGAs the CLO's POs map to must also be tagged on the CLO.
      if (!X.poList || !pos.length) return null;
      const missing = [];
      pos.forEach((no) => { const po = X.poList.find((x) => String(obj(x).no) === no); if (po) arr(po.egas).forEach((e) => { if (egas.indexOf(String(e)) < 0) missing.push({ po: no, ega: e }); }); });
      return item(missing.length === 0, path + '.egas', { n, po: missing.length ? missing[0].po : '', ega: missing.length ? missing[0].ega : '' }, { missing });
    }).filter(Boolean);
  },

  cloCoverage(X, p) {
    return X.clos.map((k0, i) => {
      const id = String(obj(k0).id);
      const rows = X.lessons.filter(({ r }) => arr(r.ilos).some((il) => iloClos(obj(il)).indexOf(id) > -1));
      const ok = p.requireColumn ? rows.some(({ r }) => !blank(r[p.requireColumn])) : rows.length > 0;
      return item(ok, 'clos[' + i + ']', { n: i + 1 });
    });
  },

  // The vision, mission and EGAs a syllabus shows are the LCUP's, word for word: spacing, capital letters, dashes and the ending
  // punctuation of a line are ignored. It reads what the syllabus is shown with (its own outcomes, else its stored copy once
  // submitted, else the live catalog) and is skipped when none of those is available.
  equalsInstitution(X, p) {
    const K = X.K.institution;
    const own = X.c.outcomes && typeof X.c.outcomes === 'object' && !Array.isArray(X.c.outcomes) ? X.c.outcomes : null;
    const from = X.snapshot || X.live;
    if (!own && !from) return [];
    const inst = own || obj(obj(from).institution);
    const egas = own ? own.egas : obj(obj(from).program).egas;
    const norm = (s) => text(s).toLowerCase().replace(/[‐-―]/g, '-').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim()
      .replace(/[\s;.,:]+$/, '').replace(/\s+and$/, '').replace(/[\s;.,:]+$/, '');
    if (p.field === 'vision') {
      return [item(norm(inst.vision) === norm(K.vision), 'outcomes.vision', {}, { found: clip(inst.vision, 160) })];
    }
    if (p.field === 'mission') {
      const m = obj(inst.mission);
      const want = [K.mission.lead].concat(K.mission.items);
      const have = [m.lead].concat(arr(m.items));
      const hits = want.filter((w, k) => norm(w) === norm(have[k])).length;
      return [item(hits / Math.max(want.length, have.length), 'outcomes.mission', {}, { expected: want.length, matching: hits })];
    }
    return K.egas.map((k) => {
      const found = arr(egas).find((e) => Number(obj(e).no) === k.no);
      return item(!!found && norm(obj(found).name) === norm(k.name), 'outcomes.egas.' + k.no, { no: k.no }, { found: found ? clip(obj(found).name, 100) : '' });
    });
  },

  // Every ILO sits under a CLO that builds a graduate attribute (or is tagged with an EGA itself). An ILO with no CLO tag is T-13's.
  iloEgaChain(X) {
    const out = [];
    X.lessons.forEach(({ r, i }) => arr(r.ilos).forEach((il0, j) => {
      const il = obj(il0);
      const ids = iloClos(il);
      if (blank(il.text) || !ids.length) return;
      const ownEga = arr(il.tags).some((t) => parseTag(t).kind === 'ega');
      const viaClo = ids.some((id) => arr(obj(X.clos.find((k) => String(obj(k).id) === id)).egas).length > 0);
      out.push(item(ownEga || viaClo, 'plan[' + i + '].ilos[' + j + ']', { where: weekLabel(r) + ', ILO' + (j + 1) }));
    }));
    return out;
  },

  // A rough, deterministic test that a lesson's content, activities or assessment task talk about its ILO: they share at least one
  // meaningful word (the first letters of each word, so "algorithm" and "algorithms" match). Activities and tasks may also use the
  // lesson's own topic. A blank column is A-01's finding, not this one.
  iloAlignment(X, p) {
    const A = X.K.alignment;
    const stop = new Set(A.stopwords);
    const stems = (s) => new Set(text(s).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= A.minWordLength && !stop.has(w)).map((w) => w.slice(0, A.stemLength)));
    const out = [];
    X.lessons.forEach(({ r, i }) => {
      const ilo = arr(r.ilos).map((il) => text(obj(il).text)).join(' ');
      if (blank(ilo) || blank(r[p.column])) return;
      const want = stems(ilo);
      if (p.column !== 'contents') stems(r.contents).forEach((s) => want.add(s));
      out.push(item([...stems(r[p.column])].some((s) => want.has(s)), 'plan[' + i + '].' + p.column, { where: weekLabel(r) }, { column: p.column }));
    });
    return out;
  },

  // Each lesson's expected values name at least one of the six LCUP core values. A blank cell is the plan columns' finding.
  coreValues(X) {
    const res = X.K.coreValues.map((v) => new RegExp(v.pattern, 'i'));
    return X.lessons.filter(({ r }) => !blank(r.values)).map(({ r, i }) => item(res.some((re) => re.test(text(r.values))), 'plan[' + i + '].values', { where: weekLabel(r) }));
  },

  // The AI's verdict on whether a field means something (see meaning.js): one item per field it looked at, failed when it said the
  // field is not meaningful. Without verdicts (no AI configured, or it failed) the rule does not apply and the scores are the rules' own.
  aiJudged(X, p) {
    return arr(X.ctx.judged).map(obj).filter((e) => e.kind === p.kind && typeof e.path === 'string')
      .map((e) => item(e.ok === true, e.path, { what: text(e.what), reason: clip(e.reason, 120) || 'no reason given' }, { reason: clip(e.reason, 160) }));
  },

  examRowsPerTerm(X) {
    const names = X.plan.filter((r) => obj(r).kind === 'exam').map((r) => lines(obj(r).contents).map(stripMarkup).join(' '));
    return X.K.terms.map((t) => item(names.some((n) => new RegExp(t.pattern, 'i').test(n)), 'plan.exams.' + t.key, { term: t.label }, { term: t.key }));
  },

  gradingHasExam(X) {
    return [item(arr(obj(X.c.grading).rows).some((g) => /exam/i.test(text(obj(g).label))), 'grading.rows')];
  },

  contactUnits(X) {
    const ok = X.unitsOk;
    return [item(ok, 'meta.lecture', { lecture: text(X.meta.lecture).trim() || 'empty', lab: text(X.meta.lab).trim() || 'empty' }, { hoursPerWeek: X.hoursPerWeek, termHours: X.termHours })];
  },

  weeksCover(X, p) {
    const rows = X.plan.map((row, i) => ({ i, ws: weekNums(obj(row).week), raw: text(obj(row).week).trim() }));
    if (p.mode === 'cover') {
      const planned = Object.keys(X.weekHits).map(Number).filter((w) => w >= p.from && w <= p.to).length;
      const expected = p.to - p.from + 1;
      const hours = X.termHours !== null ? ', so the ' + X.termHours + ' contact hours (' + X.hoursPerWeek + ' a week) are not all planned' : '';
      return [item(planned / expected, 'plan', { planned, expected, hours }, { planned, expected, hoursPerWeek: X.hoursPerWeek, termHours: X.termHours })];
    }
    if (p.mode === 'range') {
      return rows.filter((r) => r.raw).map((r) => item(r.ws.length > 0 && r.ws.every((w) => w >= p.from && w <= p.to), 'plan[' + r.i + '].week', { row: r.i + 1, week: r.raw, to: p.to }, { week: r.raw }));
    }
    const doubled = Object.keys(X.weekHits).map(Number).filter((w) => X.weekHits[w] > 1).sort((a, b) => a - b);
    return [item(doubled.length === 0, 'plan', { s: doubled.length > 1 ? 's' : '', weeks: doubled.join(', '), verb: doubled.length > 1 ? '' : 's' }, { weeks: doubled })];
  },
  // The syllabus says it is open to diverse learners, including students with disabilities: any of the description, the requirements or the
  // plan's own columns mentions accommodations, accessibility or inclusion (the standard's `patterns`, matched without regard to case).
  inclusion(X, p) {
    const parts = [arr(X.c.description).map((x) => text(obj(x).t)).join(' '), arr(X.c.reqs).map((x) => text(obj(x).t)).join(' ')];
    X.plan.forEach((r) => parts.push(text(obj(r).contents), text(obj(r).activities), text(obj(r).tasks)));
    const all = parts.join(' ');
    if (blank(all) && !X.plan.length) return [];
    const hit = arr(p.patterns).find((re) => new RegExp(re, 'i').test(all));
    return [item(!!hit, 'reqs', {}, { matched: hit || null })];
  },

  // Repeated data inside one syllabus. Each mode lists the things it looked at in the order they appear; one that repeats an earlier one (the same
  // words, or a near-copy sharing `threshold` of its words) fails, and says which one it repeats. Very short text is only compared whole, since
  // "Quiz" appearing twice is not a copy. `minWords` is how long a text must be to count.
  duplicates(X, p) {
    const minWords = p.minWords || 1;
    const threshold = p.threshold || 0.85;
    const norm = (s) => text(s).split('\n').map(stripMarkup).join(' ').toLowerCase().replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9À-ɏ ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const toks = (s) => norm(s).split(' ').filter(Boolean);
    const similar = (a, b) => {
      if (a.length === 0 || b.length === 0) return 0;
      if (a.length < 4 || b.length < 4) return a.join(' ') === b.join(' ') ? 1 : 0; // short text: only the same words count
      const B = new Set(b);
      const common = new Set(a.filter((w) => B.has(w))).size;
      return common / (new Set(a).size + B.size - common);
    };
    // entries: [{ t, path, vars }] -> an item per entry; an entry that repeats an earlier one fails and names it.
    const scan = (entries, describe) => {
      const seen = [];
      return entries.filter((e) => toks(e.t).length >= minWords).map((e) => {
        const mine = toks(e.t);
        const hit = seen.find((s) => similar(mine, s.tokens) >= threshold);
        seen.push({ tokens: mine, e });
        return hit ? item(false, e.path, describe(e, hit.e), { text: clip(e.t, 100), repeats: clip(hit.e.t, 100) }) : item(true, e.path, describe(e, e));
      });
    };
    const lessonCells = (col) => X.lessons.map(({ r, i }) => ({ t: r[col], path: 'plan[' + i + '].' + col, where: weekLabel(r) })).filter((e) => !blank(e.t));
    const label = { contents: 'course content', activities: 'learning activities', tasks: 'assessment task' };

    if (p.mode === 'ilo') {
      const entries = [];
      X.lessons.forEach(({ r, i }) => arr(r.ilos).forEach((il, j) => { if (!blank(obj(il).text)) entries.push({ t: obj(il).text, path: 'plan[' + i + '].ilos[' + j + ']', where: weekLabel(r) + ', ILO' + (j + 1) }); }));
      return scan(entries, (e, o) => ({ where: e.where, other: o.where, text: clip(e.t, 60) }));
    }
    if (p.mode === 'cells') {
      return ['contents', 'activities', 'tasks'].flatMap((col) => scan(lessonCells(col), (e, o) => ({ where: e.where, other: o.where, column: label[col] })));
    }
    if (p.mode === 'sameRow') {
      return X.lessons.map(({ r, i }) => {
        const cols = ['contents', 'activities', 'tasks'].filter((c) => toks(r[c]).length >= minWords);
        for (let a = 0; a < cols.length; a++) for (let b = a + 1; b < cols.length; b++) {
          if (similar(toks(r[cols[a]]), toks(r[cols[b]])) >= threshold) return item(false, 'plan[' + i + ']', { where: weekLabel(r), a: label[cols[a]], b: label[cols[b]] }, { columns: [cols[a], cols[b]] });
        }
        return item(true, 'plan[' + i + ']', { where: weekLabel(r), a: '', b: '' });
      });
    }
    if (p.mode === 'requirements') {
      const entries = arr(X.c.reqs).map((r, i) => ({ t: obj(r).t, path: 'reqs[' + i + ']', n: i + 1 })).filter((e) => !blank(e.t));
      return scan(entries, (e, o) => ({ n: e.n, m: o.n, text: clip(e.t, 60) }));
    }
    if (p.mode === 'references') {
      const entries = [];
      X.K.refGroups.forEach((g) => arr(obj(obj(X.c.refs)[g.key]).items).forEach((x, k) => { if (!blank(obj(x).t)) entries.push({ t: obj(x).t, path: 'refs.' + g.key + '.items[' + k + ']' }); }));
      return scan(entries, (e) => ({ text: clip(e.t, 70) }));
    }
    if (p.mode === 'grading') {
      const entries = arr(obj(X.c.grading).rows).map((g, i) => ({ t: obj(g).label, path: 'grading.rows[' + i + ']' })).filter((e) => !blank(e.t));
      return scan(entries, (e) => ({ label: clip(e.t, 50) }));
    }
    // description: a sentence written twice, or a course learning outcome copied into it word for word.
    const desc = arr(X.c.description).map((x) => text(obj(x).t)).join(' ').trim();
    if (blank(desc)) return [];
    const sentences = desc.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => toks(s).length >= (p.minWords || 6));
    const kept = new Set();
    const repeated = sentences.find((s) => { const k = toks(s).join(' '); if (kept.has(k)) return true; kept.add(k); return false; });
    const whole = norm(desc);
    const copied = X.clos.findIndex((k) => toks(obj(k).statement).length >= (p.minWords || 6) && whole.indexOf(norm(obj(k).statement)) >= 0);
    const what = repeated ? 'repeats a sentence: "' + clip(repeated, 60) + '"' : copied >= 0 ? 'copies the statement of CLO ' + (copied + 1) + ' word for word' : '';
    return [item(!what, 'description', { what }, { repeated: repeated ? clip(repeated, 100) : '', clo: copied >= 0 ? copied + 1 : null })];
  },
};

export function evaluate(content, standard, ctx = {}) {
  const K = standard.constants;
  const c = obj(content);
  const meta = obj(c.meta);
  const clos = arr(c.clos);
  const plan = arr(c.plan);
  const lessons = plan.map((r, i) => ({ r: obj(r), i })).filter((x) => x.r.kind === 'lesson');
  const snapshot = c.catalog && typeof c.catalog === 'object' ? c.catalog : null;
  const live = ctx.catalog && typeof ctx.catalog === 'object' ? ctx.catalog : null;
  // Tags resolve against what the syllabus is shown with: its stored copy once submitted, otherwise the live catalog.
  const prog = c.outcomes || (snapshot && snapshot.program ? snapshot.program : (live && live.program ? live.program : null));
  const poList = prog && Array.isArray(prog.pos) ? prog.pos : null;
  const egaList = prog && Array.isArray(prog.egas) ? prog.egas : null;

  const weekHits = {};
  plan.forEach((row) => weekNums(obj(row).week).forEach((w) => { weekHits[w] = (weekHits[w] || 0) + 1; }));
  const lecture = parseFloat(meta.lecture);
  const lab = parseFloat(meta.lab);
  const unitsOk = !isNaN(lecture) && !isNaN(lab) && lecture >= 0 && lab >= 0 && lecture <= K.maxUnitsPerPart && lab <= K.maxUnitsPerPart && lecture + lab > 0;
  const hoursPerWeek = unitsOk ? lecture * K.hoursPerLectureUnit + lab * K.hoursPerLabUnit : null;
  const termHours = unitsOk ? hoursPerWeek * K.weeksPerTerm : null;

  const X = {
    c, meta, clos, plan, lessons, K, ctx, snapshot, live, poList, egaList,
    poNos: poList ? poList.map((o) => String(obj(o).no)) : null,
    egaNos: egaList ? egaList.map((e) => String(obj(e).no)) : null,
    cloIds: new Set(clos.map((k) => String(obj(k).id))),
    tagRe: new RegExp(K.tagPattern),
    year: Number.isFinite(ctx.year) ? ctx.year : null,
    weekHits, unitsOk, hoursPerWeek, termHours,
  };

  const areas = standard.areas.map((a) => ({ key: a.key, name: a.name, weight: a.weight, stage: a.stage, wsum: 0, wscore: 0 }));
  const area = Object.fromEntries(areas.map((a) => [a.key, a]));
  const findings = [];
  standard.rules.forEach((rule) => {
    const fn = CHECKS[rule.check];
    if (!fn) throw new Error('Unknown compliance check "' + rule.check + '" in rule ' + rule.id);
    const items = fn(X, rule.params || {});
    if (!items.length) return; // not applicable
    area[rule.area].wsum += rule.weight;
    area[rule.area].wscore += rule.weight * (items.reduce((s, i) => s + i.f, 0) / items.length);
    items.filter((i) => i.f < 1).forEach((i) => findings.push({
      id: rule.id + ':' + i.path, area: rule.area, source: 'rule', ruleId: rule.id, severity: rule.severity, step: rule.step, path: i.path,
      message: fill(i.message || rule.message, i.vars), evidence: i.evidence,
    }));
  });

  // Not enough written yet: say so, rather than showing a row of zeros.
  const reqCount = arr(c.reqs).filter((r) => !blank(obj(r).t)).length;
  const refCount = standard.constants.refGroups.reduce((s, g) => s + arr(obj(obj(c.refs)[g.key]).items).filter((x) => !blank(obj(x).t)).length, 0);
  const grading = obj(c.grading);
  const filledBy = {
    info: !blank(meta.prereq) || !blank(meta.lecture) || !blank(meta.lab) || arr(c.description).some((p) => !blank(obj(p).t)),
    plan: lessons.some(({ r }) => arr(r.ilos).some((il) => !blank(obj(il).text)) || ['contents', 'activities', 'tasks', 'values'].some((k) => !blank(r[k]))),
    reqs: reqCount > 0,
    refs: refCount > 0,
    grade: arr(grading.rows).length > 0,
  };
  const filledSections = standard.insufficient.of.filter((k) => filledBy[k]).length;
  const insufficient = filledSections < standard.insufficient.minFilledSections;

  const scored = areas.map((a) => ({
    key: a.key, name: a.name, weight: a.weight, stage: a.stage,
    score: insufficient || a.wsum === 0 ? null : Math.round((a.wscore / a.wsum) * 100),
  }));
  const live2 = scored.filter((a) => a.score !== null);
  const weightSum = live2.reduce((s, a) => s + a.weight, 0);
  const overall = insufficient || !weightSum ? null : Math.round(live2.reduce((s, a) => s + a.score * a.weight, 0) / weightSum);
  const failed = findings.filter((f) => f.severity === 'blocking');

  return {
    standard: standard.version,
    status: insufficient ? 'insufficient' : 'scored',
    filledSections,
    overall,
    band: overall === null ? null : standard.bands.find((b) => overall >= b.min).label,
    passThreshold: standard.passThreshold,
    passed: overall !== null && overall >= standard.passThreshold && failed.length === 0,
    areas: scored,
    conformance: { ok: failed.length === 0, failed },
    contact: { lecture: isNaN(lecture) ? null : lecture, lab: isNaN(lab) ? null : lab, hoursPerWeek, termHours, weeksPlanned: Object.keys(weekHits).map(Number).filter((w) => w >= 1 && w <= K.weeksPerTerm).length, weeksExpected: K.weeksPerTerm },
    findings,
  };
}
