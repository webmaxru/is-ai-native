import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildExtension, extensionRoot } from '../esbuild.config.mjs';

test('buildExtension copies bundled config into the packaged extension', async () => {
  const configDir = join(extensionRoot, 'config');
  const primitivesPath = join(configDir, 'primitives.json');
  const assistantsPath = join(configDir, 'assistants.json');

  rmSync(configDir, { recursive: true, force: true });

  await buildExtension();

  assert.equal(existsSync(primitivesPath), true);
  assert.equal(existsSync(assistantsPath), true);

  const primitives = JSON.parse(readFileSync(primitivesPath, 'utf8'));
  const assistants = JSON.parse(readFileSync(assistantsPath, 'utf8'));

  assert.ok(Array.isArray(primitives.primitives));
  assert.ok(primitives.primitives.length > 0);
  assert.ok(Array.isArray(assistants.assistants));
  assert.ok(assistants.assistants.length > 0);
});