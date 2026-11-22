// The Repository page in a browser (happy-dom): tests/repository-ui.test.jsx. Run by npm run test:localization.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'rolldown';
const root = path.resolve(import.meta.dirname, '..');
const file = path.join(root, 'tests/.repository-ui.tmp.mjs');
try {
  await build({ input: path.join(root, 'tests/repository-ui.test.jsx'), platform: 'node', external: ['react', 'react-dom/client', 'react/jsx-runtime', 'happy-dom', 'node:test', 'node:assert/strict'], transform: { define: { 'import.meta.env': '{}' }, jsx: { runtime: 'automatic' } }, output: { file, format: 'esm' }, logLevel: 'silent' });
  const result = spawnSync(process.execPath, ['--test', file], { cwd: root, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally { await fs.unlink(file).catch(() => {}); }
