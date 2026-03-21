import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/devtools/index.ts'),
      name: 'PulseDevtools',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'devtools.js' : 'devtools.cjs'),
    },
    outDir: 'dist',
    emptyOutDir: false,
    minify: 'esbuild',
    sourcemap: true,
  },
});
