import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
for (const args of [
  ['--test', 'src/i18n/i18n.test.js', 'src/i18n/transition.test.js', 'server/routes/preferences.routes.test.js'],
  ['scripts/test-i18n-ui.mjs'],
  ['scripts/audit-i18n.mjs'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
}
