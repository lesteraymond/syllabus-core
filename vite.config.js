import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The modules in shared/ are CommonJS because the server require()s them, but the dev server sends project files to the browser as they are, and a
// browser cannot run CommonJS. Each one is wrapped here as an ES module whose default export is its module.exports. Only for self-contained modules:
// a shared module that require()s another would need more than this.
const sharedCommonJs = {
  name: 'shared-commonjs',
  apply: 'serve',
  transform(code, id) {
    if (!/\/shared\/[^/?]+\.cjs(?:\?|$)/.test(id)) return null;
    return { code: `const module = { exports: {} }; const exports = module.exports;\n${code}\nexport default module.exports;\n`, map: null };
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), sharedCommonJs],
});
