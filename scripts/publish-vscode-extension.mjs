import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, '..');
const extensionDir = resolve(workspaceRoot, 'packages', 'vscode-extension');

function loadWorkspaceEnv() {
  if (typeof process.loadEnvFile !== 'function') {
    return;
  }

  try {
    process.loadEnvFile(resolve(workspaceRoot, '.env'));
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

function resolveExecutable(command) {
  if (process.platform !== 'win32') {
    return command;
  }

  if (command === 'npm') {
    return 'npm.cmd';
  }

  if (command === 'npx') {
    return 'npx.cmd';
  }

  return command;
}

function quoteWindowsShellArgument(argument) {
  if (!/[\s"&()\[\]{}^=;!'+,`~|<>]/.test(argument)) {
    return argument;
  }

  return `"${argument.replaceAll('"', '""')}"`;
}

function run(command, args, { cwd = workspaceRoot, env = process.env } = {}) {
  const executable = resolveExecutable(command);
  const spawnOptions = {
    cwd,
    env,
    encoding: 'utf8',
    stdio: 'inherit',
  };

  const result = process.platform === 'win32' && executable.endsWith('.cmd')
    ? spawnSync(process.env.comspec ?? 'cmd.exe', ['/d', '/s', '/c', [executable, ...args].map(quoteWindowsShellArgument).join(' ')], spawnOptions)
    : spawnSync(executable, args, spawnOptions);

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`);
  }
}

function main() {
  loadWorkspaceEnv();

  const extraArgs = process.argv.slice(2);
  const helpRequested = extraArgs.includes('--help') || extraArgs.includes('-h');

  if (!helpRequested && !process.env.VSCE_PAT) {
    throw new Error('Set VSCE_PAT in the shell or root .env before publishing the VS Code extension.');
  }

  run('npx', ['@vscode/vsce', 'publish', '--no-dependencies', ...extraArgs], { cwd: extensionDir });
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}