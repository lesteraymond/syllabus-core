'use strict';
// When two subject codes are the same one. The school's curricula print the same kind of code both ways ("IT 203" and "IT-204" on one page), so a hyphen
// between letters or digits reads as a space: "IT 204" and "IT-204" are one code, as are "GE - US" and "GE US". A hyphen at the end of a code is dropped: the
// Cybersecurity curriculum prints some codes that way ("IT 102-", and "IT-ELEC1-, 3rd Yr" in a pre-requisite). Upper and lower case and extra spaces are
// ignored, as they always were. Nothing else is: "IT204", "IT 205" and "CAPSPRO 1" for "CAPSPRO1" are different codes. Only a COMPARISON uses this; a code
// is always stored, shown and sent as it was written. No two codes of one approved curriculum become the same (checked 2026-11-25 on all four).
const HYPHEN = /([\p{L}\p{N}])\s*[-\u2010-\u2015]\s*(?=[\p{L}\p{N}])/gu;
const END_HYPHEN = /([\p{L}\p{N}])\s*[-\u2010-\u2015]\s*(?=$|[,;/&)\]])/gu;
const withoutHyphens = (value) => String(value ?? '').replace(HYPHEN, '$1 ').replace(END_HYPHEN, '$1');
const normCode = (value) => withoutHyphens(value).trim().replace(/\s+/g, ' ').toUpperCase();
const sameCode = (a, b) => normCode(a) === normCode(b);

module.exports = { withoutHyphens, normCode, sameCode };
