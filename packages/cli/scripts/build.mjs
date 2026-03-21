import { build } from 'esbuild';
import { chmod, cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const packageRoot = resolve(scriptDir, '..');
export const workspaceRoot = resolve(packageRoot, '..', '..');
export const distDir = resolve(packageRoot, 'dist');
export const minimumSupportedNodeMajor = 22;
const distEntriesToReplace = ['index.js', 'cli.js', 'config', 'cli.blob', 'sea-config.json'];

export async function buildPublishableCli() {
  await mkdir(distDir, { recursive: true });

  for (const entry of distEntriesToReplace) {
    await rm(resolve(distDir, entry), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }

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
    force: true,
    errorOnExist: false,
  });

  return distDir;
}

async function main() {
  await buildPublishableCli();

  process.stdout.write(`Built publishable CLI bundle in ${distDir}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}