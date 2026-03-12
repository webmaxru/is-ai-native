import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateOverallScore,
  calculatePerAssistantScores,
  getVerdict,
} from '../src/index.js';

test('core scorer keeps assistant-specific overall scoring', () => {
  const primitiveResults = [
    {
      name: 'Instruction Files',
      category: 'instructions',
      assistant_results: {
        'github-copilot': { detected: true, matched_files: ['.github/copilot-instructions.md'] },
        'claude-code': { detected: true, matched_files: ['CLAUDE.md'] },
      },
    },
    {
      name: 'Agent Hooks',
      category: 'hooks',
      assistant_results: {
        'github-copilot': { detected: true, matched_files: ['.github/hooks/pre-commit.sh'] },
        'claude-code': { detected: false, matched_files: [] },
      },
    },
  ];

  assert.equal(calculateOverallScore(primitiveResults), 75);
  assert.equal(getVerdict(60), 'AI-Native');
  assert.equal(getVerdict(29), 'Traditional');
});

test('core scorer calculates per-assistant scores from supported primitives only', () => {
  const primitiveResults = [
    {
      name: 'Instruction Files',
      category: 'instructions',
      assistant_results: {
        'github-copilot': { detected: true, matched_files: ['.github/copilot-instructions.md'] },
        'claude-code': { detected: true, matched_files: ['CLAUDE.md'] },
      },
    },
    {
      name: 'Custom Agent Definitions',
      category: 'agents',
      assistant_results: {
        'github-copilot': { detected: false, matched_files: [] },
      },
    },
  ];
  const assistants = [
    { id: 'github-copilot', name: 'GitHub Copilot' },
    { id: 'claude-code', name: 'Claude Code' },
  ];

  const result = calculatePerAssistantScores(primitiveResults, assistants);
  assert.equal(result[0].score, 50);
  assert.equal(result[1].score, 100);
});