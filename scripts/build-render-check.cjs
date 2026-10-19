require('esbuild').buildSync({
  entryPoints: ['scripts/render-check.tsx'],
  bundle: true,
  platform: 'node',
  outfile: 'scripts/render-check.cjs',
  packages: 'external',
  alias: {
    '@shopify/react-native-skia': '@shopify/react-native-skia/lib/commonjs/headless',
  },
  jsx: 'automatic',
});
