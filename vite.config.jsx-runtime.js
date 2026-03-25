import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        'jsx-runtime': resolve(__dirname, 'src/jsx-runtime.ts'),
        'jsx-dev-runtime': resolve(__dirname, 'src/jsx-dev-runtime.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) =>
        format === 'es' ? `${entryName}.js` : `${entryName}.cjs`,
    },
    outDir: 'dist',
    emptyOutDir: false,
    minify: 'esbuild',
    sourcemap: true,
  },
});
