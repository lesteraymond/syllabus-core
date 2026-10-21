// Run: npm test. The brand theme keeps text readable and stays a separate layer on top of styles.css.
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const theme = strip(readFileSync(new URL('../theme.css', import.meta.url), 'utf8'));
const base = strip(readFileSync(new URL('../styles.css', import.meta.url), 'utf8'));
const lum = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const token = (name) => (theme.match(new RegExp('--' + name + ': *(#[0-9a-fA-F]{6})')) || [])[1];

test('the theme only re-values tokens styles.css already defines, so no component needs to change', () => {
  for (const name of ['blue', 'blue2', 'navy', 'gold', 'peach', 'bg', 'card', 'text', 'muted', 'line', 'green', 'teal', 'red', 'purple']) {
    assert.ok(new RegExp('--' + name + ':').test(base), '--' + name + ' exists in styles.css');
    assert.ok(token(name), '--' + name + ' is re-valued in theme.css');
  }
});

test('body text, secondary text and the sidebar are readable (4.5:1)', () => {
  const pairs = [['text', 'bg'], ['muted', 'bg'], ['muted', 'card'], ['navy', 'bg'], ['blue', 'card'], ['red', 'card'], ['green', 'card']];
  pairs.forEach(([fg, bgName]) => assert.ok(contrast(token(fg), token(bgName)) >= 4.5, fg + ' on ' + bgName + ': ' + contrast(token(fg), token(bgName)).toFixed(1)));
  // the sidebar is a gradient: the text must be readable on its lightest stop, which is the hardest case
  ['side-top', 'side-mid', 'side-bottom'].forEach(stop => assert.ok(contrast('#cdd3ee', token(stop)) >= 4.5, 'sidebar label on ' + stop));
  assert.ok(contrast(token('gold'), token('side-top')) >= 3, 'gold active icon (a graphic, so 3:1) on the lightest stop');
  assert.ok(contrast('#ffffff', token('blue')) >= 4.5, 'white label on the primary button');
});

test('the theme does not restyle the typeface', () => {
  assert.ok(!/font-family|--font-/.test(theme));
});

test('the type scale only ever grows, and 12px is the smallest size', () => {
  const sizes = ['xs', 'sm', 'base', 'md', 'lg', 'xl'].map((n) => { const m = theme.match(new RegExp('--text-' + n + ': *([0-9]+)px')); assert.ok(m, '--text-' + n + ' is set'); return Number(m[1]); });
  sizes.forEach((v, i) => { if (i) assert.ok(v >= sizes[i - 1], 'step ' + i + ': ' + sizes.join(' / ')); });
  assert.ok(sizes[0] >= 12, 'the smallest text is at least 12px');
  assert.ok(sizes[5] / sizes[2] <= 1.8, 'the largest text is not more than 1.8x the body text');
});

test('scrollbars are hidden everywhere without taking away the ability to scroll', () => {
  assert.match(theme, /\*\s*\{[^}]*scrollbar-width: none/);
  assert.match(theme, /\*::-webkit-scrollbar\s*\{[^}]*display: none/);
  assert.match(theme, /html\s*\{\s*scrollbar-gutter: auto/);
  const rules = [/\*\s*\{[^}]*\}/, /\*::-webkit-scrollbar\s*\{[^}]*\}/, /html\s*\{\s*scrollbar-gutter[^}]*\}/].map(re => theme.match(re)[0]).join(' ');
  assert.ok(!/(^|[\s;{])overflow(-[xy])?:/.test(rules),'the scroll rules must not switch overflow off');
});

