// Layout recovery only. No generated syllabus wording, outcome inference or AI.
// Coordinates use displayed-page pixels/points, with the origin at the top left.
const near = (a, b) => Math.abs(a - b) < 2;
function clusters(values) {
  const groups = [];
  for (const value of [...values].sort((a, b) => a - b)) {
    const group = groups.at(-1);
    if (group && Math.abs(group.at(-1) - value) < 2) group.push(value); else groups.push([value]);
  }
  return groups.map(group => group.reduce((a, b) => a + b, 0) / group.length);
}
function textLines(items, positions = false) {
  const lines = [];
  for (const item of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    if (!item.text?.trim()) continue;
    let line = lines.find(line => Math.abs(line.y - item.y) < Math.min(3, Math.max(1.5, item.height * .25)));
    if (!line) { line = { y: item.y, items: [] }; lines.push(line); }
    line.items.push(item);
  }
  return lines.sort((a, b) => a.y - b.y).map(line => {
    let previous;
    const text = line.items.sort((a, b) => a.x - b.x).map(item => {
      const gap = previous && item.x - previous.x - previous.width > Math.max(.8, item.height * .1) ? ' ' : '';
      previous = item;
      return gap + item.text;
    }).join('').replace(/[ \t]+/g, ' ').trim();
    return positions ? { text, y: line.y } : text;
  }).filter(line => positions ? line.text : line);
}
function paragraphs(items) {
  return textLines(items).reduce((result, line) => {
    const starts = /^(?:[•●▪\u2022-]\s|(?:CLO|ILO|EGA|PO)\s*\d+\s*[.:]|\d+[.)]\s|[A-Z][.)]\s)/i.test(line);
    return result + (result ? starts ? '\n' : ' ' : '') + line;
  }, '');
}
const cellItems = (page, band, xs, index) => page.items.filter(item => {
  const center = item.x + Math.min(item.width / 2, 3);
  const middle = item.y + item.height / 2;
  return center >= xs[index] - 1 && center < xs[index + 1] - 1 && middle > band.top + 1 && middle < band.bottom - 1;
});
function tableBands(page) {
  const vertical = page.boxes.filter(b => b.right - b.left <= 2 && b.bottom - b.top >= 8);
  const groups = [];
  for (const b of vertical) {
    let group = groups.find(g => near(g.top, b.top) && near(g.bottom, b.bottom));
    if (!group) { group = { top: b.top, bottom: b.bottom, xs: [] }; groups.push(group); }
    group.xs.push((b.left + b.right) / 2);
  }
  // Other PDF writers draw full-height column lines and full-width row lines.
  const horizontal = page.boxes.filter(b => b.bottom - b.top <= 2 && b.right - b.left >= 30);
  const bars = [];
  for (const y of clusters(horizontal.map(b => (b.top + b.bottom) / 2))) {
    const parts = horizontal.filter(b => Math.abs((b.top + b.bottom) / 2 - y) < 2).sort((a, b) => a.left - b.left);
    let merged;
    for (const part of parts) {
      if (merged && part.left <= merged.right + 2) merged.right = Math.max(merged.right, part.right);
      else { merged = { left: part.left, right: part.right, y }; bars.push(merged); }
    }
  }
  for (const top of bars) {
    const bottom = bars.filter(b => b.y > top.y + 8 && near(b.left, top.left) && near(b.right, top.right)).sort((a, b) => a.y - b.y)[0];
    if (!bottom) continue;
    const xs = vertical.filter(b => b.top <= top.y + 2 && b.bottom >= bottom.y - 2 && b.left >= top.left - 2 && b.right <= top.right + 2).map(b => (b.left + b.right) / 2);
    if (xs.length >= 2) groups.push({ top: top.y, bottom: bottom.y, xs });
  }
  const result = [];
  for (const group of groups) {
    group.xs = clusters(group.xs);
    if (group.xs.length < 2) continue;
    const previous = result.find(b => near(b.top, group.top) && near(b.bottom, group.bottom) && near(b.xs[0], group.xs[0]) && near(b.xs.at(-1), group.xs.at(-1)));
    if (!previous) result.push(group); else if (group.xs.length > previous.xs.length) previous.xs = group.xs;
  }
  return result.sort((a, b) => a.top - b.top);
}
const normalized = s => s.toUpperCase().replace(/[^A-Z]/g, '');
function headerOf(cells) {
  const labels = cells.map(normalized);
  const index = expression => labels.findIndex(label => expression.test(label));
  if (cells.length === 6) {
    const keys = { week: index(/SCHEDULE|WEEK/), ilo: index(/INTENDED.*OUTCOME|^ILO/), contents: index(/(?:COURSE|LEARNING)CONTENT|TOPIC/), activities: index(/LEARNINGACTIVIT|^SLA/), tasks: index(/ASSESSMENT|^SAT/), values: index(/VALUE|INTEGRATED/) };
    if (Object.values(keys).every(n => n >= 0) && new Set(Object.values(keys)).size === 6) return { kind: 'plan', keys };
  }
  if (cells.length === 3 && index(/GRADUATEATTRIBUTE/) >= 0 && index(/PROGRAMOUTCOME/) >= 0 && index(/COURSELEARNINGOUTCOME/) >= 0) return { kind: 'outcomes', keys: { egas: index(/GRADUATEATTRIBUTE/), pos: index(/PROGRAMOUTCOME/), clos: index(/COURSELEARNINGOUTCOME/) } };
  if (cells.length === 2 && labels.includes('VISION') && labels.includes('MISSION')) return { kind: 'institution', keys: { vision: labels.indexOf('VISION'), mission: labels.indexOf('MISSION') } };
  return null;
}
function recoverTables(pages) {
  const fields = {}, planRows = [], warnings = [];
  let table = null;
  for (const page of pages) {
    const stops = textLines(page.items, true).filter(item => /^(?:VIII|IX|X)\s*[.):]?\s*(?:COURSE REQUIREMENTS|REFERENCES|GRADING SYSTEM)/i.test(item.text.trim()));
    for (const band of tableBands(page)) {
      if (stops.some(item => item.y < band.top)) table = null;
      if (band.xs.length === 2 && band.bottom - band.top < page.height * .9 && stops.some(item => item.y >= band.top && item.y < band.bottom)) { table = null; continue; }
      const cells = band.xs.slice(0, -1).map((_, i) => paragraphs(cellItems(page, band, band.xs, i)));
      const header = headerOf(cells);
      if (header) { table = { ...header, xs: band.xs, width: page.width }; continue; }
      if (!table) continue;
      const xs = table.xs.map(x => x * page.width / table.width);
      if (!near(xs[0], band.xs[0]) || !near(xs.at(-1), band.xs.at(-1))) continue;
      const content = xs.slice(0, -1).map((_, i) => paragraphs(cellItems(page, band, xs, i)));
      if (!content.some(Boolean)) continue;
      if (table.kind !== 'plan') {
        for (const [key, index] of Object.entries(table.keys)) if (content[index]) fields[key] = (fields[key] ? fields[key] + '\n' : '') + content[index];
        continue;
      }
      const row = Object.fromEntries(Object.entries(table.keys).map(([key, index]) => [key, content[index]]));
      const week = row.week.replace(/^weeks?\s*/i, '').replace(/\s/g, '').replace(/[–—]/g, '-');
      const exam = /^(?:PRELIM(?:INARY)?|MIDTERM|FINALS?)\s+EXAM(?:INATION)?S?$/i.test(row.contents.trim());
      if (exam) row.kind = 'exam';
      if (/^\d+(?:[-,]\d+)*$/.test(week)) {
        planRows.push({ ...row, week, kind: row.kind || 'lesson', sourcePages: [page.number] });
      } else if (!week && planRows.length && !exam) {
        const previous = planRows.at(-1);
        for (const key of ['ilo', 'contents', 'activities', 'tasks', 'values']) if (row[key]) previous[key] += (previous[key] ? '\n' : '') + row[key];
        if (!previous.sourcePages.includes(page.number)) previous.sourcePages.push(page.number);
      } else warnings.push({ page: page.number, code: 'ambiguous_plan_row', observedWeek: row.week });
    }
  }
  return { fields, planRows, warnings };
}
module.exports = { textLines, paragraphs, tableBands, recoverTables };
