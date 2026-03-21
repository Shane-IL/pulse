import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/', 'node_modules/', 'examples/', 'git-context-workspace/'],
  },

  js.configs.recommended,

  // Allow _ prefixed unused vars everywhere
  {
    rules: {
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // TypeScript rules for src/
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['src/**/*.ts'],
  })),
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Test files: jsdom globals + vitest globals
  {
    files: ['__tests__/**/*.js'],
    languageOptions: {
      globals: {
        // vitest
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        // browser (jsdom)
        document: 'readonly',
        window: 'readonly',
        HTMLElement: 'readonly',
        Node: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        queueMicrotask: 'readonly',
        globalThis: 'readonly',
        PopStateEvent: 'readonly',
        MouseEvent: 'readonly',
      },
    },
  },

  // Node scripts (tools/, vite configs)
  {
    files: ['tools/**/*.js', '*.config.js', 'vite.config.*.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
];
