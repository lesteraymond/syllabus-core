'use strict';
// The week a Learning Plan row starts at (a row for "Week 1-2" starts at 1); a row with no number sorts last. The same rule as formOps' sortPlan.
const weekKey = (row) => { const m = /\d+/.exec(String(row && row.week != null ? row.week : '')); return m ? Number(m[0]) : Infinity; };
module.exports = { weekKey };
