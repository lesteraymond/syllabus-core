'use strict';
const { applyStages } = require('./stages');
// Alternative wordings of the alignment prompt, so a change can be MEASURED on the same labelled examples before it is adopted.
// Production uses 'current' unless SYLLABUS_CHECK_PROMPT_VARIANT names another one, and a variant is part of the prompt version, so a verdict made
// under one variant is never reused under another. Each variant is derived from the current PROMPT by exact text replacements; if the current
// prompt is edited so that one no longer applies, `promptFor` throws (and variants.test.js fails) instead of quietly testing the wrong thing.
//
//   current         the prompt in gemini.js, unchanged
//   calibrated      only the verdict boundaries: the "when in doubt choose PARTIALLY_ALIGNED" instruction is replaced by definitions of
//                   ALIGNED / PARTIALLY_ALIGNED / NOT_ALIGNED / INSUFFICIENT_EVIDENCE, with PARTIAL no longer the fallback for uncertainty
//   rubric          calibrated + a relationship-specific rubric for CLO-PO / CLO-EGA and ILO-CLO built on "does it CONTRIBUTE": different wording
//                   is fine, a specific CLO can support a broad PO through one real part, a shared topic word is not alignment
//   rubric-ordered  rubric + the model writes its explanation BEFORE it commits to a label (the order of the fields in the JSON schema)
const DOUBT = 'When in doubt between ALIGNED and PARTIALLY_ALIGNED, choose PARTIALLY_ALIGNED and name the missing piece; do not let a pair through that a careful reviewer would later question.';
const CALIBRATION = [
  'Verdict boundaries. ALIGNED: the relationship is substantively supported by the two texts. The competency of the source is genuinely developed, demonstrated or contributed to by the target; the wording and the action verbs need not match, and a text that shares only a topic word is not aligned.',
  'PARTIALLY_ALIGNED: a meaningful relationship exists, but you can name an important part of the source\'s competency, scope or level of performance that the target does not support. Name it. PARTIALLY_ALIGNED is not a fallback for uncertainty: decide on what the texts say.',
  'NOT_ALIGNED: the texts are irrelevant to each other, contradict each other, or the target gives no real support to the source.',
  'INSUFFICIENT_EVIDENCE: only when a text is missing, empty or unreadable. If the texts are present but you are unsure, choose the verdict the stated evidence supports and say in the explanation what is uncertain.',
].join('\n');

const CLO_BULLET = '- CLO-PO and CLO-EGA: (1) the CLO statement contains the key action verb or competency of the PO/EGA, or a clear equivalent; (2) its Bloom level is not lower than the PO/EGA asks for; (3) its subject matter (the discipline, the object of the action) is the PO/EGA\'s. A CLO that only shares a topic word with the PO is PARTIALLY_ALIGNED.';
const RUBRIC_CLO = '- CLO-PO and CLO-EGA (does the CLO contribute to the program outcome or graduate attribute?): ALIGNED when the CLO develops, practises, demonstrates or assesses a substantial part of the competency the PO/EGA describes. A PO/EGA is broad and one CLO is not expected to cover all of it, so a specific CLO that clearly develops one real part of a broad PO is ALIGNED. The same competency can be worded differently, so judge the meaning of the PO/EGA, the competency the CLO demonstrates and its level of performance, not the words. PARTIALLY_ALIGNED: the relationship is real but the contribution is thin or peripheral, or the CLO\'s level or scope falls clearly short of what the PO/EGA asks for. NOT_ALIGNED: the CLO is about a different competency, discipline or purpose. A shared topic word alone is not alignment, and the tag (the PO number) is not evidence of meaning.';
const ILO_BULLET = '- ILO-CLO: (1) the ILO is a smaller step of the CLO, in the same subject; (2) its Bloom level is the CLO\'s or one that builds toward it; (3) it does not claim more than the CLO. An ILO that is unrelated to the CLO is NOT_ALIGNED.';
const RUBRIC_ILO = '- ILO-CLO (does the ILO contribute to achieving the CLO?): ALIGNED when the ILO is a step that genuinely helps the student achieve the CLO: the same subject and competency, at the CLO\'s level or building toward it, claiming no more than the CLO. Different wording is fine. A broad CLO does not support every ILO that shares its topic: the ILO must develop something the CLO actually asks for. PARTIALLY_ALIGNED: it relates to the CLO but is peripheral, covers only a minor part, or its level or scope does not build toward the CLO. NOT_ALIGNED: unrelated to the CLO\'s competency, or contradicting it.';
const SEVERAL = 'When the source asks for several things (a PO with two skills, an ILO with two verbs), every one must be shown. If one is missing the pair is PARTIALLY_ALIGNED, not ALIGNED.';
const SEVERAL_SCOPED = 'For the lesson-level relationships (ILO-activity, ILO-content, ILO-assessment, Module-value), when the source asks for several things (an ILO with two verbs), every one must be shown; if one is missing the pair is PARTIALLY_ALIGNED. For CLO-PO, CLO-EGA and ILO-CLO the target needs to contribute substantially, as described above, not to cover everything the source asks.';

const NAMES = ['current', 'calibrated', 'rubric', 'rubric-ordered'];
const variantOf = (env = process.env) => {
  const name = String(env.SYLLABUS_CHECK_PROMPT_VARIANT || 'current').toLowerCase();
  return NAMES.includes(name) ? name : 'current';
};
const replaceOnce = (text, from, to) => {
  if (text.split(from).length !== 2) throw new Error('Prompt variant cannot be built: the current prompt no longer contains "' + from.slice(0, 60) + '…" exactly once.');
  return text.replace(from, () => to);
};
// The wording of any stage that is switched off is removed first (stages.js); the variant's replacements then apply to what is left.
function promptFor(base, variant = 'current', flags = { a: true, b: true, b3: true, b4: true, c1: true, c2: true, c3: true, d1: true, d2: true, requirements: true }) {
  const staged = applyStages(base, flags);
  if (variant === 'current') return staged;
  let text = replaceOnce(staged, DOUBT, CALIBRATION);
  if (variant === 'calibrated') return text;
  text = replaceOnce(text, CLO_BULLET, RUBRIC_CLO);
  text = replaceOnce(text, ILO_BULLET, RUBRIC_ILO);
  text = replaceOnce(text, SEVERAL, SEVERAL_SCOPED);
  return text;
}
// True when the model should write its explanation before its label (the JSON schema lists the fields in that order).
const explanationFirst = (variant) => variant === 'rubric-ordered';

module.exports = { NAMES, variantOf, promptFor, explanationFirst };
