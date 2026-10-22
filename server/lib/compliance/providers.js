'use strict';
// The AI provider interface. A provider turns the rule findings plus a short redacted excerpt into raw recommendation items;
// recommend.js validates them, links them to the form, ranks them, and falls back to rule-based text when a provider fails.
//
//   provider.name, provider.model, provider.promptVersion
//   await provider.recommend(findings, excerpt, standard) -> [{ title, text, basedOn: [findingId] }]
//
// A provider never sees a name or an email (see buildExcerpt) and never sets a priority, a step or a score: those come from the
// rules. An item that does not cite a real finding is thrown away.

const PROMPT_VERSION = 'p2';

class ProviderError extends Error {
  constructor(code, message) { super(message); this.name = 'ProviderError'; this.code = code; }
}

// Offline and deterministic: one recommendation per failed rule, written from that rule's own fix title and findings. This is what
// runs until an LLM is connected, and what the tests use. `fail` makes it throw; `raw` replaces its output (for tests).
class MockProvider {
  constructor({ fail, raw, model = 'mock-1' } = {}) {
    this.name = 'mock';
    this.model = model;
    this.promptVersion = PROMPT_VERSION;
    this._fail = fail;
    this._raw = raw;
    this.calls = 0;
  }
  async recommend(findings, excerpt, standard) {
    this.calls += 1;
    if (this._fail) throw (this._fail instanceof Error ? this._fail : new ProviderError('mock_failure', String(this._fail)));
    if (this._raw !== undefined) return typeof this._raw === 'function' ? this._raw(findings, excerpt, standard) : this._raw;
    return groupByRule(findings).map((g) => {
      const rule = standard.rules.find((r) => r.id === g.ruleId);
      return { title: (rule && rule.fix) || 'Review ' + g.ruleId, text: describe(g.items), basedOn: g.items.slice(0, 5).map((f) => f.id) };
    });
  }
}

// The real provider is a stub and is never called: nothing selects it yet. It needs a client with `complete(prompt) -> string`
// supplied by the caller, so no SDK, key or network code lives here. Without one it fails with "not_configured".
class LlmProvider {
  constructor({ client, model = 'unconfigured' } = {}) {
    this.name = 'llm';
    this.model = model;
    this.promptVersion = PROMPT_VERSION;
    this._client = client || null;
  }
  async recommend(findings, excerpt, standard) {
    if (!this._client || typeof this._client.complete !== 'function') throw new ProviderError('not_configured', 'No AI client is configured.');
    return parseItems(await this._client.complete(buildPrompt(findings, excerpt, standard)));
  }
  // Raw text for a prompt that meaning.js built: which fields are not meaningful. The offline MockProvider has no judge, so a check
  // without a real model simply has no verdicts.
  async judge(prompt) {
    if (!this._client || typeof this._client.complete !== 'function') throw new ProviderError('not_configured', 'No AI client is configured.');
    return this._client.complete(prompt, { temperature: 0 });
  }
}

function groupByRule(findings) {
  const by = new Map();
  findings.forEach((f) => { (by.get(f.ruleId) || by.set(f.ruleId, []).get(f.ruleId)).push(f); });
  return [...by.entries()].map(([ruleId, items]) => ({ ruleId, items }));
}
// The first finding's message, plus how many more are like it.
const describe = (items) => items[0].message + (items.length > 1 ? ' ' + (items.length - 1) + ' more like this.' : '');

// What the college expects of a syllabus, so the recommendations speak its language (the rules come from the college's own checklist and
// the six core values from its core-values text). Short on purpose: it is sent with every request.
function lcupContext(standard) {
  const c = standard.constants || {};
  const values = (c.coreValues || []).map((v) => v.name).join(', ');
  return 'Context (La Consolacion University Philippines): the vision, mission and the four graduate attributes (EGAs) are fixed institution text. '
    + 'Faculty write the course learning outcomes (CLOs), and each CLO must align with an EGA and a program outcome. Every ILO belongs under a CLO and an EGA. '
    + 'The course content, learning activities and assessment tasks of a week must match that week\'s ILO. Each lesson names at least one LCUP core value' + (values ? ' (' + values + ')' : '') + '. '
    + 'Write for the faculty member who wrote the syllabus: plain English, name the week or step, and say what to change.';
}

function buildPrompt(findings, excerpt, standard) {
  return [
    'You review a university course syllabus against the ' + standard.title + ' standard.',
    'Prompt version: ' + PROMPT_VERSION + '.',
    lcupContext(standard),
    'Using only the findings below, write at most ' + standard.recommendations.max + ' short, concrete recommendations for the author.',
    'Reply with JSON only: an array of { "title": string, "text": string, "basedOn": [finding ids] }.',
    'Every item must cite at least one finding id in basedOn. Do not give a priority, a score, a step or an area: those are set by the rules.',
    'FINDINGS: ' + JSON.stringify(findings),
    'EXCERPT: ' + JSON.stringify(excerpt),
  ].join('\n');
}

// Accepts a bare array, or { items: [...] }, optionally wrapped in a ``` fence.
function parseItems(output) {
  let t = String(output == null ? '' : output).trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) t = fence[1];
  let v;
  try { v = JSON.parse(t); } catch { throw new ProviderError('bad_output', 'The AI reply was not valid JSON.'); }
  const items = Array.isArray(v) ? v : (v && Array.isArray(v.items) ? v.items : null);
  if (!items) throw new ProviderError('bad_output', 'The AI reply had no list of recommendations.');
  return items;
}

module.exports = { MockProvider, LlmProvider, ProviderError, PROMPT_VERSION, buildPrompt, parseItems, groupByRule, describe };
