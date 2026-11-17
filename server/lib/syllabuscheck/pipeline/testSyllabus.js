'use strict';
// Test helpers for the re-planned checker (not a test file itself): a syllabus that follows every rule, and a scripted model.
//
// The scripted judge reads markers in the texts instead of meaning:
//   OFFTOPIC in the judged field          -> its critical items are "no"          (NOT_ALIGNED)
//   WEAK in the judged field              -> its first non-critical item is "no"  (PARTIALLY_ALIGNED; for a one-item checklist, NOT_ALIGNED)
//   OFFTOPIC in a field it is judged against (for example the CLO of an ILO) -> critical items are "no"
// The scripted rewriter removes the markers (and gives activities and values a valid form), so a plan can be verified end to end offline.
const F = require('../../compliance/fixtures');
const R = require('./rules');

const LEVELS = ['Introductory', 'Enabling', 'Demonstrating', 'Integration of Values'];
function conforming() {
  const c = F.good();
  c.clos.forEach((clo, i) => { clo.level = LEVELS[i]; clo.statement = `Apply Java programming outcome ${i + 1}`; }); // one observable verb (CHED)
  c.plan[0].contents = 'Course orientation: vision, mission, course outcomes, requirements and grading system';
  c.plan[0].ilos[0].text = 'Explain the course outcomes, requirements and grading policies';
  c.plan.forEach(row => {
    if (row.kind === 'lesson') row.activities = `- Lecture-discussion on week ${row.week}\n- Option: guided lab exercise or video walkthrough`;
    row.values = row.values || 'Humility';
  });
  c.refs = {
    books: { na: false, items: [{ id: 'b1', t: 'Balti, H., & Galloway, A. (2021). Job ready Java. John Wiley & Sons.' }] },
    program: { na: true, items: [] }, online: { na: true, items: [] }, electronics: { na: true, items: [] },
  };
  return c;
}

// The questions of a judge message, with shared texts resolved as a model would read them.
function contextEntries(message) {
  const text = Array.isArray(message.system) ? message.system[1] || '' : '';
  const out = new Map();
  for (const section of text.split('\n\n').slice(1)) { const m = section.match(/^\[([^\]]+)\]\n([\s\S]*)$/); if (m) out.set(m[1], m[2]); }
  return out;
}
function questionsIn(message) {
  const body = JSON.parse(message.user), context = contextEntries(message);
  const resolve = t => (t.sharedText ? { ...t, text: body.shared[t.sharedText] } : t.inContext ? { ...t, text: context.get(t.label) } : t);
  return body.questions.map(q => ({ ...q, against: q.against.map(resolve) }));
}
const quoteOf = text => String(text).split(/\s+/).filter(Boolean).slice(0, 4).join(' ');

function scriptedAnswer(q) {
  const list = R.CHECKLISTS[q.relationship].items;
  const off = /OFFTOPIC/.test(q.field.text) || q.against.some(t => /OFFTOPIC/.test(t.text));
  const weak = /WEAK/.test(q.field.text);
  const items = {};
  for (const item of list) items[item.id] = 'yes';
  if (off) for (const item of list) if (item.critical) items[item.id] = 'no';
  if (weak) { const target = list.find(i => !i.critical) || list[0]; items[target.id] = 'no'; }
  return { q: q.id, items: Object.entries(items).map(([id, answer]) => ({ id, answer })), quote: quoteOf(q.field.text), explanation: off || weak ? 'The field does not fit.' : 'It fits.' };
}

// A judge provider. `log` collects every request; `override(q)` may return a custom answer (or undefined for the scripted one).
function scriptedJudge({ log = [], override } = {}) {
  return async message => {
    const questions = questionsIn(message);
    log.push({ message, questions });
    return JSON.stringify({ answers: questions.map(q => (override && override(q)) || scriptedAnswer(q)) });
  };
}

function scriptedRewriter({ log = [], replace } = {}) {
  return async message => {
    const job = JSON.parse(message.user);
    log.push(job);
    if (replace) { const out = replace(job); if (out !== undefined) return out; }
    let text = String(job.field.text).replace(/\s*\b(OFFTOPIC|WEAK)\b\s*/g, ' ').trim();
    if (job.field.kind === 'activities') text = `- Lecture-discussion: ${text || 'the week topic'}\n- Option: guided lab exercise or video walkthrough`;
    if (job.field.kind === 'values') text = 'Humility';
    if (job.field.kind === 'tasks' && !text) text = '- Quiz';
    if (job.field.kind === 'content' && !text) text = 'Java topic';
    return JSON.stringify({ text, explanation: 'Removed what did not fit.' });
  };
}

const failIfCalled = async () => { throw new Error('the provider must not be called'); };

module.exports = { conforming, scriptedJudge, scriptedRewriter, scriptedAnswer, failIfCalled, questionsIn, LEVELS };
