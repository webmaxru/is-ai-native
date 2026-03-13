import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const scriptPath = fileURLToPath(import.meta.url);
export const extensionRoot = dirname(scriptPath);
const coreConfigRoot = resolve(extensionRoot, '../core/config');
const extensionConfigRoot = join(extensionRoot, 'config');

export function syncBundledConfig() {
  rmSync(extensionConfigRoot, { recursive: true, force: true });
  mkdirSync(extensionConfigRoot, { recursive: true });
  cpSync(join(coreConfigRoot, 'primitives.json'), join(extensionConfigRoot, 'primitives.json'));
  cpSync(join(coreConfigRoot, 'assistants.json'), join(extensionConfigRoot, 'assistants.json'));
}

export async function buildExtension() {
  syncBundledConfig();

  await esbuild.build({
    absWorkingDir: extensionRoot,
    entryPoints: [join(extensionRoot, 'src', 'extension.js')],
    bundle: true,
    format: 'esm',
    outfile: join(extensionRoot, 'dist', 'extension.js'),
    platform: 'node',
    external: ['vscode'],
    target: 'node20',
    sourcemap: true,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  await buildExtension();
}
