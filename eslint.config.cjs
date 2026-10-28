const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
module.exports = defineConfig([
  expo,
  { ignores: ['scripts/render-check.cjs', 'node_modules/**', 'dist/**'] },
  { rules: { 'react-hooks/exhaustive-deps': 'warn' } },
  {
    // Keep LAST so it wins the settings merge over eslint-config-next.
    settings: {
      react: {
        // Pin the React version so eslint-plugin-react (pulled via eslint-config-next)
        // skips auto-detection. Its detectReactVersion() calls context.getFilename(),
        // removed in ESLint 10, which crashes rules like react/display-name.
        version: '19.3',
      },
    },
  },
]);
