'use strict';
// The six Marian-Augustinian core values, in their fixed order, and which of them a text names (exact names only: no synonyms and no adjectives are
// guessed). Used by the new AI Checker (pipeline/extract.js, prompt.js, rules.js). The old checker's Stage D1 (value definitions file, per-lesson value
// questions, values profile) was removed with the old AI Checker.
const VALUE_NAMES = Object.freeze(['Compassion', 'Courage', 'Community-orientedness', 'Humility', 'Interiority', 'Missionary Spirit']);
const spellings = name => (name === 'Community-orientedness' ? ['community-orientedness', 'community orientedness'] : [name.toLowerCase()]);
// The core values a text names, in the order of VALUE_NAMES (exact names only: no synonyms and no adjectives are guessed).
function namedValues(text) {
  const t = String(text ?? '').toLowerCase();
  return VALUE_NAMES.filter(name => spellings(name).some(spelling => t.includes(spelling)));
}

module.exports = { VALUE_NAMES, namedValues };
