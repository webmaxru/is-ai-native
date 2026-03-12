import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/index.js';

test('core config loader reads assistant metadata', () => {
  const { assistants } = loadConfig();

  assert.ok(assistants.some((assistant) => assistant.id === 'claude-code'));
  assert.ok(assistants.some((assistant) => assistant.id === 'openai-codex'));
});

test('core config loader reads documented primitive patterns', () => {
  const { primitives } = loadConfig();
  const byName = new Map(primitives.map((primitive) => [primitive.name, primitive]));

  assert.deepEqual(byName.get('Saved Prompts').assistants['github-copilot'].patterns, [
    '.github/prompts/*.prompt.md',
  ]);
  assert.deepEqual(byName.get('Agent Hooks').assistants['github-copilot'].patterns, [
    '.github/hooks/*.json',
  ]);
});