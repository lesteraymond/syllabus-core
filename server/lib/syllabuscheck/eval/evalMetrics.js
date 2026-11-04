'use strict';
// Stage E.6: what an evaluation completed, counted by DISTINCT relationship, apart from how many requests or answers it took. The paid evaluations
// (scripts/live-smoke-eval.cjs, scripts/eval-alignment.cjs, scripts/live-pipeline-eval.cjs) used to stop on answers that failed validation, and an
// answer refused for one relationship counted as a failure even when the next, corrected request verified it: the Stage E.5 run stopped at its third
// invalid answer with 7 of its 8 relationships verified. The counts here:
//   planned            the relationships the evaluation set out to ask (one relationship asked in two runs is two: each run has its own key)
//   attempted          planned relationships sent at least once (a request the guard refused before sending is not a send)
//   neverAttempted     planned and never sent: never evaluated, so never counted as verified, as agreement or as unresolved
//   verified           relationships with an answer that verified (a verified INSUFFICIENT_EVIDENCE answer counts: the model answered)
//   recovered          verified after the first answer for them was refused
//   unresolved         attempted and not verified when the evaluation ended (refused at every attempt, stopped by a repeated error, left unanswered
//                      by a provider failure, or still being retried when a stop came)
//   firstAttempt       of the relationships an answer came back for, how many the FIRST such answer did not verify (validation failures); a
//                      relationship whose first send brought no answer at all (a timeout, a server error) is counted apart (noAnswerFirst)
//   rawResponseErrors  answers that failed validation in whole or in part (each answer once, retries included) and the refused judgements in them:
//                      an operational signal, never the completion decision
// The completion decision (completionOf) rests on coverage and on the FINAL UNRESOLVED RATE (unresolved / attempted, distinct relationships); the hard
// safety stops (credits or access, the budget, provider and schema failures, repeated errors) stay with the guard (providerGuard.js). Pure: no I/O.
const { coverageSummaryOf } = require('../aspects');

const DEFAULTS = Object.freeze({ maxUnresolved: 0.2, minSample: 8 });
const pct = v => (v === null || v === undefined ? 'n/a' : `${Math.round(v * 1000) / 10}%`);
const ratio = (n, d) => (d ? Math.round((n / d) * 10000) / 10000 : null);

