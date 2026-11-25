'use strict';
// When two subject codes are the same one. The school's curricula print the same kind of code both ways ("IT 203" and "IT-204" on one page), so a hyphen
// between letters or digits reads as a space: "IT 204" and "IT-204" are one code, as are "GE - US" and "GE US". Upper and lower case and extra spaces are
// ignored, as they always were. Nothing else is: "IT204", "IT 205" and "CAPSPRO 1" for "CAPSPRO1" are different codes. Only a COMPARISON uses this; a code
// is always stored, shown and sent as it was written. No two codes of one approved curriculum become the same (checked 2026-11-25 on all four).
const HYPHEN = /([\p{L}\p{N}])\s*[-\u2010-\u2015]\s*(?=[\p{L}\p{N}])/gu;
const hyphenAsSpace = (value) => String(value ?? '').replace(HYPHEN, '$1 ');
const normCode = (value) => hyphenAsSpace(value).trim().replace(/\s+/g, ' ').toUpperCase();
const sameCode = (a, b) => normCode(a) === normCode(b);

module.exports = { hyphenAsSpace, normCode, sameCode };
