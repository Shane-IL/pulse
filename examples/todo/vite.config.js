import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/pulse/todo/' : '/',
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
  },
});