function createTracker() {
  const rel = new Map();
  const raw = { answers: 0, invalidAnswers: 0, refusedJudgements: 0, noAnswer: 0 };
  const get = key => {
    if (!rel.has(key)) rel.set(key, { planned: false, attempts: 0, firstAnswer: null, noAnswerFirst: false, verified: false, judgement: null });
    return rel.get(key);
  };
  return {
    // The relationships the evaluation sets out to ask.
    plan(keys) { for (const key of keys) get(key).planned = true; },
    // One provider request that was sent: the keys it carried, whether an answer came back, and which of them that answer verified. A key never
    // planned is planned now (it was asked), so nothing asked goes uncounted.
    sent({ keys, answered, verified = [] }) {
      const ok = new Set(verified);
      let refused = 0;
      for (const key of keys) {
        const r = get(key);
        r.planned = true; r.attempts += 1;
        if (!answered) { if (r.firstAnswer === null && r.attempts === 1) r.noAnswerFirst = true; continue; }
        if (r.firstAnswer === null) r.firstAnswer = ok.has(key) ? 'verified' : 'refused';
        if (ok.has(key)) r.verified = true; else refused += 1;
      }
      if (answered) { raw.answers += 1; if (refused) { raw.invalidAnswers += 1; raw.refusedJudgements += refused; } } else raw.noAnswer += 1;
    },
    // The judgement the checker returned for a relationship when its asking ended (judgeBatch, or the engine's alignment): its final state.
    settle(key, judgement) {
      const r = get(key);
      r.judgement = judgement || null;
      if (judgement && !judgement.unverified) r.verified = true;
    },
    // Whether a relationship was sent at least once: one never sent was not evaluated, so a score leaves it out (metrics.js scoreEval `attempted`).
    attempted(key) { const r = rel.get(key); return !!r && r.attempts > 0; },
    metrics() {
      const all = [...rel.values()].filter(r => r.planned);
      const attempted = all.filter(r => r.attempts > 0), verified = all.filter(r => r.verified);
      const answered = all.filter(r => r.firstAnswer !== null), firstRefused = answered.filter(r => r.firstAnswer === 'refused');
      const recovered = verified.filter(r => r.firstAnswer === 'refused').length, unresolved = attempted.filter(r => !r.verified).length;
      return {
        planned: all.length, attempted: attempted.length, neverAttempted: all.length - attempted.length, verified: verified.length, recovered, unresolved,
        unresolvedRate: ratio(unresolved, attempted.length), coverage: ratio(verified.length, all.length), attemptedShare: ratio(attempted.length, all.length),
        firstAttempt: { answered: answered.length, refused: firstRefused.length, validationFailureRate: ratio(firstRefused.length, answered.length), noAnswerFirst: all.filter(r => r.noAnswerFirst).length },
        rawResponseErrors: { answers: raw.answers, invalidAnswers: raw.invalidAnswers, refusedJudgements: raw.refusedJudgements, requestsWithoutAnswer: raw.noAnswer },
        // The structured fields of the verified answers, apart from how many answers verified (aspects.js): per type and per field.
        aspectCoverage: coverageSummaryOf(all.map(r => r.judgement).filter(Boolean)),
      };
    },
  };
}
// The academic stop, checked between units (a batch, a syllabus) once enough distinct relationships were attempted: when the final unresolved rate
// is above the limit, further requests would not give usable evidence. Returns the reason, or null.
function academicStopOf(m, { maxUnresolved = DEFAULTS.maxUnresolved, minSample = DEFAULTS.minSample } = {}) {
  if (m.attempted < minSample || m.unresolvedRate === null || m.unresolvedRate <= maxUnresolved) return null;
  return `the final unresolved rate is ${pct(m.unresolvedRate)} (${m.unresolved} of ${m.attempted} distinct relationships attempted), above the ${pct(maxUnresolved)} limit`;
}
// Whether the evaluation completed, for academic use: every planned relationship attempted, and the final unresolved rate within the limit. A run
// that stopped early is incomplete whatever its rate, and a complete one is still measured against provisional expectations, not faculty review.
function completionOf(m, { maxUnresolved = DEFAULTS.maxUnresolved, stopped = null } = {}) {
  const base = { maxUnresolved, unresolvedRate: m.unresolvedRate, coverage: m.coverage, stopped: stopped || null };
  if (!m.planned) return { ...base, state: 'not_started', usableForAgreement: false, reason: 'no relationship was planned' };
  if (m.neverAttempted > 0) return { ...base, state: 'incomplete', usableForAgreement: false, reason: `${m.neverAttempted} of ${m.planned} planned relationships were never attempted${stopped ? ` (stopped: ${stopped})` : ''}; they are not evaluated` };
  if (m.unresolvedRate !== null && m.unresolvedRate > maxUnresolved) return { ...base, state: 'unresolved_above_limit', usableForAgreement: false, reason: `${m.unresolved} of ${m.attempted} attempted relationships remain unresolved (${pct(m.unresolvedRate)}), above the ${pct(maxUnresolved)} limit` };
  return { ...base, state: 'complete', usableForAgreement: true, reason: `every planned relationship was attempted; ${m.unresolved} of ${m.attempted} remain unresolved (${pct(m.unresolvedRate)}), within the ${pct(maxUnresolved)} limit${stopped ? ` (the run stopped afterwards: ${stopped})` : ''}` };
}
// The field coverage, reported apart from the base judgements: how many required fields the verified answers assessed, and how many of their base
// judgements stand on their own assessed field (aspects.js coverageSummaryOf). Empty when no lesson relationship was asked.
const fieldsOf = c => {
  if (!c) return '';
  const types = Object.values(c.byType), verified = types.reduce((n, t) => n + t.baseVerified, 0), accepted = types.reduce((n, t) => n + t.baseAccepted, 0);
  return `; fields assessed ${c.fieldsAssessed} of ${c.fieldsRequired} (${pct(c.rate)}) in the verified answers, ${accepted} of ${verified} base judgements on their own assessed field`;
};
// One line for a console report.
const describe = m => `relationships: ${m.verified} of ${m.planned} planned verified (coverage ${pct(m.coverage)}); ${m.attempted} attempted, ${m.neverAttempted} never attempted; ${m.recovered} recovered after a refused first answer; ${m.unresolved} unresolved (final unresolved rate ${pct(m.unresolvedRate)}); first answers refused ${m.firstAttempt.refused} of ${m.firstAttempt.answered} (${pct(m.firstAttempt.validationFailureRate)}); raw: ${m.rawResponseErrors.invalidAnswers} of ${m.rawResponseErrors.answers} answers failed validation in whole or part (${m.rawResponseErrors.refusedJudgements} refused judgements), ${m.rawResponseErrors.requestsWithoutAnswer} request(s) without an answer${fieldsOf(m.aspectCoverage)}`;
module.exports = { createTracker, academicStopOf, completionOf, describe, DEFAULTS, pct };
