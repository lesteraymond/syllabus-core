// The app's stylesheet as the browser receives it: src/tailwind.css compiled by Tailwind (which resolves the @apply statements in
// styles.css into plain declarations), unminified. A test that asserts what a rule DOES, not how it is written, reads this instead of
// the source file, so converting a rule to or from @apply cannot change the result. Tests run in Node, with no Vite, so it calls the
// same compiler the build uses. The first call takes about a second; the result is cached.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

let cached;
export function compiledAppCss() {
  if (!cached) {
    cached = (async () => {
      const require = createRequire(import.meta.url);
      const { compile } = require('@tailwindcss/node');
      const base = fileURLToPath(new URL('..', import.meta.url));
      const entry = readFileSync(new URL('../tailwind.css', import.meta.url), 'utf8');
      const compiler = await compile(entry, { base, onDependency() {} });
      return compiler.build([]).replace(/\/\*[\s\S]*?\*\//g, '');
    })();
  }
  return cached;
}
