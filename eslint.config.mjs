import globals from 'globals';
import pluginJs from '@eslint/js';

export default [
  {
    ignores: ['node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.mocha },
    },
  },
  {
    files: ['**/public/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.jquery },
    },
  },
  pluginJs.configs.recommended,
  { rules: { 'no-unused-vars': 'off' } },
];
