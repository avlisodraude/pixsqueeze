import js from '@eslint/js';
import { flatConfigs } from 'eslint-plugin-import-x';
import globals from 'globals';

export default [
  // ── Base recommended rules ──────────────────────────────────────────────
  js.configs.recommended,

  // ── Import plugin ───────────────────────────────────────────────────────
  flatConfigs.recommended,

  // ── Main source + config files ──────────────────────────────────────────
  {
    files: ['src/**/*.js', '*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // ── Style ─────────────────────────────────────────────────────────
      'arrow-body-style': ['error', 'as-needed'],
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'object-shorthand': ['error', 'always'],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],

      // ── Best practices ────────────────────────────────────────────────
      'no-param-reassign': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'warn',

      // ── Import ordering ───────────────────────────────────────────────
      'import-x/order': ['error', { 'newlines-between': 'never' }],
      'import-x/no-unresolved': 'off', // rollup handles resolution
    },
  },

  // ── Test files ──────────────────────────────────────────────────────────
  {
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.mocha,
        // karma-chai injects expect globally at runtime
        expect: 'readonly',
        PixSqueeze: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-console': 'off',
      'import-x/no-unresolved': 'off',
    },
  },

  // ── Specs that use ES module imports ─────────────────────────────────────
  {
    files: [
      'test/specs/options/retainExif.spec.js',
      'test/specs/heic.spec.js',
      'test/specs/tiff.spec.js',
      'test/specs/raw.spec.js',
    ],
    languageOptions: {
      sourceType: 'module',
    },
  },

  // ── Server + API files (Node.js — console logging is intentional) ──────────
  {
    files: ['server/**/*.js', 'api/**/*.js', 'test/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        fetch: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'import-x/no-unresolved': 'off',
    },
  },

  // ── Self-contained local playground ─────────────────────────────────────
  {
    files: ['docs/js/local-demo.js'],
    languageOptions: {
      globals: globals.browser,
    },
  },

  // ── Examples (Node.js ES modules) ────────────────────────────────────────
  {
    files: ['examples/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },

  // ── Karma config (Node.js CJS) ───────────────────────────────────────────
  {
    files: ['test/karma.conf.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
  },

  // ── Ignored paths ───────────────────────────────────────────────────────
  {
    ignores: ['dist/**', 'docs/js/pixsqueeze.js', 'docs/js/main.js', 'node_modules/**', 'coverage/**'],
  },
];
