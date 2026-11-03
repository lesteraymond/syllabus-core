'use strict';
const F = require('../compliance/fixtures');
function sample(kind = 'aligned') {
  const content = F.good();
  content.meta.yearLevel = '2';
  content.meta.curriculumYear = 'test-2026';
  const catalog = F.catalog();
  content.outcomes = structuredClone({ ...catalog.institution, egas: catalog.program.egas, pos: catalog.program.pos });
  const masters = {
    synthetic: true,
    institution: { ...catalog.institution, egas: catalog.program.egas },
    pos: catalog.program.pos,
    curricula: [{ program: 'BSIT', curriculumYear: 'test-2026', status: 'approved', courses: [{ code: 'IT 204', title: content.meta.title, prereq: content.meta.prereq, lecture: 2, lab: 1, yearLevel: 2 }] }],
  };
  if (kind === 'invalid-course') { content.meta.program = 'BSIE'; content.meta.code = 'IE 204'; masters.curricula[0].program = 'BSIE'; }
  if (kind === 'misaligned') {
    content.clos[0].statement = 'Design and construct a tested inventory management program.';
    content.plan[0].ilos[0].text = 'Design and construct a program that computes inventory reorder quantities.';
    content.plan[0].activities = 'Practice folk-dance steps and select costume colors.';
    content.plan[0].tasks = 'Multiple choice quiz recalling flower names only.';
    content.plan[0].values = '';
  }
  if (kind === 'broken-link') content.refs.online.items.push({ id: 'link', t: 'Example (2026). https://example.org/missing' });
  return { content, masters };
}
module.exports = { sample };
