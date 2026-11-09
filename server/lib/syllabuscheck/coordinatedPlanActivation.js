'use strict';

const FLAG = 'SYLLABUS_CHECK_COORDINATED_PLAN';

function enabled(env = process.env) {
  const val = String(env?.[FLAG] || '').trim().toLowerCase();
  return val === 'on' || val === 'true' || val === '1';
}

module.exports = {
  FLAG,
  enabled,
};
