'use strict';
// For tests that start an evaluation script (scripts/eval-alignment.cjs, scripts/live-pipeline-eval.cjs) as a child process. Those scripts read a local env file
// (the repository's .env, or server/.env) and take from it every setting the child's environment does not name. A developer's own switches, for example
// SYLLABUS_CHECK_REQUIREMENTS_ADVICE=on or SYLLABUS_CHECK_COURSE_CONTEXT=scoped, then changed what the tests saw: they passed on a machine with no env file
// (CI) and failed on one that had one. This names every SYLLABUS_CHECK_* setting the checker reads, with an empty value (the same as unset for every one of
// them), so no env file can fill it. A test then states the settings it is about. The list is read from the checker's own source, so a setting added later is
// covered without editing the tests. Test use only: the application never loads this.
const fs = require('fs');
const path = require('path');

let cached = null;
function neutralCheckerEnv() {
  if (cached) return { ...cached };
  const names = new Set();
  const dir = path.join(__dirname, '..');
  for (const file of fs.readdirSync(dir)) {
    if (!/\.js$/.test(file) || /\.test\.js$/.test(file)) continue;
    for (const m of fs.readFileSync(path.join(dir, file), 'utf8').matchAll(/SYLLABUS_CHECK_[A-Z0-9_]*[A-Z0-9]/g)) names.add(m[0]);
  }
  cached = Object.fromEntries([...names].sort().map((name) => [name, '']));
  return { ...cached };
}

module.exports = { neutralCheckerEnv };
