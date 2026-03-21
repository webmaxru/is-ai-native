import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('build:gh-extension emits a single shebang and a runnable bundle', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'is-ai-native-gh-extension-'));
  const outputDir = join(tempDir, 'repo');
  const sampleRepo = join(tempDir, 'sample');

  try {
    mkdirSync(join(sampleRepo, '.github'), { recursive: true });
    writeFileSync(join(sampleRepo, '.github', 'copilot-instructions.md'), 'instructions');

    const buildScriptPath = fileURLToPath(new URL('../scripts/build.mjs', import.meta.url));
    const buildResult = spawnSync(process.execPath, [buildScriptPath], {
      cwd: join(fileURLToPath(new URL('..', import.meta.url)), '..'),
      env: {
        ...process.env,
        GH_EXTENSION_OUTPUT_DIR: outputDir,
      },
      encoding: 'utf-8',
    });

    assert.equal(buildResult.status, 0, buildResult.stderr);

    const bundlePath = join(outputDir, 'gh-is-ai-native.mjs');
    const bundle = readFileSync(bundlePath, 'utf8');
    const [firstLine, secondLine] = bundle.split(/\r?\n/, 3);

    assert.equal(firstLine, '#!/usr/bin/env node');
    assert.notEqual(secondLine, '#!/usr/bin/env node');

    const runResult = spawnSync(
      process.execPath,
      [bundlePath, 'scan', sampleRepo, '--output', 'summary'],
      { encoding: 'utf-8' }
    );

    assert.equal(runResult.status, 0, runResult.stderr);
    assert.match(runResult.stdout, /AI-|Traditional/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});