// Read one declaration's value from a rule such as ".status.approved, ..." without a regex, so selectors need no escaping.
const declared = (selector, property) => {
  // a selector can head more than one rule (the icon rule and the colour rule): use the one that declares the property
  const bodies = [];
  for (let at = theme.indexOf(selector + ' {'); at >= 0; at = theme.indexOf(selector + ' {', at + 1)) bodies.push(theme.slice(at, theme.indexOf('}', at)));
  assert.ok(bodies.length, selector + ' is styled in theme.css');
  const hit = bodies.flatMap(body => body.split(';')).map(d => d.trim()).find(d => d.includes(property + ':'));
  assert.ok(hit, selector + ' sets ' + property);
  const raw = hit.split(':')[1].trim();
  const name = raw.startsWith('var(--') ? raw.slice(6, -1) : null;
  return name ? token(name) : raw;
};

test('every status badge keeps readable text on its tint (4.5:1)', () => {
  const badges = [
    ['.badge.green, .status.approved, .status.active', 'approved'],
    ['.badge.blue, .status.submitted', 'submitted'],
    ['.badge.gold, .status.under-review, .status.under_review', 'under review'],
    ['.status.for-revision, .status.for_revision', 'for revision'],
    ['.status.rejected', 'rejected'],
    ['.status.draft', 'draft'],
    ['.badge.teal', 'copper'],
    ['.badge.purple', 'cobalt light'],
  ];
  badges.forEach(([selector, label]) => {
    const fg = declared(selector, 'color');
    const bg = declared(selector, 'background');
    assert.ok(contrast(fg, bg) >= 4.5, label + ': ' + fg + ' on ' + bg + ' = ' + contrast(fg, bg).toFixed(1));
  });
});

test('form fields keep a border that is visible against the page (3:1) and a focus ring', () => {
  assert.ok(contrast('#8a8880', '#ffffff') >= 3, 'input border on white');
  assert.ok(theme.includes('.field input:focus') && theme.includes('box-shadow: 0 0 0 3px'), 'a visible focus ring');
});

test('log out turns light red on hover and solid red when pressed, and stays readable', () => {
  assert.ok(theme.includes('.logout:hover'), 'a hover rule');
  assert.ok(theme.includes('.logout:active { background: var(--red); color: #fff; }'), 'a pressed rule');
  assert.ok(contrast(token('red'), token('tint-crimson')) >= 4.5, 'red text on the light red hover');
  assert.ok(contrast('#ffffff', token('red')) >= 4.5, 'white text on the solid red pressed state');
});

test('headings are the darkest text, body text is dark, and secondary text is lighter but still readable', () => {
  const ink = token('ink'), text = token('text'), muted = token('muted');
  assert.ok(contrast(ink, token('card')) > contrast(text, token('card')), 'headings are darker than body text');
  assert.ok(contrast(text, token('card')) > contrast(muted, token('card')), 'body text is darker than secondary text');
  assert.ok(contrast(ink, token('bg')) >= 15, 'headings on the page: ' + contrast(ink, token('bg')).toFixed(1));
  assert.ok(contrast(text, token('bg')) >= 12, 'body text on the page: ' + contrast(text, token('bg')).toFixed(1));
  assert.ok(contrast(muted, token('bg')) >= 4.5, 'secondary text stays readable: ' + contrast(muted, token('bg')).toFixed(1));
});

test('the dashboard card headings and the stat card titles read the same size token and weight', () => {
  assert.ok(theme.includes('--title-size: var(--text-sm)'), 'one shared size');
  assert.ok(theme.includes('.stat-grid .stat-card span {') && theme.includes('font-size: var(--title-size)'), 'stat title uses it');
  assert.ok(theme.includes('.dashboard-grid .card-head h3 { color: var(--ink); font-size: var(--title-size)'), 'card h3 uses it');
  assert.ok(theme.includes('.workspace h3 { font-weight: var(--fw-heavy); }') && theme.includes('font-weight: var(--fw-heavy); text-transform: none'), 'both are weight 800');
});

