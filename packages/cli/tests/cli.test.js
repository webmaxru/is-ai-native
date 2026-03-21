import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import packageJson from '../package.json' with { type: 'json' };
import { scanGitHubTarget, scanLocalTarget } from '../src/index.js';

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}

test('scanLocalTarget scans a local repository path', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'is-ai-native-cli-'));

  try {
    mkdirSync(join(tempDir, '.github'));
    writeFileSync(join(tempDir, '.github', 'copilot-instructions.md'), 'instructions');

    const result = await scanLocalTarget(tempDir);
    assert.equal(result.source, 'local');
    assert.equal(result.repo_path, tempDir);
    assert.ok(result.score > 0);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('scanGitHubTarget scans a GitHub repo through the shared core', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (...args) => {
    const callIndex = global.fetch.calls.push(args) - 1;
    const responses = [
      jsonResponse({ default_branch: 'main', description: 'Repo', stargazers_count: 9 }, 200),
      jsonResponse({ tree: [{ path: '.github/copilot-instructions.md' }] }, 200),
    ];
    return responses[callIndex];
  };
  global.fetch.calls = [];

  try {
    const result = await scanGitHubTarget('microsoft/vscode');
    assert.equal(result.repo_name, 'microsoft/vscode');
    assert.equal(result.repo_url, 'https://github.com/microsoft/vscode');
    assert.ok(result.score > 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('cli returns exit code 2 when --fail-below is not met', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'is-ai-native-cli-bin-'));

  try {
    mkdirSync(join(tempDir, '.github'));
    writeFileSync(join(tempDir, '.github', 'copilot-instructions.md'), 'instructions');

    const cliPath = fileURLToPath(new URL('../bin/cli.js', import.meta.url));
    const result = spawnSync(
      process.execPath,
      [cliPath, 'scan', tempDir, '--output', 'summary', '--fail-below', '100'],
      { encoding: 'utf-8' }
    );

    assert.equal(result.status, 2);
    assert.match(result.stdout, /: \d+% \((AI-|Traditional)/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('cli scans the current workspace when scan target is omitted', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'is-ai-native-cli-default-target-'));

  try {
    mkdirSync(join(tempDir, '.github'));
    writeFileSync(join(tempDir, '.github', 'copilot-instructions.md'), 'instructions');

    const cliPath = fileURLToPath(new URL('../bin/cli.js', import.meta.url));
    const result = spawnSync(process.execPath, [cliPath, 'scan'], {
      cwd: tempDir,
      encoding: 'utf-8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Repository:/);
    assert.match(result.stdout, /Readiness Score: \d+% \((AI-|Traditional)/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('cli uses human output by default', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'is-ai-native-cli-default-output-'));

  try {
    mkdirSync(join(tempDir, '.github'));
    writeFileSync(join(tempDir, '.github', 'copilot-instructions.md'), 'instructions');

    const cliPath = fileURLToPath(new URL('../bin/cli.js', import.meta.url));
    const result = spawnSync(process.execPath, [cliPath, 'scan', tempDir], {
      encoding: 'utf-8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Repository:/);
    assert.doesNotMatch(result.stdout, /^\s*\{/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('cli reports the package version', () => {
  const cliPath = fileURLToPath(new URL('../bin/cli.js', import.meta.url));
  const result = spawnSync(process.execPath, [cliPath, '--version'], { encoding: 'utf-8' });

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), `${packageJson.name} ${packageJson.version}`);
});
