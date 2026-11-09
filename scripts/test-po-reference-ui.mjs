// Renders the Admin Program Outcome reference panel (components/PoReferencePanel.jsx) in English and Filipino. Follows scripts/test-i18n-ui.mjs: bundle the JSX test with rolldown, run it
// under node --test, delete the temporary file. No network, no database.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'rolldown';
const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'tests/.po-reference-ui-test.tmp.mjs');
try {
  await build({ input: path.join(root, 'tests/po-reference-panel.test.jsx'), platform: 'node', external: ['react-dom', 'react', 'react-dom/server', 'react/jsx-runtime', 'node:test', 'node:assert/strict'], transform: { define: { 'import.meta.env': '{}' }, jsx: { runtime: 'automatic' } }, output: { file }, logLevel: 'silent' });
  const result = spawnSync(process.execPath, ['--test', file], { cwd: root, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally { await fs.unlink(file).catch(() => {}); }
