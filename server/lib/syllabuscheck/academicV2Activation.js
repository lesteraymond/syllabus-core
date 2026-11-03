'use strict';

const POLICY = require('../../../src/data/academicPolicyV2.json');
const FLAG = 'SYLLABUS_CHECK_ACADEMIC_V2';

const enabled = (env = process.env) => String(env?.[FLAG] || '').trim().toLowerCase() === 'on';
const integrated = (options = {}, env = options.env || process.env) => options.integratedAcademic === true &&
  options.academicPolicy === POLICY.id && options.evaluationOnly !== true && enabled(env);

module.exports = { FLAG, POLICY_ID: POLICY.id, enabled, integrated };
