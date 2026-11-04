'use strict';
// Edits to a syllabus form as plain data, so a suggestion can be shown, accepted, undone and scored before it is accepted. The same code is in
// server/lib/compliance/formOps.js and src/lib/formOps.js (formOps.parity.test.js keeps them the same): the server uses it to estimate the
// score with every suggestion applied, the builder to apply one.
//
// A path names a field by its keys, and an item of a list by its id (stable when other edits add or remove rows) or its position:
//   description    reqs[id=q1].t    plan[id=r3].ilos[id=i7].text    plan[id=r3].tasks    grading.rows[id=g1].pct    plan[2].week
//
// Operations:
//   { op: 'set', path, value }               set a field ('description' takes text and makes paragraphs of it)
//   { op: 'insert', path, beforeId, value }  put `value` in the list at `path`, before the item with that id (the end when beforeId is empty)
//   { op: 'remove', path }                   remove the list item the path names
//   { op: 'reorder', path, ids }             put the list at `path` in the order of `ids` (items not named follow)
//   { op: 'sortPlan' }                       order the Learning Plan by week
// applyOps changes `content` in place and returns the operations that undo it, or null when one cannot be done (the form is then left
// as it was).

const isObj = (x) => x !== null && typeof x === 'object';
const clone = (x) => JSON.parse(JSON.stringify(x));

function parsePath(path) {
  const out = [];
  for (const part of String(path).split('.')) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)(?:\[(?:id=([^\]]+)|(\d+))\])?$/.exec(part);
    if (!m) return null;
    out.push({ key: m[1], id: m[2], index: m[3] === undefined ? undefined : Number(m[3]) });
  }
  return out.length ? out : null;
}

// -> { parent, key } where parent[key] is the thing the path names (key is a property name, or an index into a list when the path ends in a
// list item); null when something on the way is missing.
function locate(content, path) {
  const segs = parsePath(path);
  if (!segs) return null;
  let node = content;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (!isObj(node)) return null;
    const last = i === segs.length - 1;
    if (s.id === undefined && s.index === undefined) {
      if (last) return { parent: node, key: s.key };
      node = node[s.key];
    } else {
      const list = node[s.key];
      if (!Array.isArray(list)) return null;
      const at = s.id !== undefined ? list.findIndex((x) => isObj(x) && String(x.id) === s.id) : s.index;
      if (at < 0 || at >= list.length) return null;
      if (last) return { parent: list, key: at };
      node = list[at];
    }
  }
  return null;
}

const getValue = (content, path) => { const at = locate(content, path); return at ? at.parent[at.key] : undefined; };

const weekKey = (row) => { const m = /\d+/.exec(String(row && row.week != null ? row.week : '')); return m ? Number(m[0]) : Infinity; };
const sortedIds = (plan) => plan.map((r, i) => ({ id: r.id, i, w: weekKey(r) })).sort((a, b) => a.w - b.w || a.i - b.i).map((x) => x.id);

function reorder(list, ids) {
  const byId = new Map(list.map((x) => [String(x.id), x]));
  const named = ids.map((id) => byId.get(String(id))).filter(Boolean);
  const rest = list.filter((x) => !ids.map(String).includes(String(x.id)));
  list.splice(0, list.length, ...named, ...rest);
}

function applyOne(content, o) {
  if (!isObj(o)) return null;
  if (o.op === 'set') {
    const at = locate(content, o.path);
    if (!at) return null;
    const old = at.parent[at.key];
    if (o.path === 'description' && typeof o.value === 'string') {
      const lines = o.value.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return null;
      const before = Array.isArray(old) ? old : [];
      at.parent[at.key] = lines.map((t, i) => ({ ...(before[i] || {}), t }));
    } else at.parent[at.key] = clone(o.value);
    return [{ op: 'set', path: o.path, value: clone(old) }];
  }
  if (o.op === 'insert') {
    const at = locate(content, o.path);
    const list = at && at.parent[at.key];
    if (!Array.isArray(list) || !isObj(o.value) || o.value.id === undefined) return null;
    if (list.some((x) => isObj(x) && String(x.id) === String(o.value.id))) return null;
    const idx = o.beforeId ? list.findIndex((x) => isObj(x) && String(x.id) === String(o.beforeId)) : -1;
    list.splice(idx < 0 ? list.length : idx, 0, clone(o.value));
    return [{ op: 'remove', path: o.path + '[id=' + o.value.id + ']' }];
  }
  if (o.op === 'remove') {
    const at = locate(content, o.path);
    const m = /^(.*)\[id=([^\]]+)\]$/.exec(String(o.path));
    if (!at || !m || !Array.isArray(at.parent)) return null;
    const next = at.parent[at.key + 1];
    const removed = at.parent.splice(at.key, 1)[0];
    return [{ op: 'insert', path: m[1], beforeId: next && isObj(next) ? next.id : null, value: removed }];
  }
  if (o.op === 'reorder') {
    const at = locate(content, o.path);
    const list = at && at.parent[at.key];
    if (!Array.isArray(list) || !Array.isArray(o.ids)) return null;
    const was = list.map((x) => x.id);
    reorder(list, o.ids);
    return [{ op: 'reorder', path: o.path, ids: was }];
  }
  if (o.op === 'sortPlan') {
    if (!Array.isArray(content.plan)) return null;
    const was = content.plan.map((x) => x.id);
    reorder(content.plan, sortedIds(content.plan));
    return [{ op: 'reorder', path: 'plan', ids: was }];
  }
  return null;
}

function applyOps(content, ops) {
  const trial = clone(content);
  const undo = [];
  for (const o of ops) {
    const inv = applyOne(trial, o);
    if (!inv) return null;
    undo.unshift(...inv);
  }
  // It worked on the copy: do it for real.
  for (const o of ops) applyOne(content, o);
  return undo;
}

// What the form holds now at each place a suggestion was written for. True only while every one still has the same text (spacing and
// case do not matter): a suggestion is not applied over something the author wrote in the meantime.
const squash = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().toLowerCase() : JSON.stringify(v));
function holds(content, expect) {
  return (Array.isArray(expect) ? expect : []).every((e) => {
    const now = e.path === 'description' ? (Array.isArray(content.description) ? content.description.map((p) => (p && p.t) || '').join('\n') : undefined) : getValue(content, e.path);
    return now !== undefined && squash(now) === squash(e.value);
  });
}

module.exports = { parsePath, getValue, applyOps, holds, sortedIds };
