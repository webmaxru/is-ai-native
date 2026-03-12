import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/extension.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/extension.js',
  platform: 'node',
  external: ['vscode'],
  target: 'node20',
  sourcemap: true,
});