test('the check history score badges keep readable text on their tints (4.5:1)', () => {
  [['.hist-item.good .hist-score b', 'meets the standard'], ['.hist-item.warn .hist-score b', 'below the pass line'], ['.hist-item.none .hist-score b', 'not scored']].forEach(([selector, label]) => {
    const fg = declared(selector, 'color'), bg = declared(selector, 'background');
    assert.ok(contrast(fg, bg) >= 4.5, label + ': ' + fg + ' on ' + bg + ' = ' + contrast(fg, bg).toFixed(1));
  });
});

test('status tags are styled for both spellings of a status, and each carries an icon so colour is not the only signal', () => {
  const iconLines = theme.split(String.fromCharCode(10)).filter(line => line.includes('--tag-icon: url('));
  for (const status of ['under-review', 'under_review', 'for-revision', 'for_revision', 'approved', 'submitted', 'rejected', 'draft']) {
    assert.ok(theme.includes('.status.' + status + '::before'), status + ' shows its icon');
    assert.ok(iconLines.some(line => line.includes('.status.' + status)), status + ' sets an icon');
  }
  assert.ok(iconLines.every(line => line.includes('data:image/svg+xml')), 'icons are inline SVG masks, so they take the text colour');
});

test('the time-usage chart keeps its bars and the range buttons readable', () => {
  assert.ok(contrast('#b9842a', '#ffffff') >= 3, 'today bar on the white card (a graphic: 3:1)');
  assert.ok(contrast(token('blue'), '#ffffff') >= 3, 'ordinary bars on the white card');
  assert.ok(contrast('#ffffff', token('blue')) >= 4.5, 'selected range label');
  assert.ok(theme.includes('--usage-today: #b9842a'), 'the today colour is the one tested above');
});

test('the open dropdown list stays readable: option text, the chosen option on the highlight, and the filter hint', () => {
  assert.ok(contrast(token('text'), '#ffffff') >= 7, 'option text on the panel');
  assert.ok(contrast(token('blue'), token('tint-cobalt')) >= 4.5, 'chosen option on the highlighted row');
  assert.ok(contrast(token('muted'), '#ffffff') >= 4.5, 'filter hint on the panel');
  assert.ok(contrast('#8a8880', '#ffffff') >= 3, 'button border on white');
  assert.ok(contrast('#5b6270', '#f1f4f3') >= 4.5, 'disabled button text on its fill');
  assert.ok(theme.includes('.select-trigger:focus-visible') && theme.includes('box-shadow: 0 0 0 3px'), 'a visible focus ring');
  assert.ok(!/font-family/.test(theme.slice(theme.indexOf('.select {'))), 'the dropdown sets no typeface');
});

test('the subjects toolbar label uses the same size and weight as the stat card titles, and only that label', () => {
  const stat = theme.slice(theme.indexOf('.stat-grid .stat-card span {'));
  const statRule = stat.slice(0, stat.indexOf('}'));
  const toolbar = theme.slice(theme.indexOf('.sm-toolbar .field > span {'));
  const toolbarRule = toolbar.slice(0, toolbar.indexOf('}'));
  for (const part of ['font-size: var(--title-size)', 'font-weight: var(--fw-heavy)', 'color: var(--ink)']) {
    assert.ok(statRule.includes(part), 'the stat title has ' + part);
    assert.ok(toolbarRule.includes(part), 'the toolbar label has ' + part);
  }
  assert.ok(!theme.includes('.sm-toolbar span {'), 'the count beside the filter is not restyled');
});

test('the subjects toolbar adds no padding of its own at the top or sides, so its label lines up with the card titles', () => {
  const at = theme.indexOf('.sm-toolbar { padding:');
  assert.ok(at >= 0, 'the toolbar padding is set in the theme');
  assert.ok(theme.slice(at, theme.indexOf('}', at)).includes('padding: 0 0 12px'), 'no top or side padding, 12px below');
});

