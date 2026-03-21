import { chmod, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import packageJson from '../package.json' with { type: 'json' };
import { buildPublishableCli, distDir, packageRoot, workspaceRoot } from './build.mjs';

const standaloneRoot = resolve(workspaceRoot, 'artifacts', 'cli', 'standalone', `${process.platform}-${process.arch}`);
const blobPath = resolve(distDir, 'cli.blob');
const seaConfigPath = resolve(distDir, 'sea-config.json');
const launcherPath = resolve(distDir, 'sea-launcher.cjs');
const executableName = process.platform === 'win32' ? 'is-ai-native.exe' : 'is-ai-native';
const executablePath = resolve(standaloneRoot, executableName);
const bundledCliPath = resolve(standaloneRoot, 'cli.mjs');
const postjectCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(command, args, cwd = workspaceRoot) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32' && command.endsWith('.cmd'),
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.status !== 0) {
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

async function main() {
  await buildPublishableCli();
  await rm(standaloneRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  await mkdir(standaloneRoot, { recursive: true });

  const launcherSource = [
    "const { join, dirname } = require('node:path');",
    "const { pathToFileURL } = require('node:url');",
    '',
    '(async () => {',
    "  const cliModulePath = join(dirname(process.execPath), 'cli.mjs');",
    '  await import(pathToFileURL(cliModulePath).href);',
    '})().catch((error) => {',
    "  process.stderr.write(`${error.message}\\n`);",
    '  process.exitCode = 1;',
    '});',
    '',
  ].join('\n');

  await writeFile(launcherPath, launcherSource, 'utf8');

  const seaConfig = {
    main: launcherPath,
    output: blobPath,
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
    useSnapshot: false,
  };

  await writeFile(seaConfigPath, `${JSON.stringify(seaConfig, null, 2)}\n`, 'utf8');
  run(process.execPath, ['--experimental-sea-config', seaConfigPath]);

  await cp(process.execPath, executablePath);
  await cp(resolve(distDir, 'cli.js'), bundledCliPath);
  await cp(resolve(distDir, 'config'), resolve(standaloneRoot, 'config'), {
    recursive: true,
    force: true,
    errorOnExist: false,
  });
  await cp(resolve(packageRoot, 'README.md'), resolve(standaloneRoot, 'README.md'));
  await cp(resolve(packageRoot, 'LICENSE'), resolve(standaloneRoot, 'LICENSE'));

  const postjectArgs = [
    executablePath,
    'NODE_SEA_BLOB',
    blobPath,
    '--sentinel-fuse',
    'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  ];

  if (process.platform === 'darwin') {
    postjectArgs.push('--macho-segment-name', 'NODE_SEA');
  }

  run(postjectCommand, ['postject', ...postjectArgs]);

  if (process.platform !== 'win32') {
    await chmod(executablePath, 0o755);
  }

  process.stdout.write(
    `Built standalone CLI bundle ${packageJson.version} in ${standaloneRoot} (${process.platform}-${process.arch})\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});