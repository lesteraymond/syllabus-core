'use strict';
// Stage E.9 Phase 3, Layer A: deterministic offline OpenRouter mock provider (oracle).
// Follows the production OpenRouter chat/completions request and response contract and routes every reply through the real Hybrid-2
// engine, validators (gemini.js verifyAnswer / checkOne), static answer/recommendation review, and verdict builder.
// Never makes a network call or database query.
const { ASPECTS, RECOMMENDATIONS, contractOf, resetProviderBlock } = require('../../gemini');
const { run } = require('../../engine');

const DEFAULT_MODEL = 'minimax/minimax-m3.1-flash';

const DEFAULT_ENV = Object.freeze({
  SYLLABUS_CHECK_AI_PROVIDER: 'openrouter',
  OPENROUTER_API_KEY: 'test-phase3-offline-key',
  OPENROUTER_MODEL: DEFAULT_MODEL,
  SYLLABUS_CHECK_STAGE_A: 'on',
  SYLLABUS_CHECK_STAGE_B: 'on',
  SYLLABUS_CHECK_STAGE_B3: 'on',
  SYLLABUS_CHECK_STAGE_B4: 'on',
  SYLLABUS_CHECK_STAGE_C1: 'on',
  SYLLABUS_CHECK_STAGE_C2: 'on',
  SYLLABUS_CHECK_STAGE_D1: 'on',
  SYLLABUS_CHECK_STAGE_D2: 'on',
  SYLLABUS_CHECK_AI_CONCURRENCY: '1',
  SYLLABUS_CHECK_AI_COOLDOWN_SEC: '300',
});

const LEGACY_ENV = Object.freeze({
  SYLLABUS_CHECK_AI_PROVIDER: 'openrouter',
  OPENROUTER_API_KEY: 'test-phase3-offline-key',
  OPENROUTER_MODEL: DEFAULT_MODEL,
  SYLLABUS_CHECK_STAGE_A: 'off',
  SYLLABUS_CHECK_STAGE_B: 'off',
  SYLLABUS_CHECK_STAGE_B3: 'off',
  SYLLABUS_CHECK_STAGE_B4: 'off',
  SYLLABUS_CHECK_STAGE_C1: 'off',
  SYLLABUS_CHECK_STAGE_C2: 'off',
  SYLLABUS_CHECK_STAGE_D1: 'off',
  SYLLABUS_CHECK_STAGE_D2: 'off',
  SYLLABUS_CHECK_AI_CONCURRENCY: '1',
  SYLLABUS_CHECK_AI_COOLDOWN_SEC: '300',
});

const NO_REWRITE_TYPES = new Set([
  'REF-plan',
  'CLO-set',
  'Plan-sequence',
  'ILO-anyCLO',
  'CLO-coverage',
  'Ref-relevance',
  'Value-map',
]);

