'use strict';
const { POLICY } = require('./policy');

// Decimal strings are added as integers at a common scale. Do not round a
// non-100 total into compliance or treat empty/boolean/exponent input as zero.
function gradingTotal(rows) {
  const raw = rows.map(row => row.pct);
  const strings = raw.map(value => String(value ?? '').trim());
  const valid = raw.every((v, i) => ['number', 'string'].includes(typeof v) && /^\d{1,3}(?:\.\d{1,12})?$/.test(strings[i]) && Number(v) <= 100);
  if (!valid) return { valid: false, exact: false, total: null };
  const scale = Math.max(0, ...strings.map(s => s.split('.')[1]?.length || 0));
  const total = strings.reduce((sum, s) => {
    const [whole, fraction = ''] = s.split('.');
    return sum + BigInt(whole + fraction.padEnd(scale, '0'));
  }, 0n);
  return { valid: true, exact: total === 100n * 10n ** BigInt(scale), total: `${total}` , scale };
}

// Reject invalid fragments instead of silently ignoring them (e.g. "1, xyz").
function weeksOf(value) {
  const parts = String(value ?? '').replace(/week/ig, '').split(',');
  const weeks = [];
  for (const raw of parts) {
    const match = raw.trim().match(/^(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?$/);
    if (!match) return null;
    const start = Number(match[1]), end = Number(match[2] || match[1]);
    if (start < POLICY.minWeek || end > POLICY.maxWeek || end < start) return null;
    for (let week = start; week <= end; week++) weeks.push(week);
  }
  return weeks;
}

function mappingChecks(content, masters, check) {
  const clos = content.clos || [];
  const ids = clos.map(clo => clo.id);
  check('CLO-ID', 'clos', ids.length > 0 && ids.every(id => typeof id === 'string' && id.trim()) && new Set(ids).size === ids.length,
    ids, 'Nonempty, unique CLO identifiers', 'Every CLO must have a unique identifier.');
  const references = [['pos', masters.pos], ['egas', masters.institution?.egas]];
  clos.forEach((clo, i) => {
    for (const [key, master] of references) {
      const selected = clo[key] || [];
      const available = Array.isArray(master) && master.length > 0;
      const ok = Array.isArray(selected) && selected.length > 0 && new Set(selected).size === selected.length && selected.every(no => master?.some(row => row.no === no));
      check('CLO-MAP', `clos[${i}].${key}`, available ? ok : null, selected, master?.map(row => row.no) || [],
        available ? `Select existing, unique official ${key.toUpperCase()} for this CLO.` : `Official ${key.toUpperCase()} references are unavailable.`, { step: 'clos' });
    }
  });
  (content.plan || []).forEach((row, i) => {
    if (row.kind === 'exam') return;
    (row.ilos || []).forEach((ilo, j) => {
      if (!String(ilo.text || '').trim()) return;
      const tags = ilo.tags || [];
      const selected = tags.filter(tag => typeof tag === 'string' && tag.startsWith('clo:')).map(tag => tag.slice(4));
      check('ILO-MAP', `plan[${i}].ilos[${j}].tags`, selected.length > 0 && new Set(selected).size === selected.length && selected.every(id => ids.includes(id)), selected, ids,
        'Map every lesson ILO to at least one existing CLO without duplicate mappings.', { step: 'plan' });
    });
  });
}
module.exports = { gradingTotal, weeksOf, mappingChecks };
