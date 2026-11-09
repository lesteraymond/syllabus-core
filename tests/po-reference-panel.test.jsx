import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import PoReferencePanel from '../src/components/PoReferencePanel';
import PoReviewNotice from '../src/views/builder2/PoReviewNotice';
import { setLanguage } from '../src/i18n';

// Server-rendered states of the Admin reference panel (the panel's own data comes through `initial`, so no network is used).
const program = { id: 7, code: 'ZZNEW', name: 'BS Zeta Computing' };
const active = { id: 'po-7-v2', version: 'ZZNEW-2026–2027-v2', status: 'published', outcomeCount: 5, publishedAt: '2026-11-06T01:00:00Z', sha256: 'ab'.repeat(32), association: 'owner', appliesTo: [{ academicYear: '2026–2027', association: 'owner' }] };
const earlier = { id: 'po-7-v1', version: 'ZZNEW-2026–2027-v1', status: 'superseded', outcomeCount: 4, publishedAt: '2026-11-01T01:00:00Z', sha256: 'cd'.repeat(32), appliesTo: [] };
const change = { id: 2, action: 'saved', at: '2026-11-06T01:00:00Z', by: 'Test Administrator', previous: { id: earlier.id, version: earlier.version }, next: { id: active.id, version: active.version } };
const base = { publicationAvailable: true, active: null, history: [], changes: [], liveStatus: 'unpublished' };
const html = (props, lang = 'en') => { setLanguage(lang); return renderToStaticMarkup(<PoReferencePanel program={program} initial={base} {...props} />); };

test('a program from before versioning says the checker will not check CLO-PO, and one click records its saved outcomes; nothing asks for an approval or a document', () => {
  const out = html({ hasOutcomes: true });
  assert.match(out, /No saved version yet/); assert.match(out, /Not checked/); assert.match(out, /Save the current outcomes as the first version/);
  assert.ok(!/<textarea/.test(out), 'no authorization or evidence field'); assert.ok(!/approv|VPAA|Publish/i.test(out));
  assert.ok(!/as the first version/.test(html({ hasOutcomes: false })), 'a program with no outcomes has nothing to record');
});
test('the version in force shows its hash, years, history, comparison and change log, and has no edit controls', () => {
  const out = html({ initial: { ...base, active, history: [earlier, active], changes: [change], liveStatus: 'published' } });
  assert.match(out, /ZZNEW-2026–2027-v2/); assert.match(out, /abababababab/); assert.match(out, /Applies to: 2026–2027/); assert.match(out, /never changes/);
  assert.match(out, /earlier version/); assert.match(out, /Compare with the version in force/);
  assert.match(out, /Test Administrator · Program Outcomes saved: ZZNEW-2026–2027-v1 → ZZNEW-2026–2027-v2/);
  assert.ok(!/<input|<textarea/.test(out), 'a saved version has no input of any kind');
});
test('a version used from another year says so, and a past year or a specialization offers no action', () => {
  const adopted = { ...active, association: 'adopted', associationNote: 'Copied with the catalog from 2026–2027', appliesTo: [{ academicYear: '2026–2027', association: 'owner' }, { academicYear: '2027–2028', association: 'adopted' }] };
  const out = html({ initial: { ...base, active: adopted, history: [], liveStatus: 'published' } });
  assert.match(out, /Used here from another academic year \(2026–2027\)/); assert.match(out, /Applies to: 2026–2027, 2027–2028/);
  const past = html({ readOnlyYear: true, hasOutcomes: true });
  assert.match(past, /past academic year/); assert.ok(!/as the first version/.test(past)); assert.ok(!/Use a version/.test(past));
  const inherited = html({ inheritedFrom: { code: 'BSIT' } });
  assert.match(inherited, /inherits its Program Outcomes and their version from BSIT/); assert.ok(!/as the first version/.test(inherited));
});
test('a database without the version tables says so; Filipino renders the same panel with no leaked keys', () => {
  assert.match(html({ initial: { ...base, publicationAvailable: false } }), /not set up on this database yet/);
  const tl = html({ initial: { ...base, active, history: [earlier, active], changes: [change], liveStatus: 'published' } }, 'tl');
  assert.match(tl, /Mga bersyon ng sanggunian/); assert.match(tl, /Umiiral na bersyon/); assert.match(tl, /Talaan ng pagbabago/);
  assert.ok(!/poRef\./.test(tl), 'no translation key leaks');
  setLanguage('en');
});
test('Step 2 review: the notice offers Review and adopt; the review shows the current and updated statements in English and Filipino; a removed mapped PO blocks adoption', () => {
  const view = (extra = {}) => ({ pending: true, reviewedSha256: 'ab', references: { current: { id: 'po-7-v1', version: 'ZZ-v1' }, updated: { id: 'po-7-v2', version: 'ZZ-v2' } }, changes: [{ no: 2, before: 'Old PO statement.', after: 'New PO statement.', clos: ['CLO 1', 'CLO 3'] }], missingMappings: [], ...extra });
  const render = (props, lang = 'en') => { setLanguage(lang); return renderToStaticMarkup(<PoReviewNotice syllabusId={1} {...props} />); };
  assert.match(render({}), /Review and adopt/);
  const open = render({ initial: view() });
  assert.match(open, /Old PO statement\./); assert.match(open, /New PO statement\./); assert.match(open, /Your CLO mappings stay as they are/); assert.match(open, /Adopt the updated statements/);
  assert.match(open, /PO 2/); assert.match(open, /CLO 1, CLO 3/); assert.match(open, /ZZ-v1 → ZZ-v2/); assert.match(open, /<button[^>]*disabled[^>]*>[^]*?Adopt the updated statements/, 'adopting needs the confirmation tick');
  assert.ok(!/Old PO statement/.test(render({})), 'nothing is shown as adopted before the review opens');
  const tl = render({ initial: view() }, 'tl');
  assert.match(tl, /Kasalukuyang pahayag/); assert.match(tl, /Tanggapin ang mga na-update na pahayag/); assert.ok(!/poReview\./.test(tl), 'no translation key leaks');
  const blocked = render({ initial: view({ missingMappings: [3] }) });
  assert.match(blocked, /still uses PO 3/); assert.match(blocked, /<button[^>]*disabled[^>]*>[^]*?Adopt the updated statements/);
  setLanguage('en');
});
