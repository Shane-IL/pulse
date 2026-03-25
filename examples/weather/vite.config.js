import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/pulse/weather/' : '/',
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: '@shane_il/pulse',
  },
});
