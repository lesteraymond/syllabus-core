'use strict';
// Optimistic concurrency for the builder's saved content. The content document is stored as one JSON text and written section by section
// (routes/syllabusContent.js), so each section carries its own revision: a short hash of the stored section. A client that read (or last saved) a
// section sends that revision back with its next save of the same section; if the stored section has changed since, the save is refused with
// HTTP 409 instead of replacing newer faculty text. Sections the client does not send are never compared, so two tabs editing different sections
// never conflict. The base revision is MANDATORY for every sent section that already holds content (HTTP 428 without it, 409 when outdated); a section with nothing
// stored has nothing to overwrite, so the first save of a new draft needs none. There is no switch that turns this off. No column is added: the revision is derived from
// the stored content, and it is not a secret.
const crypto = require('node:crypto');

const SECTION_KEYS = ['meta', 'outcomes', 'description', 'clos', 'plan', 'reqs', 'refs', 'grading'];
const canonical = (value) => JSON.stringify(value, (key, item) => (item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((k) => [k, item[k]])) : item));
const revisionOf = (section) => (section === undefined ? 'none' : crypto.createHash('sha256').update(canonical(section)).digest('hex').slice(0, 16));
const revisionsOf = (content) => Object.fromEntries(SECTION_KEYS.map((key) => [key, revisionOf(content ? content[key] : undefined)]));

// Sent sections that already hold stored content but arrive without a base revision. These are refused (HTTP 428): the server cannot tell whether the client has seen
// what it would replace. A section with nothing stored has nothing to overwrite, so it needs no base (the first save of a new draft).
const missingBases = (current, baseRevisions, sentKeys) => sentKeys.filter((key) => current && current[key] !== undefined && !(baseRevisions && typeof baseRevisions[key] === 'string'));

// Returns the sent sections whose stored value no longer matches the revision the client based its edit on. (A section with no base revision never reaches this
// check when it has stored content: missingBases refuses it first.)
const staleSections = (current, baseRevisions, sentKeys) => (baseRevisions
  ? sentKeys.filter((key) => typeof baseRevisions[key] === 'string' && baseRevisions[key] !== revisionOf(current ? current[key] : undefined))
  : []);

// `baseRevisions` is client input: only a plain object of short strings is accepted.
const validBase = (value) => value === undefined || (value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.entries(value).every(([k, v]) => SECTION_KEYS.includes(k) && typeof v === 'string' && v.length <= 64));

module.exports = { SECTION_KEYS, revisionOf, revisionsOf, staleSections, missingBases, validBase };
