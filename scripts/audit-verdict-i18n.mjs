#!/usr/bin/env node
// Which sentences written by the server into the advisory verdict still have no Tagalog translation?
//   node scripts/audit-verdict-i18n.mjs [--write]      --write saves docs/verdict-translation-inventory.md
// The Verdict Panel shows server sentences through tr() (src/i18n/index.js), which translates a sentence only when a dictionary has it (exactly, or as a
// pattern with {placeholders}). This runs the checker OFFLINE on the representative syllabi with deliberate errors (scripted model, no provider) and
// lists every distinct server sentence the panel would show in Tagalog unchanged. Model-written explanations are excluded: they are the model's own words.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { tr, setLanguage } from '../src/i18n/index.js';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const lib = path.join(root, 'server', 'lib', 'syllabuscheck');
const { run } = require(path.join(lib, 'engine.js'));
const gemini = require(path.join(lib, 'gemini.js'));
const { stageFlags } = require(path.join(lib, 'stages.js'));
const { programSyllabus, PROGRAMS } = require(path.join(lib, 'eval', 'programSyllabi.js'));
const MODEL = 'MODEL-WORDS';
const STAGES = ['A', 'B', 'B3', 'B4', 'C1', 'C2', 'D1', 'D2'];
const ALL = { SYLLABUS_CHECK_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'not-used', SYLLABUS_CHECK_VALUES_FILE: path.join(root, 'server', 'config', 'marian-values.json'), ...Object.fromEntries(STAGES.map(k => ['SYLLABUS_CHECK_STAGE_' + k, 'on'])) };
const GOOD = { 'Activity-fit': { teaching: 'sound', learnerSupport: 'adequate' }, 'Assessment-fit': { measures: 'yes', evidence: 'observable', level: 'matches' }, 'Value-use': { valueUse: 'integrated', carriedBy: 'activity', valueFit: 'fits' }, 'Ref-relevance': { relevance: 'relevant', basis: 'title_and_venue' }, 'Value-map': { coreValue: 'Community-orientedness', integration: 'demonstrated' } };
const BAD = { 'Activity-fit': { teaching: 'sound', learnerSupport: 'limited' }, 'Assessment-fit': { measures: 'partly', evidence: 'vague', level: 'too_low' }, 'Value-use': { valueUse: 'name_only', carriedBy: 'none', valueFit: 'partly' }, 'Ref-relevance': { relevance: 'unrelated', basis: 'title_only' }, 'Value-map': { coreValue: 'insufficient', integration: 'stated_only' } };
const oracle = (rules, env) => { const keys = gemini.aspectKeysFor(stageFlags(env)); return async (url, req) => {
  const batch = JSON.parse(JSON.parse(req.body).contents[0].parts[0].text).document_data;
  const answer = p => { const empty = !p.source.trim() || !p.target.trim(); const rule = rules.find(re => re.test(p.type + ':' + p.id)); const label = empty ? 'INSUFFICIENT_EVIDENCE' : rule ? 'PARTIALLY_ALIGNED' : 'ALIGNED';
    return { id: p.id, label, explanation: MODEL, sourceQuote: empty ? '' : p.source.slice(0, 14), targetQuote: empty ? '' : p.target.slice(0, 14), sourceBloom: 'N/A', targetBloom: 'N/A', draft: label === 'PARTIALLY_ALIGNED' && !gemini.isNoRewrite(p.type) ? MODEL : '', ...Object.fromEntries(keys.map(k => [k, 'not_assessed'])), ...((label === 'ALIGNED' ? GOOD : BAD)[p.type] || {}) }; };
  return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ judgements: batch.map(answer) }) }] } }] }) };
}; };
const defects = c => {
  c.plan[2].contents = 'Folk dance steps and costume design for the cultural festival';
  c.plan[9].activities = '- Watch a full-length movie.'; c.plan[3].values = ''; c.plan[13].values = 'Compassion'; c.plan[14].values = 'Respect'; c.plan[16].values = 'Critical Thinking'; c.plan[4].contents = 'TBD';
  c.clos.pop(); c.meta.title = c.meta.title.toLowerCase();
  c.refs.books.items[1].t = 'Doe, J. and Lee, K. (2099) A study. Journal of Example Computing, 3(1).';
  c.refs.online.items[0].t = 'Example page. Accessed 2 Aug. 2024. http://www.example.org/x';
};
const RULES = [/^(Content-course|Content-ILO):row2-/, /^ILO-activity:row9-/, /^(Activity-fit|Assessment-fit|Value-use|Value-map):row1[0-6]-/, /^Ref-relevance:ref-books-1$/, /^CLO-coverage:/, /^Plan-sequence:/, /^Course-CLO:clo0-/];
const sentences = new Map(); // text -> rule ids
// What the panel shows: the text as written (a fixed sentence followed by the model's own words is translated by a {detail} pattern), and, for a
// reference with several APA issues, each issue sentence on its own (issueMessages).
const note = (text, ruleId) => { if (!text || typeof text !== 'string' || text.trim() === MODEL) return; (sentences.get(text) || sentences.set(text, new Set()).get(text)).add(ruleId); };
for (const key of PROGRAMS) {
  const s = programSyllabus(key);
  for (const [variant, env, useAi] of [['defects', ALL, true], ['offline', ALL, false], ['wrong code, provisional', { ...ALL, SYLLABUS_CHECK_PROVISIONAL_AI: 'on' }, true]]) {
    const content = structuredClone(s.content); defects(content);
    if (variant.startsWith('wrong')) content.meta.code = 'XX 999';
    gemini.resetProviderBlock();
    const r = await run(content, s.masters, { useAi, env, transport: oracle(RULES, env), linkChecker: async url => ({ url, status: 'ok', httpStatus: 200 }) });
    for (const f of r.hybrid.verdict.findings) { for (const t of f.issueMessages && f.issueMessages.length > 1 ? f.issueMessages : [f.explanation]) note(t, f.ruleId); note(f.recommendation, f.ruleId); }
  }
}
setLanguage('tl');
const missing = [...sentences].filter(([text]) => tr(text) === text && !text.startsWith(MODEL)).map(([text, rules]) => ({ text, rules: [...rules].sort() }));
setLanguage('en');
const byRule = new Map();
for (const m of missing) for (const rule of m.rules) (byRule.get(rule) || byRule.set(rule, []).get(rule)).push(m.text);
const lines = ['# Verdict Panel: server sentences without a Tagalog translation', '',
  `Generated by \`node scripts/audit-verdict-i18n.mjs --write\` (offline, scripted model, representative syllabi with deliberate errors). **${missing.length} of ${sentences.size}** distinct server sentences shown in the Verdict Panel have no Tagalog entry and appear in English in Tagalog mode. Labels, pills, statuses and the sentences added in Stages E.1 and E.2 are translated; model-written explanations are the model's own words and are not counted.`, '',
  'Translating these needs a Tagalog reviewer; several are built from parts (for example an APA issue followed by another), so a dictionary entry per part, or per-issue display, is needed rather than one entry per whole text.', ''];
for (const [rule, texts] of [...byRule].sort()) { lines.push(`## ${rule} (${texts.length})`, ''); for (const t of [...new Set(texts)].sort()) lines.push(`- ${t.replace(/\n/g, ' ')}`); lines.push(''); }
const text = lines.join('\n') + '\n';
if (process.argv.includes('--write')) { fs.writeFileSync(path.join(root, 'docs', 'verdict-translation-inventory.md'), text); console.log(`wrote docs/verdict-translation-inventory.md: ${missing.length} of ${sentences.size} sentences untranslated`); } else console.log(text);
