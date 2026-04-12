import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/index.js',
  format: 'cjs',
  external: ['@aws-sdk/*', 'sharp'],
  minify: true,
  sourcemap: false,
});

console.log('Build complete: dist/index.js');
