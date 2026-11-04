'use strict';
// Presence only, for the Builder's supported bold/list syntax. Never normalize
// or replace authored text. Unmatched markers and programming/HTML syntax are
// literal content; this is not an HTML sanitizer or an academic quality check.
function hasContent(value) {
  return !!String(value ?? '')
    .replace(/^[ \t]*[-•][ \t]+/gm, '')
    .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
    .trim();
}
module.exports = { hasContent };
