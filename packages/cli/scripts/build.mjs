import { build } from 'esbuild';
import { chmod, cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, '..');
const workspaceRoot = resolve(packageRoot, '..', '..');
const distDir = resolve(packageRoot, 'dist');
const minimumSupportedNodeMajor = 22;

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  await build({
    entryPoints: [resolve(packageRoot, 'src', 'index.js')],
    outfile: resolve(distDir, 'index.js'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: `node${minimumSupportedNodeMajor}`,
    legalComments: 'none',
  });

  await build({
    entryPoints: [resolve(packageRoot, 'bin', 'cli.js')],
    outfile: resolve(distDir, 'cli.js'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: `node${minimumSupportedNodeMajor}`,
    legalComments: 'none',
  });

  await chmod(resolve(distDir, 'cli.js'), 0o755);
  await cp(resolve(workspaceRoot, 'packages', 'core', 'config'), resolve(distDir, 'config'), {
    recursive: true,
  });

  process.stdout.write(`Built publishable CLI bundle in ${distDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});