function pickSubstring(text, quoteNo = null, type = '') {
  const raw = String(text ?? '');
  if (!raw.trim()) return '';
  if (quoteNo != null && (type === 'CLO-anyPO' || type === 'CLO-anyEGA' || type === 'ILO-anyCLO')) {
    const lines = raw.split(/\r?\n/);
    const re = type === 'ILO-anyCLO'
      ? new RegExp(`^\\s*CLO\\s*#?${quoteNo}\\s*:\\s*(.+)$`, 'i')
      : new RegExp(`^\\s*${quoteNo}\\.\\s*(.+)$`);
    const found = lines.find(l => re.test(l));
    if (found) {
      const m = re.exec(found);
      return (m && m[1] ? m[1].trim() : found.trim()).slice(0, 110);
    }
  }
  if (type === 'CLO-anyPO' || type === 'CLO-anyEGA' || type === 'ILO-anyCLO') {
    const firstLine = raw.split(/\r?\n/).find(l => l.trim()) || raw;
    const stripped = firstLine.replace(/^\s*(?:CLO\s*#?\d+\s*:|\d+\.)\s*/i, '').trim();
    return (stripped || firstLine.trim()).slice(0, 90);
  }
  const line = raw.split(/\r?\n/).find(l => l.trim().length >= 8) || raw.split(/\r?\n/).find(l => l.trim()) || raw;
  return line.trim().slice(0, 90);
}

function defaultAspectsFor(type, label, expFields = null) {
  const base = {
    teaching: 'not_assessed',
    learnerSupport: 'not_assessed',
    measures: 'not_assessed',
    evidence: 'not_assessed',
    level: 'not_assessed',
    responsible: 'not_assessed',
    valueUse: 'not_assessed',
    carriedBy: 'not_assessed',
    valueFit: 'not_assessed',
    coreValue: 'not_assessed',
    integration: 'not_assessed',
    relevance: 'not_assessed',
    basis: 'not_assessed',
  };
  if (type === 'Activity-fit') {
    Object.assign(base, label === 'ALIGNED'
      ? { teaching: 'sound', learnerSupport: 'adequate', responsible: 'none' }
      : { teaching: 'weak', learnerSupport: 'limited', responsible: 'activity' });
  } else if (type === 'Assessment-fit') {
    Object.assign(base, label === 'ALIGNED'
      ? { measures: 'yes', evidence: 'observable', level: 'matches', responsible: 'none' }
      : { measures: 'partly', evidence: 'observable', level: 'too_low', responsible: 'assessment' });
  } else if (type === 'Value-use') {
    Object.assign(base, label === 'ALIGNED'
      ? { valueUse: 'integrated', carriedBy: 'activity', valueFit: 'fits', responsible: 'none' }
      : { valueUse: 'name_only', carriedBy: 'none', valueFit: 'fits', responsible: 'values' });
  } else if (type === 'Value-map') {
    Object.assign(base, label === 'ALIGNED'
      ? { coreValue: 'Community-orientedness', integration: 'demonstrated', responsible: 'none' }
      : { coreValue: 'none', integration: 'stated_only', responsible: 'values' });
  } else if (type === 'Ref-relevance') {
    Object.assign(base, label === 'ALIGNED'
      ? { relevance: 'relevant', basis: 'title_only' }
      : label === 'PARTIALLY_ALIGNED'
        ? { relevance: 'tangential', basis: 'title_and_venue' }
        : { relevance: 'unrelated', basis: 'title_and_venue' });
  }
  if (expFields && typeof expFields === 'object') {
    for (const [k, v] of Object.entries(expFields)) {
      if (k in base && v !== undefined && v !== null) base[k] = v;
    }
  }
  return base;
}

function defaultExplanationFor(pair, label, exp) {
  if (exp && exp.oracleExplanation) return exp.oracleExplanation;
  if (pair.type === 'CLO-anyPO' && label === 'ALIGNED') {
    const m = /^(\d+)\./m.exec(pair.source);
    return `PO ${m ? m[1] : 1} aligns with this course learning outcome.`;
  }
  if (pair.type === 'CLO-anyEGA' && label === 'ALIGNED') {
    const m = /^(\d+)\./m.exec(pair.source);
    return `EGA ${m ? m[1] : 1} aligns with this course learning outcome.`;
  }
  if (pair.type === 'ILO-anyCLO' && label === 'ALIGNED') {
    const m = /^CLO\s+(\d+):/im.exec(pair.source);
    return `CLO ${m ? m[1] : 1} fits this intended learning outcome.`;
  }
  if (pair.type === 'CLO-coverage' && label === 'ALIGNED') {
    const wm = /Week\s+(\d+)/i.exec(pair.target);
    return `Week ${wm ? wm[1] : 2} builds the stated course learning outcome.`;
  }
  if (label === 'ALIGNED') return 'The supplied target text aligns with the source requirement for this course.';
  return 'The target text does not fully align with the source requirement and needs revision.';
}

function defaultDraftFor(pair, label, recommendation, exp, course) {
  if (label === 'ALIGNED' || label === 'INSUFFICIENT_EVIDENCE') return '';
  if (NO_REWRITE_TYPES.has(pair.type) || recommendation === 'RETAG_OUTCOME' || recommendation === 'NO_CHANGE') return '';
  if (exp && typeof exp.oracleDraft === 'string' && exp.oracleDraft.trim()) return exp.oracleDraft;
  const title = course?.title || 'the course';
  if (pair.type === 'Module-value' || pair.type === 'Value-use') {
    return `Humility: students review their work with a classmate during the lesson activity and correct mistakes they find.`;
  }
  if (pair.type === 'ILO-activity' || pair.type === 'Activity-fit') {
    return `- Guided exercise and group practice applying the concepts of this lesson in ${title}`;
  }
  if (pair.type === 'ILO-assessment' || pair.type === 'Assessment-fit') {
    return `- Written problem set and practical task measuring the intended learning outcome for this lesson`;
  }
  return `Revised text aligned with ${title} for ${pair.id}.`;
}

function craftUnsupportedDraft(kind, pair, pairs, course) {
  switch (kind) {
    case 'assumes_resource':
      return '- In the electronics laboratory, measure the circuit using a benchtop digital storage oscilloscope, logic analyzer and function generator.';
    case 'conditional_resource':
      return '- Guided exercise analyzing system performance, using simulation software if available in the classroom.';
    case 'copies_other_relationship': {
      const sibling = pairs.find(p => p.id !== pair.id && p.target && p.target.length > 30);
      const borrowed = sibling ? sibling.target.slice(0, 120) : 'Restore damaged fresco plaster panels using mineral pigments and period brushwork techniques';
      return `${borrowed} using a specialized logic analyzer in the laboratory.`;
    }
    case 'copies_reference':
      return String(pair.source || '').trim();
    case 'keeps_off_subject':
      return String(pair.target || '').trim() + ' in the course.';
    case 'unnecessary_practical':
      return '- Hands-on coding practice where students write and run programs to explain the introductory definitions.';
    case 'expands_competency':
      return '- Design and implement a complete application with databases, user interfaces and deployment.';
    case 'adds_participant':
      return '- Invite industry partners and external clients to evaluate the student work during class.';
    case 'adds_activity':
      return 'Courage: during a formal debate competition and interview, students defend their work.';
    case 'adds_week':
      return 'Humility: in Week 15 and Week 16, students compare their work with a partner and revise mistakes.';
    case 'value_not_expressed': {
      const m = /^(Compassion|Courage|Community-orientedness|Humility|Interiority|Missionary Spirit)/i.exec(String(pair.target || ''));
      const val = m ? m[1] : 'Humility';
      return `${val}: compile the source code file and execute the binary output.`;
    }
    default:
      return '- In the laboratory, use an oscilloscope and logic analyzer to test the circuit.';
  }
}

function buildJudgementForPair(pair, context) {
  const { expectationsById, overrides, requiredKeys, course, pairs, pairAttempt, faultForPair } = context;
  const exp = (overrides && overrides[pair.id]) || expectationsById.get(pair.id) || null;
  let label = exp ? (exp.label || (Array.isArray(exp.accept) ? exp.accept[0] : 'ALIGNED')) : 'ALIGNED';
  let recommendation = exp && exp.modelRecommendation
    ? exp.modelRecommendation
    : label === 'ALIGNED'
      ? 'NO_CHANGE'
      : NO_REWRITE_TYPES.has(pair.type)
        ? 'REVIEW_REQUIRED'
        : 'REWRITE_TEXT';
  const hasRecommendField = !requiredKeys || requiredKeys.includes('recommendation');
  const effectiveRecommendationForDraft = hasRecommendField ? recommendation : (recommendation === 'RETAG_OUTCOME' ? 'REWRITE_TEXT' : recommendation);
  let sourceQuote = exp && exp.sourceQuote !== undefined ? exp.sourceQuote : pickSubstring(pair.source, exp?.oracleQuoteNo, pair.type);
  let targetQuote = exp && exp.targetQuote !== undefined ? exp.targetQuote : pickSubstring(pair.target, null, pair.type);
  let sourceBloom = exp?.sourceBloom || 'Understand';
  let targetBloom = exp?.targetBloom || 'Understand';
  let explanation = defaultExplanationFor(pair, label, exp);
  let draft = defaultDraftFor(pair, label, effectiveRecommendationForDraft, exp, course);
  let aspectValues = defaultAspectsFor(pair.type, label, exp?.fields);

  if (faultForPair) {
    const f = faultForPair;
    if (f.type === 'quotes_swapped') {
      const tmp = sourceQuote;
      sourceQuote = targetQuote;
      targetQuote = tmp;
    } else if (f.type === 'quote_wrong_side') {
      if (f.side === 'target') targetQuote = sourceQuote;
      else sourceQuote = targetQuote;
    } else if (f.type === 'quote_case_flip') {
      const flip = s => s.replace(/[A-Za-z]/, ch => (ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase()));
      if (f.side === 'target') targetQuote = flip(targetQuote);
      else sourceQuote = flip(sourceQuote);
    } else if (f.type === 'quote_from_other_pair') {
      let otherQuote = '';
      for (const p of pairs) {
        if (p.id === pair.id) continue;
        for (const text of [p.target, p.source]) {
          const cand = pickSubstring(text);
          if (cand && !String(pair.source || '').includes(cand) && !String(pair.target || '').includes(cand)) {
            otherQuote = cand;
            break;
          }
        }
        if (otherQuote) break;
      }
      if (!otherQuote) {
        const other = pairs.find(p => p.id !== pair.id) || pairs[0];
        otherQuote = pickSubstring(other.target || other.source);
      }
      if (f.side === 'target') targetQuote = otherQuote;
      else sourceQuote = otherQuote;
    } else if (f.type === 'quote_missing') {
      if (f.side === 'target') targetQuote = '';
      else sourceQuote = '';
    } else if (f.type === 'quote_not_found') {
      const bogus = 'phrase_definitely_not_present_in_any_supplied_text_98765';
      if (f.side === 'target') targetQuote = bogus;
      else if (f.side === 'both') { sourceQuote = bogus; targetQuote = bogus; }
      else sourceQuote = bogus;
    } else if (f.type === 'conflicting_recommendation') {
      label = f.label || 'NOT_ALIGNED';
      recommendation = f.recommendation || 'NO_CHANGE';
      if (f.draft !== undefined) draft = f.draft;
      else if (recommendation === 'RETAG_OUTCOME' && f.withRewrite) draft = 'Completely rewritten outcome statement that changes the faculty text.';
    } else if (f.type === 'conflicting_aspects') {
      label = f.label || 'ALIGNED';
      recommendation = label === 'ALIGNED' ? 'NO_CHANGE' : 'REWRITE_TEXT';
      draft = label === 'ALIGNED' ? '' : (f.draft || defaultDraftFor(pair, label, recommendation, exp, course));
      aspectValues = { ...aspectValues, ...(f.fields || { teaching: 'weak', learnerSupport: 'limited' }) };
    } else if (f.type === 'unsupported_draft') {
      label = f.label || (label === 'ALIGNED' ? 'PARTIALLY_ALIGNED' : label);
      recommendation = 'REWRITE_TEXT';
      draft = f.draft || craftUnsupportedDraft(f.kind, pair, pairs, course);
      if (pair.type === 'Activity-fit') aspectValues = { ...aspectValues, teaching: 'weak', learnerSupport: 'limited', responsible: 'activity' };
      if (pair.type === 'Assessment-fit') aspectValues = { ...aspectValues, measures: 'partly', evidence: 'observable', level: 'too_low', responsible: 'assessment' };
      if (pair.type === 'Value-use') {
        aspectValues = f.kind === 'value_not_expressed'
          ? { ...aspectValues, valueUse: 'unrelated', carriedBy: 'none', valueFit: 'clashes', responsible: 'values' }
          : { ...aspectValues, valueUse: 'name_only', carriedBy: 'none', valueFit: 'fits', responsible: 'values' };
      }
    } else if (f.type === 'role_confusion') {
      label = 'NOT_ALIGNED';
      recommendation = 'REWRITE_TEXT';
      explanation = `The ILO focuses on ${pickSubstring(pair.source, null, pair.type)}, whereas the CLO focuses on ${pickSubstring(pair.target, null, pair.type)}.`;
      draft = defaultDraftFor(pair, label, recommendation, exp, course);
    } else if (f.type === 'unassessed_aspect') {
      label = f.label || 'ALIGNED';
      recommendation = label === 'ALIGNED' ? 'NO_CHANGE' : 'REWRITE_TEXT';
      draft = label === 'ALIGNED' ? '' : defaultDraftFor(pair, label, recommendation, exp, course);
      for (const k of f.keys || ['teaching']) aspectValues[k] = 'not_assessed';
    } else if (f.type === 'malformed_aspect') {
      label = f.label || 'ALIGNED';
      recommendation = label === 'ALIGNED' ? 'NO_CHANGE' : 'REWRITE_TEXT';
      draft = label === 'ALIGNED' ? '' : defaultDraftFor(pair, label, recommendation, exp, course);
      for (const k of f.keys || ['learnerSupport']) aspectValues[k] = 'not_in_enum_value';
    }
  }

  const base = {
    id: pair.id,
    label,
    explanation,
    sourceQuote,
    targetQuote,
    sourceBloom,
    targetBloom,
    draft,
  };
  if (!requiredKeys || !requiredKeys.length) {
    return base;
  }
  const out = {};
  for (const key of requiredKeys) {
    if (key in base) out[key] = base[key];
    else if (key === 'recommendation') out.recommendation = recommendation;
    else if (key in aspectValues) out[key] = aspectValues[key];
  }
  return out;
}

function createOracle(options = {}) {
  const expectationsList = [
    ...(options.variantSpec?.expectations || []),
    ...(Array.isArray(options.expectations) ? options.expectations : []),
  ];
  const expectationsById = new Map(expectationsList.map(e => [e.id || e.relationship, e]));
  const overrides = options.overrides || {};
  const faults = (options.faults || []).map(f => ({ ...f, _triggered: 0 }));
  const stats = {
    requests: 0,
    requestBytes: 0,
    answered: 0,
    calls: [],
    pairAttempts: {},
    correctionsReceived: [],
  };

  function matchRequestFault(requestIndex, pairs) {
    for (const f of faults) {
      if (f.maxTriggers && f._triggered >= f.maxTriggers) continue;
      if (f.onRequest != null && f.onRequest === requestIndex && !f.onPair) {
        f._triggered += 1;
        return f;
      }
      if (f.onPair && ['empty_judgements', 'always_empty_judgements', 'broken_json', 'cutoff_length', 'http_error', 'timeout'].includes(f.type)) {
        const hasPair = pairs.some(p => p.id === f.onPair);
        if (!hasPair) continue;
        const attempt = stats.pairAttempts[f.onPair] || 1;
        if (f.type === 'always_empty_judgements' || f.attempt == null || f.attempt === attempt) {
          f._triggered += 1;
          return f;
        }
      }
    }
    return null;
  }

  function matchPairFault(pairId, attempt, requestIndex) {
    for (const f of faults) {
      if (f.maxTriggers && f._triggered >= f.maxTriggers) continue;
      if (f.onPair === pairId && (!f.onRequest || f.onRequest === requestIndex)) {
        if (f.attempt == null || f.attempt === attempt) {
          f._triggered += 1;
          return f;
        }
      }
    }
    return null;
  }

  async function transport(url, init = {}) {
    if (!String(url).startsWith('https://openrouter.ai/api/v1/chat/completions')) {
      throw new Error(`Unexpected provider URL in offline oracle: ${url}`);
    }
    stats.requests += 1;
    const bodyBytes = Buffer.byteLength(init.body || '', 'utf8');
    stats.requestBytes += bodyBytes;
    const requestIndex = stats.requests;
    const parsedBody = JSON.parse(init.body || '{}');
    const model = parsedBody.model || DEFAULT_MODEL;
    const userMessage = JSON.parse(parsedBody.messages?.[1]?.content || '{}');
    const course = userMessage.course || {};
    const pairs = userMessage.document_data || [];
    stats.answered += pairs.length;
    const corrections = userMessage.corrections || [];
    if (corrections.length) stats.correctionsReceived.push({ requestIndex, corrections });

    for (const p of pairs) {
      stats.pairAttempts[p.id] = (stats.pairAttempts[p.id] || 0) + 1;
    }

    const schemaItems = parsedBody.response_format?.json_schema?.schema?.properties?.judgements?.items;
    const requiredKeys = schemaItems?.required || null;

    const reqFault = matchRequestFault(requestIndex, pairs);
    const callRecord = {
      index: requestIndex,
      url,
      model,
      pairIds: pairs.map(p => p.id),
      types: [...new Set(pairs.map(p => p.type))],
      corrections,
      faultApplied: reqFault ? reqFault.type : null,
      responseStatus: 200,
    };
    stats.calls.push(callRecord);

    if (reqFault) {
      if (reqFault.type === 'timeout') {
        callRecord.responseStatus = 'TIMEOUT';
        const err = new Error('The operation was aborted due to timeout');
        err.name = 'TimeoutError';
        throw err;
      }
      if (reqFault.type === 'http_error') {
        const status = reqFault.status || 500;
        callRecord.responseStatus = status;
        return {
          ok: false,
          status,
          json: async () => ({ error: { message: reqFault.message || `Simulated HTTP ${status} error` } }),
        };
      }
      if (reqFault.type === 'broken_json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            model,
            choices: [{ finish_reason: 'stop', message: { content: '{"judgements":[{"id":"truncated' } }],
            usage: { prompt_tokens: 200, completion_tokens: 20 },
          }),
        };
      }
      if (reqFault.type === 'cutoff_length') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            model,
            choices: [{ finish_reason: 'length', message: { content: '{"judgements":[' } }],
            usage: { prompt_tokens: 200, completion_tokens: 8192 },
          }),
        };
      }
      if (reqFault.type === 'empty_judgements' || reqFault.type === 'always_empty_judgements') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            model,
            choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ judgements: [] }) } }],
            usage: { prompt_tokens: 200, completion_tokens: 10 },
          }),
        };
      }
    }

    const omitSet = new Set(reqFault?.type === 'omit_ids' ? (reqFault.ids || []) : []);
    const judgements = [];
    for (const pair of pairs) {
      const attempt = stats.pairAttempts[pair.id];
      const pairFault = matchPairFault(pair.id, attempt, requestIndex);
      if (pairFault) {
        callRecord.faultApplied = callRecord.faultApplied || `${pairFault.type}:${pair.id}`;
        if (pairFault.type === 'omit_id') continue;
      }
      if (omitSet.has(pair.id)) continue;
      judgements.push(
        buildJudgementForPair(pair, {
          expectationsById,
          overrides,
          requiredKeys,
          course,
          pairs,
          pairAttempt: attempt,
          faultForPair: pairFault,
        })
      );
    }

    const contentText = JSON.stringify({ judgements });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        model,
        choices: [{ finish_reason: 'stop', message: { content: contentText } }],
        usage: { prompt_tokens: 300 * pairs.length, completion_tokens: 80 * Math.max(1, judgements.length) },
      }),
    };
  }

  return { transport, stats, expectationsById };
}

async function withNoNetwork(fn) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    throw new Error(`Real network call is forbidden in Phase 3 Layer A offline tests (attempted: ${url})`);
  };
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function runWithOracle(syllabus, oracleOptions = {}, engineOptions = {}) {
  resetProviderBlock();
  const env = { ...DEFAULT_ENV, ...(engineOptions.env || {}) };
  const oracle = oracleOptions.transport ? oracleOptions : createOracle(oracleOptions);
  const linkChecker = engineOptions.linkChecker || (async url => ({
    url,
    status: 'ok',
    httpStatus: 200,
    reason: 'Synthetic offline test link',
  }));
  const result = await withNoNetwork(() =>
    run(syllabus.content, syllabus.masters, {
      ...engineOptions,
      linkChecker,
      env,
      transport: oracle.transport,
    })
  );
  return { result, oracle, env };
}

module.exports = {
  DEFAULT_MODEL,
  DEFAULT_ENV,
  LEGACY_ENV,
  createOracle,
  withNoNetwork,
  runWithOracle,
  buildJudgementForPair,
  pickSubstring,
};
