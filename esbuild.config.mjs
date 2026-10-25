import * as esbuild from 'esbuild';

const bundles = [
  { entry: 'src/index.ts', outfile: 'dist/index.js' },
  { entry: 'src/email-handler.ts', outfile: 'dist/email.js' },
  { entry: 'src/alerts-handler.ts', outfile: 'dist/alerts.js' },
  { entry: 'src/digest-handler.ts', outfile: 'dist/digest.js' },
];

for (const { entry, outfile } of bundles) {
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile,
    format: 'cjs',
    external: ['@aws-sdk/*', 'sharp'],
    minify: true,
    sourcemap: false,
  });

  console.log(`Build complete: ${outfile}`);
}
