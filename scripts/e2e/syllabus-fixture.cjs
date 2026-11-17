'use strict';
// The E2E's synthetic syllabus: the new AI Checker's conforming syllabus (server/lib/syllabuscheck/pipeline/testSyllabus.js `conforming`: every fixed
// rule passes) with the course details and synthetic masters (EGAs, POs, approved curriculum) of the shared fixture (syllabuscheck/fixtures.js).
// No institutional or faculty text. Everything the checker then finds comes from the offline stand-in's one deliberate gap (fake-anthropic.cjs).
const path = require('node:path');
const fixtures = require(path.resolve(__dirname, '../../server/lib/syllabuscheck/fixtures'));
const T = require(path.resolve(__dirname, '../../server/lib/syllabuscheck/pipeline/testSyllabus'));

function sample() {
  const { content: shared, masters } = fixtures.sample();
  const content = T.conforming();
  content.meta = { ...shared.meta }; // IT 204 with its year level and curriculum year, as the approved curriculum lists it
  content.outcomes = shared.outcomes; // the vision, mission, EGAs and POs as the masters state them (the builder fills these in; a syllabus saved only through the API needs them)
  return { content, masters };
}

module.exports = { sample };
