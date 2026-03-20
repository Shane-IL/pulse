import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'Pulse',
      formats: ['es', 'cjs'],
      fileName: (format) => format === 'es' ? 'pulse.js' : 'pulse.cjs',
    },
    minify: 'esbuild',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['__tests__/**/*.test.{js,ts}'],
  },
});
