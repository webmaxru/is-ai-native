import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPrimitives, scanPrimitives } from '../src/index.js';

test('core scanner detects documented repository-scoped files', () => {
  const { primitives } = loadPrimitives();
  const results = scanPrimitives(
    [
      '.github/instructions/backend.instructions.md',
      '.claude/CLAUDE.md',
      'services/payments/AGENTS.override.md',
      '.claude/skills/review/SKILL.md',
      '.agents/skills/refactor/SKILL.md',
      '.codex/config.toml',
      '.github/hooks/security.json',
    ],
    primitives
  );
  const byName = new Map(results.map((result) => [result.name, result]));

  assert.equal(byName.get('Instruction Files').assistant_results['github-copilot'].detected, true);
  assert.equal(byName.get('Instruction Files').assistant_results['claude-code'].detected, true);
  assert.equal(byName.get('Instruction Files').assistant_results['openai-codex'].detected, true);
  assert.deepEqual(byName.get('Agent Hooks').assistant_results['github-copilot'].matched_files, [
    '.github/hooks/security.json',
  ]);
});