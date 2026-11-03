'use strict';
// A SHADOW score, calculated next to the official one and never used in its place. It exists to compare the official model with a
// proposed one on real syllabi before anyone decides to change the policy. The official score (engine.js) is unchanged.
//
// Why a proposal at all: the official deductions are uncapped and per relationship, so
//   - one field that takes part in several relationships (a CLO tagged to many POs, an ILO judged against its activity AND its task)
//     is charged once for every one of them, though a single rewrite would fix them together, and
//   - on a long syllabus the sum can take the score to 0 whatever the fixed rules say.
// The shadow model charges each field once (its most serious relationship) and limits what each kind of finding can take off.
const SHADOW = Object.freeze({
  version: 'shadow-1',
  perField: true,                        // a field costs the most serious deduction among its relationships, not their sum
  caps: Object.freeze({ alignment: 30, link: 10, value: 10 }), // most points each kind of deduction may take off in total
});

function shadowOf({ base, deductions, critical, shadow = SHADOW }) {
  const kindOf = d => d.kind || (String(d.id).startsWith('LINK:') ? 'link' : String(d.id).startsWith('VALUE:') ? 'value' : 'alignment');
  const taken = { alignment: 0, link: 0, value: 0 };
  const byField = new Map();
  for (const d of deductions) {
    const kind = kindOf(d);
    if (shadow.perField && d.path) {
      const key = `${kind}:${d.path}`;
      byField.set(key, Math.max(byField.get(key) || 0, d.points));
    } else taken[kind] += d.points;
  }
  for (const [key, points] of byField) taken[key.split(':')[0]] += points;
  const capped = [];
  let total = 0;
  for (const kind of Object.keys(taken)) {
    const limit = shadow.caps[kind];
    if (taken[kind] > limit) capped.push({ kind, wouldTake: taken[kind], takes: limit });
    total += Math.min(taken[kind], limit);
  }
  const score = critical ? 0 : Math.max(0, (base ?? 0) - total);
  return { version: shadow.version, score, deducted: total, byKind: taken, capped, perField: shadow.perField, caps: { ...shadow.caps } };
}

module.exports = { SHADOW, shadowOf };
