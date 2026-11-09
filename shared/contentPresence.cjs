'use strict';
// Presence only, for the Builder's supported bold/list syntax. Never normalize
// or replace authored text. Unmatched markers and programming/HTML syntax are
// literal content; this is not an HTML sanitizer or an academic quality check.
// Characters that draw nothing: soft hyphen, Mongolian vowel separator, zero-width space/non-joiner/joiner, the bidi and invisible-operator controls and
// the byte-order mark. Text made only of these is blank (DEF-01). They are ignored for this question only; authored text is never altered.
const INVISIBLE = /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;
function hasContent(value) {
  return !!String(value ?? '')
    .replace(INVISIBLE, '')
    .replace(/^[ \t]*[-•][ \t]+/gm, '')
    .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
    .trim();
}
module.exports = { hasContent };
