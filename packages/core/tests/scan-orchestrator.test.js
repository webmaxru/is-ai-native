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

test('scanRepository derives the top-level verdict from the highest assistant score', async () => {
  const configSource = {
    loadConfig() {
      return {
        assistants: [
          { id: 'assistant-a', name: 'Assistant A' },
          { id: 'assistant-b', name: 'Assistant B' },
        ],
        primitives: [
          {
            name: 'Primitive One',
            category: 'instructions',
            assistants: {
              'assistant-a': { patterns: ['a.txt'] },
              'assistant-b': { patterns: ['b.txt'] },
            },
          },
          {
            name: 'Primitive Two',
            category: 'prompts',
            assistants: {
              'assistant-a': { patterns: ['a-only.txt'] },
            },
          },
        ],
      };
    },
  };

  const result = await scanRepository(
    Profiles.inMemory({
      paths: ['b.txt'],
      metadata: { kind: 'local', rootPath: 'C:/demo' },
      configSource,
    })
  );

  assert.equal(result.score, 33);
  assert.deepEqual(
    result.per_assistant.map((assistant) => ({ id: assistant.id, score: assistant.score })),
    [
      { id: 'assistant-a', score: 0 },
      { id: 'assistant-b', score: 100 },
    ]
  );
  assert.equal(result.verdict, 'AI-Native');
});
