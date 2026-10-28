const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  { ignores: ['scripts/render-check.cjs', 'node_modules/**', 'dist/**'] },
  { rules: { 'react-hooks/exhaustive-deps': 'warn' } },
  {
    settings: {
      react: {
        version: '19.3',
      },
    },
  },
]);
