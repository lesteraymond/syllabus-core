'use strict';
// Reference suggestions for a Filipino-language subject (Dalumat sa Filipino ...): Filipino and Tagalog editions, and editions with no language listed, are
// accepted for that subject only, and the AI is asked for Filipino books first. Every other subject keeps the English-only rule. Offline: a fake Open Library.
// The catalogue records below are invented for the test.
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./referenceSuggest');

const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
function catalogue({ works = [], editions = {} } = {}) {
  return async (url) => {
    if (/search\.json/.test(url)) { const title = new URL(url).searchParams.get('title').toLowerCase(); return reply({ docs: works.filter(w => w.title.toLowerCase() === title) }); }
    const m = /isbn\/(\d+)\.json/.exec(url);
    if (!m) return reply({}, 404); // no list of editions: the ISBNs are looked up
    return editions[m[1]] ? reply(editions[m[1]]) : reply({}, 404);
  };
}
const WORK = { key: '/works/OL9W', title: 'Mga Batayang Dalumat sa Wika', author_name: ['Maria Santos Reyes'], isbn: ['9789710000001'] };
const edition = languages => ({ 9789710000001: { title: 'Mga Batayang Dalumat sa Wika', publishers: ['Pamantasang Press'], publish_date: '2023', ...(languages ? { languages } : {}) } });
const candidates = [{ title: 'Mga Batayang Dalumat sa Wika', firstAuthorSurname: 'Reyes', year: 2023 }];
const FIL_SUBJECT = { title: 'DALUMAT SA FILIPINO', code: 'GE - ELECT DL', writeIn: 'Filipino' };
const ENG_SUBJECT = { title: 'Data Structures', code: 'CS 201' };
const suggest = (subject, editions) => S.suggestReferences({ ask: async () => JSON.stringify({ books: candidates }), system: 's', subject, topics: ['wika'], year: 2026, newId: p => p + 'x', fetchImpl: catalogue({ works: [WORK], editions }) });

test('a Filipino subject keeps a book whose edition is in Filipino or Tagalog', async () => {
  for (const code of ['fil', 'tgl']) {
    const out = await suggest(FIL_SUBJECT, edition([{ key: '/languages/' + code }]));
    assert.equal(out.kept, 1, code);
    assert.match(out.items[0].t, /^Reyes, M\. S\. \(2023\)\. Mga Batayang Dalumat sa Wika\. Pamantasang Press\.$/);
  }
});

test('a Filipino subject keeps a book whose catalogue edition lists no language', async () => {
  assert.equal((await suggest(FIL_SUBJECT, edition(null))).kept, 1);
});

test('a Filipino subject still refuses an edition in another language (a translation)', async () => {
  const out = await suggest(FIL_SUBJECT, edition([{ key: '/languages/spa' }]));
  assert.equal(out.kept, 0);
  assert.equal(out.rejected[0].reason, 'no edition with a year and a publisher');
});

test('every other subject keeps the English-only rule: Filipino, Tagalog and unlisted editions are refused as before', async () => {
  for (const languages of [[{ key: '/languages/fil' }], [{ key: '/languages/tgl' }], null]) assert.equal((await suggest(ENG_SUBJECT, edition(languages))).kept, 0);
  assert.equal((await suggest(ENG_SUBJECT, edition([{ key: '/languages/eng' }]))).kept, 1);
});

test('the AI is asked for Filipino books first for a Filipino subject only; the English request is unchanged', () => {
  const fil = JSON.parse(S.candidateMessage({ system: 's', subject: FIL_SUBJECT, topics: [] }).user);
  const eng = JSON.parse(S.candidateMessage({ system: 's', subject: ENG_SUBJECT, topics: [] }).user);
  assert.ok(fil.rules.includes(S.FILIPINO_RULE));
  assert.deepEqual(eng.rules, ['Never invent a title or an author. If you are not sure a source exists, leave it out; fewer candidates is fine, and an empty list is fine.', 'No websites, standards or news.']);
  assert.equal(S.languagesFor(ENG_SUBJECT), S.LANGUAGES.english);
  assert.equal(S.languagesFor(FIL_SUBJECT), S.LANGUAGES.filipino);
});