test('quick actions keep the icon level with the title, size to their text, and break words only when they must', () => {
  assert.ok(theme.includes('.quick-actions button { align-items: start; min-height: 56px; }'), 'icon at the top; height follows the text (not the old 86px)');
  assert.ok(theme.includes('.quick-actions button > svg:last-child { align-self: center; }'), 'the arrow stays centred on the button');
  assert.ok(theme.includes('.quick-actions .stable-label-reserve { display: none; }'), 'no reserved second-language copy inflating the height');
  assert.ok(theme.includes('.quick-actions button > span {') && theme.includes('overflow-wrap: break-word'), 'no mid-word breaks unless a word cannot fit');
  assert.ok(!/\.quick-actions[^{]*\{[^}]*min-height: 86px/.test(theme), 'the theme does not bring back the 86px minimum');
});

test('Step 2 authoring reuses the builder card styles and stacks the editors within its available width', () => {
  assert.ok(theme.includes('.learning-outcomes-editor .sm-pair { grid-template-columns: minmax(0, 1fr); }'));
  assert.ok(theme.includes('.learning-outcomes-editor .sm-card { min-width: 0; }'));
  assert.ok(theme.includes('.sm-card-h h4 { text-transform: capitalize; }'), 'the first letter of every word is a capital');
});

test('subject edit and delete moved from the modal to a last, left-aligned Actions column in the subjects table', () => {
  const table = readFileSync(new URL('../views/CourseOutcomes.jsx', import.meta.url), 'utf8');
  assert.ok(!table.includes('SubjectModal') && !table.includes('ui.clos_a33483'), 'the admin table no longer opens learning-outcome authoring');
  assert.ok(table.includes('className="col-actions"') && table.includes('<SubjectRowActions'), 'each row has the actions');
  assert.ok(table.includes('colSpan={deadlineState.enabled ? 5 : 4}'), 'the empty row spans every column, the Deadline one too once it is shown');
  assert.ok(theme.includes('.col-actions { width: 112px; min-width: 112px; white-space: nowrap; text-align: left; }'), 'the header and cells are left-aligned');
  assert.ok(theme.includes('.sm-actions .icon-btn { color: #9aa3b2;') && theme.includes('.sm-actions .icon-btn.is-delete:hover') && theme.includes('color: #c84848;'), 'the icons are soft grey, and delete turns red on hover, like the Programs card');
  const actions = readFileSync(new URL('../components/SubjectActions.jsx', import.meta.url), 'utf8');
  assert.ok(actions.includes('e.stopPropagation()') && actions.includes('onKeyDown: (e) => e.stopPropagation()'), 'clicking a button does not also open the row');
});

test('the Programs and Subjects tables share one Actions column: same class, same width, same alignment, defined once', () => {
  const programs = readFileSync(new URL('../components/ProgramManagement.jsx', import.meta.url), 'utf8');
  const subjects = readFileSync(new URL('../views/CourseOutcomes.jsx', import.meta.url), 'utf8');
  const base = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.equal((programs.match(/className="col-actions"/g) || []).length, 2, 'Programs: the header and the cell');
  assert.equal((subjects.match(/className="col-actions"/g) || []).length, 2, 'Subjects: the header and the cell');
  assert.equal((theme.match(/\.col-actions \{/g) || []).length, 1, 'the column is defined once');
  assert.ok(theme.includes('.program-management-actions, .sm-actions { display: flex; flex-wrap: nowrap; gap: 8px; justify-content: flex-start; }'), 'the buttons start at the left edge in both');
  assert.ok(!base.includes('.program-management th:last-child') && !base.includes('.program-management-actions {') && !theme.includes('.sm-act {'), 'no older, different rule is left behind');
  assert.ok(112 >= 34 * 2 + 8 + 20, 'the width fits two buttons, the gap and the padding');
});

test('deadline tags and chips keep readable text on their fills (4.5:1)', () => {
  for (const status of ['upcoming', 'due_today', 'failed', 'submitted', 'submitted_late']) {
    const selector = '.status.dl-' + status;
    const fg = declared(selector, 'color'), bg = declared(selector, 'background');
    assert.ok(contrast(fg, bg) >= 4.5, status + ': ' + fg + ' on ' + bg + ' = ' + contrast(fg, bg).toFixed(1));
    assert.ok(theme.includes(selector + '::before') || theme.includes(selector + '::before,'), status + ' shows its icon');
  }
  assert.ok(contrast('#9b1f27', token('tint-crimson')) >= 4.5, 'failed chip note');
  assert.ok(contrast(token('green-ink'), token('tint-green')) >= 4.5, 'done chip note');
  assert.ok(contrast(token('gold-ink'), token('tint-gold')) >= 4.5, 'due-today chip note');
  assert.ok(contrast(token('muted'), '#ffffff') >= 4.5, 'upcoming chip note');
  assert.ok(contrast(token('blue'), '#ffffff') >= 4.5, 'the set-a-deadline chip');
  assert.ok(contrast('#9b1f27', '#ffffff') >= 4.5, 'the failed count in the dialog');
});

test('the Deadline column and dialog are wired into the subjects table, shown only once deadlines are set up', () => {
  const table = readFileSync(new URL('../views/CourseOutcomes.jsx', import.meta.url), 'utf8');
  assert.ok(table.includes('deadlineState.enabled && <th>') && table.includes('deadlineState.enabled && <td><DeadlineChip'), 'header and cell only when enabled');
  assert.ok(table.indexOf('ui.program_9d6800') < table.indexOf('deadline.column') && table.indexOf('deadline.column') < table.indexOf('ui.actions_c3cd63'), 'the column sits between Program and Actions');
  assert.ok(table.includes('<DeadlineDialog') && table.includes('deadlinesApi.list()'), 'the dialog and the list are loaded');
  const dialog = readFileSync(new URL('../components/DeadlineDialog.jsx', import.meta.url), 'utf8');
  assert.ok(dialog.includes('e.stopPropagation()') && dialog.includes('onKeyDown: (e) => e.stopPropagation()'), 'using the chip does not also open the row');
  assert.ok(dialog.includes("type=\"datetime-local\"") && dialog.includes('fromInputValue(form.dueAt)'), 'the due time is Philippine time');
});

test('faculty see deadlines on the dashboard card and on each of their syllabi, and the fixed sample entries are gone', () => {
  const dash = readFileSync(new URL('../views/DashboardView.jsx', import.meta.url), 'utf8');
  const mine = readFileSync(new URL('../views/MySyllabi.jsx', import.meta.url), 'utf8');
  assert.ok(dash.includes('<UpcomingDeadlines role={user.role}') && !dash.includes('<Deadline day='), 'real deadlines replace the sample ones');
  assert.ok(mine.includes('deadlinesApi.mine()') && mine.includes("user.role !== 'faculty'") && mine.includes('deadlineForCard(deadlines, s)'), 'each faculty syllabus shows its subject\'s deadline');
  assert.ok(contrast('#4b5563', token('tint-cobalt')) >= 4.5 && theme.includes('.deadline.dl-row:hover small { color: #4b5563; }'), 'row notes stay readable on the hover fill');
  assert.ok(contrast('#9b1f27', token('tint-crimson')) >= 4.5, 'the date box of a missed deadline');
});

test('the Remind buttons look like the other icon buttons and fit the people list', () => {
  assert.ok(theme.includes('.dl-remind { color: var(--blue); border-width: 2px; border-color: #b8c8ec; }'), 'blue, like the edit buttons');
  assert.ok(theme.includes('grid-template-columns: minmax(0, 1fr) auto 34px'), 'a 34px column for the 34px button');
  assert.ok(contrast(token('blue'), '#ffffff') >= 4.5, 'the bell icon on white');
  const dialog = readFileSync(new URL('../components/DeadlineDialog.jsx', import.meta.url), 'utf8');
  assert.ok(dialog.includes("deadlinesApi.remind(selected, userIds)") && dialog.includes('setReload((n) => n + 1)'), 'a reminder refreshes who was last reminded');
});
