// VPAA conformance, UI part: renders the real stored-run shapes in the AI Checker card. Follows scripts/test-i18n-ui.mjs: bundle the JSX test with
// rolldown, run it under node --test, delete the temporary files. The runs are generated here with the production server code and scripted model
// answers (no network, no database, nothing committed). Nothing here calls Claude.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { build } from 'rolldown';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const bundle = path.join(root, 'tests/.vpaa-ui-test.tmp.mjs');
const fixture = path.join(root, 'tests/.vpaa-ui-fixture.tmp.json');
try {
  const { buildRuns } = require('../server/lib/syllabuscheck/vpaa-conformance/ui-fixtures.js');
  await fs.writeFile(fixture, JSON.stringify(await buildRuns()));
  await build({ input: path.join(root, 'tests/vpaa-conformance-ui.test.jsx'), platform: 'node', external: ['react-dom', 'react', 'react-dom/server', 'react/jsx-runtime', 'node:test', 'node:assert/strict', 'node:fs'], transform: { define: { 'import.meta.env': '{}' }, jsx: { runtime: 'automatic' } }, output: { file: bundle }, logLevel: 'silent' });
  const result = spawnSync(process.execPath, ['--test', bundle], { cwd: root, stdio: 'inherit', env: { ...process.env, VPAA_UI_FIXTURE: fixture } });
  process.exitCode = result.status ?? 1;
} finally {
  await fs.unlink(bundle).catch(() => {});
  await fs.unlink(fixture).catch(() => {});
}
