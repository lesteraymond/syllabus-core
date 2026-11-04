// Pre-requisite (IV) is plain text on the syllabus: each pre-requisite subject as "CODE – Name", or a year standing ("3rd Yr"), separated by "; "
// (a subject's name can contain commas). Older text used commas between bare codes ("IT 202, 3rd Yr"); it is still read. parsePrereq splits the
// text into its pieces, recognising the program's subjects by name first so a comma inside a name is not taken for a separator.
export const SEP = '; ';
export const labelOf = (s) => s.code + ' – ' + s.title;

const lower = (s) => String(s).toLowerCase();

export function parsePrereq(value, subjects = []) {
  const labels = subjects.map(labelOf).sort((a, b) => b.length - a.length);
  let rest = String(value || '').trim();
  const out = [];
  while (rest) {
    rest = rest.replace(/^[\s,;]+/, '');
    if (!rest) break;
    const known = labels.find((l) => lower(rest).startsWith(lower(l)) && /^[\s,;]*$|^[\s]*[,;]/.test(rest.slice(l.length)));
    if (known) { out.push(rest.slice(0, known.length)); rest = rest.slice(known.length); continue; }
    const cut = rest.search(/[,;]/);
    out.push((cut < 0 ? rest : rest.slice(0, cut)).trim());
    rest = cut < 0 ? '' : rest.slice(cut + 1);
  }
  return out.filter(Boolean);
}

export const composePrereq = (tokens) => tokens.join(SEP);
