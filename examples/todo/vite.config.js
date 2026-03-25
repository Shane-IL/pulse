import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/pulse/todo/' : '/',
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@shane_il/pulse',
  },
});
