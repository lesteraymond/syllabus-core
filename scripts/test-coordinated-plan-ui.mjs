import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'rolldown';

const root = path.resolve(import.meta.dirname, '..');
const bundle = path.join(root, 'tests/.coord-plan-ui-test.tmp.mjs');

try {
  await build({
    input: path.join(root, 'tests/coordinated-plan-ui.test.jsx'),
    platform: 'node',
    external: [
      'react-dom',
      'react',
      'react-dom/server',
      'react/jsx-runtime',
      'node:test',
      'node:assert/strict',
      'node:fs',
    ],
    transform: {
      define: { 'import.meta.env': '{}' },
      jsx: { runtime: 'automatic' },
    },
    output: { file: bundle },
    logLevel: 'silent',
  });

  const result = spawnSync(process.execPath, ['--test', bundle], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env },
  });

  process.exitCode = result.status ?? 1;
} finally {
  await fs.unlink(bundle).catch(() => {});
}
