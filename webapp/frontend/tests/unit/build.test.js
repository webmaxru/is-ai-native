import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { buildFrontend } from '../../scripts/build.mjs';

test('buildFrontend embeds all browser configuration in runtime-config.js', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'is-ai-native-frontend-build-'));

  try {
    await buildFrontend({
      apiOrigin: 'https://backend.example.com',
      appInsightsConnectionString:
        'InstrumentationKey=test-key;IngestionEndpoint=https://eastus2-3.in.applicationinsights.azure.com/',
      outputDir,
      sharingEnabled: true,
      siteOrigin: 'https://frontend.example',
    });

    const runtimeConfig = await readFile(join(outputDir, 'runtime-config.js'), 'utf8');

    assert.match(runtimeConfig, /"apiOrigin": "https:\/\/backend\.example\.com"/);
    assert.match(runtimeConfig, /"sharingEnabled": true/);
    assert.match(runtimeConfig, /"appInsightsConnectionString": "InstrumentationKey=test-key/);
    assert.doesNotMatch(runtimeConfig, /__(?:PAGE|SITE|STRUCTURED_DATA|THEME|BACKGROUND|MASK|TWITTER)/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
