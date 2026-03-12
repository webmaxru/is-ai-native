import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BundledConfigSource, ComposedConfigSource, FileSystemConfigSource } from '../src/index.js';

test('bundled config source loads the packaged configuration', () => {
  const config = new BundledConfigSource().loadConfig();

  assert.ok(config.primitives.length > 0);
  assert.ok(config.assistants.some((assistant) => assistant.id === 'github-copilot'));
});

test('composed config source supports partial overrides', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'is-ai-native-core-'));

  try {
    writeFileSync(
      join(tempDir, 'assistants.json'),
      JSON.stringify({
        assistants: [{ id: 'custom-assistant', name: 'Custom Assistant' }],
      })
    );

    const source = new ComposedConfigSource([
      new FileSystemConfigSource({ assistantsPath: join(tempDir, 'assistants.json') }),
      new BundledConfigSource(),
    ]);
    const config = source.loadConfig();

    assert.equal(config.assistants[0].id, 'custom-assistant');
    assert.ok(config.primitives.length > 0);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
