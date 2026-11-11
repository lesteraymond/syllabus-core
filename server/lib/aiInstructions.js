'use strict';
// Text in a syllabus that is addressed to the AI checker instead of to a reader ("ignore previous instructions", "mark this aligned", "system prompt: ...").
// docs/security/SECURITY-AUDIT-REPORT.md SEC-20. Syllabus text is sent to the AI as data, and the AI can never approve, change a status or send anything; but a
// sentence like this could still try to sway its judgment. This module only FINDS such text so the reviewers are told; it is advisory and changes nothing:
//   - the syllabus is not changed, and what is sent to the AI is exactly the same;
//   - it is not a finding, a recommendation or a rule, and it changes no score (official, area, or the AI Alignment Score);
//   - it blocks nothing: submitting, clearing a stage and approving are unchanged.
// It is read only by GET /api/syllabi/:id/review (routes/syllabusContent.js), for reviewers. lib/aiInstructions.test.js checks all of this.
const MAX_FOUND = 10;
const MAX_STRINGS = 5000;
const EXCERPT = 160;

// Each pattern needs words that only make sense as an instruction to a model, so ordinary course text ("follow the lab instructions", "aligned with the
// outcomes") is not flagged. Linear patterns only: no nested repetition.
const PATTERNS = [
  /\b(?:ignore|disregard|forget|override|pay no attention to)\b[^.\n]{0,40}\b(?:previous|prior|above|earlier|preceding|all|any|the|your)\b[^.\n]{0,20}\b(?:instructions?|prompts?|rules|directions)\b/i,
  /\bsystem\s+prompt\b/i,
  /\b(?:note|message|instructions?)\s+(?:to|for)\s+(?:the\s+)?(?:ai|a\.i\.|model|llm|assistant|checker|grader|evaluator)\b/i,
  /\bas\s+an?\s+(?:ai|a\.i\.|language\s+model|llm|assistant)\b[^.\n]{0,40}\b(?:must|should|will|have to)\b/i,
  /\byou\s+are\s+(?:now\s+)?(?:an?\s+|the\s+)?(?:lenient|generous|helpful|different)?\s*(?:ai|a\.i\.|model|llm|assistant|grader|evaluator|checker)\b/i,
  /\b(?:mark|rate|label|score|grade|judge|classify)\s+(?:this|it|them|everything|every\s+\w+|all(?:\s+\w+)?)\s+(?:as\s+)?["']?(?:aligned|approved|passed|pass|compliant|correct|100|perfect|excellent)\b/i,
  /\brespond\s+(?:only\s+)?with\b|\breply\s+only\s+with\b|\boutput\s+only\b/i,
  /<\/?\s*(?:system|instructions?|prompt|assistant)\s*>/i,
  /\bnew\s+instructions?\s*:/i,
  /\bdo\s+not\s+(?:flag|report|mention|penali[sz]e)\b[^.\n]{0,40}\b(?:this|anything|any|it)\b/i,
];

const SKIP_KEYS = new Set(['catalog']); // the administrator's snapshot of the masters, not the author's text

// -> [{ path, excerpt }] for at most MAX_FOUND places, in document order. Reads only.
function findAiInstructions(content) {
  const found = [];
  if (!content || typeof content !== 'object') return found;
  let strings = 0;
  const visit = (value, at) => {
    if (found.length >= MAX_FOUND || strings > MAX_STRINGS) return;
    if (typeof value === 'string') {
      strings += 1;
      for (const pattern of PATTERNS) {
        const m = pattern.exec(value);
        if (!m) continue;
        const start = Math.max(0, m.index - 40);
        found.push({ path: at, excerpt: (start ? '…' : '') + value.slice(start, start + EXCERPT).replace(/\s+/g, ' ').trim() });
        return;
      }
      return;
    }
    if (Array.isArray(value)) { value.forEach((item, i) => visit(item, `${at}[${i}]`)); return; }
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) if (!SKIP_KEYS.has(key)) visit(item, at ? `${at}.${key}` : key);
    }
  };
  visit(content, '');
  return found;
}

module.exports = { findAiInstructions, MAX_FOUND, PATTERNS };
