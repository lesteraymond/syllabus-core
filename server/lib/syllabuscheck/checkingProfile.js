'use strict';
// Server-owned opt-in only. This expands academic scope, never provider access,
// budgets, external lookups, official scoring, or submission policy.
const FLAG = 'SYLLABUS_CHECK_PROFILE';
const NAME = 'comprehensive-testing';
const STAGES = ['A','B','B3','B4','C1','C2','C3','D1','D2'];
const enabled = (env = process.env) => env[FLAG] === NAME;
function resolve(env = process.env) {
  if (!enabled(env)) return env;
  return {...env, SYLLABUS_CHECK_ACADEMIC_V2:'on', SYLLABUS_CHECK_REQUIREMENTS_ADVICE:'on',
    ...Object.fromEntries(STAGES.map(s => [`SYLLABUS_CHECK_STAGE_${s}`, 'on']))};
}
// Primary V2 path owns these advisory questions. Scored legacy questions remain
// intact because their prompt/context and authorized deductions are different.
const V2_ADVISORY = ['Course-CLO','Description-plan','Content-course','Content-ILO','Title-description'];
module.exports = {FLAG, NAME, STAGES, enabled, resolve, V2_ADVISORY};
