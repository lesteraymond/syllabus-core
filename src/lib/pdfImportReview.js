// PDF import review helpers only; no checking/scoring or persistence.
const text = value => String(value ?? '').trim();
const codeKey = value => text(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
// Course titles are compared ignoring case and punctuation, with "&" read as "and" and a numeral written either way
// ("Physics II" = "Physics 2"). A trailing "(...)" on either title is optional, but not on both at once, so
// "Physics (Lecture)" and "Physics (Laboratory)" stay different. The server's subject lookup uses this same comparison.
const ROMAN = { I: '1', II: '2', III: '3', IV: '4', V: '5', VI: '6', VII: '7', VIII: '8', IX: '9', X: '10' };
export const titleKey = value => text(value).normalize('NFKC').toUpperCase().replace(/&/g, ' AND ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  .split(' ').map(word => ROMAN[word] ?? word).join(' ');
const withoutNote = value => text(value).replace(/\s*\([^()]+\)\s*$/, '');
export const titleMatches = (a, b) => {
  const A = titleKey(a), B = titleKey(b);
  return !!A && (A === B || A === titleKey(withoutNote(b)) || titleKey(withoutNote(a)) === B);
};

export function importIdentity(fields, meta, context, required = false) {
  const fail = reason => ({ ok: false, reason });
  if (fields.program && text(fields.program).toUpperCase() !== text(meta.program).toUpperCase()) return fail('program');
  if (context) {
    const selected = context.selected;
    if (!selected || selected.id !== meta.courseId || selected.program !== meta.program || selected.code !== meta.code || selected.title !== meta.title) return fail('selection');
    const curricula = context.curricula.filter(c => c.program === selected.program && c.status === 'approved' && (!meta.curriculumYear || c.curriculumYear === meta.curriculumYear));
    if (curricula.length !== 1) return fail('curriculum');
    const courses = curricula[0].courses;
    const candidates = courses.filter(c => codeKey(c.code) === codeKey(fields.code));
    if (!text(fields.code) || !text(fields.title) || candidates.length !== 1) return fail('course');
    const course = candidates[0];
    if (codeKey(course.code) !== codeKey(selected.code) || !titleMatches(fields.title, course.title) || !titleMatches(selected.title, course.title)) return fail('title');
    return { ok: true, program: selected.program, curriculumYear: curricula[0].curriculumYear, course };
  }
  if (required) return fail('context');
  // Standalone mapping remains usable in offline tools. Production Apply requires
  // the server's program-scoped context, even if punctuation/code happen to agree.
  return { ok: (!fields.code || codeKey(fields.code) === codeKey(meta.code)) && (!fields.title || titleMatches(fields.title, meta.title)), unverified: true };
}

export function outcomeReferences(source, label) {
  const pattern = new RegExp(`\\b${label}s?\\s*[:=]?\\s*(\\d+(?:\\s*[-–—]\\s*\\d+)?(?:\\s*[,;.]\\s*\\d+(?:\\s*[-–—]\\s*\\d+)?)*)`, 'gi');
  const values = [], invalid = [];
  const matches = [...String(source).matchAll(pattern)];
  for (const match of matches) {
    if (/^\s*[-–—/]/.test(String(source).slice(match.index + match[0].length))) invalid.push(match[0] + String(source).slice(match.index + match[0].length).match(/^\s*[-–—/]\S*/)[0]);
    for (const part of match[1].split(/[,;.]/)) {
      const [first, last = first] = part.trim().split(/\s*[-–—]\s*/).map(Number);
      if (first < 1 || last < first || last > 50) { invalid.push(match[0]); continue; }
      for (let n = first; n <= last; n++) values.push(n);
    }
  }
  return { values: [...new Set(values)], invalid, matches };
}

export function iloChunks(source) {
  const raw = String(source || '');
  // Labels may be inline, wrapped or unpunctuated. Bracket-only references such
  // as [ILO 1] on an exam row are not new labelled outcome statements.
  const labels = [...raw.matchAll(/\b(?:I\s*LO|LO)\s*\d+(?:\s*[:.]|\s+(?=\p{L}))/giu)].map(m => m.index);
  // Older syllabi list the course outcomes themselves in this column, one per line ("CLO4: Create Java applets ...").
  // A line that opens with such a label, followed by its wording, is one outcome mapped to that CLO. A bare "CLO 1."
  // on its own line is an annotation of the line above, not a new outcome.
  for (const m of raw.matchAll(/(?:^|\n)([^\S\n]*CLO[^\S\n]*\d+[^\S\n]*[:.])[^\S\n]*(?=\p{L})/giu)) labels.push(m.index + m[0].indexOf(m[1]));
  const starts = [0, ...labels].sort((a, b) => a - b).filter((v,i,a)=>a.indexOf(v)===i);
  const chunks = [];
  for (let i = 0; i < starts.length; i++) {
    const block = raw.slice(starts[i], starts[i+1] ?? raw.length).trim();
    if (!block) continue;
    const cloLabel = block.match(/^CLO\s*(\d+)\s*[:.]/i);
    if (cloLabel) { chunks.push({ text: block, ambiguous: false, clo: Number(cloLabel[1]) }); continue; }
    const refs = outcomeReferences(block, 'CLO').matches;
    const last = refs.at(-1);
    let end = last ? last.index + last[0].length : 0;
    if (last) end += block.slice(end).match(/^[\s,)\]]*/)?.[0].length || 0;
    // Prose after the final CLO annotation may be an unlabelled outcome. Keep
    // it separately for review; never transfer that annotation to the suffix.
    if (last && /\p{L}/u.test(block.slice(end))) {
      chunks.push({ text: block.slice(0,end).trim(), ambiguous: true }, { text: block.slice(end).trim(), ambiguous: true });
    } else chunks.push({ text: block, ambiguous: !/^(?:I\s*LO|LO)\s*\d+/i.test(block) });
  }
  return chunks;
}

export function prerequisiteReview(fields, meta, choice) {
  const existing = String(meta.prereq ?? ''), imported = text(fields.prereq);
  if (!existing.trim() || !imported || existing === imported) return { value: imported || existing, conflict: null };
  const decision = choice?.existing === existing && choice?.imported === imported && ['keep','replace'].includes(choice.action) ? choice.action : null;
  return { value: decision === 'replace' ? imported : existing, conflict: { existing, imported, decision } };
}
