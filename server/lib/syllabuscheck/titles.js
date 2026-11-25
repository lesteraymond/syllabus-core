'use strict';
// Course-title comparison for the curriculum check (CUR-FIELD / CUR-04).
// The approved title in the curriculum record is canonical and is never changed. The entered title is compared to it after a small, fixed
// normalisation, so the result is explainable and stable:
//   1. Unicode NFKC (so a no-break space, a full-width letter or a ligature compare as their plain form),
//   2. zero-width characters removed,
//   3. letter case folded,
//   4. every run of whitespace becomes one space and the ends are trimmed.
// Spacing and hyphens never make a different title, under every policy (sameTitle; owner, 2026-11-25): the printed curricula write "2(INTERMEDIATE" and
// "1 (FUNDAMENTALS" on one page, so spaces beside punctuation are dropped and a hyphen reads as a space, as in a subject code (lib/subjectCode.js).
// Nothing else is folded: other punctuation, numbers, words and parentheses are significant, and there is no fuzzy matching. "Computer Programming 1" and
// "Computer Programming 2" differ, and so do "Computer Programming 1" and "Computer Programming 1 (Fundamentals of Programming)".
const { withoutHyphens } = require('../subjectCode');
const ZERO_WIDTH = new RegExp('[' + [0x200b, 0x200c, 0x200d, 0x2060, 0xfeff].map(code => String.fromCharCode(code)).join('') + ']', 'g');
const spaceForm = text => withoutHyphens(text).replace(/\s*([()[\]{}/.,:;&])\s*/g, '$1').replace(/\s+/g, ' ').trim();
const sameTitle = (a, b) => spaceForm(a) === spaceForm(b);
const normalizeTitle = text => spaceForm(String(text ?? '').normalize('NFKC').replace(ZERO_WIDTH, '').toLowerCase());

// How the entered title relates to the approved one:
//   exact         identical text
//   case_or_space the same title written with different capitalisation, spacing or Unicode form (a match; a formatting suggestion is offered)
//   subtitle      the approved title is the entered one plus a parenthetical (not a match: a different, shorter title; the author decides)
//   different     anything else (not a match)
//   missing       one of the two is empty (not a match)
function titleRelation(entered, canonical) {
  const a = String(entered ?? ''), b = String(canonical ?? '');
  if (!a.trim() || !b.trim()) return { relation: 'missing', match: false };
  if (a === b) return { relation: 'exact', match: true };
  const na = normalizeTitle(a), nb = normalizeTitle(b);
  if (na === nb) return { relation: 'case_or_space', match: true };
  if (nb.startsWith(na + '(') && nb.endsWith(')')) return { relation: 'subtitle', match: false };
  return { relation: 'different', match: false };
}

// ---- the policy: which comparison is OFFICIAL ----
// SYLLABUS_CHECK_TITLE_POLICY
//   shadow      (default) the official comparison stays exact (but for spacing and hyphens); the normalised decision is computed beside it and reported (hybrid.shadowCurriculum)
//   exact       the official comparison is exact (but for spacing and hyphens) and nothing else is computed
//   normalized  the normalised comparison is official (approved for controlled activation only; see docs/title-policy-activation.md)
// Every caller (the check itself and the submission gate) resolves the policy here, so the check and the gate can never disagree.
const TITLE_POLICY_VERSION = 'title-normalization-2'; // 2: spacing and hyphens (sameTitle)
function titlePolicyOf(env = process.env) {
  const value = String(env.SYLLABUS_CHECK_TITLE_POLICY || '').trim().toLowerCase();
  return ['exact', 'shadow', 'normalized'].includes(value) ? value : 'shadow';
}
// The comparison a policy makes official: only 'normalized' uses the normalisation.
const officialComparison = policy => (policy === 'normalized' ? 'normalized' : 'exact');
// The decision one comparison makes. The exact comparison is letter for letter, but for spacing and hyphens (sameTitle).
function titleDecision(comparison, entered, approved) {
  return comparison === 'normalized' ? titleRelation(entered, approved).match : sameTitle(entered, approved);
}
// Would a stored report's title decision be different under the policy in force now? (A report made before the policy changed is then out of
// date.) Only reports whose own evidence would decide differently are affected; a report without a title check never is.
function titleDecisionChanged(report, env = process.env) {
  const check = (report?.hybrid?.codedChecks || []).find(c => c.ruleId === 'CUR-FIELD' && c.path === 'meta.title');
  if (!check || !['PASS', 'FAIL'].includes(check.status) || !check.evidence) return false;
  return titleDecision(officialComparison(titlePolicyOf(env)), check.evidence.actual, check.evidence.expected) !== (check.status === 'PASS');
}
module.exports = { sameTitle, normalizeTitle, titleRelation, titlePolicyOf, officialComparison, titleDecision, titleDecisionChanged, TITLE_POLICY_VERSION };
