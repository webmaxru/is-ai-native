import test from 'node:test';
import assert from 'node:assert/strict';
import { Profiles, scanRepository } from '../src/index.js';

test('scanRepository composes sources into a reusable result shape', async () => {
  const result = await scanRepository(
    Profiles.inMemory({
      paths: ['.github/copilot-instructions.md', '.github/prompts/review.prompt.md'],
      metadata: {
        kind: 'github',
        owner: 'octo',
        repo: 'demo',
        url: 'https://github.com/octo/demo',
        stars: 5,
        description: 'Demo repo',
        default_branch: 'main',
      },
    })
  );

  assert.equal(result.repo_name, 'octo/demo');
  assert.equal(result.repo_url, 'https://github.com/octo/demo');
  assert.equal(typeof result.score, 'number');
  assert.ok(result.per_assistant.length > 0);
  assert.equal(result.paths_scanned, 2);
});
